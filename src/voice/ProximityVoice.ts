import Peer, { type MediaConnection } from "peerjs";
import type { DoorState } from "../../shared/protocol";
import { hasCampLineOfSight } from "../../shared/campVision";
import { peerOptions } from "../networking/peerConfig";

export type VoicePosition = { x: number; y: number; z: number };

type Remote = {
  id: string;
  call: MediaConnection;
  nodes: AudioNode[];
  gain: GainNode;
  filter: BiquadFilterNode;
  panner: PannerNode;
  analyser: AnalyserNode;
  data: Uint8Array;
  element: HTMLAudioElement;
  level: number;
};

export const VOICE_RANGE = 30;
const FULL_VOLUME_RANGE = 3;
const MUFFLED_CUTOFF = 650;
const CLEAR_CUTOFF = 14000;

export const voicePeerId = (playerId: string) => `snallyv-${playerId}`;

/**
 * Proximity voice chat. Every player holds a WebRTC audio call to every other player.
 * Incoming audio is routed through Web Audio: 3D panning, distance fall-off, a hard range
 * limit, and a low-pass "muffle" whenever walls or closed doors block the line between speakers.
 */
export class ProximityVoice {
  private ctx: AudioContext | null = null;
  private peer: Peer | null = null;
  private localStream: MediaStream | null = null;
  private localAnalyser: AnalyserNode | null = null;
  private localData: Uint8Array | null = null;
  private localId = "";
  private remotes = new Map<string, Remote>();
  private roster: string[] = [];
  private muted = false;
  private stopped = false;
  private statusListener: ((status: VoiceStatus) => void) | null = null;
  private _status: VoiceStatus = { state: "idle", message: "Mic off", muted: false };
  private micLevel = 0;
  private extraGain = 1;
  micEnabled = false;

  get status() { return this._status; }
  get isMuted() { return this.muted; }
  get localLevel() { return this.micLevel; }

  onStatus(listener: (status: VoiceStatus) => void) { this.statusListener = listener; listener(this._status); }

  /** Call synchronously from a click so iOS/Safari allow audio playback. */
  prepare() {
    if (!this.ctx) {
      const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtor) this.ctx = new AudioCtor();
    }
    void this.ctx?.resume();
  }

  async start(localPlayerId: string) {
    if (this.peer || this.stopped) return;
    this.localId = localPlayerId;
    this.prepare();
    if (!this.ctx) return this.setStatus("error", "This browser has no Web Audio support.");
    this.setStatus("connecting", "Requesting microphone…");

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
        video: false,
      });
      this.micEnabled = true;
      const source = this.ctx.createMediaStreamSource(this.localStream);
      this.localAnalyser = this.ctx.createAnalyser();
      this.localAnalyser.fftSize = 512;
      this.localData = new Uint8Array(this.localAnalyser.fftSize);
      source.connect(this.localAnalyser);
    } catch {
      // Listen-only fallback: still answer calls with a silent track so others can be heard.
      this.localStream = this.silentStream();
      this.micEnabled = false;
      this.setStatus("listen-only", "Mic blocked. You can hear others but they can't hear you.");
    }

    const peer = new Peer(voicePeerId(this.localId), peerOptions());
    this.peer = peer;
    peer.on("open", () => {
      if (this.micEnabled) this.setStatus("live", this.muted ? "Mic muted" : "Mic live");
      this.syncRoster(this.roster);
    });
    peer.on("call", (call) => {
      if (!this.localStream) return;
      call.answer(this.localStream);
      this.bind(call);
    });
    peer.on("error", () => {
      if (this._status.state !== "listen-only") this.setStatus("error", "Voice server unreachable. Gameplay is unaffected.");
    });
    peer.on("disconnected", () => { try { peer.reconnect(); } catch {} });
  }

  /** Called whenever the roster changes. Lower id dials higher id to avoid duplicate calls. */
  syncRoster(playerIds: string[]) {
    this.roster = playerIds;
    if (!this.peer?.open || !this.localStream) return;
    for (const id of playerIds) {
      if (id === this.localId || this.remotes.has(id) || id < this.localId) continue;
      const call = this.peer.call(voicePeerId(id), this.localStream);
      if (call) this.bind(call);
    }
    for (const [id, remote] of this.remotes) {
      if (!playerIds.includes(id)) this.drop(remote);
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    this.localStream?.getAudioTracks().forEach((track) => { track.enabled = !muted && this.micEnabled; });
    if (this._status.state === "live") this.setStatus("live", muted ? "Mic muted" : "Mic live");
    else this.statusListener?.({ ...this._status, muted });
  }

  toggleMute() { this.setMuted(!this.muted); return this.muted; }

  /** Per-frame spatial update. `positions` are world positions of remote players by id. */
  update(listener: VoicePosition, forward: VoicePosition, positions: Map<string, VoicePosition>, doors: readonly DoorState[]) {
    this.measureLocal();
    const ctx = this.ctx;
    if (!ctx) return;
    this.setListener(ctx.listener, listener, forward);
    const now = ctx.currentTime;

    for (const remote of this.remotes.values()) {
      const position = positions.get(remote.id);
      if (!position) { remote.gain.gain.setTargetAtTime(0, now, 0.05); continue; }
      const dx = position.x - listener.x, dz = position.z - listener.z;
      const distance = Math.hypot(dx, dz);
      const fade = distance >= VOICE_RANGE ? 0 : distance <= FULL_VOLUME_RANGE ? 1 : Math.pow(1 - (distance - FULL_VOLUME_RANGE) / (VOICE_RANGE - FULL_VOLUME_RANGE), 1.6);
      const blocked = distance > 1.5 && !hasCampLineOfSight({ x: listener.x, z: listener.z }, { x: position.x, z: position.z }, doors);
      remote.gain.gain.setTargetAtTime(fade * (blocked ? 0.55 : 1) * this.extraGain, now, 0.08);
      remote.filter.frequency.setTargetAtTime(blocked ? MUFFLED_CUTOFF : CLEAR_CUTOFF, now, 0.1);
      this.setPannerPosition(remote.panner, position);
      remote.analyser.getByteTimeDomainData(remote.data as Uint8Array<ArrayBuffer>);
      remote.level = rms(remote.data);
    }
  }

  /** Snapshot of live spatial values, used by diagnostics and tests. */
  debug() {
    return [...this.remotes.values()].map((remote) => ({
      id: remote.id,
      gain: remote.gain.gain.value,
      cutoff: remote.filter.frequency.value,
      level: remote.level,
    }));
  }

  isSpeaking(playerId: string) {
    const remote = this.remotes.get(playerId);
    return Boolean(remote && remote.level > 0.035);
  }

  get localSpeaking() { return !this.muted && this.micEnabled && this.micLevel > 0.05; }

  stop() {
    this.stopped = true;
    for (const remote of [...this.remotes.values()]) this.drop(remote);
    this.localStream?.getTracks().forEach((track) => track.stop());
    this.localStream = null;
    try { this.peer?.destroy(); } catch {}
    this.peer = null;
    void this.ctx?.close();
    this.ctx = null;
  }

  private bind(call: MediaConnection) {
    const id = call.peer.replace(/^snallyv-/, "");
    const existing = this.remotes.get(id);
    if (existing) this.drop(existing);
    call.on("stream", (stream) => this.attach(id, call, stream));
    call.on("close", () => { const remote = this.remotes.get(id); if (remote?.call === call) this.drop(remote); });
    call.on("error", () => { const remote = this.remotes.get(id); if (remote?.call === call) this.drop(remote); });
  }

  private attach(id: string, call: MediaConnection, stream: MediaStream) {
    const ctx = this.ctx;
    if (!ctx || this.remotes.get(id)?.call === call && this.remotes.get(id)?.element.srcObject === stream) return;
    // Chrome only pulls remote WebRTC audio into Web Audio if it is also attached to a media element.
    const element = new Audio();
    element.srcObject = stream;
    element.muted = true;
    void element.play().catch(() => {});

    const source = ctx.createMediaStreamSource(stream);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = CLEAR_CUTOFF;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const panner = ctx.createPanner();
    panner.panningModel = "HRTF";
    panner.distanceModel = "inverse";
    panner.refDistance = FULL_VOLUME_RANGE;
    panner.rolloffFactor = 0.6;
    panner.maxDistance = VOICE_RANGE;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;

    source.connect(analyser);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(panner);
    panner.connect(ctx.destination);

    this.remotes.set(id, {
      id, call, element, gain, filter, panner, analyser,
      data: new Uint8Array(analyser.fftSize),
      nodes: [source, filter, gain, panner, analyser],
      level: 0,
    });
  }

  private drop(remote: Remote) {
    this.remotes.delete(remote.id);
    for (const node of remote.nodes) { try { node.disconnect(); } catch {} }
    try { remote.call.close(); } catch {}
    remote.element.srcObject = null;
  }

  private measureLocal() {
    if (!this.localAnalyser || !this.localData) { this.micLevel = 0; return; }
    this.localAnalyser.getByteTimeDomainData(this.localData as Uint8Array<ArrayBuffer>);
    this.micLevel = rms(this.localData);
  }

  private silentStream() {
    const destination = this.ctx!.createMediaStreamDestination();
    return destination.stream;
  }

  private setListener(listener: AudioListener, position: VoicePosition, forward: VoicePosition) {
    if (listener.positionX) {
      listener.positionX.value = position.x; listener.positionY.value = position.y; listener.positionZ.value = position.z;
      listener.forwardX.value = forward.x; listener.forwardY.value = forward.y; listener.forwardZ.value = forward.z;
      listener.upX.value = 0; listener.upY.value = 1; listener.upZ.value = 0;
    } else {
      listener.setPosition(position.x, position.y, position.z);
      listener.setOrientation(forward.x, forward.y, forward.z, 0, 1, 0);
    }
  }

  private setPannerPosition(panner: PannerNode, position: VoicePosition) {
    if (panner.positionX) {
      panner.positionX.value = position.x; panner.positionY.value = position.y; panner.positionZ.value = position.z;
    } else {
      panner.setPosition(position.x, position.y, position.z);
    }
  }

  private setStatus(state: VoiceStatus["state"], message: string) {
    this._status = { state, message, muted: this.muted };
    this.statusListener?.(this._status);
  }
}

export type VoiceStatus = {
  state: "idle" | "connecting" | "live" | "listen-only" | "error";
  message: string;
  muted: boolean;
};

function rms(data: Uint8Array) {
  let sum = 0;
  for (let i = 0; i < data.length; i += 1) {
    const v = (data[i] - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / data.length);
}

import "./style.css";
import "./lobby.css";
import type { SharedRoundState } from "../shared/protocol";
import type { Game } from "./game/Game";
import { MultiplayerClient, type RoomInfo } from "./networking/Multiplayer";
import { ProximityVoice, type VoiceStatus } from "./voice/ProximityVoice";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Missing #app root");

app.innerHTML = `
  <main class="shell">
    <section id="menu" class="menu-card" aria-label="Camp Snallygaster main menu">
      <div class="eyebrow">EMERGENCY EVACUATION • SUMMER 1993</div>
      <h1>CAMP<br/>SNALLYGASTER</h1>
      <p class="lede">Find the campers. Keep the group together. Get everyone back to the bus before the woods wake up.</p>
      <label class="field-label" for="playerName">COUNSELOR NAME</label>
      <input id="playerName" class="field" maxlength="18" value="Counselor" autocomplete="nickname" />
      <button id="playSolo" class="primary">ENTER CAMP SOLO</button>
      <div class="network-row"><button id="createCamp">CREATE CAMP</button><button id="showJoin">JOIN CAMP</button></div>
      <div id="joinRow" class="join-row hidden"><input id="roomCode" class="field" maxlength="8" placeholder="PINE214" autocapitalize="characters" /><button id="joinCamp">JOIN</button></div>
      <p id="status" class="status">Ready. Multiplayer camps support up to 15 counselors.</p>
    </section>

    <section id="lobby" class="menu-card lobby-card hidden" aria-label="Camp lobby">
      <div class="eyebrow">CAMP RADIO CHANNEL</div>
      <div class="lobby-heading-row">
        <h2 id="roomTitle">CAMP ----</h2>
        <div id="lobbyCount" class="lobby-count">0 / 15</div>
      </div>
      <div id="roster" class="roster lobby-roster"></div>
      <div class="voice-panel">
        <div class="voice-row">
          <span id="voiceDot" class="voice-dot"></span>
          <span id="voiceStatus" class="voice-status">Mic off</span>
        </div>
        <div class="voice-meter"><div id="voiceMeter" class="voice-meter-fill"></div></div>
        <div class="voice-buttons">
          <button id="enableMic" type="button">ENABLE MIC</button>
          <button id="muteMic" type="button">MUTE (M)</button>
        </div>
        <p class="voice-hint">Proximity voice: nearby counselors are loud, far ones fade, walls and closed doors muffle.</p>
      </div>
      <button id="startCamp" class="primary hidden">START EVACUATION</button>
      <p id="lobbyStatus" class="status">Waiting for counselors…</p>
    </section>

    <section id="gameViewport" class="game-viewport hidden" aria-label="Game viewport"></section>
    <button id="gameMenuToggle" class="exit hidden" type="button" aria-label="Open game menu">☰ MENU</button>

    <section id="pauseMenu" class="pause-overlay hidden" aria-label="Game menu">
      <div class="pause-card">
        <div class="eyebrow">CAMP COUNSELOR MENU</div>
        <h2>PAUSED</h2>
        <button id="resumeGame" class="primary">RETURN TO CAMP</button>
        <button id="toggleBindings">KEY BINDINGS</button>
        <div id="bindingsPanel" class="bindings-panel hidden">
          <div><kbd>W A S D</kbd><span>Move</span></div>
          <div><kbd>SHIFT</kbd><span>Hold to sprint</span></div>
          <div><kbd>CTRL</kbd><span>Crouch</span></div>
          <div><kbd>SPACE</kbd><span>Jump</span></div>
          <div><kbd>E</kbd><span>Interact / pick up / open</span></div>
          <div><kbd>LMB</kbd><span>Use held item</span></div>
          <div><kbd>G</kbd><span>Drop held item</span></div>
          <div><kbd>RMB</kbd><span>Scan</span></div>
          <div><kbd>F</kbd><span>Flashlight</span></div>
          <div><kbd>ESC</kbd><span>Open / close this menu</span></div>
          <p>Touch devices use the left movement stick, right look area, and on-screen action controls.</p>
        </div>
        <button id="returnMain" class="danger-action">RETURN TO MAIN MENU</button>
      </div>
    </section>
  </main>
`;

const menu = document.querySelector<HTMLElement>("#menu")!;
const lobby = document.querySelector<HTMLElement>("#lobby")!;
const viewport = document.querySelector<HTMLDivElement>("#gameViewport")!;
const status = document.querySelector<HTMLElement>("#status")!;
const lobbyStatus = document.querySelector<HTMLElement>("#lobbyStatus")!;
const playButton = document.querySelector<HTMLButtonElement>("#playSolo")!;
const createButton = document.querySelector<HTMLButtonElement>("#createCamp")!;
const showJoinButton = document.querySelector<HTMLButtonElement>("#showJoin")!;
const joinButton = document.querySelector<HTMLButtonElement>("#joinCamp")!;
const joinRow = document.querySelector<HTMLElement>("#joinRow")!;
const nameInput = document.querySelector<HTMLInputElement>("#playerName")!;
const codeInput = document.querySelector<HTMLInputElement>("#roomCode")!;
const startButton = document.querySelector<HTMLButtonElement>("#startCamp")!;
const roomTitle = document.querySelector<HTMLElement>("#roomTitle")!;
const lobbyCount = document.querySelector<HTMLElement>("#lobbyCount")!;
const roster = document.querySelector<HTMLElement>("#roster")!;
const voiceStatusEl = document.querySelector<HTMLElement>("#voiceStatus")!;
const voiceDot = document.querySelector<HTMLElement>("#voiceDot")!;
const voiceMeter = document.querySelector<HTMLElement>("#voiceMeter")!;
const enableMicButton = document.querySelector<HTMLButtonElement>("#enableMic")!;
const muteMicButton = document.querySelector<HTMLButtonElement>("#muteMic")!;
const gameMenuToggle = document.querySelector<HTMLButtonElement>("#gameMenuToggle")!;
const pauseMenu = document.querySelector<HTMLElement>("#pauseMenu")!;
const resumeButton = document.querySelector<HTMLButtonElement>("#resumeGame")!;
const toggleBindingsButton = document.querySelector<HTMLButtonElement>("#toggleBindings")!;
const bindingsPanel = document.querySelector<HTMLElement>("#bindingsPanel")!;
const returnMainButton = document.querySelector<HTMLButtonElement>("#returnMain")!;

let game: Game | null = null;
let starting = false;
let multiplayer: MultiplayerClient | null = null;
let room: RoomInfo | null = null;
let latestRound: SharedRoundState | null = null;
let paused = false;
const voice = new ProximityVoice();
voice.onStatus(renderVoiceStatus);
let voiceSession = false;
if (new URLSearchParams(location.search).has("debug")) (window as unknown as { __snally: unknown }).__snally = { voice };

function playerName() {
  return nameInput.value.trim().slice(0, 18) || "Counselor";
}

async function launchGame(networked: boolean) {
  if (game || starting) return;
  starting = true;
  status.classList.remove("error");
  lobbyStatus.textContent = "Loading camp…";

  try {
    const { Game } = await import("./game/Game");
    game = new Game(viewport, networked);
    await game.start();

    if (networked && room && multiplayer) {
      const localPlayer = room.players.find((player) => player.id === room?.playerId);
      if (localPlayer) game.setLocalPose(localPlayer.pose);
      game.setRemotePlayers(room.players, room.playerId);
      game.onPose((pose) => multiplayer?.sendPose(pose));
      game.onInteract((targetId) => multiplayer?.interact(targetId));
      game.setVoice(voice);
      if (latestRound) game.setSharedRoundState(latestRound);
    }

    menu.classList.add("hidden");
    lobby.classList.add("hidden");
    viewport.classList.remove("hidden");
    renderVoiceStatus(voice.status);
    gameMenuToggle.classList.remove("hidden");
    paused = false;
    pauseMenu.classList.add("hidden");
    game.resume();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    status.textContent = `Startup failed: ${message}`;
    lobbyStatus.textContent = `Startup failed: ${message}`;
    status.classList.add("error");
    game?.destroy();
    game = null;
    menu.classList.remove("hidden");
  } finally {
    starting = false;
  }
}

function ensureMultiplayer() {
  if (multiplayer) return multiplayer;

  multiplayer = new MultiplayerClient();
  multiplayer.onRoster((nextRoom) => {
    room = nextRoom;
    beginVoice(nextRoom);
    voice.syncRoster(nextRoom.players.map((player) => player.id));
    renderLobby(nextRoom);
    game?.setRemotePlayers(nextRoom.players, nextRoom.playerId);
  });
  multiplayer.onSnapshot((players) => game?.setRemotePlayers(players, room?.playerId ?? null));
  multiplayer.onRound((state) => {
    latestRound = state;
    game?.setSharedRoundState(state);
  });
  multiplayer.onStart(() => void launchGame(true));
  multiplayer.onError((message) => {
    status.textContent = message;
    lobbyStatus.textContent = message;
  });
  return multiplayer;
}

function beginVoice(info: RoomInfo) {
  if (voiceSession) return;
  voiceSession = true;
  void voice.start(info.playerId);
}

function renderVoiceStatus(status: VoiceStatus) {
  voiceStatusEl.textContent = status.message;
  voiceDot.dataset.state = status.state;
  muteMicButton.textContent = status.muted ? "UNMUTE (M)" : "MUTE (M)";
  enableMicButton.classList.toggle("hidden", status.state === "live" || status.state === "connecting");
  const hud = document.querySelector<HTMLElement>("#micHud");
  if (hud) {
    hud.onclick = () => voice.toggleMute();
    hud.textContent = status.state === "live" ? (status.muted ? "🎙 MUTED (M)" : "🎙 LIVE (M)") : status.state === "listen-only" ? "🎙 NO MIC" : "🎙 …";
    hud.dataset.state = status.muted ? "muted" : status.state;
  }
}

function pumpVoiceMeter() {
  const level = voice.localLevel;
  voiceMeter.style.width = `${Math.min(100, Math.round(level * 400))}%`;
  voiceDot.classList.toggle("speaking", voice.localSpeaking);
  requestAnimationFrame(pumpVoiceMeter);
}
requestAnimationFrame(pumpVoiceMeter);

async function createCamp() {
  voice.prepare();
  setBusy(true, "Opening camp…");
  status.classList.remove("error");
  try {
    room = await ensureMultiplayer().createCamp(playerName());
    showLobby(room);
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "Failed to create camp";
    status.classList.add("error");
  } finally {
    setBusy(false);
  }
}

async function joinCamp() {
  voice.prepare();
  const code = codeInput.value.trim().toUpperCase();
  if (!code) return;
  setBusy(true, "Joining camp…");
  status.classList.remove("error");
  try {
    room = await ensureMultiplayer().joinCamp(code, playerName());
    showLobby(room);
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "Failed to join camp";
    status.classList.add("error");
  } finally {
    setBusy(false);
  }
}

function showLobby(info: RoomInfo) {
  menu.classList.add("hidden");
  lobby.classList.remove("hidden");
  renderLobby(info);
}

function renderLobby(info: RoomInfo) {
  roomTitle.textContent = `CAMP ${info.roomCode}`;
  lobbyCount.textContent = `${info.players.length} / ${info.maxPlayers}`;
  lobbyCount.classList.toggle("full", info.players.length >= info.maxPlayers);
  roster.replaceChildren(...info.players.map((player, index) => {
    const item = document.createElement("div");
    item.className = "roster-item lobby-player";
    const slot = document.createElement("span");
    slot.className = "lobby-player-slot";
    slot.textContent = String(index + 1).padStart(2, "0");
    const name = document.createElement("span");
    name.className = "lobby-player-name";
    name.textContent = player.name;
    const role = document.createElement("span");
    role.className = "lobby-player-role";
    role.textContent = player.id === info.hostId ? "HOST" : "COUNSELOR";
    item.append(slot, name, role);
    return item;
  }));

  const isHost = info.playerId === info.hostId;
  startButton.classList.toggle("hidden", !isHost);
  lobbyStatus.textContent = isHost
    ? `${info.players.length} of ${info.maxPlayers} counselors connected. Share ${info.roomCode} and start when ready.`
    : `${info.players.length} of ${info.maxPlayers} counselors connected. Waiting for the host.`;
}

function setBusy(busy: boolean, message = "") {
  createButton.disabled = busy;
  joinButton.disabled = busy;
  showJoinButton.disabled = busy;
  if (message) status.textContent = message;
}

function setPaused(next: boolean) {
  if (!game) return;
  paused = next;
  pauseMenu.classList.toggle("hidden", !paused);
  if (paused) {
    game.pause();
    document.exitPointerLock?.();
  } else {
    bindingsPanel.classList.add("hidden");
    game.resume();
  }
}

function exitToMenu() {
  voice.stop();
  voiceSession = false;
  paused = false;
  pauseMenu.classList.add("hidden");
  bindingsPanel.classList.add("hidden");
  game?.destroy();
  game = null;
  multiplayer?.close();
  multiplayer = null;
  room = null;
  latestRound = null;
  viewport.replaceChildren();
  viewport.classList.add("hidden");
  gameMenuToggle.classList.add("hidden");
  lobby.classList.add("hidden");
  menu.classList.remove("hidden");
  status.classList.remove("error");
  status.textContent = "Ready. Multiplayer camps support up to 15 counselors.";
}

playButton.addEventListener("click", () => void launchGame(false));
createButton.addEventListener("click", () => void createCamp());
showJoinButton.addEventListener("click", () => joinRow.classList.toggle("hidden"));
joinButton.addEventListener("click", () => void joinCamp());
startButton.addEventListener("click", () => multiplayer?.startCamp());
gameMenuToggle.addEventListener("click", () => setPaused(true));
resumeButton.addEventListener("click", () => setPaused(false));
toggleBindingsButton.addEventListener("click", () => bindingsPanel.classList.toggle("hidden"));
returnMainButton.addEventListener("click", exitToMenu);
codeInput.addEventListener("input", () => { codeInput.value = codeInput.value.toUpperCase(); });
enableMicButton.addEventListener("click", () => { voice.prepare(); if (room) { voiceSession = false; beginVoice(room); } });
muteMicButton.addEventListener("click", () => voice.toggleMute());
window.addEventListener("keydown", (event) => {
  if (event.code === "KeyM" && !event.repeat && (game || !lobby.classList.contains("hidden"))) {
    const target = event.target as HTMLElement | null;
    if (target?.tagName !== "INPUT") voice.toggleMute();
  }
});
window.addEventListener("keydown", (event) => {
  if (event.code !== "Escape" || !game) return;
  event.preventDefault();
  setPaused(!paused);
});
window.addEventListener("error", (event) => console.error("Unhandled browser error", event.error ?? event.message));
window.addEventListener("unhandledrejection", (event) => console.error("Unhandled promise rejection", event.reason));

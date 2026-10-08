import * as THREE from "three";
import * as CANNON from "cannon-es";
import type { PlayerPose, PlayerState, SharedRoundState } from "../../shared/protocol";
import { InputManager } from "./Input";
import { ObjectiveSystem } from "./ObjectiveSystem";
import { PhysicalProps } from "./PhysicalProps";
import { CampWorld } from "./World";

export class Game {
  private renderer!: THREE.WebGLRenderer;
  private camera!: THREE.PerspectiveCamera;
  private physics!: CANNON.World;
  private player!: CANNON.Body;
  private input!: InputManager;
  private world!: CampWorld;
  private objectives!: ObjectiveSystem;
  private props!: PhysicalProps;
  private flashlight!: THREE.SpotLight;
  private flashlightTarget!: THREE.Object3D;
  private flashlightOn = false;
  private frameId = 0;
  private running = false;
  private roundEnded = false;
  private lastTime = 0;
  private yaw = Math.PI;
  private pitch = -0.08;
  private lastPoseEmit = 0;
  private poseListener: ((pose: PlayerPose) => void) | null = null;
  private interactListener: ((targetId?: string) => void) | null = null;
  private sharedRound: SharedRoundState | null = null;
  private remotePlayers = new Map<string, THREE.Group>();
  private respawnPose: PlayerPose = { x: 0, y: 1.4, z: 27, yaw: Math.PI };
  private interactionRay = new THREE.Raycaster();
  private interactionTargetId: string | null = null;
  private interactionPrompt = "";
  private readonly mobile = matchMedia("(pointer: coarse)").matches || /iPad|iPhone|iPod|Android/i.test(navigator.userAgent);
  private readonly resizeHandler = () => this.resize();
  private readonly visibilityHandler = () => {
    if (document.visibilityState === "visible") this.resume();
    else this.pause();
  };

  constructor(private mount: HTMLDivElement, private networked = false) {}

  async start() {
    if (!this.supportsWebGL()) throw new Error("This browser does not expose WebGL.");

    this.physics = new CANNON.World({ gravity: new CANNON.Vec3(0, -18, 0) });
    this.physics.allowSleep = true;
    this.physics.broadphase = new CANNON.SAPBroadphase(this.physics);
    (this.physics.solver as CANNON.GSSolver).iterations = this.mobile ? 8 : 10;
    this.physics.defaultContactMaterial.friction = 0.28;
    this.physics.defaultContactMaterial.restitution = 0;

    this.world = new CampWorld(this.physics, this.mobile);
    this.objectives = new ObjectiveSystem(this.world.scene, this.mobile);
    this.props = new PhysicalProps(this.world.scene, this.physics, this.mobile);
    this.camera = new THREE.PerspectiveCamera(72, 1, 0.08, 180);
    this.camera.rotation.order = "YXZ";

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.mobile,
      powerPreference: this.mobile ? "default" : "high-performance",
      alpha: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = !this.mobile;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, this.mobile ? 1.25 : 1.75));
    this.mount.appendChild(this.renderer.domElement);

    const hud = document.createElement("div");
    hud.className = "hud";
    hud.innerHTML = `
      <div class="hud-card mission-card">
        <div class="hud-kicker">CAMP SNALLYGASTER • 1993</div>
        <div id="objectiveText" class="hud-objective">CAMPERS SAFE 0 / 7</div>
        <div id="threatText" class="hud-threat">THE WOODS ARE QUIET</div>
      </div>
      <div class="control-help">WASD MOVE · SHIFT RUN · C/CTRL CROUCH · E / CLICK USE · F LIGHT</div>
      <div id="promptText" class="game-prompt"></div>
      <div class="crosshair"></div>
      <div id="roundEnd" class="round-end hidden"><div><h2 id="roundEndTitle">EVACUATION COMPLETE</h2><p id="roundEndText"></p></div></div>
    `;
    this.mount.appendChild(hud);

    this.input = new InputManager(this.renderer.domElement);
    this.createPlayer();
    this.createFlashlight();
    this.resize();

    addEventListener("resize", this.resizeHandler, { passive: true });
    document.addEventListener("visibilitychange", this.visibilityHandler);
    this.renderer.domElement.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      this.pause();
    });
    this.renderer.domElement.addEventListener("webglcontextrestored", () => this.resume());
  }

  resume() {
    if (this.running || document.visibilityState !== "visible") return;
    this.running = true;
    this.lastTime = performance.now();
    this.frameId = requestAnimationFrame((time) => this.loop(time));
  }

  pause() {
    if (!this.running) return;
    this.running = false;
    cancelAnimationFrame(this.frameId);
  }

  onPose(callback: (pose: PlayerPose) => void) { this.poseListener = callback; }
  onInteract(callback: (targetId?: string) => void) { this.interactListener = callback; }

  setSharedRoundState(state: SharedRoundState) {
    this.sharedRound = state;
    this.world?.updateDoors(state.doors);
  }

  setLocalPose(pose: PlayerPose) {
    if (!this.player) return;
    const safePose = {
      x: Number.isFinite(pose.x) ? pose.x : 0,
      y: Number.isFinite(pose.y) ? pose.y : 1.4,
      z: Number.isFinite(pose.z) ? pose.z : 27,
      yaw: Number.isFinite(pose.yaw) ? pose.yaw : Math.PI,
    };
    this.respawnPose = safePose;
    this.player.position.set(safePose.x, safePose.y, safePose.z);
    this.player.velocity.setZero();
    this.player.angularVelocity.setZero();
    this.yaw = safePose.yaw;
  }

  setRemotePlayers(players: PlayerState[], localPlayerId: string | null) {
    const seen = new Set<string>();
    for (const player of players) {
      if (player.id === localPlayerId) continue;
      seen.add(player.id);
      let avatar = this.remotePlayers.get(player.id);
      const target = new THREE.Vector3(player.pose.x, player.pose.y - 0.15, player.pose.z);
      if (!avatar) {
        avatar = this.createRemoteAvatar(player.name);
        avatar.position.copy(target);
        this.remotePlayers.set(player.id, avatar);
        this.world.scene.add(avatar);
      } else {
        avatar.position.lerp(target, 0.45);
      }
      avatar.rotation.y = player.pose.yaw;
    }
    for (const [id, avatar] of this.remotePlayers) {
      if (!seen.has(id)) {
        avatar.removeFromParent();
        this.remotePlayers.delete(id);
      }
    }
  }

  destroy() {
    this.pause();
    removeEventListener("resize", this.resizeHandler);
    document.removeEventListener("visibilitychange", this.visibilityHandler);
    this.input?.destroy();
    this.objectives?.destroy();
    this.renderer?.dispose();
    this.remotePlayers.clear();
    document.exitPointerLock?.();
  }

  private createPlayer() {
    const playerMaterial = new CANNON.Material("player");
    this.player = new CANNON.Body({
      mass: 70,
      shape: new CANNON.Sphere(0.5),
      material: playerMaterial,
      linearDamping: 0.78,
      angularDamping: 1,
      fixedRotation: true,
    });
    this.player.position.set(this.respawnPose.x, this.respawnPose.y, this.respawnPose.z);
    this.player.allowSleep = false;
    this.physics.addBody(this.player);
  }

  private createFlashlight() {
    this.flashlight = new THREE.SpotLight(0xfff0c7, this.mobile ? 12 : 18, 34, Math.PI / 7.5, 0.42, 1.3);
    this.flashlight.visible = false;
    this.flashlight.castShadow = !this.mobile;
    this.flashlightTarget = new THREE.Object3D();
    this.world.scene.add(this.flashlight, this.flashlightTarget);
    this.flashlight.target = this.flashlightTarget;
  }

  private createRemoteAvatar(name: string) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.42, 1, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0xd96f47, roughness: 0.82 }),
    );
    body.position.y = 0.9;
    const hat = new THREE.Mesh(
      new THREE.CylinderGeometry(0.48, 0.48, 0.12, 12),
      new THREE.MeshStandardMaterial({ color: 0xe4bc55, roughness: 0.9 }),
    );
    hat.position.y = 1.78;
    group.name = name;
    group.add(body, hat);
    group.scale.setScalar(0.5);
    return group;
  }

  private loop(now: number) {
    if (!this.running) return;
    const dt = Math.min(Math.max((now - this.lastTime) / 1000, 1 / 240), 0.05);
    this.lastTime = now;

    const input = this.input.sample();
    const lookScale = this.mobile ? 0.0026 : 0.0019;
    this.yaw -= input.lookX * lookScale;
    this.pitch = THREE.MathUtils.clamp(this.pitch - input.lookY * lookScale, -1.15, 1.05);

    const moving = Math.abs(input.forward) > 0.08 || Math.abs(input.right) > 0.08;
    const sprinting = input.sprint && moving;
    const speed = input.crouch ? 3.4 : sprinting ? 9.4 : 6.2;
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const vx = (input.right * cos - input.forward * sin) * speed;
    const vz = (-input.right * sin - input.forward * cos) * speed;
    const responsiveness = Math.min(1, dt * (input.crouch ? 14 : 18));
    this.player.velocity.x += (vx - this.player.velocity.x) * responsiveness;
    this.player.velocity.z += (vz - this.player.velocity.z) * responsiveness;

    if (input.flashlightPressed) this.flashlightOn = !this.flashlightOn;

    const p = this.player.position;
    const eyeHeight = input.crouch ? 1.0 : 1.62;
    this.camera.position.set(p.x, p.y + eyeHeight, p.z);
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    this.props.update(this.camera, dt);
    this.physics.step(1 / 60, dt, 3);

    if (p.y < -10) {
      this.player.position.set(this.respawnPose.x, this.respawnPose.y, this.respawnPose.z);
      this.player.velocity.setZero();
    }

    this.camera.position.set(p.x, p.y + eyeHeight, p.z);
    this.updateFlashlight();
    this.updateInteraction();

    let usedWorldInteraction = false;
    if (input.interactPressed && this.interactionTargetId) {
      if (this.props.isProp(this.interactionTargetId)) {
        usedWorldInteraction = this.props.toggleHold(this.interactionTargetId);
      } else {
        usedWorldInteraction = true;
        if (this.networked) this.interactListener?.(this.interactionTargetId);
        else this.world.toggleLocalDoor(this.interactionTargetId);
      }
    } else if (this.networked && input.interactPressed) {
      this.interactListener?.();
    }

    const playerPosition = new THREE.Vector3(p.x, p.y, p.z);
    const objective = this.networked
      ? this.objectives.updateShared(playerPosition, this.sharedRound)
      : this.objectives.updateLocal(playerPosition, input.interactPressed && !usedWorldInteraction, dt);
    const prompt = this.interactionPrompt || objective.prompt;
    this.updateHud(objective.safe, objective.total, prompt, objective.monsterAwake);

    if (!this.roundEnded && (objective.complete || objective.caught)) {
      this.roundEnded = true;
      this.showRoundEnd(objective.complete);
    }

    if (this.poseListener && now - this.lastPoseEmit >= 80) {
      this.lastPoseEmit = now;
      this.poseListener({ x: p.x, y: p.y, z: p.z, yaw: this.yaw });
    }

    this.renderer.render(this.world.scene, this.camera);
    this.frameId = requestAnimationFrame((time) => this.loop(time));
  }

  private updateInteraction() {
    this.interactionTargetId = null;
    this.interactionPrompt = "";
    const candidates = [...this.world.interactables, ...this.props.interactables];
    if (candidates.length === 0) return;

    this.interactionRay.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const hit = this.interactionRay
      .intersectObjects(candidates, true)
      .find((candidate) => candidate.distance <= 3.25 && candidate.object.userData.targetId);

    if (!hit) return;
    this.interactionTargetId = String(hit.object.userData.targetId);
    const prompt = this.props.isProp(this.interactionTargetId)
      ? this.props.promptFor(this.interactionTargetId)
      : String(hit.object.userData.prompt || "INTERACT");
    this.interactionPrompt = `E / CLICK · ${prompt}`;
  }

  private updateFlashlight() {
    this.flashlight.visible = this.flashlightOn;
    this.flashlight.position.copy(this.camera.position);
    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);
    this.flashlightTarget.position.copy(this.camera.position).add(direction.multiplyScalar(8));
  }

  private updateHud(safe: number, total: number, prompt: string, monsterAwake: boolean) {
    const objective = this.mount.querySelector<HTMLElement>("#objectiveText");
    const promptElement = this.mount.querySelector<HTMLElement>("#promptText");
    const threat = this.mount.querySelector<HTMLElement>("#threatText");
    if (objective) objective.textContent = `CAMPERS SAFE ${safe} / ${total}`;
    if (promptElement) promptElement.textContent = prompt;
    if (threat) threat.textContent = monsterAwake ? "SOMETHING IS MOVING IN THE TREES" : "THE WOODS ARE QUIET";
  }

  private showRoundEnd(won: boolean) {
    const overlay = this.mount.querySelector<HTMLElement>("#roundEnd");
    const title = this.mount.querySelector<HTMLElement>("#roundEndTitle");
    const text = this.mount.querySelector<HTMLElement>("#roundEndText");
    if (!overlay || !title || !text) return;
    title.textContent = won ? "EVACUATION COMPLETE" : "THE WOODS FOUND YOU";
    text.textContent = won ? "Seven campers accounted for. The bus can leave." : "Stay together. Search faster. Try again from the menu.";
    overlay.classList.remove("hidden");
  }

  private resize() {
    if (!this.renderer || !this.camera) return;
    const width = Math.max(1, this.mount.clientWidth || innerWidth);
    const height = Math.max(1, this.mount.clientHeight || innerHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, this.mobile ? 1.25 : 1.75));
  }

  private supportsWebGL() {
    try {
      const canvas = document.createElement("canvas");
      return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
    } catch {
      return false;
    }
  }
}

import * as THREE from "three";
import * as CANNON from "cannon-es";
import type { PlayerPose, PlayerState } from "../../shared/protocol";
import { InputManager } from "./Input";
import { ObjectiveSystem } from "./ObjectiveSystem";
import { CampWorld } from "./World";

export class Game {
  private renderer!: THREE.WebGLRenderer;
  private camera!: THREE.PerspectiveCamera;
  private physics!: CANNON.World;
  private player!: CANNON.Body;
  private input!: InputManager;
  private world!: CampWorld;
  private objectives!: ObjectiveSystem;
  private flashlight!: THREE.SpotLight;
  private flashlightTarget!: THREE.Object3D;
  private flashlightOn = false;
  private battery = 1;
  private stamina = 1;
  private frameId = 0;
  private running = false;
  private roundEnded = false;
  private lastTime = 0;
  private yaw = Math.PI;
  private pitch = -0.08;
  private lastPoseEmit = 0;
  private poseListener: ((pose: PlayerPose) => void) | null = null;
  private remotePlayers = new Map<string, THREE.Group>();
  private readonly mobile = matchMedia("(pointer: coarse)").matches || /iPad|iPhone|iPod|Android/i.test(navigator.userAgent);
  private readonly resizeHandler = () => this.resize();

  constructor(private mount: HTMLDivElement) {}

  async start() {
    if (!this.supportsWebGL()) throw new Error("This browser does not expose WebGL.");

    this.physics = new CANNON.World({ gravity: new CANNON.Vec3(0, -18, 0) });
    this.physics.allowSleep = true;
    this.physics.broadphase = new CANNON.SAPBroadphase(this.physics);

    this.world = new CampWorld(this.physics, this.mobile);
    this.objectives = new ObjectiveSystem(this.world.scene, this.mobile);
    this.camera = new THREE.PerspectiveCamera(72, 1, 0.08, 180);
    this.camera.rotation.order = "YXZ";

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.mobile,
      powerPreference: this.mobile ? "default" : "high-performance",
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = !this.mobile;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.mobile ? 1.25 : 1.75));
    this.mount.appendChild(this.renderer.domElement);

    const hud = document.createElement("div");
    hud.className = "hud";
    hud.innerHTML = `
      <div class="hud-card mission-card">
        <div class="hud-kicker">CAMP SNALLYGASTER • 1993</div>
        <div id="objectiveText" class="hud-objective">CAMPERS SAFE 0 / 7</div>
        <div id="threatText" class="hud-threat">THE WOODS ARE QUIET</div>
      </div>
      <div id="promptText" class="game-prompt"></div>
      <div class="meters">
        <div><span>STAMINA</span><div class="meter"><i id="staminaFill"></i></div></div>
        <div><span>FLASHLIGHT</span><div class="meter"><i id="batteryFill"></i></div></div>
      </div>
      <div class="crosshair"></div>
      <div id="roundEnd" class="round-end hidden"><div><h2 id="roundEndTitle">EVACUATION COMPLETE</h2><p id="roundEndText"></p></div></div>
    `;
    this.mount.appendChild(hud);

    this.input = new InputManager(this.renderer.domElement);
    this.createPlayer();
    this.createFlashlight();
    this.resize();
    window.addEventListener("resize", this.resizeHandler, { passive: true });

    this.renderer.domElement.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      this.running = false;
    });
    this.renderer.domElement.addEventListener("webglcontextrestored", () => this.resume());
  }

  resume() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.frameId = requestAnimationFrame((time) => this.loop(time));
  }

  onPose(callback: (pose: PlayerPose) => void) {
    this.poseListener = callback;
  }

  setRemotePlayers(players: PlayerState[], localPlayerId: string | null) {
    const seen = new Set<string>();
    for (const player of players) {
      if (player.id === localPlayerId) continue;
      seen.add(player.id);
      let avatar = this.remotePlayers.get(player.id);
      if (!avatar) {
        avatar = this.createRemoteAvatar(player.name);
        this.remotePlayers.set(player.id, avatar);
        this.world.scene.add(avatar);
      }
      avatar.position.lerp(new THREE.Vector3(player.pose.x, player.pose.y - 0.15, player.pose.z), 0.45);
      avatar.rotation.y = player.pose.yaw;
    }

    for (const [id, avatar] of this.remotePlayers) {
      if (seen.has(id)) continue;
      avatar.removeFromParent();
      this.remotePlayers.delete(id);
    }
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.frameId);
    window.removeEventListener("resize", this.resizeHandler);
    this.input?.destroy();
    this.objectives?.destroy();
    this.renderer?.dispose();
    this.remotePlayers.clear();
    document.exitPointerLock?.();
  }

  private createPlayer() {
    this.player = new CANNON.Body({
      mass: 70,
      shape: new CANNON.Sphere(0.48),
      linearDamping: 0.86,
      fixedRotation: true,
    });
    this.player.position.set(0, 1.4, 27);
    this.player.allowSleep = false;
    this.physics.addBody(this.player);
  }

  private createFlashlight() {
    this.flashlight = new THREE.SpotLight(0xfff0c7, this.mobile ? 12 : 18, 30, Math.PI / 7.5, 0.42, 1.3);
    this.flashlight.visible = false;
    this.flashlight.castShadow = !this.mobile;
    this.flashlightTarget = new THREE.Object3D();
    this.world.scene.add(this.flashlight, this.flashlightTarget);
    this.flashlight.target = this.flashlightTarget;
  }

  private createRemoteAvatar(name: string) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.42, 1.0, 4, 8),
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
    const sprinting = input.sprint && moving && this.stamina > 0.04;
    this.stamina = THREE.MathUtils.clamp(this.stamina + (sprinting ? -0.22 : 0.14) * dt, 0, 1);
    const speed = sprinting ? 7.2 : 4.6;
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const vx = (input.right * cos + input.forward * sin) * speed;
    const vz = (-input.right * sin + input.forward * cos) * speed;
    const responsiveness = Math.min(1, dt * 12);
    this.player.velocity.x += (vx - this.player.velocity.x) * responsiveness;
    this.player.velocity.z += (vz - this.player.velocity.z) * responsiveness;

    if (input.flashlightPressed && this.battery > 0.01) this.flashlightOn = !this.flashlightOn;
    if (this.flashlightOn) this.battery = Math.max(0, this.battery - dt * 0.009);
    if (this.battery <= 0) this.flashlightOn = false;

    this.physics.step(1 / 60, dt, 3);

    const p = this.player.position;
    if (p.y < -10) {
      this.player.position.set(0, 1.4, 27);
      this.player.velocity.setZero();
    }

    this.camera.position.set(p.x, p.y + 1.05, p.z);
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    this.updateFlashlight();

    const playerPosition = new THREE.Vector3(p.x, p.y, p.z);
    const objective = this.objectives.update(playerPosition, input.interactPressed, dt);
    this.updateHud(objective.safe, objective.total, objective.prompt, objective.monsterAwake);
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
    const staminaFill = this.mount.querySelector<HTMLElement>("#staminaFill");
    const batteryFill = this.mount.querySelector<HTMLElement>("#batteryFill");
    if (objective) objective.textContent = `CAMPERS SAFE ${safe} / ${total}`;
    if (promptElement) promptElement.textContent = prompt;
    if (threat) threat.textContent = monsterAwake ? "SOMETHING IS MOVING IN THE TREES" : "THE WOODS ARE QUIET";
    if (staminaFill) staminaFill.style.width = `${Math.round(this.stamina * 100)}%`;
    if (batteryFill) batteryFill.style.width = `${Math.round(this.battery * 100)}%`;
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
    const width = Math.max(1, this.mount.clientWidth || window.innerWidth);
    const height = Math.max(1, this.mount.clientHeight || window.innerHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.mobile ? 1.25 : 1.75));
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

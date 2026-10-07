import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import type { GameRoomState, PlayerState, CamperState } from "../../shared/GameRoomState";
import { InputManager } from "./Input";
import { CampWorld } from "./World";
import { NetworkManager } from "../networking/NetworkManager";
import { LobbyUI } from "../ui/LobbyUI";

export class Game {
  private renderer!: THREE.WebGLRenderer;
  private camera!: THREE.PerspectiveCamera;
  private physics!: any;
  private playerBody!: any;
  private playerCollider!: any;
  private controller!: any;
  private world!: CampWorld;
  private input!: InputManager;
  private network!: NetworkManager;
  private lobbyUI!: LobbyUI;
  private localId: string | null = null;
  private latestWorld: GameRoomState | null = null;
  private yaw = Math.PI;
  private pitch = -0.08;
  private velocity = new THREE.Vector3();
  private stamina = 1;
  private battery = 1;
  private flashlightOn = false;
  private flashlight!: THREE.SpotLight;
  private flashlightTarget!: THREE.Object3D;
  private lastFrame = performance.now();
  private lastSend = 0;
  private interactionRay = new THREE.Raycaster();
  private targetId: string | null = null;
  private mapOpen = false;
  private mobile = matchMedia("(pointer: coarse)").matches || /iPad|iPhone|iPod|Android/i.test(navigator.userAgent);

  constructor(private mount: HTMLDivElement) {}

  async start() {
    await RAPIER.init();
    this.physics = new RAPIER.World({ x: 0, y: -18, z: 0 });
    this.world = new CampWorld(this.physics);

    this.camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.08, 180);
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.mobile,
      powerPreference: this.mobile ? "default" : "high-performance",
      alpha: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, this.mobile ? 1.25 : 1.75));
    this.renderer.setSize(innerWidth, innerHeight, false);
    this.renderer.shadowMap.enabled = !this.mobile;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.mount.appendChild(this.renderer.domElement);

    this.renderer.domElement.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      this.showNotice("Graphics context paused. Reopen the tab if the scene does not recover.");
    });

    this.setupPlayerPhysics();
    this.setupFlashlight();
    this.input = new InputManager(this.renderer.domElement);
    this.lobbyUI = new LobbyUI(this.mount);
    this.network = new NetworkManager();

    const connected = await this.network.connect();
    this.showLobby(connected);

    addEventListener("resize", () => this.resize(), { passive: true });
    requestAnimationFrame((t) => this.frame(t));
  }

  private showLobby(networkReady: boolean) {
    this.lobbyUI.show();
    if (!networkReady) this.lobbyUI.setStatus("create", "Game loaded, but the multiplayer server is unavailable.", true);

    this.lobbyUI.setCreateCallback(async (name) => {
      const roomId = await this.network.createRoom(name);
      if (!roomId) return this.lobbyUI.setStatus("create", "Failed to create camp", true);
      this.localId = this.network.getSessionId();
      this.setupGameSession();
      this.lobbyUI.setStatus("create", "Camp created!", false);
      const code = this.network.getRoomCode();
      if (code) this.lobbyUI.setRoomCode(code);
    });

    this.lobbyUI.setJoinCallback(async (code, name) => {
      if (!(await this.network.joinRoom(code, name))) return this.lobbyUI.setStatus("join", "Failed to join camp", true);
      this.localId = this.network.getSessionId();
      this.setupGameSession();
      this.lobbyUI.setStatus("join", "Joined camp!", false);
    });

    this.lobbyUI.setStartCallback(() => this.network.send("START", {}));
  }

  private setupGameSession() {
    this.network.onRoomStateChange((state) => {
      this.latestWorld = state;
      this.handleStateChange(state);
    });
  }

  private handleStateChange(state: GameRoomState) {
    if (state.phase === "LOBBY") {
      const players = Array.from(state.players.values()).map((p: any) => ({ id: p.id, name: p.name }));
      this.lobbyUI.showRoster(players, state.hostId, this.localId || "");
    } else if (state.phase === "ACTIVE") {
      this.lobbyUI.hide();
    }

    this.world.updateRemotePlayers(Array.from(state.players.values()) as PlayerState[], this.localId);
    this.world.updateCampers(Array.from(state.campers) as CamperState[]);
    this.world.updateMonster(state.monster);
    this.world.updateDoors(Array.from(state.doors));
    this.world.updateGun(state.gun.spawned, state.gun.discovered, state.gun.pickedUp, state.gun.position);
    this.world.updateLighting(state.roundElapsed);
    this.updateHUD(state);
  }

  private setupPlayerPhysics() {
    this.playerBody = this.physics.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 1.05, 38.5),
    );
    this.playerCollider = this.physics.createCollider(
      RAPIER.ColliderDesc.capsule(0.72, 0.34).setFriction(0.2),
      this.playerBody,
    );
    this.controller = this.physics.createCharacterController(0.02);
    this.controller.enableAutostep(0.35, 0.25, true);
    this.controller.enableSnapToGround(0.2);
    this.controller.setMaxSlopeClimbAngle((48 * Math.PI) / 180);
    this.controller.setMinSlopeSlideAngle((55 * Math.PI) / 180);
  }

  private setupFlashlight() {
    this.flashlight = new THREE.SpotLight(0xfff3d0, this.mobile ? 14 : 22, 28, Math.PI / 8, 0.38, 1.4);
    this.flashlight.visible = false;
    this.flashlight.castShadow = !this.mobile;
    this.flashlight.shadow.mapSize.set(512, 512);
    this.flashlightTarget = new THREE.Object3D();
    this.world.scene.add(this.flashlight, this.flashlightTarget, this.camera);
    this.flashlight.target = this.flashlightTarget;
  }

  private frame(now: number) {
    const dt = Math.min((now - this.lastFrame) / 1000, 0.05);
    this.lastFrame = now;
    this.input.updateContinuous();
    const one = this.input.consumeOneShots();
    this.yaw += one.yawDelta;
    this.pitch = THREE.MathUtils.clamp(this.pitch + one.pitchDelta, -1.05, 0.85);

    if (this.latestWorld?.phase === "ACTIVE") {
      this.updatePlayer(dt);
      this.updateInteraction();
      this.handleActions(one);
    }

    this.updateCamera();
    this.updateFlashlight(dt);
    this.updateMapMarker();
    this.world.revealNearbyHiddenCampers(Array.from(this.latestWorld?.campers ?? []) as CamperState[], this.camera);
    this.physics.step();
    this.world.updatePhysicsVisuals();
    this.sendMovement(now);
    this.renderer.render(this.world.scene, this.camera);
    requestAnimationFrame((t) => this.frame(t));
  }

  private localPlayer(): PlayerState | null {
    if (!this.latestWorld || !this.localId) return null;
    return (this.latestWorld.players.get(this.localId) as PlayerState | undefined) ?? null;
  }

  private updatePlayer(dt: number) {
    const local = this.localPlayer();
    if (local?.downed) return;
    const input = this.input.state;
    const carrying = !!local?.carryingCamperId;
    const sprint = input.sprint && !input.crouch && this.stamina > 0.05 && !carrying;
    const speed = input.crouch ? 2.2 : carrying ? 2.8 : sprint ? 6.6 : 4.15;

    const moving = Math.abs(input.forward) > 0.1 || Math.abs(input.right) > 0.1;
    this.stamina = THREE.MathUtils.clamp(this.stamina + (sprint && moving ? -0.18 : 0.115) * dt, 0, 1);

    const forward = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const desired = forward.multiplyScalar(input.forward).add(right.multiplyScalar(input.right));
    if (desired.lengthSq() > 1) desired.normalize();
    desired.multiplyScalar(speed);
    this.velocity.lerp(desired, Math.min(1, dt * 9.5));

    this.controller.computeColliderMovement(this.playerCollider, {
      x: this.velocity.x * dt,
      y: -1.2 * dt,
      z: this.velocity.z * dt,
    });
    const correction = this.controller.computedMovement();
    const p = this.playerBody.translation();
    this.playerBody.setNextKinematicTranslation({ x: p.x + correction.x, y: p.y + correction.y, z: p.z + correction.z });
    this.setWidth("#staminaFill", this.stamina);
  }

  private updateCamera() {
    const p = this.playerBody.translation();
    const eye = this.input.state.crouch ? 1.05 : 1.62;
    this.camera.position.set(p.x, p.y + eye, p.z);
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }

  private updateFlashlight(dt: number) {
    if (this.flashlightOn && this.battery > 0) this.battery = Math.max(0, this.battery - dt * 0.0085);
    if (this.battery <= 0) this.flashlightOn = false;
    this.flashlight.visible = this.flashlightOn;
    this.flashlight.position.copy(this.camera.position);
    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);
    this.flashlightTarget.position.copy(this.camera.position).add(direction.multiplyScalar(8));
    this.setWidth("#batteryFill", this.battery);
  }

  private updateInteraction() {
    this.interactionRay.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const hit = this.interactionRay
      .intersectObjects(this.world.interactables, true)
      .find((candidate) => candidate.distance < 3.2 && candidate.object.userData.targetId);
    this.targetId = hit?.object.userData.targetId ?? null;
    const prompt = hit?.object.userData.prompt ?? "";
    this.setText("#prompt", prompt ? `E · ${prompt}` : "");
  }

  private handleActions(one: ReturnType<InputManager["consumeOneShots"]>) {
    if (one.interactPressed && this.targetId) this.network.send("INTERACT", { targetId: this.targetId });
    if (one.dropPressed) this.network.send("DROP_CAMPER", {});
    if (one.flashlightPressed) {
      this.flashlightOn = !this.flashlightOn;
      this.network.send("TOGGLE_FLASHLIGHT", { on: this.flashlightOn });
    }
    if (one.mapPressed) {
      this.mapOpen = !this.mapOpen;
      document.querySelector("#mapOverlay")?.classList.toggle("hidden", !this.mapOpen);
    }
    if (one.radioPressed) this.network.send("RADIO", { kind: "COME HERE" });
    if (one.reloadPressed) this.network.send("RELOAD", {});
    if (one.firePressed && this.localPlayer()?.gunEquipped) this.fire();
  }

  private fire() {
    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);
    this.network.send("FIRE", {
      origin: { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z },
      direction: { x: direction.x, y: direction.y, z: direction.z },
    });
  }

  private sendMovement(now: number) {
    if (!this.localId || now - this.lastSend < 50 || this.latestWorld?.phase !== "ACTIVE") return;
    this.lastSend = now;
    const p = this.playerBody.translation();
    this.network.send("MOVE", {
      position: { x: p.x, y: p.y, z: p.z },
      rotationY: this.yaw,
      crouching: this.input.state.crouch,
      sprinting: this.input.state.sprint && this.stamina > 0.05,
    });
  }

  private updateHUD(world: GameRoomState) {
    this.setText("#camperCount", `${world.campersSafe} / ${world.campersTotal}`);
    const local = this.localPlayer();
    this.setText(
      "#carryStatus",
      local?.carryingCamperId
        ? "CARRYING CAMPER"
        : local?.followingCamperIds?.length
          ? `${local.followingCamperIds.length} CAMPER${local.followingCamperIds.length > 1 ? "S" : ""} FOLLOWING`
          : "",
    );
    const hasGun = !!local?.hasGun;
    document.querySelector("#weaponStatus")?.classList.toggle("hidden", !hasGun);
    document.querySelector("#fireButton")?.classList.toggle("hidden", !hasGun);
    document.querySelector("#reloadButton")?.classList.toggle("hidden", !hasGun);
    document.querySelector("#dropButton")?.classList.toggle("hidden", !local?.carryingCamperId);
    if (hasGun) this.setText("#weaponStatus", `HANDGUN · ${local?.ammo ?? 0}/${local?.reserveAmmo ?? 0}`);
  }

  private updateMapMarker() {
    if (!this.mapOpen) return;
    const p = this.playerBody.translation();
    const marker = document.querySelector<HTMLElement>("#mapPlayer");
    if (!marker) return;
    marker.style.left = `${THREE.MathUtils.clamp((p.x + 50) / 100, 0, 1) * 100}%`;
    marker.style.top = `${(1 - THREE.MathUtils.clamp((p.z + 50) / 100, 0, 1)) * 100}%`;
  }

  private resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight, false);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, this.mobile ? 1.25 : 1.75));
  }

  private setText(selector: string, text: string) {
    const element = document.querySelector<HTMLElement>(selector);
    if (element) element.textContent = text;
  }

  private setWidth(selector: string, value: number) {
    const element = document.querySelector<HTMLElement>(selector);
    if (element) element.style.width = `${Math.round(value * 100)}%`;
  }

  private showNotice(text: string) {
    this.setText("#notice", text);
    document.querySelector("#notice")?.classList.add("visible");
  }
}

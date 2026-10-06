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
  private gunView!: THREE.Group;
  private gunMuzzle!: THREE.PointLight;
  private lastSend = 0;
  private lastFrame = performance.now();
  private interactionRay = new THREE.Raycaster();
  private targetId: string | null = null;
  private targetPrompt = "";
  private mapOpen = false;
  private noticeTimer = 0;

  constructor(private mount: HTMLDivElement) {}

  async start() {
    await RAPIER.init();

    this.physics = new RAPIER.World({
      x: 0,
      y: -18,
      z: 0,
    });

    this.world = new CampWorld(this.physics);

    this.camera = new THREE.PerspectiveCamera(
      72,
      window.innerWidth / window.innerHeight,
      0.08,
      180,
    );

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });

    this.renderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio,
        1.6,
      ),
    );

    this.renderer.setSize(
      window.innerWidth,
      window.innerHeight,
    );

    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.mount.appendChild(
      this.renderer.domElement,
    );

    this.setupPlayerPhysics();
    this.setupViewModel();
    this.setupFlashlight();

    this.input = new InputManager(
      this.renderer.domElement,
    );

    this.lobbyUI = new LobbyUI(this.mount);
    this.network = new NetworkManager("ws://localhost:3001");

    await this.network.connect();
    this.showLobby();

    window.addEventListener(
      "resize",
      () => this.resize(),
    );

    requestAnimationFrame(
      (t) => this.frame(t),
    );
  }

  private async showLobby() {
    this.lobbyUI.show();

    this.lobbyUI.setCreateCallback(async (name: string) => {
      const roomId = await this.network.createRoom(name);
      if (roomId) {
        this.localId = roomId; // Will be overwritten by server
        this.setupGameSession();
        this.lobbyUI.setStatus("create", `Camp created!", false);
      } else {
        this.lobbyUI.setStatus("create", "Failed to create camp", true);
      }
    });

    this.lobbyUI.setJoinCallback(async (roomId: string, name: string) => {
      const success = await this.network.joinRoom(roomId, name);
      if (success) {
        this.localId = roomId; // Will be overwritten by server
        this.setupGameSession();
        this.lobbyUI.setStatus("join", "Joined camp!", false);
      } else {
        this.lobbyUI.setStatus("join", "Failed to join camp", true);
      }
    });

    this.lobbyUI.setStartCallback(() => {
      this.network.send("START", {});
    });
  }

  private setupGameSession() {
    this.network.onRoomStateChange((state: GameRoomState) => {
      this.latestWorld = state;
      this.handleStateChange(state);
    });

    this.network.onRoomMessage((type: string, data: any) => {
      console.log("Room message:", type, data);
    });
  }

  private handleStateChange(state: GameRoomState) {
    if (state.phase === "LOBBY") {
      const players = Array.from(
        Object.values(state.players || {}),
      ).map((p: any) => ({
        id: p.id,
        name: p.name,
      }));

      this.lobbyUI.showRoster(players, state.hostId, this.localId || "");
    } else if (state.phase === "ACTIVE") {
      this.lobbyUI.hide();
    }

    this.world.updateRemotePlayers(
      Array.from(Object.values(state.players || {})) as PlayerState[],
      this.localId,
    );

    this.world.updateCampers(
      state.campers as CamperState[],
    );

    this.world.updateMonster(
      state.monster,
    );

    this.world.updateDoors(
      state.doors,
    );

    this.world.updateGun(
      state.gun.spawned,
      state.gun.discovered,
      state.gun.pickedUp,
      state.gun.position,
    );

    this.world.updateLighting(
      state.roundElapsed,
    );

    this.updateHUDFromWorld(state);
  }

  private setupPlayerPhysics() {
    this.playerBody =
      this.physics.createRigidBody(
        RAPIER.RigidBodyDesc
          .kinematicPositionBased()
          .setTranslation(
            0,
            1.05,
            38.5,
          ),
      );

    this.playerCollider =
      this.physics.createCollider(
        RAPIER.ColliderDesc
          .capsule(
            0.72,
            0.34,
          )
          .setFriction(0.2),
        this.playerBody,
      );

    this.controller =
      this.physics.createCharacterController(
        0.02,
      );

    this.controller.enableAutostep(
      0.35,
      0.25,
      true,
    );

    this.controller.enableSnapToGround(
      0.2,
    );

    this.controller.setMaxSlopeClimbAngle(
      (48 * Math.PI) / 180,
    );

    this.controller.setMinSlopeSlideAngle(
      (55 * Math.PI) / 180,
    );
  }

  private setupFlashlight() {
    this.flashlight =
      new THREE.SpotLight(
        0xfff3d0,
        24,
        28,
        Math.PI / 8,
        0.38,
        1.4,
      );

    this.flashlight.visible = false;
    this.flashlight.castShadow = true;

    this.flashlight.shadow.mapSize.set(
      512,
      512,
    );

    this.flashlightTarget =
      new THREE.Object3D();

    this.world.scene.add(
      this.flashlight,
      this.flashlightTarget,
    );

    this.flashlight.target =
      this.flashlightTarget;
  }

  private setupViewModel() {
    this.gunView =
      new THREE.Group();

    const metal =
      new THREE.MeshStandardMaterial({
        color: 0xc4c2b9,
        metalness: 0.8,
        roughness: 0.28,
      });

    const dark =
      new THREE.MeshStandardMaterial({
        color: 0x261f1b,
        roughness: 0.8,
      });

    const slide =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          0.22,
          0.18,
          0.62,
        ),
        metal,
      );

    const barrel =
      new THREE.Mesh(
        new THREE.CylinderGeometry(
          0.045,
          0.045,
          0.42,
          12,
        ),
        metal,
      );

    barrel.rotation.x = Math.PI / 2;

    barrel.position.set(
      0,
      0.01,
      -0.45,
    );

    const grip =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          0.18,
          0.42,
          0.2,
        ),
        dark,
      );

    grip.position.set(
      0,
      -0.26,
      0.08,
    );

    grip.rotation.x = -0.2;

    this.gunView.add(
      slide,
      barrel,
      grip,
    );

    this.gunView.position.set(
      0.34,
      -0.28,
      -0.72,
    );

    this.gunView.rotation.set(
      -0.06,
      -0.08,
      0,
    );

    this.gunView.visible = false;

    this.camera.add(
      this.gunView,
    );

    this.gunMuzzle =
      new THREE.PointLight(
        0xffb65c,
        0,
        4,
      );

    this.gunMuzzle.position.set(
      0,
      0,
      -0.7,
    );

    this.gunView.add(
      this.gunMuzzle,
    );

    this.world.scene.add(
      this.camera,
    );
  }

  private frame(now: number) {
    const dt = Math.min(
      (now - this.lastFrame) / 1000,
      0.05,
    );

    this.lastFrame = now;

    this.input.updateContinuous();

    const one =
      this.input.consumeOneShots();

    this.yaw +=
      one.yawDelta;

    this.pitch =
      THREE.MathUtils.clamp(
        this.pitch + one.pitchDelta,
        -1.05,
        0.85,
      );

    if (this.latestWorld?.phase === "ACTIVE") {
      this.updatePlayer(dt);
      this.updateInteraction();
      this.handleActions(one);
    }

    this.updateCamera(dt);
    this.updateFlashlight(dt);
    this.updateMapMarker();

    this.world.revealNearbyHiddenCampers(
      this.latestWorld?.campers ?? [],
      this.camera,
    );

    this.physics.step();

    this.world.updatePhysicsVisuals();

    this.sendMovement(now);

    if (this.noticeTimer > 0) {
      this.noticeTimer -= dt;

      if (this.noticeTimer <= 0) {
        document
          .querySelector("#notice")
          ?.classList.remove(
            "visible",
          );
      }
    }

    this.renderer.render(
      this.world.scene,
      this.camera,
    );

    requestAnimationFrame(
      (t) => this.frame(t),
    );
  }

  private localPlayer() {
    if (!this.latestWorld || !this.localId) return null;
    return Object.values(this.latestWorld.players || {}).find(
      (p: any) => p.id === this.localId,
    ) as PlayerState | undefined ?? null;
  }

  private updatePlayer(dt: number) {
    const serverPlayer = this.localPlayer();

    if (serverPlayer?.downed) {
      return;
    }

    const input = this.input.state;
    const carrying = !!serverPlayer?.carryingCamperId;
    const wantsSprint =
      input.sprint &&
      !input.crouch &&
      this.stamina > 0.05 &&
      !carrying;

    const maxSpeed =
      input.crouch
        ? 2.2
        : carrying
          ? 2.8
          : wantsSprint
            ? 6.6
            : 4.15;

    if (
      wantsSprint &&
      (
        Math.abs(input.forward) > 0.1 ||
        Math.abs(input.right) > 0.1
      )
    ) {
      this.stamina =
        Math.max(
          0,
          this.stamina - dt * 0.18,
        );
    } else {
      this.stamina =
        Math.min(
          1,
          this.stamina + dt * 0.115,
        );
    }

    const forward =
      new THREE.Vector3(
        Math.sin(this.yaw),
        0,
        Math.cos(this.yaw),
      );

    const right =
      new THREE.Vector3(
        Math.cos(this.yaw),
        0,
        -Math.sin(this.yaw),
      );

    const desired =
      forward
        .multiplyScalar(
          input.forward,
        )
        .add(
          right.multiplyScalar(
            input.right,
          ),
        );

    if (desired.lengthSq() > 1) {
      desired.normalize();
    }

    desired.multiplyScalar(
      maxSpeed,
    );

    this.velocity.lerp(
      desired,
      Math.min(
        1,
        dt * 9.5,
      ),
    );

    const vertical =
      -1.2;

    const movement = {
      x: this.velocity.x * dt,
      y: vertical * dt,
      z: this.velocity.z * dt,
    };

    this.controller.computeColliderMovement(
      this.playerCollider,
      movement,
    );

    const corrected =
      this.controller.computedMovement();

    const p =
      this.playerBody.translation();

    this.playerBody.setNextKinematicTranslation({
      x: p.x + corrected.x,
      y: p.y + corrected.y,
      z: p.z + corrected.z,
    });

    const fill =
      document.querySelector<HTMLElement>(
        "#staminaFill",
      );

    if (fill) {
      fill.style.width =
        `${Math.round(
          this.stamina * 100,
        )}%`;
    }
  }

  private updateCamera(dt: number) {
    const p =
      this.playerBody.translation();

    const crouchOffset =
      this.input.state.crouch
        ? 1.05
        : 1.62;

    const bobAmount =
      this.velocity.length() > 0.5
        ? Math.sin(
            performance.now() * 0.012,
          ) * 0.018
        : 0;

    this.camera.position.set(
      p.x,
      p.y + crouchOffset + bobAmount,
      p.z,
    );

    this.camera.rotation.order =
      "YXZ";

    this.camera.rotation.y =
      this.yaw;

    this.camera.rotation.x =
      this.pitch;

    const gunWanted =
      !!this.localPlayer()?.gunEquipped;

    this.gunView.visible =
      gunWanted;

    if (gunWanted) {
      const targetZ =
        this.input.state.aim
          ? -0.54
          : -0.72;

      this.gunView.position.z =
        THREE.MathUtils.lerp(
          this.gunView.position.z,
          targetZ,
          Math.min(
            1,
            dt * 12,
          ),
        );
    }
  }

  private updateFlashlight(dt: number) {
    if (
      this.flashlightOn &&
      this.battery > 0
    ) {
      this.battery =
        Math.max(
          0,
          this.battery - dt * 0.0085,
        );
    }

    if (this.battery <= 0) {
      this.flashlightOn =
        false;
    }

    this.flashlight.visible =
      this.flashlightOn;

    this.flashlight.position.copy(
      this.camera.position,
    );

    const dir =
      new THREE.Vector3();

    this.camera.getWorldDirection(
      dir,
    );

    this.flashlightTarget.position
      .copy(
        this.camera.position,
      )
      .add(
        dir.multiplyScalar(8),
      );

    const fill =
      document.querySelector<HTMLElement>(
        "#batteryFill",
      );

    if (fill) {
      fill.style.width =
        `${Math.round(
          this.battery * 100,
        )}%`;
    }
  }

  private updateInteraction() {
    this.interactionRay.setFromCamera(
      new THREE.Vector2(0, 0),
      this.camera,
    );

    const hits =
      this.interactionRay.intersectObjects(
        this.world.interactables,
        true,
      );

    const hit =
      hits.find(
        (h) =>
          h.distance < 3.2 &&
          h.object.userData.targetId,
      );

    this.targetId =
      hit?.object.userData.targetId ??
      null;

    this.targetPrompt =
      hit?.object.userData.prompt ??
      "";

    if (
      !this.targetId &&
      this.latestWorld
    ) {
      const local =
        this.localPlayer();

      if (local) {
        const downed =
          Object.values(this.latestWorld.players || {}).find(
            (p: any) =>
              p.id !== local.id &&
              p.downed &&
              this.distance(
                local.position,
                p.position,
              ) < 2.2,
          ) as PlayerState | undefined;

        if (downed) {
          this.targetId =
            `revive:${downed.id}`;

          this.targetPrompt =
            `HELP ${downed.name.toUpperCase()}`;
        }
      }
    }

    this.setText(
      "#prompt",
      this.targetPrompt
        ? `E · ${this.targetPrompt}`
        : "",
    );
  }

  private handleActions(
    one: ReturnType<
      InputManager["consumeOneShots"]
    >,
  ) {
    if (
      one.interactPressed &&
      this.targetId
    ) {
      if (
        this.targetId.startsWith(
          "revive:",
        )
      ) {
        this.network.send("REVIVE", {
          targetPlayerId:
            this.targetId.slice(7),
        });
      } else {
        this.network.send("INTERACT", {
          targetId:
            this.targetId,
        });
      }
    }

    if (one.dropPressed) {
      this.network.send("DROP_CAMPER", {});
    }

    if (one.flashlightPressed) {
      this.flashlightOn =
        !this.flashlightOn;

      this.network.send(
        "TOGGLE_FLASHLIGHT",
        { on: this.flashlightOn },
      );
    }

    if (one.mapPressed) {
      this.mapOpen =
        !this.mapOpen;

      document
        .querySelector(
          "#mapOverlay",
        )
        ?.classList.toggle(
          "hidden",
          !this.mapOpen,
        );
    }

    if (one.radioPressed) {
      this.network.send("RADIO", {
        kind: "COME HERE",
      });
    }

    if (
      one.reloadPressed &&
      this.localPlayer()?.gunEquipped
    ) {
      this.network.send("RELOAD", {});
    }

    if (
      one.firePressed &&
      this.localPlayer()?.gunEquipped &&
      !this.localPlayer()?.carryingCamperId
    ) {
      this.fire();
    }
  }

  private fire() {
    const dir =
      new THREE.Vector3();

    this.camera.getWorldDirection(
      dir,
    );

    const origin =
      this.camera.position.clone();

    this.network.send("FIRE", {
      origin: {
        x: origin.x,
        y: origin.y,
        z: origin.z,
      },

      direction: {
        x: dir.x,
        y: dir.y,
        z: dir.z,
      },
    });

    this.gunView.rotation.x -=
      0.18;

    this.gunMuzzle.intensity =
      12;

    setTimeout(
      () =>
        (this.gunMuzzle.intensity = 0),
      55,
    );

    setTimeout(
      () =>
        (this.gunView.rotation.x = -0.06),
      120,
    );
  }

  private sendMovement(now: number) {
    if (
      !this.network ||
      now - this.lastSend < 50
    ) {
      return;
    }

    this.lastSend = now;

    const p =
      this.playerBody.translation();

    this.network.send("MOVE", {
      position: {
        x: p.x,
        y: p.y,
        z: p.z,
      },

      rotationY:
        this.yaw,

      crouching:
        this.input.state.crouch,

      sprinting:
        this.input.state.sprint &&
        this.stamina > 0.05,
    });
  }

  private updateHUDFromWorld(
    world: GameRoomState,
  ) {
    this.setText(
      "#camperCount",
      `${world.campersSafe} / ${world.campersTotal}`,
    );

    const local =
      this.localPlayer();

    this.setText(
      "#carryStatus",
      local?.carryingCamperId
        ? "CARRYING CAMPER"
        : local?.followingCamperIds?.length
          ? `${local.followingCamperIds.length} CAMPER${local.followingCamperIds.length > 1 ? "S" : ""} FOLLOWING`
          : "",
    );

    const weapon =
      document.querySelector<HTMLElement>(
        "#weaponStatus",
      );

    const fire =
      document.querySelector<HTMLElement>(
        "#fireButton",
      );

    const reload =
      document.querySelector<HTMLElement>(
        "#reloadButton",
      );

    const drop =
      document.querySelector<HTMLElement>(
        "#dropButton",
      );

    if (local?.hasGun) {
      weapon?.classList.remove(
        "hidden",
      );

      this.setText(
        "#weaponStatus",
        `DESERT EAGLE · ${local.ammo}/${local.reserveAmmo}`,
      );

      fire?.classList.remove(
        "hidden",
      );

      reload?.classList.remove(
        "hidden",
      );
    } else {
      weapon?.classList.add(
        "hidden",
      );

      fire?.classList.add(
        "hidden",
      );

      reload?.classList.add(
        "hidden",
      );
    }

    drop?.classList.toggle(
      "hidden",
      !local?.carryingCamperId,
    );
  }

  private updateMapMarker() {
    if (!this.mapOpen) {
      return;
    }

    const p =
      this.playerBody.translation();

    const x =
      THREE.MathUtils.clamp(
        (p.x + 50) / 100,
        0,
        1,
      ) * 100;

    const y =
      (
        1 -
        THREE.MathUtils.clamp(
          (p.z + 50) / 100,
          0,
          1,
        )
      ) * 100;

    const marker =
      document.querySelector<HTMLElement>(
        "#mapPlayer",
      );

    if (marker) {
      marker.style.left =
        `${x}%`;

      marker.style.top =
        `${y}%`;
    }
  }

  private notice(text: string) {
    this.setText(
      "#notice",
      text,
    );

    document
      .querySelector(
        "#notice",
      )
      ?.classList.add(
        "visible",
      );

    this.noticeTimer =
      3;
  }

  private setText(
    selector: string,
    text: string,
  ) {
    const el =
      document.querySelector<HTMLElement>(
        selector,
      );

    if (el) {
      el.textContent =
        text;
    }
  }

  private resize() {
    this.camera.aspect =
      window.innerWidth /
      window.innerHeight;

    this.camera.updateProjectionMatrix();

    this.renderer.setSize(
      window.innerWidth,
      window.innerHeight,
    );

    this.renderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio,
        1.6,
      ),
    );
  }

  private distance(
    a: {
      x: number;
      y: number;
      z: number;
    },
    b: {
      x: number;
      y: number;
      z: number;
    },
  ) {
    return Math.hypot(
      a.x - b.x,
      a.y - b.y,
      a.z - b.z,
    );
  }

  private formatTime(
    seconds: number,
  ) {
    const m =
      Math.floor(
        seconds / 60,
      )
        .toString()
        .padStart(
          2,
          "0",
        );

    const s =
      Math.floor(
        seconds % 60,
      )
        .toString()
        .padStart(
          2,
          "0",
        );

    return `${m}:${s}`;
  }
}

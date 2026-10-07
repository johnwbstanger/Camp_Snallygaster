export type InputState = {
  forward: number;
  right: number;
  crouch: boolean;
  sprint: boolean;
  aim: boolean;
};

type OneShots = {
  yawDelta: number;
  pitchDelta: number;
  interactPressed: boolean;
  dropPressed: boolean;
  flashlightPressed: boolean;
  mapPressed: boolean;
  radioPressed: boolean;
  firePressed: boolean;
  reloadPressed: boolean;
};

export class InputManager {
  state: InputState = {
    forward: 0,
    right: 0,
    crouch: false,
    sprint: false,
    aim: false,
  };

  private keys = new Set<string>();
  private yawDelta = 0;
  private pitchDelta = 0;
  private interactPressed = false;
  private dropPressed = false;
  private flashlightPressed = false;
  private mapPressed = false;
  private radioPressed = false;
  private firePressed = false;
  private reloadPressed = false;
  private moveTouch: number | null = null;
  private lookTouch: number | null = null;
  private moveOrigin = { x: 0, y: 0 };
  private lastLook = { x: 0, y: 0 };
  private touchForward = 0;
  private touchRight = 0;

  constructor(private canvas: HTMLCanvasElement) {
    canvas.style.touchAction = "none";
    canvas.tabIndex = 0;

    window.addEventListener("keydown", (event) => {
      this.keys.add(event.code);
      if (event.code === "KeyE") this.interactPressed = true;
      if (event.code === "KeyF") this.flashlightPressed = true;
      if (event.code === "KeyM") this.mapPressed = true;
      if (event.code === "KeyR") this.reloadPressed = true;
      if (event.code === "KeyV") this.radioPressed = true;
      if (event.code === "KeyG") this.dropPressed = true;
      if (event.code === "Space") this.firePressed = true;
    });

    window.addEventListener("keyup", (event) => this.keys.delete(event.code));
    window.addEventListener("blur", () => this.keys.clear());

    canvas.addEventListener("click", () => {
      if (matchMedia("(pointer:fine)").matches && document.pointerLockElement !== canvas) {
        void canvas.requestPointerLock?.();
      }
    });

    document.addEventListener("mousemove", (event) => {
      if (document.pointerLockElement !== canvas) return;
      this.yawDelta -= event.movementX * 0.0022;
      this.pitchDelta -= event.movementY * 0.0022;
    });

    canvas.addEventListener("mousedown", (event) => {
      if (event.button === 0) this.firePressed = true;
      if (event.button === 2) this.state.aim = true;
    });
    canvas.addEventListener("mouseup", (event) => {
      if (event.button === 2) this.state.aim = false;
    });
    canvas.addEventListener("contextmenu", (event) => event.preventDefault());

    this.bindTouchControls();
  }

  updateContinuous() {
    const keyboardForward = (this.keys.has("KeyW") || this.keys.has("ArrowUp") ? 1 : 0)
      - (this.keys.has("KeyS") || this.keys.has("ArrowDown") ? 1 : 0);
    const keyboardRight = (this.keys.has("KeyD") || this.keys.has("ArrowRight") ? 1 : 0)
      - (this.keys.has("KeyA") || this.keys.has("ArrowLeft") ? 1 : 0);

    this.state.forward = Math.max(-1, Math.min(1, keyboardForward || this.touchForward));
    this.state.right = Math.max(-1, Math.min(1, keyboardRight || this.touchRight));
    this.state.crouch = this.keys.has("ControlLeft") || this.keys.has("KeyC") || this.state.crouch;
    this.state.sprint = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight") || this.state.sprint;
  }

  consumeOneShots(): OneShots {
    const shot: OneShots = {
      yawDelta: this.yawDelta,
      pitchDelta: this.pitchDelta,
      interactPressed: this.interactPressed,
      dropPressed: this.dropPressed,
      flashlightPressed: this.flashlightPressed,
      mapPressed: this.mapPressed,
      radioPressed: this.radioPressed,
      firePressed: this.firePressed,
      reloadPressed: this.reloadPressed,
    };

    this.yawDelta = 0;
    this.pitchDelta = 0;
    this.interactPressed = false;
    this.dropPressed = false;
    this.flashlightPressed = false;
    this.mapPressed = false;
    this.radioPressed = false;
    this.firePressed = false;
    this.reloadPressed = false;
    return shot;
  }

  private bindTouchControls() {
    const moveZone = document.querySelector<HTMLElement>("#moveZone");
    const lookZone = document.querySelector<HTMLElement>("#lookZone");
    const knob = document.querySelector<HTMLElement>("#joystickKnob");

    moveZone?.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse") return;
      this.moveTouch = event.pointerId;
      this.moveOrigin = { x: event.clientX, y: event.clientY };
      moveZone.setPointerCapture(event.pointerId);
    });

    moveZone?.addEventListener("pointermove", (event) => {
      if (event.pointerId !== this.moveTouch) return;
      const dx = event.clientX - this.moveOrigin.x;
      const dy = event.clientY - this.moveOrigin.y;
      const radius = 48;
      const len = Math.hypot(dx, dy) || 1;
      const scale = Math.min(1, radius / len);
      const x = dx * scale;
      const y = dy * scale;
      this.touchRight = x / radius;
      this.touchForward = -y / radius;
      if (knob) knob.style.transform = `translate(${x}px, ${y}px)`;
    });

    const endMove = (event: PointerEvent) => {
      if (event.pointerId !== this.moveTouch) return;
      this.moveTouch = null;
      this.touchForward = 0;
      this.touchRight = 0;
      if (knob) knob.style.transform = "translate(0, 0)";
    };
    moveZone?.addEventListener("pointerup", endMove);
    moveZone?.addEventListener("pointercancel", endMove);

    lookZone?.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse") return;
      this.lookTouch = event.pointerId;
      this.lastLook = { x: event.clientX, y: event.clientY };
      lookZone.setPointerCapture(event.pointerId);
    });
    lookZone?.addEventListener("pointermove", (event) => {
      if (event.pointerId !== this.lookTouch) return;
      this.yawDelta -= (event.clientX - this.lastLook.x) * 0.004;
      this.pitchDelta -= (event.clientY - this.lastLook.y) * 0.004;
      this.lastLook = { x: event.clientX, y: event.clientY };
    });
    const endLook = (event: PointerEvent) => {
      if (event.pointerId === this.lookTouch) this.lookTouch = null;
    };
    lookZone?.addEventListener("pointerup", endLook);
    lookZone?.addEventListener("pointercancel", endLook);

    const press = (id: string, fn: () => void) => {
      document.querySelector<HTMLElement>(id)?.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        fn();
      });
    };

    press("#interactButton", () => (this.interactPressed = true));
    press("#flashlightButton", () => (this.flashlightPressed = true));
    press("#mapButton", () => (this.mapPressed = true));
    press("#radioButton", () => (this.radioPressed = true));
    press("#dropButton", () => (this.dropPressed = true));
    press("#fireButton", () => (this.firePressed = true));
    press("#reloadButton", () => (this.reloadPressed = true));
    press("#crouchButton", () => (this.state.crouch = !this.state.crouch));

    const sprint = document.querySelector<HTMLElement>("#sprintButton");
    sprint?.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      this.state.sprint = true;
      sprint.setPointerCapture(event.pointerId);
    });
    const stopSprint = () => (this.state.sprint = false);
    sprint?.addEventListener("pointerup", stopSprint);
    sprint?.addEventListener("pointercancel", stopSprint);
  }
}

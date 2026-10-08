export type InputSnapshot = {
  forward: number;
  right: number;
  lookX: number;
  lookY: number;
  sprint: boolean;
  interactPressed: boolean;
  flashlightPressed: boolean;
};

export class InputManager {
  private keys = new Set<string>();
  private lookX = 0;
  private lookY = 0;
  private moveX = 0;
  private moveY = 0;
  private movePointer: number | null = null;
  private lookPointer: number | null = null;
  private lookLastX = 0;
  private lookLastY = 0;
  private interactPressed = false;
  private flashlightPressed = false;
  private touchSprint = false;
  private cleanup: Array<() => void> = [];
  readonly ui: HTMLDivElement;

  constructor(private canvas: HTMLCanvasElement) {
    this.ui = document.createElement("div");
    this.ui.className = "touch-ui";
    this.ui.innerHTML = `
      <div class="move-pad" data-move><div class="joystick"><div class="joystick-knob"></div></div></div>
      <div class="look-pad" data-look></div>
      <div class="touch-actions">
        <button class="touch-action touch-use" data-use type="button">USE</button>
        <button class="touch-action" data-run type="button">RUN</button>
        <button class="touch-action" data-light type="button">LIGHT</button>
      </div>
    `;
    canvas.parentElement?.appendChild(this.ui);
    this.bindKeyboard();
    this.bindMouse();
    this.bindTouch();
  }

  sample(): InputSnapshot {
    const keyboardForward = (this.keys.has("KeyW") || this.keys.has("ArrowUp") ? 1 : 0) - (this.keys.has("KeyS") || this.keys.has("ArrowDown") ? 1 : 0);
    const keyboardRight = (this.keys.has("KeyD") || this.keys.has("ArrowRight") ? 1 : 0) - (this.keys.has("KeyA") || this.keys.has("ArrowLeft") ? 1 : 0);
    const forward = Math.max(-1, Math.min(1, keyboardForward - this.moveY));
    const right = Math.max(-1, Math.min(1, keyboardRight + this.moveX));
    const snapshot = {
      forward,
      right,
      lookX: this.lookX,
      lookY: this.lookY,
      sprint: this.touchSprint || this.keys.has("ShiftLeft") || this.keys.has("ShiftRight"),
      interactPressed: this.interactPressed,
      flashlightPressed: this.flashlightPressed,
    };
    this.lookX = 0;
    this.lookY = 0;
    this.interactPressed = false;
    this.flashlightPressed = false;
    return snapshot;
  }

  destroy() {
    this.cleanup.forEach((fn) => fn());
    this.cleanup = [];
    this.ui.remove();
  }

  private bindKeyboard() {
    const down = (event: KeyboardEvent) => {
      if (!this.keys.has(event.code)) {
        if (event.code === "KeyE") this.interactPressed = true;
        if (event.code === "KeyF") this.flashlightPressed = true;
      }
      this.keys.add(event.code);
    };
    const up = (event: KeyboardEvent) => this.keys.delete(event.code);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    this.cleanup.push(() => window.removeEventListener("keydown", down), () => window.removeEventListener("keyup", up));
  }

  private bindMouse() {
    const click = () => {
      if (document.pointerLockElement !== this.canvas) void this.canvas.requestPointerLock?.();
    };
    const move = (event: MouseEvent) => {
      if (document.pointerLockElement !== this.canvas) return;
      this.lookX += event.movementX;
      this.lookY += event.movementY;
    };
    this.canvas.addEventListener("click", click);
    window.addEventListener("mousemove", move);
    this.cleanup.push(() => this.canvas.removeEventListener("click", click), () => window.removeEventListener("mousemove", move));
  }

  private bindTouch() {
    const movePad = this.ui.querySelector<HTMLElement>("[data-move]")!;
    const lookPad = this.ui.querySelector<HTMLElement>("[data-look]")!;
    const knob = this.ui.querySelector<HTMLElement>(".joystick-knob")!;
    const useButton = this.ui.querySelector<HTMLButtonElement>("[data-use]")!;
    const runButton = this.ui.querySelector<HTMLButtonElement>("[data-run]")!;
    const lightButton = this.ui.querySelector<HTMLButtonElement>("[data-light]")!;

    const moveStart = (event: PointerEvent) => {
      if (event.pointerType === "mouse" || this.movePointer !== null) return;
      this.movePointer = event.pointerId;
      movePad.setPointerCapture(event.pointerId);
      this.updateMove(event, movePad, knob);
    };
    const moveMove = (event: PointerEvent) => {
      if (event.pointerId !== this.movePointer) return;
      this.updateMove(event, movePad, knob);
    };
    const moveEnd = (event: PointerEvent) => {
      if (event.pointerId !== this.movePointer) return;
      this.movePointer = null;
      this.moveX = 0;
      this.moveY = 0;
      knob.style.transform = "translate(0px, 0px)";
    };

    const lookStart = (event: PointerEvent) => {
      if (event.pointerType === "mouse" || this.lookPointer !== null) return;
      this.lookPointer = event.pointerId;
      this.lookLastX = event.clientX;
      this.lookLastY = event.clientY;
      lookPad.setPointerCapture(event.pointerId);
    };
    const lookMove = (event: PointerEvent) => {
      if (event.pointerId !== this.lookPointer) return;
      this.lookX += (event.clientX - this.lookLastX) * 1.4;
      this.lookY += (event.clientY - this.lookLastY) * 1.4;
      this.lookLastX = event.clientX;
      this.lookLastY = event.clientY;
    };
    const lookEnd = (event: PointerEvent) => {
      if (event.pointerId === this.lookPointer) this.lookPointer = null;
    };

    const use = (event: PointerEvent) => { event.preventDefault(); this.interactPressed = true; };
    const light = (event: PointerEvent) => { event.preventDefault(); this.flashlightPressed = true; };
    const runStart = (event: PointerEvent) => { event.preventDefault(); this.touchSprint = true; runButton.classList.add("active"); };
    const runEnd = (event: PointerEvent) => { event.preventDefault(); this.touchSprint = false; runButton.classList.remove("active"); };

    movePad.addEventListener("pointerdown", moveStart);
    movePad.addEventListener("pointermove", moveMove);
    movePad.addEventListener("pointerup", moveEnd);
    movePad.addEventListener("pointercancel", moveEnd);
    lookPad.addEventListener("pointerdown", lookStart);
    lookPad.addEventListener("pointermove", lookMove);
    lookPad.addEventListener("pointerup", lookEnd);
    lookPad.addEventListener("pointercancel", lookEnd);
    useButton.addEventListener("pointerdown", use);
    lightButton.addEventListener("pointerdown", light);
    runButton.addEventListener("pointerdown", runStart);
    runButton.addEventListener("pointerup", runEnd);
    runButton.addEventListener("pointercancel", runEnd);
    runButton.addEventListener("pointerleave", runEnd);

    this.cleanup.push(
      () => movePad.removeEventListener("pointerdown", moveStart),
      () => movePad.removeEventListener("pointermove", moveMove),
      () => movePad.removeEventListener("pointerup", moveEnd),
      () => movePad.removeEventListener("pointercancel", moveEnd),
      () => lookPad.removeEventListener("pointerdown", lookStart),
      () => lookPad.removeEventListener("pointermove", lookMove),
      () => lookPad.removeEventListener("pointerup", lookEnd),
      () => lookPad.removeEventListener("pointercancel", lookEnd),
      () => useButton.removeEventListener("pointerdown", use),
      () => lightButton.removeEventListener("pointerdown", light),
      () => runButton.removeEventListener("pointerdown", runStart),
      () => runButton.removeEventListener("pointerup", runEnd),
      () => runButton.removeEventListener("pointercancel", runEnd),
      () => runButton.removeEventListener("pointerleave", runEnd),
    );
  }

  private updateMove(event: PointerEvent, pad: HTMLElement, knob: HTMLElement) {
    const rect = pad.getBoundingClientRect();
    const centerX = Math.min(rect.left + 84, rect.right - 56);
    const centerY = Math.max(rect.bottom - 84, rect.top + 56);
    let dx = event.clientX - centerX;
    let dy = event.clientY - centerY;
    const max = 44;
    const length = Math.hypot(dx, dy);
    if (length > max) {
      dx = (dx / length) * max;
      dy = (dy / length) * max;
    }
    this.moveX = dx / max;
    this.moveY = dy / max;
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
  }
}

import * as THREE from "three";
import * as CANNON from "cannon-es";

type PropKind = "cooler" | "box" | "basketball" | "barrel";

type PhysicalProp = {
  id: string;
  label: string;
  kind: PropKind;
  root: THREE.Group;
  body: CANNON.Body;
  mass?: number;
  ownedUntil?: number;
  remoteUntil?: number;
  remoteTarget?: THREE.Vector3;
  remoteQuat?: THREE.Quaternion;
  lastImpact?: number;
};

export type PropNoise = { x: number; z: number; loudness: number; material: string; source: string };
export type PropTransformMessage = { id: string; p: [number, number, number]; q: [number, number, number, number] };

const KIND_MATERIAL: Record<PropKind, { material: string; loudness: number }> = {
  cooler: { material: "plastic", loudness: 34 },
  box: { material: "cardboard", loudness: 20 },
  basketball: { material: "rubber", loudness: 26 },
  barrel: { material: "metal", loudness: 48 },
};

const THROW_SPEED = 19;
const OWN_SECONDS = 4;

export class PhysicalProps {
  readonly interactables: THREE.Object3D[] = [];
  private readonly props = new Map<string, PhysicalProp>();
  private heldId: string | null = null;
  private clock = 0;
  private noiseListener: ((noise: PropNoise) => void) | null = null;

  constructor(private scene: THREE.Scene, private physics: CANNON.World, private mobile: boolean) {
    this.addCooler("prop:cooler-red", "RED COOLER", -12, 0.65, 18.5, 0xb83e32);
    this.addCooler("prop:cooler-teal", "TEAL COOLER", 6.5, 0.65, -19.5, 0x35746d);
    this.addBox("prop:box-1", "CARDBOARD BOX", -34, 0.7, -34, 0.95);
    this.addBox("prop:box-2", "CARDBOARD BOX", -32.8, 0.7, -34.4, 0.8);
    this.addBasketball("prop:basketball-1", "BASKETBALL", 4.5, 0.8, 14.5);
    this.addBasketball("prop:basketball-2", "BASKETBALL", 5.1, 0.8, 15.2);
    this.addBarrel("prop:barrel-1", "UTILITY BARREL", 35, 0.8, -34);
    this.addBarrel("prop:barrel-2", "UTILITY BARREL", 36.1, 0.8, -34.4);
  }

  onNoise(callback: (noise: PropNoise) => void) { this.noiseListener = callback; }

  get heldLabel() { return this.heldId ? this.props.get(this.heldId)?.label ?? null : null; }
  get isHolding() { return this.heldId !== null; }

  /** Launches the held prop along the view direction and reports a throw noise. */
  throwHeld(camera: THREE.Camera) {
    if (!this.heldId) return false;
    const held = this.props.get(this.heldId);
    this.heldId = null;
    if (!held) return false;
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    const mass = held.mass ?? held.body.mass;
    const speed = THROW_SPEED * Math.min(1, 1.6 / Math.sqrt(Math.max(mass, 0.5)) + 0.35);
    held.body.wakeUp();
    held.body.velocity.set(direction.x * speed, direction.y * speed + 2.5, direction.z * speed);
    held.body.angularVelocity.set((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);
    held.ownedUntil = this.clock + OWN_SECONDS;
    held.lastImpact = this.clock + 0.15;
    this.noiseListener?.({ x: held.body.position.x, z: held.body.position.z, loudness: 6, material: "air", source: "throw" });
    return true;
  }

  /** Transforms for props this client is simulating (held, thrown, or still moving). */
  collectOutgoing(): PropTransformMessage[] {
    const out: PropTransformMessage[] = [];
    for (const prop of this.props.values()) {
      const owned = this.heldId === prop.id || (prop.ownedUntil !== undefined && prop.ownedUntil > this.clock);
      if (!owned) continue;
      const { position: p, quaternion: q } = prop.body;
      out.push({ id: prop.id, p: [round(p.x), round(p.y), round(p.z)], q: [round(q.x), round(q.y), round(q.z), round(q.w)] });
    }
    return out;
  }

  applyRemote(transforms: PropTransformMessage[]) {
    for (const transform of transforms) {
      const prop = this.props.get(transform.id);
      if (!prop || this.heldId === transform.id) continue;
      if (prop.remoteUntil === undefined || prop.remoteUntil < this.clock) {
        prop.mass = prop.body.mass;
        prop.body.mass = 0;
        prop.body.type = CANNON.Body.KINEMATIC;
        prop.body.updateMassProperties();
      }
      prop.remoteUntil = this.clock + 0.7;
      prop.ownedUntil = undefined;
      prop.remoteTarget = new THREE.Vector3(...transform.p);
      prop.remoteQuat = new THREE.Quaternion(...transform.q);
    }
  }

  isProp(id: string | null) {
    return Boolean(id && this.props.has(id));
  }

  promptFor(id: string) {
    const prop = this.props.get(id);
    if (!prop) return "INTERACT";
    return this.heldId === id ? `DROP ${prop.label}` : `PICK UP ${prop.label}`;
  }

  toggleHold(id: string) {
    if (!this.props.has(id)) return false;
    if (this.heldId === id) return this.dropHeld();
    const target = this.props.get(id);
    if (target && target.remoteUntil !== undefined && target.remoteUntil > this.clock) return false;
    this.heldId = id;
    this.props.get(id)?.body.wakeUp();
    return true;
  }

  dropHeld() {
    if (!this.heldId) return false;
    const held = this.props.get(this.heldId);
    this.heldId = null;
    held?.body.wakeUp();
    if (held) held.ownedUntil = this.clock + OWN_SECONDS;
    return true;
  }

  update(camera: THREE.Camera, dt: number) {
    this.clock += dt;
    for (const prop of this.props.values()) {
      if (prop.remoteUntil === undefined) continue;
      if (prop.remoteUntil < this.clock) {
        prop.remoteUntil = undefined;
        prop.body.type = CANNON.Body.DYNAMIC;
        prop.body.mass = prop.mass ?? 1;
        prop.body.updateMassProperties();
        prop.body.velocity.setZero();
        prop.body.wakeUp();
      } else if (prop.remoteTarget && prop.remoteQuat) {
        const b = prop.body;
        b.velocity.set((prop.remoteTarget.x - b.position.x) * 12, (prop.remoteTarget.y - b.position.y) * 12, (prop.remoteTarget.z - b.position.z) * 12);
        const q = new THREE.Quaternion(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w).slerp(prop.remoteQuat, 0.35);
        b.quaternion.set(q.x, q.y, q.z, q.w);
        b.wakeUp();
      }
    }
    if (this.heldId) {
      const held = this.props.get(this.heldId);
      if (held) {
        const direction = new THREE.Vector3();
        camera.getWorldDirection(direction);
        const target = camera.position.clone().add(direction.multiplyScalar(1.75));
        target.y -= 0.18;
        const dx = target.x - held.body.position.x;
        const dy = target.y - held.body.position.y;
        const dz = target.z - held.body.position.z;
        const gain = Math.min(20, 11 + dt * 60);
        held.body.velocity.x += dx * gain * dt;
        held.body.velocity.y += dy * gain * dt;
        held.body.velocity.z += dz * gain * dt;
        const speed = Math.hypot(held.body.velocity.x, held.body.velocity.y, held.body.velocity.z);
        if (speed > 11) {
          const scale = 11 / speed;
          held.body.velocity.x *= scale;
          held.body.velocity.y *= scale;
          held.body.velocity.z *= scale;
        }
        held.body.angularVelocity.scale(0.96, held.body.angularVelocity);
        held.body.wakeUp();
      }
    }

    for (const prop of this.props.values()) {
      prop.root.position.set(prop.body.position.x, prop.body.position.y, prop.body.position.z);
      prop.root.quaternion.set(prop.body.quaternion.x, prop.body.quaternion.y, prop.body.quaternion.z, prop.body.quaternion.w);
    }
  }

  private register(prop: PhysicalProp, pickTarget: THREE.Object3D) {
    pickTarget.userData.targetId = prop.id;
    pickTarget.userData.prompt = `PICK UP ${prop.label}`;
    this.interactables.push(pickTarget);
    this.props.set(prop.id, prop);
    prop.mass = prop.body.mass;
    prop.body.addEventListener("collide", (event: { contact: CANNON.ContactEquation }) => {
      const owned = this.heldId === prop.id || (prop.ownedUntil !== undefined && prop.ownedUntil > this.clock);
      if (!owned || (prop.lastImpact ?? 0) > this.clock) return;
      const speed = Math.abs(event.contact.getImpactVelocityAlongNormal());
      if (speed < 2.4) return;
      prop.lastImpact = this.clock + 0.35;
      const info = KIND_MATERIAL[prop.kind];
      this.noiseListener?.({ x: prop.body.position.x, z: prop.body.position.z, loudness: info.loudness * Math.min(1.7, speed / 7), material: info.material, source: "impact" });
    });
    this.scene.add(prop.root);
    this.physics.addBody(prop.body);
  }

  private bodyBase(mass: number, shape: CANNON.Shape, x: number, y: number, z: number) {
    const body = new CANNON.Body({ mass, shape, linearDamping: 0.18, angularDamping: 0.22 });
    body.position.set(x, y, z);
    body.allowSleep = true;
    body.sleepSpeedLimit = 0.12;
    body.sleepTimeLimit = 0.8;
    return body;
  }

  private addCooler(id: string, label: string, x: number, y: number, z: number, color: number) {
    const root = new THREE.Group();
    const bodyMaterial = new THREE.MeshStandardMaterial({ color, roughness: 0.58, metalness: 0.02 });
    const white = new THREE.MeshStandardMaterial({ color: 0xe8e2d6, roughness: 0.46 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x323838, roughness: 0.42, metalness: 0.22 });
    const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.7, 0.78, 2, 2, 2), bodyMaterial);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.31, 0.16, 0.84, 2, 1, 2), white);
    lid.position.y = 0.43;
    const latchL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.07), dark);
    const latchR = latchL.clone();
    latchL.position.set(-0.34, 0.18, 0.425);
    latchR.position.set(0.34, 0.18, 0.425);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.035, 8, 20, Math.PI), dark);
    handle.rotation.z = Math.PI / 2;
    handle.position.y = 0.63;
    root.add(bodyMesh, lid, latchL, latchR, handle);
    root.traverse((obj) => { if (obj instanceof THREE.Mesh) { obj.castShadow = !this.mobile; obj.receiveShadow = !this.mobile; } });
    const body = this.bodyBase(6, new CANNON.Box(new CANNON.Vec3(0.64, 0.45, 0.42)), x, y, z);
    this.register({ id, label, kind: "cooler", root, body }, bodyMesh);
  }

  private addBox(id: string, label: string, x: number, y: number, z: number, size: number) {
    const root = new THREE.Group();
    const cardboard = new THREE.MeshStandardMaterial({ color: 0x9b734e, roughness: 0.96 });
    const tape = new THREE.MeshStandardMaterial({ color: 0xc3a77c, roughness: 0.78 });
    const box = new THREE.Mesh(new THREE.BoxGeometry(size, size * 0.78, size * 0.9), cardboard);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(size * 0.18, size * 0.79, size * 0.91), tape);
    root.add(box, strip);
    root.traverse((obj) => { if (obj instanceof THREE.Mesh) obj.castShadow = !this.mobile; });
    const body = this.bodyBase(3.2, new CANNON.Box(new CANNON.Vec3(size / 2, size * 0.39, size * 0.45)), x, y, z);
    this.register({ id, label, kind: "box", root, body }, box);
  }

  private addBasketball(id: string, label: string, x: number, y: number, z: number) {
    const root = new THREE.Group();
    const orange = new THREE.MeshStandardMaterial({ color: 0xc66529, roughness: 0.78 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2b201b, roughness: 0.7 });
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.26, this.mobile ? 16 : 24, this.mobile ? 10 : 16), orange);
    const seamA = new THREE.Mesh(new THREE.TorusGeometry(0.255, 0.008, 6, 28), dark);
    seamA.rotation.x = Math.PI / 2;
    const seamB = seamA.clone();
    seamB.rotation.y = Math.PI / 2;
    root.add(ball, seamA, seamB);
    ball.castShadow = !this.mobile;
    const body = this.bodyBase(0.7, new CANNON.Sphere(0.26), x, y, z);
    body.material = new CANNON.Material({ restitution: 0.56, friction: 0.5 });
    this.register({ id, label, kind: "basketball", root, body }, ball);
  }

  private addBarrel(id: string, label: string, x: number, y: number, z: number) {
    const root = new THREE.Group();
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x617068, roughness: 0.62, metalness: 0.18 });
    const bandMat = new THREE.MeshStandardMaterial({ color: 0x343b38, roughness: 0.48, metalness: 0.45 });
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.39, 0.9, this.mobile ? 12 : 20), barrelMat);
    for (const yy of [-0.31, 0.31]) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.385, 0.025, 6, this.mobile ? 12 : 20), bandMat);
      band.rotation.x = Math.PI / 2;
      band.position.y = yy;
      root.add(band);
    }
    root.add(barrel);
    barrel.castShadow = !this.mobile;
    const body = this.bodyBase(8.5, new CANNON.Cylinder(0.38, 0.38, 0.9, 16), x, y, z);
    this.register({ id, label, kind: "barrel", root, body }, barrel);
  }
}

function round(value: number) { return Math.round(value * 1000) / 1000; }

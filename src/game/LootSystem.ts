import * as THREE from "three";
import type { LootState } from "../../shared/protocol";

type LootVisual = { root: THREE.Group; hit: THREE.Mesh; glow: THREE.Mesh; phase: number };

export class LootSystem {
  readonly interactables: THREE.Object3D[] = [];
  private readonly visuals = new Map<string, LootVisual>();
  private clock = 0;

  constructor(private scene: THREE.Scene, private mobile: boolean) {}

  sync(loot: readonly LootState[]) {
    for (const item of loot) {
      let visual = this.visuals.get(item.id);
      if (!visual) { visual = this.build(item); this.visuals.set(item.id, visual); }
      const visible = !item.heldBy && !item.delivered;
      visual.root.visible = visible;
      visual.hit.userData.prompt = `PICK UP ${item.name.toUpperCase()} · $${item.value} · ${item.weight} LB`;
      visual.root.position.set(item.x, item.y, item.z);
      const index = this.interactables.indexOf(visual.hit);
      if (visible && index < 0) this.interactables.push(visual.hit);
      if (!visible && index >= 0) this.interactables.splice(index, 1);
    }
  }

  update(dt: number) {
    this.clock += dt;
    for (const visual of this.visuals.values()) {
      if (!visual.root.visible) continue;
      visual.root.children[0].position.y = 0.04 + Math.sin(this.clock * 1.8 + visual.phase) * 0.035;
      visual.root.children[0].rotation.y += dt * 0.5;
      visual.glow.scale.setScalar(1 + Math.sin(this.clock * 3 + visual.phase) * 0.12);
    }
  }

  destroy() {
    for (const visual of this.visuals.values()) this.scene.remove(visual.root);
    this.visuals.clear();
    this.interactables.length = 0;
  }

  private build(item: LootState): LootVisual {
    const root = new THREE.Group();
    root.name = `loot-${item.id}`;
    const model = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ color: item.color, roughness: 0.55, metalness: item.kind === "valuable" ? 0.55 : 0.15, emissive: item.kind === "ridiculous" ? new THREE.Color(item.color).multiplyScalar(0.12) : 0x000000 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1b1a18, roughness: 0.8 });
    const detail = this.mobile ? 8 : 14;
    const scale = 0.7 + Math.min(item.weight, 8) * 0.06;
    switch (item.shape) {
      case "cylinder": model.add(new THREE.Mesh(new THREE.CylinderGeometry(0.1 * scale, 0.12 * scale, 0.32 * scale, detail), material)); break;
      case "sphere": model.add(new THREE.Mesh(new THREE.SphereGeometry(0.17 * scale, detail, detail), material)); break;
      case "flat": { const m = new THREE.Mesh(new THREE.BoxGeometry(0.34 * scale, 0.05, 0.24 * scale), material); m.position.y = 0.03; model.add(m); break; }
      case "long": { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * scale, 0.07 * scale, 0.55 * scale, detail), material); m.rotation.z = Math.PI / 2; m.position.y = 0.08; model.add(m); break; }
      case "mug": {
        model.add(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.17, detail), material));
        const handle = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.016, 6, 10), material); handle.position.x = 0.11; model.add(handle); break;
      }
      case "tape": {
        const reel = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 0.18), material); reel.position.y = 0.03; model.add(reel);
        for (const x of [-0.07, 0.07]) { const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.056, 10), dark); hole.position.set(x, 0.03, 0); model.add(hole); }
        break;
      }
      case "squirrel": {
        model.add(new THREE.Mesh(new THREE.SphereGeometry(0.16, detail, detail), material));
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, detail, detail), material); head.position.set(0.16, 0.1, 0); model.add(head);
        const tail = new THREE.Mesh(new THREE.SphereGeometry(0.14, detail, detail), material); tail.scale.set(0.5, 1.3, 0.6); tail.position.set(-0.17, 0.16, 0); model.add(tail);
        for (const z of [-0.035, 0.035]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff3030 })); eye.position.set(0.24, 0.13, z); model.add(eye); }
        break;
      }
      default: {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.28 * scale, 0.18 * scale, 0.2 * scale), material);
        m.position.y = 0.08;
        model.add(m);
        const strap = new THREE.Mesh(new THREE.BoxGeometry(0.29 * scale, 0.03, 0.04), dark); strap.position.y = 0.1; model.add(strap);
      }
    }
    model.traverse((obj) => { if (obj instanceof THREE.Mesh) { obj.castShadow = !this.mobile; } });
    root.add(model);

    const tint = item.kind === "valuable" ? 0xffd45e : item.kind === "ridiculous" ? 0xff7ad9 : 0x7cd7ff;
    const glow = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.3, 24), new THREE.MeshBasicMaterial({ color: tint, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
    glow.rotation.x = -Math.PI / 2; glow.position.y = 0.02;
    root.add(glow);

    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 0.2;
    hit.userData.targetId = item.id;
    root.add(hit);
    this.scene.add(root);
    return { root, hit, glow, phase: Math.random() * 6 };
  }
}

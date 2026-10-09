import * as THREE from "three";

export type CamperPose = "idle" | "walk";

export type CamperDef = {
  id: string;
  name: string;
  skin: number;
  hair: number;
  shirt: number;
  shorts: number;
  pack: number;
  shoes: number;
  cap: boolean;
  long: boolean;
};

// Lightweight roster: multiplayer only syncs the camper id and pose, never mesh data.
export const CAMPERS: readonly CamperDef[] = [
  { id: "camper-1", name: "Ben", skin: 0xc99368, hair: 0x3f2f24, shirt: 0xd7a844, shorts: 0x334554, pack: 0x8b4e3d, shoes: 0x30383a, cap: true, long: false },
  { id: "camper-2", name: "Maya", skin: 0xb97b57, hair: 0x211d1b, shirt: 0xd46f4b, shorts: 0x56483d, pack: 0x3f6c5d, shoes: 0xd8d0bd, cap: false, long: true },
  { id: "camper-3", name: "Jamie", skin: 0xe0b28a, hair: 0x7b5738, shirt: 0x5f8f7b, shorts: 0x2e4d44, pack: 0xc18b38, shoes: 0x30383a, cap: false, long: false },
  { id: "camper-4", name: "Katie", skin: 0xd6a27a, hair: 0xb08a55, shirt: 0xc7789c, shorts: 0x45424b, pack: 0x4c5875, shoes: 0xd8d0bd, cap: false, long: true },
  { id: "camper-5", name: "Nate", skin: 0x8f5d42, hair: 0x442b22, shirt: 0x5476a3, shorts: 0x334554, pack: 0x8b4e3d, shoes: 0x30383a, cap: true, long: false },
  { id: "camper-6", name: "Jess", skin: 0xc99368, hair: 0x211d1b, shirt: 0xc9853c, shorts: 0x56483d, pack: 0x3f6c5d, shoes: 0xd8d0bd, cap: false, long: true },
  { id: "camper-7", name: "Luke", skin: 0xd6a27a, hair: 0x3f2f24, shirt: 0x6f8b55, shorts: 0x2e4d44, pack: 0xc18b38, shoes: 0x30383a, cap: true, long: false },
];

const mat = (color: number, roughness = 0.88) => new THREE.MeshStandardMaterial({ color, roughness, flatShading: true });

export function buildCamper(def: CamperDef, castShadow = false): THREE.Group {
  const group = new THREE.Group();
  group.name = `camper-model-${def.id}`;
  const shirt = mat(def.shirt, 0.82);
  const shorts = mat(def.shorts);
  const skin = mat(def.skin, 0.9);
  const hair = mat(def.hair, 0.95);
  const shoes = mat(def.shoes, 0.9);
  const socks = mat(0xd9d6c9, 0.95);
  const pack = mat(def.pack, 0.9);
  const roll = mat(0xc49b59, 0.92);
  const neck = mat(0xb43f34, 0.86);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.5, 4, 8), shirt);
  torso.position.y = 0.91;
  const shortsBody = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.3, 0.32), shorts);
  shortsBody.position.y = 0.53;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), skin);
  head.position.y = 1.5;
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.226, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
  hairCap.position.y = 1.57;
  group.add(torso, shortsBody, head, hairCap);

  if (def.long) {
    const ponytail = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.28, 4, 6), hair);
    ponytail.position.set(0, 1.4, -0.24);
    group.add(ponytail);
  }

  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.name = side < 0 ? "arm-left" : "arm-right";
    arm.position.set(side * 0.31, 1.18, 0);
    const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.18, 4, 8), shirt);
    sleeve.position.y = -0.1;
    const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.18, 4, 8), skin);
    forearm.position.y = -0.36;
    arm.add(sleeve, forearm);

    const leg = new THREE.Group();
    leg.name = side < 0 ? "leg-left" : "leg-right";
    leg.position.set(side * 0.12, 0.38, 0);
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.2, 4, 8), skin);
    thigh.position.y = -0.14;
    const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.082, 0.17, 8), socks);
    sock.position.y = -0.3;
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.11, 0.32), shoes);
    shoe.position.set(0, -0.38, 0.08);
    leg.add(thigh, sock, shoe);
    group.add(arm, leg);
  }

  const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.43, 0.56, 0.22), pack);
  backpack.position.set(0, 0.91, -0.25);
  const topRoll = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.4, 8), roll);
  topRoll.rotation.z = Math.PI / 2;
  topRoll.position.set(0, 1.2, -0.28);
  group.add(backpack, topRoll);

  if (def.cap) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.235, 0.08, 12), shirt);
    cap.position.y = 1.7;
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.035, 0.18), shirt);
    brim.position.set(0, 1.68, 0.17);
    group.add(cap, brim);
  }

  const neckerchief = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.22, 3), neck);
  neckerchief.rotation.x = Math.PI;
  neckerchief.position.set(0, 1.23, 0.18);
  group.add(neckerchief);

  group.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = castShadow;
      object.receiveShadow = castShadow;
    }
  });
  return group;
}

export function poseCamper(group: THREE.Group, pose: CamperPose, t: number) {
  const swing = pose === "walk" ? Math.sin(t) * 0.55 : 0;
  const armLeft = group.getObjectByName("arm-left");
  const armRight = group.getObjectByName("arm-right");
  const legLeft = group.getObjectByName("leg-left");
  const legRight = group.getObjectByName("leg-right");
  if (armLeft) armLeft.rotation.x = swing;
  if (armRight) armRight.rotation.x = -swing;
  if (legLeft) legLeft.rotation.x = -swing * 0.65;
  if (legRight) legRight.rotation.x = swing * 0.65;
}

export function disposeCamper(group: THREE.Group) {
  const materials = new Set<THREE.Material>();
  group.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      (Array.isArray(object.material) ? object.material : [object.material]).forEach((m) => materials.add(m));
    }
  });
  materials.forEach((m) => m.dispose());
}

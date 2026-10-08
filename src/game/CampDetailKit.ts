import * as THREE from "three";

type CabinDetail = {
  x: number;
  z: number;
  width: number;
  height: number;
  depth: number;
  lodge?: boolean;
  cabin?: boolean;
};

const CABINS: CabinDetail[] = [
  { x: 0, z: -28, width: 21, height: 5.4, depth: 11, lodge: true },
  { x: -23, z: 3, width: 10, height: 4.1, depth: 7.5, cabin: true },
  { x: 23, z: 3, width: 10, height: 4.1, depth: 7.5, cabin: true },
  { x: -27, z: -23, width: 9, height: 3.7, depth: 7 },
  { x: 27, z: -23, width: 10, height: 4, depth: 7 },
  { x: 0, z: 12, width: 9, height: 3.8, depth: 7 },
  { x: -45, z: 13, width: 10, height: 4, depth: 7.5, cabin: true },
  { x: 45, z: 13, width: 10, height: 4, depth: 7.5, cabin: true },
  { x: -43, z: -40, width: 11, height: 4, depth: 8 },
  { x: 43, z: -40, width: 12, height: 4.2, depth: 8 },
];

export function addCampDetailKit(scene: THREE.Scene, mobile: boolean) {
  const bark = new THREE.MeshStandardMaterial({ color: 0x4d3427, roughness: 1 });
  const cutWood = new THREE.MeshStandardMaterial({ color: 0xb78958, roughness: 0.95 });
  const trim = new THREE.MeshStandardMaterial({ color: 0xd8c7a2, roughness: 0.95 });
  const darkTrim = new THREE.MeshStandardMaterial({ color: 0x33251f, roughness: 1 });
  const fabric = [0xb95f45, 0x426f67, 0xc59b43, 0x596477].map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.98 }));

  for (const cabin of CABINS) addCabinDetails(scene, cabin, trim, darkTrim, fabric, mobile);

  const fallenLogs: Array<[number, number, number, number]> = [
    [-15, 25, 0.22, 3.4], [-3, 26.5, -0.35, 2.8], [18, 18, 0.55, 3.1],
    [-34, 5, -0.5, 3.7], [34, 5.5, 0.42, 3.2], [-31, -31, 0.2, 2.7],
    [31, -31, -0.28, 3.0], [-50, -18, 0.7, 3.6], [50, -17, -0.62, 3.5],
  ];
  for (const [x, z, rotation, length] of fallenLogs) addGroundLog(scene, x, z, rotation, length, bark, cutWood, mobile);

  addWoodPile(scene, -38.5, -35.5, bark, cutWood, mobile);
  addWoodPile(scene, 38.5, -35.5, bark, cutWood, mobile);
  addWoodPile(scene, -27.5, 7.5, bark, cutWood, mobile);

  addCampClutter(scene, fabric, darkTrim, mobile);
}

function addCabinDetails(
  scene: THREE.Scene,
  cabin: CabinDetail,
  trim: THREE.Material,
  darkTrim: THREE.Material,
  fabric: THREE.Material[],
  mobile: boolean,
) {
  const group = new THREE.Group();
  group.position.set(cabin.x, 0, cabin.z);
  const frontZ = cabin.depth / 2 + 0.2;

  const ridge = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, cabin.width + 0.9, mobile ? 6 : 10),
    darkTrim,
  );
  ridge.rotation.z = Math.PI / 2;
  ridge.position.set(0, cabin.height + 1.55, 0);
  group.add(ridge);

  for (const side of [-1, 1]) {
    const fascia = new THREE.Mesh(new THREE.BoxGeometry(cabin.width + 0.7, 0.13, 0.13), trim);
    fascia.position.set(0, cabin.height + 0.92, side * (cabin.depth / 2 + 0.48));
    fascia.rotation.x = side * 0.48;
    group.add(fascia);
  }

  const porchWidth = cabin.lodge ? Math.min(cabin.width * 0.78, 13) : Math.min(cabin.width * 0.66, 6.2);
  const beam = new THREE.Mesh(new THREE.BoxGeometry(porchWidth + 0.25, 0.16, 0.16), darkTrim);
  beam.position.set(0, 2.86, cabin.depth / 2 + 1.55);
  group.add(beam);

  for (const px of [-porchWidth / 2 + 0.35, porchWidth / 2 - 0.35]) {
    const footing = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.28, 8), darkTrim);
    footing.position.set(px, 0.14, cabin.depth / 2 + 1.55);
    group.add(footing);
  }

  for (const wx of [-cabin.width * 0.34, cabin.width * 0.34]) {
    if (Math.abs(wx) < 1.9 && cabin.width < 11) continue;
    for (const offset of [-0.82, 0.82]) {
      const shutter = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.28, 0.1), darkTrim);
      shutter.position.set(wx + offset, 2.15, frontZ + 0.08);
      group.add(shutter);
    }
  }

  const lampHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.24, 8), darkTrim);
  lampHousing.position.set(1.35, 2.55, frontZ + 0.2);
  const lampGlobe = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0xffd88d, emissive: 0xa95a26, emissiveIntensity: 1.5, roughness: 0.5 }),
  );
  lampGlobe.position.set(1.35, 2.34, frontZ + 0.2);
  group.add(lampHousing, lampGlobe);

  if (!mobile && (cabin.lodge || cabin.cabin)) {
    const warm = new THREE.PointLight(0xffb765, cabin.lodge ? 1.4 : 0.75, cabin.lodge ? 12 : 7, 2);
    warm.position.set(1.35, 2.45, cabin.depth / 2 + 1.15);
    group.add(warm);
  }

  if (cabin.cabin) addBunkDetails(group, cabin.width, cabin.depth, fabric, darkTrim);
  scene.add(group);
}

function addBunkDetails(group: THREE.Group, width: number, depth: number, fabric: THREE.Material[], darkTrim: THREE.Material) {
  for (const side of [-1, 1]) {
    const x = side * (width / 2 - 1.0);
    for (const [index, z] of [-depth * 0.2, depth * 0.2].entries()) {
      for (const postX of [-0.52, 0.52]) {
        for (const postZ of [-0.91, 0.91]) {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.55, 0.07), darkTrim);
          post.position.set(x + postX, 0.98, z + postZ);
          group.add(post);
        }
      }
      for (const y of [0.53, 1.3]) {
        const blanket = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.06, 1.25), fabric[(index + (side > 0 ? 1 : 0)) % fabric.length]);
        blanket.position.set(x, y + 0.1, z + 0.18);
        group.add(blanket);
        const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.12, 0.34), fabric[(index + 2) % fabric.length]);
        pillow.position.set(x, y + 0.16, z - 0.62);
        group.add(pillow);
      }
      const ladderX = x + (side < 0 ? 0.68 : -0.68);
      for (const rungY of [0.45, 0.75, 1.05, 1.35]) {
        const rung = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.82), darkTrim);
        rung.position.set(ladderX, rungY, z);
        group.add(rung);
      }
    }
  }
}

function addGroundLog(
  scene: THREE.Scene,
  x: number,
  z: number,
  rotation: number,
  length: number,
  bark: THREE.Material,
  cutWood: THREE.Material,
  mobile: boolean,
) {
  const group = new THREE.Group();
  group.position.set(x, 0.28, z);
  group.rotation.y = rotation;
  const log = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, length, mobile ? 7 : 10), bark);
  log.rotation.z = Math.PI / 2;
  group.add(log);
  for (const side of [-1, 1]) {
    const end = new THREE.Mesh(new THREE.CircleGeometry(side < 0 ? 0.24 : 0.3, mobile ? 7 : 10), cutWood);
    end.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    end.position.x = side * length / 2;
    group.add(end);
  }
  scene.add(group);
}

function addWoodPile(scene: THREE.Scene, x: number, z: number, bark: THREE.Material, cutWood: THREE.Material, mobile: boolean) {
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 4 - row; col += 1) {
      addGroundLog(scene, x + col * 0.58 + row * 0.28, z + row * 0.22, 0, 0.9, bark, cutWood, mobile);
    }
  }
}

function addCampClutter(scene: THREE.Scene, fabric: THREE.Material[], darkTrim: THREE.Material, mobile: boolean) {
  const bags: Array<[number, number, number]> = [
    [-20.4, 8.2, 0], [-24.8, 7.2, 1], [20.5, 7.9, 2], [24.7, 7.1, 3],
    [-43.2, 18.0, 1], [44.3, 18.2, 2], [-8.8, -24.0, 0], [8.8, -24.2, 3],
  ];
  for (const [x, z, materialIndex] of bags) {
    const bag = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.55, 3, mobile ? 6 : 8), fabric[materialIndex % fabric.length]);
    body.rotation.z = Math.PI / 2;
    body.position.y = 0.28;
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.035, 5, 10, Math.PI), darkTrim);
    strap.rotation.x = Math.PI / 2;
    strap.position.set(0, 0.42, 0);
    bag.add(body, strap);
    bag.position.set(x, 0, z);
    scene.add(bag);
  }

  const coolerAccents: Array<[number, number]> = [[-10.5, 18.5], [-6.2, -21.8], [7.2, -22.6], [31.5, -20]];
  const metal = new THREE.MeshStandardMaterial({ color: 0x6f7470, roughness: 0.55, metalness: 0.25 });
  for (const [x, z] of coolerAccents) {
    const latchLeft = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.18, 0.08), metal);
    const latchRight = latchLeft.clone();
    latchLeft.position.set(x - 0.38, 0.9, z + 0.49);
    latchRight.position.set(x + 0.38, 0.9, z + 0.49);
    scene.add(latchLeft, latchRight);
  }
}

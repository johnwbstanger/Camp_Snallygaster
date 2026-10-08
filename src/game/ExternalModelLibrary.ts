import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export type CampModelKey = "cardboardBox" | "picnicTable" | "barrel";

type ModelSpec = {
  url: string;
  targetSize: number;
  rotationY?: number;
};

// Poly Haven models are CC0. Keep these URLs isolated here so they can be
// mirrored locally later without changing gameplay or physics code.
const MODEL_SPECS: Record<CampModelKey, ModelSpec> = {
  cardboardBox: {
    url: "https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/cardboard_box_01/cardboard_box_01_1k.gltf",
    targetSize: 0.95,
  },
  picnicTable: {
    url: "https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/wooden_picnic_table/wooden_picnic_table_1k.gltf",
    targetSize: 4.2,
  },
  barrel: {
    url: "https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/Barrel_01/Barrel_01_1k.gltf",
    targetSize: 0.9,
  },
};

export class ExternalModelLibrary {
  private readonly loader = new GLTFLoader();
  private readonly cache = new Map<CampModelKey, Promise<THREE.Group | null>>();

  constructor(private mobile: boolean) {}

  clone(key: CampModelKey) {
    return this.load(key).then((source) => source?.clone(true) ?? null);
  }

  private load(key: CampModelKey) {
    const existing = this.cache.get(key);
    if (existing) return existing;

    const spec = MODEL_SPECS[key];
    const request = new Promise<THREE.Group | null>((resolve) => {
      this.loader.load(
        spec.url,
        (gltf) => {
          try {
            const model = gltf.scene;
            this.normalize(model, spec);
            model.traverse((object) => {
              if (!(object instanceof THREE.Mesh)) return;
              object.castShadow = !this.mobile;
              object.receiveShadow = !this.mobile;
              const material = object.material;
              if (Array.isArray(material)) material.forEach((item) => { item.needsUpdate = true; });
              else if (material) material.needsUpdate = true;
            });
            resolve(model);
          } catch (error) {
            console.warn(`[assets] Could not prepare ${key}; keeping fallback mesh`, error);
            resolve(null);
          }
        },
        undefined,
        (error) => {
          console.warn(`[assets] Could not load ${key}; keeping fallback mesh`, error);
          resolve(null);
        },
      );
    });
    this.cache.set(key, request);
    return request;
  }

  private normalize(model: THREE.Group, spec: ModelSpec) {
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const largest = Math.max(size.x, size.y, size.z, 0.0001);
    const scale = spec.targetSize / largest;
    model.scale.multiplyScalar(scale);
    model.rotation.y += spec.rotationY ?? 0;
    model.updateMatrixWorld(true);

    const normalizedBox = new THREE.Box3().setFromObject(model);
    const center = normalizedBox.getCenter(new THREE.Vector3());
    const min = normalizedBox.min;
    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= min.y;
  }
}

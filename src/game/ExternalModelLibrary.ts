import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export type CampModelKey = "cardboardBox" | "picnicTable" | "barrel" | "cooler";

type ModelSpec = {
  urls: string[];
  targetSize: number;
  rotationY?: number;
};

// External assets are isolated here so gameplay code never depends on a model
// loading successfully. Poly Haven and 3DAssets.dev entries used below are CC0.
// Every request has a procedural fallback in the game if the CDN is unavailable.
const MODEL_SPECS: Record<CampModelKey, ModelSpec> = {
  cardboardBox: {
    urls: [
      "https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/cardboard_box_01/cardboard_box_01_1k.gltf",
    ],
    targetSize: 0.95,
  },
  picnicTable: {
    urls: [
      "https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/wooden_picnic_table/wooden_picnic_table_1k.gltf",
      "https://cdn.3dassets.dev/assets/18385/v1/model.glb",
    ],
    targetSize: 4.2,
  },
  barrel: {
    urls: [
      "https://cdn.3dassets.dev/assets/19956/v1/model.glb",
    ],
    targetSize: 0.92,
  },
  cooler: {
    urls: [
      "https://cdn.3dassets.dev/assets/28560/v1/model.glb",
      "https://cdn.3dassets.dev/assets/22308/v1/model.glb",
    ],
    targetSize: 1.25,
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
    const request = this.tryUrls(key, spec, 0);
    this.cache.set(key, request);
    return request;
  }

  private tryUrls(key: CampModelKey, spec: ModelSpec, index: number): Promise<THREE.Group | null> {
    const url = spec.urls[index];
    if (!url) {
      console.warn(`[assets] All sources failed for ${key}; keeping fallback mesh`);
      return Promise.resolve(null);
    }

    return new Promise<THREE.Group | null>((resolve) => {
      this.loader.load(
        url,
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
            console.warn(`[assets] Could not prepare ${key} from ${url}`, error);
            void this.tryUrls(key, spec, index + 1).then(resolve);
          }
        },
        undefined,
        (error) => {
          console.warn(`[assets] Could not load ${key} from ${url}`, error);
          void this.tryUrls(key, spec, index + 1).then(resolve);
        },
      );
    });
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

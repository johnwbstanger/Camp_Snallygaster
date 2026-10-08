import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";

export type AssetKey =
  | "camperMale"
  | "camperFemale"
  | "counselor"
  | "cooler"
  | "canoe"
  | "cabin"
  | "bus"
  | "tree"
  | "cartons";

type AssetDefinition = {
  url: string;
  targetHeight?: number;
  targetLongestSide?: number;
  rotateY?: number;
};

// Every external visual is documented in docs/ASSET_PROVENANCE.md and has a
// local gameplay/collision fallback. Render assets never define gameplay physics.
const QUATERNIUS_BASE = "https://raw.githubusercontent.com/dustinc555/mygame/f2cc1affbca335b74ee44ecbd765db4bd17f0f05/assets/vendor/quaternius/universal_base_characters/base_characters";
const ASSETS: Record<AssetKey, AssetDefinition> = {
  camperMale: {
    url: `${QUATERNIUS_BASE}/Teen_Male_FullBody.gltf`,
    targetHeight: 1.55,
  },
  camperFemale: {
    url: `${QUATERNIUS_BASE}/Teen_Female_FullBody.gltf`,
    targetHeight: 1.52,
  },
  counselor: {
    url: "https://raw.githubusercontent.com/Hhk187/Zomopocalypse/main/Assets/Models/Characters/Ultimate%20Modular%20Men%20Pack-glb/Casual%20Character.glb",
    targetHeight: 1.78,
  },
  cooler: {
    url: "https://cdn.3dassets.dev/assets/28560/v1/model.glb",
    targetLongestSide: 0.9,
  },
  canoe: {
    url: "https://cdn.3dassets.dev/assets/28833/v1/model.glb",
    targetLongestSide: 4.7,
  },
  cabin: {
    url: "https://cdn.3dassets.dev/assets/34212/v1/model.glb",
    targetLongestSide: 5.4,
  },
  bus: {
    url: "https://cdn.3dassets.dev/assets/34194/v1/model.glb",
    targetLongestSide: 9.0,
    rotateY: Math.PI / 2,
  },
  tree: {
    url: "https://cdn.3dassets.dev/assets/32685/v1/model.glb",
    targetHeight: 7.2,
  },
  cartons: {
    url: "https://cdn.3dassets.dev/assets/34800/v1/model.glb",
    targetHeight: 0.92,
  },
};

export class AssetLibrary {
  private readonly loader = new GLTFLoader();
  private readonly templates = new Map<AssetKey, Promise<THREE.Group | null>>();

  clone(key: AssetKey) {
    let promise = this.templates.get(key);
    if (!promise) {
      promise = this.loadTemplate(key);
      this.templates.set(key, promise);
    }
    return promise.then((template) => template ? cloneSkeleton(template) as THREE.Group : null);
  }

  async attach(
    key: AssetKey,
    parent: THREE.Object3D,
    options: {
      position?: THREE.Vector3Tuple;
      rotation?: THREE.Vector3Tuple;
      scale?: number | THREE.Vector3Tuple;
      name?: string;
    } = {},
  ) {
    const model = await this.clone(key);
    if (!model) return null;
    model.name = options.name ?? `asset:${key}`;
    if (options.position) model.position.fromArray(options.position);
    if (options.rotation) model.rotation.set(...options.rotation);
    if (typeof options.scale === "number") model.scale.multiplyScalar(options.scale);
    else if (options.scale) model.scale.multiply(new THREE.Vector3(...options.scale));
    parent.add(model);
    return model;
  }

  private loadTemplate(key: AssetKey): Promise<THREE.Group | null> {
    const definition = ASSETS[key];
    return new Promise((resolve) => {
      let settled = false;
      const timeout = window.setTimeout(() => {
        if (!settled) {
          settled = true;
          console.warn(`Timed out loading ${key}; keeping local fallback geometry.`);
          resolve(null);
        }
      }, 9000);

      this.loader.load(
        definition.url,
        (gltf) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          const root = gltf.scene;
          root.name = `template:${key}`;
          root.rotation.y += definition.rotateY ?? 0;
          root.userData.animations = gltf.animations;
          this.normalize(root, definition);
          root.traverse((object) => {
            if (!(object instanceof THREE.Mesh)) return;
            object.castShadow = true;
            object.receiveShadow = true;
            object.frustumCulled = true;
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            for (const material of materials) {
              if (material && "roughness" in material) {
                const standard = material as THREE.MeshStandardMaterial;
                standard.roughness = Math.max(0.32, Math.min(0.92, standard.roughness ?? 0.72));
              }
            }
          });
          resolve(root);
        },
        undefined,
        (error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          console.warn(`Could not load ${key}; keeping local fallback geometry.`, error);
          resolve(null);
        },
      );
    });
  }

  private normalize(root: THREE.Object3D, definition: AssetDefinition) {
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    let factor = 1;
    if (definition.targetHeight && size.y > 0.0001) factor = definition.targetHeight / size.y;
    if (definition.targetLongestSide) {
      const longest = Math.max(size.x, size.y, size.z);
      if (longest > 0.0001) factor = definition.targetLongestSide / longest;
    }
    root.scale.multiplyScalar(factor);
    root.position.x -= center.x * factor;
    root.position.z -= center.z * factor;
    root.position.y -= box.min.y * factor;
  }
}

export const assetLibrary = new AssetLibrary();

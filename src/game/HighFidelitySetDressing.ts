import * as THREE from "three";
import { assetLibrary } from "./AssetLibrary";

export function addHighFidelitySetDressing(scene: THREE.Scene, mobile: boolean) {
  const treePlacements: Array<[number, number, number, number]> = [
    [-56, 34, 0.9, 0.2], [-50, -50, 1.1, -0.5], [-30, -58, 1.0, 0.9],
    [0, -61, 1.18, 0.15], [31, -58, 0.96, -0.8], [52, -48, 1.12, 0.5],
    [57, -18, 0.92, 1.1], [59, 28, 1.08, -0.3], [38, 51, 1.02, 0.7],
    [9, 58, 0.95, -1.0], [-21, 57, 1.12, 0.25], [-49, 49, 1.0, -0.6],
  ];

  const treeLimit = mobile ? 5 : treePlacements.length;
  for (let i = 0; i < treeLimit; i += 1) {
    const [x, z, scale, rotation] = treePlacements[i];
    void assetLibrary.attach("tree", scene, {
      position: [x, 0, z],
      rotation: [0, rotation, 0],
      scale,
      name: `detail-tree-${i}`,
    });
  }

  const cartonPlacements: Array<[number, number, number, number]> = [
    [-35.5, -33.4, 0.92, 0.15],
    [35.2, -33.2, 1.05, -0.3],
    [27.8, -27.3, 0.9, 0.52],
    [-41.2, -38.1, 0.86, -0.18],
  ];
  for (let i = 0; i < cartonPlacements.length; i += 1) {
    const [x, z, scale, rotation] = cartonPlacements[i];
    void assetLibrary.attach("cartons", scene, {
      position: [x, 0, z],
      rotation: [0, rotation, 0],
      scale,
      name: `carton-stack-${i}`,
    });
  }
}

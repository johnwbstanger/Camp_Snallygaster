import * as THREE from "three";
import { ExternalModelLibrary } from "./ExternalModelLibrary";

type Placement = { x: number; z: number; rotation: number };

const PICNIC_TABLES: Placement[] = [
  { x: -5.5, z: -17.5, rotation: 0.08 },
  { x: 5.5, z: -17.5, rotation: -0.08 },
  { x: -10.5, z: -30, rotation: Math.PI / 2 },
  { x: 10.5, z: -30, rotation: Math.PI / 2 },
];

export class StaticSceneryUpgrade {
  private readonly models: ExternalModelLibrary;

  constructor(private scene: THREE.Scene, mobile: boolean) {
    this.models = new ExternalModelLibrary(mobile);
    this.upgradePicnicTables();
  }

  private upgradePicnicTables() {
    for (const placement of PICNIC_TABLES) {
      const fallback = this.findGroupAt(placement.x, placement.z);
      void this.models.clone("picnicTable").then((model) => {
        if (!model) return;
        model.position.set(placement.x, 0.02, placement.z);
        model.rotation.y += placement.rotation;
        this.scene.add(model);
        if (fallback) fallback.visible = false;
      }).catch((error) => {
        console.warn("[assets] Picnic table upgrade failed; procedural table remains", error);
      });
    }
  }

  private findGroupAt(x: number, z: number) {
    return this.scene.children.find((child): child is THREE.Group =>
      child instanceof THREE.Group
      && Math.abs(child.position.x - x) < 0.02
      && Math.abs(child.position.z - z) < 0.02
      && child.children.length >= 4,
    ) ?? null;
  }
}

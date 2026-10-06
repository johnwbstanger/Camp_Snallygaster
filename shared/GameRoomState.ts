import { Room, Client } from "@colyseus/core";
import { Schema, type, ArraySchema, MapSchema } from "@colyseus/schema";

export class Vec3 extends Schema {
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") z: number = 0;
}

export class PlayerState extends Schema {
  @type("string") id: string = "";
  @type("string") name: string = "";
  @type(Vec3) position: Vec3 = new Vec3();
  @type("number") rotationY: number = 0;
  @type("boolean") crouching: boolean = false;
  @type("boolean") sprinting: boolean = false;
  @type("boolean") downed: boolean = false;
  @type("string") carryingCamperId: string | null = null;
  @type(["string"]) followingCamperIds = new ArraySchema<string>();
  @type("boolean") flashlightOn: boolean = false;
  @type("boolean") hasGun: boolean = false;
  @type("boolean") gunEquipped: boolean = false;
  @type("number") ammo: number = 0;
  @type("number") reserveAmmo: number = 0;
}

export class CamperState extends Schema {
  @type("string") id: string = "";
  @type("string") name: string = "";
  @type(Vec3) position: Vec3 = new Vec3();
  @type("string") hidingSpotId: string = "";
  @type("string") state: string = "HIDING";
  @type("boolean") found: boolean = false;
  @type("boolean") safe: boolean = false;
  @type("string") followingPlayerId: string | null = null;
  @type("string") carriedByPlayerId: string | null = null;
}

export class MonsterState extends Schema {
  @type(Vec3) position: Vec3 = new Vec3();
  @type("number") rotationY: number = 0;
  @type("string") state: string = "DORMANT";
  @type("number") health: number = 5;
  @type("string") targetPlayerId: string | null = null;
}

export class DoorState extends Schema {
  @type("string") id: string = "";
  @type("boolean") open: boolean = false;
}

export class GunState extends Schema {
  @type("boolean") spawned: boolean = false;
  @type("boolean") discovered: boolean = false;
  @type("boolean") pickedUp: boolean = false;
  @type("string") ownerId: string | null = null;
  @type(Vec3) position: Vec3 = new Vec3();
}

export class GameRoomState extends Schema {
  @type("string") phase: string = "LOBBY";
  @type("number") roundElapsed: number = 0;
  @type("number") campersSafe: number = 0;
  @type("number") campersTotal: number = 7;
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type([CamperState]) campers = new ArraySchema<CamperState>();
  @type(MonsterState) monster: MonsterState = new MonsterState();
  @type([DoorState]) doors = new ArraySchema<DoorState>();
  @type(GunState) gun: GunState = new GunState();
  @type("string") hostId: string = "";
  @type("boolean") started: boolean = false;
}

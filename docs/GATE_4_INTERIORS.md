# Gate 4 — Enterable Cabins and Shared Doors

Gate 4 turns the richer camp buildings into actual playable spaces and establishes the interaction backbone for future props.

## Protected systems

- solo menu and solo rescue loop
- 15-player lobby capacity
- player spawn behavior
- multiplayer movement synchronization
- camper rescue and monster state
- bus extraction location
- GitHub Pages static deployment path

## Included

- replace solid building collision blocks with separate side, back, and front wall colliders
- leave a real doorway opening in each cabin/lodge
- add simple interior furniture appropriate to each building type
- add physical cabin doors with a visual hinge pivot
- add a central interaction raycast from the player camera
- show an E / USE prompt for a targeted door within interaction distance
- allow solo players to open/close doors locally
- make multiplayer door state server authoritative
- validate door interactions on the server by player distance
- synchronize door state to every client in the room
- disable a door collider while its door is open and restore it when closed
- preserve the existing nearest-camper interaction when no world object is targeted

## Shared door IDs

- door:dining
- door:cabin-a
- door:cabin-b
- door:bath-house
- door:arts-crafts
- door:director
- door:cabin-c
- door:cabin-d
- door:infirmary
- door:maintenance

## Acceptance criteria

1. TypeScript passes.
2. Production Vite build passes.
3. Production HTTP/assets/WebSocket smoke passes.
4. 15 clients can still join the same room.
5. A 16th client is still rejected cleanly.
6. All 15 spawn positions remain unique.
7. The round starts for connected clients.
8. One client can open a door and another client receives the open state.
9. The same door can be closed and the other client receives the closed state.
10. Existing movement, camper rescue, and monster/threat synchronization remain green.
11. Solo remains available and door interaction does not require the multiplayer server.

## Deferred

- drawers and containers
- carryable props
- synchronized coolers and loot
- map/radio/drop bindings
- revive/downed state
- imported hero assets
- audio occlusion and door sounds

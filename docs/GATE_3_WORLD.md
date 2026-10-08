# Gate 3 — World Scale and Art Pass 1

Gate 3 improves the camp visually and spatially without changing the verified multiplayer or rescue protocol.

## Protected systems

The following are frozen during this gate:

- solo menu and solo rescue path
- 15-player room creation/join capacity
- lobby protocol and host behavior
- WebSocket message schema
- server-authoritative camper and monster state
- multiplayer spawn protocol
- extraction logic at the bus

## Included

- expand the visual ground footprint from the small prototype camp to a much larger camp property
- add a broader trail network and more visual breathing room for 15 players
- replace plain box buildings with layered cabins/lodges using foundations, sloped roofs, porches, doors, trim, windows, posts, signs, and a lodge chimney
- expand the camp with Cabin C, Cabin D, infirmary, and maintenance buildings
- improve the bus while keeping the extraction location unchanged
- add a camp entrance arch and large Camp Snallygaster sign
- enrich the central firepit with benches and warm light
- add picnic tables, coolers, crate stacks, lanterns, canoe racks, and canoes
- increase the tree perimeter using instanced meshes
- use reduced tree detail and fewer tree instances on mobile
- use sparse simple tree colliders rather than a physics body for every tree
- preserve simple invisible collision volumes for buildings even when visual geometry becomes more detailed

## Art direction

The palette and material language should feel like a late-1980s / early-1990s outdoor-catalog summer camp:

- pine and forest greens
- faded mustard yellow
- sun-faded orange
- cream-painted signs and trim
- brown stained wood
- teal outdoor equipment
- warm campfire light

The goal is not low-poly stylization. Primitive geometry may still be used as efficient construction pieces, but it should be layered and proportioned so that the environment reads as a deliberate, built camp rather than placeholder boxes.

## Acceptance criteria

1. TypeScript typecheck passes.
2. Production Vite build passes.
3. Production index and compiled assets pass the deployment smoke test.
4. Production WebSocket endpoint still passes.
5. The 15-player multiplayer smoke test remains green.
6. The 16th player is still rejected cleanly.
7. Shared movement, camper rescue, and monster/threat state still synchronize.
8. No server protocol or shared message schema changes occur in this gate.
9. Bus extraction remains at the existing gameplay location.
10. All playable camp buildings remain inside the existing server movement bounds; outer forest beyond those bounds is a visual perimeter.
11. Solo remains available through the same menu path.

## Deferred to later gates

- networked doors and drawers
- inventory and pickup/drop systems
- map and radio systems
- imported GLB/GLTF hero assets
- terrain heightfields
- lake/water simulation
- advanced LOD streaming
- authoritative movement validation
- horizontal multiplayer scaling

# Camp Snallygaster — Production Acceptance Checklist

This document is the authoritative definition of what Camp Snallygaster needs before it should be called a functional browser-first cooperative horror game in the same broad gameplay family as Lethal Company. It is not permission to copy proprietary code, assets, maps, audio, UI, or exact implementation details from Lethal Company. The goal is to reproduce the cooperative extraction-horror structure with original Camp Snallygaster content and legally reusable assets.

Status legend:
- DONE = implemented and covered by a repeatable test or direct code path
- PARTIAL = exists but is not yet production-complete
- MISSING = required and not implemented
- BLOCKED = depends on external deployment/assets not yet proven

## P0 — Boot, deployment, and public playability

- PARTIAL Browser client builds with Vite and loads on desktop/mobile.
- DONE WebGL capability failure is handled instead of white-screening silently.
- DONE Production Node server can serve compiled client, /healthz, /api/status, and /ws in local production smoke tests.
- BLOCKED Public multiplayer backend must answer HTTPS /healthz from the public internet.
- BLOCKED Public multiplayer backend must accept WSS /ws from the public internet.
- BLOCKED Public backend must pass a real create-room handshake from outside CI/local process.
- MISSING Client publish workflow must fail if configured production backend is unreachable.
- MISSING Client publish workflow must fail if WSS create-room handshake fails.
- MISSING GitHub Pages build must point only at a proven backend URL; no dead hard-coded fallback.
- MISSING Deployment must have restart policy/health checks and survive process restart.
- MISSING Production logs must expose connection, room creation, join, disconnect, protocol errors, and server exceptions without leaking secrets.
- MISSING Public status surface must report build/version so client/server mismatch is diagnosable.

Backend responsibility: HTTPS/WSS Node service must run continuously on a real hosting platform. GitHub Pages is only the static browser client and cannot be the multiplayer server.

## P0 — Main menu and lobby

- DONE Main menu shell exists before loading the heavy 3D runtime.
- DONE Create Camp flow exists in client protocol.
- DONE Join Camp by room code exists in client protocol.
- DONE Host ID and roster are synchronized in local multiplayer smoke.
- DONE Capacity is 15 players and overflow is rejected.
- DONE Only host can start a round.
- PARTIAL Lobby UI needs final visual treatment and clear connectivity states.
- MISSING Visible public-server status indicator before Create/Join.
- MISSING Reconnect flow after temporary WebSocket loss.
- MISSING Host migration behavior after host disconnect during an active round.
- MISSING Room expiration/garbage collection policy for abandoned rooms.
- MISSING Version compatibility rejection when client and server protocol versions differ.
- MISSING Invite/link format that can encode room code for one-tap join.

Backend responsibility: room registry, capacity, host authority, roster, lifecycle, disconnect cleanup, protocol/version validation.

## P0 — Player controller

- DONE WASD movement.
- DONE Mouse look.
- DONE Touch movement/look for iPad/iPhone.
- DONE Normal movement speed = 18.1125.
- DONE Sprint speed = 31.696875.
- DONE Diagonal normalization.
- DONE Crouch input exists.
- PARTIAL Jump key exists; full grounded jump physics still needs production validation.
- DONE Player uses compound collision shape.
- DONE Cannon physics runs at high fixed frequency with substeps.
- DONE Swept anti-tunnelling collision guard protects major camp solids at high speed.
- MISSING Step/slope behavior needs defined limits and tests.
- MISSING Grounded-state detector should prevent air-jump exploits.
- MISSING Fall impact/landing feedback.
- MISSING Head-bob/body motion should be subtle and platform-tunable.
- MISSING Controller/gamepad support.
- MISSING Accessibility options for look sensitivity, invert Y, hold/toggle sprint/crouch.

Backend responsibility: current implementation trusts client position snapshots. For stronger multiplayer integrity, server should validate maximum displacement/speed and reject impossible teleports.

## P0 — World collision and navigation

- DONE Ground collision.
- DONE Cabin wall collision proxies.
- DONE Major bus/storage/canoe collision blockers.
- DONE Door collision rotates with visible door.
- PARTIAL Trees/props use a mix of collision proxies and decorative visuals.
- MISSING Every final imported building must have a matching invisible collision shell.
- MISSING Every final stair/porch/ramp must be traversable without snagging.
- MISSING Doors must never visually open while leaving a mismatched invisible closed collider.
- MISSING Camper/monster navigation needs obstacle-aware pathing instead of straight-line movement where appropriate.
- MISSING Stuck recovery for NPCs and dynamic props.

Backend responsibility: server owns shared door state and AI positions; client owns local collision feel. Shared geometry definitions must remain aligned between client and server.

## P0 — Visual environment

- PARTIAL Camp layout exists: cabins, dining hall, bath house, arts, director, maintenance/infirmary areas, road, bus, forest perimeter.
- PARTIAL Higher-fidelity external conifers/cartons/cooler/canoe/bus visuals exist, but many procedural placeholders remain.
- MISSING Replace base cone/cylinder forest with optimized realistic trees/LOD set.
- MISSING Replace procedural cabins with textured/PBR cabin models while preserving gameplay entrances.
- MISSING Replace city-bus placeholder with period-appropriate American camp/school bus.
- MISSING Integrate licensed TurboSquid camping pack locally for approved props.
- MISSING Convert/optimize paid pack to web-friendly glTF/GLB as needed.
- MISSING Add terrain material variation, grass, leaf litter, rocks, decals, shoreline/dock treatment.
- MISSING Add believable interior dressing: bunks, lockers, posters, tables, lamps, camp equipment, kitchen/pantry props.
- MISSING Lighting pass for dusk/night readability: moonlight, warm interiors, flashlight response, fog, shadow budget.
- MISSING LOD/instancing/texture compression pass for iPad performance.

Backend responsibility: none for appearance except shared state of doors/objects. Render assets must never be authoritative physics.

## P0 — Camper characters

- DONE Seven named campers exist in the game state.
- DONE Naked Quaternius base-body camper override is removed from active ObjectiveSystem path.
- DONE Interim campers are visibly clothed with shirts, shorts, socks, shoes, backpacks, hair/caps, neckerchiefs.
- DONE Camper render scale is corrected from 0.5 to 0.82 for believable child/young-teen size.
- MISSING Replace procedural interim campers with final game-ready kid/young-teen models supplied/approved by user.
- MISSING At least 7 visibly distinct camper variants (body, clothing, hair, backpack colors/details).
- MISSING Rigged walk/run/idle/fear/board-bus animations.
- MISSING Facial/head-look behavior and idle fidgets.
- MISSING Foot placement/root motion tuning to stop floating/sliding.
- MISSING Camper collision/nav radius tuned to doorways and bus boarding.
- MISSING Camper voice barks or text callouts where appropriate.

Backend responsibility: server owns HIDDEN/FOLLOWING/SAFE state, following player ID, and authoritative shared position in multiplayer. Client renders/interpolates animation.

## P0 — Camper rescue loop

- DONE Hidden camper state.
- DONE Player can call/interact with nearby camper.
- DONE Camper follows rescuing player.
- DONE Camper becomes SAFE near extraction bus.
- DONE Camper visually queues toward bus door and moves inside before disappearing.
- DONE Bus door opens during boarding and closes after boarding.
- DONE Round win depends on all campers safe/boarded in client presentation.
- MISSING Use 14+ authored hiding spots and randomly choose 7 each round.
- MISSING Camper pathfinding around walls/closed doors.
- MISSING Lost/stuck camper catch-up behavior.
- MISSING Rescue interruption/downed-player transfer rules.
- MISSING Multiplayer ownership transfer if following player disconnects.

Backend responsibility: choose round hiding locations, validate rescue distance, assign follower ownership, transition SAFE, synchronize positions/states, determine win.

## P0 — Snallygaster AI

- DONE Monster has server-synchronized position/awake state in multiplayer.
- DONE Rescue event can wake threat.
- DONE Shared camp line-of-sight geometry exists.
- DONE Walls block line of sight.
- DONE Closed doors block line of sight.
- DONE Losing line of sight disengages current chase under requested behavior.
- DONE Closing a door while inside can break chase.
- DONE Disengaged monster resets/goes away toward woods state rather than tracking through walls.
- DONE Contact range can end round.
- PARTIAL Monster visual is still a placeholder and must be replaced.
- MISSING Proper Snallygaster model, animation rig, audio, and silhouette.
- MISSING Idle/roam behavior in woods when not chasing.
- MISSING Spawn/re-entry rules so disappearance does not feel like teleport cheating.
- MISSING Noise/investigation state if desired, separate from direct LOS chase.
- MISSING Door interaction rules: whether monster can open/break specific doors must be explicitly designed.
- MISSING Nav/pathing around structures while visible instead of straight-line clipping.
- MISSING Threat audio cues before/while chasing.
- MISSING Difficulty scaling that does not simply increase speed without counterplay.

Backend responsibility: authoritative AI state machine, target selection, LOS, movement, hit/catch validation, wake/disengage transitions, broadcast snapshots.

## P0 — Doors and interiors

- DONE Shared door IDs and synchronized open/closed state.
- DONE Server validates player proximity for multiplayer door interaction.
- DONE Closed door participates in Snallygaster visibility blocking.
- PARTIAL Cabin interiors exist in procedural form.
- MISSING Final door animation/audio.
- MISSING Door obstruction handling when a player/prop is in swing path.
- MISSING Locked/special doors only if intentionally designed.
- MISSING Interior collision audit for every room and doorway.

Backend responsibility: authoritative door open/closed state and interaction validation.

## P0 — Interaction system

- DONE Center-screen ray interaction.
- DONE Context prompt.
- DONE Door interaction.
- DONE Dynamic prop pickup/drop.
- PARTIAL Held-prop spring behavior exists.
- MISSING Unified interaction interface for campers, doors, drawers, bus, items, revive, switches.
- MISSING Server validation for shared interactions beyond current doors/campers.
- MISSING Prevent interacting through walls.
- MISSING Interaction priority when multiple targets overlap.
- MISSING Mobile interaction targeting assistance.

Backend responsibility: validate shared-world interactions; reject impossible range/through-wall actions.

## P0 — Physical props

- DONE Dynamic coolers, boxes, basketballs, barrels with Cannon bodies.
- DONE Pick up/drop behavior.
- PARTIAL Decorative high-fidelity models and physical props are still separate in places.
- MISSING Attach imported high-quality visual meshes directly to physical prop roots.
- MISSING Canoe physical interaction if intended.
- MISSING Table/chair/lantern/camp clutter interactions from TurboSquid pack where appropriate.
- MISSING Consistent mass, friction, bounce, carry distance, throw/use behavior.
- MISSING Multiplayer synchronization for movable props if other players must see the same physics.
- MISSING Ownership/server reconciliation strategy for networked physics props.

Backend responsibility: if physical props are shared gameplay objects, server must own or arbitrate transforms; otherwise desync is guaranteed.

## P0 — Inventory and equipment

- PARTIAL Flashlight exists.
- DONE Flashlight toggle input exists.
- MISSING Real inventory slots/held-item state.
- MISSING Item pickup/drop/use lifecycle integrated with inventory.
- MISSING Radio/walkie-talkie gameplay.
- MISSING Map behavior.
- PARTIAL Scan/right-click input exists but needs meaningful gameplay implementation.
- MISSING Director-desk rare weapon spawn if the optional Desert Eagle design remains in scope.
- MISSING Ammo/reload/use rules if weapon remains in scope.
- MISSING Item UI appropriate for desktop and touch.
- MISSING No stamina bar per current design direction; movement remains intentionally faster than Lethal Company rather than copying its stamina system.

Backend responsibility: shared item spawn state, ownership, pickup arbitration, ammo/consumable state where relevant.

## P0 — Health/downed/revive

- MISSING Player health/damage model beyond instant monster catch.
- MISSING Downed state if revive remains in scope.
- MISSING Revive interaction/progress and interruption.
- MISSING Spectator/death state.
- MISSING Team wipe handling.
- MISSING Rejoin behavior for dead/downed players.

Backend responsibility: authoritative health/downed/dead state and revive validation.

## P0 — Round flow

- DONE Lobby phase.
- DONE Active phase.
- DONE Won/lost phases.
- DONE Host starts round.
- DONE Camper extraction produces win.
- DONE Snallygaster catch can produce loss.
- MISSING Round reset/rematch without refreshing the whole page.
- MISSING Return-to-lobby flow after round.
- MISSING Randomized camper hiding positions.
- MISSING Night progression/timer if retained from original design.
- MISSING Extraction departure sequence/bus departure if desired.
- MISSING End-of-round summary.

Backend responsibility: phase transitions, seed/randomization, win/loss truth, reset/rematch.

## P0 — Pause/menu/settings

- DONE Top-right menu exists.
- DONE Return to Camp/resume.
- DONE Key bindings panel.
- DONE Return to Main Menu.
- DONE Escape opens pause menu.
- MISSING Audio sliders.
- MISSING Look sensitivity.
- MISSING graphics quality/mobile performance setting.
- MISSING key rebinding rather than explanation only.
- MISSING touch-layout customization.

Backend responsibility: none, except leaving room cleanly when returning to main menu.

## P0 — Multiplayer state model

Current backend model:
- Node + Express + ws.
- In-memory room registry.
- Up to 15 players.
- Server owns room host/roster.
- Server owns camper state.
- Server owns door state.
- Server owns Snallygaster state.
- Clients currently send player poses; server sanitizes bounds and rebroadcasts snapshots.

Required production additions:
- MISSING Protocol version field and compatibility check.
- MISSING Sequence/tick numbers on snapshots.
- MISSING Server-side movement speed validation.
- MISSING Rate limiting/message-size limits.
- MISSING Per-client heartbeat/timeout.
- MISSING Reconnection token/session restoration.
- MISSING Snapshot interpolation buffer on clients.
- MISSING Server tick metrics and lag detection.
- MISSING Backpressure protection for slow clients.
- MISSING Shared prop state if physics props become multiplayer-authoritative.
- MISSING Room seed and deterministic round setup.

## P0 — Public hosting

Required final topology:

1. Static browser client may live on GitHub Pages or same Node host.
2. Persistent Node WebSocket service runs on Replit/Render/Fly/Railway/etc.
3. Browser build receives VITE_SERVER_URL for that exact deployed service.
4. HTTPS service exposes /healthz and /api/status.
5. WSS service exposes /ws.
6. CI performs a post-deploy external check against the public HTTPS URL.
7. CI opens WSS and sends create-room message.
8. CI must receive welcome with roomCode, playerId, hostId, maxPlayers=15.
9. Only after those checks pass should client deployment be considered multiplayer-ready.

Current status: BLOCKED until the external public WSS handshake is proven. Local smoke is not sufficient.

## P1 — Proximity communication

- MISSING Browser voice chat if the Lethal Company-style social experience is a goal.
- MISSING WebRTC peer negotiation or SFU strategy.
- MISSING Proximity attenuation/occlusion.
- MISSING Push-to-talk/mute/device selector.
- MISSING Text fallback/ping system.

Backend responsibility: signaling server for WebRTC; optionally SFU if peer-to-peer scaling is inadequate for 15 players.

## P1 — Audio

- MISSING Footsteps by surface.
- MISSING Door sounds.
- MISSING prop impacts.
- MISSING forest ambience.
- MISSING cabin ambience.
- MISSING bus/mechanical sounds.
- MISSING camper voices.
- MISSING monster idle/chase tells.
- MISSING positional audio mix.
- MISSING music/stingers that preserve horror readability.

Backend responsibility: usually none; shared one-shot events may be broadcast when needed.

## P1 — Atmosphere and horror readability

- PARTIAL Fog/dusk lighting exists.
- MISSING Dynamic ambience/night progression.
- MISSING windows/interior light contrast.
- MISSING weather variants if desired.
- MISSING environmental storytelling props/signage.
- MISSING restrained screen effects that work on mobile.
- MISSING visual/audio tells for monster detection and disengagement.

## P1 — Camp map/content

Required playable spaces from current design direction:
- cabins
- dining hall
- kitchen
- pantry
- bathrooms
- arts/crafts
- maintenance
- director office
- treehouse
- dock
- firepit
- road/bus extraction

Each space needs:
- final visual shell
- collision shell
- doorway/state definitions
- hiding spots
- interaction points
- lighting
- navigation validation
- audio zone
- mobile performance validation

## P1 — Hiding/randomization

- MISSING At least 14 authored hiding spots.
- MISSING Server selects 7 per round.
- MISSING Hiding positions are synchronized to all clients.
- MISSING Selection avoids impossible/blocked spots.
- MISSING Camper placement cannot overlap geometry.

Backend responsibility: seeded random selection and shared camper spawn state.

## P1 — Mobile/iPad first

- DONE Touch movement/look/interact/run/flashlight basics exist.
- MISSING Complete touch mapping for crouch, jump, drop, scan, map, radio, inventory/use.
- MISSING Safe-area handling for iPad/iPhone notches/home indicator.
- MISSING adaptive UI sizing/orientation tests.
- MISSING sustained iPad GPU/memory performance test.
- MISSING touch pickup/interact aim assistance.
- MISSING reconnect handling when mobile browser backgrounds/resumes.

## P1 — Rendering/performance

- DONE mobile DPR reduction.
- DONE desktop/mobile shadow differences.
- MISSING GLTF compression pipeline (Meshopt/Draco where appropriate).
- MISSING KTX2/Basis texture compression.
- MISSING texture-size budgets.
- MISSING draw-call budget.
- MISSING instancing for repeated final trees/props.
- MISSING LOD tiers.
- MISSING asset preloading by gameplay importance.
- MISSING memory budget for Safari/iPad.
- MISSING fallback behavior when optional visual assets fail.

## P1 — Character animation system

- PARTIAL procedural bob/limb swing exists for placeholders.
- MISSING AnimationMixer-driven clips for final characters.
- MISSING idle/walk/run/crouch/downed/revive/use/hold-item states for counselors.
- MISSING camper idle/follow/run/fear/board-bus clips.
- MISSING animation state synchronization derived from velocity/state.
- MISSING animation LOD for distant players.

Backend responsibility: send state/velocity; clients render animation locally rather than streaming bones.

## P1 — Player avatars

- PARTIAL remote counselor humanoids exist.
- MISSING final clothed counselor models matching 1990s camp aesthetic.
- MISSING visual variation per player.
- MISSING held-item attachment points.
- MISSING crouch/run animation.
- MISSING nameplates only where appropriate.

## P1 — Security/robustness

- PARTIAL incoming poses are finite/clamped.
- MISSING strict schema validation for every message.
- MISSING max message size.
- MISSING per-IP/per-socket rate limiting.
- MISSING room-code brute-force mitigation if needed.
- MISSING server movement validation.
- MISSING malformed-state fuzz tests.
- MISSING graceful shutdown and room cleanup.
- MISSING crash monitoring.

## P1 — Testing gates

Existing automated gates:
- typecheck
- movement/keybind contract
- high-speed collision contract
- Snallygaster LOS/disengage contract
- clothed camper contract
- production Vite build
- compiled entry check
- 15-player local multiplayer smoke
- local production HTTP/WSS smoke

Still required:
- MISSING real browser E2E test (desktop Chromium).
- MISSING iPad Safari manual/device test.
- MISSING phone Safari/Chrome test.
- MISSING two-browser public internet multiplayer test.
- MISSING external post-deploy /healthz test.
- MISSING external WSS create/join/start handshake test.
- MISSING reconnect/background-resume test.
- MISSING 15-player sustained soak test.
- MISSING asset-load failure/no-white-screen test.
- MISSING camper boarding visual test.
- MISSING closed-door monster disengage integration test in actual round.

## P2 — Lethal Company-style social/extraction depth

These features are not required for the first technically functional build, but are important if the goal is to approach the social tension and replayability of the genre:
- proximity voice chat
- randomized round layout/content
- meaningful item economy or mission scoring
- multiple threat types with different counterplay
- risk/reward decisions about staying out longer
- environmental hazards
- equipment progression
- persistent unlocks/cosmetics if desired
- stronger sound-driven information
- team separation/reunification pressure
- escalating night/threat pressure
- multiple extraction outcomes

These should be original Camp Snallygaster systems, not copied proprietary implementations.

## Release definition

Do not call Camp Snallygaster "multiplayer-ready" until all of these are true:
1. public HTTPS health check passes;
2. public WSS /ws handshake passes;
3. public create-room returns a room code;
4. second external browser can join that code;
5. both players can start and enter the same round;
6. movement sync works across those browsers;
7. doors/campers/Snallygaster state agree on both browsers;
8. one browser can disconnect/reconnect or fail gracefully;
9. campers are clothed, human-looking, correctly scaled, and not nude base bodies;
10. no player can walk through primary walls at authored movement speeds;
11. closing a door/breaking LOS stops Snallygaster chase as designed;
12. all seven campers visibly board the bus before win completion;
13. production browser does not white-screen if an optional model fails to load.

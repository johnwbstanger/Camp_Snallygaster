# Camp Snallygaster — Gated Build Order

This document is the engineering order for growing the game without breaking the verified browser/multiplayer backbone. Every phase must pass its acceptance gate before the next phase begins.

## Phase 0 — Stable baseline (complete)

- Menu loads before heavy 3D runtime.
- Solo mode loads the current camp.
- Production client builds to compiled assets.
- Static GitHub Pages branch publishes from `gh-pages`.
- Multiplayer uses a separate Node/WebSocket runtime.
- CI verifies production HTML/assets and WebSocket behavior.

Acceptance gate: build/typecheck/production smoke all green.

## Phase 1 — Multiplayer lobby for 15 players (complete in source; deploy/field-test next)

- Room capacity is 15.
- Lobby protocol exposes `maxPlayers`.
- Lobby shows current players / 15.
- 15 spawn slots are distributed around the starting area.
- Mobile clients get longer WebSocket cold-start tolerance.
- CI connects 15 clients to the same camp, rejects a 16th, starts the round, and verifies movement/rescue/threat synchronization.

Acceptance gate: 15-client smoke test green, then real-device test with multiple browsers/devices.

## Phase 2 — Movement and physics parity

Port only the good movement ideas from the archived build; do not restore its networking.

- First-person acceleration/deceleration tuning.
- Reliable crouch state.
- Hold-to-sprint without sticky state.
- Ground snapping and slope behavior.
- Autostep for cabin thresholds/porches.
- Carrying movement penalty later, after basic movement is proven.
- Touch controls remain equivalent to desktop controls.
- Add input-state regression tests where practical.

Acceptance gate: desktop + iPhone + iPad can move, sprint, crouch, look, interact, and recover from tab backgrounding without lockups.

## Phase 3 — Expand map topology before visual polish

Increase scale before spending time on detailed assets.

Target structure:

- Central lodge/dining hall.
- Two cabin clusters.
- Arts & crafts cabin.
- Bathhouse.
- Director/office cabin.
- Maintenance shed.
- Bus loop / parking area.
- Firepit/amphitheater.
- Trail network and wooded perimeter.
- Optional lake/creek zone once performance budget is known.

Rules:

- Expand world bounds deliberately.
- Keep colliders simple even when meshes become detailed.
- Use landmarks and sightlines so players can navigate socially without relying on a minimap.

Acceptance gate: 15 clients can traverse the expanded map while physics and movement remain stable.

## Phase 4 — Visual recovery pass: environment

Recover the strongest ideas from archived iterations while keeping the new backbone.

First batch:

- Pitched cabin roofs.
- Porch geometry.
- Cabin signs.
- Better bus silhouette and windows/wheels.
- Denser instanced tree perimeter.
- Firepit.
- Better fog/lighting palette.

Second batch:

- Picnic tables.
- Coolers.
- Camp trunks/duffels.
- Lanterns.
- Benches.
- Canoes/paddles if a water zone is added.
- Bulletin boards.
- Trash cans.
- Camp flags/pennants.
- Trail signs.
- Supply crates.

Art direction:

- Late-80s / early-90s outdoor-catalog nostalgia.
- REI/co-op inspired greens, mustard, orange, cream, faded red, teal.
- Campy and playful, not sterile realism.
- Detailed silhouettes and materials without overloading mobile GPUs.

Technical rules:

- Prefer GLB/GLTF for authored assets.
- Use instancing for repeated trees/rocks/benches.
- Use texture atlases where practical.
- Keep collision meshes separate and simple.
- Add assets in small batches with performance checks after each batch.

Acceptance gate: no startup regression, no major frame-time regression on iPad/iPhone, and multiplayer remains green.

## Phase 5 — Interaction system

Bring back interaction richness only after movement/map stability.

- Raycast-based center-screen interaction.
- Doors.
- Drawers/cabin props.
- Camper interaction prompts.
- Pick-up/drop framework.
- Shared server-authoritative interaction state where gameplay-relevant.

Acceptance gate: two or more clients see the same door/object state and cannot desynchronize it.

## Phase 6 — Core friendslop loop

- Hidden campers.
- Follow/carry behavior.
- Bus extraction.
- Monster wake/chase escalation.
- Round timer / dusk progression.
- Revive/downed state.
- Simple radio/ping callouts.
- Goofy cooperative failure states and recovery opportunities.

Design target: readable chaos, funny mistakes, quick social coordination, and stories players retell after the round.

Acceptance gate: full round can be completed by a group; all critical state is server-authoritative.

## Phase 7 — UI / sound / camp personality

- Retro field-guide/lodge signage UI.
- Lobby identity/roles.
- Camp counselor names/badges.
- Analog radio sounds.
- Distant camp noises.
- Monster audio tells.
- Context-sensitive goofy callouts.
- Loading/status UI that always reports what is happening instead of showing a blank page.

Acceptance gate: all UI works with mouse, touch, safe areas, portrait-to-landscape browser behavior, and reconnect/error states.

## Phase 8 — Asset quality pass

Replace placeholder geometry with authored art in priority order:

1. Buildings.
2. Hero props (bus, firepit, coolers, camp signs).
3. Player/camper models.
4. Monster.
5. Foliage/rocks/ground dressing.
6. Small clutter.

No asset batch merges unless its LOD/draw-call/texture-memory cost is understood.

## Phase 9 — Networking and scale hardening

Current 15-player rooms are suitable for MVP playtests, but enterprise scale requires additional architecture.

- Authoritative movement validation.
- Interest management / relevance filtering.
- Snapshot compression and delta updates.
- Fixed server tick rate separated from render frame rate.
- Reconnect/session-resume support.
- Rate limiting and malformed-message protection.
- Room lifecycle/idle cleanup.
- Structured server metrics.
- Load test many rooms concurrently, not just one 15-player room.
- Move room state to a horizontally scalable architecture before expecting large production concurrency.

Acceptance gate: repeatable load test target established and met with latency/error budgets.

## Phase 10 — Production quality

- Browser compatibility matrix.
- Automated desktop/mobile smoke runs where possible.
- Crash/error telemetry.
- Performance telemetry.
- Asset CDN/cache policy.
- Version/build identifier visible in diagnostics.
- Staged releases instead of editing production directly.
- Rollback procedure tested.

## Non-negotiable engineering rules

1. Solo mode is never intentionally broken to add multiplayer.
2. `main` stays green.
3. New systems are developed on focused branches and merged only after CI passes.
4. Do not restore archived networking wholesale.
5. Gameplay-critical shared state belongs on the server.
6. Visual fidelity can increase only within the mobile performance budget.
7. Every major feature gets a smoke test or explicit manual acceptance checklist.
8. Optimize architecture first; micro-optimization comes after measurement.
9. The game should remain fun and readable before it becomes visually expensive.
10. When a layer fails, fix that layer instead of adding more systems above it.

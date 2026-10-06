# Camp Snallygaster – Roadmap

## Architecture Migration Phases

### ✅ PHASE 0: Base Project (COMPLETE)
- TypeScript, Three.js, Vite, Node, Rapier 3D
- Initial project structure
- README and basic documentation

### 🔄 PHASE 1: Colyseus Rooms & Lobby (IN PROGRESS)
- [ ] Integrate Colyseus server and client
- [ ] Define typed room state schema
- [ ] Lobby UI (CREATE / JOIN room)
- [ ] Room code generation (PINE-47 format)
- [ ] Counselor roster display
- [ ] Host-only START button
- [ ] Max 1–6 players per room
- [ ] Environment-based endpoints (.env)
- [ ] Server ticks (30–60 Hz gameplay, 15–30 Hz snapshots)
- [ ] Commit: "Phase 1: Colyseus rooms, lobby, and environment config"

### 🔄 PHASE 2: Prediction, Interpolation, Reconnection
- [ ] Client-side prediction for local player
- [ ] Smooth reconciliation (no teleporting)
- [ ] Remote player interpolation buffer
- [ ] Session token reconnection
- [ ] Restored inventory/gun/camper state on rejoin
- [ ] Background app handling (iPad)
- [ ] Commit: "Phase 2: Client prediction, interpolation, and reconnection"

### 🔄 PHASE 3: Server-Side Rapier Physics
- [ ] Server Rapier world with fixed 60 Hz accumulator
- [ ] Player capsule controller (server-authoritative)
- [ ] Acceleration, deceleration, gravity, steps, slopes
- [ ] Sprint/crouch stamina on server
- [ ] Wall, door, furniture collisions
- [ ] Bus collision zone
- [ ] Monster physical body (collides with walls/doors/furniture)
- [ ] Door physics (joint rotation, blocked state)
- [ ] Pathfinding for monster (simple A* or waypoint-based)
- [ ] Hitscan firing with Rapier ray queries
- [ ] Projectile impulses on light props
- [ ] Commit: "Phase 3: Server Rapier physics, movement, and collisions"

### 🔄 PHASE 4: Friendslop Physics & Interactables
- [ ] Dynamic props (chairs, basketballs, crates, trash cans, etc.)
- [ ] Collision impulse thresholds → NOISE_EVENT server events
- [ ] Monster noise investigation
- [ ] Grab/hold system (small props, spring forces, throwable)
- [ ] Props cannot tunnel through walls
- [ ] Campers as non-physics AI with obstacle avoidance
- [ ] Carry socket attachment
- [ ] Downed player crawl/revive mechanics
- [ ] Network sync categories (A/B/C frequency)
- [ ] Commit: "Phase 4: Physics props, grab system, and noise events"

### 🔄 PHASE 5: Mobile, PWA, Deploy
- [ ] Mobile Safari safe areas and viewport handling
- [ ] Touch control optimization
- [ ] Orientation change handling
- [ ] WebAudio resume gesture
- [ ] Quality modes (weaker device fallback)
- [ ] PWA manifest and service worker
- [ ] Offline caching (static assets only)
- [ ] Dockerfile and deploy docs
- [ ] HTTPS + WSS production config
- [ ] Commit: "Phase 5: Mobile support, PWA, and deployment"

### ⏳ PHASE 6: Testing & Polish
- [ ] Vitest setup
- [ ] Unit tests: room code, movement, noise thresholds, logic
- [ ] Integration tests: reconnection, camper follow/carry
- [ ] E2E tests: multi-client session
- [ ] Bug fixes and performance tuning
- [ ] Documentation updates
- [ ] Commit: "Phase 6: Tests, polish, and documentation"

## Deployment Target

- **Primary:** Browser (all modern platforms)
- **Hosting:** Render, Fly.io, or Railway (Docker)
- **URLs:** Single origin, HTTPS/WSS
- **Latency Target:** <100ms round-trip (good for 1–6 player co-op)

## Success Criteria

✅ **Build passes:** `npm install && npm run build` with no errors or warnings
✅ **Multiplayer works:** 2+ browser tabs, create room → join by code → play → reconnect
✅ **Monster AI:** Reacts to noise, respects walls/doors, can be killed
✅ **Physics:** Props collide, player doesn't tunnel, server-authoritative movement
✅ **Mobile:** Touch controls, safe areas, portrait + landscape
✅ **Deployment:** Single command to deploy to cloud (Docker)

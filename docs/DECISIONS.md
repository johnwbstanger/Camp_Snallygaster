# Camp Snallygaster – Architecture Decisions

## Decision Log

### Phase 1: Colyseus Adoption

**Decision:** Replace raw `ws` protocol with Colyseus for room-based multiplayer.

**Rationale:**
- Type-safe schema with automatic client-server sync
- Built-in room management and matchmaking
- Session tokens for reconnection
- Significantly less boilerplate than raw WebSocket
- Battle-tested in production multiplayer games

**Tradeoff:** Additional dependency, but solves core infrastructure problem elegantly.

---

### Physics Engine: Rapier (Server-Side)

**Decision:** Move physics authority to server (Phase 3). Client runs local Rapier for prediction only.

**Rationale:**
- Prevents cheating (position/velocity spoofing)
- Consistent collision detection across all clients
- Clear authority model (server owns truth)
- Rapier is WASM-based, fast enough for 60 Hz server tick on modest hardware
- Works well with Colyseus snapshots

**Tradeoff:** Server-side physics = higher compute cost, but 1–6 players per room = acceptable.

---

### Interpolation Strategy

**Decision:** Client interpolation buffer for remote players; local player uses prediction + reconciliation.

**Rationale:**
- Remote players: fixed ~100ms delay between server snapshots, smooth interpolation hides it
- Local player: predict immediately, snap only on large server corrections
- Minimizes perceived latency for the player doing actions

**Tradeoff:** Slight desynchronization on very high-latency connections (>200ms), but acceptable for co-op.

---

### Camper AI: Server-Side, No Physics

**Decision:** Campers are not Rapier physics objects. Server-owned AI with capsule colliders for obstacle avoidance.

**Rationale:**
- Avoids ragdoll complexity
- Predictable behavior (no physics bugs)
- Easy to network (small delta syncs)
- Can be carried without physics parent-child complexity

**Tradeoff:** No physics interactions with campers (cannot be pushed by props). Acceptable trade.

---

### Props & Friendslop Physics

**Decision:** Selective physics for props. Only some props are dynamic, categorized by sync frequency.

**Rationale:**
- Performance: not every object needs full Rapier simulation
- Network: A-category (critical) frequent sync, B-category (props) reduced sync, C-category (cosmetic) client-only
- Emergent fun: knocked-over chairs, rolling carts create NOISE_EVENTS

**Tradeoff:** Slightly more complex categorization, but necessary for performance on mobile.

---

### Handgun Spawn Mechanics

**Decision:** 35% spawn rate, invisible until drawer is opened, server-determined per round.

**Rationale:**
- Asymmetric power shift (not guaranteed)
- Discovery feels rewarding
- Scarcity of ammo = interesting decisions
- Prevents balance issues (gun always available)

**Tradeoff:** Some rounds feel different. Accepted as intentional design.

---

### Deployment Model: Single-Origin HTTPS/WSS

**Decision:** Express server serves both client assets and Colyseus rooms from one origin.

**Rationale:**
- Simplest deployment model
- No CORS issues
- WSS works naturally behind reverse proxy
- Scales easily to Render/Fly.io

**Tradeoff:** Slightly more complex Node server, but industry standard.

---

## Known Issues & Mitigations

### Issue: WebGL Context Loss on Mobile Safari
**Mitigation:** Listen to context-loss event, pause game, show reconnect prompt. Not fully implemented yet (Phase 5).

### Issue: Pointer Lock on iOS
**Mitigation:** Use pointer events and touch look zone instead. Fully implemented in Input.ts.

### Issue: Long Session Memory Leaks
**Mitigation:** Implement proper cleanup in Colyseus room onLeave, camera/renderer teardown. To be validated in Phase 2.

### Issue: Network Congestion on Large Updates
**Mitigation:** Colyseus filtering + snapshot compression. Default ~30 Hz snapshot rate should be safe.

---

## Performance Targets

- **Client:** 60 FPS on iPad Air 2 (2014)
- **Server:** 60 Hz physics tick, 30 Hz snapshots, 6 concurrent rooms
- **Network:** <100ms typical round-trip, <500ms buffer for interpolation
- **Bundle:** <800 KB gzipped (Three.js + Rapier WASM)

---

## Completed Items

✅ Project structure initialized
✅ TypeScript config
✅ Three.js scene and rendering
✅ Rapier 3D (client-side in initial build)
✅ Input handling (desktop + mobile)
✅ Camp world geometry (buildings, props, trees)
✅ Remote player meshes
✅ Camper meshes
✅ Monster mesh
✅ Gun mesh (first-person and world)
✅ Basic HUD
✅ Flashlight system
✅ Dynamic props with physics
✅ Door interaction
✅ Game Design Document
✅ Roadmap

---

## In Progress

🔄 Phase 1: Colyseus integration

---

## To Do

⏳ Phase 2: Prediction & Reconnection
⏳ Phase 3: Server Rapier
⏳ Phase 4: Props & Noise Events
⏳ Phase 5: Mobile & PWA
⏳ Phase 6: Tests & Polish

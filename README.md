# Camp Snallygaster

Browser-first cooperative horror game set at a 1993 summer camp.

## Stable rebuild baseline

`main` was rebuilt from the smallest reliable browser runtime and verified layer-by-layer before promotion. The pre-rebuild project is preserved at `archive/pre-clean-rebuild-2026-10-08`.

The current MVP deliberately prioritizes loading, controls, physics, cross-play, and shared gameplay state before asset-heavy polish.

### Verified core

- Responsive menu loads before the heavy 3D runtime
- Desktop keyboard/mouse controls
- iPhone/iPad touch movement, look, interact, run, and flashlight controls
- Three.js WebGL renderer with reduced mobile DPR, antialiasing, and shadows
- Cannon-es local player/environment physics
- Camp environment with cabins, dining hall, bath house, arts cabin, director cabin, road, bus, and tree perimeter
- Solo rescue loop with seven campers, extraction bus, flashlight, stamina, monster chase, win/loss states
- WebSocket multiplayer room creation and join codes
- Host lobby and synchronized roster
- Cross-device player transform synchronization
- Server-authoritative camper rescue state
- Server-authoritative monster position/threat state
- Shared win/loss round state
- Production Node server serves both the compiled browser client and `/ws` from one origin
- Production HTML is not cached across deployments; hashed assets are immutable

## Architecture

```text
Browser (desktop / iPhone / iPad)
        |
        | HTTPS + WSS, same origin
        v
Node / Express / ws
        |
        +-- compiled Vite client
        +-- /ws multiplayer rooms
        +-- /healthz
        +-- /api/status
```

The menu shell is intentionally small. Three.js and Cannon are dynamically imported only when a player enters a round so mobile browsers can display the menu without first parsing the full 3D engine bundle.

## Technology

- TypeScript
- Vite
- Three.js
- cannon-es
- Node.js
- Express
- `ws` WebSockets

The rebuild intentionally does not depend on Colyseus or a custom REST matchmaking hop. Room creation, joining, start, movement, interaction, and shared round state use one small WebSocket protocol in `shared/protocol.ts`.

## Development

```bash
npm install
npm run dev
```

Development client: `http://localhost:5173`

Development WebSocket server: `ws://localhost:3001/ws`

## Production

```bash
npm install
npm run build
NODE_ENV=production npm start
```

The production Node process serves `dist/client` and the WebSocket endpoint on the same port. Deployment should therefore use the Node service URL as the game URL rather than GitHub Pages.

A `render.yaml` blueprint is included for a single-service deployment.

## Verification

Every change to `main` runs `.github/workflows/rebuild-verify.yml`.

The workflow must pass:

1. TypeScript typecheck
2. Production Vite build
3. Compiled entry-file check
4. Two-client multiplayer smoke test
   - create camp
   - join camp
   - roster synchronization
   - start round
   - movement synchronization
   - camper rescue synchronization
   - monster/threat synchronization
5. Production server smoke test
   - `/healthz`
   - production `index.html`
   - compiled JS/CSS assets
   - `/ws` connection

This is specifically designed to prevent the earlier failure mode where GitHub reported a successful deploy while browsers received raw `/src/main.ts` or a client with no functioning multiplayer backend.

## Current design direction

The visual target remains late-80s/early-90s outdoor-catalog nostalgia: forest greens, mustard yellow, faded orange, cream paper, analog camp signage, and a polished summer-camp atmosphere. Visual assets should be layered onto this stable baseline without changing the verified networking and startup architecture.

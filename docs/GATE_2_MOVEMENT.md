# Gate 2 — Movement and Physics Parity

This gate is intentionally narrower than a full movement-system rewrite. The working solo path and 15-player lobby remain protected.

## Included

- apply the server-assigned multiplayer spawn pose to each local physics body
- render the full lobby roster in-world immediately when a networked round starts
- preserve the existing Cannon physics runtime rather than reintroducing a second physics engine
- restore crouch on desktop and touch controls
- keep sprint mutually exclusive with crouch
- clear held keys, touch movement, sprint, crouch, and look pointers when the tab/app loses focus
- pause rendering while Safari backgrounds the page and resume safely when visible again
- tune local movement speeds, damping, friction, and solver iterations without changing the networking protocol
- retain the existing solo rescue loop unchanged

## Acceptance criteria

1. TypeScript passes.
2. Production browser build passes.
3. Production HTTP/WebSocket smoke passes.
4. The 15-player multiplayer smoke still passes.
5. All 15 server-assigned spawn positions are unique.
6. The 16th player is still rejected cleanly.
7. No lobby or shared rescue/threat protocol changes are introduced.
8. Solo remains available through the same menu path.

## Deliberately deferred

- switching physics engines
- jumping
- moving platforms
- advanced stair/autostep controller
- map/radio/inventory actions
- visual world expansion

Those belong in later gates after this movement baseline remains green.

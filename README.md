# Camp Snallygaster

**First-Person Cooperative Horror Extraction Game**

Set at a summer camp in 1993, Camp Snallygaster is an online multiplayer hide-and-seek horror game where 2–15 players take the role of camp counselors searching for hidden campers during an emergency evacuation.

## Core Gameplay

- **Search** the camp for 7 hidden campers
- **Listen** for subtle sounds that reveal hiding spots
- **Rescue** campers by getting them to follow or carrying them
- **Evade** the Snallygaster hunting through the camp
- **Extract** all campers back to the evacuation bus

## Features

- ✅ Multiplayer up to 15 players (browsers/iPad/PC/Mac)
- ✅ First-person perspective with full 3D physics
- ✅ 40+ randomized camper hiding spots
- ✅ Dynamic monster AI with perception system
- ✅ Rare handgun discovery mechanic
- ✅ Cooperative follow/carry system
- ✅ Dusk-to-dark environmental escalation
- ✅ Radio communication and pings
- ✅ Flashlight with battery management
- ✅ Player downed/revive mechanics
- ✅ 1993 retro aesthetic (sunflower yellows, neon oranges, REI Co-op vibe)

## Tech Stack

- **Client:** TypeScript, Three.js, Vite
- **Server:** Node.js, Express, WebSockets
- **Physics:** Cannon-es
- **Multiplayer:** Server-authoritative architecture

## Project Structure

```
Camp_Snallygaster/
├── server/              # Server-side game logic
│   ├── index.ts
│   ├── GameServer.ts
│   ├── Campers.ts
│   ├── Monster.ts
│   ├── Items.ts
│   └── Weapons.ts
├── src/                 # Client-side code
│   ├── main.ts
│   ├── style.css
│   ├── game/
│   │   ├── Game.ts
│   │   ├── Input.ts
│   │   ├── World.ts
│   │   ├── Player.ts
│   │   └── Camera.ts
│   ├── rendering/
│   │   ├── Renderer.ts
│   │   └── Materials.ts
│   ├── networking/
│   │   ├── Client.ts
│   │   └── Messages.ts
│   ├── ui/
│   │   ├── HUD.ts
│   │   ├── Lobby.ts
│   │   └── ResultsScreen.ts
│   └── audio/
│       └── AudioManager.ts
└── shared/              # Shared types and protocols
    └── protocol.ts
```

## Development

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build
```

The game will be available at `http://localhost:5173` with WebSocket connection to the game server at `localhost:3000`.

## 1993 Aesthetic

Visual language drawn from authentic 1993 outdoor/camp design:
- Faded yellows and oranges
- Forest greens and teals
- Fleece patterns and geometric designs
- Hand-painted wooden signs
- Analog equipment (walkie-talkies, corded phones)
- No futuristic UI elements

## License

Private project.

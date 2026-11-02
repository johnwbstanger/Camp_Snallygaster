# Cult of Gary — A Blackwood Mystery (1987)

Multiplayer companion web app for the live social deduction game. The Director hosts a PeerJS/WebRTC lobby; players join using a four-letter room code and see private role cards.

## Play
1. Director taps **Create Lobby** and shares the code.
2. At least six players join from their devices.
3. Director taps **Deal Roles**, runs rounds, selects hiders, reads generated stories, manages lanterns, converts players, and ends Town Hall.
4. Players keep their cards private. Detective knows the Sheriff and can investigate at Town Hall; Cult members see their team.

## Deployment
GitHub Settings → Pages → Source **GitHub Actions**. The workflow in `.github/workflows/pages.yml` deploys `main`. All assets load from CDNs, so the host and player devices need internet access. Director must keep the tab open and awake; a refresh loses the game.

## Migration notes
Ported from the uploaded `cult-of-gary.zip`, retaining its single-file HTML/JavaScript game logic, role dealing, story engine, and Director controls. Fixed the incorrect team/role expression, undefined round variable, and protection against converting the Detective. This migration uses public Google Fonts and the pinned PeerJS CDN instead of the ZIP's bundled binary fonts and minified peerjs file. Verify multiplayer networking and house rules before game night.

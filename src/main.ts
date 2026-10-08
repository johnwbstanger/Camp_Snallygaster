import "./style.css";
import type { SharedRoundState } from "../shared/protocol";
import { Game } from "./game/Game";
import { MultiplayerClient, type RoomInfo } from "./networking/Multiplayer";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Missing #app root");

app.innerHTML = `
  <main class="shell">
    <section id="menu" class="menu-card" aria-label="Camp Snallygaster main menu">
      <div class="eyebrow">EMERGENCY EVACUATION • SUMMER 1993</div>
      <h1>CAMP<br/>SNALLYGASTER</h1>
      <p class="lede">Find the campers. Keep the group together. Get everyone back to the bus before the woods wake up.</p>
      <label class="field-label" for="playerName">COUNSELOR NAME</label>
      <input id="playerName" class="field" maxlength="18" value="Counselor" autocomplete="nickname" />
      <button id="playSolo" class="primary">ENTER CAMP SOLO</button>
      <div class="network-row">
        <button id="createCamp">CREATE CAMP</button>
        <button id="showJoin">JOIN CAMP</button>
      </div>
      <div id="joinRow" class="join-row hidden">
        <input id="roomCode" class="field" maxlength="8" placeholder="PINE-42" autocapitalize="characters" />
        <button id="joinCamp">JOIN</button>
      </div>
      <p id="status" class="status">Browser runtime verified. Multiplayer connects when you create or join a camp.</p>
    </section>

    <section id="lobby" class="menu-card lobby-card hidden" aria-label="Camp lobby">
      <div class="eyebrow">CAMP RADIO CHANNEL</div>
      <h2 id="roomTitle">CAMP ----</h2>
      <div id="roster" class="roster"></div>
      <button id="startCamp" class="primary hidden">START EVACUATION</button>
      <p id="lobbyStatus" class="status">Waiting for counselors…</p>
    </section>

    <section id="gameViewport" class="game-viewport hidden" aria-label="Game viewport"></section>
    <button id="exitGame" class="exit hidden" type="button">MENU</button>
  </main>
`;

const menu = document.querySelector<HTMLElement>("#menu")!;
const lobby = document.querySelector<HTMLElement>("#lobby")!;
const viewport = document.querySelector<HTMLDivElement>("#gameViewport")!;
const status = document.querySelector<HTMLElement>("#status")!;
const lobbyStatus = document.querySelector<HTMLElement>("#lobbyStatus")!;
const playButton = document.querySelector<HTMLButtonElement>("#playSolo")!;
const createButton = document.querySelector<HTMLButtonElement>("#createCamp")!;
const showJoinButton = document.querySelector<HTMLButtonElement>("#showJoin")!;
const joinButton = document.querySelector<HTMLButtonElement>("#joinCamp")!;
const joinRow = document.querySelector<HTMLElement>("#joinRow")!;
const nameInput = document.querySelector<HTMLInputElement>("#playerName")!;
const codeInput = document.querySelector<HTMLInputElement>("#roomCode")!;
const startButton = document.querySelector<HTMLButtonElement>("#startCamp")!;
const roomTitle = document.querySelector<HTMLElement>("#roomTitle")!;
const roster = document.querySelector<HTMLElement>("#roster")!;
const exitButton = document.querySelector<HTMLButtonElement>("#exitGame")!;

let game: Game | null = null;
let starting = false;
let multiplayer: MultiplayerClient | null = null;
let room: RoomInfo | null = null;
let latestRound: SharedRoundState | null = null;

function playerName() {
  return nameInput.value.trim().slice(0, 18) || "Counselor";
}

async function launchGame(networked: boolean) {
  if (game || starting) return;
  starting = true;
  try {
    game = new Game(viewport, networked);
    await game.start();
    menu.classList.add("hidden");
    lobby.classList.add("hidden");
    viewport.classList.remove("hidden");
    exitButton.classList.remove("hidden");
    if (networked && multiplayer) {
      game.onPose((pose) => multiplayer?.sendPose(pose));
      game.onInteract(() => multiplayer?.interact());
      if (latestRound) game.setSharedRoundState(latestRound);
    }
    game.resume();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    status.textContent = `Startup failed: ${message}`;
    status.classList.add("error");
    game?.destroy();
    game = null;
    menu.classList.remove("hidden");
  } finally {
    starting = false;
  }
}

function ensureMultiplayer() {
  if (multiplayer) return multiplayer;
  multiplayer = new MultiplayerClient();
  multiplayer.onRoster((nextRoom) => {
    room = nextRoom;
    renderLobby(nextRoom);
  });
  multiplayer.onSnapshot((players) => game?.setRemotePlayers(players, room?.playerId ?? null));
  multiplayer.onRound((state) => {
    latestRound = state;
    game?.setSharedRoundState(state);
  });
  multiplayer.onStart(() => void launchGame(true));
  multiplayer.onError((message) => {
    status.textContent = message;
    lobbyStatus.textContent = message;
  });
  return multiplayer;
}

async function createCamp() {
  setBusy(true, "Creating camp…");
  try {
    room = await ensureMultiplayer().createCamp(playerName());
    showLobby(room);
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "Failed to create camp";
    status.classList.add("error");
  } finally {
    setBusy(false);
  }
}

async function joinCamp() {
  const code = codeInput.value.trim().toUpperCase();
  if (!code) return;
  setBusy(true, "Joining camp…");
  try {
    room = await ensureMultiplayer().joinCamp(code, playerName());
    showLobby(room);
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "Failed to join camp";
    status.classList.add("error");
  } finally {
    setBusy(false);
  }
}

function showLobby(info: RoomInfo) {
  menu.classList.add("hidden");
  lobby.classList.remove("hidden");
  renderLobby(info);
}

function renderLobby(info: RoomInfo) {
  roomTitle.textContent = `CAMP ${info.roomCode}`;
  roster.replaceChildren(...info.players.map((player) => {
    const item = document.createElement("div");
    item.className = "roster-item";
    item.textContent = `${player.name}${player.id === info.hostId ? " • HOST" : ""}`;
    return item;
  }));
  const isHost = info.playerId === info.hostId;
  startButton.classList.toggle("hidden", !isHost);
  lobbyStatus.textContent = isHost ? "Share the camp code, then start when everyone is ready." : "Waiting for the host to start…";
}

function setBusy(busy: boolean, message = "") {
  createButton.disabled = busy;
  joinButton.disabled = busy;
  showJoinButton.disabled = busy;
  if (message) status.textContent = message;
}

function exitToMenu() {
  game?.destroy();
  game = null;
  multiplayer?.close();
  multiplayer = null;
  room = null;
  latestRound = null;
  viewport.replaceChildren();
  viewport.classList.add("hidden");
  exitButton.classList.add("hidden");
  lobby.classList.add("hidden");
  menu.classList.remove("hidden");
  status.classList.remove("error");
  status.textContent = "Ready.";
}

playButton.addEventListener("click", () => void launchGame(false));
createButton.addEventListener("click", () => void createCamp());
showJoinButton.addEventListener("click", () => joinRow.classList.toggle("hidden"));
joinButton.addEventListener("click", () => void joinCamp());
startButton.addEventListener("click", () => multiplayer?.startCamp());
exitButton.addEventListener("click", exitToMenu);
codeInput.addEventListener("input", () => { codeInput.value = codeInput.value.toUpperCase(); });

window.addEventListener("error", (event) => console.error("Unhandled browser error", event.error ?? event.message));
window.addEventListener("unhandledrejection", (event) => console.error("Unhandled promise rejection", event.reason));

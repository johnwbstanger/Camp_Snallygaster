import "./style.css";
import { Game } from "./game/Game";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Missing #app root");

app.innerHTML = `
  <main class="shell">
    <section id="menu" class="menu-card" aria-label="Camp Snallygaster main menu">
      <div class="eyebrow">EMERGENCY EVACUATION • SUMMER 1993</div>
      <h1>CAMP<br/>SNALLYGASTER</h1>
      <p class="lede">Find the campers. Keep the group together. Get everyone back to the bus before the woods wake up.</p>
      <button id="playSolo" class="primary">ENTER CAMP</button>
      <div class="network-row">
        <button id="createCamp" disabled>CREATE CAMP</button>
        <button id="joinCamp" disabled>JOIN CAMP</button>
      </div>
      <p id="status" class="status">Gate 1: local game runtime ready. Multiplayer is added only after this layer is proven.</p>
    </section>
    <section id="gameViewport" class="game-viewport hidden" aria-label="Game viewport"></section>
    <button id="exitGame" class="exit hidden" type="button">MENU</button>
  </main>
`;

const menu = document.querySelector<HTMLElement>("#menu")!;
const viewport = document.querySelector<HTMLDivElement>("#gameViewport")!;
const status = document.querySelector<HTMLElement>("#status")!;
const playButton = document.querySelector<HTMLButtonElement>("#playSolo")!;
const exitButton = document.querySelector<HTMLButtonElement>("#exitGame")!;

let game: Game | null = null;
let starting = false;

async function startSolo() {
  if (starting || game) return;
  starting = true;
  playButton.disabled = true;
  playButton.textContent = "LOADING CAMP…";
  status.textContent = "Starting renderer, physics, environment, and controls…";

  try {
    game = new Game(viewport);
    await game.start();
    menu.classList.add("hidden");
    viewport.classList.remove("hidden");
    exitButton.classList.remove("hidden");
    game.resume();
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : String(error);
    status.textContent = `Startup failed: ${message}`;
    status.classList.add("error");
    game?.destroy();
    game = null;
  } finally {
    starting = false;
    playButton.disabled = false;
    playButton.textContent = "ENTER CAMP";
  }
}

function exitToMenu() {
  game?.destroy();
  game = null;
  viewport.replaceChildren();
  viewport.classList.add("hidden");
  exitButton.classList.add("hidden");
  menu.classList.remove("hidden");
  status.textContent = "Local runtime passed. Ready for another run.";
}

playButton.addEventListener("click", () => void startSolo());
exitButton.addEventListener("click", exitToMenu);

window.addEventListener("error", (event) => {
  console.error("Unhandled browser error", event.error ?? event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled promise rejection", event.reason);
});

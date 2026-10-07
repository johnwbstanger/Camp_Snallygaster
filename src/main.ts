import "./style.css";
import "./ui/lobby.css";
import { LobbyUI } from "./ui/LobbyUI";
import { NetworkManager } from "./networking/NetworkManager";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Camp Snallygaster could not find its application root.");
}

app.innerHTML = `
  <div class="site-shell">
    <div class="intro-card" aria-label="Camp Snallygaster opening title">
      <span class="intro-tracking"></span>
      <p class="intro-mark">SNALLYGASTER<br>RECREATIONAL SERVICES</p>
      <p class="intro-est">EST. 1967 &nbsp;·&nbsp; MARYLAND</p>
      <button class="intro-skip" type="button">SKIP INTRO</button>
    </div>

    <main class="welcome">
      <header class="masthead">
        <a class="service-mark" href="#" aria-label="Camp Snallygaster home">
          <span class="patch-icon" aria-hidden="true">S</span>
          <span>SNALLYGASTER<br>RECREATIONAL SERVICES</span>
        </a>
        <span class="masthead-note">A FRIEND OF THE FOREST SINCE 1967</span>
        <span class="issue-stamp">FIELD EDITION &nbsp;·&nbsp; NO. 08</span>
      </header>

      <section class="hero" aria-labelledby="camp-title">
        <div class="hero-art">
          <svg class="wilderness" viewBox="0 0 1440 760" role="img" aria-label="Illustrated lake, mountains, pine forest, canoe, and a camp cabin at sunset">
            <defs>
              <linearGradient id="sky" x2="0" y2="1">
                <stop stop-color="#d5a574"/>
                <stop offset=".56" stop-color="#e4b477"/>
                <stop offset="1" stop-color="#ebc98e"/>
              </linearGradient>
              <linearGradient id="water" x2="0" y2="1">
                <stop stop-color="#73918a"/>
                <stop offset="1" stop-color="#426b69"/>
              </linearGradient>
              <pattern id="print-grain" width="13" height="13" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="3" r=".8" fill="#f4ddae" opacity=".28"/>
                <circle cx="10" cy="9" r=".65" fill="#263d35" opacity=".16"/>
              </pattern>
            </defs>
            <rect width="1440" height="760" fill="url(#sky)"/>
            <circle cx="1083" cy="178" r="72" fill="#efcf8f" opacity=".88"/>
            <path d="M0 365 172 188l134 146 186-228 248 277 177-187 206 182 153-118 164 160v185H0Z" fill="#75877b"/>
            <path d="m0 405 164-156 131 125 199-242 194 228 176-146 209 179 165-129 202 166v127H0Z" fill="#556f63"/>
            <path d="m426 178 68-91 72 80-38-16-33 30-28-18-24 19Z" fill="#e7d0a2" opacity=".78"/>
            <path d="m842 264 67-77 63 72-35-13-25 16-28-14-24 17Z" fill="#e7d0a2" opacity=".65"/>
            <path d="M0 412c175-32 285 25 446 3 183-26 293-4 445 16 185 25 363-47 549 0v329H0Z" fill="url(#water)"/>
            <path d="M0 430c175-32 285 25 446 3 183-26 293-4 445 16 185 25 363-47 549 0" fill="none" stroke="#e9c987" stroke-width="5" opacity=".7"/>
            <g fill="#d7bd88" opacity=".62">
              <path d="M102 499h198v5H102zM365 550h249v4H365zM782 487h162v4H782zM1065 568h220v5h-220z"/>
              <path d="M170 613h282v3H170zM917 632h251v4H917zM562 690h155v4H562z"/>
            </g>
            <g fill="#304c40">
              <path d="m-30 530 98-254 98 254h-57l77 159H-20l77-159z"/>
              <path d="m119 558 86-224 86 224h-49l69 137H98l69-137z"/>
              <path d="m1180 530 95-248 95 248h-54l74 170h-233l75-170z"/>
              <path d="m1300 564 76-198 76 198h-43l64 145h-190l62-145z"/>
            </g>
            <g fill="#3c5b4b">
              <path d="m1010 471 73-189 74 189h-42l59 125H992l60-125z"/>
              <path d="m331 469 61-158 62 158h-35l50 107H315l49-107z"/>
            </g>
            <g transform="translate(739 356)">
              <path d="M0 92h247v133H0z" fill="#a96745"/>
              <path d="m-25 101 148-98 148 98Z" fill="#704a39"/>
              <path d="m13 91 110-73 111 73Z" fill="#b77a52"/>
              <path d="M30 125h55v63H30zM159 125h55v42h-55z" fill="#e6c27f"/>
              <path d="M104 149h42v76h-42z" fill="#564333"/>
              <path d="M108 155h34M108 162h34" stroke="#d4aa69" stroke-width="4"/>
              <path d="M236 96h34v8h-34zM251 61v36" stroke="#594637" stroke-width="5"/>
              <path d="M252 62h49l-13 18h-36Z" fill="#bd684c"/>
              <path d="M128 13c-14-27 24-28 3-52 35 19-5 31 20 52" fill="none" stroke="#f0d8ad" stroke-width="9" opacity=".6"/>
            </g>
            <g transform="translate(524 617) rotate(-4)">
              <path d="M0 33q91 21 195 0l-20 20q-76 17-155 0Z" fill="#9a543b" stroke="#5a4735" stroke-width="5"/>
              <path d="M41 34 105 2l54 32" fill="#c08a55" stroke="#67503b" stroke-width="4"/>
              <path d="M87 6v43" stroke="#594637" stroke-width="4"/>
            </g>
            <path d="M0 690q159-87 342-11 112 47 230 81H0Zm1440-1q-166-76-327-21-88 31-200 92h527Z" fill="#263e34"/>
            <rect width="1440" height="760" fill="url(#print-grain)" opacity=".58"/>
            <path d="M0 23h1440M0 737h1440" stroke="#f3dfb8" stroke-width="2" opacity=".38"/>
          </svg>
          <div class="art-caption"><span>LAKE SNALLYGASTER</span><span>47° 09' N &nbsp;·&nbsp; 76° 38' W</span></div>
          <span class="art-badge">FRESH AIR<br>GOOD COMPANY</span>
        </div>

        <div class="hero-copy">
          <p class="eyebrow"><span class="sunburst" aria-hidden="true">✳</span> YOUR SUMMER STARTS HERE</p>
          <h1 id="camp-title">Camp<br><em>Snallygaster</em></h1>
          <p class="hero-subtitle">A wilderness experience<br>you'll never forget.</p>
          <a class="duty-button" href="#camp-board">
            <span class="button-star" aria-hidden="true">✳</span>
            REPORT FOR DUTY
            <span class="button-arrow" aria-hidden="true">↗</span>
          </a>
          <p class="hero-footnote">PACK LIGHT. &nbsp; STAY TOGETHER. &nbsp; MIND THE TRAIL SIGNS.</p>
        </div>
        <span class="vertical-note" aria-hidden="true">THE GREAT OUTDOORS ARE CALLING</span>
      </section>

      <section class="camp-board" id="camp-board" aria-labelledby="board-heading">
        <div class="board-heading">
          <div>
            <p class="eyebrow">WELCOME TO YOUR NEW FAVORITE PLACE</p>
            <h2 id="board-heading">The camp office</h2>
          </div>
          <p class="board-intro">Grab a pencil, sign the roster, and see what the woods have in store.</p>
        </div>
        <div class="notice-grid">
          <button class="notice notice-play" data-action="host" type="button">
            <span class="notice-pin" aria-hidden="true"></span>
            <span class="notice-label">FIRST DAY? &nbsp; START HERE</span>
            <span class="notice-title">Report<br>for duty</span>
            <span class="notice-link">START A NEW EXPEDITION <b>↗</b></span>
            <span class="notice-stamp" aria-hidden="true">CAMP<br>SNALLY<br>GASTER</span>
          </button>
          <button class="notice notice-map" data-action="join" type="button">
            <span class="notice-pin" aria-hidden="true"></span>
            <span class="notice-label">YOUR CABIN IS WAITING</span>
            <span class="notice-title">Join your<br>cabin</span>
            <span class="notice-link">ENTER A CAMP CODE <b>↗</b></span>
            <span class="contour-lines" aria-hidden="true"></span>
          </button>
          <article class="notice notice-rules">
            <span class="notice-pin" aria-hidden="true"></span>
            <span class="notice-label">A FEW FRIENDLY REMINDERS</span>
            <ol>
              <li>Take a buddy on every trail.</li>
              <li>Bring a flashlight after sundown.</li>
              <li>Return before the bell rings.</li>
            </ol>
            <span class="rules-signoff">We can't wait to meet you!<br><b>— Camp Snallygaster Staff</b></span>
            <span class="handwritten" aria-hidden="true">P.S. Stay<br>on the trail!</span>
          </article>
        </div>
      </section>
      <footer class="page-footer">
        <span>SNALLYGASTER RECREATIONAL SERVICES</span>
        <span>MARYLAND WILDERNESS &nbsp;·&nbsp; EST. 1967</span>
        <span>GOOD TIMES ARE JUST AROUND THE BEND</span>
      </footer>
    </main>
  </div>
`;

const network = new NetworkManager("");
const lobby = new LobbyUI(app);
let localSessionId = "";

void network.connect();

lobby.setCreateCallback(async (name: string) => {
  const roomId = await network.createRoom(name);
  if (!roomId) {
    lobby.setStatus("create", "Couldn't reach the camp office. Please try again.", true);
    return;
  }

  localSessionId = network.getSessionId() ?? "";
  lobby.setRoomCode(network.getRoomCode() ?? roomId);
  lobby.setStatus("create", "Your camp is ready. Invite your cabinmates!", false);
});

lobby.setJoinCallback(async (roomCode: string, name: string) => {
  const joined = await network.joinRoom(roomCode, name);
  if (!joined) {
    lobby.setStatus("join", "No open camp found for that code.", true);
    return;
  }

  localSessionId = network.getSessionId() ?? "";
  lobby.setStatus("join", "Welcome to camp. Your cabinmates are arriving.", false);
});

lobby.setStartCallback(() => {
  lobby.setStatus("create", "The wilderness expedition is still being prepared.", true);
});

network.onRoomStateChange((state) => {
  if (state.phase !== "LOBBY") return;
  const players = Object.values(state.players ?? {}).map((player: any) => ({
    id: player.id,
    name: player.name,
  }));
  lobby.showRoster(players, state.hostId, localSessionId);
});

document.querySelector(".intro-skip")?.addEventListener("click", () => {
  document.querySelector(".intro-card")?.classList.add("intro-dismissed");
});

window.setTimeout(() => {
  document.querySelector(".intro-card")?.classList.add("intro-dismissed");
}, 2800);

document.querySelectorAll<HTMLButtonElement>("[data-action]").forEach((button) => {
  button.addEventListener("click", () => {
    lobby.show();
    if (button.dataset.action === "join") {
      app.querySelector<HTMLButtonElement>('[data-tab="join"]')?.click();
    }
  });
});

const roomCode = new URLSearchParams(window.location.search).get("room");
if (roomCode) {
  lobby.show();
  app.querySelector<HTMLButtonElement>('[data-tab="join"]')?.click();
  const input = app.querySelector<HTMLInputElement>("#join-code");
  if (input) input.value = roomCode;
}

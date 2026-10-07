export class LobbyUI {
  private container: HTMLElement;
  private onCreateRoom: ((name: string) => Promise<void>) | null = null;
  private onJoinRoom: ((roomId: string, name: string) => Promise<void>) | null = null;
  private onStartGame: (() => void) | null = null;
  private currentRoomId: string | null = null;
  private isHost: boolean = false;
  private localPlayerId: string | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  show() {
    this.container.innerHTML = `
      <div class="lobby-overlay">
        <div class="lobby-panel">
          <div class="lobby-title">CAMP SNALLYGASTER</div>
          <div class="lobby-subtitle">Emergency Evacuation • Summer 1993</div>

          <div class="lobby-tabs">
            <button class="lobby-tab active" data-tab="create">CREATE CAMP</button>
            <button class="lobby-tab" data-tab="join">JOIN CAMP</button>
          </div>

          <div class="lobby-tab-content">
            <div id="create-tab" class="tab-content active">
              <input
                id="create-name"
                type="text"
                placeholder="Your counselor name"
                maxlength="18"
                class="lobby-input"
              />
              <button id="create-btn" class="lobby-btn primary">CREATE CAMP</button>
              <div id="create-status" class="lobby-status"></div>
            </div>

            <div id="join-tab" class="tab-content">
              <input
                id="join-code"
                type="text"
                placeholder="Camp code (e.g., PINE-47)"
                class="lobby-input"
              />
              <input
                id="join-name"
                type="text"
                placeholder="Your counselor name"
                maxlength="18"
                class="lobby-input"
              />
              <button id="join-btn" class="lobby-btn primary">JOIN CAMP</button>
              <div id="join-status" class="lobby-status"></div>
            </div>
          </div>

          <div id="roster" class="lobby-roster hidden">
            <div class="roster-title">COUNSELOR ROSTER</div>
            <div id="roster-list" class="roster-list"></div>
            <button id="start-btn" class="lobby-btn primary hidden">START EVACUATION</button>
          </div>
        </div>
      </div>
    `;

    const roomCode = new URLSearchParams(window.location.search).get("room");
    const codeInput = this.container.querySelector<HTMLInputElement>("#join-code");
    if (roomCode && codeInput) codeInput.value = roomCode;

    this.attachEventListeners();
  }

  private attachEventListeners() {
    // Tab switching
    const tabs = this.container.querySelectorAll(".lobby-tab");
    tabs.forEach((tab) => {
      tab.addEventListener("click", (e) => {
        const target = e.target as HTMLElement;
        const tabName = target.getAttribute("data-tab");
        this.switchTab(tabName!);
      });
    });

    // Create camp
    const createBtn = this.container.querySelector<HTMLButtonElement>("#create-btn");
    createBtn?.addEventListener("click", async () => {
      const name = (this.container.querySelector("#create-name") as HTMLInputElement).value.trim();
      if (name) {
        createBtn.textContent = "Creating...";
        createBtn.disabled = true;
        if (this.onCreateRoom) {
          await this.onCreateRoom(name);
        }
      }
    });

    // Join camp
    const joinBtn = this.container.querySelector<HTMLButtonElement>("#join-btn");
    joinBtn?.addEventListener("click", async () => {
      const code = (this.container.querySelector("#join-code") as HTMLInputElement).value.trim().toUpperCase();
      const name = (this.container.querySelector("#join-name") as HTMLInputElement).value.trim();
      if (code && name) {
        joinBtn.textContent = "Joining...";
        joinBtn.disabled = true;
        if (this.onJoinRoom) {
          await this.onJoinRoom(code, name);
        }
      }
    });

    // Start game
    const startBtn = this.container.querySelector("#start-btn");
    startBtn?.addEventListener("click", () => {
      if (this.onStartGame) {
        this.onStartGame();
      }
    });
  }

  private switchTab(tabName: string) {
    const tabs = this.container.querySelectorAll(".lobby-tab");
    const contents = this.container.querySelectorAll(".tab-content");

    tabs.forEach((tab) => tab.classList.remove("active"));
    contents.forEach((content) => content.classList.remove("active"));

    this.container.querySelector(`[data-tab="${tabName}"]`)?.classList.add("active");
    this.container.querySelector(`#${tabName}-tab`)?.classList.add("active");
  }

  showRoster(players: Array<{ id: string; name: string }>, hostId: string, localPlayerId: string) {
    this.isHost = hostId === localPlayerId;
    this.localPlayerId = localPlayerId;

    const roster = this.container.querySelector("#roster");
    const rosterList = this.container.querySelector("#roster-list");
    const startBtn = this.container.querySelector("#start-btn") as HTMLButtonElement;

    if (roster && rosterList) {
      roster.classList.remove("hidden");
      rosterList.replaceChildren(
        ...players.map((player) => {
          const item = document.createElement("div");
          item.className = `roster-item ${this.isHost && player.id === localPlayerId ? "host" : ""}`;

          const name = document.createElement("div");
          name.className = "roster-name";
          name.textContent = player.name;
          item.append(name);

          if (this.isHost && player.id === localPlayerId) {
            const badge = document.createElement("div");
            badge.className = "roster-badge";
            badge.textContent = "HOST";
            item.append(badge);
          }

          return item;
        }),
      );

      if (startBtn) {
        startBtn.classList.toggle("hidden", !this.isHost);
        startBtn.disabled = players.length < 1;
      }
    }
  }

  setStatus(tab: "create" | "join", message: string, isError: boolean = false) {
    const status = this.container.querySelector(`#${tab}-status`);
    if (status) {
      status.textContent = message;
      status.className = `lobby-status ${isError ? "error" : "success"}`;
    }

    if (isError) {
      const button = this.container.querySelector<HTMLButtonElement>(`#${tab}-btn`);
      if (button) {
        button.disabled = false;
        button.textContent = tab === "create" ? "CREATE CAMP" : "JOIN CAMP";
      }
    }
  }

  setRoomCode(code: string) {
    const status = this.container.querySelector("#create-status");
    if (status) {
      status.innerHTML = `
        <div class="room-code-display">
          <div class="room-code-label">Camp Code</div>
          <div class="room-code">${code}</div>
          <div class="room-code-hint">Share this code with your friends</div>
          <button id="copy-invite-btn" class="lobby-btn" type="button">COPY INVITE LINK</button>
        </div>
      `;

      status.querySelector<HTMLButtonElement>("#copy-invite-btn")?.addEventListener("click", async (event) => {
        const button = event.currentTarget as HTMLButtonElement;
        const invite = new URL(window.location.href);
        invite.searchParams.set("room", code);
        try {
          await navigator.clipboard.writeText(invite.toString());
          button.textContent = "LINK COPIED";
        } catch {
          button.textContent = invite.toString();
        }
      });
    }
  }

  hide() {
    this.container.innerHTML = "";
  }

  setCreateCallback(callback: (name: string) => Promise<void>) {
    this.onCreateRoom = callback;
  }

  setJoinCallback(callback: (roomId: string, name: string) => Promise<void>) {
    this.onJoinRoom = callback;
  }

  setStartCallback(callback: () => void) {
    this.onStartGame = callback;
  }
}

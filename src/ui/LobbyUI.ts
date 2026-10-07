export class LobbyUI {
  private container: HTMLElement;
  private overlay: HTMLDivElement | null = null;
  private onCreateRoom: ((name: string) => Promise<void>) | null = null;
  private onJoinRoom: ((roomId: string, name: string) => Promise<void>) | null = null;
  private onStartGame: (() => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  show() {
    this.overlay?.remove();
    this.overlay = document.createElement("div");
    this.overlay.className = "lobby-overlay";
    this.overlay.innerHTML = `
      <div class="lobby-panel">
        <div class="lobby-title">CAMP SNALLYGASTER</div>
        <div class="lobby-subtitle">Emergency Evacuation • Summer 1993</div>
        <div class="lobby-tabs">
          <button class="lobby-tab active" data-tab="create" type="button">CREATE CAMP</button>
          <button class="lobby-tab" data-tab="join" type="button">JOIN CAMP</button>
        </div>
        <div class="lobby-tab-content">
          <div id="create-tab" class="tab-content active">
            <input id="create-name" type="text" placeholder="Your counselor name" maxlength="18" class="lobby-input" />
            <button id="create-btn" class="lobby-btn primary" type="button">CREATE CAMP</button>
            <div id="create-status" class="lobby-status"></div>
          </div>
          <div id="join-tab" class="tab-content">
            <input id="join-code" type="text" placeholder="Camp code (e.g., PINE-47)" class="lobby-input" autocapitalize="characters" />
            <input id="join-name" type="text" placeholder="Your counselor name" maxlength="18" class="lobby-input" />
            <button id="join-btn" class="lobby-btn primary" type="button">JOIN CAMP</button>
            <div id="join-status" class="lobby-status"></div>
          </div>
        </div>
        <div id="roster" class="lobby-roster hidden">
          <div class="roster-title">COUNSELOR ROSTER</div>
          <div id="roster-list" class="roster-list"></div>
          <button id="start-btn" class="lobby-btn primary hidden" type="button">START EVACUATION</button>
        </div>
      </div>
    `;

    // Overlay the game root; never replace its canvas.
    this.container.appendChild(this.overlay);
    this.attachEventListeners();

    const roomCode = new URLSearchParams(location.search).get("room");
    const codeInput = this.overlay.querySelector<HTMLInputElement>("#join-code");
    if (roomCode && codeInput) {
      codeInput.value = roomCode;
      this.switchTab("join");
    }
  }

  private attachEventListeners() {
    this.overlay?.querySelectorAll(".lobby-tab").forEach((tab) => {
      tab.addEventListener("click", () => this.switchTab((tab as HTMLElement).dataset.tab || "create"));
    });

    const createBtn = this.overlay?.querySelector<HTMLButtonElement>("#create-btn");
    createBtn?.addEventListener("click", async () => {
      const name = this.overlay?.querySelector<HTMLInputElement>("#create-name")?.value.trim() || "";
      if (!name || !this.onCreateRoom) return;
      createBtn.disabled = true;
      createBtn.textContent = "Creating...";
      await this.onCreateRoom(name);
    });

    const joinBtn = this.overlay?.querySelector<HTMLButtonElement>("#join-btn");
    joinBtn?.addEventListener("click", async () => {
      const code = this.overlay?.querySelector<HTMLInputElement>("#join-code")?.value.trim().toUpperCase() || "";
      const name = this.overlay?.querySelector<HTMLInputElement>("#join-name")?.value.trim() || "";
      if (!code || !name || !this.onJoinRoom) return;
      joinBtn.disabled = true;
      joinBtn.textContent = "Joining...";
      await this.onJoinRoom(code, name);
    });

    this.overlay?.querySelector("#start-btn")?.addEventListener("click", () => this.onStartGame?.());
  }

  private switchTab(tabName: string) {
    if (!this.overlay) return;
    this.overlay.querySelectorAll(".lobby-tab").forEach((tab) => tab.classList.toggle("active", (tab as HTMLElement).dataset.tab === tabName));
    this.overlay.querySelectorAll(".tab-content").forEach((content) => content.classList.remove("active"));
    this.overlay.querySelector(`#${tabName}-tab`)?.classList.add("active");
  }

  showRoster(players: Array<{ id: string; name: string }>, hostId: string, localPlayerId: string) {
    if (!this.overlay) return;
    const roster = this.overlay.querySelector("#roster");
    const list = this.overlay.querySelector("#roster-list");
    const start = this.overlay.querySelector<HTMLButtonElement>("#start-btn");
    roster?.classList.remove("hidden");
    if (list) {
      list.replaceChildren(...players.map((player) => {
        const row = document.createElement("div");
        row.className = "roster-item";
        const name = document.createElement("div");
        name.className = "roster-name";
        name.textContent = player.name;
        row.append(name);
        if (player.id === hostId) {
          const badge = document.createElement("div");
          badge.className = "roster-badge";
          badge.textContent = "HOST";
          row.append(badge);
        }
        return row;
      }));
    }
    if (start) start.classList.toggle("hidden", hostId !== localPlayerId);
  }

  setStatus(tab: "create" | "join", message: string, isError = false) {
    const status = this.overlay?.querySelector(`#${tab}-status`);
    if (status) {
      status.textContent = message;
      status.className = `lobby-status ${isError ? "error" : "success"}`;
    }
    if (isError) {
      const button = this.overlay?.querySelector<HTMLButtonElement>(`#${tab}-btn`);
      if (button) {
        button.disabled = false;
        button.textContent = tab === "create" ? "CREATE CAMP" : "JOIN CAMP";
      }
    }
  }

  setRoomCode(code: string) {
    const status = this.overlay?.querySelector("#create-status");
    if (!status) return;
    status.innerHTML = `<div class="room-code-display"><div class="room-code-label">Camp Code</div><div class="room-code"></div><div class="room-code-hint">Share this code with your friends</div></div>`;
    const value = status.querySelector<HTMLElement>(".room-code");
    if (value) value.textContent = code;
  }

  hide() {
    this.overlay?.remove();
    this.overlay = null;
  }

  setCreateCallback(callback: (name: string) => Promise<void>) { this.onCreateRoom = callback; }
  setJoinCallback(callback: (roomId: string, name: string) => Promise<void>) { this.onJoinRoom = callback; }
  setStartCallback(callback: () => void) { this.onStartGame = callback; }
}

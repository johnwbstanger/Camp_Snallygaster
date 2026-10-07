import "./style.css";
import { Game } from "./game/Game";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Camp Snallygaster could not find #app");

app.innerHTML = `
  <div id="gameRoot"></div>
  <div id="hud">
    <div id="topLeft" class="paper-panel">
      <div class="title">CAMP SNALLYGASTER</div>
      <div class="subtitle">EMERGENCY EVACUATION · SUMMER 1993</div>
      <div id="connection">Camp radio online</div>
    </div>
    <div id="topRight" class="paper-panel">
      <div class="label">CAMPERS ACCOUNTED FOR</div>
      <div id="camperCount" class="big-count">0 / 7</div>
    </div>
    <div id="prompt" class="prompt"></div>
    <div id="notice" class="notice"></div>
    <div id="statusBar" class="status-bar">
      <div><span class="label">STAMINA</span><div class="meter"><div id="staminaFill"></div></div></div>
      <div><span class="label">FLASHLIGHT</span><div class="meter"><div id="batteryFill"></div></div></div>
      <div id="carryStatus"></div>
      <div id="weaponStatus" class="hidden"></div>
    </div>
    <div id="mapOverlay" class="map-overlay hidden">
      <div class="map-card">
        <div class="title">CAMP SNALLYGASTER MAP</div>
        <div class="map-grid">
          <span style="left:48%;top:87%">BUS</span><span style="left:48%;top:57%">DIRECTOR</span>
          <span style="left:62%;top:48%">DINING</span><span style="left:29%;top:47%">CABINS</span>
          <span style="left:50%;top:31%">BATH</span><span style="left:65%;top:31%">ARTS</span>
          <span style="left:76%;top:23%">MAINT.</span><span style="left:17%;top:19%">TREEHOUSE</span>
          <span style="left:82%;top:66%">DOCK</span><div id="mapPlayer" class="map-player"></div>
        </div>
        <div class="subtitle">Campers do not appear on the map. Search every hiding place.</div>
      </div>
    </div>
    <div id="roundOverlay" class="round-overlay hidden"><div class="round-card"><div id="roundTitle" class="round-title">EVACUATION COMPLETE</div><div id="roundText"></div></div></div>
    <div id="crosshair">+</div>
  </div>
  <div id="touchControls">
    <div id="moveZone"><div id="joystickBase"><div id="joystickKnob"></div></div></div>
    <div id="lookZone"></div>
    <button id="interactButton" class="touch-btn primary" type="button">USE</button>
    <button id="sprintButton" class="touch-btn" type="button">RUN</button>
    <button id="crouchButton" class="touch-btn small" type="button">CROUCH</button>
    <button id="flashlightButton" class="touch-btn small" type="button">LIGHT</button>
    <button id="radioButton" class="touch-btn small" type="button">RADIO</button>
    <button id="mapButton" class="touch-btn small" type="button">MAP</button>
    <button id="dropButton" class="touch-btn small hidden" type="button">DROP</button>
    <button id="fireButton" class="touch-btn danger hidden" type="button">FIRE</button>
    <button id="reloadButton" class="touch-btn small hidden" type="button">RELOAD</button>
  </div>
`;

const root = document.querySelector<HTMLDivElement>("#gameRoot");
if (!root) throw new Error("Game root was not created");

const game = new Game(root);
void game.start().catch((error) => {
  console.error("Camp Snallygaster failed to start", error);
  const message = error instanceof Error ? error.message : String(error);
  root.innerHTML = `<div style="position:absolute;inset:0;display:grid;place-items:center;padding:24px;background:#16271f;color:#f2e7ce;font:600 16px system-ui;text-align:center"><div><div style="font-size:28px;margin-bottom:12px">Camp radio failure</div><div>${message.replace(/[<>&]/g, "")}</div><div style="margin-top:12px;font-size:13px;opacity:.75">Reload the page. If this persists, check the server/build logs.</div></div></div>`;
});

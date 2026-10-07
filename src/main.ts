import "./style.css";
import "./ui/lobby.css";
import { Game } from "./game/Game";

const app = document.querySelector<HTMLDivElement>("#app")!;

app.innerHTML = `
  <div id="gameRoot"></div>
  <div id="hud">
    <div id="topLeft" class="paper-panel">
      <div class="title">CAMP SNALLYGASTER</div>
      <div class="subtitle">EMERGENCY EVACUATION · SUMMER 1993</div>
      <div id="connection">Connecting to camp radio...</div>
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
          <span style="left:48%;top:87%">BUS</span>
          <span style="left:48%;top:57%">DIRECTOR</span>
          <span style="left:62%;top:48%">DINING</span>
          <span style="left:29%;top:47%">CABINS</span>
          <span style="left:50%;top:31%">BATH</span>
          <span style="left:65%;top:31%">ARTS</span>
          <span style="left:76%;top:23%">MAINT.</span>
          <span style="left:17%;top:19%">TREEHOUSE</span>
          <span style="left:82%;top:66%">DOCK</span>
          <div id="mapPlayer" class="map-player"></div>
        </div>
        <div class="subtitle">Campers do not appear on the map. Search every hiding place.</div>
      </div>
    </div>
    <div id="roundOverlay" class="round-overlay hidden">
      <div class="round-card">
        <div id="roundTitle" class="round-title">EVACUATION COMPLETE</div>
        <div id="roundText"></div>
      </div>
    </div>
    <div id="crosshair">+</div>
  </div>

  <div id="touchControls">
    <div id="moveZone"><div id="joystickBase"><div id="joystickKnob"></div></div></div>
    <div id="lookZone"></div>
    <button id="interactButton" class="touch-btn primary">USE</button>
    <button id="sprintButton" class="touch-btn">RUN</button>
    <button id="crouchButton" class="touch-btn small">CROUCH</button>
    <button id="flashlightButton" class="touch-btn small">LIGHT</button>
    <button id="radioButton" class="touch-btn small">RADIO</button>
    <button id="mapButton" class="touch-btn small">MAP</button>
    <button id="dropButton" class="touch-btn small hidden">DROP</button>
    <button id="fireButton" class="touch-btn danger hidden">FIRE</button>
    <button id="reloadButton" class="touch-btn small hidden">RELOAD</button>
  </div>
`;

const game = new Game(document.querySelector<HTMLDivElement>("#gameRoot")!);
void game.start();

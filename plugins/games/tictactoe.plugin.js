export default {
    command: true,
    usePrefix: true,
    case: ['tictactoe', 'michi', 'ttt', 'tresenraya'],
    description: 'Envia el minijuego interactivo Tic-Tac-Toe (Michi) con diseno plateado original, IA balanceada y 2 Jugadores.',
    category: 'games',
    usage: ['michi'],
    script: async (m, { sock }) => {
        await m.react('wait')

        try {
            const rich = new sock.AIRich()
                .addHtml(`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<style>
* {
  box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}

html, body {
  margin: 0;
  padding: 0;
  width: 100%;
  min-height: 100%;
  background: transparent;
  color: #e4e4e7;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
  overflow: hidden;
  touch-action: manipulation;
}

.wrap {
  width: 100%;
  max-width: 620px;
  margin: auto;
  padding: 7px;
}

.card {
  position: relative;
  overflow: hidden;
  border-radius: 24px;
  background: radial-gradient(circle at 50% 0%, #181920 0%, #0c0d12 100%);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 20px 55px rgba(0, 0, 0, 0.55), inset 0 1px 1px rgba(255, 255, 255, 0.2);
}

.glow {
  position: absolute;
  width: 240px;
  height: 240px;
  left: 50%;
  top: 160px;
  transform: translateX(-50%);
  background: rgba(255, 255, 255, 0.04);
  filter: blur(60px);
  pointer-events: none;
}

.header {
  position: relative;
  z-index: 2;
  padding: 14px 18px 10px 18px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.02);
}

.meta-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 2px;
  color: #71717a;
  text-transform: uppercase;
  margin-bottom: 8px;
}

.title-box {
  text-align: center;
}

.title {
  font-size: 22px;
  font-weight: 900;
  letter-spacing: 1px;
  background: linear-gradient(180deg, #ffffff 0%, #d4d4d8 45%, #71717a 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin: 0 0 3px 0;
  text-transform: uppercase;
}

.subtitle {
  font-size: 8px;
  letter-spacing: 1.5px;
  color: #a1a1aa;
  text-transform: uppercase;
}

.turn-wrap {
  text-align: center;
  margin-top: 8px;
}

.turn-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.15);
  padding: 4px 12px;
  border-radius: 100px;
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.1);
}

.turn-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #e4e4e7;
  box-shadow: 0 0 8px rgba(255, 255, 255, 0.8);
  transition: all 0.2s ease;
}

.turn-text {
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 1px;
  color: #e4e4e7;
  text-transform: uppercase;
}

.main {
  position: relative;
  z-index: 1;
  padding: 12px 14px 14px 14px;
}

.score-board {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}

.score-item {
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  padding: 8px 4px;
  text-align: center;
  transition: all 0.2s ease;
}

.score-item.active {
  border-color: rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.04);
}

.score-label {
  font-size: 7px;
  font-weight: 700;
  letter-spacing: 1px;
  color: #71717a;
  margin-bottom: 2px;
}

.score-val {
  font-size: 15px;
  font-weight: 800;
  background: linear-gradient(180deg, #ffffff 0%, #a1a1aa 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.boardWrap {
  width: 100%;
  max-width: 420px;
  margin: auto;
  padding: 8px;
  border-radius: 18px;
  background: #000;
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.9), 0 8px 24px rgba(0, 0, 0, 0.5);
}

.board {
  width: 100%;
  aspect-ratio: 1;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  gap: 6px;
}

.cell {
  background: radial-gradient(circle at 50% 30%, #1a1b22 0%, #111217 100%);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.08), 0 4px 10px rgba(0, 0, 0, 0.3);
  transition: transform 0.1s ease, border-color 0.2s ease;
}

.cell:active {
  transform: scale(0.97);
}

.cell.win {
  border-color: #ffffff;
  box-shadow: 0 0 14px rgba(255, 255, 255, 0.4), inset 0 0 8px rgba(255, 255, 255, 0.2);
  background: radial-gradient(circle at 50% 30%, #27272a 0%, #18181b 100%);
}

.symbol-x {
  width: 44px;
  height: 44px;
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
}

.symbol-x::before,
.symbol-x::after {
  content: '';
  position: absolute;
  width: 6px;
  height: 40px;
  border-radius: 3px;
  background: linear-gradient(180deg, #ffffff 0%, #d4d4d8 40%, #71717a 100%);
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.4);
}

.symbol-x::before {
  transform: rotate(45deg);
}

.symbol-x::after {
  transform: rotate(-45deg);
}

.symbol-o {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 6px solid #d4d4d8;
  border-top-color: #ffffff;
  border-bottom-color: #71717a;
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.4), inset 0 0 6px rgba(0, 0, 0, 0.6);
}

.controls-bar {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  max-width: 420px;
  margin: 12px auto 0 auto;
}

.btn-action {
  background: linear-gradient(180deg, #27272a 0%, #18181b 100%);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 10px;
  padding: 10px 6px;
  color: #f4f4f5;
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  cursor: pointer;
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.2), 0 4px 14px rgba(0, 0, 0, 0.5);
  text-align: center;
}

.btn-action:active {
  transform: scale(0.98);
}

.footer-tag {
  text-align: center;
  font-size: 8px;
  letter-spacing: 1.5px;
  color: #52525b;
  text-transform: uppercase;
  margin-top: 10px;
}
</style>
</head>
<body>

<div class="wrap">
  <div class="card">
    <div class="glow"></div>

    <div class="header">
      <div class="meta-bar">
        <span>EDICION CORE</span>
        <span>AETHERO</span>
      </div>
      <div class="title-box">
        <h1 class="title">TIC TAC TOE</h1>
        <div class="subtitle">ESTRATEGIA EN CUADRICULA</div>
      </div>
      <div class="turn-wrap">
        <div class="turn-pill">
          <div id="turnDot" class="turn-dot"></div>
          <span id="turnText" class="turn-text">TURNO DE X</span>
        </div>
      </div>
    </div>

    <div class="main">
      <div class="score-board">
        <div id="cardX" class="score-item active">
          <div class="score-label">JUGADOR X</div>
          <div id="scoreX" class="score-val">00</div>
        </div>
        <div id="cardTie" class="score-item">
          <div class="score-label">EMPATES</div>
          <div id="scoreTie" class="score-val">00</div>
        </div>
        <div id="cardO" class="score-item">
          <div id="labelO" class="score-label">BOT O</div>
          <div id="scoreO" class="score-val">00</div>
        </div>
      </div>

      <div class="boardWrap">
        <div id="board" class="board">
          <div class="cell" data-idx="0"></div>
          <div class="cell" data-idx="1"></div>
          <div class="cell" data-idx="2"></div>
          <div class="cell" data-idx="3"></div>
          <div class="cell" data-idx="4"></div>
          <div class="cell" data-idx="5"></div>
          <div class="cell" data-idx="6"></div>
          <div class="cell" data-idx="7"></div>
          <div class="cell" data-idx="8"></div>
        </div>
      </div>

      <div class="controls-bar">
        <button id="btnReset" class="btn-action" type="button">REINICIAR</button>
        <button id="btnMode" class="btn-action" type="button">MODO: VS IA</button>
      </div>

      <div class="footer-tag">PROYECTO AETHERO ENGINE</div>
    </div>
  </div>
</div>

<script>
(function(){
"use strict";

let board = Array(9).fill(null);
let turn = "X";
let isVsAI = true;
let isGameOver = false;
let thinking = false;
let scores = { X: 0, O: 0, TIES: 0 };

try {
  const saved = localStorage.getItem("aethero_ttt_scores_v3");
  if (saved) scores = JSON.parse(saved);
} catch (e) {}

let audioCtx = null;
function getAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function playTone(freq, dur = 0.07, type = "sine", vol = 0.15) {
  try {
    const ctx = getAudio();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(vol, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.02);
  } catch (e) {}
}

const WINS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

function updateScoreboard() {
  document.getElementById("scoreX").textContent = String(scores.X).padStart(2, "0");
  document.getElementById("scoreO").textContent = String(scores.O).padStart(2, "0");
  document.getElementById("scoreTie").textContent = String(scores.TIES).padStart(2, "0");
  try {
    localStorage.setItem("aethero_ttt_scores_v3", JSON.stringify(scores));
  } catch (e) {}
}

function updateTurnIndicator() {
  const turnText = document.getElementById("turnText");
  const turnDot = document.getElementById("turnDot");
  const cardX = document.getElementById("cardX");
  const cardO = document.getElementById("cardO");

  if (isGameOver) return;

  if (thinking) {
    turnText.textContent = "IA PENSANDO...";
    turnDot.style.background = "#60a5fa";
    return;
  }

  turnText.textContent = "TURNO DE " + turn;
  if (turn === "X") {
    turnDot.style.background = "#ffffff";
    cardX.classList.add("active");
    cardO.classList.remove("active");
  } else {
    turnDot.style.background = "#d4d4d8";
    cardO.classList.add("active");
    cardX.classList.remove("active");
  }
}

function checkWinState(b) {
  for (let combo of WINS) {
    const [a, b1, c] = combo;
    if (b[a] && b[a] === b[b1] && b[a] === b[c]) return { winner: b[a], combo };
  }
  if (b.every(cell => cell !== null)) return { winner: "TIE" };
  return null;
}

function minimax(b, depth, isMax) {
  let res = checkWinState(b);
  if (res) {
    if (res.winner === "O") return 10 - depth;
    if (res.winner === "X") return depth - 10;
    if (res.winner === "TIE") return 0;
  }

  if (isMax) {
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (b[i] === null) {
        b[i] = "O";
        best = Math.max(best, minimax(b, depth + 1, false));
        b[i] = null;
      }
    }
    return best;
  } else {
    let best = Infinity;
    for (let i = 0; i < 9; i++) {
      if (b[i] === null) {
        b[i] = "X";
        best = Math.min(best, minimax(b, depth + 1, true));
        b[i] = null;
      }
    }
    return best;
  }
}

function getBestMove() {
  const available = [];
  for (let i = 0; i < 9; i++) {
    if (board[i] === null) available.push(i);
  }

  if (available.length === 0) return -1;

  if (Math.random() < 0.25) {
    return available[Math.floor(Math.random() * available.length)];
  }

  let bestVal = -Infinity;
  let move = -1;
  for (const i of available) {
    board[i] = "O";
    let moveVal = minimax(board, 0, false);
    board[i] = null;
    if (moveVal > bestVal) {
      bestVal = moveVal;
      move = i;
    }
  }
  return move !== -1 ? move : available[0];
}

function makeMove(idx) {
  board[idx] = turn;
  const cell = document.querySelectorAll(".cell")[idx];

  const symbol = document.createElement("div");
  if (turn === "X") {
    symbol.className = "symbol-x";
    playTone(480, 0.06, "triangle");
  } else {
    symbol.className = "symbol-o";
    playTone(360, 0.08, "sine");
  }
  cell.appendChild(symbol);

  const res = checkWinState(board);
  if (res) {
    isGameOver = true;
    if (res.winner === "TIE") {
      scores.TIES++;
      updateScoreboard();
      document.getElementById("turnText").textContent = "EMPATE";
      document.getElementById("cardX").classList.remove("active");
      document.getElementById("cardO").classList.remove("active");
      playTone(220, 0.15, "sawtooth");
    } else {
      scores[res.winner]++;
      updateScoreboard();
      res.combo.forEach(cIdx => {
        document.querySelectorAll(".cell")[cIdx].classList.add("win");
      });
      document.getElementById("turnText").textContent = "VICTORIA DE " + res.winner;
      playTone(523, 0.12);
      setTimeout(() => playTone(659, 0.12), 120);
      setTimeout(() => playTone(784, 0.25), 240);
    }
    return;
  }

  turn = turn === "X" ? "O" : "X";
  updateTurnIndicator();

  if (isVsAI && turn === "O" && !isGameOver) {
    thinking = true;
    updateTurnIndicator();
    setTimeout(() => {
      if (isGameOver) { thinking = false; return; }
      const best = getBestMove();
      thinking = false;
      if (best !== -1) {
        makeMove(best);
      }
    }, 320);
  }
}

function onCellClick(e) {
  const idx = parseInt(e.currentTarget.dataset.idx, 10);
  if (board[idx] !== null || isGameOver || thinking) return;
  if (isVsAI && turn !== "X") return;

  makeMove(idx);
}

function resetBoard() {
  board = Array(9).fill(null);
  isGameOver = false;
  thinking = false;
  turn = "X";
  document.querySelectorAll(".cell").forEach(cell => {
    cell.innerHTML = "";
    cell.classList.remove("win");
  });
  updateTurnIndicator();
  playTone(300, 0.08);
}

document.querySelectorAll(".cell").forEach(cell => {
  cell.addEventListener("click", onCellClick);
});

document.getElementById("btnReset").addEventListener("click", resetBoard);

document.getElementById("btnMode").addEventListener("click", () => {
  isVsAI = !isVsAI;
  document.getElementById("btnMode").textContent = isVsAI ? "MODO: VS IA" : "MODO: 2 JUGADORES";
  document.getElementById("labelO").textContent = isVsAI ? "BOT O" : "JUGADOR O";
  resetBoard();
});

updateScoreboard();
updateTurnIndicator();
})();
</script>
</body>
</html>`, { trustedSources: [] })

            await rich.send(m.chat.id)
            await m.react('done')
        } catch (e) {
            await m.react('error')
            return m.reply('Error al cargar Tic-Tac-Toe: ' + e.message)
        }
    }
}
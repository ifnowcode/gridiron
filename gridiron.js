// gridiron-canvas.js

let aiScheduled = false;
const AI_DELAY = 100; // ms — tune as desired


// ====== CONSTANTS ======
const COLS = 21;   // match WIDTH
const ROWS = 11;   // match HEIGHT
const CELL_SIZE = 40;
const PADDING = 10;

const roundPieces = false;

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("status");
const rollBtn = document.getElementById("rollBtn");
const passBtn = document.getElementById("passBtn");
const restartBtn = document.getElementById("restartBtn");
const autoPlay = document.getElementById("autoPlay");
const formationSelect = document.getElementById("formationSelect");
const difficultySelect = document.getElementById("difficultySelect");
const modeSelect = document.getElementById("modeSelect");
const ballSelect = document.getElementById("ballSelect");

const name = "Gridiron";
let ballEmoji = ballSelect.options[ballSelect.selectedIndex].textContent;
document.title = ballEmoji + " " + name;

// Goals (same semantics as your RED_GOAL / BLUE_GOAL)
let RED_GOAL = { };
let BLUE_GOAL  = { };

// ====== GAME STATE ======
let board = []; // "blue" | "red" | null
let pieces = null;
let ball = null;

let currentPlayer = "blue";
let winner = "";
let rollValue = null;
let roundOver = false;
let blueIsAI = false;     // normal mode: human controls blue
let redIsAI = true;       // normal mode: AI controls red
let aiTimeoutId = null;
let redScore = 0;
let blueScore = 0;

let autoRound = true;
let paused = false;
let step = false;
let showCoords = false;

// drag state
let dragging = null; // { team, index, startR, startC }
let dragPos = null;  // { x, y }

let traceusing=0;
let tracefunction=0;
let traceevent=0;
let tracedebug=0;
let tracelog=0;
let tracewarn=1;
let traceerror=1;
let tracegame=0;

// ====== INIT PIECES (simplified formation) ======
function createPieces(templateName = "diamond") {
  const tpl = PIECE_TEMPLATES[templateName];
  if (!tpl) {
    if (tracewarn) console.warn("WARNING: Unknown template:", templateName, "— using diamond.");
    return createPieces("diamond", COLS, ROWS);
  }

  const setup = tpl(COLS, ROWS);

  return {
    blue: setup.blue.map(p => ({ ...p, alive: true })),
    red:  setup.red.map(p => ({ ...p, alive: true })),
    ball: setup.ball ?? { r: 5, c: (COLS-1)/2, carriedBy: null },
    blue_goal: setup.blue_goal ?? { r: 5, c: 0 },
    red_goal: setup.red_goal ?? { r: 5, c: COLS-1 },
  };
}

function resetBoard() {
  board = [];
  for (let r = 0; r < ROWS; r++) {
    const row = [];
    for (let c = 0; c < COLS; c++) row.push(null);
    board.push(row);
  }
  for (const p of pieces.blue) if (p.alive) board[p.r][p.c] = "blue";
  for (const p of pieces.red)  if (p.alive) board[p.r][p.c] = "red";
}

// ====== COORD HELPERS ======
function cellToPixel(c, r) {
  const x = PADDING + c * CELL_SIZE + CELL_SIZE / 2;
  const y = PADDING + r * CELL_SIZE + CELL_SIZE / 2;
  return { x, y };
}

function pixelToCell(x, y) {
  const c = Math.floor((x - PADDING) / CELL_SIZE);
  const r = Math.floor((y - PADDING) / CELL_SIZE);
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return null;
  return { r, c };
}

// ====== RENDERING ======
function drawBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // field
  ctx.fillStyle = "#064";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // grid
  ctx.strokeStyle = "#0a8";
  ctx.lineWidth = 1;
  for (let r = 0; r <= ROWS; r++) {
    const y = PADDING + r * CELL_SIZE;
    ctx.beginPath();
    ctx.moveTo(PADDING, y);
    ctx.lineTo(PADDING + COLS * CELL_SIZE, y);
    ctx.stroke();
  }
  for (let c = 0; c <= COLS; c++) {
    const x = PADDING + c * CELL_SIZE;
    ctx.beginPath();
    ctx.moveTo(x, PADDING);
    ctx.lineTo(x, PADDING + ROWS * CELL_SIZE);
    ctx.stroke();
  }

  // goals
  if (RED_GOAL.r === BLUE_GOAL.r
      && RED_GOAL.c === BLUE_GOAL.c) {
    drawGoal(BLUE_GOAL, "#000");
  } else {
    drawGoal(BLUE_GOAL, "#33f");
    drawGoal(RED_GOAL, "#f33");
  }
}

function drawCellCoords() {
  ctx.save();
  ctx.font = "10px system-ui";
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = PADDING + c * CELL_SIZE + 2;   // small inset
      const y = PADDING + r * CELL_SIZE + 2;
      ctx.fillText(`${r},${c}`, x, y);
    }
  }

  ctx.restore();
}

function drawGoal(goal, color, emoji='G') {
  const { x, y } = cellToPixel(goal.c, goal.r);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.rect(
    x - CELL_SIZE / 2 + 4,
    y - CELL_SIZE / 2 + 4,
    CELL_SIZE - 8,
    CELL_SIZE - 8
  );
  ctx.stroke();

  ctx.fillStyle = "#fff";
  ctx.font = "16px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, x, y);
  ctx.restore();
}

function drawPiece(p, team) {
  const { x, y } = cellToPixel(p.c, p.r);
  const radius = CELL_SIZE * 0.4;

  ctx.save();
  ctx.beginPath();
  ctx.fillStyle = team === "blue" ? "#3af" : "#f55";
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 2;
  if (roundPieces) {
    ctx.arc(x, y, radius, 0, Math.PI * 2);
  } else {
    ctx.fillRect(x-radius, y-radius, radius*2, radius*2);
  }
  ctx.fill();
  ctx.stroke();

  if (false) {
    ctx.fillStyle = "#fff";
    ctx.font = "16px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(team === "blue" ? "B" : "R", x, y);
    ctx.restore();
  }
}

function drawBall() {
  if (ball.carriedBy) {
    const [team, idxStr] = ball.carriedBy.split("_");
    const idx = parseInt(idxStr, 10);
    const carrier = pieces[team][idx];
    const { x, y } = cellToPixel(carrier.c, carrier.r);
    drawBallAt(x, y, "18");
  } else {
    const { x, y } = cellToPixel(ball.c, ball.r);
    drawBallAt(x, y, "28");
  }
}

function drawBallAt(x, y, size="28") {
  const radius = CELL_SIZE * 0.25;

  // draw piece under ball
  ctx.save();
  if (false) {
    ctx.beginPath();
    ctx.fillStyle = "#ffa500";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    if (roundPieces) {
      ctx.arc(x, y, radius, 0, Math.PI * 2);
    } else {
      ctx.fillRect(x-radius, y-radius, radius*2, radius*2);
    }
    ctx.fill();
    ctx.stroke();
  }

  ctx.font = size + "px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(ballEmoji, x, y);
  ctx.restore();
}

function drawScoreboard1() {
  ctx.save();

  ctx.font = "28px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  // Slight shadow for readability
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillText(`BLUE ${blueScore}   |   ${redScore} RED`, canvas.width / 2 + 2, 6 + 2);

  // Main text
  ctx.fillStyle = "white";
  ctx.fillText(`BLUE ${blueScore}   |   ${redScore} RED`, canvas.width / 2, 6);

  ctx.restore();
}

function drawText(text, x, y, size=28, color="#000") {
  ctx.save();
  
  ctx.font = (size) + "px system-ui";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  
  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillText(`${text}`, x+2, y+2);
  
  // text
  ctx.fillStyle = color;
  ctx.fillText(`${text}`, x, y);
  
  ctx.restore();
}

function drawScoreboard() {
  ctx.save();

  ctx.font = "28px system-ui";
  ctx.textBaseline = "top";

  // --- RED SCORE (left half) ---
  const redX = canvas.width * 0.25;   // center of left half
  const y = 6;

  // shadow
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillText(`${redScore}`, redX + 2, y + 2);

  // main text
  ctx.fillStyle = "#ff5555";
  ctx.fillText(`${redScore}`, redX, y);

  // --- BLUE SCORE (right half) ---
  const blueX = canvas.width * 0.75;  // center of right half

  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillText(`${blueScore}`, blueX + 2, y + 2);

  // main text
  ctx.fillStyle = "#55aaff";
  ctx.fillText(`${blueScore}`, blueX, y);

  ctx.restore();
}


function render() {
  drawBoard();

  // optional toggle
  if (showCoords) {
    drawCellCoords();
  }

  // pieces
  for (const p of pieces.blue) if (p.alive) drawPiece(p, "blue");
  for (const p of pieces.red)  if (p.alive) drawPiece(p, "red");

  // ball
  drawBall();

  // drag ghost
  if (dragging && dragPos) {
    const radius = CELL_SIZE * 0.4;
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.fillStyle = dragging.team === "blue" ? "#3af" : "#f55";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    if (roundPieces) {
      ctx.arc(dragPos.x, dragPos.y, radius, 0, Math.PI * 2);
    } else {
      ctx.fillRect(dragPos.x-radius, dragPos.y-radius, radius*2, radius*2);
    }
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // ⭐ NEW: draw scoreboard last so it overlays cleanly
  drawScoreboard();
  if (roundOver) drawText("Round Over", canvas.width / 2, canvas.height / 4, 68, "#3f3");
  if (roundOver) drawText(winner + " Scores", canvas.width / 2, canvas.height / 1.3, 68, winner === "Red" ? "#f33" : "#34f");
  if (paused) drawText("Paused", canvas.width / 2, canvas.height / 2, 78, "#34f");
}

// ====== TURN / MOVE LOGIC (simplified) ======
function isAI(team) {
  if (autoPlay.checked) return true;   // demo mode: both sides AI

  return team === "blue" ? blueIsAI : redIsAI;
}

function attemptMove(team, index, r, c) {
  return attemptMove_01(team, index, r, c);
}

function attemptMove_00(team, index, r, c) {
  if (roundOver) return;

  const piece = pieces[team][index];
  if (!piece || !piece.alive) return;

  const dist = Math.abs(piece.r - r) + Math.abs(piece.c - c);
  if (rollValue === null || dist !== rollValue) {
    statusEl.textContent = "Must move exactly " + rollValue + " spaces.";
    render();
    return false;
  }

  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return;

  const occupant = board[r][c];

  if (occupant === team) {
    console.log("Hit Self", occupant, team, r, c)
    statusEl.textContent = "Cannot land on your own piece.";
    render();
    return false;
  }

  // simple tackle: remove enemy
  if (occupant && occupant !== team) {
    const enemyTeam = occupant;
    const enemyIndex = pieces[enemyTeam].findIndex(
      p => p.r === r && p.c === c && p.alive
    );
    if (enemyIndex >= 0) {
      pieces[enemyTeam][enemyIndex].alive = false;
    }
  }

  // move piece
  board[piece.r][piece.c] = null;
  piece.r = r;
  piece.c = c;
  board[r][c] = team;

  // ball pickup
  if (!ball.carriedBy && ball.r === r && ball.c === c) {
    ball.carriedBy = team + "_" + index;
  }

  // carry ball
  if (ball.carriedBy === team + "_" + index) {
    ball.r = r;
    ball.c = c;

    const goal = team === "blue" ? BLUE_GOAL : RED_GOAL;
    if (r === goal.r && c === goal.c) {
      statusEl.textContent = team.toUpperCase() + " SCORES!";
      roundOver = true;
      render();
      return true;
    }
  }

  rollValue = null;
  statusEl.textContent = "Turn complete.";
  currentPlayer = currentPlayer === "blue" ? "red" : "blue";
  render();

  if (!roundOver && isAI(currentPlayer)) {
    scheduleAITurn(currentPlayer, difficultySelect.value);
  }

  return true;
}

function attemptMove_01(team, index, r, c) {

  if (tracefunction) console.log("attemptMove", team, index, "{", r, c, "}", pieces[team][index], board[r][c]);

  const piece = pieces[team][index];
  if (!piece || !piece.alive) {
    if (traceerror) console.error("ERROR: Piece is not alive!", piece);
    return false;
  }

  // Check Manhattan distance
  const dist = Math.abs(piece.r - r) + Math.abs(piece.c - c);
  if (dist !== rollValue) {
    if (tracewarn) console.warn("Illegal Distance", dist, "Roll", rollValue, piece.r, r, piece.c, c);
    statusEl.textContent = "Must move exactly " + rollValue + " spaces.";
    render();
    return false;
  }

  const occupant = board[r][c];

  // Tackle logic depends on match mode
  if (occupant && occupant !== team) {
      const enemyTeam = occupant;
      const enemyIndex = pieces[enemyTeam].findIndex(
          p => p.r === r && p.c === c && p.alive
      );

      const enemyIsCarrier = (ball.carriedBy === enemyTeam + "_" + enemyIndex);

      // Detect if this enemy square blocking the goal
      const goal = (team === "blue" ? BLUE_GOAL : RED_GOAL);
      const enemyInGoal = (r === goal.r && c === goal.c);

      // CLASSIC MODE: only the ball carrier can be tackled,
      // EXCEPT if the enemy is blocking the goal
      if (modeSelect.value === "classic") {
          if (!enemyIsCarrier && !enemyInGoal) {
              if (traceerror) console.error("Team:", team, "->", enemyTeam, "enemyIsCarrier", enemyIsCarrier, "enemyInGoal", enemyInGoal, "{", r, c, "}", "{", goal.r, goal.c, "}");
              statusEl.textContent =
                  "In Classic mode, only the ball carrier can be tackled (unless blocking the goal).";
              render();
              return false;
          }
      }

      // If we reach here, tackle is allowed
      if (enemyIsCarrier) {
          ball.carriedBy = team + "_" + index;
      }

      pieces[enemyTeam][enemyIndex].alive = false;
      if (tracelog) console.log("Tackle", r, c, piece);
      board[piece.r][piece.c] = null;
      piece.r = r;
      piece.c = c;
      board[r][c] = team;
  }

  // Normal move
  else if (!occupant) {
    if (tracelog) console.log("Move", team, "{", r, c, "}", piece);
    board[piece.r][piece.c] = null;
    piece.r = r;
    piece.c = c;
    board[r][c] = team;
  } else {
    statusEl.textContent = "Cannot land on your own piece.";
    render();
    console.warn("Cannot land on your own piece.");
    return false;
  }

  // Pick up ball
  if (!ball.carriedBy && ball.r === r && ball.c === c) {
    ball.carriedBy = team + "_" + index;
  }

  // Carry ball
  if (ball.carriedBy === team + "_" + index) {
    ball.r = r;
    ball.c = c;

    if (team === "blue" && r === BLUE_GOAL.r && c === BLUE_GOAL.c) {
      blueScore += 1;
      if (tracegame) console.log("Score - Red:", redScore, " | Blue:", blueScore);
      statusEl.textContent = "BLUE SCORES! You win!";
      roundOver = true;
      winner = "Blue";
      currentPlayer = "red";
      if (autoRound && !paused) setTimeout(newRound, 3000, currentPlayer);
    }
    if (team === "red" && r === RED_GOAL.r && c === RED_GOAL.c) {
      redScore += 1;
      if (tracegame) console.log("Score - Red:", redScore, " | Blue:", blueScore);
      statusEl.textContent = "RED SCORES! AI wins!";
      roundOver = true;
      winner = "Red";
      currentPlayer = "blue";
      if (autoRound && !paused) setTimeout(newRound, 3000, currentPlayer);
    }
  }

  // ------------------------------------------------------------
  // CHECK FOR TEAM ELIMINATION (game ends if no opponents alive)
  // ------------------------------------------------------------
  const blueAlive = pieces.blue.some(p => p.alive);
  const redAlive  = pieces.red.some(p => p.alive);

  if (!blueAlive || !redAlive) {
      roundOver = true;

      if (!blueAlive && redAlive) {
          redScore += 1;
          statusEl.textContent = "RED WINS! All blue players eliminated.";
          winner = "Red";
          currentPlayer = "blue";
          if (autoRound && !paused) setTimeout(newRound, 3000, currentPlayer);
      } else if (!redAlive && blueAlive) {
          blueScore += 1;
          statusEl.textContent = "BLUE WINS! All red players eliminated.";
          winner = "Blue";
          currentPlayer = "red";
          if (autoRound && !paused) setTimeout(newRound, 3000, currentPlayer);
      } else {
          statusEl.textContent = "Both teams eliminated.";
      }

      if (tracegame) console.log("Score - Red:", redScore, " | Blue:", blueScore);

      //render();
      //return true;
  }

  rollValue = null;
  //rollResultEl.textContent = "";
  render();

  if (!roundOver) {
    currentPlayer = (team === "blue") ? "red" : "blue";
    if (isAI(currentPlayer)) {
      statusEl.textContent = currentPlayer.toUpperCase() + "AI thinking...";
      //setTimeout(aiTurn, 400, currentPlayer, difficultySelect.value);
      scheduleAITurn(currentPlayer, difficultySelect.value);
    } else {
      // Human turn
      if (autoRoll.checked) {
        rollValue = Math.floor(Math.random() * 6) + 1;
        //rollResultEl.textContent = "Roll: " + rollValue;
        statusEl.textContent = "Drag a piece to move " + rollValue + " spaces.";
      } else {
        rollValue = null;
        //rollResultEl.textContent = "AM: None";
        statusEl.textContent = "Move: Your turn. (" + currentPlayer + ") Roll the die.";
      }
    }
  }

  if (tracedebug) console.log("End Move", roundOver);
  return true;
}

function aiTurn(team, level="0") {
  if (tracefunction) console.log("aiTurn", team, "at level", level);
  switch(level) {
    case "0":
      return aiTurn_00(team);
    case "1":
      return aiTurn_01(team);
    case "2":
      return aiTurn_02(team);
    case "3":
      return aiTurn_03(team);
    case "4":
      return aiTurn_04(team);
    case "5":
      return aiTurn_05(team);
    default:
      if (tracewarn) console.log("WARNING: AI Turn. Invalid level", level, "defaulting to level 0");
      return aiTurn_01(team);
  }
}

// ====== SIMPLE AI (stub) ======
function aiTurn_00(team) {
  if (tracefunction) console.log("aiTurn_00", team);
  if (roundOver) return;

  // roll
  rollValue = Math.floor(Math.random() * 6) + 1;

  const aiPieces = pieces[team]
    .map((p, i) => ({ p, i }))
    .filter(x => x.p.alive);

  // naive: try random moves until one is legal
  for (let tries = 0; tries < 50; tries++) {
    const { p, i } = aiPieces[Math.floor(Math.random() * aiPieces.length)];
    const dirs = [
      { dr: 1, dc: 0 },
      { dr: -1, dc: 0 },
      { dr: 0, dc: 1 },
      { dr: 0, dc: -1 },
    ];
    const dir = dirs[Math.floor(Math.random() * dirs.length)];
    const r = p.r + dir.dr * rollValue;
    const c = p.c + dir.dc * rollValue;
    const dist = Math.abs(p.r - r) + Math.abs(p.c - c);
    if (dist !== rollValue) continue;
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
    if (attemptMove(team, i, r, c)) return;
  }

  statusEl.textContent = "AI cannot move.";
  console.warn("AI has No Move!", rollValue, team, currentPlayer);
  currentPlayer = (team === "blue") ? "red" : "blue";
  if (isAI(currentPlayer)) {
    statusEl.textContent = currentPlayer.toUpperCase() + " AI thinking...";
    scheduleAITurn(currentPlayer, difficultySelect.value);
  } else if (autoRoll.checked) {
    // Auto-roll mode
    rollValue = Math.floor(Math.random() * 6) + 1;
    //rollResultEl.textContent = "Auto Roll: " + rollValue, "for", team;
    statusEl.textContent = "Drag a piece to move " + rollValue + " spaces.";
  } else {
    // Manual mode
    rollValue = null;
    //rollResultEl.textContent = "None";
    console.log("aiPieces", rollValue, aiPieces);
    statusEl.textContent = "A1:", enemy_team, "turn. Roll the die.";
  }
  return false;
}

// basic first AI created
function aiTurn_01(team) {
  if (tracefunction) console.log("aiTurn_01", team);
  if (roundOver) return;

  let GOAL = team === "red" ? RED_GOAL : BLUE_GOAL;
  let ENEMY_GOAL = team === "red" ? BLUE_GOAL : RED_GOAL;
  let enemy_team = team === "red" ? "blue" : "red";

  rollValue = Math.floor(Math.random() * 6) + 1;
  //rollResultEl.textContent = "AI1 Roll: " + rollValue + " for " + team;

  let aiPieces = pieces[team]
    .map((p, i) => ({ p, i }))
    .filter(x => x.p.alive);

  // Decide target: ball if loose, goal if AI carries it
  let targetR = ball.r;
  let targetC = ball.c;

  // If AI has the ball, only the carrier moves
  if (ball.carriedBy && ball.carriedBy.startsWith(team + "_")) {
    const [_, idxStr] = ball.carriedBy.split("_");
    const carrierIndex = parseInt(idxStr, 10);

    aiPieces = aiPieces.filter(x => x.i === carrierIndex);

    targetR = GOAL.r;
    targetC = GOAL.c;
  }

  let best = null;
  let bestDist = Infinity;

  for (const { p, i } of aiPieces) {
    const dirs = [
      [ rollValue, 0],
      [-rollValue, 0],
      [0,  rollValue],
      [0, -rollValue]
    ];

    for (const [dr, dc] of dirs) {
      const rr = p.r + dr;
      const cc = p.c + dc;
      if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) continue;

      const occ = board[rr][cc];

      // Can't land on own piece
      if (occ === team) continue;

      // CLASSIC MODE: cannot land on enemy unless they are the ball carrier or blocking their own goal
      if (modeSelect.value === "classic" && occ === enemy_team) {
          const enemyIndex = pieces[enemy_team].findIndex(p => p.r === rr && p.c === cc && p.alive);
          const enemyIsCarrier = (ball.carriedBy === enemy_team + "_" + enemyIndex);
          const enemyIsBlockingGoal = (rr === GOAL.r && cc === GOAL.c);
          if (tracedebug>2) console.log("Team:", team, "enemyIsCarrier", enemyIsCarrier, "enemyIsBlockingGoal", enemyIsBlockingGoal);
          if (!enemyIsCarrier && !enemyIsBlockingGoal) continue;
      }

      // Manhattan distance
      const d = Math.abs(rr - targetR) + Math.abs(cc - targetC);
      if (d < bestDist) {
        bestDist = d;
        best = { index: i, r: rr, c: cc };
      }
    }
  }

  if (!best) {
    statusEl.textContent = "AI cannot move.";
    console.warn("AI has No Move!", rollValue, team, currentPlayer);
    currentPlayer = (team === "blue") ? "red" : "blue";
    if (isAI(currentPlayer)) {
      statusEl.textContent = currentPlayer.toUpperCase() + " AI thinking...";
      scheduleAITurn(currentPlayer, difficultySelect.value);
    } else if (autoRoll.checked) {
      // Auto-roll mode
      rollValue = Math.floor(Math.random() * 6) + 1;
      //rollResultEl.textContent = "Auto Roll: " + rollValue, "for", team;
      statusEl.textContent = "Drag a piece to move " + rollValue + " spaces.";
    } else {
      // Manual mode
      rollValue = null;
      //rollResultEl.textContent = "None";
      console.log("aiPieces", rollValue, aiPieces);
      statusEl.textContent = "A1:", enemy_team, "turn. Roll the die.";
    }
    return false;
  }

  return attemptMove(team, best.index, best.r, best.c);
}

// first AI created + Manhattan
function aiTurn_02(team) {
  if (tracefunction) console.log("aiTurn_02", roundOver, team);
  if (roundOver) return;

  let GOAL = team === "red" ? RED_GOAL : BLUE_GOAL;
  let ENEMY_GOAL = team === "red" ? BLUE_GOAL : RED_GOAL;
  let enemy_team = team === "red" ? "blue" : "red";

  rollValue = Math.floor(Math.random() * 6) + 1;
  //rollResultEl.textContent = "AI3 Roll: " + rollValue + " for " + team;

  let aiPieces = pieces[team]
    .map((p, i) => ({ p, i }))
    .filter(x => x.p.alive);

  // Decide target: ball if loose, goal if AI carries it
  let targetR = ball.r;
  let targetC = ball.c;

  // If AI has the ball, only the carrier moves
  if (ball.carriedBy && ball.carriedBy.startsWith(team + "_")) {
    const [_, idxStr] = ball.carriedBy.split("_");
    const carrierIndex = parseInt(idxStr, 10);

    aiPieces = aiPieces.filter(x => x.i === carrierIndex);

    targetR = GOAL.r;
    targetC = GOAL.c;
  }

  let best = null;
  let bestDist = Infinity;

  for (const { p, i } of aiPieces) {
    const moves = generateManhattanMoves(p, rollValue);

    for (const { r: rr, c: cc } of moves) {
      if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) continue;

      const occ = board[rr][cc];

      // Can't land on own piece
      if (occ === team) continue;

      // CLASSIC MODE: cannot land on enemy unless they are the ball carrier or blocking their own goal
      if (modeSelect.value === "classic" && occ === enemy_team) {
          const enemyIndex = pieces[enemy_team].findIndex(p => p.r === rr && p.c === cc && p.alive);
          const enemyIsCarrier = (ball.carriedBy === enemy_team + "_" + enemyIndex);
          const enemyIsBlockingGoal = (rr === GOAL.r && cc === GOAL.c);
          if (tracedebug>2) console.log("Team:", team, "enemyIsCarrier", enemyIsCarrier, "enemyIsBlockingGoal", enemyIsBlockingGoal);
          if (!enemyIsCarrier && !enemyIsBlockingGoal) continue;
      }

      // Manhattan distance
      const d = Math.abs(rr - targetR) + Math.abs(cc - targetC);
      if (d < bestDist) {
        bestDist = d;
        best = { index: i, r: rr, c: cc };
      }
    }
  }

  if (!best) {
    statusEl.textContent = "AI cannot move.";
    console.warn("AI has No Move!", rollValue, team, currentPlayer);
    currentPlayer = (team === "blue") ? "red" : "blue";
    if (isAI(currentPlayer)) {
      statusEl.textContent = currentPlayer.toUpperCase() + " AI thinking...";
      //setTimeout(aiTurn, 400, currentPlayer, difficultySelect.value);
      scheduleAITurn(currentPlayer);
    } else if (autoRoll.checked) {
      // Auto-roll mode
      rollValue = Math.floor(Math.random() * 6) + 1;
      //rollResultEl.textContent = "Auto Roll: " + rollValue;
      statusEl.textContent = "Drag a piece to move " + rollValue + " spaces.";
    } else {
      // Manual mode
      rollValue = null;
      //rollResultEl.textContent = "";
      console.log("aiPieces", rollValue, aiPieces);
      statusEl.textContent = "A1:", enemy_team, "turn. Roll the die.";
    }
    return false;
  }

  return attemptMove(team, best.index, best.r, best.c);
}

// add move backup pieces and more
// BUG: still trying to tackle non ball carriers in classic mode
function aiTurn_03(team) {
  if (tracefunction) console.log("aiTurn_03", roundOver, team);
  if (roundOver) return;

  let GOAL = team === "red" ? RED_GOAL : BLUE_GOAL;
  let ENEMY_GOAL = team === "red" ? BLUE_GOAL : RED_GOAL;
  let enemy_team = team === "red" ? "blue" : "red";

  rollValue = Math.floor(Math.random() * 6) + 1;
  //rollResultEl.textContent = "AI2 Roll: " + rollValue + " for " + team;

  let aiPieces = pieces[team]
    .map((p, i) => ({ p, i }))
    .filter(x => x.p.alive);

  const aiHasBall = ball.carriedBy && ball.carriedBy.startsWith(team + "_");

  // Identify carrier if any
  let carrierIndex = null;
  if (aiHasBall) {
    const [_, idxStr] = ball.carriedBy.split("_");
    carrierIndex = parseInt(idxStr, 10);
  }

  // ------------------------------------------------------------
  // 1. If AI can score with the carrier, do it immediately
  // ------------------------------------------------------------
  if (aiHasBall) {
    const carrier = pieces[team][carrierIndex];
    const dirs = [
      [ rollValue, 0],
      [-rollValue, 0],
      [0,  rollValue],
      [0, -rollValue]
    ];

    for (const [dr, dc] of dirs) {
      const rr = carrier.r + dr;
      const cc = carrier.c + dc;
      if (rr === RED_GOAL.r && cc === RED_GOAL.c) {
        if (tracedebug) console.log("3.1 AI Move Attempt", team, carrierIndex, rr, cc);
        let success = attemptMove(team, carrierIndex, rr, cc);
        if (tracedebug) console.log("3.1 AI Move Result", success);
        if (success) {
          return true;
        } else {
          if (tracewarn) console.warn("3.1 AI Move Failed");
        }
      }
    }
  }

  // ------------------------------------------------------------
  // 2. If any piece can tackle an enemy piece this turn, do it
  // ------------------------------------------------------------
  if (modeSelect.value !== "classic") {
    for (const { p, i } of aiPieces) {
      const dirs = [
        [ rollValue, 0],
        [-rollValue, 0],
        [0,  rollValue],
        [0, -rollValue]
      ];

      for (const [dr, dc] of dirs) {
        const rr = p.r + dr;
        const cc = p.c + dc;
        if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) continue;

        if (board[rr][cc] === enemy_team) {
          // Tackle opportunity
          return attemptMove(team, i, rr, cc);
        }
      }
    }
  }

  // ------------------------------------------------------------
  // 3. If AI has the ball but cannot score, decide whether to
  //    move the carrier or a support piece.
  // ------------------------------------------------------------
  if (aiHasBall) {
      const carrier = pieces[team][carrierIndex];

      // Distance from carrier to goal
      const distToGoal = Math.abs(carrier.r - GOAL.r) + Math.abs(carrier.c - GOAL.c);

      // Determine if we should move the carrier or support pieces
      let moveCarrier = true;

      if (distToGoal <= 6) {
          // 50/50 decision when in scoring range but can't score this turn
          moveCarrier = Math.random() < 0.5;
      }

      // --------------------------------------------------------
      // 3A. Move the carrier toward the goal
      // --------------------------------------------------------
      if (moveCarrier) {
          let best = null;
          let bestDist = Infinity;

          const dirs = [
            [ rollValue, 0],
            [-rollValue, 0],
            [0,  rollValue],
            [0, -rollValue]
          ];

          for (const [dr, dc] of dirs) {
              const rr = carrier.r + dr;
              const cc = carrier.c + dc;

              if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) continue;

              const occ = board[rr][cc];

              // Can't land on own piece
              if (occ === team) continue;

              // Classic mode legality
              if (modeSelect.value === "classic" && occ === enemy_team) {
                  const enemyIndex = pieces[enemy_team].findIndex(p => p.r === rr && p.c === cc && p.alive);
                  const enemyIsCarrier = (ball.carriedBy === enemy_team + "_" + enemyIndex);
                  const enemyIsBlockingGoal = (rr === GOAL.r && cc === GOAL.c);
                  if (tracedebug>2) console.log("Team:", team, "enemyIsCarrier", enemyIsCarrier, "enemyIsBlockingGoal", enemyIsBlockingGoal);
                  if (!enemyIsCarrier && !enemyIsBlockingGoal) continue;
              }

              // Distance to goal
              const d = Math.abs(rr - GOAL.r) + Math.abs(cc - GOAL.c);
              if (d < bestDist) {
                  bestDist = d;
                  best = { index: carrierIndex, r: rr, c: cc };
              }
          }

          if (best) {
              return attemptMove(team, best.index, best.r, best.c);
          }
      }

      // --------------------------------------------------------
      // 3B. Move a support piece (fallback or chosen by 50/50)
      // --------------------------------------------------------
      const supportPieces = aiPieces.filter(x => x.i !== carrierIndex);

      let best = null;
      let bestDist = Infinity;

      for (const { p, i } of supportPieces) {
          const dirs = [
            [ rollValue, 0],
            [-rollValue, 0],
            [0,  rollValue],
            [0, -rollValue]
          ];

          for (const [dr, dc] of dirs) {
              const rr = p.r + dr;
              const cc = p.c + dc;

              if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) continue;

              const occ = board[rr][cc];
              if (occ === team) continue;

              // Classic mode legality
              if (modeSelect.value === "classic" && occ === enemy_team) {
                  const enemyIndex = pieces[enemy_team].findIndex(p => p.r === rr && p.c === cc && p.alive);
                  const enemyIsCarrier = (ball.carriedBy === enemy_team + "_" + enemyIndex);
                  const enemyIsBlockingGoal = (rr === GOAL.r && cc === GOAL.c);
                  if (tracedebug>2) console.log("Team:", team, "enemyIsCarrier", enemyIsCarrier, "enemyIsBlockingGoal", enemyIsBlockingGoal);
                  if (!enemyIsCarrier && !enemyIsBlockingGoal) continue;
              }

              // Move closer to the carrier
              const d = Math.abs(rr - carrier.r) + Math.abs(cc - carrier.c);
              if (d < bestDist) {
                  bestDist = d;
                  best = { index: i, r: rr, c: cc };
              }
          }
      }

      if (best) {
          return attemptMove(team, best.index, best.r, best.c);
      }
  }

  // ------------------------------------------------------------
  // 4. Default behavior: chase the ball
  // ------------------------------------------------------------
  let best = null;
  let bestDist = Infinity;

  for (const { p, i } of aiPieces) {
    const dirs = [
      [ rollValue, 0],
      [-rollValue, 0],
      [0,  rollValue],
      [0, -rollValue]
    ];

    for (const [dr, dc] of dirs) {
      const rr = p.r + dr;
      const cc = p.c + dc;
      if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) continue;

      const occ = board[rr][cc];

      // Can't land on own piece
      if (occ === team) continue;

      // CLASSIC MODE: cannot land on enemy unless they are the ball carrier or blocking their own goal
      if (modeSelect.value === "classic" && occ === enemy_team) {
          const enemyIndex = pieces[enemy_team].findIndex(p => p.r === rr && p.c === cc && p.alive);
          const enemyIsCarrier = (ball.carriedBy === enemy_team + "_" + enemyIndex);
          const enemyIsBlockingGoal = (rr === GOAL.r && cc === GOAL.c);
          if (tracedebug>2) console.log("Team:", team, "enemyIsCarrier", enemyIsCarrier, "enemyIsBlockingGoal", enemyIsBlockingGoal);
          if (!enemyIsCarrier && !enemyIsBlockingGoal) continue;
      }

      const d = Math.abs(rr - ball.r) + Math.abs(cc - ball.c);
      if (d < bestDist) {
        bestDist = d;
        best = { index: i, r: rr, c: cc };
      }
    }
  }

  if (!best) {
    statusEl.textContent = "AI cannot move.";
    console.warn("AI has No Move!", rollValue, team, currentPlayer);
    currentPlayer = (team === "blue") ? "red" : "blue";
    if (isAI(currentPlayer)) {
      statusEl.textContent = currentPlayer.toUpperCase() + " AI thinking...";
      //setTimeout(aiTurn, 400, currentPlayer, difficultySelect.value);
      scheduleAITurn(currentPlayer);
    } else if (autoRoll.checked) {
      // Auto-roll mode
      rollValue = Math.floor(Math.random() * 6) + 1;
      //rollResultEl.textContent = "Roll: " + rollValue;
      statusEl.textContent = "Drag a piece to move " + rollValue + " spaces.";
    } else {
      // Manual mode
      rollValue = null;
      //rollResultEl.textContent = "";
      statusEl.textContent = "A2:", enemy_team, "turn. Roll the die.";
    }
    return false;
  }

  return attemptMove(team, best.index, best.r, best.c);
}

// add move backup pieces and more + Manhattan
function aiTurn_04(team) {
  if (tracefunction) console.log("aiTurn_04", roundOver, team);
  if (roundOver) return;

  let GOAL = team === "red" ? RED_GOAL : BLUE_GOAL;
  let ENEMY_GOAL = team === "red" ? BLUE_GOAL : RED_GOAL;
  let enemy_team = team === "red" ? "blue" : "red";

  rollValue = Math.floor(Math.random() * 6) + 1;
  //rollResultEl.textContent = "AI Roll: " + rollValue;

  let aiPieces = pieces[team]
    .map((p, i) => ({ p, i }))
    .filter(x => x.p.alive);

  const aiHasBall = ball.carriedBy && ball.carriedBy.startsWith(team + "_");

  // Identify carrier if any
  let carrierIndex = null;
  if (aiHasBall) {
    const [_, idxStr] = ball.carriedBy.split("_");
    carrierIndex = parseInt(idxStr, 10);
  }

  // ------------------------------------------------------------
  // 1. If AI can score with the carrier, do it immediately
  // ------------------------------------------------------------
  if (aiHasBall) {
    const carrier = pieces[team][carrierIndex];
    const moves = generateManhattanMoves(carrier, rollValue);

    for (const { r: rr, c: cc } of moves) {
      if (rr === RED_GOAL.r && cc === RED_GOAL.c) {
        if (tracedebug) console.log("4.1 AI Move Attempt", team, carrierIndex, rr, cc);
        let success = attemptMove(team, carrierIndex, rr, cc);
        if (tracedebug) console.log("4.1 AI Move Result", success);
        if (success) {
          return true;
        } else {
          if (tracewarn) console.warn("4.1 AI Move Failed");
        }
      }
    }
  }

  // ------------------------------------------------------------
  // 2. If any red piece can tackle a blue piece this turn, do it
  // ------------------------------------------------------------
  if (modeSelect.value !== "classic") {
    for (const { p, i } of aiPieces) {
      const moves = generateManhattanMoves(p, rollValue);

      for (const { r: rr, c: cc } of moves) {
        if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) continue;

        if (board[rr][cc] === enemy_team) {
          // Tackle opportunity
          return attemptMove(team, i, rr, cc);
        }
      }
    }
  }

  // ------------------------------------------------------------
  // 3. If AI has the ball but cannot score, decide whether to
  //    move the carrier or a support piece.
  // ------------------------------------------------------------
  if (aiHasBall) {
      const carrier = pieces[team][carrierIndex];

      // Distance from carrier to goal
      const distToGoal = Math.abs(carrier.r - GOAL.r) + Math.abs(carrier.c - GOAL.c);

      // Determine if we should move the carrier or support pieces
      let moveCarrier = true;

      if (distToGoal <= 6) {
          // 50/50 decision when in scoring range but can't score this turn
          moveCarrier = Math.random() < 0.5;
      }

      // --------------------------------------------------------
      // 3A. Move the carrier toward the goal
      // --------------------------------------------------------
      if (moveCarrier) {
          let best = null;
          let bestDist = Infinity;

          const moves = generateManhattanMoves(carrier, rollValue);

          for (const { r: rr, c: cc } of moves) {
              if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) continue;

              const occ = board[rr][cc];

              // Can't land on own piece
              if (occ === team) continue;

              // Classic mode legality
              if (modeSelect.value === "classic" && occ === enemy_team) {
                  const enemyIndex = pieces[enemy_team].findIndex(p => p.r === rr && p.c === cc && p.alive);
                  const enemyIsCarrier = (ball.carriedBy === enemy_team + "_" + enemyIndex);
                  const enemyIsBlockingGoal = (rr === GOAL.r && cc === GOAL.c);
                  if (tracedebug>2) console.log("Team:", team, "enemyIsCarrier", enemyIsCarrier, "enemyIsBlockingGoal", enemyIsBlockingGoal);
                  if (!enemyIsCarrier && !enemyIsBlockingGoal) continue;
              }

              // Distance to goal
              const d = Math.abs(rr - GOAL.r) + Math.abs(cc - GOAL.c);
              if (d < bestDist) {
                  bestDist = d;
                  best = { index: carrierIndex, r: rr, c: cc };
              }
          }

          if (best) {
              return attemptMove(team, best.index, best.r, best.c);
          }
      }

      // --------------------------------------------------------
      // 3B. Move a support piece (fallback or chosen by 50/50)
      // --------------------------------------------------------
      const supportPieces = aiPieces.filter(x => x.i !== carrierIndex);

      let best = null;
      let bestDist = Infinity;

      for (const { p, i } of supportPieces) {
          const moves = generateManhattanMoves(p, rollValue);

          for (const { r: rr, c: cc } of moves) {

              if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) continue;

              const occ = board[rr][cc];
              if (occ === team) continue;

              // Classic mode legality
              if (modeSelect.value === "classic" && occ === enemy_team) {
                  const enemyIndex = pieces[enemy_team].findIndex(p => p.r === rr && p.c === cc && p.alive);
                  const enemyIsCarrier = (ball.carriedBy === enemy_team + "_" + enemyIndex);
                  const enemyIsBlockingGoal = (rr === GOAL.r && cc === GOAL.c);
                  if (tracedebug>2) console.log("Team:", team, "enemyIsCarrier", enemyIsCarrier, "enemyIsBlockingGoal", enemyIsBlockingGoal);
                  if (!enemyIsCarrier && !enemyIsBlockingGoal) continue;
              }

              // Move closer to the carrier
              const d = Math.abs(rr - carrier.r) + Math.abs(cc - carrier.c);
              if (d < bestDist) {
                  bestDist = d;
                  best = { index: i, r: rr, c: cc };
              }
          }
      }

      if (best) {
          return attemptMove(team, best.index, best.r, best.c);
      }
  }

  // ------------------------------------------------------------
  // 4. Default behavior: chase the ball
  // ------------------------------------------------------------
  let best = null;
  let bestDist = Infinity;

  for (const { p, i } of aiPieces) {
    const moves = generateManhattanMoves(p, rollValue);

    for (const { r: rr, c: cc } of moves) {
      if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) continue;

      const occ = board[rr][cc];

      // Can't land on own piece
      if (occ === team) continue;

      // CLASSIC MODE: cannot land on enemy unless they are the ball carrier or blocking their own goal
      if (modeSelect.value === "classic" && occ === enemy_team) {
          const enemyIndex = pieces[enemy_team].findIndex(p => p.r === rr && p.c === cc && p.alive);
          const enemyIsCarrier = (ball.carriedBy === enemy_team + "_" + enemyIndex);
          const enemyIsBlockingGoal = (rr === GOAL.r && cc === GOAL.c);
          if (tracedebug>2) console.log("Team:", team, "enemyIsCarrier", enemyIsCarrier, "enemyIsBlockingGoal", enemyIsBlockingGoal);
          if (!enemyIsCarrier && !enemyIsBlockingGoal) continue;
      }

      const d = Math.abs(rr - ball.r) + Math.abs(cc - ball.c);
      if (d < bestDist) {
        bestDist = d;
        best = { index: i, r: rr, c: cc };
      }
    }
  }

  if (!best) {
    statusEl.textContent = "AI cannot move.";
    if (tracewarn) console.warn("AI has No Move!", rollValue, team, currentPlayer);
    currentPlayer = (team === "blue") ? "red" : "blue";
    if (isAI(currentPlayer)) {
      statusEl.textContent = currentPlayer.toUpperCase() + " AI thinking...";
      //setTimeout(aiTurn, 400, currentPlayer, difficultySelect.value);
      scheduleAITurn(currentPlayer);
    } else if (autoRoll.checked) {
      // Auto-roll mode
      rollValue = Math.floor(Math.random() * 6) + 1;
      //rollResultEl.textContent = "Roll: " + rollValue;
      statusEl.textContent = "Drag a piece to move " + rollValue + " spaces.";
    } else {
      // Manual mode
      rollValue = null;
      //rollResultEl.textContent = "";
      statusEl.textContent = "A2:", enemy_team, "turn. Roll the die.";
    }
    return false;
  }

  return attemptMove(team, best.index, best.r, best.c);
}

// refactored 04
function aiTurn_05(team) {
  if (tracefunction) console.log("aiTurn_05", roundOver, team);
  if (roundOver) return;

  const GOAL       = team === "red" ? RED_GOAL  : BLUE_GOAL;
  const ENEMY_GOAL = team === "red" ? BLUE_GOAL : RED_GOAL;
  const enemy_team = team === "red" ? "blue"    : "red";

  rollValue = Math.floor(Math.random() * 6) + 1;
  //rollResultEl.textContent = "AI Roll: " + rollValue;

  const aiPieces = pieces[team]
    .map((p, i) => ({ p, i }))
    .filter(x => x.p.alive);

  const aiHasBall = ball.carriedBy && ball.carriedBy.startsWith(team + "_");

  let carrierIndex = null;
  if (aiHasBall) {
    carrierIndex = parseInt(ball.carriedBy.split("_")[1], 10);
  }

  // ------------------------------------------------------------
  // 1. Try to score immediately
  // ------------------------------------------------------------
  if (aiHasBall) {
    const carrier = pieces[team][carrierIndex];
    const moves = generateManhattanMoves(carrier, rollValue);

    for (const { r: rr, c: cc } of moves) {
      if (rr === GOAL.r && cc === GOAL.c) {
        if (tracedebug) console.log("5.1 AI Move Attempt", team, carrierIndex, rr, cc);
        let success = attemptMove(team, carrierIndex, rr, cc);
        if (tracedebug) console.log("5.1 AI Move Result", success);
        if (success) {
          return true;
        } else {
          if (tracewarn) console.warn("5.1 AI Move Failed");
        }
      }
    }
  }

  // ------------------------------------------------------------
  // 2. Tackle if possible
  // ------------------------------------------------------------
  if (modeSelect.value !== "classic") {
    for (const { p, i } of aiPieces) {
      const moves = generateManhattanMoves(p, rollValue);

      for (const { r: rr, c: cc } of moves) {
        if (board[rr][cc] === enemy_team) {
          if (tracedebug) console.log("5.2 AI Move Attempt", team, i, rr, cc);
          return attemptMove(team, i, rr, cc);
        }
      }
    }
  }

  // ------------------------------------------------------------
  // 3. Carrier logic (move carrier or support)
  // ------------------------------------------------------------
  if (aiHasBall) {
    const carrier = pieces[team][carrierIndex];
    const distToGoal = Math.abs(carrier.r - GOAL.r) + Math.abs(carrier.c - GOAL.c);

    let moveCarrier = true;
    if (distToGoal <= 6) moveCarrier = Math.random() < 0.5;

    // --------------------------------------------------------
    // 3A. Move carrier toward goal
    // --------------------------------------------------------
    if (moveCarrier) {
      let best = null;
      let bestDist = Infinity;

      const moves = generateManhattanMoves(carrier, rollValue);

      for (const { r: rr, c: cc } of moves) {
        const occ = board[rr][cc];

        if (occ === team) continue;

        if (modeSelect.value === "classic" && occ === enemy_team) {
          const enemyIndex = pieces[enemy_team].findIndex(p => p.r === rr && p.c === cc && p.alive);
          const enemyIsCarrier = ball.carriedBy === enemy_team + "_" + enemyIndex;
          const enemyIsBlockingGoal = rr === GOAL.r && cc === GOAL.c;
          if (tracedebug) console.log("5.3A Team:", team, "enemyIsCarrier", enemyIsCarrier, "enemyIsBlockingGoal", enemyIsBlockingGoal);
          if (!enemyIsCarrier && !enemyIsBlockingGoal) continue;
        }

        const d = Math.abs(rr - GOAL.r) + Math.abs(cc - GOAL.c);
        if (d < bestDist) {
          bestDist = d;
          best = { index: carrierIndex, r: rr, c: cc };
        }
      }

      if (best) {
        if (tracedebug) console.log("5.3A AI Move Attempt", team, best.index, best.r, best.c);
        //if (attemptMove(team, best.index, best.r, best.c)) return true;
        return attemptMove(team, best.index, best.r, best.c);
      }
    }

    // --------------------------------------------------------
    // 3B. Move support pieces
    // --------------------------------------------------------
    let best = null;
    let bestDist = Infinity;

    const supportPieces = aiPieces.filter(x => x.i !== carrierIndex);

    for (const { p, i } of supportPieces) {
      const moves = generateManhattanMoves(p, rollValue);

      for (const { r: rr, c: cc } of moves) {
        const occ = board[rr][cc];
        if (occ === team) continue;

        if (modeSelect.value === "classic" && occ === enemy_team) {
          const enemyIndex = pieces[enemy_team].findIndex(p => p.r === rr && p.c === cc && p.alive);
          const enemyIsCarrier = ball.carriedBy === enemy_team + "_" + enemyIndex;
          const enemyIsBlockingGoal = rr === GOAL.r && cc === GOAL.c;
          if (tracedebug) console.log("5.3B Team:", team, "enemyIsCarrier", enemyIsCarrier, "enemyIsBlockingGoal", enemyIsBlockingGoal);
          if (!enemyIsCarrier && !enemyIsBlockingGoal) continue;
        }

        const d = Math.abs(rr - carrier.r) + Math.abs(cc - carrier.c);
        if (d < bestDist) {
          bestDist = d;
          best = { index: i, r: rr, c: cc };
        }
      }
    }

    if (best) {
      if (tracedebug) console.log("5.3B AI Move Attempt", team, best.index, best.r, best.c);
      return attemptMove(team, best.index, best.r, best.c);
    }
  }

  // ------------------------------------------------------------
  // 4. Default: chase the ball
  // ------------------------------------------------------------
  let best = null;
  let bestDist = Infinity;

  for (const { p, i } of aiPieces) {
    const moves = generateManhattanMoves(p, rollValue);

    for (const { r: rr, c: cc } of moves) {
      const occ = board[rr][cc];
      if (occ === team) continue;

      if (modeSelect.value === "classic" && occ === enemy_team) {
        const enemyIndex = pieces[enemy_team].findIndex(p => p.r === rr && p.c === cc && p.alive);
        const enemyIsCarrier = ball.carriedBy === enemy_team + "_" + enemyIndex;
        const enemyIsBlockingGoal = rr === GOAL.r && cc === GOAL.c;
        if (tracedebug) console.log("5.4 Team:", team, "enemyIsCarrier", enemyIsCarrier, "enemyIsBlockingGoal", enemyIsBlockingGoal);
        if (!enemyIsCarrier && !enemyIsBlockingGoal) continue;
      }

      const d = Math.abs(rr - ball.r) + Math.abs(cc - ball.c);
      if (d < bestDist) {
        bestDist = d;
        best = { index: i, r: rr, c: cc };
      }
    }
  }

  // ------------------------------------------------------------
  // 5. No move found
  // ------------------------------------------------------------
  if (!best) {
    statusEl.textContent = "5.5 AI cannot move.";
    if (tracewarn) console.warn("AI has No Move!", rollValue, team, currentPlayer);
    currentPlayer = (team === "blue") ? "red" : "blue";
    scheduleAITurn(currentPlayer);
    return false;
  }

  if (tracedebug) console.log("5.5 AI Move Attempt", team, best.index, best.r, best.c);
  return attemptMove(team, best.index, best.r, best.c);
}

autoPlay.addEventListener("click", () => {
  if (traceevent) console.log("Click Auto Play", autoPlay.checked);
  if (autoPlay.checked) {
    scheduleAITurn(currentPlayer);
  }
});

// ====== INPUT: ROLL / PASS ======
rollBtn.addEventListener("click", () => {
  if (roundOver) return;
  if (isAI(currentPlayer)) return;
  if (rollValue !== null) return;

  rollValue = Math.floor(Math.random() * 6) + 1;
  statusEl.textContent = "Roll: " + rollValue + ". Drag a piece.";
});

passBtn.addEventListener("click", () => {
  if (roundOver) return;
  if (isAI(currentPlayer)) return;

  rollValue = null;
  currentPlayer = currentPlayer === "blue" ? "red" : "blue";
  statusEl.textContent = "Pass. " + currentPlayer + " turn.";
  render();

  if (isAI(currentPlayer)) scheduleAITurn(currentPlayer, difficultySelect.value);
});

restartBtn.addEventListener("click", () => {
  if (traceevent) console.log("Click Restart");
  cancelAITurn();
  init();
});

ballSelect.addEventListener("change", () => {
  ballEmoji = ballSelect.options[ballSelect.selectedIndex].textContent;
  if (traceevent) console.log("Selected ball emoji:", ballEmoji);
  document.title = ballEmoji + " " + name;
  render();
});

// ====== INPUT: DRAG & DROP (canvas) ======
canvas.addEventListener("mousedown", (e) => {
  if (roundOver) return;
  if (isAI(currentPlayer)) return;
  if (rollValue === null) return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const cell = pixelToCell(x, y);
  if (!cell) return;

  const { r, c } = cell;
  const occupant = board[r][c];
  if (occupant !== "blue") return;

  const index = pieces.blue.findIndex(p => p.r === r && p.c === c && p.alive);
  if (index === -1) return;

  dragging = { team: "blue", index, startR: r, startC: c };
  dragPos = { x, y };
  render();
});

canvas.addEventListener("mousemove", (e) => {
  if (!dragging) return;
  const rect = canvas.getBoundingClientRect();
  dragPos = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };
  render();
});

canvas.addEventListener("mouseup", (e) => {
  if (!dragging) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const cell = pixelToCell(x, y);
  const { team, index, startR, startC } = dragging;

  dragging = null;
  dragPos = null;

  if (!cell) {
    render();
    return;
  }

  const { r, c } = cell;
  attemptMove(team, index, r, c);
});

document.addEventListener("keydown", (e) => {
  if (traceevent) console.log(e.key, roundOver);

  if (e.key === " " || e.key === "Space") {
    paused = !paused;
    console.log("Paused:", paused);
    if (!paused) scheduleAITurn(currentPlayer, difficultySelect.value); // resume immediately
  }

  if (e.key === "s" || e.key === "S") {
    if (paused) {
      if (!roundOver) {
        step = true;
        console.log("Step requested", currentPlayer);
        //currentPlayer = currentPlayer === "blue" ? "red" : "blue";
        scheduleAITurn(currentPlayer, difficultySelect.value);
      } else {
        setTimeout(newRound, 0, currentPlayer);
      }
    }
  }

  //press C to toggle show coords
  if (e.key === "c" || e.key === "C") {
    showCoords = !showCoords;
    statusEl.textContent = "Show Coords: " + (showCoords ? "ON" : "OFF");
    render();
    return;
  }

  // TEMPLATE: press G for go
  if (e.key === "g" || e.key === "G") {
    //go = !go;
    return;
  }

  if (roundOver) return;

});

function generateManhattanMoves(p, rollValue) {
  const moves = [];

  for (let dr = -rollValue; dr <= rollValue; dr++) {
    const dc = rollValue - Math.abs(dr);

    // Skip zero-zero
    if (dr === 0 && dc === 0) continue;

    // Two possible columns for each dr
    const candidates = [
      { r: p.r + dr, c: p.c + dc },
      { r: p.r + dr, c: p.c - dc }
    ];

    for (const m of candidates) {
      if (m.r < 0 || m.r >= ROWS) continue;
      if (m.c < 0 || m.c >= COLS) continue;
      moves.push(m);
    }
  }

  return moves;
}

function scheduleAITurn(team, level="0") {
  if (aiScheduled || roundOver) return;

  // If paused → wait until unpaused or step pressed
  if (paused && !step) {
    return;
  }

  // If step was requested → consume it and run one AI tick
  if (step) {
    step = false;
    aiScheduled = true;
    aiTimeoutId = setTimeout(() => {
      aiScheduled = false;
      aiTimeoutId = null;
      aiTurn(team, level);
    }, 0);
    return;
  }

  aiScheduled = true;

  aiTimeoutId = setTimeout(() => {
    aiScheduled = false;
    aiTimeoutId = null;
    aiTurn(team, level);
  }, AI_DELAY);
}

function cancelAITurn() {
  if (aiTimeoutId !== null) {
    clearTimeout(aiTimeoutId);
    aiTimeoutId = null;
  }
  aiScheduled = false;
}

function newRound(team) {
  if (tracefunction) console.log("newRound", team);
  roundOver = false;
  rollValue = null;
  cancelAITurn();
  pieces = createPieces(formationSelect.value);
  ball = pieces.ball;
  RED_GOAL = pieces.red_goal;
  BLUE_GOAL  = pieces.blue_goal;
  resetBoard();
  currentPlayer = team;
  statusEl.textContent = "Your turn (" + team + "). Click Roll.";
  render();

  if (autoPlay.checked || isAI(team)) {
    scheduleAITurn(team, difficultySelect.value);
  }
  // Auto‑roll support
  else if (autoRoll.checked) {
    rollValue = Math.floor(Math.random() * 6) + 1;
    //rollResultEl.textContent = "Roll: " + rollValue;
    statusEl.textContent = "Drag a piece to move " + rollValue + " spaces.";
  }
}

// ====== START GAME ======
function init() {
  redScore = 0;
  blueScore = 0;
  let choice = Math.floor(Math.random() * 2);
  newRound(choice > 0 ? "red" : "blue");
}

init();

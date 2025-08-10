// Minimal Space Invaders-style game

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const hud = {
  scoreEl: document.getElementById("score"),
  livesEl: document.getElementById("lives"),
  levelEl: document.getElementById("level"),
  megaEl: document.getElementById("mega"),
};
const sfxGameOver = document.getElementById("sfxGameOver");
const sfxBullet = document.getElementById("sfxBullet");
const sfxMega = document.getElementById("sfxMega");
let sharedAudioCtx;
function getAudioCtx() {
  if (!sharedAudioCtx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    sharedAudioCtx = new AudioCtx();
  }
  return sharedAudioCtx;
}
// Unlock WebAudio on first interaction (fixes autoplay policy issues)
let audioUnlocked = false;
function unlockAudio() {
  try {
    const ctx = getAudioCtx();
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    audioUnlocked = true;
  } catch (_) {}
}
window.addEventListener("pointerdown", unlockAudio, { once: true });
window.addEventListener("keydown", unlockAudio, { once: true });
window.addEventListener("touchstart", unlockAudio, {
  once: true,
  passive: true,
});
const restartBtn = document.getElementById("restartBtn");
const overlay = document.getElementById("gameOverOverlay");
const overlayRestartBtn = document.getElementById("overlayRestartBtn");
const pixelTextCanvas = document.getElementById("pixelText");
const pixelCtx = pixelTextCanvas.getContext("2d");

// Game state
const state = {
  running: true,
  score: 0,
  lives: 3,
  level: 1,
};

// Player
const player = {
  width: 50,
  height: 20,
  x: canvas.width / 2 - 25,
  y: canvas.height - 50,
  speed: 360,
  cooldown: 0,
  fireDelayMs: 280,
};

// Bullets and enemies
const bullets = [];
const enemies = [];
const enemyBullets = [];
const megaBullets = [];

// Galaxy background: parallax starfield + nebula
const galaxy = {
  stars: [], // {x,y,speed,size,alpha}
  layers: 3,
  nebulaSeed: Math.random() * 1000,
};

// Pixel font for "GAME OVER" - 8x8 bitmap for each character
const PIXEL_FONT = {
  G: [
    "01111110",
    "10000000",
    "10000000",
    "10011110",
    "10000010",
    "10000010",
    "01111110",
    "00000000",
  ],
  A: [
    "01111100",
    "10000010",
    "10000010",
    "11111110",
    "10000010",
    "10000010",
    "10000010",
    "00000000",
  ],
  M: [
    "10000010",
    "11000110",
    "10101010",
    "10010010",
    "10000010",
    "10000010",
    "10000010",
    "00000000",
  ],
  E: [
    "11111110",
    "10000000",
    "10000000",
    "11111100",
    "10000000",
    "10000000",
    "11111110",
    "00000000",
  ],
  O: [
    "01111100",
    "10000010",
    "10000010",
    "10000010",
    "10000010",
    "10000010",
    "01111100",
    "00000000",
  ],
  V: [
    "10000010",
    "10000010",
    "10000010",
    "10000010",
    "01000100",
    "00101000",
    "00010000",
    "00000000",
  ],
  R: [
    "11111100",
    "10000010",
    "10000010",
    "11111100",
    "10100000",
    "10010000",
    "10001000",
    "00000000",
  ],
  " ": [
    "00000000",
    "00000000",
    "00000000",
    "00000000",
    "00000000",
    "00000000",
    "00000000",
    "00000000",
  ],
};

function drawPixelText() {
  if (!pixelCtx) return;

  pixelCtx.clearRect(0, 0, pixelTextCanvas.width, pixelTextCanvas.height);

  const text = "GAME OVER";
  const charWidth = 8;
  const charHeight = 8;

  // Calculate optimal pixel size accounting for shadow offset
  const shadowOffset = 3;
  const availableWidth = 800 - shadowOffset;
  const availableHeight = 200 - shadowOffset;

  // Find largest pixel size that fits
  let pixelSize = 1;
  for (let size = 1; size <= 15; size++) {
    const spacing = Math.max(1, Math.floor(size / 4));
    const totalWidth =
      text.length * charWidth * size + (text.length - 1) * spacing * size;
    const totalHeight = charHeight * size;

    if (totalWidth <= availableWidth && totalHeight <= availableHeight) {
      pixelSize = size;
    } else {
      break;
    }
  }
  const spacing = Math.max(1, Math.floor(pixelSize / 4));

  const totalWidth =
    text.length * (charWidth * pixelSize + spacing * pixelSize) -
    spacing * pixelSize;
  const startX = (pixelTextCanvas.width - totalWidth) / 2;
  const startY = (pixelTextCanvas.height - charHeight * pixelSize) / 2;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const charData = PIXEL_FONT[char];
    if (!charData) continue;

    const charX = startX + i * (charWidth * pixelSize + spacing * pixelSize);

    for (let row = 0; row < charHeight; row++) {
      for (let col = 0; col < charWidth; col++) {
        if (charData[row][col] === "1") {
          // Yellow pixel
          pixelCtx.fillStyle = "#ffd447";
          pixelCtx.fillRect(
            charX + col * pixelSize,
            startY + row * pixelSize,
            pixelSize,
            pixelSize
          );
          // Red shadow/depth pixel
          pixelCtx.fillStyle = "#ff2d55";
          pixelCtx.fillRect(
            charX + col * pixelSize + shadowOffset,
            startY + row * pixelSize + shadowOffset,
            pixelSize,
            pixelSize
          );
        }
      }
    }
  }
}

function initGalaxy() {
  galaxy.stars.length = 0;
  const perLayer = 80;
  for (let l = 0; l < galaxy.layers; l++) {
    for (let i = 0; i < perLayer; i++) {
      galaxy.stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        speed: 10 + l * 20 + Math.random() * 20,
        size: 1 + l * 0.6 + Math.random() * 1.2,
        alpha: 0.4 + Math.random() * 0.6,
      });
    }
  }
}

// Input
const keys = new Set();
window.addEventListener("keydown", (e) => {
  if (["ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
  if (e.key.toLowerCase() === "p") state.running = !state.running;
  if (e.key === "m" || e.key === "M") {
    // Fire mega directly on the key event so audio plays under a user gesture
    tryFireMega();
  }
  keys.add(e.key);
});
window.addEventListener("keyup", (e) => keys.delete(e.key));

function spawnWave(level) {
  enemies.length = 0;
  const rows = Math.min(4 + Math.floor(level / 2), 7);
  const cols = Math.min(8 + level, 14);
  const marginX = 60;
  const marginY = 60;
  const gapX = (canvas.width - marginX * 2) / (cols - 1);
  const gapY = 36;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      enemies.push({
        x: marginX + c * gapX,
        y: marginY + r * gapY,
        w: 28,
        h: 18,
        alive: true,
        color: `hsl(${120 + r * 30}, 80%, 60%)`,
      });
    }
  }
}

let enemyDir = 1; // 1 right, -1 left
let enemySpeed = 40; // px/s baseline, speeds up as they dwindle
let timeSinceFire = 0;
let playerInvulnTimer = 0; // seconds of temporary invulnerability after being hit

// Pixel Hulk sprite used for the Mega bullet (pixel-art grid)
// Legend: ' ' transparent, 'G' green, 'D' dark green, 'P' purple (pants), 'K' hair (dark), 'E' eye (white)
const HULK_SPRITE = [
  "   KKKKKKK   ",
  "  KKKKKKKKK  ",
  "  KGGGGGGGK  ",
  " KGGGGGGGGGK ",
  " KGGGEGGEGGK ",
  " KGGGGGGGGGK ",
  "  DGGGGGGGD  ",
  "   DGGGGGD   ",
  "   GGGGGGG   ",
  "  GGGGGGGGG  ",
  "  PPPG GPPP  ",
  "  PPP   PPP  ",
];

const HULK_COLORS = {
  G: "#5de35d", // green
  D: "#2aa52a", // dark green
  P: "#9a6cff", // purple pants
  K: "#1b1b1b", // dark hair
  E: "#ffffff", // eyes
};

function getHulkSize(cellSize) {
  const width = HULK_SPRITE[0].length * cellSize;
  const height = HULK_SPRITE.length * cellSize;
  return { width, height };
}

function drawPixelHulk(ctx, x, y, cellSize) {
  for (let r = 0; r < HULK_SPRITE.length; r++) {
    const row = HULK_SPRITE[r];
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      if (ch === " ") continue;
      const color = HULK_COLORS[ch] || HULK_COLORS.G;
      ctx.fillStyle = color;
      ctx.fillRect(x + c * cellSize, y + r * cellSize, cellSize, cellSize);
    }
  }
}

// Optional: load external PNG sprite for Mega Blaster
const hulkImg = new Image();
let hulkImgLoaded = false;
let hulkTriedAltPath = false;
hulkImg.onload = () => {
  hulkImgLoaded = true;
};
hulkImg.onerror = () => {
  if (!hulkTriedAltPath) {
    hulkTriedAltPath = true;
    hulkImg.src = "./assets/hulk.png";
  } else {
    hulkImgLoaded = false;
  }
};
hulkImg.src = "./hulk.png"; // Tries root first, then falls back to ./assets/hulk.png

// Reserve bottom space on touch devices so on-screen controls don't cover the player
let bottomUiMargin = 0;
function computeUiMargin() {
  const isTouch =
    (window.matchMedia &&
      (window.matchMedia("(hover: none)").matches ||
        window.matchMedia("(pointer: coarse)").matches)) ||
    window.innerWidth <= 900;
  // Approximate control stack height
  bottomUiMargin = isTouch ? 110 : 0;
}
computeUiMargin();
window.addEventListener("resize", computeUiMargin);

function reset() {
  state.score = 0;
  state.lives = 3;
  state.level = 1;
  bullets.length = 0;
  enemyBullets.length = 0;
  megaBullets.length = 0;
  enemyDir = 1;
  timeSinceFire = 0;
  playerInvulnTimer = 0;
  player.x = canvas.width / 2 - player.width / 2;
  player.y = canvas.height - 50 - bottomUiMargin;
  initGalaxy();
  spawnWave(state.level);
  hud.scoreEl.textContent = String(state.score);
  hud.livesEl.textContent = String(state.lives);
  hud.levelEl.textContent = String(state.level);
}

function aabb(a, b) {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}

function update(dt) {
  if (!state.running) return;

  // Keep player vertical position above the touch controls area when present
  player.y = canvas.height - 50 - bottomUiMargin;

  // Player movement
  playerInvulnTimer = Math.max(0, playerInvulnTimer - dt);
  const left = keys.has("ArrowLeft") || keys.has("a") || keys.has("A");
  const right = keys.has("ArrowRight") || keys.has("d") || keys.has("D");
  if (left && !right) player.x -= player.speed * dt;
  if (right && !left) player.x += player.speed * dt;
  player.x = Math.max(10, Math.min(canvas.width - player.width - 10, player.x));

  // Fire
  player.cooldown -= dt * 1000;
  if ((keys.has(" ") || keys.has("Space")) && player.cooldown <= 0) {
    bullets.push({
      x: player.x + player.width / 2 - 2,
      y: player.y - 8,
      w: 4,
      h: 10,
      vy: -520,
    });
    player.cooldown = player.fireDelayMs;
    canvas.classList.remove("flash");
    void canvas.offsetWidth; // restart animation
    canvas.classList.add("flash");
    playBulletSound();
  }

  // Mega fire is triggered on keydown to ensure audio is allowed under user gesture

  // Update bullets
  for (const b of bullets) b.y += b.vy * dt;
  for (const b of enemyBullets) b.y += b.vy * dt;
  for (const b of megaBullets) b.y += b.vy * dt;

  // Update starfield
  for (const s of galaxy.stars) {
    s.y += s.speed * dt;
    if (s.y > canvas.height + 2) {
      s.y = -2;
      s.x = Math.random() * canvas.width;
      s.alpha = 0.4 + Math.random() * 0.6;
    }
  }

  // Enemy movement (marching)
  const aliveEnemies = enemies.filter((e) => e.alive);
  if (aliveEnemies.length) {
    const minX = Math.min(...aliveEnemies.map((e) => e.x));
    const maxX = Math.max(...aliveEnemies.map((e) => e.x + e.w));
    const speedBoost = Math.min(
      5,
      1 + (1 - aliveEnemies.length / enemies.length) * 4
    );
    const dx = enemyDir * enemySpeed * speedBoost * dt;
    let hitEdge = false;
    if (minX + dx < 10 || maxX + dx > canvas.width - 10) {
      enemyDir *= -1;
      hitEdge = true;
    }
    for (const e of aliveEnemies) {
      e.x += enemyDir * enemySpeed * speedBoost * dt;
      if (hitEdge) e.y += 16;
    }

    // Check collision between enemies and player ship (or reaching player row)
    for (const e of aliveEnemies) {
      const playerRect = {
        x: player.x,
        y: player.y,
        w: player.width,
        h: player.height,
      };
      if (aabb(playerRect, e) || e.y + e.h >= player.y) {
        const isDead = damagePlayer("enemy");
        // Remove the colliding enemy to avoid repeated hits in the same spot
        e.alive = false;
        if (isDead) return; // game over already handled
        break;
      }
    }
  }

  // Enemy fire
  timeSinceFire += dt;
  const fireInterval = Math.max(0.6, 1.6 - state.level * 0.15);
  if (timeSinceFire > fireInterval && aliveEnemies.length) {
    timeSinceFire = 0;
    const shooters = aliveEnemies.filter(
      (_, i) => i % Math.max(1, Math.floor(6 - state.level)) === 0
    );
    if (shooters.length) {
      const shooter = shooters[Math.floor(Math.random() * shooters.length)];
      enemyBullets.push({
        x: shooter.x + shooter.w / 2 - 2,
        y: shooter.y + shooter.h + 2,
        w: 4,
        h: 10,
        vy: 240,
      });
    }
  }

  // Collisions: player bullets vs enemies
  for (const b of bullets) {
    for (const e of enemies) {
      if (!e.alive) continue;
      if (aabb({ x: b.x, y: b.y, w: b.w, h: b.h }, e)) {
        e.alive = false;
        b.y = -9999; // remove
        state.score += 10;
      }
    }
  }

  // Collisions: mega bullets vs enemies (piercing)
  for (const mb of megaBullets) {
    for (const e of enemies) {
      if (!e.alive) continue;
      if (aabb({ x: mb.x, y: mb.y, w: mb.w, h: mb.h }, e)) {
        e.alive = false;
        state.score += 15; // extra reward for mega
      }
    }
  }

  // Collisions: enemy bullets vs player
  for (const eb of enemyBullets) {
    if (
      aabb(
        { x: eb.x, y: eb.y, w: eb.w, h: eb.h },
        { x: player.x, y: player.y, w: player.width, h: player.height }
      )
    ) {
      eb.y = canvas.height + 9999;
      const isDead = damagePlayer("bullet");
      if (isDead) return;
    }
  }

  // Cleanup offscreen
  for (let i = bullets.length - 1; i >= 0; i--)
    if (bullets[i].y < -20) bullets.splice(i, 1);
  for (let i = enemyBullets.length - 1; i >= 0; i--)
    if (enemyBullets[i].y > canvas.height + 20) enemyBullets.splice(i, 1);
  for (let i = megaBullets.length - 1; i >= 0; i--)
    if (megaBullets[i].y < -40) megaBullets.splice(i, 1);

  // Next level
  if (enemies.every((e) => !e.alive)) {
    state.level += 1;
    hud.levelEl.textContent = String(state.level);
    bullets.length = 0;
    enemyBullets.length = 0;
    spawnWave(state.level);
  }

  // HUD
  hud.scoreEl.textContent = String(state.score);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Galaxy background: soft nebula gradient + stars
  // Nebula
  const g1 = ctx.createRadialGradient(
    canvas.width * 0.2,
    canvas.height * 0.1,
    20,
    canvas.width * 0.2,
    canvas.height * 0.1,
    420
  );
  g1.addColorStop(0, "rgba(126, 249, 255, 0.08)");
  g1.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const g2 = ctx.createRadialGradient(
    canvas.width * 0.8,
    canvas.height * 0.3,
    10,
    canvas.width * 0.8,
    canvas.height * 0.3,
    360
  );
  g2.addColorStop(0, "rgba(154,108,255, 0.10)");
  g2.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // Stars
  ctx.save();
  ctx.fillStyle = "#e8f0ff";
  for (const s of galaxy.stars) {
    ctx.globalAlpha = s.alpha;
    ctx.fillRect(s.x, s.y, s.size, s.size);
  }
  ctx.restore();

  // Player
  ctx.fillStyle = "#7ef9ff";
  ctx.fillRect(player.x, player.y, player.width, player.height);
  // Cannon tip
  ctx.fillRect(player.x + player.width / 2 - 3, player.y - 8, 6, 8);

  // Enemies
  for (const e of enemies) {
    if (!e.alive) continue;
    ctx.fillStyle = e.color;
    ctx.fillRect(e.x, e.y, e.w, e.h);
  }

  // Bullets
  ctx.fillStyle = "#8aff80";
  for (const b of bullets) ctx.fillRect(b.x, b.y, b.w, b.h);
  // Mega bullets: draw Pixel Hulk sprite with a soft glow
  for (const b of megaBullets) {
    ctx.save();
    ctx.shadowColor = "#8aff80";
    ctx.shadowBlur = 18;
    if (b.isImage && hulkImgLoaded) {
      ctx.drawImage(hulkImg, b.x, b.y, b.w, b.h);
    } else {
      drawPixelHulk(ctx, b.x, b.y, b.cellSize);
    }
    ctx.restore();
  }
  ctx.fillStyle = "#ff5d73";
  for (const b of enemyBullets) ctx.fillRect(b.x, b.y, b.w, b.h);
}

function gameOver() {
  state.running = false;
  playGameOverSound();
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 48px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Game Over", canvas.width / 2, canvas.height / 2 - 10);
  ctx.font = "24px system-ui, sans-serif";
  ctx.fillText(
    "Press Enter to Restart",
    canvas.width / 2,
    canvas.height / 2 + 28
  );
  ctx.restore();
  if (overlay) {
    overlay.setAttribute("aria-hidden", "false");
    drawPixelText(); // Draw the pixelated "GAME OVER" text
  }
}

window.addEventListener("keydown", (e) => {
  if (
    (e.key === "Enter" || e.key === "Return") &&
    !state.running &&
    state.lives <= 0
  ) {
    state.running = true;
    reset();
  }
});

restartBtn?.addEventListener("click", () => {
  state.running = true;
  reset();
  if (overlay) overlay.setAttribute("aria-hidden", "true");
});
overlayRestartBtn?.addEventListener("click", () => {
  state.running = true;
  reset();
  if (overlay) overlay.setAttribute("aria-hidden", "true");
});

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

reset();
requestAnimationFrame(loop);

// Mega ability implementation
let megaReady = true;
const megaCooldownMs = 4500;
function setMegaStatus() {
  hud.megaEl.textContent = megaReady ? "Ready" : "Charging";
  hud.megaEl.style.color = megaReady ? "#8aff80" : "#ffcf66";
}
function tryFireMega() {
  if (!megaReady || !state.running) return;
  megaReady = false;
  setMegaStatus();
  // Play Mega Blast sound if available
  if (sfxMega) {
    try {
      sfxMega.currentTime = 0;
      const p = sfxMega.play();
      if (p && typeof p.then === "function") p.catch(() => {});
    } catch (_) {}
  }
  const centerX = player.x + player.width / 2;
  const gap = 16; // pixels between the two mega blasts
  if (hulkImgLoaded) {
    const targetWidth = 56; // desired on-canvas width per Hulk
    const scale = targetWidth / hulkImg.width;
    const width = Math.max(24, Math.min(96, hulkImg.width * scale));
    const height = hulkImg.height * (width / hulkImg.width);
    const xLeft = Math.max(
      0,
      Math.min(canvas.width - width, centerX - width - gap / 2)
    );
    const xRight = Math.max(
      0,
      Math.min(canvas.width - width, centerX + gap / 2)
    );
    const y = player.y - height - 6;
    megaBullets.push({
      x: xLeft,
      y,
      w: width,
      h: height,
      vy: -720,
      isImage: true,
    });
    megaBullets.push({
      x: xRight,
      y,
      w: width,
      h: height,
      vy: -720,
      isImage: true,
    });
  } else {
    const cellSize = 4; // pixel-art fallback
    const size = getHulkSize(cellSize);
    const width = size.width;
    const height = size.height;
    const xLeft = Math.max(
      0,
      Math.min(canvas.width - width, centerX - width - gap / 2)
    );
    const xRight = Math.max(
      0,
      Math.min(canvas.width - width, centerX + gap / 2)
    );
    const y = player.y - height - 6;
    megaBullets.push({
      x: xLeft,
      y,
      w: width,
      h: height,
      vy: -720,
      cellSize,
      isImage: false,
    });
    megaBullets.push({
      x: xRight,
      y,
      w: width,
      h: height,
      vy: -720,
      cellSize,
      isImage: false,
    });
  }
  setTimeout(() => {
    megaReady = true;
    setMegaStatus();
  }, megaCooldownMs);
}

setMegaStatus();

// Shared damage handling for player
function damagePlayer(source) {
  if (playerInvulnTimer > 0) return false;
  state.lives -= 1;
  hud.livesEl.textContent = String(state.lives);
  playerInvulnTimer = 1.2; // seconds of invulnerability
  canvas.classList.remove("flash");
  void canvas.offsetWidth;
  canvas.classList.add("flash");
  // Play hit sound for bullet impacts when not dying to avoid overlapping with game-over sound
  if (source === "bullet" && state.lives > 0) {
    playHitSound();
  }
  if (state.lives <= 0) {
    gameOver();
    return true;
  }
  return false;
}

function playHitSound() {
  try {
    const ctx = getAudioCtx();
    const start = () => {
      const t0 = ctx.currentTime + 0.005;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(620, t0);
      osc.frequency.exponentialRampToValueAtTime(360, t0 + 0.12);
      gain.gain.setValueAtTime(0.03, t0);
      gain.gain.exponentialRampToValueAtTime(0.00001, t0 + 0.14);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.16);
    };
    if (ctx.state === "suspended") {
      ctx.resume().then(start).catch(start);
    } else {
      start();
    }
  } catch (_) {
    // noop
  }
}

// Touch controls wiring for mobile/tablet
(function setupTouchControls() {
  const btnLeft = document.getElementById("btnLeft");
  const btnRight = document.getElementById("btnRight");
  const btnFire = document.getElementById("btnFire");
  const btnMega = document.getElementById("btnMega");
  const btnPause = document.getElementById("btnPause");
  const attachHold = (el, key) => {
    if (!el) return;
    const down = (e) => {
      e.preventDefault();
      keys.add(key);
    };
    const up = (e) => {
      e.preventDefault();
      keys.delete(key);
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("pointerleave", up);
    // Also support touch events on older browsers
    el.addEventListener("touchstart", down, { passive: false });
    el.addEventListener("touchend", up, { passive: false });
  };
  attachHold(btnLeft, "ArrowLeft");
  attachHold(btnRight, "ArrowRight");
  // Fire: hold to auto-fire using existing cooldown logic
  attachHold(btnFire, " ");

  // Mega & Pause are tap actions
  if (btnMega) {
    const onMega = (e) => {
      e.preventDefault();
      tryFireMega();
    };
    btnMega.addEventListener("click", onMega);
    btnMega.addEventListener("pointerup", onMega);
    btnMega.addEventListener("touchend", onMega, { passive: false });
  }
  if (btnPause) {
    const onPause = (e) => {
      e.preventDefault();
      state.running = !state.running;
    };
    btnPause.addEventListener("click", onPause);
    btnPause.addEventListener("pointerup", onPause);
    btnPause.addEventListener("touchend", onPause, { passive: false });
  }
})();

function playGameOverSound() {
  // Try to resume audio context just in case
  try {
    const ctx = getAudioCtx();
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
  } catch (_) {}
  const el = sfxGameOver;
  if (el) {
    try {
      el.currentTime = 0;
      const p = el.play();
      if (p && typeof p.then === "function") {
        p.catch(() => fallbackTone());
      }
      return;
    } catch (_) {
      // fall through
    }
  }
  fallbackTone();
}

function playBulletSound() {
  const el = sfxBullet;
  if (!el) return;
  try {
    el.currentTime = 0;
    const p = el.play();
    if (p && typeof p.then === "function") p.catch(() => {});
  } catch (_) {
    // ignore
  }
}

function fallbackTone() {
  // Retro "system" style game-over chime using Web Audio (no assets)
  const ctx = getAudioCtx();
  const start = () => {
    const t0 = ctx.currentTime + 0.02;
    // Master with gentle volume
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.02, t0);
    // Simple echo
    const delay = ctx.createDelay(1.0);
    delay.delayTime.setValueAtTime(0.18, t0);
    const feedback = ctx.createGain();
    feedback.gain.setValueAtTime(0.28, t0);
    delay.connect(feedback).connect(delay);
    master.connect(ctx.destination);
    master.connect(delay);
    delay.connect(ctx.destination);
    function note(freq, startTime, dur, type = "triangle", peak = 0.05) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, startTime);
      g.gain.setValueAtTime(0.0001, startTime);
      g.gain.exponentialRampToValueAtTime(peak, startTime + 0.012);
      g.gain.exponentialRampToValueAtTime(0.00001, startTime + dur);
      osc.connect(g).connect(master);
      osc.start(startTime);
      osc.stop(startTime + dur + 0.02);
      osc.onended = () => {
        osc.disconnect();
        g.disconnect();
      };
    }
    // "dee dee lee lee lee" motif: two short high beeps then three rising lighter beeps
    // dee dee
    const dur = 0.14;
    note(880.0, t0 + 0 * dur, 0.12, "square", 0.05);
    note(880.0, t0 + 1 * dur, 0.12, "square", 0.05);
    // lee lee lee (ascending)
    note(660.0, t0 + 2 * dur, 0.12, "triangle", 0.045);
    note(740.0, t0 + 3 * dur, 0.12, "triangle", 0.045);
    note(830.0, t0 + 4 * dur, 0.2, "triangle", 0.05);
  };
  if (ctx.state === "suspended") {
    ctx.resume().then(start).catch(start);
  } else {
    start();
  }
}

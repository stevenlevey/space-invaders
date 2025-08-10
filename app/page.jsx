import Script from 'next/script'

export default function Page() {
  return (
    <main>
      <div id="hud">
        <div id="stats">
          <div>
            Score: <span id="score">0</span>
          </div>
          <div>
            Lives: <span id="lives">3</span>
          </div>
          <div>
            Level: <span id="level">1</span>
          </div>
          <div>
            Mega: <span id="mega">Ready</span>
          </div>
        </div>
        <button id="restartBtn" type="button" aria-label="Restart game">
          Restart
        </button>
      </div>

      <canvas id="gameCanvas" width={800} height={600}></canvas>

      <div id="gameOverOverlay" aria-live="polite" aria-hidden="true">
        <div className="retro">
          <canvas id="pixelText" width={800} height={200}></canvas>
          <button id="overlayRestartBtn" type="button" className="retroBtn">
            Restart
          </button>
        </div>
      </div>

      <div id="instructions">
        Move: Arrow Keys or A/D • Shoot: Space • Mega: M • Pause: P • Or click Restart
      </div>

      <audio id="sfxBullet" src="/bullet.mp3" preload="auto"></audio>
      <audio id="sfxGameOver" src="/game over.mp3" preload="auto"></audio>
      <audio id="sfxMega" src="/mega blast.mp3" preload="auto"></audio>

      <Script src="/main.js" strategy="afterInteractive" />
    </main>
  )
}



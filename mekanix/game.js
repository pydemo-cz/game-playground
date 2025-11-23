import { Physics } from './Physics.js';
import { drawMerkur } from './Renderer.js';
import { LevelManager } from './LevelManager.js';
import { GameManager } from './GameManager.js';
import { Editor } from './Editor.js';

// Initialize Physics
const physics = new Physics('world');

// Initialize Systems
const levelManager = new LevelManager(physics, () => {
    document.getElementById('overlay').classList.remove('hidden');
});
const gameManager = new GameManager(physics, levelManager);
const editor = new Editor(gameManager);
gameManager.setEditor(editor);

// Start with Default Level
levelManager.resetLevel();

// UI Elements
const overlay = document.getElementById('overlay');
const nextLevelBtn = document.getElementById('next-level-btn');
// Reset button is now handled by Editor.js via System Menu

// Input handling (Game Mode)
let isPressed = false;

const handleInputStart = (e) => {
    // Only handle game input if PLAYING
    if (gameManager.state !== 'PLAY') return;

    // Ignore clicks on UI buttons
    if (e.target.tagName === 'BUTTON' || e.target.closest('.message-box')) {
         return;
    }

    // Prevent default scrolling unless it's a UI element that needs it (unlikely here)
    if (e.cancelable) e.preventDefault();

    if (!isPressed && levelManager.player) {
        isPressed = true;
        levelManager.player.contract();
    }
};

const handleInputEnd = (e) => {
    if (gameManager.state !== 'PLAY') return;

    if (e.target.tagName === 'BUTTON') return;

    if (isPressed && levelManager.player) {
        isPressed = false;
        levelManager.player.relax();
    }
};

// Global input listeners for Gameplay
// Note: Editor handles its own inputs when in EDIT mode.
window.addEventListener('mousedown', handleInputStart);
window.addEventListener('touchstart', handleInputStart, { passive: false });
window.addEventListener('mouseup', handleInputEnd);
window.addEventListener('touchend', handleInputEnd);

// UI Events
nextLevelBtn.addEventListener('click', () => {
   // Next level logic...
    levelManager.resetLevel();
    overlay.classList.add('hidden');
});

// Game Loop
let lastTime = performance.now();
const gameLoop = () => {
    const now = performance.now();
    const dt = now - lastTime;
    lastTime = now;

    gameManager.update(dt);

    requestAnimationFrame(gameLoop);
};
gameLoop();

// Render Loop
physics.setRenderCallback((ctx) => {
    // Apply Global Camera Transform here so ALL drawing matches the logical coordinate system
    ctx.save();
    ctx.translate(physics.offsetX, physics.offsetY);
    ctx.scale(physics.scaleFactor, physics.scaleFactor);

    drawMerkur(ctx, physics);
    levelManager.draw(ctx); // Draw Goals
    gameManager.draw(ctx); // Draw Editor Gizmos

    ctx.restore();
});

physics.start();

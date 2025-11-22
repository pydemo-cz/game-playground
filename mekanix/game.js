import { Physics } from './Physics.js';
import { drawMerkur } from './Renderer.js';
import { LevelManager } from './LevelManager.js';

// Initialize Physics
const physics = new Physics('world');

// UI Elements
const overlay = document.getElementById('overlay');
const nextLevelBtn = document.getElementById('next-level-btn');
const resetBtn = document.getElementById('reset-btn');

// Level Manager
const levelManager = new LevelManager(physics, () => {
    // On Level Complete
    overlay.classList.remove('hidden');
});

// Start first level
levelManager.startLevel(0);

// Input handling
let isPressed = false;

const handleInputStart = (e) => {
    // e.preventDefault(); // Keeping this might block UI clicks?
    // Only prevent if target is canvas
    if (e.target.tagName !== 'BUTTON') {
         e.preventDefault();
    }

    if (!isPressed && levelManager.player) {
        isPressed = true;
        levelManager.player.contract();
    }
};

const handleInputEnd = (e) => {
    if (e.target.tagName !== 'BUTTON') {
         e.preventDefault();
    }
    if (isPressed && levelManager.player) {
        isPressed = false;
        levelManager.player.relax();
    }
};

window.addEventListener('mousedown', handleInputStart);
window.addEventListener('touchstart', handleInputStart, { passive: false });
window.addEventListener('mouseup', handleInputEnd);
window.addEventListener('touchend', handleInputEnd);

// UI Events
nextLevelBtn.addEventListener('click', () => {
    levelManager.startLevel(levelManager.currentLevelIndex + 1);
});

resetBtn.addEventListener('click', () => {
    levelManager.startLevel(levelManager.currentLevelIndex);
});

// Game Loop Update for Logic
let lastTime = performance.now();
const gameLoop = () => {
    const now = performance.now();
    const dt = now - lastTime;
    lastTime = now;

    levelManager.update(dt);

    requestAnimationFrame(gameLoop);
};
gameLoop();

// Custom renderer callback
physics.setRenderCallback((ctx) => {
    drawMerkur(ctx, physics);
    levelManager.draw(ctx);
});

physics.start();

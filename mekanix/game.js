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
const resetBtn = document.getElementById('reset-btn');
const toolbar = document.getElementById('editor-toolbar');

// Editor Toggle Button (Let's reuse the Reset button as a generic Menu for now, or double tap?)
// User asked for "Editor" functionality. Let's add a visible "Edit" button or key.
// Let's add a small "Edit" button in the corner for now.
const editToggleBtn = document.createElement('button');
editToggleBtn.innerText = '✎';
editToggleBtn.className = 'icon-btn';
editToggleBtn.style.position = 'absolute';
editToggleBtn.style.top = '10px';
editToggleBtn.style.right = '10px';
document.body.appendChild(editToggleBtn);

editToggleBtn.addEventListener('click', () => {
    gameManager.toggleMode();
    if (gameManager.state === 'EDIT') {
        toolbar.classList.remove('hidden');
        editToggleBtn.innerText = '✕';
    } else {
        toolbar.classList.add('hidden');
        editToggleBtn.innerText = '✎';
    }
});

// Toolbar Events
document.getElementById('tool-play').addEventListener('click', () => {
    gameManager.enterPlayMode();
    toolbar.classList.add('hidden');
    editToggleBtn.innerText = '✎';
});

document.getElementById('tool-add-plat').addEventListener('click', () => {
    editor.addPlatform();
});

document.getElementById('tool-add-part').addEventListener('click', () => {
    editor.addConnectedPart();
});

document.getElementById('tool-save').addEventListener('click', () => {
    const data = levelManager.exportLevel();
    localStorage.setItem('mekanix_level_dev', JSON.stringify(data));
    alert('Level saved!');
});

document.getElementById('tool-load').addEventListener('click', () => {
    const json = localStorage.getItem('mekanix_level_dev');
    if (json) {
        levelManager.loadLevel(JSON.parse(json));
        // If in edit mode, we need to ensure editor reflects new objects?
        // Editor checks active lists in update/draw, so it should be fine.
    } else {
        alert('No saved level found.');
    }
});

// Input handling (Game Mode)
let isPressed = false;

const handleInputStart = (e) => {
    // Only handle game input if PLAYING
    if (gameManager.state !== 'PLAY') return;

    if (e.target.tagName !== 'BUTTON') {
         e.preventDefault();
    }

    if (!isPressed && levelManager.player) {
        isPressed = true;
        levelManager.player.contract();
    }
};

const handleInputEnd = (e) => {
    if (gameManager.state !== 'PLAY') return;

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
   // Next level logic... (omitted for custom levels for now, just reset)
    levelManager.resetLevel();
    overlay.classList.add('hidden');
});

resetBtn.addEventListener('click', () => {
    levelManager.resetLevel();
    // If we are editing, this might reset to initial load?
    // Reset implies restarting the level.
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
    drawMerkur(ctx, physics);
    levelManager.draw(ctx); // Draw Goals
    gameManager.draw(ctx); // Draw Editor Gizmos
});

physics.start();

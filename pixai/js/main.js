// Pixai - Infinite Pixel World Prototype
import { Camera } from './Camera.js';
import { InputManager } from './InputManager.js';
import { ChunkManager } from './ChunkManager.js';

console.log("Pixai initializing...");

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });

// Initialize Camera centered at 0,0
const camera = new Camera(0, 0, window.innerWidth, window.innerHeight);
const inputManager = new InputManager(camera);
const chunkManager = new ChunkManager(1000); // 1000x1000 pixel chunks

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    camera.resize(canvas.width, canvas.height);
}

window.addEventListener('resize', resize);
resize();

let lastTime = 0;
let visibleChunksCount = 0;
let totalObjectsDrawn = 0;

function loop(timestamp) {
    const dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    // Update
    inputManager.update(dt);

    // Clear screen
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Get visible bounds
    const bounds = camera.getBounds();

    // Draw Grid (World Space)
    drawGrid(bounds);

    // Draw Chunks & Objects
    drawWorld(bounds);

    // Debug Info
    drawDebugInfo();

    requestAnimationFrame(loop);
}

function drawWorld(bounds) {
    const chunks = chunkManager.getVisibleChunks(bounds);
    visibleChunksCount = chunks.length;
    totalObjectsDrawn = 0;

    for (const chunk of chunks) {
        // Optimization: Check if chunk is actually visible (it should be, based on getVisibleChunks)
        // Draw objects
        for (const obj of chunk.objects) {
            // Frustum Culling: Check if object is within bounds
            if (obj.x + obj.w < bounds.left || obj.x > bounds.right ||
                obj.y + obj.h < bounds.top || obj.y > bounds.bottom) {
                continue;
            }

            const p1 = camera.worldToScreen(obj.x, obj.y);
            // Size needs to be scaled too
            const w = obj.w * camera.scale;
            const h = obj.h * camera.scale;

            ctx.fillStyle = obj.color;
            // Round to integer for crisp rendering? Or subpixel?
            // User requested pixel art style, but for now simple rects
            ctx.fillRect(Math.floor(p1.x), Math.floor(p1.y), Math.ceil(w), Math.ceil(h));

            totalObjectsDrawn++;
        }
    }
}

function drawGrid(bounds) {
    const gridSize = 100;

    // Calculate grid start/end based on visible bounds
    const startX = Math.floor(bounds.left / gridSize) * gridSize;
    const endX = Math.floor(bounds.right / gridSize) * gridSize;
    const startY = Math.floor(bounds.top / gridSize) * gridSize;
    const endY = Math.floor(bounds.bottom / gridSize) * gridSize;

    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let x = startX; x <= endX; x += gridSize) {
        const p1 = camera.worldToScreen(x, bounds.top);
        const p2 = camera.worldToScreen(x, bounds.bottom);
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
    }

    for (let y = startY; y <= endY; y += gridSize) {
        const p1 = camera.worldToScreen(bounds.left, y);
        const p2 = camera.worldToScreen(bounds.right, y);
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
    }

    ctx.stroke();

    // Draw Center Origin
    const center = camera.worldToScreen(0, 0);
    ctx.fillStyle = 'red';
    ctx.beginPath();
    ctx.arc(center.x, center.y, 5, 0, Math.PI * 2);
    ctx.fill();
}

function drawDebugInfo() {
    ctx.fillStyle = 'white';
    ctx.font = '14px monospace';
    ctx.fillText(`Cam: ${Math.round(camera.x)}, ${Math.round(camera.y)}`, 10, 20);
    ctx.fillText(`Scale: ${camera.scale}`, 10, 40);
    ctx.fillText(`Chunks: ${visibleChunksCount}`, 10, 60);
    ctx.fillText(`Objs: ${totalObjectsDrawn}`, 10, 80);
    ctx.fillText(`Use WASD or Drag to move`, 10, 100);
}

requestAnimationFrame(loop);

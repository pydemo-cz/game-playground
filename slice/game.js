/**
 * Slice - A Neon Xonix-like game
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game Constants
const TARGET_FPS = 60;
const SLOW_MO_SCALE = 0.1;
const NORMAL_SPEED_SCALE = 1.0;
const CELL_SIZE = 20; // Grid resolution

// Grid Cell Types
const CELL_EMPTY = 0;
const CELL_FILLED = 1;
const CELL_TRAIL = 2;

// Game State
let gameState = {
    isRunning: false,
    isGameOver: false,
    score: 0,
    highScore: 0,
    lives: 3,
    width: 0,
    height: 0,
    rows: 0,
    cols: 0,
    lastTime: 0,
    timeScale: SLOW_MO_SCALE,

    grid: [], // 2D array
    trail: [], // Array of {c, r} coordinates

    // Player
    player: {
        x: 0,
        y: 0,
        c: 0, // Grid col
        r: 0, // Grid row
        speed: 200,
        dirX: 0,
        dirY: 0,
        radius: 5,
        color: '#00f3ff',
        isDrawing: false
    },

    enemies: [],
    particles: []
};

const ENEMY_TYPE_BOUNCER = 0;
const ENEMY_TYPE_CRAWLER = 1;
const ENEMY_TYPE_CHASER = 2;

function createEnemy(type) {
    const enemy = {
        type: type,
        x: 0, y: 0,
        dirX: Math.random() > 0.5 ? 1 : -1,
        dirY: Math.random() > 0.5 ? 1 : -1,
        speed: 100,
        radius: 6,
        color: '#ff0000'
    };

    if (type === ENEMY_TYPE_BOUNCER) {
        enemy.color = '#ff0000'; // Neon Red
        enemy.speed = 150;
        // Spawn in empty area (find one)
        let r, c;
        do {
            r = Math.floor(Math.random() * gameState.rows);
            c = Math.floor(Math.random() * gameState.cols);
        } while (gameState.grid[r][c] !== CELL_EMPTY);
        enemy.x = c * CELL_SIZE + CELL_SIZE/2;
        enemy.y = r * CELL_SIZE + CELL_SIZE/2;
    } else if (type === ENEMY_TYPE_CHASER) {
        enemy.color = '#ff9900'; // Neon Orange
        enemy.speed = 120;
        let r, c;
        do {
            r = Math.floor(Math.random() * gameState.rows);
            c = Math.floor(Math.random() * gameState.cols);
        } while (gameState.grid[r][c] !== CELL_EMPTY);
        enemy.x = c * CELL_SIZE + CELL_SIZE/2;
        enemy.y = r * CELL_SIZE + CELL_SIZE/2;
    } else if (type === ENEMY_TYPE_CRAWLER) {
        enemy.color = '#00ff00'; // Neon Green
        enemy.speed = 100;
        // Spawn on filled area edge? simpler to just spawn safe
        enemy.c = 0;
        enemy.r = 0; // Top left safe zone
        enemy.x = enemy.c * CELL_SIZE + CELL_SIZE/2;
        enemy.y = enemy.r * CELL_SIZE + CELL_SIZE/2;
        enemy.dirX = 1; enemy.dirY = 0; // Start moving right
    }

    gameState.enemies.push(enemy);
}

// Input State
const input = {
    isTouching: false,
    startX: 0,
    startY: 0,
    threshold: 30 // pixels to register a swipe
};

function handleInputStart(x, y) {
    input.isTouching = true;
    input.startX = x;
    input.startY = y;
    gameState.timeScale = NORMAL_SPEED_SCALE;
}

function handleInputEnd() {
    input.isTouching = false;
    // Only allow Slow Mo if NOT drawing
    if (!gameState.player.isDrawing) {
        gameState.timeScale = SLOW_MO_SCALE;
    } else {
        gameState.timeScale = NORMAL_SPEED_SCALE;
    }
}

function handleInputMove(x, y) {
    if (!input.isTouching) return;

    const dx = x - input.startX;
    const dy = y - input.startY;

    if (Math.abs(dx) > input.threshold || Math.abs(dy) > input.threshold) {
        // Determine direction
        if (Math.abs(dx) > Math.abs(dy)) {
            // Horizontal
            if (dx > 0) changeDirection(1, 0);
            else changeDirection(-1, 0);
        } else {
            // Vertical
            if (dy > 0) changeDirection(0, 1);
            else changeDirection(0, -1);
        }

        // Reset anchor to allow continuous steering
        input.startX = x;
        input.startY = y;
    }
}

function changeDirection(dx, dy) {
    // Prevent reversing directly (180 degree turn)
    if (gameState.player.dirX !== 0 && dx === -gameState.player.dirX) return;
    if (gameState.player.dirY !== 0 && dy === -gameState.player.dirY) return;

    gameState.player.dirX = dx;
    gameState.player.dirY = dy;
}

// Event Listeners for Controls
canvas.addEventListener('mousedown', e => handleInputStart(e.clientX, e.clientY));
canvas.addEventListener('mousemove', e => handleInputMove(e.clientX, e.clientY));
canvas.addEventListener('mouseup', handleInputEnd);
canvas.addEventListener('mouseleave', handleInputEnd);

canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    handleInputStart(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: false });

canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    handleInputMove(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: false });

canvas.addEventListener('touchend', e => {
    e.preventDefault();
    handleInputEnd();
});

function initGrid() {
    gameState.cols = Math.ceil(gameState.width / CELL_SIZE);
    gameState.rows = Math.ceil(gameState.height / CELL_SIZE);
    gameState.grid = [];

    for (let r = 0; r < gameState.rows; r++) {
        gameState.grid[r] = [];
        for (let c = 0; c < gameState.cols; c++) {
            if (r < 2 || r >= gameState.rows - 2 || c < 2 || c >= gameState.cols - 2) {
                gameState.grid[r][c] = CELL_FILLED;
            } else {
                gameState.grid[r][c] = CELL_EMPTY;
            }
        }
    }
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gameState.width = canvas.width;
    gameState.height = canvas.height;

    if (!gameState.isRunning) {
        initGrid();
        // Reset player to top center safe zone
        gameState.player.c = Math.floor(gameState.cols / 2);
        gameState.player.r = 0;
        gameState.player.x = gameState.player.c * CELL_SIZE + CELL_SIZE / 2;
        gameState.player.y = gameState.player.r * CELL_SIZE + CELL_SIZE / 2;
    }
}

function startLoop() {
    gameState.lastTime = performance.now();
    requestAnimationFrame(loop);
}

function loop(timestamp) {
    const dt = (timestamp - gameState.lastTime) / 1000;
    gameState.lastTime = timestamp;

    if (gameState.isRunning && !gameState.isGameOver) {
        update(dt);
    }
    draw();

    requestAnimationFrame(loop);
}

function update(dt) {
    const scaledDt = dt * gameState.timeScale;

    // Update Particles
    for (let i = gameState.particles.length - 1; i >= 0; i--) {
        let p = gameState.particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt * 2;
        if (p.life <= 0) {
            gameState.particles.splice(i, 1);
        }
    }

    // Update Player
    if (gameState.player.dirX !== 0 || gameState.player.dirY !== 0) {
        // Move player
        let nextX = gameState.player.x + gameState.player.dirX * gameState.player.speed * scaledDt;
        let nextY = gameState.player.y + gameState.player.dirY * gameState.player.speed * scaledDt;

        // Constrain to canvas
        nextX = Math.max(gameState.player.radius, Math.min(gameState.width - gameState.player.radius, nextX));
        nextY = Math.max(gameState.player.radius, Math.min(gameState.height - gameState.player.radius, nextY));

        gameState.player.x = nextX;
        gameState.player.y = nextY;

        // Update Grid Coordinates
        const prevC = gameState.player.c;
        const prevR = gameState.player.r;
        const newC = Math.floor(gameState.player.x / CELL_SIZE);
        const newR = Math.floor(gameState.player.y / CELL_SIZE);

        // Check if moved to a new cell
        if (newC !== prevC || newR !== prevR) {
            handleGridMovement(newC, newR);
        }
    }

    // Update Enemies
    updateEnemies(scaledDt);
}

function updateEnemies(dt) {
    gameState.enemies.forEach(enemy => {
        if (enemy.type === ENEMY_TYPE_BOUNCER || enemy.type === ENEMY_TYPE_CHASER) {
            // Basic Movement
            let moveX = enemy.dirX;
            let moveY = enemy.dirY;

            if (enemy.type === ENEMY_TYPE_CHASER && gameState.player.isDrawing) {
                // Target player
                const dx = gameState.player.x - enemy.x;
                const dy = gameState.player.y - enemy.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (dist > 0) {
                    // Add steering force
                    moveX += (dx / dist) * 0.05; // Steer slowly
                    moveY += (dy / dist) * 0.05;
                    // Normalize
                    const len = Math.sqrt(moveX*moveX + moveY*moveY);
                    moveX /= len;
                    moveY /= len;

                    enemy.dirX = moveX;
                    enemy.dirY = moveY;
                }
            }

            let nextX = enemy.x + moveX * enemy.speed * dt;
            let nextY = enemy.y + moveY * enemy.speed * dt;

            // Collision with Walls (Filled Areas)
            // Check grid pos of next position
            const c = Math.floor(nextX / CELL_SIZE);
            const r = Math.floor(nextY / CELL_SIZE);

            if (c < 0 || c >= gameState.cols || r < 0 || r >= gameState.rows || gameState.grid[r][c] === CELL_FILLED) {
                // Bounce
                // Simple bounce: invert direction based on which boundary was hit?
                // This is tricky with grid. Simple approximation:
                // Check if X caused it
                const cX = Math.floor(nextX / CELL_SIZE);
                const rOld = Math.floor(enemy.y / CELL_SIZE);
                 if (cX < 0 || cX >= gameState.cols || gameState.grid[rOld][cX] === CELL_FILLED) {
                    enemy.dirX *= -1;
                    nextX = enemy.x; // Reset position
                }

                // Check if Y caused it
                const rY = Math.floor(nextY / CELL_SIZE);
                const cOld = Math.floor(enemy.x / CELL_SIZE);
                if (rY < 0 || rY >= gameState.rows || gameState.grid[rY][cOld] === CELL_FILLED) {
                    enemy.dirY *= -1;
                    nextY = enemy.y;
                }
            }

            enemy.x = nextX;
            enemy.y = nextY;

        } else if (enemy.type === ENEMY_TYPE_CRAWLER) {
             // Simplistic crawler: randomly roam filled areas?
             // Or strictly follow edge? Edge following is complex to code quickly.
             // Alternative: Crawler moves ONLY inside FILLED cells, but tries to be near EMPTY cells.
             // Let's make them move inside FILLED cells.
             // If it hits EMPTY, it bounces back.
             // If it hits Player (who is on Safe), Player dies.

             let nextX = enemy.x + enemy.dirX * enemy.speed * dt;
             let nextY = enemy.y + enemy.dirY * enemy.speed * dt;

             const c = Math.floor(nextX / CELL_SIZE);
             const r = Math.floor(nextY / CELL_SIZE);

             // If hits EMPTY or boundary, bounce
             if (c < 0 || c >= gameState.cols || r < 0 || r >= gameState.rows || gameState.grid[r][c] === CELL_EMPTY || gameState.grid[r][c] === CELL_TRAIL) {
                  enemy.dirX = Math.random() > 0.5 ? 1 : -1;
                  enemy.dirY = Math.random() > 0.5 ? 1 : -1;
                  // Ensure non-zero and normalized
                  if (Math.abs(enemy.dirX) > 0 && Math.abs(enemy.dirY) > 0) enemy.dirX = 0; // Cardinal only?

                  nextX = enemy.x;
                  nextY = enemy.y;
             }

             enemy.x = nextX;
             enemy.y = nextY;
        }

        // Player Collision Logic
        const dx = enemy.x - gameState.player.x;
        const dy = enemy.y - gameState.player.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < (enemy.radius + gameState.player.radius)) {
            handleGameOver();
        }

        // Trail Collision Logic (for Bouncers/Chasers)
        if (enemy.type !== ENEMY_TYPE_CRAWLER) {
            // Check if enemy is inside a TRAIL cell
            const c = Math.floor(enemy.x / CELL_SIZE);
            const r = Math.floor(enemy.y / CELL_SIZE);
            if (c >= 0 && r >= 0 && c < gameState.cols && r < gameState.rows && gameState.grid[r][c] === CELL_TRAIL) {
                handleGameOver();
            }
        }
    });
}

function handleGridMovement(c, r) {
    if (c < 0 || r < 0 || c >= gameState.cols || r >= gameState.rows) return;

    gameState.player.c = c;
    gameState.player.r = r;
    const cellType = gameState.grid[r][c];

    if (cellType === CELL_FILLED) {
        if (gameState.player.isDrawing) {
            // Close the loop
            fillArea();
            gameState.player.isDrawing = false;
            gameState.trail = [];
        }

        // Entered safe zone: Check if we should slow down (user not touching)
        if (!input.isTouching) {
            gameState.timeScale = SLOW_MO_SCALE;
        }

    } else if (cellType === CELL_EMPTY) {
        if (!gameState.player.isDrawing) {
            gameState.player.isDrawing = true;
            // Force normal speed when starting to draw
            gameState.timeScale = NORMAL_SPEED_SCALE;
        }
        // Add to trail
        gameState.grid[r][c] = CELL_TRAIL;
        gameState.trail.push({c, r});
    } else if (cellType === CELL_TRAIL) {
        // Self collision - Game Over
        if (gameState.trail.length > 1) { // Ignore immediate backtrack if logical, but usually Xonix dies
             // Simple check: if we hit a trail that isn't the one we just made (last one)
             // But since we move cell by cell, hitting *any* trail cell is death usually.
             // Exception: The very first step into trail? No, trail is 2.
             handleGameOver();
        }
    }
}

function fillArea() {
    // 1. Convert trail to filled
    gameState.trail.forEach(pos => {
        gameState.grid[pos.r][pos.c] = CELL_FILLED;
    });

    // 2. Flood fill algorithm to find empty pockets
    // We need to find which connected components of EMPTY do NOT contain enemies.
    // Those components get FILLED.

    // Create a copy of grid for visiting
    let visited = new Array(gameState.rows).fill(0).map(() => new Array(gameState.cols).fill(false));

    // Helper to check bounds
    const isValid = (c, r) => c >= 0 && r >= 0 && c < gameState.cols && r < gameState.rows;

    // Identify enemy positions (grid coords)
    const enemyPositions = gameState.enemies.map(e => ({
        c: Math.floor(e.x / CELL_SIZE),
        r: Math.floor(e.y / CELL_SIZE)
    }));

    // Find all connected components of EMPTY cells
    for (let r = 0; r < gameState.rows; r++) {
        for (let c = 0; c < gameState.cols; c++) {
            if (gameState.grid[r][c] === CELL_EMPTY && !visited[r][c]) {
                // Start BFS/DFS for this component
                let component = [];
                let hasEnemy = false;
                let queue = [{c, r}];
                visited[r][c] = true;

                while (queue.length > 0) {
                    let curr = queue.shift();
                    component.push(curr);

                    // Check if this cell has an enemy
                    if (enemyPositions.some(e => e.c === curr.c && e.r === curr.r)) {
                        hasEnemy = true;
                    }

                    // Neighbors
                    const dirs = [[0,1], [0,-1], [1,0], [-1,0]];
                    dirs.forEach(([dc, dr]) => {
                        const nc = curr.c + dc;
                        const nr = curr.r + dr;
                        if (isValid(nc, nr) && !visited[nr][nc] && gameState.grid[nr][nc] === CELL_EMPTY) {
                            visited[nr][nc] = true;
                            queue.push({c: nc, r: nr});
                        }
                    });
                }

                // If no enemy in this component, fill it!
                if (!hasEnemy) {
                    component.forEach(pos => {
                        gameState.grid[pos.r][pos.c] = CELL_FILLED;
                        gameState.score += 10;
                        // Visual effect
                        if (Math.random() > 0.9) {
                            spawnParticle(pos.c * CELL_SIZE, pos.r * CELL_SIZE, '#00f3ff');
                        }
                    });
                }
            }
        }
    }

    document.getElementById('score').innerText = `Score: ${gameState.score}`;
    checkDifficulty();
}

function checkDifficulty() {
    // Spawn new enemy every 500 points
    const expectedEnemies = 4 + Math.floor(gameState.score / 500);
    if (gameState.enemies.length < expectedEnemies) {
        const type = Math.random() > 0.5 ? ENEMY_TYPE_BOUNCER : ENEMY_TYPE_CHASER;
        createEnemy(type);
    }
}

function spawnParticle(x, y, color) {
    gameState.particles.push({
        x: x, y: y,
        vx: (Math.random() - 0.5) * 100,
        vy: (Math.random() - 0.5) * 100,
        life: 1.0,
        color: color
    });
}

function handleGameOver() {
    gameState.lives--;
    document.getElementById('lives').innerText = `Lives: ${gameState.lives}`;

    // Particle explosion at player pos
    for(let i=0; i<20; i++) spawnParticle(gameState.player.x, gameState.player.y, '#ff0000');

    if (gameState.lives <= 0) {
        gameState.isGameOver = true;
        gameState.isRunning = false;

        // High Score Logic
        if (gameState.score > gameState.highScore) {
            gameState.highScore = gameState.score;
            localStorage.setItem('slice_highscore', gameState.highScore);
        }
        document.getElementById('high-score').innerText = `High Score: ${gameState.highScore}`;

        document.getElementById('final-score').innerText = `Score: ${gameState.score}`;
        document.getElementById('game-over-screen').classList.remove('hidden');
    } else {
        // Reset player
        gameState.player.isDrawing = false;
        // Clear trail
        gameState.trail.forEach(pos => {
            gameState.grid[pos.r][pos.c] = CELL_EMPTY;
        });
        gameState.trail = [];
        // Teleport to safe zone
        gameState.player.c = Math.floor(gameState.cols / 2);
        gameState.player.r = 0;
        gameState.player.x = gameState.player.c * CELL_SIZE + CELL_SIZE/2;
        gameState.player.y = gameState.player.r * CELL_SIZE + CELL_SIZE/2;
        gameState.player.dirX = 0;
        gameState.player.dirY = 0;
    }
}

function draw() {
    // Clear screen
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, gameState.width, gameState.height);

    if (gameState.isGameOver) {
        // Just clear/black out everything behind UI
        return;
    }

    // Draw Grid (Filled Areas)
    ctx.fillStyle = '#222'; // Empty area debug color? or just black
    // Actually empty is background.

    // Draw Filled
    ctx.fillStyle = 'rgba(0, 243, 255, 0.2)'; // Neon Blue Low Opacity
    for (let r = 0; r < gameState.rows; r++) {
        for (let c = 0; c < gameState.cols; c++) {
            if (gameState.grid[r][c] === CELL_FILLED) {
                ctx.fillRect(c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE, CELL_SIZE);
            } else if (gameState.grid[r][c] === CELL_TRAIL) {
                ctx.fillStyle = '#ff00ff'; // Trail Pink
                ctx.fillRect(c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE, CELL_SIZE);
                ctx.fillStyle = 'rgba(0, 243, 255, 0.2)'; // Restore
            }
        }
    }

    // Draw Enemies
    gameState.enemies.forEach(enemy => {
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
        ctx.fillStyle = enemy.color;
        ctx.fill();
        ctx.shadowBlur = 10;
        ctx.shadowColor = enemy.color;
        ctx.fill();
        ctx.shadowBlur = 0;
    });

    // Draw Particles
    gameState.particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.fillRect(p.x, p.y, 4, 4);
        ctx.globalAlpha = 1.0;
    });

    // Draw Player
    ctx.beginPath();
    ctx.arc(gameState.player.x, gameState.player.y, gameState.player.radius, 0, Math.PI * 2);
    ctx.fillStyle = gameState.player.color;
    ctx.fill();

    // Draw Glow
    ctx.shadowBlur = 10;
    ctx.shadowColor = gameState.player.color;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Debug
    // ctx.fillStyle = 'white';
    // ctx.fillText(`Pos: ${gameState.player.c}, ${gameState.player.r}`, 10, 70);
}

// Initialization
gameState.highScore = parseInt(localStorage.getItem('slice_highscore')) || 0;
document.getElementById('high-score').innerText = `High Score: ${gameState.highScore}`;

window.addEventListener('resize', resize);
resize();
startLoop();

// UI Event Listeners
document.getElementById('start-btn').addEventListener('click', () => {
    document.getElementById('start-screen').classList.add('hidden');
    gameState.isRunning = true;
    gameState.player.dirX = 0;
    gameState.player.dirY = 0;
    gameState.enemies = [];
    // Spawn enemies
    createEnemy(ENEMY_TYPE_BOUNCER);
    createEnemy(ENEMY_TYPE_BOUNCER);
    createEnemy(ENEMY_TYPE_CHASER);
    createEnemy(ENEMY_TYPE_CRAWLER);
});

document.getElementById('restart-btn').addEventListener('click', () => {
    document.getElementById('game-over-screen').classList.add('hidden');
    gameState.isRunning = true;
    gameState.isGameOver = false;
    gameState.score = 0;
    gameState.lives = 3;
    gameState.player.x = gameState.width / 2;
    gameState.player.y = 0;
    gameState.player.dirX = 0;
    gameState.player.dirY = 0;
    resize(); // Resets grid
    gameState.enemies = [];
    createEnemy(ENEMY_TYPE_BOUNCER);
    createEnemy(ENEMY_TYPE_BOUNCER);
    createEnemy(ENEMY_TYPE_CHASER);
    createEnemy(ENEMY_TYPE_CRAWLER);
});

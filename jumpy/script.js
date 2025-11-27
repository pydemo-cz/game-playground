// Jumpy - A 2D Platformer
// Core script file

class InputManager {
    constructor(canvas) {
        this.keys = {};
        this.keyPressTimes = {};
        this.doubleTapThreshold = 300; // ms

        this.mouse = { x: 0, y: 0, down: false };

        window.addEventListener('keydown', e => {
            const now = performance.now();
            if (this.isDoubleTap(e.code, now)) {
                this.keys[`${e.code}_double_tap`] = true;
            } else {
                this.keys[`${e.code}_double_tap`] = false;
            }
            this.keyPressTimes[e.code] = now;
            this.keys[e.code] = true;
        });

        window.addEventListener('keyup', e => {
            this.keys[e.code] = false;
            this.keys[`${e.code}_double_tap`] = false;
        });

        canvas.addEventListener('mousemove', e => {
            const rect = canvas.getBoundingClientRect();
            this.mouse.x = e.clientX - rect.left;
            this.mouse.y = e.clientY - rect.top;
        });

        canvas.addEventListener('mousedown', () => this.mouse.down = true);
        canvas.addEventListener('mouseup', () => this.mouse.down = false);
    }

    isKeyDown(key) {
        return this.keys[key] || false;
    }

    isDoubleTap(key, now) {
        const lastPress = this.keyPressTimes[key] || 0;
        return now - lastPress < this.doubleTapThreshold;
    }

    consumeDoubleTap(key) {
        const doubleTapKey = `${key}_double_tap`;
        const wasDoubleTapped = this.keys[doubleTapKey];
        if (wasDoubleTapped) {
            this.keys[doubleTapKey] = false;
        }
        return wasDoubleTapped;
    }
}

class Player {
    constructor(game) {
        this.game = game;
        this.width = 50;
        this.height = 50;
        this.x = this.game.canvas.width / 2 - this.width / 2;
        this.y = this.game.canvas.height - this.height - 100;
        this.vx = 0;
        this.vy = 0;
        this.speed = 5;
        this.jumpForce = 20;
        this.gravity = 0.8;
        this.onGround = false;

        // Dashing
        this.isDashing = false;
        this.dashSpeed = 20;
        this.dashDuration = 150; // ms
        this.dashTimer = 0;
        this.dashCooldown = 500; // ms
        this.dashCooldownTimer = 0;
    }

    reset() {
        this.x = this.game.canvas.width / 2 - this.width / 2;
        this.y = this.game.canvas.height - this.height - 100;
        this.vx = 0;
        this.vy = 0;
        this.onGround = false;
    }

    update(deltaTime, input) {
        // Cooldown timers
        if (this.dashTimer > 0) this.dashTimer -= deltaTime;
        if (this.dashCooldownTimer > 0) this.dashCooldownTimer -= deltaTime;

        // Dash logic
        if (input.consumeDoubleTap('KeyA') && this.dashCooldownTimer <= 0) {
            this.isDashing = true;
            this.dashTimer = this.dashDuration;
            this.vx = -this.dashSpeed;
            this.dashCooldownTimer = this.dashCooldown;
        } else if (input.consumeDoubleTap('KeyD') && this.dashCooldownTimer <= 0) {
            this.isDashing = true;
            this.dashTimer = this.dashDuration;
            this.vx = this.dashSpeed;
            this.dashCooldownTimer = this.dashCooldown;
        }

        if (this.dashTimer <= 0) {
            this.isDashing = false;
        }

        // Horizontal movement
        if (!this.isDashing) {
            if (input.isKeyDown('KeyA')) {
                this.vx = -this.speed;
            } else if (input.isKeyDown('KeyD')) {
                this.vx = this.speed;
            } else {
                this.vx = 0;
            }
        }
        this.x += this.vx;

        // Vertical movement (Jumping)
        if (input.isKeyDown('Space') && this.onGround) {
            this.vy = -this.jumpForce;
            this.onGround = false;
        }
        this.vy += this.gravity;
        this.y += this.vy;

        // Platform collision
        this.onGround = false;
        this.game.platforms.forEach(platform => {
            if (this.x < platform.x + platform.width &&
                this.x + this.width > platform.x &&
                this.y + this.height > platform.y &&
                this.y < platform.y + platform.height &&
                this.vy >= 0) {
                // Check if the player was above the platform in the previous frame
                if ((this.y + this.height) - this.vy <= platform.y) {
                    this.y = platform.y - this.height;
                    this.vy = 0;
                    this.onGround = true;
                }
            }
        });

        // Collision with floor
        if (this.y + this.height > this.game.canvas.height) {
            this.y = this.game.canvas.height - this.height;
            this.vy = 0;
            this.onGround = true;
        }

        // Spike collision
        this.game.spikes.forEach(spike => {
            if (this.x < spike.x + spike.width &&
                this.x + this.width > spike.x &&
                this.y < spike.y + spike.height &&
                this.y + this.height > spike.y) {
                this.game.loadLevelData(this.game.levelManager.loadLevel(this.game.currentLevelName));
            }
        });

        // Coin collision
        this.game.coins = this.game.coins.filter(coin => {
            const dist = Math.hypot(this.x + this.width / 2 - coin.x, this.y + this.height / 2 - coin.y);
            return dist >= this.width / 2 + coin.radius;
        });

        // Finish line collision
        const finish = this.game.finishLine;
        if (this.x < finish.x + finish.width &&
            this.x + this.width > finish.x &&
            this.y < finish.y + finish.height &&
            this.y + this.height > finish.y) {
            console.log("Level Complete!");
            this.game.loadLevelData(this.game.levelManager.loadLevel(this.game.currentLevelName)); // For now, just restart
        }
    }

    draw(ctx) {
        ctx.fillStyle = 'red';
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}

class Platform {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    draw(ctx) {
        ctx.fillStyle = 'green';
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}

class Spike {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 40;
        this.height = 40;
    }

    draw(ctx) {
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.moveTo(this.x, this.y + this.height);
        ctx.lineTo(this.x + this.width / 2, this.y);
        ctx.lineTo(this.x + this.width, this.y + this.height);
        ctx.closePath();
        ctx.fill();
    }
}

class Coin {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 15;
    }

    draw(ctx) {
        ctx.fillStyle = 'gold';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

class FinishLine {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 50;
        this.height = 50;
    }

    draw(ctx) {
        ctx.fillStyle = 'blue';
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}

class LevelManager {
    constructor() {
        this.levels = JSON.parse(localStorage.getItem('jumpy_levels') || '{}');
        this.installDefaultLevels();
    }

    installDefaultLevels() {
        if (localStorage.getItem('jumpy_defaults_installed')) return;

        const defaultLevels = {
            "Level 1: The Basics": {
                platforms: [
                    {x: 120, y: 840, width: 240, height: 20},
                    {x: 480, y: 760, width: 240, height: 20},
                    {x: 840, y: 680, width: 240, height: 20}
                ],
                spikes: [],
                coins: [{x: 580, y: 720}],
                finishLine: {x: 960, y: 600, width: 50, height: 50}
            },
            "Level 2: A Little Tricky": {
                platforms: [
                    {x: 80, y: 840, width: 160, height: 20},
                    {x: 400, y: 760, width: 80, height: 20},
                    {x: 600, y: 680, width: 80, height: 20},
                    {x: 840, y: 600, width: 240, height: 20}
                ],
                spikes: [
                    {x: 240, y: 880}, {x: 280, y: 880}, {x: 320, y: 880}
                ],
                coins: [{x: 420, y: 720}],
                finishLine: {x: 960, y: 520, width: 50, height: 50}
            },
            "Level 3: The Challenge": {
                platforms: [
                    {x: 40, y: 840, width: 80, height: 20},
                    {x: 280, y: 800, width: 80, height: 20},
                    {x: 40, y: 680, width: 80, height: 20},
                    {x: 600, y: 800, width: 80, height: 20},
                    {x: 920, y: 400, width: 80, height: 20},
                    {x: 1200, y: 320, width: 160, height: 20}
                ],
                spikes: [
                    {x: 400, y: 880}, {x: 440, y: 880}, {x: 480, y: 880},
                    {x: 720, y: 880}, {x: 760, y: 880}, {x: 800, y: 880}
                ],
                coins: [{x: 60, y: 640}], // The hard to reach coin
                finishLine: {x: 1240, y: 240, width: 50, height: 50}
            }
        };

        // Only add default levels if they don't already exist
        for (const levelName in defaultLevels) {
            if (!this.levels[levelName]) {
                this.levels[levelName] = defaultLevels[levelName];
            }
        }

        localStorage.setItem('jumpy_levels', JSON.stringify(this.levels));
        localStorage.setItem('jumpy_defaults_installed', 'true');
    }

    saveLevel(name, data) {
        this.levels[name] = data;
        localStorage.setItem('jumpy_levels', JSON.stringify(this.levels));
    }

    loadLevel(name) {
        return this.levels[name] || this.createEmptyLevel();
    }

    deleteLevel(name) {
        delete this.levels[name];
        localStorage.setItem('jumpy_levels', JSON.stringify(this.levels));
    }

    getListOfLevels() {
        return Object.keys(this.levels);
    }

    createEmptyLevel() {
        return {
            platforms: [],
            spikes: [],
            coins: [],
            finishLine: null
        };
    }
}

class UIManager {
    constructor(game) {
        this.game = game;
        this.playBtn = document.getElementById('play-btn');
        this.editBtn = document.getElementById('edit-btn');
        this.toolBtns = document.querySelectorAll('.tool-btn');
        this.saveBtn = document.getElementById('save-btn');
        this.levelSelect = document.getElementById('level-select');
        this.deleteBtn = document.getElementById('delete-btn');

        this.setupEventListeners();
        this.updateLevelList();
    }

    setupEventListeners() {
        this.playBtn.addEventListener('click', () => this.game.setMode('play'));
        this.editBtn.addEventListener('click', () => this.game.setMode('edit'));
        this.saveBtn.addEventListener('click', () => {
            this.game.saveCurrentLevel();
            this.updateLevelList();
        });
        this.deleteBtn.addEventListener('click', () => {
            const selectedLevel = this.levelSelect.value;
            if (selectedLevel && confirm(`Are you sure you want to delete "${selectedLevel}"?`)) {
                this.game.levelManager.deleteLevel(selectedLevel);
                this.updateLevelList();
                this.game.loadLevelByName('Untitled Level'); // Load a fresh level
            }
        });

        this.levelSelect.addEventListener('change', (e) => {
            this.game.loadLevelByName(e.target.value);
        });

        this.toolBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.toolBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.game.selectedObjectType = btn.dataset.tool;
            });
        });
    }

    updateLevelList() {
        this.levelSelect.innerHTML = '';
        const levels = this.game.levelManager.getListOfLevels();
        // Add a default option for creating a new level
        const newOption = document.createElement('option');
        newOption.value = 'Untitled Level';
        newOption.textContent = 'New Level';
        this.levelSelect.appendChild(newOption);

        levels.forEach(levelName => {
            const option = document.createElement('option');
            option.value = levelName;
            option.textContent = levelName;
            this.levelSelect.appendChild(option);
        });
        this.levelSelect.value = this.game.currentLevelName;
    }

    setMode(mode) {
        if (mode === 'play') {
            this.playBtn.classList.add('active');
            this.editBtn.classList.remove('active');
            document.getElementById('editor-ui').style.display = 'none';
        } else {
            this.playBtn.classList.remove('active');
            this.editBtn.classList.add('active');
            document.getElementById('editor-ui').style.display = 'flex';
        }
    }
}

class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.input = new InputManager(canvas);
        this.player = new Player(this);
        this.levelManager = new LevelManager();
        this.uiManager = new UIManager(this);

        this.mode = 'edit'; // 'play' or 'edit'
        this.gridSize = 40;
        this.selectedObjectType = 'platform';
        this.currentLevelName = 'Untitled Level';

        this.loadLevelByName(this.currentLevelName);

        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.lastTime = 0;
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    setMode(mode) {
        this.mode = mode;
        this.uiManager.setMode(mode);
        if (this.mode === 'play') {
            this.player.reset();
        }
    }

    loadLevelData(levelData) {
        this.platforms = levelData.platforms.map(p => new Platform(p.x, p.y, p.width, p.height));
        this.spikes = levelData.spikes.map(s => new Spike(s.x, s.y));
        this.coins = levelData.coins.map(c => new Coin(c.x, c.y));
        this.finishLine = levelData.finishLine ? new FinishLine(levelData.finishLine.x, levelData.finishLine.y) : null;
        this.player.reset();
    }

    loadLevelByName(name) {
        this.currentLevelName = name;
        const levelData = this.levelManager.loadLevel(name);
        this.loadLevelData(levelData);
        this.uiManager.updateLevelList();
    }

    saveCurrentLevel() {
        const levelName = prompt("Enter a name for your level:", this.currentLevelName);
        if (levelName) {
            const levelData = {
                platforms: this.platforms.map(p => ({ x: p.x, y: p.y, width: p.width, height: p.height })),
                spikes: this.spikes.map(s => ({ x: s.x, y: s.y })),
                coins: this.coins.map(c => ({ x: c.x, y: c.y })),
                finishLine: this.finishLine ? { x: this.finishLine.x, y: this.finishLine.y, width: this.finishLine.width, height: this.finishLine.height } : null
            };
            this.levelManager.saveLevel(levelName, levelData);
            this.currentLevelName = levelName;
            alert(`Level "${levelName}" saved!`);
            this.uiManager.updateLevelList();
        }
    }

    update(deltaTime) {
        if (this.mode === 'play') {
            this.player.update(deltaTime, this.input);
        } else {
            this.handleEditorInput();
        }
    }

    handleEditorInput() {
        if (this.input.mouse.down) {
            const gridX = Math.floor(this.input.mouse.x / this.gridSize) * this.gridSize;
            const gridY = Math.floor(this.input.mouse.y / this.gridSize) * this.gridSize;

            let newObject = null;
            switch (this.selectedObjectType) {
                case 'platform':
                    newObject = new Platform(gridX, gridY, this.gridSize * 2, this.gridSize / 2);
                    break;
                case 'spike':
                    newObject = new Spike(gridX, gridY);
                    break;
                case 'coin':
                    newObject = new Coin(gridX + this.gridSize / 2, gridY + this.gridSize / 2);
                    break;
                case 'finish':
                    newObject = new FinishLine(gridX, gridY);
                    break;
                case 'erase':
                    this.eraseObjectAt(gridX, gridY);
                    return; // Stop after erasing
            }

            if (newObject && this.isAreaEmpty(newObject)) {
                if (newObject instanceof FinishLine) {
                    this.finishLine = newObject;
                } else if (newObject instanceof Platform) {
                    this.platforms.push(newObject);
                } else if (newObject instanceof Spike) {
                    this.spikes.push(newObject);
                } else if (newObject instanceof Coin) {
                    this.coins.push(newObject);
                }
            }
        }
    }

    eraseObjectAt(x, y) {
        // Erase any object whose bounding box overlaps with the clicked grid cell
        const clickedRect = { x, y, width: this.gridSize, height: this.gridSize };
        this.platforms = this.platforms.filter(p => !this.checkCollision(p, clickedRect));
        this.spikes = this.spikes.filter(s => !this.checkCollision(s, clickedRect));
        this.coins = this.coins.filter(c => !this.checkCollision({x: c.x - c.radius, y: c.y - c.radius, width: c.radius*2, height: c.radius*2}, clickedRect));
        if (this.finishLine && this.checkCollision(this.finishLine, clickedRect)) {
            this.finishLine = null;
        }
    }

    isAreaEmpty(newObject) {
        const allObjects = [...this.platforms, ...this.spikes, ...this.coins, this.finishLine].filter(Boolean);
        for (const obj of allObjects) {
            // Special handling for coins since they are circles
            const objRect = (obj instanceof Coin)
                ? {x: obj.x - obj.radius, y: obj.y - obj.radius, width: obj.radius*2, height: obj.radius*2}
                : obj;

            if (this.checkCollision(newObject, objRect)) {
                return false;
            }
        }
        return true;
    }

    checkCollision(rect1, rect2) {
        return rect1.x < rect2.x + rect2.width &&
               rect1.x + rect1.width > rect2.x &&
               rect1.y < rect2.y + rect2.height &&
               rect1.y + rect1.height > rect2.y;
    }

    draw() {
        // Motion blur effect or clear canvas
        if (this.mode === 'play') {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        } else {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.drawGrid();
        }

        this.player.draw(this.ctx);
        this.platforms.forEach(p => p.draw(this.ctx));
        this.spikes.forEach(s => s.draw(this.ctx));
        this.coins.forEach(c => c.draw(this.ctx));
        if (this.finishLine) this.finishLine.draw(this.ctx);
    }

    drawGrid() {
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 1;
        for (let x = 0; x < this.canvas.width; x += this.gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        for (let y = 0; y < this.canvas.height; y += this.gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }

    loop(timestamp) {
        const deltaTime = timestamp - this.lastTime;
        this.lastTime = timestamp;

        this.update(deltaTime);
        this.draw();

        requestAnimationFrame(this.loop.bind(this));
    }

    start() {
        this.lastTime = 0;
        requestAnimationFrame(this.loop.bind(this));
    }
}

window.onload = function() {
    const canvas = document.getElementById('gameCanvas');
    const game = new Game(canvas);
    game.start();
};

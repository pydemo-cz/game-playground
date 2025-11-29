document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    const canvasContainer = document.getElementById('canvas-container');

    // --- Configuration ---
    const CONFIG = {
        GRID_SIZE: 60,
        PLAYER_WIDTH: 54,
        PLAYER_HEIGHT: 72,
        MOVE_SPEED: 5,
        JUMP_FORCE: 18,
        GRAVITY: 0.8,
    };

    // --- Game State ---
    let gameState = {
        gameMode: 'EDIT',
        activeTool: 'platform',
        player: { x: 0, y: 0, vx: 0, vy: 0, jumps: 2, facingRight: true },
        level: { width: 32, height: 18, grid: [], playGrid: [] },
        collectibles: { total: 0, collected: 0 },
        exit: { x: 0, y: 0, activated: false },
        assets: { platform: null, player: null, spike: null, coin: null, finish: null, ground: null, 'control-left': null, 'control-right': null, 'control-jump': null },
        camera: { x: 0, y: 0, targetX: 0, targetY: 0, lerpFactor: 0.1 },
    };

    // --- DOM Elements ---
    const toolbar = document.getElementById('toolbar');
    const toolButtons = document.querySelectorAll('.tool-btn');
    const TILE_COLORS = { platform: 'brown', player: 'green', spike: 'red', coin: 'yellow', finish: 'purple', ground: 'saddlebrown' };
    const assetImages = {};

    // --- Input Handling ---
    const keys = { left: false, right: false, jump: false };
    function setupInputListeners() {
        window.addEventListener('keydown', (e) => {
            if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
            if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
            if (e.code === 'Space' || e.code === 'ArrowUp') keys.jump = true;
        });
        window.addEventListener('keyup', (e) => {
            if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
            if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
            if (e.code === 'Space' || e.code === 'ArrowUp') keys.jump = false;
        });
    }

    // --- Asset Management ---
    function handleAssetUpload(file, assetName) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const base64 = e.target.result;
            gameState.assets[assetName] = base64;
            const img = new Image();
            img.src = base64;
            assetImages[assetName] = img;
        };
        reader.readAsDataURL(file);
    }

    function setupAssetInputs() {
        const assetPreview = document.getElementById('asset-preview');
        const assetPreviewSection = document.getElementById('asset-preview-section');

        document.getElementById('asset-inputs').addEventListener('change', (e) => {
            if (e.target.type === 'file') {
                handleAssetUpload(e.target.files[0], e.target.dataset.asset);
                // Give it a moment for the image to load, then update preview
                setTimeout(updateAssetPreview, 100);
            }
        });

        assetPreview.addEventListener('click', () => {
            const currentTool = gameState.activeTool;
            const input = document.getElementById(`${currentTool}-asset-input`);
            if (input) {
                input.click();
            }
        });
    }

    // --- World & Grid ---
    function resizeGrid(newWidth, newHeight) {
        const oldGrid = gameState.level.grid;
        const newGrid = Array.from({ length: newHeight }, (_, y) =>
            Array.from({ length: newWidth }, (_, x) => {
                if (y === newHeight - 1) return 'ground';
                if (y < oldGrid.length - 1 && x < (oldGrid[y] || []).length) return oldGrid[y][x];
                return null;
            })
        );
        gameState.level.grid = newGrid;
        gameState.level.width = newWidth;
        gameState.level.height = newHeight;
    }

    function initializeGrid() { resizeGrid(gameState.level.width, gameState.level.height); }

    // --- Canvas & Rendering ---
    function resizeCanvas() {
        const newWidth = gameState.level.width * CONFIG.GRID_SIZE;
        const newHeight = gameState.level.height * CONFIG.GRID_SIZE;
        if (canvas.width !== newWidth || canvas.height !== newHeight) {
            canvas.width = newWidth;
            canvas.height = newHeight;
        }
    }

    function draw() {
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        ctx.translate(-gameState.camera.x, -gameState.camera.y);

        const currentGrid = gameState.gameMode === 'PLAY' ? gameState.level.playGrid : gameState.level.grid;
        for (let y = 0; y < gameState.level.height; y++) {
            for (let x = 0; x < gameState.level.width; x++) {
                let tileType = currentGrid[y][x];
                if (gameState.gameMode === 'PLAY' && tileType === 'finish' && !gameState.exit.activated) continue;
                if (tileType) {
                    const img = assetImages[tileType];
                    if (img && img.complete) {
                        ctx.drawImage(img, x * CONFIG.GRID_SIZE, y * CONFIG.GRID_SIZE, CONFIG.GRID_SIZE, CONFIG.GRID_SIZE);
                    } else {
                        ctx.fillStyle = TILE_COLORS[tileType] || 'grey';
                        ctx.fillRect(x * CONFIG.GRID_SIZE, y * CONFIG.GRID_SIZE, CONFIG.GRID_SIZE, CONFIG.GRID_SIZE);
                    }
                }
            }
        }
        if (gameState.gameMode === 'EDIT') drawEditorUI();
        if (gameState.gameMode === 'PLAY') {
            const p = gameState.player;
            const img = assetImages['player'];
            ctx.save();
            if (!p.facingRight) {
                ctx.scale(-1, 1);
                ctx.translate(-p.x - CONFIG.PLAYER_WIDTH, p.y);
            } else {
                ctx.translate(p.x, p.y);
            }
            if (img && img.complete) ctx.drawImage(img, 0, 0, CONFIG.PLAYER_WIDTH, CONFIG.PLAYER_HEIGHT);
            else { ctx.fillStyle = TILE_COLORS.player; ctx.fillRect(0, 0, CONFIG.PLAYER_WIDTH, CONFIG.PLAYER_HEIGHT); }
            ctx.restore();
        }

        ctx.restore(); // Restore transform for HUD

        if (gameState.gameMode === 'PLAY') {
            ctx.font = "30px Arial";
            ctx.fillStyle = "white";
            ctx.fillText(`Coins: ${gameState.collectibles.collected} / ${gameState.collectibles.total}`, 20, 40);

            // Update touch control visuals
            const touchLeft = document.getElementById('touch-left');
            const touchRight = document.getElementById('touch-right');
            const touchJump = document.getElementById('touch-jump');

            if (assetImages['control-left']) touchLeft.style.backgroundImage = `url(${assetImages['control-left'].src})`;
            if (assetImages['control-right']) touchRight.style.backgroundImage = `url(${assetImages['control-right'].src})`;
            if (assetImages['control-jump']) touchJump.style.backgroundImage = `url(${assetImages['control-jump'].src})`;
        }
    }

    function drawEditorUI() {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        for (let x = 0; x <= canvas.width; x += CONFIG.GRID_SIZE) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
        for (let y = 0; y <= canvas.height; y += CONFIG.GRID_SIZE) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }
    }

    // --- Physics & Collision ---
    function isColliding(obj, tileX, tileY) {
        return obj.x < tileX + CONFIG.GRID_SIZE && obj.x + CONFIG.PLAYER_WIDTH > tileX && obj.y < tileY + CONFIG.GRID_SIZE && obj.y + CONFIG.PLAYER_HEIGHT > tileY;
    }

    function checkCollisions(isVertical) {
        const p = gameState.player;
        let onGround = false;
        for (let y = 0; y < gameState.level.height; y++) {
            for (let x = 0; x < gameState.level.width; x++) {
                const tile = gameState.level.playGrid[y][x];
                const tileX = x * CONFIG.GRID_SIZE;
                const tileY = y * CONFIG.GRID_SIZE;
                if (tile && isColliding(p, tileX, tileY)) {
                    if (tile === 'platform' || tile === 'ground') {
                        if (isVertical) {
                            if (p.vy > 0) { p.y = tileY - CONFIG.PLAYER_HEIGHT; onGround = true; }
                            else if (p.vy < 0) { p.y = tileY + CONFIG.GRID_SIZE; }
                            p.vy = 0;
                        } else {
                            if (p.vx > 0) { p.x = tileX - CONFIG.PLAYER_WIDTH; }
                            else if (p.vx < 0) { p.x = tileX + CONFIG.GRID_SIZE; }
                            p.vx = 0;
                        }
                    } else if (tile === 'coin') {
                        gameState.level.playGrid[y][x] = null;
                        gameState.collectibles.collected++;
                        if (gameState.collectibles.collected === gameState.collectibles.total) gameState.exit.activated = true;
                    } else if (tile === 'spike') {
                        document.getElementById('play-btn').click();
                    } else if (tile === 'finish' && gameState.exit.activated) {
                        alert("YOU WIN!");
                        document.getElementById('edit-btn').click();
                    }
                }
            }
        }
        return onGround;
    }

    // --- Game Loop ---
    function update() {
        if (gameState.gameMode !== 'PLAY') return;

        // Update player
        const p = gameState.player;
        p.vx = 0;
        if (keys.left) { p.vx = -CONFIG.MOVE_SPEED; p.facingRight = false; }
        if (keys.right) { p.vx = CONFIG.MOVE_SPEED; p.facingRight = true; }
        p.x += p.vx;
        checkCollisions(false);
        p.vy += CONFIG.GRAVITY;
        p.y += p.vy;
        if (checkCollisions(true)) p.jumps = 2;
        if (keys.jump && p.jumps > 0) { p.vy = -CONFIG.JUMP_FORCE; p.jumps--; keys.jump = false; }

        // Update camera
        const cam = gameState.camera;
        const deadZoneX = canvas.width * 0.3;
        const deadZoneY = canvas.height * 0.3;

        const playerScreenX = p.x - cam.x;
        const playerScreenY = p.y - cam.y;

        if (playerScreenX < deadZoneX) {
            cam.targetX = p.x - deadZoneX;
        } else if (playerScreenX + CONFIG.PLAYER_WIDTH > canvas.width - deadZoneX) {
            cam.targetX = p.x + CONFIG.PLAYER_WIDTH - (canvas.width - deadZoneX);
        }

        if (playerScreenY < deadZoneY) {
            cam.targetY = p.y - deadZoneY;
        } else if (playerScreenY + CONFIG.PLAYER_HEIGHT > canvas.height - deadZoneY) {
            cam.targetY = p.y + CONFIG.PLAYER_HEIGHT - (canvas.height - deadZoneY);
        }

        cam.x += (cam.targetX - cam.x) * cam.lerpFactor;
        cam.y += (cam.targetY - cam.y) * cam.lerpFactor;
    }

    function gameLoop() { update(); draw(); requestAnimationFrame(gameLoop); }

    // --- Save/Load ---
    function saveLevel() {
        const data = { level: gameState.level, assets: gameState.assets };
        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'jumpina-level.json';
        a.click();
        URL.revokeObjectURL(a.href);
    }

    function loadLevel(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                if (data.level && data.assets) {
                    gameState.level = data.level;
                    gameState.assets = data.assets;
                    document.getElementById('width-label').textContent = gameState.level.width;
                    document.getElementById('height-label').textContent = gameState.level.height;
                    Object.keys(assetImages).forEach(key => delete assetImages[key]);
                    Object.keys(gameState.assets).forEach(name => {
                        if (gameState.assets[name]) {
                            const img = new Image();
                            img.src = gameState.assets[name];
                            assetImages[name] = img;
                        }
                    });
                } else alert("Invalid level file format.");
            } catch (error) { alert("Error reading level file: " + error.message); }
        };
        reader.readAsText(file);
        e.target.value = '';
    }

    // --- Editor ---
    let isPainting = false;
    function getMouseGridPos(e) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left + canvasContainer.scrollLeft;
        const y = e.clientY - rect.top + canvasContainer.scrollTop;
        return { x: Math.floor(x / CONFIG.GRID_SIZE), y: Math.floor(y / CONFIG.GRID_SIZE) };
    }

    function handleCanvasPaint(e) {
        if (!isPainting) return;
        const { x, y } = getMouseGridPos(e);
        if (y >= 0 && y < gameState.level.height - 1 && x >= 0 && x < gameState.level.width) {
            const tool = gameState.activeTool;
            if (tool === 'player' || tool === 'finish') {
                gameState.level.grid.forEach(row => { const i = row.indexOf(tool); if (i !== -1) row[i] = null; });
            }
            gameState.level.grid[y][x] = tool === 'eraser' ? null : tool;
        }
    }

    function createDefaultLevel() {
        const grid = gameState.level.grid;
        for (let y = 0; y < gameState.level.height - 1; y++) {
            for (let x = 0; x < gameState.level.width; x++) {
                grid[y][x] = null;
            }
        }
        grid[15][3] = 'player';
        grid[16][6] = 'platform';
        grid[15][6] = 'platform';
        grid[14][6] = 'platform';
        grid[13][9] = 'platform';
        grid[13][10] = 'platform';
        grid[15][13] = 'platform';
        grid[15][14] = 'platform';
        grid[15][15] = 'platform';
        grid[12][10] = 'coin';
        grid[16][18] = 'spike';
        grid[16][19] = 'spike';
        grid[14][15] = 'finish';
    }

    // --- Initialization ---
    function init() {
        initializeGrid();
        createDefaultLevel();
        setupAssetInputs();
        setupInputListeners();

        // Touch controls event listeners
        const touchLeft = document.getElementById('touch-left');
        const touchRight = document.getElementById('touch-right');
        const touchJump = document.getElementById('touch-jump');

        const handleTouchStart = (key) => (e) => { e.preventDefault(); keys[key] = true; };
        const handleTouchEnd = (key) => (e) => { e.preventDefault(); keys[key] = false; };

        touchLeft.addEventListener('touchstart', handleTouchStart('left'));
        touchLeft.addEventListener('mousedown', handleTouchStart('left'));
        touchLeft.addEventListener('touchend', handleTouchEnd('left'));
        touchLeft.addEventListener('mouseup', handleTouchEnd('left'));
        touchLeft.addEventListener('mouseleave', handleTouchEnd('left'));

        touchRight.addEventListener('touchstart', handleTouchStart('right'));
        touchRight.addEventListener('mousedown', handleTouchStart('right'));
        touchRight.addEventListener('touchend', handleTouchEnd('right'));
        touchRight.addEventListener('mouseup', handleTouchEnd('right'));
        touchRight.addEventListener('mouseleave', handleTouchEnd('right'));

        touchJump.addEventListener('touchstart', handleTouchStart('jump'));
        touchJump.addEventListener('mousedown', handleTouchStart('jump'));
        touchJump.addEventListener('touchend', handleTouchEnd('jump'));
        touchJump.addEventListener('mouseup', handleTouchEnd('jump'));
        touchJump.addEventListener('mouseleave', handleTouchEnd('jump'));


        document.getElementById('width-plus').addEventListener('click', () => { resizeGrid(gameState.level.width + 1, gameState.level.height); document.getElementById('width-label').textContent = gameState.level.width; });
        document.getElementById('width-minus').addEventListener('click', () => { if (gameState.level.width > 16) { resizeGrid(gameState.level.width - 1, gameState.level.height); document.getElementById('width-label').textContent = gameState.level.width; } });
        document.getElementById('height-plus').addEventListener('click', () => { resizeGrid(gameState.level.width, gameState.level.height + 1); document.getElementById('height-label').textContent = gameState.level.height; });
        document.getElementById('height-minus').addEventListener('click', () => { if (gameState.level.height > 9) { resizeGrid(gameState.level.width, gameState.level.height - 1); document.getElementById('height-label').textContent = gameState.level.height; } });

        document.getElementById('save-btn').addEventListener('click', saveLevel);
        const loadLevelInput = document.getElementById('load-level-input');
        document.getElementById('load-btn').addEventListener('click', () => loadLevelInput.click());
        loadLevelInput.addEventListener('change', loadLevel);

        const assetPreviewSection = document.getElementById('asset-preview-section');
        const assetPreview = document.getElementById('asset-preview');

        function updateAssetPreview() {
            const tool = gameState.activeTool;
            const img = assetImages[tool];
            if (img) {
                assetPreview.style.backgroundImage = `url(${img.src})`;
                assetPreview.style.backgroundColor = 'transparent';
            } else {
                assetPreview.style.backgroundImage = 'none';
                assetPreview.style.backgroundColor = TILE_COLORS[tool] || '#20232a';
            }
        }

        document.getElementById('tool-buttons').querySelectorAll('.tool-btn').forEach(btn => btn.addEventListener('click', () => {
            toolButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            gameState.activeTool = btn.dataset.tool;

            if (gameState.activeTool !== 'eraser') {
                assetPreviewSection.style.display = 'flex';
                updateAssetPreview();
            } else {
                assetPreviewSection.style.display = 'none';
            }
        }));

        document.querySelector('.tool-btn[data-tool="platform"]').click(); // Set initial tool and show preview

        const playBtn = document.getElementById('play-btn');
        const editBtn = document.getElementById('edit-btn');

        function switchToPlayMode() {
            gameState.collectibles.total = 0;
            gameState.collectibles.collected = 0;
            gameState.exit.activated = false;
            let playerStart = { x: 100, y: 100 };
            gameState.level.playGrid = JSON.parse(JSON.stringify(gameState.level.grid));
            for (let y = 0; y < gameState.level.height; y++) {
                for (let x = 0; x < gameState.level.width; x++) {
                    const tile = gameState.level.playGrid[y][x];
                    if (tile === 'player') {
                        playerStart.x = x * CONFIG.GRID_SIZE;
                        playerStart.y = y * CONFIG.GRID_SIZE;
                        gameState.level.playGrid[y][x] = null; // Remove player start marker
                    } else if (tile === 'coin') {
                        gameState.collectibles.total++;
                    }
                }
            }
            gameState.player.x = playerStart.x;
            gameState.player.y = playerStart.y;
            gameState.player.vx = 0;
            gameState.player.vy = 0;
            gameState.player.jumps = 2;
            if (gameState.collectibles.total === 0) gameState.exit.activated = true;
            gameState.gameMode = 'PLAY';
            playBtn.classList.add('active');
            editBtn.classList.remove('active');
            document.getElementById('editor-tools').style.display = 'none';
            canvasContainer.classList.add('play-mode');
        }

        function switchToEditMode() {
            gameState.gameMode = 'EDIT';
            editBtn.classList.add('active');
            playBtn.classList.remove('active');
            document.getElementById('editor-tools').style.display = 'flex';
            canvasContainer.classList.remove('play-mode');
        }

        playBtn.addEventListener('click', switchToPlayMode);
        editBtn.addEventListener('click', switchToEditMode);

        canvas.addEventListener('mousedown', (e) => { if (gameState.gameMode === 'EDIT') { isPainting = true; handleCanvasPaint(e); } });
        canvas.addEventListener('mousemove', (e) => { if (isPainting && gameState.gameMode === 'EDIT') handleCanvasPaint(e); });
        canvas.addEventListener('mouseup', () => { isPainting = false; });
        canvas.addEventListener('mouseleave', () => { isPainting = false; });

        switchToPlayMode(); // Start in Play mode
        requestAnimationFrame(gameLoop);
    }
    init();
});

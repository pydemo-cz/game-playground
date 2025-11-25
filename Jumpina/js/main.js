document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');

    // --- Configuration ---
    const CONFIG = {
        LOGICAL_WIDTH: 960,
        LOGICAL_HEIGHT: 540,
        GRID_SIZE: 60,
        PLAYER: {
            HEIGHT: 120,
            WIDTH: 90,
        },
        CAMERA_DEADZONE_X: 350,
        CAMERA_DEADZONE_Y: 200,
        CAMERA_LERP_FACTOR: 0.05,
    };

    // --- Camera ---
    const camera = {
        x: 0,
        y: 0,
    };

    // --- Canvas Setup ---
    canvas.width = CONFIG.LOGICAL_WIDTH;
    canvas.height = CONFIG.LOGICAL_HEIGHT;

    function resize() {
        const container = document.getElementById('game-container');
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;

        const scaleX = containerWidth / CONFIG.LOGICAL_WIDTH;
        const scaleY = containerHeight / CONFIG.LOGICAL_HEIGHT;

        // Use the smaller scale factor to fit the whole canvas
        let scale = Math.min(scaleX, scaleY);

        // For integer scaling, floor the scale to the nearest whole number
        scale = Math.floor(scale);
        if (scale < 1) scale = 1; // Ensure it's at least 1x

        const newCanvasWidth = CONFIG.LOGICAL_WIDTH * scale;
        const newCanvasHeight = CONFIG.LOGICAL_HEIGHT * scale;

        canvas.style.width = `${newCanvasWidth}px`;
        canvas.style.height = `${newCanvasHeight}px`;
    }

    // --- Input Handling ---
    const input = {
        left: false,
        right: false,
        jump: false,
        _keys: new Set(),
    };

    function handleKeyDown(e) {
        if (input._keys.has(e.code)) return;
        input._keys.add(e.code);
        switch (e.code) {
            case 'KeyA':
            case 'ArrowLeft':
                input.left = true;
                break;
            case 'KeyD':
            case 'ArrowRight':
                input.right = true;
                break;
            case 'Space':
                input.jump = true;
                break;
        }
    }

    function handleKeyUp(e) {
        input._keys.delete(e.code);
        switch (e.code) {
            case 'KeyA':
            case 'ArrowLeft':
                input.left = false;
                break;
            case 'KeyD':
            case 'ArrowRight':
                input.right = false;
                break;
            case 'Space':
                input.jump = false;
                break;
        }
    }

    function isAABBCollision(rect1, rect2) {
        return (
            rect1.x < rect2.x + rect2.width &&
            rect1.x + rect1.width > rect2.x &&
            rect1.y < rect2.y + rect2.height &&
            rect1.y + rect1.height > rect2.y
        );
    }

    // --- Player ---
    const player = {
        x: CONFIG.LOGICAL_WIDTH / 2 - CONFIG.PLAYER.WIDTH / 2,
        y: CONFIG.LOGICAL_HEIGHT - CONFIG.PLAYER.HEIGHT - 100,
        width: CONFIG.PLAYER.WIDTH,
        height: CONFIG.PLAYER.HEIGHT,
        vx: 0,
        vy: 0,
        speed: 350,
        jumpForce: 800,
        gravity: 2000,
        isGrounded: false,
        jumpsLeft: 2,
        direction: 1, // 1 for right, -1 for left
    };

    // --- Editor State ---
    const editorState = {
        activeTab: 'level',
        changesMade: false,
        activeTool: null, // e.g., { type: 'platform' }
        isPainting: false,
        mousePos: { x: 0, y: 0 },
    };
    let gameMode = 'PLAY'; // 'PLAY' or 'EDIT'

    // --- DOM Elements ---
    const uiContainer = document.getElementById('ui-container');
    const editorContainer = document.getElementById('editor-container');
    const editButton = document.getElementById('edit-button');
    const playButton = document.getElementById('play-button');
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabPanes = document.querySelectorAll('.tab-pane');
    const levelDesignerToolbar = document.getElementById('level-designer-toolbar');
    const toolsContainer = document.getElementById('tools-container');
    const saveButton = document.getElementById('save-button');
    const loadButton = document.getElementById('load-button');
    const loadInput = document.getElementById('load-input');
    const mobileControls = document.getElementById('mobile-controls');
    const mobileLeft = document.getElementById('mobile-left');
    const mobileRight = document.getElementById('mobile-right');
    const mobileJump = document.getElementById('mobile-jump');


    // --- Assets ---
    const assets = {
        player: {
            idle: null, // base64 string
            jump: null, // base64 string
        },
        platforms: [],
        enemies: [],
        collectables: [],
        exit: null,
    };


    // --- Game State & Entities ---
    const gameState = {
        score: 0,
        totalCollectables: 0,
        exitActivated: false,
        gameWon: false,
    };

    let collectables = [];
    let enemies = [];
    let exit = null;
    let playerSpawn = { x: 0, y: 0 };

    // --- Level ---
    const level = {
        // 0: Empty, 1: Platform, C: Collectable, E: Enemy, X: Exit, P: Player
        data: [
            [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
            [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
            [0,0,0,0,'P',0,0,0,0,0,0,0,'C',0,0,0],
            [1,1,1,1,1,0,0,0,0,1,1,1,1,1,1,0],
            [0,0,0,0,0,0,'C',0,0,0,0,0,0,0,0,0],
            [0,0,0,0,0,1,1,1,1,1,0,0,0,'E',0,0],
            [0,'C',0,0,0,0,0,0,0,0,0,1,1,1,1,1],
            [1,1,1,0,0,0,'E',0,0,0,'C',0,0,0,0,0],
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        ],
    };

    function parseLevel() {
        const platformBoxes = [];
        collectables = [];
        enemies = [];
        exit = null;
        gameState.totalCollectables = 0;

        for (let r = 0; r < level.data.length; r++) {
            for (let c = 0; c < level.data[r].length; c++) {
                const tile = level.data[r][c];
                const pos = { x: c * CONFIG.GRID_SIZE, y: r * CONFIG.GRID_SIZE };

                if (tile === 1) {
                    platformBoxes.push({ ...pos, width: CONFIG.GRID_SIZE, height: CONFIG.GRID_SIZE });
                } else if (tile === 'C') {
                    collectables.push({ ...pos, width: CONFIG.GRID_SIZE, height: CONFIG.GRID_SIZE, collected: false });
                    gameState.totalCollectables++;
                } else if (tile === 'E') {
                    enemies.push({ ...pos, width: CONFIG.GRID_SIZE, height: CONFIG.GRID_SIZE });
                } else if (tile === 'X') {
                    exit = { ...pos, width: CONFIG.GRID_SIZE, height: CONFIG.GRID_SIZE };
                } else if (tile === 'P') {
                    playerSpawn = { x: pos.x, y: pos.y };
                }
            }
        }
        return platformBoxes;
    }

    let platformAABBs = [];

    function isTouchDevice() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }

    function setGameMode(mode) {
        gameMode = mode;
        if (mode === 'PLAY') {
            if (isTouchDevice()) {
                mobileControls.classList.remove('hidden');
            }
            editorContainer.classList.add('hidden');
            editButton.classList.remove('hidden');
            playButton.classList.add('hidden');

            // Restart level if changes were made in editor
            if (editorState.changesMade) {
                resetLevel();
                editorState.changesMade = false;
            }
            // Unpause game logic if we add pausing later
        } else { // 'EDIT'
            mobileControls.classList.add('hidden');
            editorContainer.classList.remove('hidden');
            editButton.classList.add('hidden');
            playButton.classList.remove('hidden');
            // Pause game logic if we add pausing later
        }
    }

    function setActiveTab(tabId) {
        editorState.activeTab = tabId;
        tabButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });
        tabPanes.forEach(pane => {
            pane.classList.toggle('hidden', pane.id !== `${tabId}-tab-content`);
        });
        levelDesignerToolbar.classList.toggle('hidden', tabId !== 'level');
    }

    // --- Level Designer Logic ---
    function getMousePosOnCanvas(e) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }

    function placeTile(gridX, gridY) {
        if (!editorState.activeTool || gridY < 0 || gridY >= level.data.length || gridX < 0 || gridX >= level.data[0].length) {
            return;
        }

        let tileId = 0;
        const { type } = editorState.activeTool;

        if (type === 'platform') tileId = 1;
        else if (type === 'collectable') tileId = 'C';
        else if (type === 'enemy') tileId = 'E';
        else if (type === 'exit') tileId = 'X';
        else if (type === 'player') tileId = 'P';
        else if (type === 'eraser') tileId = 0;

        // Prevent placing multiple unique items
        if (tileId === 'P' || tileId === 'X') {
            for(let r=0; r<level.data.length; r++) {
                for(let c=0; c<level.data[r].length; c++) {
                    if (level.data[r][c] === tileId) level.data[r][c] = 0;
                }
            }
        }

        if (level.data[gridY][gridX] !== tileId) {
            level.data[gridY][gridX] = tileId;
            editorState.changesMade = true;
            resetLevel(); // Refresh level data representation
        }
    }

    function handleCanvasMouseDown(e) {
        if (gameMode !== 'EDIT' || editorState.activeTab !== 'level') return;
        editorState.isPainting = true;
        const pos = getMousePosOnCanvas(e);
        const gridX = Math.floor((pos.x + camera.x) / CONFIG.GRID_SIZE);
        const gridY = Math.floor((pos.y + camera.y) / CONFIG.GRID_SIZE);
        placeTile(gridX, gridY);
    }

    function handleCanvasMouseMove(e) {
        const pos = getMousePosOnCanvas(e);
        editorState.mousePos.x = pos.x + camera.x;
        editorState.mousePos.y = pos.y + camera.y;
        if (gameMode !== 'EDIT' || !editorState.isPainting || editorState.activeTab !== 'level') return;
        const gridX = Math.floor(editorState.mousePos.x / CONFIG.GRID_SIZE);
        const gridY = Math.floor(editorState.mousePos.y / CONFIG.GRID_SIZE);
        placeTile(gridX, gridY);
    }

    function handleCanvasMouseUp(e) {
        editorState.isPainting = false;
    }

    function updateToolbar() {
        // This will be expanded later to show sprite previews
        // For now, it just adds listeners to the static buttons
        const toolButtons = document.querySelectorAll('.tool-button');
        toolButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                 toolButtons.forEach(b => b.classList.remove('active'));
                 btn.classList.add('active');
                 editorState.activeTool = JSON.parse(btn.dataset.tool);
            });
        });
    }

    // --- Asset Handling ---

    // --- Save/Load Logic ---
    function saveGame() {
        const data = {
            level: level.data,
            assets: assets,
            // We could add config here too if needed
        };
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'jumpina-level.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    function loadGame(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (!confirm('Loading this file will overwrite your current level and assets. Are you sure?')) {
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                if (data.level && data.assets) {
                    level.data = data.level;
                    // It's important to re-assign, not just merge
                    Object.assign(assets, data.assets);

                    // Refresh UI previews
                    playerIdlePreview.src = assets.player.idle || '';
                    playerJumpPreview.src = assets.player.jump || '';
                    // We'd need to update other previews here too if they existed

                    resetLevel();
                    alert('Level loaded successfully!');
                } else {
                    alert('Invalid level file.');
                }
            } catch (error) {
                alert('Error loading or parsing file.');
                console.error(error);
            }
        };
        reader.readAsText(file);
        // Reset file input so the same file can be loaded again
        e.target.value = '';
    }

    function handleImageUpload(file, targetWidth, targetHeight, isSquare, callback) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');

                let sx = 0, sy = 0, sWidth = img.width, sHeight = img.height;

                if (isSquare) {
                    // Center crop for square sprites
                    const size = Math.min(img.width, img.height);
                    sx = (img.width - size) / 2;
                    sy = (img.height - size) / 2;
                    sWidth = size;
                    sHeight = size;
                } else {
                    // For player, we resize based on height, preserving aspect ratio
                    const aspectRatio = img.width / img.height;
                    targetWidth = targetHeight * aspectRatio;
                }

                tempCanvas.width = targetWidth;
                tempCanvas.height = targetHeight;

                tempCtx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);

                const base64 = tempCanvas.toDataURL('image/png');
                callback(base64);
                editorState.changesMade = true;
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }


    function resetLevel() {
        platformAABBs = parseLevel();
        player.x = playerSpawn.x;
        player.y = playerSpawn.y;
        player.vx = 0;
        player.vy = 0;
        gameState.score = 0;
        gameState.exitActivated = false;
        gameState.gameWon = false;
        collectables.forEach(c => c.collected = false);
    }


    // --- Game Loop ---
    let lastTime = 0;

    function update(deltaTime) {
        if (gameMode !== 'PLAY') return; // Don't update game logic in EDIT mode
        if (gameState.gameWon) return;

        // Horizontal Movement
        player.vx = 0;
        if (input.left) {
            player.vx = -player.speed;
            player.direction = -1;
        }
        if (input.right) {
            player.vx = player.speed;
            player.direction = 1;
        }
        const potentialX = player.x + player.vx * deltaTime;
        player.x = potentialX;

        platformAABBs.forEach(box => {
            if (isAABBCollision(player, box)) {
                if (player.vx > 0) { // Moving right
                    player.x = box.x - player.width;
                } else if (player.vx < 0) { // Moving left
                    player.x = box.x + box.width;
                }
            }
        });

        // Vertical Movement & Collision
        player.vy += player.gravity * deltaTime;
        const potentialY = player.y + player.vy * deltaTime;
        player.y = potentialY;

        player.isGrounded = false;
        platformAABBs.forEach(box => {
            if (isAABBCollision(player, box)) {
                if (player.vy > 0) { // Moving down
                    player.y = box.y - player.height;
                    player.vy = 0;
                    player.isGrounded = true;
                    player.jumpsLeft = 2;
                } else if (player.vy < 0) { // Moving up
                    player.y = box.y + box.height;
                    player.vy = 0;
                }
            }
        });

        // Entity Collisions
        // Collectables
        collectables.forEach(c => {
            if (!c.collected && isAABBCollision(player, c)) {
                c.collected = true;
                gameState.score++;
                if (gameState.score === gameState.totalCollectables) {
                    gameState.exitActivated = true;
                    // Simple visual effect: flash background
                    document.body.style.transition = 'background-color 0.1s';
                    document.body.style.backgroundColor = '#fff';
                    setTimeout(() => document.body.style.backgroundColor = '#333', 100);
                }
            }
        });

        // Enemies
        enemies.forEach(e => {
            if (isAABBCollision(player, e)) {
                resetLevel();
            }
        });

        // Exit
        if (gameState.exitActivated && exit && isAABBCollision(player, exit)) {
            gameState.gameWon = true;
        }

        // --- Camera Follow Logic ---
        const cameraCenterX = camera.x + CONFIG.LOGICAL_WIDTH / 2;
        const cameraCenterY = camera.y + CONFIG.LOGICAL_HEIGHT / 2;
        const playerCenterX = player.x + player.width / 2;
        const playerCenterY = player.y + player.height / 2;

        const dx = playerCenterX - cameraCenterX;
        const dy = playerCenterY - cameraCenterY;

        let targetX = camera.x;
        let targetY = camera.y;

        if (Math.abs(dx) > CONFIG.CAMERA_DEADZONE_X / 2) {
            targetX += dx - Math.sign(dx) * CONFIG.CAMERA_DEADZONE_X / 2;
        }
        if (Math.abs(dy) > CONFIG.CAMERA_DEADZONE_Y / 2) {
            targetY += dy - Math.sign(dy) * CONFIG.CAMERA_DEADZONE_Y / 2;
        }

        // Lerp camera to target
        camera.x += (targetX - camera.x) * CONFIG.CAMERA_LERP_FACTOR;
        camera.y += (targetY - camera.y) * CONFIG.CAMERA_LERP_FACTOR;


        // Jumping
        if (input.jump) {
            if (player.jumpsLeft > 0) {
                player.vy = -player.jumpForce;
                player.jumpsLeft--;
                player.isGrounded = false;
            }
            input.jump = false; // Consume jump input
        }
    }

    function draw() {
        // Clear the canvas with a static background color
        ctx.fillStyle = '#2c2c2c';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Apply camera transform
        ctx.save();
        ctx.translate(-camera.x, -camera.y);

        // --- All world drawing goes here ---

        // Draw Level Platforms
        ctx.fillStyle = 'brown';
        platformAABBs.forEach(box => {
            ctx.fillRect(box.x, box.y, box.width, box.height);
        });

        // Draw Entities
        ctx.fillStyle = 'yellow'; // Collectables
        collectables.forEach(c => {
            if (!c.collected) {
                ctx.fillRect(c.x, c.y, c.width, c.height);
            }
        });

        ctx.fillStyle = 'red'; // Enemies
        enemies.forEach(e => {
            ctx.fillRect(e.x, e.y, e.width, e.height);
        });

        if (gameState.exitActivated && exit) {
            ctx.fillStyle = 'purple'; // Exit
            ctx.fillRect(exit.x, exit.y, exit.width, exit.height);
        }

        // Draw Player
        ctx.save();
        ctx.translate(player.x, player.y);
        if (player.direction === -1) {
            ctx.scale(-1, 1);
            ctx.translate(-player.width, 0);
        }

        const playerSprite = (player.isGrounded ? assets.player.idle : assets.player.jump) || null;
        if (playerSprite) {
            const img = new Image();
            img.src = playerSprite;
            // Ensure image is loaded before drawing, in a real game you'd preload
            if (img.complete) {
                 ctx.drawImage(img, 0, 0, player.width, player.height);
            } else {
                 img.onload = () => ctx.drawImage(img, 0, 0, player.width, player.height);
            }
        } else {
            // Fallback placeholder
            ctx.fillStyle = 'green';
            ctx.fillRect(0, 0, player.width, player.height);
        }
        ctx.restore();


        // Draw editor grid and cursor
        if (gameMode === 'EDIT') {
            // Draw grid
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            const gridWidth = level.data[0].length * CONFIG.GRID_SIZE;
            const gridHeight = level.data.length * CONFIG.GRID_SIZE;
            for (let x = 0; x <= gridWidth; x += CONFIG.GRID_SIZE) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, gridHeight);
                ctx.stroke();
            }
            for (let y = 0; y <= gridHeight; y += CONFIG.GRID_SIZE) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(gridWidth, y);
                ctx.stroke();
            }

            // Draw cursor preview
            if (editorState.activeTool) {
                const gridX = Math.floor(editorState.mousePos.x / CONFIG.GRID_SIZE);
                const gridY = Math.floor(editorState.mousePos.y / CONFIG.GRID_SIZE);
                ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.fillRect(gridX * CONFIG.GRID_SIZE, gridY * CONFIG.GRID_SIZE, CONFIG.GRID_SIZE, CONFIG.GRID_SIZE);
            }
        }


        // --- End of world drawing ---
        ctx.restore(); // Restore context to pre-camera state

        // Draw HUD (which should not move with the camera)
        ctx.fillStyle = 'white';
        ctx.font = '30px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`Collected: ${gameState.score} / ${gameState.totalCollectables}`, 20, 40);

        if (gameState.gameWon) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'white';
            ctx.font = '80px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('YOU WIN', canvas.width / 2, canvas.height / 2);
        }
    }

    function gameLoop(timestamp) {
        const deltaTime = (timestamp - lastTime) / 1000;
        lastTime = timestamp;

        update(deltaTime);
        draw();

        requestAnimationFrame(gameLoop);
    }

    // --- Event Listeners ---
    editButton.addEventListener('click', () => setGameMode('EDIT'));
    playButton.addEventListener('click', () => setGameMode('PLAY'));
    saveButton.addEventListener('click', saveGame);
    loadButton.addEventListener('click', () => loadInput.click());
    loadInput.addEventListener('change', loadGame);

    // Mobile controls
    mobileLeft.addEventListener('touchstart', (e) => { e.preventDefault(); input.left = true; });
    mobileLeft.addEventListener('touchend', (e) => { e.preventDefault(); input.left = false; });
    mobileRight.addEventListener('touchstart', (e) => { e.preventDefault(); input.right = true; });
    mobileRight.addEventListener('touchend', (e) => { e.preventDefault(); input.right = false; });
    mobileJump.addEventListener('touchstart', (e) => { e.preventDefault(); input.jump = true; });
    mobileJump.addEventListener('touchend', (e) => { e.preventDefault(); input.jump = false; }); // jump is consumed, so this is fine

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => setActiveTab(btn.dataset.tab));
    });

    // Player tab listeners
    const playerIdleInput = document.getElementById('player-idle-input');
    const playerIdlePreview = document.getElementById('player-idle-preview');
    playerIdleInput.addEventListener('change', (e) => {
        handleImageUpload(e.target.files[0], CONFIG.PLAYER.WIDTH, CONFIG.PLAYER.HEIGHT, false, (base64) => {
            assets.player.idle = base64;
            playerIdlePreview.src = base64;
        });
    });

    const playerJumpInput = document.getElementById('player-jump-input');
    const playerJumpPreview = document.getElementById('player-jump-preview');
    playerJumpInput.addEventListener('change', (e) => {
        handleImageUpload(e.target.files[0], CONFIG.PLAYER.WIDTH, CONFIG.PLAYER.HEIGHT, false, (base64) => {
            assets.player.jump = base64;
            playerJumpPreview.src = base64;
        });
    });


    // --- Initialization ---
    canvas.addEventListener('mousedown', handleCanvasMouseDown);
    canvas.addEventListener('mousemove', handleCanvasMouseMove);
    canvas.addEventListener('mouseup', handleCanvasMouseUp);
    canvas.addEventListener('mouseleave', () => editorState.isPainting = false); // Stop painting if mouse leaves canvas

    window.addEventListener('resize', resize);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    resize(); // Initial resize
    resetLevel(); // <--- Initialize the first level
    updateToolbar();
    requestAnimationFrame(gameLoop);
});
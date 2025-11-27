document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    const canvasContainer = document.getElementById('canvas-container');

    // --- Configuration ---
    const CONFIG = {
        GRID_SIZE: 60,
        PLAYER_WIDTH: 54, // 90px at 60px grid = 0.9 grid units. Scaled down for now.
        PLAYER_HEIGHT: 72, // 120px at 60px grid = 1.2 grid units.
        MOVE_SPEED: 5,
        JUMP_FORCE: 18,
        GRAVITY: 0.8,
    };

    // --- Game State ---
    let gameState = {
        gameMode: 'EDIT', // EDIT or PLAY
        activeTool: 'platform',
        player: {
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            jumps: 2,
            facingRight: true,
        },
        level: {
            width: 32, // Default width
            height: 18, // Default height
            grid: [],
        },
        collectibles: {
            total: 0,
            collected: 0,
        },
        exit: {
            x: 0,
            y: 0,
            activated: false,
        },
        assets: {
            // base64 strings will be stored here
            platform: null,
            player: null,
            spike: null,
            coin: null,
            finish: null,
            ground: null,
        },
    };

    // --- DOM Elements ---
    const toolbar = document.getElementById('toolbar');
    const toolButtons = document.querySelectorAll('.tool-btn');

    const TILE_COLORS = {
        platform: 'brown',
        player: 'green',
        spike: 'red',
        coin: 'yellow',
        finish: 'purple',
        ground: 'saddlebrown',
    };

    // Cache for loaded image objects
    const assetImages = {};

    // --- Input Handling ---
    const keys = {
        left: false,
        right: false,
        jump: false,
    };

    function setupInputListeners() {
        window.addEventListener('keydown', (e) => {
            switch (e.code) {
                case 'ArrowLeft':
                case 'KeyA':
                    keys.left = true;
                    break;
                case 'ArrowRight':
                case 'KeyD':
                    keys.right = true;
                    break;
                case 'Space':
                    keys.jump = true;
                    break;
            }
        });
        window.addEventListener('keyup', (e) => {
            switch (e.code) {
                case 'ArrowLeft':
                case 'KeyA':
                    keys.left = false;
                    break;
                case 'ArrowRight':
                case 'KeyD':
                    keys.right = false;
                    break;
                case 'Space':
                    keys.jump = false;
                    break;
            }
        });
    }


    // --- Asset Management ---
    function handleAssetUpload(file, assetName) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const base64 = e.target.result;
            gameState.assets[assetName] = base64;

            // Create and cache the image object
            const img = new Image();
            img.src = base64;
            assetImages[assetName] = img;

            console.log(`Asset '${assetName}' loaded and cached.`);
        };
        reader.readAsDataURL(file);
    }

    function setupAssetInputs() {
        const assetInputs = document.getElementById('asset-inputs');
        assetInputs.addEventListener('change', (e) => {
            if (e.target.type === 'file') {
                const assetName = e.target.dataset.asset;
                handleAssetUpload(e.target.files[0], assetName);
            }
        });

        // Make tool buttons trigger a click on the hidden file input
        toolButtons.forEach(btn => {
            const tool = btn.dataset.tool;
            // The 'ground' button is for asset upload only, not for painting.
            if (tool !== 'eraser' && tool !== 'player' && tool !== 'ground') {
                const input = document.getElementById(`${tool}-asset-input`);
                if (input) {
                    btn.addEventListener('contextmenu', (e) => {
                        e.preventDefault();
                        input.click();
                    });
                }
            }
        });

        // Special handler for the ground button to trigger file input on left-click
        const groundBtn = document.querySelector('.tool-btn[data-tool="ground"]');
        const groundInput = document.getElementById('ground-asset-input');
        if (groundBtn && groundInput) {
            groundBtn.addEventListener('click', (e) => {
                e.preventDefault();
                groundInput.click();
            });
        }
        // Add a special listener for the player tool to also upload its asset
        const playerBtn = document.querySelector('.tool-btn[data-tool="player"]');
        const playerInput = document.getElementById('player-asset-input');
        if(playerBtn && playerInput) {
             playerBtn.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                playerInput.click();
            });
        }
    }

    // --- World & Grid ---
    function resizeGrid(newWidth, newHeight) {
        const oldGrid = gameState.level.grid;
        const oldHeight = gameState.level.height;

        const newGrid = [];
        for (let y = 0; y < newHeight; y++) {
            const newRow = [];
            for (let x = 0; x < newWidth; x++) {
                if (y === newHeight - 1) {
                    newRow.push('ground'); // Always ensure the last row is ground
                } else if (oldGrid.length > 0 && y < oldHeight - 1 && x < gameState.level.width) {
                    // Copy old data only if oldGrid is not empty
                    newRow.push(oldGrid[y][x]);
                } else {
                    newRow.push(null); // Fill new space with empty tiles
                }
            }
            newGrid.push(newRow);
        }

        gameState.level.grid = newGrid;
        gameState.level.width = newWidth;
        gameState.level.height = newHeight;
    }

    function initializeGrid() {
        resizeGrid(gameState.level.width, gameState.level.height);
    }


    function resizeCanvas() {
        // In EDIT mode, canvas can be larger than the container to allow scrolling
        const newWidth = gameState.level.width * CONFIG.GRID_SIZE;
        const newHeight = gameState.level.height * CONFIG.GRID_SIZE;

        if (canvas.width !== newWidth || canvas.height !== newHeight) {
            canvas.width = newWidth;
            canvas.height = newHeight;
        }
    }

    function draw() {
        // Clear canvas
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw grid content
        for (let y = 0; y < gameState.level.height; y++) {
            for (let x = 0; x < gameState.level.width; x++) {
                let tileType = gameState.level.grid[y][x];

                // In PLAY mode, don't draw the finish tile unless it's activated
                if (gameState.gameMode === 'PLAY' && tileType === 'finish' && !gameState.exit.activated) {
                    continue;
                }

                if (tileType) {
                    const img = assetImages[tileType];
                    const posX = x * CONFIG.GRID_SIZE;
                    const posY = y * CONFIG.GRID_SIZE;

                    if (img && img.complete) {
                        ctx.drawImage(img, posX, posY, CONFIG.GRID_SIZE, CONFIG.GRID_SIZE);
                    } else {
                        // Fallback to placeholder color
                        ctx.fillStyle = TILE_COLORS[tileType] || 'grey';
                        ctx.fillRect(posX, posY, CONFIG.GRID_SIZE, CONFIG.GRID_SIZE);
                    }
                }
            }
        }

        if (gameState.gameMode === 'EDIT') {
            drawEditorUI();
        }

        // Draw Player in PLAY mode
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

            if (img && img.complete) {
                ctx.drawImage(img, 0, 0, CONFIG.PLAYER_WIDTH, CONFIG.PLAYER_HEIGHT);
            } else {
                ctx.fillStyle = TILE_COLORS.player;
                ctx.fillRect(0, 0, CONFIG.PLAYER_WIDTH, CONFIG.PLAYER_HEIGHT);
            }
            ctx.restore();
        }

        // Draw HUD
        if (gameState.gameMode === 'PLAY') {
            ctx.font = "30px Arial";
            ctx.fillStyle = "white";
            ctx.textAlign = "left";
            const scoreText = `Coins: ${gameState.collectibles.collected} / ${gameState.collectibles.total}`;
            ctx.fillText(scoreText, 20, 40);
        }
    }

    function isColliding(obj, tileX, tileY) {
        return (
            obj.x < tileX + CONFIG.GRID_SIZE &&
            obj.x + CONFIG.PLAYER_WIDTH > tileX &&
            obj.y < tileY + CONFIG.GRID_SIZE &&
            obj.y + CONFIG.PLAYER_HEIGHT > tileY
        );
    }

    function checkCollisionsY() {
        const p = gameState.player;
        let onGround = false;

        const startCol = Math.floor(p.x / CONFIG.GRID_SIZE);
        const endCol = Math.floor((p.x + CONFIG.PLAYER_WIDTH) / CONFIG.GRID_SIZE);
        const startRow = Math.floor(p.y / CONFIG.GRID_SIZE);
        const endRow = Math.floor((p.y + CONFIG.PLAYER_HEIGHT) / CONFIG.GRID_SIZE);

        for (let row = startRow; row <= endRow; row++) {
            for (let col = startCol; col <= endCol; col++) {
                 if (row < 0 || row >= gameState.level.height || col < 0 || col >= gameState.level.width) continue;

                 const tile = gameState.level.grid[row][col];
                 const tileX = col * CONFIG.GRID_SIZE;
                 const tileY = row * CONFIG.GRID_SIZE;

                 if (tile && isColliding(p, tileX, tileY)) {
                     if (tile === 'platform' || tile === 'ground') {
                         if (p.vy > 0) {
                             p.y = tileY - CONFIG.PLAYER_HEIGHT;
                             onGround = true;
                         } else if (p.vy < 0) {
                             p.y = tileY + CONFIG.GRID_SIZE;
                         }
                         p.vy = 0;
                     } else if (tile === 'coin') {
                        gameState.level.grid[row][col] = null;
                        gameState.collectibles.collected++;
                        if (gameState.collectibles.collected === gameState.collectibles.total) {
                            gameState.exit.activated = true;
                        }
                     } else if (tile === 'spike') {
                        document.getElementById('play-btn').click(); // Reset level
                     } else if (tile === 'finish' && gameState.exit.activated) {
                        alert("YOU WIN!");
                        gameState.gameMode = 'EDIT';
                     }
                 }
            }
        }
        if (onGround) {
            p.jumps = 2;
        }
    }

    function checkCollisionsX() {
        const p = gameState.player;
        const startCol = Math.floor(p.x / CONFIG.GRID_SIZE);
        const endCol = Math.floor((p.x + CONFIG.PLAYER_WIDTH) / CONFIG.GRID_SIZE);
        const startRow = Math.floor(p.y / CONFIG.GRID_SIZE);
        const endRow = Math.floor((p.y + CONFIG.PLAYER_HEIGHT) / CONFIG.GRID_SIZE);

        for (let row = startRow; row <= endRow; row++) {
            for (let col = startCol; col <= endCol; col++) {
                 if (row < 0 || row >= gameState.level.height || col < 0 || col >= gameState.level.width) continue;

                 const tile = gameState.level.grid[row][col];
                 const tileX = col * CONFIG.GRID_SIZE;
                 const tileY = row * CONFIG.GRID_SIZE;

                 if ((tile === 'platform' || tile === 'ground') && isColliding(p, tileX, tileY)) {
                     if (p.vx > 0) {
                         p.x = tileX - CONFIG.PLAYER_WIDTH;
                     } else if (p.vx < 0) {
                         p.x = tileX + CONFIG.GRID_SIZE;
                     }
                     p.vx = 0;
                 }
            }
        }
    }


    function update() {
        if (gameState.gameMode !== 'PLAY') return;

        const p = gameState.player;

        // --- Horizontal Movement ---
        p.vx = 0;
        if (keys.left) {
            p.vx = -CONFIG.MOVE_SPEED;
            p.facingRight = false;
        }
        if (keys.right) {
            p.vx = CONFIG.MOVE_SPEED;
            p.facingRight = true;
        }
        p.x += p.vx;
        checkCollisionsX();


        // --- Vertical Movement & Gravity ---
        p.vy += CONFIG.GRAVITY;
        p.y += p.vy;
        checkCollisionsY();


        // --- Jumping ---
        if (keys.jump && p.jumps > 0) {
            p.vy = -CONFIG.JUMP_FORCE;
            p.jumps--;
            keys.jump = false; // Prevent holding jump
        }
    }

    function gameLoop() {
        update();
        resizeCanvas();
        draw();
        requestAnimationFrame(gameLoop);
    }

    // --- Editor-specific Drawing ---
    function drawEditorUI() {
        // Draw grid lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        for (let x = 0; x < gameState.level.width * CONFIG.GRID_SIZE; x += CONFIG.GRID_SIZE) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, gameState.level.height * CONFIG.GRID_SIZE);
            ctx.stroke();
        }
        for (let y = 0; y < gameState.level.height * CONFIG.GRID_SIZE; y += CONFIG.GRID_SIZE) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(gameState.level.width * CONFIG.GRID_SIZE, y);
            ctx.stroke();
        }
    }

    // --- Save/Load Functionality ---
    function saveLevel() {
        const data = {
            level: gameState.level,
            assets: gameState.assets,
        };

        const json = JSON.stringify(data);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'jumpina-level.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log("Level saved.");
    }

    function loadLevel(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                // Validate data structure
                if (data.level && data.assets) {
                    // Overwrite game state
                    gameState.level = data.level;
                    gameState.assets = data.assets;

                    // Update size labels
                    document.getElementById('width-label').textContent = gameState.level.width;
                    document.getElementById('height-label').textContent = gameState.level.height;


                    // Rebuild asset images cache
                    Object.keys(assetImages).forEach(key => delete assetImages[key]); // Clear cache
                    Object.keys(gameState.assets).forEach(assetName => {
                        const base64 = gameState.assets[assetName];
                        if (base64) {
                             const img = new Image();
                             img.src = base64;
                             assetImages[assetName] = img;
                        }
                    });

                    console.log("Level loaded and assets are being rebuilt.");
                } else {
                    alert("Invalid level file format.");
                }
            } catch (error) {
                alert("Error reading level file: " + error.message);
            }
        };
        reader.readAsText(file);

        // Reset input value to allow loading the same file again
        e.target.value = '';
    }


    // --- Editor Functionality ---
    let isPainting = false;

    function getMouseGridPos(e) {
        const rect = canvas.getBoundingClientRect();
        // Adjust for canvas position relative to scrolled container
        const x = e.clientX - rect.left + canvasContainer.scrollLeft;
        const y = e.clientY - rect.top + canvasContainer.scrollTop;
        return {
            x: Math.floor(x / CONFIG.GRID_SIZE),
            y: Math.floor(y / CONFIG.GRID_SIZE),
        };
    }

    function handleCanvasPaint(e) {
        if (!isPainting) return;
        const pos = getMouseGridPos(e);
        const { x, y } = pos;

        if (y >= 0 && y < gameState.level.height - 1 && x >= 0 && x < gameState.level.width) {
            const tool = gameState.activeTool;
            // Place player start point (unique)
            if (tool === 'player' || tool === 'finish') {
                // Remove previous instance of player or finish
                gameState.level.grid.forEach(row => {
                    const i = row.indexOf(tool);
                    if (i !== -1) row[i] = null;
                });
            }
             gameState.level.grid[y][x] = tool === 'eraser' ? null : tool;
        }
    }


    // --- Initialization ---
    function init() {
        console.log("Jumpina Editor Initialized");
        initializeGrid();
        setupAssetInputs();
        setupInputListeners();

        // Level resize buttons
        const widthPlusBtn = document.getElementById('width-plus');
        const widthMinusBtn = document.getElementById('width-minus');
        const heightPlusBtn = document.getElementById('height-plus');
        const heightMinusBtn = document.getElementById('height-minus');

        widthPlusBtn.addEventListener('click', () => {
            const newWidth = gameState.level.width + 1;
            document.getElementById('width-label').textContent = newWidth;
            resizeGrid(newWidth, gameState.level.height);
        });

        widthMinusBtn.addEventListener('click', () => {
            if (gameState.level.width > 16) { // Minimum width
                const newWidth = gameState.level.width - 1;
                document.getElementById('width-label').textContent = newWidth;
                resizeGrid(newWidth, gameState.level.height);
            }
        });

        heightPlusBtn.addEventListener('click', () => {
            const newHeight = gameState.level.height + 1;
            document.getElementById('height-label').textContent = newHeight;
            resizeGrid(gameState.level.width, newHeight);
        });

        heightMinusBtn.addEventListener('click', () => {
            if (gameState.level.height > 9) { // Minimum height
                const newHeight = gameState.level.height - 1;
                document.getElementById('height-label').textContent = newHeight;
                resizeGrid(gameState.level.width, newHeight);
            }
        });

        // Save/Load buttons
        const saveBtn = document.getElementById('save-btn');
        const loadBtn = document.getElementById('load-btn');
        const loadLevelInput = document.getElementById('load-level-input');

        saveBtn.addEventListener('click', saveLevel);
        loadBtn.addEventListener('click', () => loadLevelInput.click());
        loadLevelInput.addEventListener('change', loadLevel);


        // Toolbar logic
        toolButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                toolButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                gameState.activeTool = btn.dataset.tool;
            });
        });
        // Set default active tool
        const platformBtn = document.querySelector('.tool-btn[data-tool="platform"]');
        if(platformBtn) platformBtn.classList.add('active');

        // Mode switching
        const playBtn = document.getElementById('play-btn');
        const editBtn = document.getElementById('edit-btn');

        playBtn.addEventListener('click', () => {
            // --- Initialize Game State for PLAY mode ---
            gameState.collectibles.total = 0;
            gameState.collectibles.collected = 0;
            gameState.exit.activated = false;
            let playerStart = { x: 100, y: 100 };

            for (let y = 0; y < gameState.level.height; y++) {
                for (let x = 0; x < gameState.level.width; x++) {
                    const tile = gameState.level.grid[y][x];
                    if (tile === 'player') {
                        playerStart.x = x * CONFIG.GRID_SIZE;
                        playerStart.y = y * CONFIG.GRID_SIZE;
                    } else if (tile === 'coin') {
                        gameState.collectibles.total++;
                    } else if (tile === 'finish') {
                        gameState.exit.x = x;
                        gameState.exit.y = y;
                    }
                }
            }

            // Reset player state
            gameState.player.x = playerStart.x;
            gameState.player.y = playerStart.y;
            gameState.player.vx = 0;
            gameState.player.vy = 0;
            gameState.player.jumps = 2;

            gameState.gameMode = 'PLAY';
            playBtn.classList.add('active');
            editBtn.classList.remove('active');
            canvasContainer.style.overflow = 'hidden'; // Hide scrollbars in play mode
        });
        editBtn.addEventListener('click', () => {
            gameState.gameMode = 'EDIT';
            editBtn.classList.add('active');
            playBtn.classList.remove('active');
            canvasContainer.style.overflow = 'auto'; // Show scrollbars in edit mode
        });

        // Canvas painting listeners
        canvas.addEventListener('mousedown', (e) => {
            if (gameState.gameMode === 'EDIT') {
                isPainting = true;
                handleCanvasPaint(e);
            }
        });
        canvas.addEventListener('mousemove', (e) => {
            if (isPainting && gameState.gameMode === 'EDIT') {
                handleCanvasPaint(e);
            }
        });
        canvas.addEventListener('mouseup', () => { isPainting = false; });
        canvas.addEventListener('mouseleave', () => { isPainting = false; });


        requestAnimationFrame(gameLoop);
    }

    init();
});

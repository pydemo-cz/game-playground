document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    const canvasContainer = document.getElementById('canvas-container');

    // --- Configuration ---
    const CONFIG = {
        GRID_SIZE: 60,
        PLAYER_WIDTH: 90, // 90px (1.5x grid size)
        PLAYER_HEIGHT: 120, // 120px (2x grid size)
        MOVE_SPEED: 5,
        JUMP_FORCE: 18,
        GRAVITY: 0.8,
        CANVAS_WIDTH: 960,
        CANVAS_HEIGHT: 540,
        CAMERA_LERP: 0.1,
    };

    // --- Game State ---
    let gameState = {
        gameMode: 'EDIT', // EDIT or PLAY
        activeTool: 'platform', // can be 'move' or a tile type
        camera: { x: 0, y: 0 },
        isDraggingCamera: false,
        dragStart: { x: 0, y: 0 },
        cameraStart: { x: 0, y: 0 },
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
            backgroundColor: '#ffffff', // Default background color
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
            playerIdle: null,
            playerJump: null,
            spike: null,
            coin: null,
            finish: null,
            ground: null,
            btnLeft: null,
            btnRight: null,
            btnJump: null,
            btnEdit: null,
        },
    };

    // --- DOM Elements ---
    const toolbar = document.getElementById('toolbar');
    const toolButtons = document.querySelectorAll('.tool-btn');
    const mobileControls = document.getElementById('mobile-controls');

    // Add Move Tool to UI if not exists
    let moveToolBtn = document.querySelector('.tool-btn[data-tool="move"]');
    if (!moveToolBtn) {
        // Create the move tool button dynamically
        const toolsSection = document.getElementById('tools');
        const moveBtn = document.createElement('button');
        moveBtn.className = 'tool-btn';
        moveBtn.dataset.tool = 'move';
        moveBtn.textContent = 'Hand';
        moveBtn.title = 'Drag to move camera';
        // Insert as first tool
        toolsSection.insertBefore(moveBtn, toolsSection.firstChild);
        moveToolBtn = moveBtn;
    }

    // Add specific controls tool logic
    let controlsBtn = document.querySelector('.tool-btn[data-tool="controls"]');
    if (!controlsBtn) {
        const toolsSection = document.getElementById('tools');
        controlsBtn = document.createElement('button');
        controlsBtn.className = 'tool-btn';
        controlsBtn.dataset.tool = 'controls';
        controlsBtn.textContent = 'Controls';
        toolsSection.appendChild(controlsBtn);
    }


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
        up: false,
        down: false
    };

    function setupInputListeners() {
        window.addEventListener('keydown', (e) => {
            // Allow input in both modes, but filter actions in update()
            switch (e.code) {
                case 'ArrowLeft':
                case 'KeyA':
                    keys.left = true;
                    break;
                case 'ArrowRight':
                case 'KeyD':
                    keys.right = true;
                    break;
                case 'ArrowUp':
                case 'KeyW':
                    keys.up = true;
                    break;
                case 'ArrowDown':
                case 'KeyS':
                    keys.down = true;
                    break;
                case 'Space':
                    keys.jump = true;
                    break;
            }
        });
        window.addEventListener('keyup', (e) => {
            // Important: Handle keyup in ALL modes to prevent "stuck" keys
            switch (e.code) {
                case 'ArrowLeft':
                case 'KeyA':
                    keys.left = false;
                    break;
                case 'ArrowRight':
                case 'KeyD':
                    keys.right = false;
                    break;
                case 'ArrowUp':
                case 'KeyW':
                    keys.up = false;
                    break;
                case 'ArrowDown':
                case 'KeyS':
                    keys.down = false;
                    break;
                case 'Space':
                    keys.jump = false;
                    break;
            }
        });

        // Mobile Controls Touch Events
        const btnLeft = document.getElementById('btn-left');
        const btnRight = document.getElementById('btn-right');
        const btnJump = document.getElementById('btn-jump');

        const setupTouch = (el, key) => {
            if (!el) return;
            el.addEventListener('touchstart', (e) => { e.preventDefault(); keys[key] = true; });
            el.addEventListener('touchend', (e) => { e.preventDefault(); keys[key] = false; });
            // Add mouse events for testing on desktop
            el.addEventListener('mousedown', (e) => { keys[key] = true; });
            el.addEventListener('mouseup', (e) => { keys[key] = false; });
            el.addEventListener('mouseleave', (e) => { keys[key] = false; });
        };

        setupTouch(btnLeft, 'left');
        setupTouch(btnRight, 'right');
        setupTouch(btnJump, 'jump');
    }


    // --- Asset Management ---
    function processImage(file, targetWidth, targetHeight, keepRatio = false) {
        return new Promise((resolve) => {
            if (!file) {
                 resolve(null);
                 return;
            }
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = targetWidth;
                    canvas.height = targetHeight;
                    const ctx = canvas.getContext('2d');

                    let sx = 0, sy = 0, sWidth = img.width, sHeight = img.height;

                    if (keepRatio) {
                         const targetRatio = targetWidth / targetHeight;
                         const imgRatio = img.width / img.height;

                         if (imgRatio > targetRatio) {
                             // Image is wider than target: Crop width
                             sWidth = img.height * targetRatio;
                             sx = (img.width - sWidth) / 2;
                         } else {
                             // Image is taller than target: Crop height
                             sHeight = img.width / targetRatio;
                             sy = (img.height - sHeight) / 2;
                         }
                    } else {
                        // Square (Grid Size)
                         const size = Math.min(img.width, img.height);
                         sx = (img.width - size) / 2;
                         sy = (img.height - size) / 2;
                         sWidth = size;
                         sHeight = size;
                    }

                    ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);

                    // --- Transparency Logic ---
                    const threshold = parseInt(document.getElementById('transparency-slider').value) || 240;
                    const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
                    const data = imageData.data;
                    for (let i = 0; i < data.length; i += 4) {
                        const r = data[i];
                        const g = data[i + 1];
                        const b = data[i + 2];
                        // If pixel is lighter than threshold (white/light grey), make it transparent
                        if (r > threshold && g > threshold && b > threshold) {
                            data[i + 3] = 0; // Alpha = 0
                        }
                    }
                    ctx.putImageData(imageData, 0, 0);
                    // ---------------------------

                    resolve(canvas.toDataURL(file.type));
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    function handleAssetUpload(file, assetName) {
        if (!file) return;

        // Determine dimensions based on asset type
        let w = CONFIG.GRID_SIZE;
        let h = CONFIG.GRID_SIZE;
        let keepRatio = false;

        if (assetName === 'playerIdle' || assetName === 'playerJump') {
            w = CONFIG.PLAYER_WIDTH;
            h = CONFIG.PLAYER_HEIGHT;
            keepRatio = true;
        } else if (['btnLeft', 'btnRight', 'btnJump'].includes(assetName)) {
            // Mobile buttons are squares? CSS says 80x80. Let's make them 80x80.
            w = 80;
            h = 80;
        } else if (assetName === 'btnEdit') {
             w = 60;
             h = 60;
        }

        processImage(file, w, h, keepRatio).then(base64 => {
            if (!base64) return;

            gameState.assets[assetName] = base64;

            // Create and cache the image object
            const img = new Image();
            img.src = base64;
            assetImages[assetName] = img;

            // Update mobile buttons if applicable
            if (['btnLeft', 'btnRight', 'btnJump'].includes(assetName)) {
                updateMobileButtonVisuals();
            }
            if (assetName === 'btnEdit') {
                updateEditButtonVisuals();
            }

            console.log(`Asset '${assetName}' processed and cached.`);
        });
    }

    function updateEditButtonVisuals() {
        const el = document.getElementById('btn-edit-overlay');
        const assetKey = 'btnEdit';
        if (gameState.assets[assetKey]) {
            el.style.backgroundImage = `url(${gameState.assets[assetKey]})`;
            el.style.backgroundColor = 'transparent';
            el.style.border = 'none';
        } else {
            // Fallback
            el.style.backgroundImage = 'none';
            el.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
            el.style.border = '2px solid rgba(255, 255, 255, 0.5)';
        }
    }

    function updateMobileButtonVisuals() {
        const updateBtn = (id, assetKey) => {
            const el = document.getElementById(id);
            if (gameState.assets[assetKey]) {
                el.style.backgroundImage = `url(${gameState.assets[assetKey]})`;
                el.style.backgroundColor = 'transparent';
                el.style.border = 'none';
            } else {
                el.style.backgroundImage = 'none';
                el.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
                el.style.border = '2px solid rgba(255, 255, 255, 0.5)';
            }
        };
        updateBtn('btn-left', 'btnLeft');
        updateBtn('btn-right', 'btnRight');
        updateBtn('btn-jump', 'btnJump');
    }

    function setupAssetInputs() {
        // We still check legacy inputs just in case, but rely on dynamic buttons mainly.
        const assetInputs = document.getElementById('asset-inputs');
        if (assetInputs) {
            assetInputs.addEventListener('change', (e) => {
                if (e.target.type === 'file') {
                    const assetName = e.target.dataset.asset;
                    handleAssetUpload(e.target.files[0], assetName);
                }
            });
        }

        const mobileAssetsInputs = document.getElementById('mobile-assets-inputs');
        if (mobileAssetsInputs) {
            mobileAssetsInputs.addEventListener('change', (e) => {
                 if (e.target.type === 'file') {
                    const assetName = e.target.dataset.asset;
                    handleAssetUpload(e.target.files[0], assetName);
                }
            });
        }
    }

    // --- Contextual Toolbar UI ---
    function updateContextControls(toolName) {
        // Find or create the context controls container
        let container = document.getElementById('context-controls');
        if (!container) {
             // Create it next to size controls (last toolbar section)
             const toolbar = document.getElementById('toolbar');
             container = document.createElement('div');
             container.id = 'context-controls';
             container.className = 'toolbar-section';
             // Insert before the last section (Size) or just append
             toolbar.appendChild(container);
        }

        // Clear existing
        container.innerHTML = '';

        // Helper to create upload button
        const createUploadBtn = (label, assetKey) => {
             const btn = document.createElement('button');
             btn.textContent = label;
             btn.style.fontSize = '12px';

             // Create hidden input
             const input = document.createElement('input');
             input.type = 'file';
             input.accept = 'image/*';
             input.style.display = 'none';
             input.addEventListener('change', (e) => {
                 handleAssetUpload(e.target.files[0], assetKey);
             });
             container.appendChild(input);

             btn.onclick = () => input.click();
             container.appendChild(btn);
        };

        if (toolName === 'controls') {
             createUploadBtn('Upload Left', 'btnLeft');
             createUploadBtn('Upload Right', 'btnRight');
             createUploadBtn('Upload Jump', 'btnJump');
             createUploadBtn('Upload Edit Btn', 'btnEdit');
        } else if (toolName === 'player') {
             createUploadBtn('Upload Idle', 'playerIdle');
             createUploadBtn('Upload Jump', 'playerJump');
        } else if (toolName === 'platform') {
             createUploadBtn('Upload Platform', 'platform');
        } else if (toolName === 'spike') {
             createUploadBtn('Upload Spike', 'spike');
        } else if (toolName === 'coin') {
             createUploadBtn('Upload Coin', 'coin');
        } else if (toolName === 'finish') {
             createUploadBtn('Upload Finish', 'finish');
        } else if (toolName === 'ground') {
             createUploadBtn('Upload Ground', 'ground');
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

    // Fixed resolution, no resizing of the canvas element itself (it scales via CSS)
    function setupCanvas() {
        canvas.width = CONFIG.CANVAS_WIDTH;
        canvas.height = CONFIG.CANVAS_HEIGHT;
    }

    function draw() {
        // Clear canvas with user selected background color
        ctx.fillStyle = gameState.level.backgroundColor || '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        // Apply Camera Transform
        ctx.translate(-Math.floor(gameState.camera.x), -Math.floor(gameState.camera.y));

        // Calculate visible range (culling)
        const startCol = Math.floor(gameState.camera.x / CONFIG.GRID_SIZE);
        const endCol = startCol + (CONFIG.CANVAS_WIDTH / CONFIG.GRID_SIZE) + 1;
        const startRow = Math.floor(gameState.camera.y / CONFIG.GRID_SIZE);
        const endRow = startRow + (CONFIG.CANVAS_HEIGHT / CONFIG.GRID_SIZE) + 1;

        // Draw grid content
        for (let y = Math.max(0, startRow); y < Math.min(gameState.level.height, endRow); y++) {
            for (let x = Math.max(0, startCol); x < Math.min(gameState.level.width, endCol); x++) {
                let tileType = gameState.level.grid[y][x];

                // In PLAY mode, don't draw the finish tile unless it's activated
                if (gameState.gameMode === 'PLAY') {
                    if (tileType === 'finish' && !gameState.exit.activated) continue;
                    if (tileType === 'player') continue; // Don't draw the start marker in play mode
                }

                if (tileType) {
                    const img = assetImages[tileType];
                    const posX = x * CONFIG.GRID_SIZE;
                    const posY = y * CONFIG.GRID_SIZE;

                    if (img && img.complete) {
                        ctx.drawImage(img, posX, posY, CONFIG.GRID_SIZE, CONFIG.GRID_SIZE);
                    } else if (tileType === 'player' && assetImages['playerIdle']) {
                        // Special case for player in editor: draw sprite if available
                        // Player is larger than grid, center it horizontally on the tile, bottom aligned
                        // Actually logic in game is Top-Left based.
                        const pImg = assetImages['playerIdle'];
                        if (pImg.complete) {
                             ctx.drawImage(pImg, posX, posY, CONFIG.PLAYER_WIDTH, CONFIG.PLAYER_HEIGHT);
                        }
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
            // Determine sprite based on state (jump vs idle)
            let img = assetImages['playerIdle'];
            if (p.jumps < 2) { // In air (simple check, 2 jumps means on ground)
                 img = assetImages['playerJump'] || img;
            }

            ctx.save();
            // Player is already in world coordinates, camera transform handles position
            // We just need to handle flipping
            if (!p.facingRight) {
                // Flip around the center of the sprite
                ctx.translate(p.x + CONFIG.PLAYER_WIDTH / 2, p.y + CONFIG.PLAYER_HEIGHT / 2);
                ctx.scale(-1, 1);
                ctx.translate(-(p.x + CONFIG.PLAYER_WIDTH / 2), -(p.y + CONFIG.PLAYER_HEIGHT / 2));
            }

            if (img && img.complete) {
                ctx.drawImage(img, p.x, p.y, CONFIG.PLAYER_WIDTH, CONFIG.PLAYER_HEIGHT);
            } else {
                ctx.fillStyle = TILE_COLORS.player;
                ctx.fillRect(p.x, p.y, CONFIG.PLAYER_WIDTH, CONFIG.PLAYER_HEIGHT);
            }
            ctx.restore();
        }

        ctx.restore(); // Restore camera transform

        // Draw HUD (Fixed on screen)
        if (gameState.gameMode === 'PLAY') {
            // Draw Item Icon and Count (Top Right)
            const hudX = CONFIG.CANVAS_WIDTH - 150;
            const hudY = 20;

            // Draw Icon (Coin)
            const coinImg = assetImages['coin'];
            if (coinImg && coinImg.complete) {
                 ctx.drawImage(coinImg, hudX, hudY, 40, 40);
            } else {
                 ctx.fillStyle = 'yellow';
                 ctx.fillRect(hudX, hudY, 40, 40);
            }

            // Draw Text
            ctx.font = "bold 30px Arial";
            ctx.textAlign = "left";
            const text = `${gameState.collectibles.collected} / ${gameState.collectibles.total}`;

            // Outline for visibility on any background
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 3;
            ctx.strokeText(text, hudX + 50, hudY + 30);

            ctx.fillStyle = "white";
            ctx.fillText(text, hudX + 50, hudY + 30);
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
                        restartLevel();
                     } else if (tile === 'finish' && gameState.exit.activated) {
                        alert("YOU WIN!");
                        setEditMode();
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

                 // Check collision with spike here too (instant death)
                 if (tile === 'spike' && isColliding(p, tileX, tileY)) {
                     restartLevel();
                     return;
                 }

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

    function restartLevel() {
         // Find player start again
         let playerStart = { x: 100, y: 100 };
         for (let y = 0; y < gameState.level.height; y++) {
            for (let x = 0; x < gameState.level.width; x++) {
                if (gameState.level.grid[y][x] === 'player') {
                    playerStart.x = x * CONFIG.GRID_SIZE;
                    playerStart.y = y * CONFIG.GRID_SIZE;
                    break;
                }
            }
         }
         gameState.player.x = playerStart.x;
         gameState.player.y = playerStart.y;
         gameState.player.vx = 0;
         gameState.player.vy = 0;
         gameState.player.jumps = 2;
    }


    function update() {
        // --- Editor Camera Navigation ---
        if (gameState.gameMode === 'EDIT') {
            const CAM_SPEED = 10;
            // Allow camera movement regardless of active tool
            if (keys.left) gameState.camera.x -= CAM_SPEED;
            if (keys.right) gameState.camera.x += CAM_SPEED;
            if (keys.up) gameState.camera.y -= CAM_SPEED;
            if (keys.down) gameState.camera.y += CAM_SPEED;

            // Clamp camera
            const worldWidth = gameState.level.width * CONFIG.GRID_SIZE;
            const worldHeight = gameState.level.height * CONFIG.GRID_SIZE;
            gameState.camera.x = Math.max(0, Math.min(gameState.camera.x, worldWidth - CONFIG.CANVAS_WIDTH));
            gameState.camera.y = Math.max(0, Math.min(gameState.camera.y, worldHeight - CONFIG.CANVAS_HEIGHT));
        }

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

        // Clamp Horizontal Position (Prevent going off-screen)
        const worldWidth = gameState.level.width * CONFIG.GRID_SIZE;
        p.x = Math.max(0, Math.min(p.x, worldWidth - CONFIG.PLAYER_WIDTH));

        checkCollisionsX();


        // --- Vertical Movement & Gravity ---
        p.vy += CONFIG.GRAVITY;
        p.y += p.vy;

        // Check falling off the map
        const worldHeight = gameState.level.height * CONFIG.GRID_SIZE;
        if (p.y > worldHeight) {
            restartLevel();
            return;
        }

        checkCollisionsY();


        // --- Jumping ---
        if (keys.jump && p.jumps > 0) {
            p.vy = -CONFIG.JUMP_FORCE;
            p.jumps--;
            keys.jump = false; // Prevent holding jump
        }

        // --- Camera Follow ---
        // Target: Center player on screen
        const targetCamX = p.x + CONFIG.PLAYER_WIDTH / 2 - CONFIG.CANVAS_WIDTH / 2;
        const targetCamY = p.y + CONFIG.PLAYER_HEIGHT / 2 - CONFIG.CANVAS_HEIGHT / 2;

        // Lerp
        gameState.camera.x += (targetCamX - gameState.camera.x) * CONFIG.CAMERA_LERP;
        gameState.camera.y += (targetCamY - gameState.camera.y) * CONFIG.CAMERA_LERP;

        // Clamp camera to world bounds
        // worldWidth is already defined above
        // const worldWidth = gameState.level.width * CONFIG.GRID_SIZE;
        // const worldHeight = gameState.level.height * CONFIG.GRID_SIZE;
        // Actually worldHeight is also defined above. Let's reuse them or just use let/no-const.
        // To be safe and clean, I will just remove the 'const' and assign to new variable names or just reuse if they are in scope.
        // They are in 'update' scope.

        gameState.camera.x = Math.max(0, Math.min(gameState.camera.x, worldWidth - CONFIG.CANVAS_WIDTH));
        gameState.camera.y = Math.max(0, Math.min(gameState.camera.y, worldHeight - CONFIG.CANVAS_HEIGHT));
    }

    function gameLoop() {
        update();
        // resizeCanvas(); // No longer needed
        draw();
        requestAnimationFrame(gameLoop);
    }

    // --- Editor-specific Drawing ---
    function drawEditorUI() {
        // Draw grid lines
        // Contrast check against background
        const bgHex = gameState.level.backgroundColor || '#ffffff';
        // Simple YIQ contrast check
        const r = parseInt(bgHex.substr(1, 2), 16);
        const g = parseInt(bgHex.substr(3, 2), 16);
        const b = parseInt(bgHex.substr(5, 2), 16);
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;

        ctx.strokeStyle = (yiq >= 128) ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;

        const startX = Math.floor(gameState.camera.x / CONFIG.GRID_SIZE) * CONFIG.GRID_SIZE;
        const startY = Math.floor(gameState.camera.y / CONFIG.GRID_SIZE) * CONFIG.GRID_SIZE;
        const endX = gameState.camera.x + CONFIG.CANVAS_WIDTH;
        const endY = gameState.camera.y + CONFIG.CANVAS_HEIGHT;

        for (let x = startX; x <= endX && x <= gameState.level.width * CONFIG.GRID_SIZE; x += CONFIG.GRID_SIZE) {
            ctx.beginPath();
            ctx.moveTo(x, gameState.camera.y);
            ctx.lineTo(x, gameState.camera.y + CONFIG.CANVAS_HEIGHT);
            ctx.stroke();
        }
        for (let y = startY; y <= endY && y <= gameState.level.height * CONFIG.GRID_SIZE; y += CONFIG.GRID_SIZE) {
            ctx.beginPath();
            ctx.moveTo(gameState.camera.x, y);
            ctx.lineTo(gameState.camera.x + CONFIG.CANVAS_WIDTH, y);
            ctx.stroke();
        }

        // Draw World Bounds Border
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, gameState.level.width * CONFIG.GRID_SIZE, gameState.level.height * CONFIG.GRID_SIZE);
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

                    // Ensure defaults for new properties if missing
                    if (!gameState.level.backgroundColor) gameState.level.backgroundColor = '#ffffff';

                    // Update UI
                    document.getElementById('width-label').textContent = gameState.level.width;
                    document.getElementById('height-label').textContent = gameState.level.height;
                    document.getElementById('bg-color-picker').value = gameState.level.backgroundColor;


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

                    updateMobileButtonVisuals();

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
    let isMouseDown = false;

    function getMouseGridPos(e) {
        const rect = canvas.getBoundingClientRect();
        // Calculate scale factor (CSS size vs Internal size)
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const mouseX = (e.clientX - rect.left) * scaleX;
        const mouseY = (e.clientY - rect.top) * scaleY;

        // Add camera offset
        const worldX = mouseX + gameState.camera.x;
        const worldY = mouseY + gameState.camera.y;

        return {
            x: Math.floor(worldX / CONFIG.GRID_SIZE),
            y: Math.floor(worldY / CONFIG.GRID_SIZE),
            rawX: mouseX,
            rawY: mouseY
        };
    }

    function handleCanvasInteraction(e) {
        const pos = getMouseGridPos(e);
        const { x, y } = pos;

        if (gameState.activeTool === 'move') {
            // Camera Panning
            if (e.type === 'mousedown') {
                gameState.isDraggingCamera = true;
                gameState.dragStart = { x: e.clientX, y: e.clientY };
                gameState.cameraStart = { ...gameState.camera };
                canvas.style.cursor = 'grabbing';
            } else if (e.type === 'mousemove' && gameState.isDraggingCamera) {
                // Calculate delta in screen pixels, need to map to canvas pixels?
                // Actually the camera units are 1:1 with internal canvas pixels.
                // But the drag is in screen pixels.
                const rect = canvas.getBoundingClientRect();
                const scaleX = canvas.width / rect.width;
                const scaleY = canvas.height / rect.height;

                const dx = (e.clientX - gameState.dragStart.x) * scaleX;
                const dy = (e.clientY - gameState.dragStart.y) * scaleY;

                gameState.camera.x = gameState.cameraStart.x - dx;
                gameState.camera.y = gameState.cameraStart.y - dy;
            } else if (e.type === 'mouseup' || e.type === 'mouseleave') {
                gameState.isDraggingCamera = false;
                canvas.style.cursor = 'default';
            }
        } else {
            // Painting
            if (e.type === 'mousedown') {
                isMouseDown = true;
                paintTile(x, y);
            } else if (e.type === 'mousemove' && isMouseDown) {
                paintTile(x, y);
            } else if (e.type === 'mouseup' || e.type === 'mouseleave') {
                isMouseDown = false;
            }
        }
    }

    function paintTile(x, y) {
        if (y >= 0 && y < gameState.level.height - 1 && x >= 0 && x < gameState.level.width) {
            const tool = gameState.activeTool;
            // Don't paint if tool is controls
            if (tool === 'controls') return;

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

    // --- Update Toolbar Visibility based on Mode ---
    function updateToolbarVisibility() {
        const toolbar = document.getElementById('toolbar');
        const editOverlay = document.getElementById('btn-edit-overlay');

        if (gameState.gameMode === 'PLAY') {
             toolbar.style.display = 'none';
             editOverlay.classList.remove('hidden');
        } else {
             toolbar.style.display = 'flex';
             editOverlay.classList.add('hidden');
        }
    }

    function setPlayMode() {
        // --- Initialize Game State for PLAY mode ---
        gameState.collectibles.total = 0;
        gameState.collectibles.collected = 0;
        gameState.exit.activated = false;
        let playerStart = { x: 100, y: 100 };
        let foundStart = false;

        for (let y = 0; y < gameState.level.height; y++) {
            for (let x = 0; x < gameState.level.width; x++) {
                const tile = gameState.level.grid[y][x];
                if (tile === 'player') {
                    playerStart.x = x * CONFIG.GRID_SIZE;
                    playerStart.y = y * CONFIG.GRID_SIZE;
                    foundStart = true;
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
        document.getElementById('play-btn').classList.add('active');
        document.getElementById('edit-btn').classList.remove('active');
        // canvasContainer.style.overflow = 'hidden'; // Always hidden now
        mobileControls.classList.remove('hidden');

        updateToolbarVisibility();
    }

    function setEditMode() {
        gameState.gameMode = 'EDIT';
        document.getElementById('edit-btn').classList.add('active');
        document.getElementById('play-btn').classList.remove('active');
        // canvasContainer.style.overflow = 'auto'; // Always hidden now
        mobileControls.classList.add('hidden');

        updateToolbarVisibility();
    }


    // --- Initialization ---
    function init() {
        console.log("Jumpina Editor Initialized");
        setupCanvas();
        initializeGrid();
        setupAssetInputs();
        setupInputListeners();

        // Initial tool setup
        if (moveToolBtn) {
            moveToolBtn.classList.add('active');
            gameState.activeTool = 'move';
            updateContextControls('move');
        } else {
            const platformBtn = document.querySelector('.tool-btn[data-tool="platform"]');
            if(platformBtn) {
                platformBtn.classList.add('active');
                 gameState.activeTool = 'platform';
                 updateContextControls('platform');
            }
        }


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

        // Settings listeners
        const bgColorPicker = document.getElementById('bg-color-picker');
        bgColorPicker.addEventListener('input', (e) => {
            gameState.level.backgroundColor = e.target.value;
        });

        // Edit Overlay Listener
        document.getElementById('btn-edit-overlay').addEventListener('click', setEditMode);
        document.getElementById('btn-edit-overlay').addEventListener('touchstart', (e) => {
             e.preventDefault(); // Prevent ghost click if on mobile
             setEditMode();
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
        // Re-query buttons again to include dynamic ones
        const allToolButtons = document.querySelectorAll('.tool-btn');
        allToolButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (btn.textContent.startsWith('Up') || btn.classList.contains('control-upload-btn')) return; // Ignore upload helpers for active state

                document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                gameState.activeTool = btn.dataset.tool;
                updateContextControls(gameState.activeTool);
            });
        });

        // Mode switching
        const playBtn = document.getElementById('play-btn');
        const editBtn = document.getElementById('edit-btn');

        playBtn.addEventListener('click', setPlayMode);
        editBtn.addEventListener('click', setEditMode);

        // Canvas painting listeners
        canvas.addEventListener('mousedown', handleCanvasInteraction);
        canvas.addEventListener('mousemove', handleCanvasInteraction);
        canvas.addEventListener('mouseup', handleCanvasInteraction);
        canvas.addEventListener('mouseleave', handleCanvasInteraction);


        requestAnimationFrame(gameLoop);
    }

    init();
});

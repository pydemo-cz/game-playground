// Jumpik - Game Logic

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const debugInfo = document.getElementById('debug-info');

// Game State
const GAME_WIDTH = 1280;
const GAME_HEIGHT = 720; // 16:9 Aspect Ratio
const GRAVITY = 0.5;
const FRICTION = 0.8;
const JUMP_FORCE = -15;
const SPEED = 6;

let assets = {
    sheet: new Image()
};

let keys = {
    ArrowLeft: false,
    ArrowRight: false,
    Space: false,
    ArrowUp: false
};

// Sprite Definitions (Source Coordinates from sheet.png)
// Refined based on visual analysis (Image width approx 1000px)
const SPRITES = {
    player: { x: 60, y: 220, w: 140, h: 200 },        // Left page, standing
    player_jump: { x: 250, y: 200, w: 160, h: 180 },  // Left page, jumping (left of spiral)
    ground: { x: 600, y: 400, w: 300, h: 40 },        // Right page, clean grid
    box: { x: 750, y: 180, w: 60, h: 60 },            // Right page, top shelf item
    flag: { x: 920, y: 120, w: 80, h: 100 },          // Right page, top right
    spikes: { x: 650, y: 320, w: 150, h: 40 }         // Right page, bottom spikes
};

let player = {
    x: 100,
    y: 100,
    width: 60,   // Hitbox width
    height: 90,  // Hitbox height
    vx: 0,
    vy: 0,
    grounded: false,
    jumpsLeft: 2,
    facingRight: true
};

let camera = {
    x: 0,
    y: 0
};

let level = {
    platforms: [],
    items: [],
    spikes: [],
    goal: null
};

let score = 0;
let debugMode = false;

// Initialization
function init() {
    assets.sheet.src = 'assets/sheet.png';
    assets.sheet.onload = () => {
        console.log("Sprite sheet loaded. Dims:", assets.sheet.width, assets.sheet.height);
        startGame();
    };

    setupInputs();
    resize();
    window.addEventListener('resize', resize);

    createLevel();
}

function createLevel() {
    // Ground
    for(let i=0; i<30; i++) {
        level.platforms.push({ x: i * 100, y: 600, w: 100, h: 50 });
    }

    // Some elevated platforms
    level.platforms.push({ x: 400, y: 450, w: 200, h: 40 });
    level.platforms.push({ x: 700, y: 300, w: 200, h: 40 });
    level.platforms.push({ x: 1100, y: 400, w: 200, h: 40 });

    // Spikes (Grid-aligned roughly)
    level.spikes.push({ x: 900, y: 560, w: 100, h: 40 });
    level.spikes.push({ x: 1400, y: 560, w: 100, h: 40 });

    // Collectibles
    level.items.push({ x: 500, y: 400, w: 50, h: 50, collected: false });
    level.items.push({ x: 800, y: 250, w: 50, h: 50, collected: false });
    level.items.push({ x: 1150, y: 350, w: 50, h: 50, collected: false });

    // Goal
    level.goal = { x: 2600, y: 500, w: 80, h: 100 };
}

function setupInputs() {
    // Keyboard
    window.addEventListener('keydown', e => {
        if(keys.hasOwnProperty(e.code) || e.code === 'Space') {
            keys[e.code] = true;
            if(e.code === 'Space' || e.code === 'ArrowUp') jump();
        }
    });

    window.addEventListener('keyup', e => {
        if(keys.hasOwnProperty(e.code) || e.code === 'Space') {
            keys[e.code] = false;
        }
    });

    // Touch
    const btnLeft = document.getElementById('btn-left');
    const btnRight = document.getElementById('btn-right');
    const btnJump = document.getElementById('btn-jump');

    const addTouch = (elem, code) => {
        if(!elem) return;
        elem.addEventListener('touchstart', (e) => { e.preventDefault(); keys[code] = true; if(code === 'Space') jump(); });
        elem.addEventListener('touchend', (e) => { e.preventDefault(); keys[code] = false; });
    };

    addTouch(btnLeft, 'ArrowLeft');
    addTouch(btnRight, 'ArrowRight');
    addTouch(btnJump, 'Space');
}

function jump() {
    if (player.jumpsLeft > 0) {
        player.vy = JUMP_FORCE;
        player.jumpsLeft--;
        player.grounded = false;
    }
}

function resetPlayer() {
    player.x = 100;
    player.y = 100;
    player.vy = 0;
    player.vx = 0;
    score = 0;
    document.getElementById('item-count').innerText = score;

    // Reset items
    level.items.forEach(i => i.collected = false);
}

function update() {
    // Horizontal Movement
    if (keys.ArrowLeft) {
        player.vx = -SPEED;
        player.facingRight = false;
    } else if (keys.ArrowRight) {
        player.vx = SPEED;
        player.facingRight = true;
    } else {
        player.vx *= FRICTION;
    }

    player.x += player.vx;

    // Collision X
    checkCollisionsX();

    // Vertical Movement
    player.vy += GRAVITY;
    player.y += player.vy;

    player.grounded = false;

    // Collision Y
    checkCollisionsY();

    // Level Bounds / Fall Death
    if (player.y > 1000) {
        resetPlayer();
    }

    // Spike Collision
    level.spikes.forEach(spike => {
        // Simple hitbox reduction for spikes to be forgiving
        let hitbox = {
            x: spike.x + 10,
            y: spike.y + 10,
            w: spike.w - 20,
            h: spike.h - 10
        };
        if (rectIntersect(player, hitbox)) {
            resetPlayer();
        }
    });

    // Items Collection
    level.items.forEach(item => {
        if (!item.collected && rectIntersect(player, item)) {
            item.collected = true;
            score++;
            document.getElementById('item-count').innerText = score;
        }
    });

    // Camera Follow
    let targetCamX = player.x - GAME_WIDTH / 2;
    if (targetCamX < 0) targetCamX = 0;
    camera.x += (targetCamX - camera.x) * 0.1;
}

function rectIntersect(r1, r2) {
    return !(r2.x > r1.x + r1.width ||
             r2.x + r2.w < r1.x ||
             r2.y > r1.y + r1.height ||
             r2.y + r2.h < r1.y);
}

function checkCollisionsX() {
    level.platforms.forEach(plat => {
        if (rectIntersect(player, plat)) {
            if (player.vx > 0) {
                player.x = plat.x - player.width;
            } else if (player.vx < 0) {
                player.x = plat.x + plat.w;
            }
            player.vx = 0;
        }
    });
}

function checkCollisionsY() {
    level.platforms.forEach(plat => {
        if (rectIntersect(player, plat)) {
            if (player.vy > 0) {
                player.y = plat.y - player.height;
                player.grounded = true;
                player.jumpsLeft = 2;
                player.vy = 0;
            } else if (player.vy < 0) {
                player.y = plat.y + plat.h;
                player.vy = 0;
            }
        }
    });
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.scale(canvas.width / GAME_WIDTH, canvas.height / GAME_HEIGHT);
    ctx.translate(-camera.x, -camera.y);

    // Draw Platforms
    level.platforms.forEach(plat => {
        let sprite = SPRITES.ground;
        ctx.drawImage(assets.sheet,
            sprite.x, sprite.y, sprite.w, sprite.h,
            plat.x, plat.y, plat.w, plat.h);
    });

    // Draw Spikes
    level.spikes.forEach(spike => {
        let sprite = SPRITES.spikes;
        ctx.drawImage(assets.sheet,
            sprite.x, sprite.y, sprite.w, sprite.h,
            spike.x, spike.y, spike.w, spike.h);
    });

    // Draw Items
    level.items.forEach(item => {
        if (!item.collected) {
            let sprite = SPRITES.box;
            ctx.drawImage(assets.sheet,
                sprite.x, sprite.y, sprite.w, sprite.h,
                item.x, item.y, item.w, item.h);
        }
    });

    // Draw Goal
    if (level.goal) {
        let sprite = SPRITES.flag;
        ctx.drawImage(assets.sheet,
            sprite.x, sprite.y, sprite.w, sprite.h,
            level.goal.x, level.goal.y, level.goal.w, level.goal.h);
    }

    // Draw Player
    let pSprite = player.grounded ? SPRITES.player : SPRITES.player_jump;

    // Visual Offset logic
    // We try to center the sprite visually over the hitbox
    let visualScale = 1.0;
    let vw = pSprite.w * visualScale;
    let vh = pSprite.h * visualScale;

    // Center horizontally, Align bottom
    let vx = player.x + (player.width - vw) / 2;
    let vy = player.y + (player.height - vh);

    ctx.save();
    if (!player.facingRight) {
        ctx.translate(player.x + player.width/2, player.y + player.height/2);
        ctx.scale(-1, 1);
        ctx.translate(-(player.x + player.width/2), -(player.y + player.height/2));
    }

    ctx.drawImage(assets.sheet,
        pSprite.x, pSprite.y, pSprite.w, pSprite.h,
        vx, vy, vw, vh);

    ctx.restore();

    // Debug Mode Draw
    if (debugMode) {
        ctx.restore();
        let scale = 0.5;
        ctx.drawImage(assets.sheet, 0, 0, assets.sheet.width * scale, assets.sheet.height * scale);
        ctx.strokeStyle = 'red';
        const drawDebugRect = (s, n) => {
             ctx.strokeRect(s.x * scale, s.y * scale, s.w * scale, s.h * scale);
             ctx.fillText(n, s.x * scale, s.y * scale);
        };
        drawDebugRect(SPRITES.player, "Idle");
        drawDebugRect(SPRITES.player_jump, "Jump");
        drawDebugRect(SPRITES.ground, "Ground");
        drawDebugRect(SPRITES.box, "Box");
        drawDebugRect(SPRITES.flag, "Flag");
        drawDebugRect(SPRITES.spikes, "Spikes");
        return;
    }

    ctx.restore();
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

function startGame() {
    loop();
}

function resize() {
    let aspect = GAME_WIDTH / GAME_HEIGHT;
    let windowAspect = window.innerWidth / window.innerHeight;

    if (windowAspect < aspect) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerWidth / aspect;
    } else {
        canvas.height = window.innerHeight;
        canvas.width = window.innerHeight * aspect;
    }
    ctx.imageSmoothingEnabled = true;
}

init();

import * as THREE from 'three';

// --- Configuration ---
const SCENE_COLOR = 0x87CEEB; // Sky blue
const GROUND_COLOR = 0x228B22; // Forest Green
const PLAYER_COLOR = 0x0000FF; // Blue player
const PLAYER_SPEED = 10;
const HIVE_COLOR = 0xFFD700; // Gold
const SHOP_COLOR = 0x8B4513; // Brown
const RED_FIELD_COLOR = 0xFF0000;
const BLUE_FIELD_COLOR = 0x0000FF;
const WHITE_FIELD_COLOR = 0xFFFFFF;

// Field Zones (x, z, width, height)
const FIELDS = [
    { type: 'WHITE', color: WHITE_FIELD_COLOR, x: 0, z: 20, w: 30, h: 20 },
    { type: 'RED', color: RED_FIELD_COLOR, x: -35, z: 20, w: 20, h: 20 },
    { type: 'BLUE', color: BLUE_FIELD_COLOR, x: 35, z: 20, w: 20, h: 20 }
];

const TOOLS = [
    { name: "Stick", cost: 0, power: 1, type: 'ALL' },
    { name: "Rake", cost: 100, power: 3, type: 'ALL' },
    { name: "Vacuum", cost: 500, power: 10, type: 'ALL' },
    { name: "Dark Scythe", cost: 5000, power: 50, type: 'RED' },
    { name: "Tide Popper", cost: 5000, power: 50, type: 'BLUE' },
    { name: "Gummy Baller", cost: 5000, power: 50, type: 'WHITE' }
];

const BACKPACKS = [
    { name: "Pouch", cost: 0, capacity: 100 },
    { name: "Satchel", cost: 200, capacity: 300 },
    { name: "Canister", cost: 1000, capacity: 1000 },
    { name: "Porcelain Port-O-Hive", cost: 5000, capacity: 5000 },
    { name: "Coconut Canister", cost: 25000, capacity: 20000 },
    { name: "Petal Belt", cost: 100000, capacity: 50000 }
];

// --- State ---
const state = {
    keys: {},
    player: null,
    hive: null,
    shop: null,
    flowers: [], // Array of { mesh, type }
    pollen: 0,
    honey: 0,
    backpackCapacity: 100,
    currentToolIndex: 0,
    currentBackpackIndex: 0,
    tool: {
        mesh: null,
        isSwinging: false,
        swingAngle: 0,
        swingDirection: 1
    },
    bees: [], // Kept for active bee objects update loop
    hiveSlots: new Array(25).fill(null),
    inventory: {
        eggs: 0
    },
    tickets: 0,
    isShopOpen: false,
    isHiveOpen: false,
    inShopZone: false, // Tracks General Shop (Brown)
    inHiveZone: false,
    activeShopType: 'GENERAL', // GENERAL, RED, BLUE, WHITE, TICKET
    shopSelectionIndex: 0,
    tokens: [],
    shops: [] // Array of shop mesh objects with type
};

// UI Elements
const uiPollen = document.getElementById('pollen-count');
const uiCapacity = document.getElementById('backpack-capacity');
const uiHoney = document.getElementById('honey-count');
const uiTickets = document.getElementById('ticket-count');
const uiConversion = document.getElementById('conversion-msg');

// Modals
const shopModal = document.getElementById('shop-modal');
const hiveModal = document.getElementById('hive-modal');
const hiveGrid = document.getElementById('hive-grid');

// Shop UI Elements
const shopName = document.getElementById('shop-item-name');
const shopDesc = document.getElementById('shop-item-desc');
const shopCost = document.getElementById('shop-item-cost');
const btnShopPrev = document.getElementById('shop-prev');
const btnShopNext = document.getElementById('shop-next');
const btnShopBuy = document.getElementById('shop-buy-btn');
const btnShopClose = document.getElementById('shop-close-btn');

// Hive UI Elements
const btnHiveClose = document.getElementById('hive-close-btn');

// Confirm Modal Elements
const confirmModal = document.getElementById('confirm-modal');
const confirmTitle = document.getElementById('confirm-title');
const confirmMsg = document.getElementById('confirm-msg');
const btnConfirmYes = document.getElementById('confirm-yes');
const btnConfirmNo = document.getElementById('confirm-no');

let confirmCallback = null;

function showConfirm(title, msg, onYes) {
    confirmTitle.innerText = title;
    confirmMsg.innerText = msg;
    confirmCallback = onYes;
    confirmModal.classList.remove('hidden');
}

function closeConfirm() {
    confirmModal.classList.add('hidden');
    confirmCallback = null;
}

btnConfirmYes.addEventListener('click', () => {
    if (confirmCallback) confirmCallback();
    closeConfirm();
});

btnConfirmNo.addEventListener('click', closeConfirm);

// --- Shop System ---
let eggCost = 25;

function getShopItemsForType(type) {
    const items = [];

    if (type === 'GENERAL') {
        items.push({
            type: 'EGG',
            name: 'Basic Egg',
            desc: 'Hatches a random bee.',
            cost: eggCost,
            currency: 'Honey'
        });

        // General Tools (Stick, Rake, Vacuum)
        const nextToolIdx = state.currentToolIndex + 1;
        if (nextToolIdx < 3) { // Limit General Shop to basic tools
            const tool = TOOLS[nextToolIdx];
            items.push({ type: 'TOOL', name: tool.name, desc: `Power: ${tool.power}`, cost: tool.cost, currency: 'Honey', data: tool });
        }

        // General Backpacks
        const nextPackIdx = state.currentBackpackIndex + 1;
        if (nextPackIdx < BACKPACKS.length) {
            const pack = BACKPACKS[nextPackIdx];
            items.push({ type: 'BACKPACK', name: pack.name, desc: `Capacity: ${pack.capacity}`, cost: pack.cost, currency: 'Honey', data: pack });
        }
    }
    else if (type === 'RED') {
        // Dark Scythe
        const tool = TOOLS.find(t => t.name === "Dark Scythe");
        if (state.currentToolIndex < TOOLS.indexOf(tool)) {
             items.push({ type: 'TOOL', name: tool.name, desc: `Massive Red Pollen!`, cost: tool.cost, currency: 'Honey', data: tool });
        }
    }
    else if (type === 'BLUE') {
        // Tide Popper
        const tool = TOOLS.find(t => t.name === "Tide Popper");
        if (state.currentToolIndex < TOOLS.indexOf(tool)) {
             items.push({ type: 'TOOL', name: tool.name, desc: `Massive Blue Pollen!`, cost: tool.cost, currency: 'Honey', data: tool });
        }
    }
    else if (type === 'WHITE') {
        // Gummy Baller
        const tool = TOOLS.find(t => t.name === "Gummy Baller");
        if (state.currentToolIndex < TOOLS.indexOf(tool)) {
             items.push({ type: 'TOOL', name: tool.name, desc: `Massive White Pollen!`, cost: tool.cost, currency: 'Honey', data: tool });
        }
    }
    else if (type === 'TICKET') {
        items.push({ type: 'BEE_UNLOCK', name: 'Photon Bee', desc: 'Infinite Energy!', cost: 500, currency: 'Tickets', rarity: 'Mythic', beeType: 'Photon' });
        items.push({ type: 'BEE_UNLOCK', name: 'Tabby Bee', desc: 'Scratches Crit!', cost: 500, currency: 'Tickets', rarity: 'Mythic', beeType: 'Tabby' });
        items.push({ type: 'ITEM', name: 'Star Treat', desc: 'Makes a bee Gifted!', cost: 1000, currency: 'Tickets' });
    }

    if (items.length === 0) {
        items.push({ name: "Sold Out / Empty", desc: "Check back later", cost: Infinity, currency: "" });
    }

    return items;
}

function getShopItem(index) {
    const items = getShopItemsForType(state.activeShopType);
    // Clamp index
    if (index < 0) index = items.length - 1;
    if (index >= items.length) index = 0;
    state.shopSelectionIndex = index;
    return items[index];
}

function renderShop() {
    const item = getShopItem(state.shopSelectionIndex);
    shopName.innerText = item.name;
    shopDesc.innerText = item.desc;
    shopCost.innerText = (item.cost === Infinity) ? "Sold Out" : `Cost: ${item.cost} ${item.currency}`;

    let afford = false;
    if (item.currency === 'Honey') afford = state.honey >= item.cost;
    if (item.currency === 'Tickets') afford = state.tickets >= item.cost;

    if (item.cost === Infinity || !afford) {
        btnShopBuy.disabled = true;
    } else {
        btnShopBuy.disabled = false;
    }
}

function openShop(type) {
    if (state.isShopOpen) return;
    state.activeShopType = type;
    state.shopSelectionIndex = 0;
    state.isShopOpen = true;
    shopModal.classList.remove('hidden');
    renderShop();
}

function closeShop() {
    state.isShopOpen = false;
    shopModal.classList.add('hidden');
}

// Shop Event Listeners
btnShopClose.addEventListener('click', closeShop);
btnHiveClose.addEventListener('click', () => {
    state.isHiveOpen = false;
    hiveModal.classList.add('hidden');
});

btnShopPrev.addEventListener('click', () => {
    state.shopSelectionIndex = (state.shopSelectionIndex - 1 + 3) % 3;
    renderShop();
});
btnShopNext.addEventListener('click', () => {
    state.shopSelectionIndex = (state.shopSelectionIndex + 1) % 3;
    renderShop();
});

btnShopBuy.addEventListener('click', () => {
    const item = getShopItem(state.shopSelectionIndex);

    let afford = false;
    if (item.currency === 'Honey') afford = state.honey >= item.cost;
    if (item.currency === 'Tickets') afford = state.tickets >= item.cost;

    if (item.cost !== Infinity && afford) {
        if (item.currency === 'Honey') state.honey -= item.cost;
        if (item.currency === 'Tickets') state.tickets -= item.cost;

        if (item.type === 'EGG') {
            state.inventory.eggs++;
            eggCost = Math.floor(eggCost * 1.5);
            showNotification("Purchased Basic Egg (+1 Egg Required)");
        } else if (item.type === 'TOOL') {
            // Find global index of this tool
            const idx = TOOLS.findIndex(t => t.name === item.data.name);
            if (idx !== -1) state.currentToolIndex = idx;

            state.tool.mesh.material.color.multiplyScalar(0.8);
            showNotification(`Equipped ${item.name}!`);
        } else if (item.type === 'BACKPACK') {
            state.currentBackpackIndex++;
            state.backpackCapacity = item.data.capacity;
            showNotification(`Upgraded to ${item.name}!`);
        } else if (item.type === 'BEE_UNLOCK') {
             // Give a special egg or direct hatch? Let's give a special egg.
             // Simplified: Just add a bee directly to next slot for now or give "Star Egg"
             state.inventory.eggs++;
             // In a real full implementation we'd track "Special Eggs", but user asked for "Ticket Shop"
             showNotification(`Unlocked ${item.name} (Check Inventory)`);
        }

        updateUI();
        renderShop();
    }
});

function showNotification(text) {
    // Create or reuse notification element
    let note = document.getElementById('notification');
    if (!note) {
        note = document.createElement('div');
        note.id = 'notification';
        document.body.appendChild(note);
        // Styling will be done via JS or CSS, let's add basic inline
        note.style.position = 'absolute';
        note.style.top = '20%';
        note.style.left = '50%';
        note.style.transform = 'translate(-50%, -50%)';
        note.style.backgroundColor = 'rgba(0,0,0,0.7)';
        note.style.color = 'white';
        note.style.padding = '10px 20px';
        note.style.borderRadius = '5px';
        note.style.pointerEvents = 'none';
        note.style.transition = 'opacity 0.5s';
    }
    note.innerText = text;
    note.style.opacity = '1';
    setTimeout(() => { note.style.opacity = '0'; }, 3000);
}

// --- Setup Scene ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(SCENE_COLOR);
scene.fog = new THREE.Fog(SCENE_COLOR, 10, 50);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// --- Lights ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(10, 20, 10);
dirLight.castShadow = true;
dirLight.shadow.camera.top = 20;
dirLight.shadow.camera.bottom = -20;
dirLight.shadow.camera.left = -20;
dirLight.shadow.camera.right = 20;
scene.add(dirLight);

// --- Ground ---
const groundGeometry = new THREE.PlaneGeometry(200, 200); // Expanded map
const groundMaterial = new THREE.MeshStandardMaterial({ color: GROUND_COLOR });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// --- Hive ---
const hiveGeometry = new THREE.BoxGeometry(8, 8, 8);
const hiveMaterial = new THREE.MeshStandardMaterial({ color: HIVE_COLOR });
state.hive = new THREE.Mesh(hiveGeometry, hiveMaterial);
state.hive.position.set(0, 4, -15); // Move Closer (was -25)
state.hive.castShadow = true;
scene.add(state.hive);

// --- Shops ---
function createShop(x, z, color, type) {
    const geo = new THREE.BoxGeometry(6, 5, 6);
    const mat = new THREE.MeshStandardMaterial({ color: color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 2.5, z);
    mesh.castShadow = true;
    scene.add(mesh);

    state.shops.push({ mesh: mesh, type: type });
}

// General Shop (Brown, Right)
createShop(30, -10, 0x8B4513, 'GENERAL');

// Red Shop (Red, Left/Red Field)
createShop(-35, 10, 0xFF0000, 'RED');

// Blue Shop (Blue, Right/Blue Field)
createShop(35, 10, 0x0000FF, 'BLUE');

// White Shop (White, Center/White Field)
createShop(0, 30, 0xFFFFFF, 'WHITE');

// Ticket Shop (Yellow/Striped, Far Left)
createShop(-30, -10, 0xFFA500, 'TICKET');

// --- Tokens ---
function spawnToken(position, type) {
    const geometry = new THREE.DodecahedronGeometry(0.5); // Token shape
    let color = 0xFFFF00;
    if (type === 'HONEY') color = 0xFFA500;
    if (type === 'SPEED') color = 0x00FF00;
    if (type === 'TICKET') color = 0xFFD700; // Gold/Yellow for Ticket (or maybe a different shape later)

    const material = new THREE.MeshStandardMaterial({ color: color, emissive: 0x222222 });
    const tokenMesh = new THREE.Mesh(geometry, material);
    tokenMesh.position.copy(position);
    tokenMesh.position.y = 1; // Float
    scene.add(tokenMesh);

    state.tokens.push({
        mesh: tokenMesh,
        type: type,
        life: 10.0 // Seconds
    });
}

function updateTokens(dt) {
    for (let i = state.tokens.length - 1; i >= 0; i--) {
        const token = state.tokens[i];
        token.life -= dt;

        // Rotation animation
        token.mesh.rotation.y += 2 * dt;

        // Check collision with player
        if (state.player && state.player.position.distanceTo(token.mesh.position) < 2) {
            // Collect
            if (token.type === 'HONEY') {
                state.honey += 50;
                updateUI();
            } else if (token.type === 'SPEED') {
                state.honey += 100; // Temp bonus
                updateUI();
            } else if (token.type === 'TICKET') {
                state.tickets += 1;
                showNotification("Found 1 Ticket!");
                // No direct UI for tickets yet, maybe add to stats?
            }

            scene.remove(token.mesh);
            state.tokens.splice(i, 1);
            continue;
        }

        // Expiration
        if (token.life <= 0) {
            scene.remove(token.mesh);
            state.tokens.splice(i, 1);
        }
    }
}

// --- Bees ---
class Bee {
    constructor(id, data) {
        this.id = id;
        this.data = data || { type: 'Basic', rarity: 'Common' };
        this.state = 'IDLE'; // IDLE, GATHERING, RETURNING
        this.target = null;
        this.abilityTimer = 0;
        this.abilityCooldown = 15 + Math.random() * 10;

        this.positionOffset = new THREE.Vector3(
            (Math.random() - 0.5) * 5, // Increased range
            (Math.random() * 2) + 1.5,
            (Math.random() - 0.5) * 5
        );

        // Visuals
        const geometry = new THREE.SphereGeometry(0.3, 8, 8);
        let color = 0xFFFF00; // Default Yellow
        if (this.data.rarity === 'Rare') color = 0xC0C0C0; // Silver
        if (this.data.rarity === 'Epic') color = 0xFFA500; // Orange
        if (this.data.rarity === 'Legendary') color = 0x00FFFF; // Cyan
        if (this.data.rarity === 'Mythic') color = 0x9370DB; // Purple

        const material = new THREE.MeshStandardMaterial({ color: color });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;

        // Add Face based on Type
        this.addFaceFeatures(color);

        scene.add(this.mesh);

        // Initial position
        this.mesh.position.copy(state.player.position).add(this.positionOffset);
    }

    addFaceFeatures(baseColor) {
        const type = this.data.type;

        // Eyes
        const eyeColor = (type === 'Photon' || type === 'Buoyant') ? 0xFFFFFF : 0x000000;
        if (type === 'Buoyant') eyeColor = 0x0000FF;

        const eyeGeo = new THREE.SphereGeometry(0.05, 4, 4);
        const eyeMat = new THREE.MeshBasicMaterial({ color: eyeColor });

        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.1, 0.1, 0.25);
        this.mesh.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.1, 0.1, 0.25);
        this.mesh.add(rightEye);

        // Specific Features
        if (type === 'Tabby') {
            // Ears
            const earGeo = new THREE.ConeGeometry(0.08, 0.15, 4);
            const earMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 }); // Dark Brown

            const leftEar = new THREE.Mesh(earGeo, earMat);
            leftEar.position.set(-0.15, 0.25, 0);
            leftEar.rotation.z = 0.5;
            this.mesh.add(leftEar);

            const rightEar = new THREE.Mesh(earGeo, earMat);
            rightEar.position.set(0.15, 0.25, 0);
            rightEar.rotation.z = -0.5;
            this.mesh.add(rightEar);
        }
        else if (type === 'Lion') {
            // Mane
            const maneGeo = new THREE.TorusGeometry(0.3, 0.05, 4, 8);
            const maneMat = new THREE.MeshStandardMaterial({ color: 0xFF8C00 }); // Dark Orange
            const mane = new THREE.Mesh(maneGeo, maneMat);
            mane.rotation.x = Math.PI / 2; // Flat
            // mane.position.y = 0;
            this.mesh.add(mane);
        }
    }

    update(dt) {
        // Ability Logic
        this.abilityTimer += dt;
        if (this.abilityTimer > this.abilityCooldown) {
            this.abilityTimer = 0;
            // Spawn Token
            const rand = Math.random();
            if (rand < 0.4) { // Increased to 40% chance for Ticket for testing
                spawnToken(this.mesh.position, 'TICKET');
            } else {
                spawnToken(this.mesh.position, 'HONEY');
            }
        }

        if (this.state === 'IDLE') {
            // Follow player with offset
            const targetPos = state.player.position.clone().add(this.positionOffset);
            // Simple lerp for following
            this.mesh.position.lerp(targetPos, 2 * dt);

            // Randomly decide to gather
            if (Math.random() < 0.01) {
                this.findFlower();
            }
        } else if (this.state === 'GATHERING') {
            if (this.target) {
                // Move towards flower
                const speed = 5;
                const dir = this.target.mesh.position.clone().sub(this.mesh.position).normalize();
                this.mesh.position.add(dir.multiplyScalar(speed * dt));

                if (this.mesh.position.distanceTo(this.target.mesh.position) < 0.5) {
                    // Gathered!
                    collectPollen(1); // Add to player backpack
                    this.state = 'RETURNING';
                }
            } else {
                this.state = 'IDLE';
            }
        } else if (this.state === 'RETURNING') {
            // Move towards player offset
            const targetPos = state.player.position.clone().add(this.positionOffset);
            const speed = 5;
            const dir = targetPos.clone().sub(this.mesh.position).normalize();
            this.mesh.position.add(dir.multiplyScalar(speed * dt));

            if (this.mesh.position.distanceTo(targetPos) < 0.5) {
                this.state = 'IDLE';
            }
        }
    }

    findFlower() {
        // Find random nearby flower
        // For efficiency, just pick a random one from the list, if close enough
        if (state.flowers.length > 0) {
             const randomFlower = state.flowers[Math.floor(Math.random() * state.flowers.length)];
             if (randomFlower.mesh.position.distanceTo(state.player.position) < 15) {
                 this.target = randomFlower;
                 this.state = 'GATHERING';
             }
        }
    }
}

// --- Flowers ---
function createFlower(x, z, color) {
    let geometry;
    if (color === RED_FIELD_COLOR) {
        // Roses (Red Cylinders)
        geometry = new THREE.CylinderGeometry(0.6, 0.4, 0.5, 6);
    } else if (color === BLUE_FIELD_COLOR) {
        // Pine Trees (Blue Cones)
        geometry = new THREE.ConeGeometry(0.6, 1.5, 6);
    } else {
        // White Flowers (Flat Cylinders)
        geometry = new THREE.CylinderGeometry(0.5, 0.5, 0.2, 8);
    }

    const material = new THREE.MeshStandardMaterial({ color: color });
    const flower = new THREE.Mesh(geometry, material);
    flower.position.set(x, 0.1, z);
    if (color === BLUE_FIELD_COLOR) flower.position.y = 0.75; // Adjust height for cone

    flower.castShadow = true;
    scene.add(flower);

    state.flowers.push({
        mesh: flower,
        color: color,
        id: Math.random().toString(36).substr(2, 9)
    });
}

// Generate Fields
// White Field (Center)
for (let i = 0; i < 40; i++) {
    const x = (Math.random() - 0.5) * 30;
    const z = (Math.random() * 20) + 10;
    createFlower(x, z, WHITE_FIELD_COLOR);
}

// Red Field (Left)
for (let i = 0; i < 30; i++) {
    const x = (Math.random() * 20) - 40; // -40 to -20
    const z = (Math.random() * 20) + 10;
    createFlower(x, z, RED_FIELD_COLOR);
}

// Blue Field (Right)
for (let i = 0; i < 30; i++) {
    const x = (Math.random() * 20) + 20; // 20 to 40
    const z = (Math.random() * 20) + 10;
    createFlower(x, z, BLUE_FIELD_COLOR);
}

// --- Player ---
// Simple Box for now representing the player
const playerGeometry = new THREE.BoxGeometry(1, 2, 1);
const playerMaterial = new THREE.MeshStandardMaterial({ color: PLAYER_COLOR });
state.player = new THREE.Mesh(playerGeometry, playerMaterial);
state.player.position.y = 1; // Half height so it sits on ground
state.player.castShadow = true;
scene.add(state.player);

// --- Backpack ---
let currentBackpackMesh = null;
function equipBackpack(packData) {
    if (currentBackpackMesh) {
        state.player.remove(currentBackpackMesh);
    }

    let geo, mat;
    const name = packData.name;

    if (name.includes("Pouch")) {
        geo = new THREE.BoxGeometry(0.6, 0.6, 0.3);
        mat = new THREE.MeshStandardMaterial({ color: 0x8B4513 }); // Brown
    } else if (name.includes("Satchel")) {
        geo = new THREE.BoxGeometry(0.8, 0.8, 0.4);
        mat = new THREE.MeshStandardMaterial({ color: 0xA52A2A }); // Reddish Brown
    } else if (name.includes("Canister") && !name.includes("Coconut")) {
        geo = new THREE.CylinderGeometry(0.4, 0.4, 1);
        mat = new THREE.MeshStandardMaterial({ color: 0xC0C0C0 }); // Silver
    } else if (name.includes("Porcelain")) {
        geo = new THREE.CylinderGeometry(0.5, 0.5, 1.2);
        mat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF }); // White
    } else if (name.includes("Coconut")) {
        geo = new THREE.SphereGeometry(0.6);
        mat = new THREE.MeshStandardMaterial({ color: 0x8B4513 }); // Coconut
        // Texture details could be added
    } else if (name.includes("Petal")) {
        geo = new THREE.TorusGeometry(0.5, 0.2, 8, 16);
        mat = new THREE.MeshStandardMaterial({ color: 0xFFC0CB }); // Pink
    }

    if (geo && mat) {
        currentBackpackMesh = new THREE.Mesh(geo, mat);
        currentBackpackMesh.position.set(0, 0.2, 0.6); // On back
        state.player.add(currentBackpackMesh);
    }
}
equipBackpack(BACKPACKS[0]);

// --- Tool ---
function equipTool(toolData) {
    if (state.tool.mesh) {
        state.player.remove(state.tool.mesh);
    }

    const handleGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.5);
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
    const mesh = new THREE.Mesh(handleGeo, handleMat);
    mesh.rotation.x = Math.PI / 2; // Forward
    mesh.position.set(0.5, 0.5, 0.5);

    // Head
    if (toolData.name === "Rake") {
        const headGeo = new THREE.BoxGeometry(0.8, 0.1, 0.1);
        const head = new THREE.Mesh(headGeo, new THREE.MeshStandardMaterial({ color: 0x555555 }));
        head.position.y = 0.75; // End of stick
        mesh.add(head);
        // Teeth
        for(let i=-3; i<=3; i+=2) {
            const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.05), new THREE.MeshStandardMaterial({ color: 0x555555 }));
            tooth.position.set(i*0.1, -0.1, 0);
            head.add(tooth);
        }
    }
    else if (toolData.name === "Vacuum") {
        const vacGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.4);
        const vac = new THREE.Mesh(vacGeo, new THREE.MeshStandardMaterial({ color: 0xCCCCCC }));
        vac.rotation.z = Math.PI / 2;
        vac.position.y = 0.75;
        mesh.add(vac);
    }
    else if (toolData.name === "Dark Scythe") {
        const bladeGeo = new THREE.TorusGeometry(0.4, 0.05, 4, 10, Math.PI);
        const bladeMat = new THREE.MeshStandardMaterial({ color: 0xFF0000, emissive: 0x330000 }); // Red/Black
        const blade = new THREE.Mesh(bladeGeo, bladeMat);
        blade.position.y = 0.75;
        blade.position.x = 0.2;
        blade.rotation.z = Math.PI / 4;
        mesh.add(blade);
        // Flames (Simple Particles logic later, for now just a visual block)
        const flame = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.5), new THREE.MeshStandardMaterial({ color: 0x000000 }));
        flame.position.y = 0.8;
        mesh.add(flame);
    }
    else if (toolData.name === "Tide Popper") {
        const headGeo = new THREE.IcosahedronGeometry(0.3);
        const headMat = new THREE.MeshStandardMaterial({ color: 0x0000FF, transparent: true, opacity: 0.8 });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 0.75;
        mesh.add(head);
    }
    else if (toolData.name === "Gummy Baller") {
        const headGeo = new THREE.SphereGeometry(0.3);
        const headMat = new THREE.MeshStandardMaterial({ color: 0x00FF00 }); // Green
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 0.75;
        mesh.add(head);
        // Pink spots
        const spot = new THREE.Mesh(new THREE.SphereGeometry(0.1), new THREE.MeshStandardMaterial({ color: 0xFF69B4 }));
        spot.position.set(0.1, 0.2, 0.1);
        head.add(spot);
    }
    // Stick is just handle (default)

    state.tool.mesh = mesh;
    state.player.add(state.tool.mesh);
}

// Initial Equip
equipTool(TOOLS[0]);

// --- Inputs ---
window.addEventListener('mousedown', () => {
    if (!state.tool.isSwinging) {
        state.tool.isSwinging = true;
        swingTool();
    }
});

window.addEventListener('keydown', (e) => {
    state.keys[e.code] = true;
});
window.addEventListener('keyup', (e) => {
    state.keys[e.code] = false;
});
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Game Loop ---
const clock = new THREE.Clock();

function updatePlayer(dt) {
    if (!state.player) return;

    // Disable movement if UI is open
    if (state.isShopOpen || state.isHiveOpen) return;

    const speed = PLAYER_SPEED * dt;
    const move = new THREE.Vector3(0, 0, 0);

    if (state.keys['KeyW'] || state.keys['ArrowUp']) move.z -= 1;
    if (state.keys['KeyS'] || state.keys['ArrowDown']) move.z += 1;
    if (state.keys['KeyA'] || state.keys['ArrowLeft']) move.x -= 1;
    if (state.keys['KeyD'] || state.keys['ArrowRight']) move.x += 1;

    if (move.length() > 0) {
        move.normalize().multiplyScalar(speed);
        state.player.position.add(move);

        // Simple rotation to face movement direction
        const angle = Math.atan2(move.x, move.z); // Note: z is forward/backward
        // We might want to smooth this later, but instant turn is fine for MVP
        // state.player.rotation.y = angle; // Only if we want the player mesh to rotate
    }

    // Boundary check (keep on ground plane)
    state.player.position.x = Math.max(-99, Math.min(99, state.player.position.x));
    state.player.position.z = Math.max(-99, Math.min(99, state.player.position.z));

    // Check Hive Interaction
    checkHiveInteraction();

    // Check Shop Interaction (Placeholder for now)
    checkShopInteraction();
}

function checkHiveInteraction() {
    if (!state.hive) return;
    const dist = state.player.position.distanceTo(state.hive.position);

    if (dist < 8) {
        // Conversion is automatic when close
        convertPollen();

        // Hive Opening is Manual via 'E'
        if (!state.inHiveZone) {
            state.inHiveZone = true;
            showNotification("Press E to Hatch Bees");
        }

        if (state.keys['KeyE']) {
            openHive();
        }
    } else {
        if (state.inHiveZone) {
            state.inHiveZone = false;
            closeHive(); // Close if walked away
        }
    }
}

function openHive() {
    if (state.isHiveOpen) return;
    state.isHiveOpen = true;
    hiveModal.classList.remove('hidden');
    renderHive();
}

function closeHive() {
    state.isHiveOpen = false;
    hiveModal.classList.add('hidden');
}

function renderHive() {
    hiveGrid.innerHTML = ''; // Clear
    state.hiveSlots.forEach((slotData, index) => {
        const div = document.createElement('div');
        div.className = 'hive-slot';
        if (slotData) {
            div.classList.add('filled');

            // Color code the slot based on rarity
            let color = '#ffd700'; // Default/Common
            if (slotData.rarity === 'Rare') color = '#C0C0C0';
            if (slotData.rarity === 'Epic') color = '#FFA500';
            if (slotData.rarity === 'Legendary') color = '#00FFFF';
            if (slotData.rarity === 'Mythic') color = '#9370DB';

            div.style.backgroundColor = color;
            div.style.borderColor = '#fff';

            // Add Face to Grid
            const face = document.createElement('div');
            face.className = 'hive-face';
            face.innerHTML = `
                <div class="eye-left" style="background:${slotData.type === 'Photon' ? '#fff' : 'black'}"></div>
                <div class="eye-right" style="background:${slotData.type === 'Photon' ? '#fff' : 'black'}"></div>
                <div class="mouth"></div>
            `;
            div.appendChild(face);

            div.title = `${slotData.rarity} ${slotData.type} Bee`;
        } else {
            div.innerText = '+';
            div.onclick = () => tryHatchEgg(index);
        }
        hiveGrid.appendChild(div);
    });
}

function tryHatchEgg(index) {
    if (state.inventory.eggs > 0) {
        showConfirm("Hatch Egg", `Hatch an egg in slot ${index + 1}?`, () => {
            state.inventory.eggs--;

            // Random Rarity Logic
            const rand = Math.random();
            let rarity = 'Common';
            let type = 'Basic';

            // Allow getting Ticket Shop bees rarely from eggs too? Maybe not, keep distinct.
            if (rand < 0.05) { rarity = 'Mythic'; type = 'Buoyant'; }
            else if (rand < 0.15) { rarity = 'Legendary'; type = 'Lion'; }
            else if (rand < 0.35) { rarity = 'Epic'; type = 'Honey'; }
            else if (rand < 0.60) { rarity = 'Rare'; type = 'Rad'; }

            const newBeeData = { type: type, rarity: rarity };
            state.hiveSlots[index] = newBeeData;

            // Spawn 3D Bee
            const bee = new Bee(state.bees.length, newBeeData);
            state.bees.push(bee);

            renderHive();
            showNotification(`Hatched ${rarity} ${type} Bee!`);
        });
    } else {
        showNotification("You don't have any eggs!");
    }
}

function checkShopInteraction() {
    let nearAnyShop = false;

    state.shops.forEach(shop => {
        const dist = state.player.position.distanceTo(shop.mesh.position);
        if (dist < 6) {
            nearAnyShop = true;
            if (!state.inShopZone) {
                state.inShopZone = true;
                showNotification(`Press E to open ${shop.type} Shop`);
            }

            if (state.keys['KeyE']) {
                openShop(shop.type);
            }
        }
    });

    if (!nearAnyShop && state.inShopZone) {
        state.inShopZone = false;
        closeShop();
    }
}

function convertPollen() {
    if (state.pollen > 0) {
        const amount = state.pollen;
        state.pollen = 0;
        state.honey += amount;
        updateUI();

        // Visual Feedback
        uiConversion.innerText = `Converting... +${amount} Honey`;
        uiConversion.style.opacity = 1;
        setTimeout(() => {
            uiConversion.style.opacity = 0;
        }, 2000);
    }
}

function updateCamera() {
    if (!state.player) return;

    // Camera offset relative to player
    const offset = new THREE.Vector3(0, 10, 15);
    const targetPosition = state.player.position.clone().add(offset);

    // Smooth follow
    camera.position.lerp(targetPosition, 0.1);
    camera.lookAt(state.player.position);
}

function swingTool() {
    const playerPos = state.player.position;
    const currentTool = TOOLS[state.currentToolIndex];
    let power = currentTool.power;

    // Check if player is in a field
    let inField = null;
    for (const field of FIELDS) {
        const halfW = field.w / 2;
        const halfH = field.h / 2;
        if (playerPos.x >= field.x - halfW && playerPos.x <= field.x + halfW &&
            playerPos.z >= field.z - halfH && playerPos.z <= field.z + halfH) {
            inField = field;
            break;
        }
    }

    if (inField) {
        // Apply Multiplier
        let multiplier = 1;
        if (currentTool.type === 'RED' && inField.type === 'RED') multiplier = 3;
        if (currentTool.type === 'BLUE' && inField.type === 'BLUE') multiplier = 3;
        if (currentTool.type === 'WHITE' && inField.type === 'WHITE') multiplier = 3;

        collectPollen(power * multiplier);
    }
}

function collectPollen(amount) {
    if (state.pollen < state.backpackCapacity) {
        state.pollen = Math.min(state.pollen + amount, state.backpackCapacity);
        updateUI();

        // Visual feedback?
    }
}

function updateUI() {
    uiPollen.innerText = Math.floor(state.pollen);
    uiCapacity.innerText = state.backpackCapacity;
    uiHoney.innerText = Math.floor(state.honey);
    uiTickets.innerText = state.tickets;
}

function updateTool(dt) {
    if (state.tool.isSwinging) {
        const speed = 10;
        state.tool.swingAngle += state.tool.swingDirection * speed * dt;

        if (state.tool.swingAngle > 1) {
            state.tool.swingDirection = -1;
        } else if (state.tool.swingAngle < 0) {
            state.tool.swingDirection = 1;
            state.tool.isSwinging = false;
            state.tool.swingAngle = 0;
        }

        state.tool.mesh.rotation.x = state.tool.swingAngle;
    }
}

function updateBees(dt) {
    state.bees.forEach(bee => bee.update(dt));
}

function animate() {
    requestAnimationFrame(animate);

    const dt = clock.getDelta();

    updatePlayer(dt);
    updateCamera();
    updateTool(dt);
    updateBees(dt);
    updateTokens(dt);

    renderer.render(scene, camera);
}

animate();

// Expose for debugging/testing
// window.openShop = openShop;
// window.closeShop = closeShop;
// window.state = state;

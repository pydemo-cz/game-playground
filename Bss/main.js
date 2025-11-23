import * as THREE from 'three';

// --- Configuration ---
const SCENE_COLOR = 0x87CEEB;
const GROUND_COLOR = 0x228B22;
const PLAYER_COLOR = 0x0000FF;
const PLAYER_SPEED = 10;
const HIVE_COLOR = 0xFFD700;
const SHOP_COLOR = 0x8B4513;
const RED_FIELD_COLOR = 0xFF0000;
const BLUE_FIELD_COLOR = 0x0000FF;
const WHITE_FIELD_COLOR = 0xFFFFFF;

// Field Zones
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
    { name: "Coconut Canister", cost: 25000, capacity: 20000 }
];

const ACCESSORIES = [
    // Masks
    { name: "Diamond Mask", type: "MASK", cost: 5000, currency: "Honey", stats: { blueMult: 3, capacity: 1.5 }, color: 0x0000FF },
    { name: "Demon Mask", type: "MASK", cost: 5000, currency: "Honey", stats: { redMult: 3, capacity: 1.5 }, color: 0xFF0000 },
    { name: "Gummy Mask", type: "MASK", cost: 5000, currency: "Honey", stats: { whiteMult: 3, capacity: 1.5 }, color: 0xFFFFFF },

    // Belts
    { name: "Basic Belt", type: "BELT", cost: 500, currency: "Honey", stats: { pollenMult: 1.2 } },
    { name: "Petal Belt", type: "BELT", cost: 100000, currency: "Honey", stats: { pollenMult: 2.0, capacity: 50000 } },
    { name: "Coconut Belt", type: "BELT", cost: 500000, currency: "Honey", stats: { pollenMult: 2.5, capacity: 100000 } },

    // Guards
    { name: "Bucko Guard", type: "GUARD", cost: 2500, currency: "Honey", stats: { blueMult: 1.5, capacity: 1.1 }, color: 0x0000AA },
    { name: "Riley Guard", type: "GUARD", cost: 2500, currency: "Honey", stats: { redMult: 1.5, capacity: 1.1 }, color: 0xAA0000 },

    // Boots
    { name: "Basic Boots", type: "BOOTS", cost: 500, currency: "Honey", stats: { moveSpeed: 1.2 } },
    { name: "Coconut Clogs", type: "BOOTS", cost: 150000, currency: "Honey", stats: { moveSpeed: 1.5, pollenMult: 1.2, capacity: 10000 }, color: 0x8B4513 }
];

// --- State ---
const state = {
    keys: {},
    player: null,
    hive: null,
    shop: null,
    flowers: [],
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
    equipment: {
        MASK: null,
        BELT: null,
        GUARD: null,
        BOOTS: null
    },
    equipmentMeshes: [],
    bees: [],
    hiveSlots: new Array(25).fill(null),
    inventory: {
        eggs: 0
    },
    tickets: 0,
    isShopOpen: false,
    isHiveOpen: false,
    isInventoryOpen: false,
    inShopZone: false,
    inHiveZone: false,
    activeShopType: 'GENERAL',
    shopSelectionIndex: 0,
    tokens: [],
    shops: []
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
const inventoryModal = document.getElementById('inventory-modal');
const hiveGrid = document.getElementById('hive-grid');

// Shop UI
const shopName = document.getElementById('shop-item-name');
const shopDesc = document.getElementById('shop-item-desc');
const shopCost = document.getElementById('shop-item-cost');
const btnShopPrev = document.getElementById('shop-prev');
const btnShopNext = document.getElementById('shop-next');
const btnShopBuy = document.getElementById('shop-buy-btn');
const btnShopClose = document.getElementById('shop-close-btn');

// Hive UI
const btnHiveClose = document.getElementById('hive-close-btn');

// Inventory UI
const btnInventory = document.getElementById('inventory-btn');
const btnInventoryClose = document.getElementById('inventory-close-btn');
const uiInventoryStats = document.getElementById('inventory-stats');
const uiInventoryEquip = document.getElementById('inventory-equip');

// Confirm Modal
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
        items.push({ type: 'EGG', name: 'Basic Egg', desc: 'Hatches a random bee.', cost: eggCost, currency: 'Honey' });

        const nextToolIdx = state.currentToolIndex + 1;
        if (nextToolIdx < 3) {
            const tool = TOOLS[nextToolIdx];
            items.push({ type: 'TOOL', name: tool.name, desc: `Power: ${tool.power}`, cost: tool.cost, currency: 'Honey', data: tool });
        }

        const nextPackIdx = state.currentBackpackIndex + 1;
        if (nextPackIdx < BACKPACKS.length) {
            const pack = BACKPACKS[nextPackIdx];
            items.push({ type: 'BACKPACK', name: pack.name, desc: `Capacity: ${pack.capacity}`, cost: pack.cost, currency: 'Honey', data: pack });
        }

        // General Accessories
        if (!state.equipment.BELT) items.push({ type: 'ACCESSORY', name: 'Basic Belt', desc: 'Pollen Boost', cost: 500, currency: 'Honey', data: ACCESSORIES.find(a => a.name === 'Basic Belt') });
        if (!state.equipment.BOOTS) items.push({ type: 'ACCESSORY', name: 'Basic Boots', desc: 'Move Speed', cost: 500, currency: 'Honey', data: ACCESSORIES.find(a => a.name === 'Basic Boots') });
    }
    else if (type === 'RED') {
        const tool = TOOLS.find(t => t.name === "Dark Scythe");
        if (state.currentToolIndex < TOOLS.indexOf(tool)) {
             items.push({ type: 'TOOL', name: tool.name, desc: `Massive Red Pollen!`, cost: tool.cost, currency: 'Honey', data: tool });
        }
        if (!state.equipment.MASK) items.push({ type: 'ACCESSORY', name: 'Demon Mask', desc: 'Red Boost', cost: 5000, currency: 'Honey', data: ACCESSORIES.find(a => a.name === 'Demon Mask') });
        if (!state.equipment.GUARD) items.push({ type: 'ACCESSORY', name: 'Riley Guard', desc: 'Red Guard', cost: 2500, currency: 'Honey', data: ACCESSORIES.find(a => a.name === 'Riley Guard') });
    }
    else if (type === 'BLUE') {
        const tool = TOOLS.find(t => t.name === "Tide Popper");
        if (state.currentToolIndex < TOOLS.indexOf(tool)) {
             items.push({ type: 'TOOL', name: tool.name, desc: `Massive Blue Pollen!`, cost: tool.cost, currency: 'Honey', data: tool });
        }
        if (!state.equipment.MASK) items.push({ type: 'ACCESSORY', name: 'Diamond Mask', desc: 'Blue Boost', cost: 5000, currency: 'Honey', data: ACCESSORIES.find(a => a.name === 'Diamond Mask') });
        if (!state.equipment.GUARD) items.push({ type: 'ACCESSORY', name: 'Bucko Guard', desc: 'Blue Guard', cost: 2500, currency: 'Honey', data: ACCESSORIES.find(a => a.name === 'Bucko Guard') });
    }
    else if (type === 'WHITE') {
        const tool = TOOLS.find(t => t.name === "Gummy Baller");
        if (state.currentToolIndex < TOOLS.indexOf(tool)) {
             items.push({ type: 'TOOL', name: tool.name, desc: `Massive White Pollen!`, cost: tool.cost, currency: 'Honey', data: tool });
        }
        if (!state.equipment.MASK) items.push({ type: 'ACCESSORY', name: 'Gummy Mask', desc: 'White Boost', cost: 5000, currency: 'Honey', data: ACCESSORIES.find(a => a.name === 'Gummy Mask') });
        if (!state.equipment.BELT) items.push({ type: 'ACCESSORY', name: 'Petal Belt', desc: 'Petal Power', cost: 100000, currency: 'Honey', data: ACCESSORIES.find(a => a.name === 'Petal Belt') });
        if (!state.equipment.BELT || (state.equipment.BELT && state.equipment.BELT.name !== 'Coconut Belt')) items.push({ type: 'ACCESSORY', name: 'Coconut Belt', desc: 'Coco Power', cost: 500000, currency: 'Honey', data: ACCESSORIES.find(a => a.name === 'Coconut Belt') });
        if (!state.equipment.BOOTS || (state.equipment.BOOTS && state.equipment.BOOTS.name !== 'Coconut Clogs')) items.push({ type: 'ACCESSORY', name: 'Coconut Clogs', desc: 'Fast & Cap', cost: 150000, currency: 'Honey', data: ACCESSORIES.find(a => a.name === 'Coconut Clogs') });
    }
    else if (type === 'TICKET') {
        items.push({ type: 'BEE_UNLOCK', name: 'Photon Bee', desc: 'Infinite Energy!', cost: 100, currency: 'Tickets', rarity: 'Mythic', beeType: 'Photon' });
        items.push({ type: 'BEE_UNLOCK', name: 'Tabby Bee', desc: 'Scratches Crit!', cost: 100, currency: 'Tickets', rarity: 'Mythic', beeType: 'Tabby' });
        items.push({ type: 'ITEM', name: 'Star Treat', desc: 'Makes a bee Gifted!', cost: 150, currency: 'Tickets' });
    }

    if (items.length === 0) items.push({ name: "Sold Out / Empty", desc: "Check back later", cost: Infinity, currency: "" });
    return items;
}

function getShopItem(index) {
    const items = getShopItemsForType(state.activeShopType);
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

    btnShopBuy.disabled = (item.cost === Infinity || !afford);
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

btnShopClose.addEventListener('click', closeShop);
btnHiveClose.addEventListener('click', () => {
    state.isHiveOpen = false;
    hiveModal.classList.add('hidden');
});
btnShopPrev.addEventListener('click', () => {
    state.shopSelectionIndex = (state.shopSelectionIndex - 1 + 3) % 3; // simple logic, but carousel might vary in length
    // Actually need actual length
    const len = getShopItemsForType(state.activeShopType).length;
    state.shopSelectionIndex = (state.shopSelectionIndex - 1 + len) % len;
    renderShop();
});
btnShopNext.addEventListener('click', () => {
    const len = getShopItemsForType(state.activeShopType).length;
    state.shopSelectionIndex = (state.shopSelectionIndex + 1) % len;
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
            const idx = TOOLS.findIndex(t => t.name === item.data.name);
            if (idx !== -1) {
                state.currentToolIndex = idx;
                equipTool(TOOLS[idx]);
                showNotification(`Equipped ${item.name}!`);
            }
        } else if (item.type === 'BACKPACK') {
            state.currentBackpackIndex++;
            state.backpackCapacity = item.data.capacity;
            equipBackpack(item.data);
            showNotification(`Upgraded to ${item.name}!`);
        } else if (item.type === 'BEE_UNLOCK') {
             state.inventory.eggs++;
             showNotification(`Unlocked ${item.name} (Check Inventory)`);
        } else if (item.type === 'ACCESSORY') {
            state.equipment[item.data.type] = item.data;
            equipAccessory(item.data);
            showNotification(`Equipped ${item.name}`);
        }
        updateUI();
        renderShop();
    }
});

// --- Inventory System ---
function openInventory() {
    if (state.isInventoryOpen) return;
    state.isInventoryOpen = true;
    inventoryModal.classList.remove('hidden');
    renderInventory();
}
function closeInventory() {
    state.isInventoryOpen = false;
    inventoryModal.classList.add('hidden');
}
btnInventory.addEventListener('click', openInventory);
btnInventoryClose.addEventListener('click', closeInventory);

function renderInventory() {
    uiInventoryStats.innerHTML = `
        <p>Tickets: ${state.tickets}</p>
        <p>Eggs: ${state.inventory.eggs}</p>
    `;

    let html = '';
    Object.keys(state.equipment).forEach(key => {
        const item = state.equipment[key];
        if (item) {
            html += `<div style="margin:5px; padding:5px; border:1px solid #333; background:#eee;">
                <strong>${item.name}</strong> (${key})<br>
                ${Object.entries(item.stats).map(([k,v]) => `${k}: ${v}`).join(', ')}
            </div>`;
        }
    });
    if (html === '') html = '<p>No accessories equipped.</p>';
    uiInventoryEquip.innerHTML = html;
}

function showNotification(text) {
    let note = document.getElementById('notification');
    if (!note) {
        note = document.createElement('div');
        note.id = 'notification';
        document.body.appendChild(note);
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

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(10, 20, 10);
dirLight.castShadow = true;
scene.add(dirLight);

const groundGeometry = new THREE.PlaneGeometry(200, 200);
const groundMaterial = new THREE.MeshStandardMaterial({ color: GROUND_COLOR });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const hiveGeometry = new THREE.BoxGeometry(8, 8, 8);
const hiveMaterial = new THREE.MeshStandardMaterial({ color: HIVE_COLOR });
state.hive = new THREE.Mesh(hiveGeometry, hiveMaterial);
state.hive.position.set(0, 4, -15);
state.hive.castShadow = true;
scene.add(state.hive);

function createShop(x, z, color, type) {
    const geo = new THREE.BoxGeometry(6, 5, 6);
    const mat = new THREE.MeshStandardMaterial({ color: color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 2.5, z);
    mesh.castShadow = true;
    scene.add(mesh);
    state.shops.push({ mesh: mesh, type: type });
}
createShop(30, -10, 0x8B4513, 'GENERAL');
createShop(-35, 10, 0xFF0000, 'RED');
createShop(35, 10, 0x0000FF, 'BLUE');
createShop(0, 30, 0xFFFFFF, 'WHITE');
createShop(-30, -10, 0xFFA500, 'TICKET');

function spawnToken(position, type) {
    const geometry = new THREE.DodecahedronGeometry(0.5);
    let color = 0xFFFF00;
    if (type === 'HONEY') color = 0xFFA500;
    if (type === 'SPEED') color = 0x00FF00;
    if (type === 'TICKET') color = 0xFFD700;
    const material = new THREE.MeshStandardMaterial({ color: color, emissive: 0x222222 });
    const tokenMesh = new THREE.Mesh(geometry, material);
    tokenMesh.position.copy(position);
    tokenMesh.position.y = 1;
    scene.add(tokenMesh);
    state.tokens.push({ mesh: tokenMesh, type: type, life: 10.0 });
}

function updateTokens(dt) {
    for (let i = state.tokens.length - 1; i >= 0; i--) {
        const token = state.tokens[i];
        token.life -= dt;
        token.mesh.rotation.y += 2 * dt;
        if (state.player && state.player.position.distanceTo(token.mesh.position) < 2) {
            if (token.type === 'HONEY') {
                state.honey += 50;
            } else if (token.type === 'SPEED') {
                state.honey += 100;
            } else if (token.type === 'TICKET') {
                state.tickets += 1;
                showNotification("Found 1 Ticket!");
            }
            updateUI();
            scene.remove(token.mesh);
            state.tokens.splice(i, 1);
            continue;
        }
        if (token.life <= 0) {
            scene.remove(token.mesh);
            state.tokens.splice(i, 1);
        }
    }
}

class Bee {
    constructor(id, data) {
        this.id = id;
        this.data = data || { type: 'Basic', rarity: 'Common' };
        this.state = 'IDLE';
        this.target = null;
        this.abilityTimer = 0;
        this.abilityCooldown = 15 + Math.random() * 10;
        this.positionOffset = new THREE.Vector3((Math.random() - 0.5) * 5, (Math.random() * 2) + 1.5, (Math.random() - 0.5) * 5);

        const geometry = new THREE.SphereGeometry(0.3, 8, 8);
        let color = 0xFFFF00;
        if (this.data.rarity === 'Rare') color = 0xC0C0C0;
        if (this.data.rarity === 'Epic') color = 0xFFA500;
        if (this.data.rarity === 'Legendary') color = 0x00FFFF;
        if (this.data.rarity === 'Mythic') color = 0x9370DB;

        const material = new THREE.MeshStandardMaterial({ color: color });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;
        this.addFaceFeatures(color);
        scene.add(this.mesh);
        this.mesh.position.copy(state.player.position).add(this.positionOffset);
    }

    addFaceFeatures(baseColor) {
        const type = this.data.type;
        const eyeColor = (type === 'Photon' || type === 'Buoyant') ? 0xFFFFFF : 0x000000;
        const eyeGeo = new THREE.SphereGeometry(0.05, 4, 4);
        const eyeMat = new THREE.MeshBasicMaterial({ color: eyeColor });
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.1, 0.1, 0.25);
        this.mesh.add(leftEye);
        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.1, 0.1, 0.25);
        this.mesh.add(rightEye);

        if (type === 'Tabby') {
            const earGeo = new THREE.ConeGeometry(0.08, 0.15, 4);
            const earMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
            const leftEar = new THREE.Mesh(earGeo, earMat);
            leftEar.position.set(-0.15, 0.25, 0);
            leftEar.rotation.z = 0.5;
            this.mesh.add(leftEar);
            const rightEar = new THREE.Mesh(earGeo, earMat);
            rightEar.position.set(0.15, 0.25, 0);
            rightEar.rotation.z = -0.5;
            this.mesh.add(rightEar);
        } else if (type === 'Lion') {
            const maneGeo = new THREE.TorusGeometry(0.3, 0.05, 4, 8);
            const maneMat = new THREE.MeshStandardMaterial({ color: 0xFF8C00 });
            const mane = new THREE.Mesh(maneGeo, maneMat);
            mane.rotation.x = Math.PI / 2;
            this.mesh.add(mane);
        }
    }

    update(dt) {
        this.abilityTimer += dt;
        if (this.abilityTimer > this.abilityCooldown) {
            this.abilityTimer = 0;
            const rand = Math.random();
            if (rand < 0.4) spawnToken(this.mesh.position, 'TICKET');
            else spawnToken(this.mesh.position, 'HONEY');
        }
        if (this.state === 'IDLE') {
            const targetPos = state.player.position.clone().add(this.positionOffset);
            this.mesh.position.lerp(targetPos, 2 * dt);
            if (Math.random() < 0.01) this.findFlower();
        } else if (this.state === 'GATHERING') {
            if (this.target) {
                const speed = 5;
                const dir = this.target.mesh.position.clone().sub(this.mesh.position).normalize();
                this.mesh.position.add(dir.multiplyScalar(speed * dt));
                if (this.mesh.position.distanceTo(this.target.mesh.position) < 0.5) {
                    collectPollen(1);
                    this.state = 'RETURNING';
                }
            } else {
                this.state = 'IDLE';
            }
        } else if (this.state === 'RETURNING') {
            const targetPos = state.player.position.clone().add(this.positionOffset);
            const speed = 5;
            const dir = targetPos.clone().sub(this.mesh.position).normalize();
            this.mesh.position.add(dir.multiplyScalar(speed * dt));
            if (this.mesh.position.distanceTo(targetPos) < 0.5) this.state = 'IDLE';
        }
    }
    findFlower() {
        if (state.flowers.length > 0) {
             const randomFlower = state.flowers[Math.floor(Math.random() * state.flowers.length)];
             if (randomFlower.mesh.position.distanceTo(state.player.position) < 15) {
                 this.target = randomFlower;
                 this.state = 'GATHERING';
             }
        }
    }
}

function createFlower(x, z, color) {
    let geometry;
    if (color === RED_FIELD_COLOR) geometry = new THREE.CylinderGeometry(0.6, 0.4, 0.5, 6);
    else if (color === BLUE_FIELD_COLOR) geometry = new THREE.ConeGeometry(0.6, 1.5, 6);
    else geometry = new THREE.CylinderGeometry(0.5, 0.5, 0.2, 8);
    const material = new THREE.MeshStandardMaterial({ color: color });
    const flower = new THREE.Mesh(geometry, material);
    flower.position.set(x, 0.1, z);
    if (color === BLUE_FIELD_COLOR) flower.position.y = 0.75;
    flower.castShadow = true;
    scene.add(flower);
    state.flowers.push({ mesh: flower, color: color, id: Math.random().toString(36).substr(2, 9) });
}

FIELDS.forEach(field => {
    const planeGeo = new THREE.PlaneGeometry(field.w, field.h);
    const planeMat = new THREE.MeshStandardMaterial({ color: field.color, opacity: 0.3, transparent: true });
    const plane = new THREE.Mesh(planeGeo, planeMat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(field.x, 0.05, field.z);
    scene.add(plane);
    const flowerCount = Math.floor((field.w * field.h) / 10);
    for (let i = 0; i < flowerCount; i++) {
        const fx = field.x + (Math.random() - 0.5) * field.w;
        const fz = field.z + (Math.random() - 0.5) * field.h;
        createFlower(fx, fz, field.color);
    }
});

const playerGeometry = new THREE.BoxGeometry(1, 2, 1);
const playerMaterial = new THREE.MeshStandardMaterial({ color: PLAYER_COLOR });
state.player = new THREE.Mesh(playerGeometry, playerMaterial);
state.player.position.y = 1;
state.player.castShadow = true;
scene.add(state.player);

let currentBackpackMesh = null;
function equipBackpack(packData) {
    if (currentBackpackMesh) {
        state.player.remove(currentBackpackMesh);
    }
    let geo, mat;
    const name = packData.name;
    if (name.includes("Pouch")) {
        geo = new THREE.BoxGeometry(0.6, 0.6, 0.3);
        mat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
    } else if (name.includes("Satchel")) {
        geo = new THREE.BoxGeometry(0.8, 0.8, 0.4);
        mat = new THREE.MeshStandardMaterial({ color: 0xA52A2A });
    } else if (name.includes("Canister") && !name.includes("Coconut")) {
        geo = new THREE.CylinderGeometry(0.4, 0.4, 1);
        mat = new THREE.MeshStandardMaterial({ color: 0xC0C0C0 });
    } else if (name.includes("Porcelain")) {
        geo = new THREE.CylinderGeometry(0.5, 0.5, 1.2);
        mat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF });
    } else if (name.includes("Coconut")) {
        geo = new THREE.SphereGeometry(0.6);
        mat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
    }
    if (geo && mat) {
        currentBackpackMesh = new THREE.Mesh(geo, mat);
        currentBackpackMesh.position.set(0, 0.2, 0.6);
        state.player.add(currentBackpackMesh);
    }
}
equipBackpack(BACKPACKS[0]);

function equipAccessory(item) {
    let geo, mat, pos, rot;
    if (item.type === 'MASK') {
        geo = new THREE.BoxGeometry(0.6, 0.5, 0.2);
        mat = new THREE.MeshStandardMaterial({ color: item.color || 0xFFFFFF });
        pos = new THREE.Vector3(0, 0.5, 0.55);
    } else if (item.type === 'BELT') {
        geo = new THREE.TorusGeometry(0.55, 0.1, 8, 16);
        mat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        if (item.name.includes('Petal')) mat.color.setHex(0xFFC0CB);
        pos = new THREE.Vector3(0, -0.2, 0);
        rot = { x: Math.PI/2, y:0, z:0 };
    } else if (item.type === 'BOOTS') {
        geo = new THREE.BoxGeometry(0.3, 0.3, 0.4);
        mat = new THREE.MeshStandardMaterial({ color: item.color || 0x333333 });
        const group = new THREE.Group();
        const left = new THREE.Mesh(geo, mat);
        left.position.set(-0.3, -0.9, 0);
        group.add(left);
        const right = new THREE.Mesh(geo, mat);
        right.position.set(0.3, -0.9, 0);
        group.add(right);
        state.player.add(group);
        state.equipmentMeshes.push({ type: item.type, mesh: group });
        return;
    }
    if (geo && mat) {
        const mesh = new THREE.Mesh(geo, mat);
        if (pos) mesh.position.copy(pos);
        if (rot) mesh.rotation.set(rot.x, rot.y, rot.z);
        state.player.add(mesh);
        state.equipmentMeshes.push({ type: item.type, mesh: mesh });
    }
}

function equipTool(toolData) {
    if (state.tool.mesh) state.player.remove(state.tool.mesh);

    const handleGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.5);
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
    const mesh = new THREE.Mesh(handleGeo, handleMat);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(0.5, 0.5, 0.5);

    if (toolData.name === "Rake") {
        const headGeo = new THREE.BoxGeometry(0.8, 0.1, 0.1);
        const head = new THREE.Mesh(headGeo, new THREE.MeshStandardMaterial({ color: 0x555555 }));
        head.position.y = 0.75;
        mesh.add(head);
        for(let i=-3; i<=3; i+=2) {
            const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.05), new THREE.MeshStandardMaterial({ color: 0x555555 }));
            tooth.position.set(i*0.1, -0.1, 0);
            head.add(tooth);
        }
    } else if (toolData.name === "Vacuum") {
        const vacGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.4);
        const vac = new THREE.Mesh(vacGeo, new THREE.MeshStandardMaterial({ color: 0xCCCCCC }));
        vac.rotation.z = Math.PI / 2;
        vac.position.y = 0.75;
        mesh.add(vac);
    } else if (toolData.name === "Dark Scythe") {
        const bladeGeo = new THREE.TorusGeometry(0.4, 0.05, 4, 10, Math.PI);
        const bladeMat = new THREE.MeshStandardMaterial({ color: 0xFF0000, emissive: 0x330000 });
        const blade = new THREE.Mesh(bladeGeo, bladeMat);
        blade.position.y = 0.75;
        blade.position.x = 0.2;
        blade.rotation.z = Math.PI / 4;
        mesh.add(blade);
        const flame = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.5), new THREE.MeshStandardMaterial({ color: 0x000000 }));
        flame.position.y = 0.8;
        mesh.add(flame);
    } else if (toolData.name === "Tide Popper") {
        const headGeo = new THREE.IcosahedronGeometry(0.3);
        const headMat = new THREE.MeshStandardMaterial({ color: 0x0000FF, transparent: true, opacity: 0.8 });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 0.75;
        mesh.add(head);
    } else if (toolData.name === "Gummy Baller") {
        const headGeo = new THREE.SphereGeometry(0.3);
        const headMat = new THREE.MeshStandardMaterial({ color: 0x00FF00 });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 0.75;
        mesh.add(head);
        const spot = new THREE.Mesh(new THREE.SphereGeometry(0.1), new THREE.MeshStandardMaterial({ color: 0xFF69B4 }));
        spot.position.set(0.1, 0.2, 0.1);
        head.add(spot);
    }
    state.tool.mesh = mesh;
    state.player.add(state.tool.mesh);
}
equipTool(TOOLS[0]);

window.addEventListener('mousedown', () => {
    if (!state.tool.isSwinging) {
        state.tool.isSwinging = true;
        swingTool();
    }
});
window.addEventListener('keydown', (e) => { state.keys[e.code] = true; });
window.addEventListener('keyup', (e) => { state.keys[e.code] = false; });
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Game Loop ---
const clock = new THREE.Clock();

function updatePlayer(dt) {
    if (!state.player) return;
    if (state.isShopOpen || state.isHiveOpen || state.isInventoryOpen) return;

    let speedMult = 1;
    if (state.equipment.BOOTS && state.equipment.BOOTS.stats.moveSpeed) {
        speedMult = state.equipment.BOOTS.stats.moveSpeed;
    }
    const speed = PLAYER_SPEED * speedMult * dt;
    const move = new THREE.Vector3(0, 0, 0);
    if (state.keys['KeyW'] || state.keys['ArrowUp']) move.z -= 1;
    if (state.keys['KeyS'] || state.keys['ArrowDown']) move.z += 1;
    if (state.keys['KeyA'] || state.keys['ArrowLeft']) move.x -= 1;
    if (state.keys['KeyD'] || state.keys['ArrowRight']) move.x += 1;
    if (move.length() > 0) {
        move.normalize().multiplyScalar(speed);
        state.player.position.add(move);
        const angle = Math.atan2(move.x, move.z);
    }
    state.player.position.x = Math.max(-99, Math.min(99, state.player.position.x));
    state.player.position.z = Math.max(-99, Math.min(99, state.player.position.z));
    checkHiveInteraction();
    checkShopInteraction();
}

function checkHiveInteraction() {
    if (!state.hive) return;
    const dist = state.player.position.distanceTo(state.hive.position);
    if (dist < 8) {
        convertPollen();
        if (!state.inHiveZone) {
            state.inHiveZone = true;
            showNotification("Press E to Hatch Bees");
        }
        if (state.keys['KeyE']) openHive();
    } else {
        if (state.inHiveZone) {
            state.inHiveZone = false;
            closeHive();
        }
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
            if (state.keys['KeyE']) openShop(shop.type);
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
        uiConversion.innerText = `Converting... +${amount} Honey`;
        uiConversion.style.opacity = 1;
        setTimeout(() => { uiConversion.style.opacity = 0; }, 2000);
    }
}

function updateCamera() {
    if (!state.player) return;
    const offset = new THREE.Vector3(0, 10, 15);
    const targetPosition = state.player.position.clone().add(offset);
    camera.position.lerp(targetPosition, 0.1);
    camera.lookAt(state.player.position);
}

function swingTool() {
    const playerPos = state.player.position;
    const currentTool = TOOLS[state.currentToolIndex];
    let power = currentTool.power;
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
        let multiplier = 1;
        let colorMult = 1;
        if (currentTool.type === 'RED' && inField.type === 'RED') colorMult += 2;
        if (currentTool.type === 'BLUE' && inField.type === 'BLUE') colorMult += 2;
        if (currentTool.type === 'WHITE' && inField.type === 'WHITE') colorMult += 2;

        Object.values(state.equipment).forEach(item => {
            if (!item) return;
            if (item.stats.pollenMult) multiplier *= item.stats.pollenMult;
            if (inField.type === 'RED' && item.stats.redMult) colorMult *= item.stats.redMult;
            if (inField.type === 'BLUE' && item.stats.blueMult) colorMult *= item.stats.blueMult;
            if (inField.type === 'WHITE' && item.stats.whiteMult) colorMult *= item.stats.whiteMult;
        });
        collectPollen(power * multiplier * colorMult);
    }
}

function collectPollen(amount) {
    let maxCap = state.backpackCapacity;
    Object.values(state.equipment).forEach(item => {
        if (!item) return;
        if (item.stats.capacity) {
            if (item.stats.capacity > 10) maxCap += item.stats.capacity;
            else maxCap *= item.stats.capacity;
        }
    });
    maxCap = Math.floor(maxCap);
    if (state.pollen < maxCap) {
        state.pollen = Math.min(state.pollen + amount, maxCap);
        uiCapacity.innerText = maxCap;
        updateUI();
    }
}

function updateUI() {
    uiPollen.innerText = Math.floor(state.pollen);
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

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
    { name: "Canister", cost: 1000, capacity: 1000 }
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
    hiveSlots: new Array(25).fill(null), // Data for each slot: { type: 'Basic', rarity: 'Common', ... } or null
    inventory: {
        eggs: 0
    },
    isShopOpen: false,
    isHiveOpen: false,
    inShopZone: false,
    inHiveZone: false,
    shopSelectionIndex: 0, // 0=Egg, 1=Tool, 2=Backpack
    tokens: [] // Array of { mesh, type, value, life }
};

// UI Elements
const uiPollen = document.getElementById('pollen-count');
const uiCapacity = document.getElementById('backpack-capacity');
const uiHoney = document.getElementById('honey-count');
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

// --- Shop System ---
let eggCost = 25;

function getShopItem(index) {
    if (index === 0) {
        return {
            type: 'EGG',
            name: 'Basic Egg',
            desc: 'Hatches a random bee.',
            cost: eggCost
        };
    } else if (index === 1) {
        const nextToolIdx = state.currentToolIndex + 1;
        if (nextToolIdx < TOOLS.length) {
            const tool = TOOLS[nextToolIdx];
            return {
                type: 'TOOL',
                name: tool.name,
                desc: `Collects ${tool.power} pollen per swing.`,
                cost: tool.cost,
                data: tool
            };
        } else {
            return { type: 'TOOL', name: 'Max Tool', desc: 'You have the best tool!', cost: Infinity };
        }
    } else if (index === 2) {
        const nextPackIdx = state.currentBackpackIndex + 1;
        if (nextPackIdx < BACKPACKS.length) {
            const pack = BACKPACKS[nextPackIdx];
            return {
                type: 'BACKPACK',
                name: pack.name,
                desc: `Holds ${pack.capacity} pollen.`,
                cost: pack.cost,
                data: pack
            };
        } else {
            return { type: 'BACKPACK', name: 'Max Backpack', desc: 'You have the best backpack!', cost: Infinity };
        }
    }
    return null;
}

function renderShop() {
    const item = getShopItem(state.shopSelectionIndex);
    shopName.innerText = item.name;
    shopDesc.innerText = item.desc;
    shopCost.innerText = (item.cost === Infinity) ? "Sold Out" : `Cost: ${item.cost} Honey`;

    if (item.cost === Infinity || state.honey < item.cost) {
        btnShopBuy.disabled = true;
    } else {
        btnShopBuy.disabled = false;
    }
}

function openShop() {
    if (state.isShopOpen) return;
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
    if (item.cost !== Infinity && state.honey >= item.cost) {
        state.honey -= item.cost;

        if (item.type === 'EGG') {
            state.inventory.eggs++;
            eggCost = Math.floor(eggCost * 1.5);
            alert("You bought an egg! Go to your hive to hatch it.");
        } else if (item.type === 'TOOL') {
            state.currentToolIndex++;
            state.tool.mesh.material.color.multiplyScalar(0.8);
        } else if (item.type === 'BACKPACK') {
            state.currentBackpackIndex++;
            state.backpackCapacity = item.data.capacity;
        }

        updateUI();
        renderShop();
    }
});

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
state.hive.position.set(0, 4, -40); // Back of the map
state.hive.castShadow = true;
scene.add(state.hive);

// --- Shop Building ---
const shopGeometry = new THREE.BoxGeometry(10, 8, 10);
const shopMaterial = new THREE.MeshStandardMaterial({ color: SHOP_COLOR });
state.shop = new THREE.Mesh(shopGeometry, shopMaterial);
state.shop.position.set(40, 4, -10); // Right side
state.shop.castShadow = true;
scene.add(state.shop);

// Add "Shop" Text sign (simulated with a smaller lighter box for now)
const signGeo = new THREE.BoxGeometry(6, 2, 1);
const signMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
const sign = new THREE.Mesh(signGeo, signMat);
sign.position.set(0, 6, 5);
state.shop.add(sign);

// --- Tokens ---
function spawnToken(position, type) {
    const geometry = new THREE.DodecahedronGeometry(0.5); // Token shape
    let color = 0xFFFF00;
    if (type === 'HONEY') color = 0xFFA500;
    if (type === 'SPEED') color = 0x00FF00;

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
                // Temporary speed boost logic (simplified: just instant reward for MVP)
                state.honey += 100;
                updateUI();
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
        scene.add(this.mesh);

        // Initial position
        this.mesh.position.copy(state.player.position).add(this.positionOffset);
    }

    update(dt) {
        // Ability Logic
        this.abilityTimer += dt;
        if (this.abilityTimer > this.abilityCooldown) {
            this.abilityTimer = 0;
            // Spawn Token
            spawnToken(this.mesh.position, 'HONEY');
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

// --- Tool ---
const toolGeometry = new THREE.BoxGeometry(0.2, 0.2, 1);
const toolMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 }); // Brown
state.tool.mesh = new THREE.Mesh(toolGeometry, toolMaterial);
state.tool.mesh.position.set(0.5, 0, 0.5); // Offset to side
state.player.add(state.tool.mesh); // Attach to player

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
        if (!state.inHiveZone) {
            state.inHiveZone = true;
            openHive();
        }
        convertPollen(); // Continuous conversion while in zone
    } else {
        if (state.inHiveZone) {
            state.inHiveZone = false;
            closeHive();
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
            div.innerText = slotData.rarity[0]; // First letter of rarity
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
        const confirmHatch = confirm(`Hatch an egg in slot ${index + 1}?`);
        if (confirmHatch) {
            state.inventory.eggs--;

            // Random Rarity Logic
            const rand = Math.random();
            let rarity = 'Common';
            let type = 'Basic';

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
        }
    } else {
        alert("You don't have any eggs!");
    }
}

function checkShopInteraction() {
    if (!state.shop) return;
    const dist = state.player.position.distanceTo(state.shop.position);

    if (dist < 10) {
        if (!state.inShopZone) {
            state.inShopZone = true;
            openShop();
        }
    } else {
        if (state.inShopZone) {
            state.inShopZone = false;
            closeShop();
        }
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
    // Check collisions with flowers
    // Simple distance check from player to flowers
    const playerPos = state.player.position;
    const currentTool = TOOLS[state.currentToolIndex];
    let power = currentTool.power;

    state.flowers.forEach(flower => {
        const dist = playerPos.distanceTo(flower.mesh.position);
        if (dist < 2.5) { // Close enough

            // Check Color Multiplier
            let multiplier = 1;
            if (currentTool.type === 'RED' && flower.color === RED_FIELD_COLOR) multiplier = 3;
            if (currentTool.type === 'BLUE' && flower.color === BLUE_FIELD_COLOR) multiplier = 3;
            if (currentTool.type === 'WHITE' && flower.color === WHITE_FIELD_COLOR) multiplier = 3;

            collectPollen(power * multiplier);
        }
    });
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

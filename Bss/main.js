import * as THREE from 'three';

// --- Configuration ---
const SCENE_COLOR = 0x87CEEB; // Sky blue
const GROUND_COLOR = 0x228B22; // Forest Green
const PLAYER_COLOR = 0x0000FF; // Blue player
const PLAYER_SPEED = 10;
const HIVE_COLOR = 0xFFD700; // Gold
const FLOWER_COLORS = [0xFF0000, 0x0000FF, 0xFFFFFF]; // Red, Blue, White

const TOOLS = [
    { name: "Stick", cost: 0, power: 1 },
    { name: "Rake", cost: 100, power: 3 },
    { name: "Vacuum", cost: 500, power: 10 }
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
    bees: []
};

// UI Elements
const uiPollen = document.getElementById('pollen-count');
const uiCapacity = document.getElementById('backpack-capacity');
const uiHoney = document.getElementById('honey-count');
const btnBuyEgg = document.getElementById('buy-egg-btn');
const btnBuyTool = document.getElementById('buy-tool-btn');
const btnBuyBackpack = document.getElementById('buy-backpack-btn');

// --- Shop ---
let eggCost = 25;

function updateShopUI() {
    // Egg
    btnBuyEgg.innerText = `Buy Egg (${eggCost} Honey)`;

    // Tool
    const nextToolIdx = state.currentToolIndex + 1;
    if (nextToolIdx < TOOLS.length) {
        const tool = TOOLS[nextToolIdx];
        btnBuyTool.innerText = `Buy ${tool.name} (${tool.cost} Honey)`;
        btnBuyTool.disabled = false;
    } else {
        btnBuyTool.innerText = "Max Tool";
        btnBuyTool.disabled = true;
    }

    // Backpack
    const nextPackIdx = state.currentBackpackIndex + 1;
    if (nextPackIdx < BACKPACKS.length) {
        const pack = BACKPACKS[nextPackIdx];
        btnBuyBackpack.innerText = `Buy ${pack.name} (${pack.cost} Honey)`;
        btnBuyBackpack.disabled = false;
    } else {
        btnBuyBackpack.innerText = "Max Backpack";
        btnBuyBackpack.disabled = true;
    }
}

btnBuyEgg.addEventListener('click', () => {
    if (state.honey >= eggCost) {
        state.honey -= eggCost;
        state.bees.push(new Bee(state.bees.length));
        eggCost = Math.floor(eggCost * 1.5); // Increase cost
        updateUI();
        updateShopUI();
    }
});

btnBuyTool.addEventListener('click', () => {
    const nextToolIdx = state.currentToolIndex + 1;
    if (nextToolIdx < TOOLS.length) {
        const tool = TOOLS[nextToolIdx];
        if (state.honey >= tool.cost) {
            state.honey -= tool.cost;
            state.currentToolIndex = nextToolIdx;

            // Visual Feedback: Change Tool Color slightly (Darker brown)
            state.tool.mesh.material.color.multiplyScalar(0.8);

            updateUI();
            updateShopUI();
        }
    }
});

btnBuyBackpack.addEventListener('click', () => {
    const nextPackIdx = state.currentBackpackIndex + 1;
    if (nextPackIdx < BACKPACKS.length) {
        const pack = BACKPACKS[nextPackIdx];
        if (state.honey >= pack.cost) {
            state.honey -= pack.cost;
            state.currentBackpackIndex = nextPackIdx;
            state.backpackCapacity = pack.capacity;

            updateUI();
            updateShopUI();
        }
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
const groundGeometry = new THREE.PlaneGeometry(100, 100);
const groundMaterial = new THREE.MeshStandardMaterial({ color: GROUND_COLOR });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// --- Hive ---
const hiveGeometry = new THREE.BoxGeometry(6, 6, 6);
const hiveMaterial = new THREE.MeshStandardMaterial({ color: HIVE_COLOR });
state.hive = new THREE.Mesh(hiveGeometry, hiveMaterial);
state.hive.position.set(0, 3, -20); // Back of the map
state.hive.castShadow = true;
scene.add(state.hive);

// --- Bees ---
class Bee {
    constructor(id) {
        this.id = id;
        this.state = 'IDLE'; // IDLE, GATHERING, RETURNING
        this.target = null;
        this.positionOffset = new THREE.Vector3(
            (Math.random() - 0.5) * 3,
            (Math.random() * 1) + 1.5,
            (Math.random() - 0.5) * 3
        );

        // Visuals
        const geometry = new THREE.SphereGeometry(0.3, 8, 8);
        const material = new THREE.MeshStandardMaterial({ color: 0xFFFF00 }); // Yellow
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;
        scene.add(this.mesh);

        // Initial position
        this.mesh.position.copy(state.player.position).add(this.positionOffset);
    }

    update(dt) {
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
function createFlower(x, z) {
    const color = FLOWER_COLORS[Math.floor(Math.random() * FLOWER_COLORS.length)];
    const geometry = new THREE.CylinderGeometry(0.5, 0.5, 0.2, 8);
    const material = new THREE.MeshStandardMaterial({ color: color });
    const flower = new THREE.Mesh(geometry, material);
    flower.position.set(x, 0.1, z); // Slightly above ground
    flower.castShadow = true;
    scene.add(flower);

    state.flowers.push({
        mesh: flower,
        color: color,
        id: Math.random().toString(36).substr(2, 9)
    });
}

// Generate Field
for (let i = 0; i < 50; i++) {
    const x = (Math.random() - 0.5) * 40; // Random X between -20 and 20
    const z = (Math.random() * 30) + 5;   // Random Z between 5 and 35 (front of map)
    createFlower(x, z);
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
    state.player.position.x = Math.max(-49, Math.min(49, state.player.position.x));
    state.player.position.z = Math.max(-49, Math.min(49, state.player.position.z));

    // Check Hive Interaction
    checkHiveInteraction();
}

function checkHiveInteraction() {
    if (!state.hive) return;
    const dist = state.player.position.distanceTo(state.hive.position);
    // Hive size is 6x6x6. Center is at (0, 3, -20).
    // Distance check 5 should be enough (3 from center to edge + 2 buffer)
    if (dist < 6) {
        convertPollen();
    }
}

function convertPollen() {
    if (state.pollen > 0) {
        const amount = state.pollen;
        state.pollen = 0;
        state.honey += amount;
        updateUI();
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
    const power = TOOLS[state.currentToolIndex].power;

    state.flowers.forEach(flower => {
        const dist = playerPos.distanceTo(flower.mesh.position);
        if (dist < 2.5) { // Close enough
            collectPollen(power);
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

    renderer.render(scene, camera);
}

animate();

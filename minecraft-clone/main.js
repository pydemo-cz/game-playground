import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { createNoise2D } from './noise.js';

// --- Constants ---
const BLOCK_SIZE = 1;
const WORLD_SIZE = 128; // Increased from 50 to 128
const CHUNK_HEIGHT = 32;

// Block Types
const BLOCK_GRASS = 1;
const BLOCK_STONE = 2;
const BLOCK_WOOD = 3;

// --- Textures ---
function createTextures() {
    // Helper to create a simple color texture
    const createColorTexture = (color, border = false) => {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 64, 64);
        if (border) {
            ctx.strokeStyle = 'rgba(0,0,0,0.2)';
            ctx.lineWidth = 4;
            ctx.strokeRect(0, 0, 64, 64);
        }
        return new THREE.CanvasTexture(canvas);
    };

    const grassTop = createColorTexture('#34a12c', true);
    const dirtSide = createColorTexture('#8a5e2e', true);
    const stone = createColorTexture('#7a7a7a', true);
    const wood = createColorTexture('#5c4033', true);

    // Grass Block Materials (Top is grass, others dirt)
    const matGrass = [
        new THREE.MeshStandardMaterial({ map: dirtSide }), // right
        new THREE.MeshStandardMaterial({ map: dirtSide }), // left
        new THREE.MeshStandardMaterial({ map: grassTop }), // top
        new THREE.MeshStandardMaterial({ map: dirtSide }), // bottom
        new THREE.MeshStandardMaterial({ map: dirtSide }), // front
        new THREE.MeshStandardMaterial({ map: dirtSide })  // back
    ];

    // Stone Material
    const matStone = new THREE.MeshStandardMaterial({ map: stone });

    // Wood Material
    const matWood = new THREE.MeshStandardMaterial({ map: wood });

    return { matGrass, matStone, matWood };
}

// --- World Management ---
class World {
    constructor() {
        this.blocks = new Map();
    }

    getKey(x, y, z) {
        return `${x},${y},${z}`;
    }

    setBlock(x, y, z, type) {
        this.blocks.set(this.getKey(x, y, z), type);
    }

    getBlock(x, y, z) {
        return this.blocks.get(this.getKey(x, y, z));
    }

    hasBlock(x, y, z) {
        return this.blocks.has(this.getKey(x, y, z));
    }
}

// --- Structure Generator ---
class StructureGenerator {
    constructor(world) {
        this.world = world;
    }

    // Generate a castle at (cx, cz)
    generateCastle(cx, cz, terrainHeightFunc) {
        const baseHeight = Math.floor(terrainHeightFunc(cx, cz));
        const floorY = baseHeight + 1;
        const width = 20;
        const depth = 20;
        const wallHeight = 6;

        // Clear area for castle foundation
        for (let x = cx - width / 2; x <= cx + width / 2; x++) {
            for (let z = cz - depth / 2; z <= cz + depth / 2; z++) {
                // Fill foundation down to terrain
                const h = Math.floor(terrainHeightFunc(x, z));
                for (let y = h + 1; y < floorY; y++) {
                    this.world.setBlock(x, y, z, BLOCK_STONE);
                }
            }
        }

        // Walls
        for (let x = cx - width / 2; x <= cx + width / 2; x++) {
            for (let z = cz - depth / 2; z <= cz + depth / 2; z++) {
                const isEdge = x === cx - width / 2 || x === cx + width / 2 || z === cz - depth / 2 || z === cz + depth / 2;
                if (isEdge) {
                    // Build wall
                    for (let y = floorY; y < floorY + wallHeight; y++) {
                        this.world.setBlock(x, y, z, BLOCK_STONE);
                    }
                    // Battlements
                    if ((x + z) % 2 === 0) {
                        this.world.setBlock(x, floorY + wallHeight, z, BLOCK_STONE);
                    }
                } else {
                    // Floor
                    this.world.setBlock(x, floorY - 1, z, BLOCK_STONE);
                }
            }
        }

        // Towers at corners
        const corners = [
            { x: cx - width / 2, z: cz - depth / 2 },
            { x: cx + width / 2, z: cz - depth / 2 },
            { x: cx - width / 2, z: cz + depth / 2 },
            { x: cx + width / 2, z: cz + depth / 2 }
        ];

        corners.forEach(c => {
            for (let xx = c.x - 2; xx <= c.x + 2; xx++) {
                for (let zz = c.z - 2; zz <= c.z + 2; zz++) {
                     for (let y = floorY; y < floorY + wallHeight + 4; y++) {
                         // Hollow tower
                         if (xx === c.x - 2 || xx === c.x + 2 || zz === c.z - 2 || zz === c.z + 2) {
                             this.world.setBlock(xx, y, zz, BLOCK_STONE);
                         }
                     }
                }
            }
        });

        // Gate
        for (let x = cx - 2; x <= cx + 2; x++) {
            for (let y = floorY; y < floorY + 4; y++) {
                this.world.setBlock(x, y, cz + depth / 2, 0); // Air (remove wall)
                this.world.blocks.delete(this.world.getKey(x, y, cz + depth / 2));
            }
        }

        // Keep (Central building)
        for (let x = cx - 5; x <= cx + 5; x++) {
            for (let z = cz - 5; z <= cz + 5; z++) {
                for (let y = floorY; y < floorY + 10; y++) {
                     const isEdge = x === cx - 5 || x === cx + 5 || z === cz - 5 || z === cz + 5;
                     if (isEdge) {
                         this.world.setBlock(x, y, z, BLOCK_WOOD);
                     } else if (y === floorY) {
                         this.world.setBlock(x, y, z, BLOCK_WOOD); // Floor
                     }
                }
            }
        }
    }
}


// --- Player Class ---
class Player {
    constructor(camera, world) {
        this.camera = camera;
        this.world = world;
        this.height = 1.8;
        this.radius = 0.3;
        this.velocity = new THREE.Vector3();
        this.onGround = false;
        this.input = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            jump: false
        };

        // Helper box for calculations
        this.box = new THREE.Box3();

        // Touch inputs
        this.touch = {
            joystick: { active: false, startX: 0, startY: 0, identifier: -1 },
            camera: { active: false, startX: 0, startY: 0, prevX: 0, prevY: 0, identifier: -1 }
        };
    }

    get position() {
        return this.camera.position;
    }

    applyInputs(delta) {
        // Increased speed to be responsive
        const speed = 60.0;
        const direction = new THREE.Vector3();
        this.camera.getWorldDirection(direction);
        direction.y = 0;
        direction.normalize();

        const right = new THREE.Vector3();
        right.crossVectors(this.camera.up, direction).normalize();

        if (this.input.forward) this.velocity.addScaledVector(direction, speed * delta);
        if (this.input.backward) this.velocity.addScaledVector(direction, -speed * delta);
        if (this.input.left) this.velocity.addScaledVector(right, speed * delta);
        if (this.input.right) this.velocity.addScaledVector(right, -speed * delta);

        if (this.input.jump && this.onGround) {
            this.velocity.y = 12.0; // Stronger jump
            this.onGround = false;
        }
    }

    checkCollision() {
        const pos = this.position;
        // Player bounding box (approximate)
        const minX = pos.x - this.radius;
        const maxX = pos.x + this.radius;
        const minY = pos.y - 1.6; // Eyes are at 1.6ish
        const maxY = pos.y + 0.2;
        const minZ = pos.z - this.radius;
        const maxZ = pos.z + this.radius;

        // Range of blocks to check
        const startX = Math.floor(minX);
        const endX = Math.floor(maxX);
        const startY = Math.floor(minY);
        const endY = Math.floor(maxY);
        const startZ = Math.floor(minZ);
        const endZ = Math.floor(maxZ);

        for (let x = startX; x <= endX; x++) {
            for (let y = startY; y <= endY; y++) {
                for (let z = startZ; z <= endZ; z++) {
                    if (this.world.hasBlock(x, y, z)) {
                        // Collision found with block (x, y, z)
                        // AABB vs AABB resolution
                        const blockMinX = x;
                        const blockMaxX = x + 1;
                        const blockMinY = y;
                        const blockMaxY = y + 1;
                        const blockMinZ = z;
                        const blockMaxZ = z + 1;

                        // Calculate overlap
                        const overlapX = Math.min(maxX, blockMaxX) - Math.max(minX, blockMinX);
                        const overlapY = Math.min(maxY, blockMaxY) - Math.max(minY, blockMinY);
                        const overlapZ = Math.min(maxZ, blockMaxZ) - Math.max(minZ, blockMinZ);

                        if (overlapX > 0 && overlapY > 0 && overlapZ > 0) {
                             // Find minimum overlap to resolve
                             if (overlapY < overlapX && overlapY < overlapZ) {
                                 // Resolve Y (Vertical)
                                 if (pos.y > y + 0.5) { // Hitting floor
                                     this.position.y += overlapY;
                                     this.velocity.y = 0;
                                     this.onGround = true;
                                 } else { // Hitting ceiling
                                     this.position.y -= overlapY;
                                     this.velocity.y = 0;
                                 }
                             } else if (overlapX < overlapZ) {
                                 // Resolve X
                                 if (pos.x > x + 0.5) this.position.x += overlapX;
                                 else this.position.x -= overlapX;
                                 this.velocity.x = 0;
                             } else {
                                 // Resolve Z
                                 if (pos.z > z + 0.5) this.position.z += overlapZ;
                                 else this.position.z -= overlapZ;
                                 this.velocity.z = 0;
                             }
                             // Update bounds after resolution
                             return; // Resolve one collision per frame to avoid jitter? Or loop?
                             // Simple logic: resolve and return often works well enough for simple AABB
                        }
                    }
                }
            }
        }
    }

    update(delta) {
        // Apply gravity
        this.velocity.y -= 18.0 * delta; // Reduced gravity for better jump feel

        // Apply friction
        const friction = 10.0;
        this.velocity.x -= this.velocity.x * friction * delta;
        this.velocity.z -= this.velocity.z * friction * delta;

        this.applyInputs(delta);

        // Move
        this.position.x += this.velocity.x * delta;
        this.checkCollision();
        this.position.z += this.velocity.z * delta;
        this.checkCollision();
        this.position.y += this.velocity.y * delta;
        this.onGround = false; // Assume air until collision proves otherwise
        this.checkCollision();

        // Reset jump input
        this.input.jump = false;

        // Kill plane
        if (this.position.y < -50) {
            this.position.set(0, 30, 0);
            this.velocity.set(0,0,0);
        }
    }

     handleTouch(event) {
        for (const touch of event.changedTouches) {
            const isLeftSide = touch.clientX < window.innerWidth / 2;

            switch (event.type) {
                case 'touchstart':
                    if (isLeftSide) {
                        if (!this.touch.joystick.active) {
                            this.touch.joystick.active = true;
                            this.touch.joystick.identifier = touch.identifier;
                            this.touch.joystick.startX = touch.clientX;
                            this.touch.joystick.startY = touch.clientY;
                        }
                    } else {
                        if (!this.touch.camera.active) {
                            this.touch.camera.active = true;
                            this.touch.camera.identifier = touch.identifier;
                            this.touch.camera.startX = touch.clientX;
                            this.touch.camera.startY = touch.clientY;
                            this.touch.camera.prevX = touch.clientX;
                            this.touch.camera.prevY = touch.clientY;
                        }
                    }
                    break;

                case 'touchmove':
                    if (isLeftSide) {
                        if (this.touch.joystick.active && this.touch.joystick.identifier === touch.identifier) {
                            const deltaX = touch.clientX - this.touch.joystick.startX;
                            const deltaY = touch.clientY - this.touch.joystick.startY;

                            // Threshold for movement
                            const threshold = 20;
                            this.input.forward = deltaY < -threshold;
                            this.input.backward = deltaY > threshold;
                            this.input.left = deltaX < -threshold;
                            this.input.right = deltaX > threshold;
                        }
                    } else {
                        if (this.touch.camera.active && this.touch.camera.identifier === touch.identifier) {
                            const deltaX = touch.clientX - this.touch.camera.prevX;
                            const deltaY = touch.clientY - this.touch.camera.prevY;

                            // Rotate camera
                            this.camera.rotation.y -= deltaX * 0.005;

                            // Clamp pitch
                            // Accessing rotation.x logic outside of PointerLock needs care but simply:
                            this.camera.rotation.x -= deltaY * 0.005;
                            this.camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.camera.rotation.x));

                            this.touch.camera.prevX = touch.clientX;
                            this.touch.camera.prevY = touch.clientY;
                        }
                    }
                    break;

                case 'touchend':
                    if (isLeftSide) {
                        if (this.touch.joystick.identifier === touch.identifier) {
                            this.touch.joystick.active = false;
                            this.input.forward = false;
                            this.input.backward = false;
                            this.input.left = false;
                            this.input.right = false;
                        }
                    } else {
                        if (this.touch.camera.identifier === touch.identifier) {
                            this.touch.camera.active = false;
                            // Check for tap to jump
                            const tapDistance = Math.hypot(touch.clientX - this.touch.camera.startX, touch.clientY - this.touch.camera.startY);
                            if (tapDistance < 10) {
                                this.input.jump = true;
                            }
                        }
                    }
                    break;
            }
        }
    }
}

// --- Main Application ---
async function main() {
    try {
        console.log("Starting Minecraft Clone...");
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x87ceeb);
        // Add simple fog
        scene.fog = new THREE.Fog(0x87ceeb, 20, WORLD_SIZE - 20);

        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        document.body.appendChild(renderer.domElement);

        const controls = new PointerLockControls(camera, document.body);
        const world = new World();
        const player = new Player(camera, world);

        // Lights
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(50, 100, 50);
        scene.add(dirLight);

        // Generation
        const noise2D = createNoise2D();
        const textures = createTextures();
        const geometry = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);

        console.log("Generating terrain...");

        const terrainHeight = (x, z) => {
            const n = noise2D(x * 0.03, z * 0.03);
            return Math.round(n * 10);
        };

        // Generate Terrain Data
        for (let x = -WORLD_SIZE / 2; x < WORLD_SIZE / 2; x++) {
            for (let z = -WORLD_SIZE / 2; z < WORLD_SIZE / 2; z++) {
                const y = terrainHeight(x, z);
                world.setBlock(x, y, z, BLOCK_GRASS);
                // Fill underneath
                for (let dy = 1; dy <= 3; dy++) {
                    world.setBlock(x, y - dy, z, BLOCK_GRASS); // Just use same block for simplicity or stone
                }
            }
        }

        // Generate Castle
        const structureGen = new StructureGenerator(world);
        structureGen.generateCastle(0, 0, terrainHeight); // Castle at center

        // Create Instanced Meshes
        const maxCount = WORLD_SIZE * WORLD_SIZE * 10; // Upper bound estimation
        const meshGrass = new THREE.InstancedMesh(geometry, textures.matGrass, maxCount);
        const meshStone = new THREE.InstancedMesh(geometry, textures.matStone, maxCount);
        const meshWood = new THREE.InstancedMesh(geometry, textures.matWood, maxCount);

        let countGrass = 0;
        let countStone = 0;
        let countWood = 0;

        const dummy = new THREE.Object3D();

        // Iterate world blocks and populate meshes
        for (const [key, type] of world.blocks) {
            const [x, y, z] = key.split(',').map(Number);
            dummy.position.set(x, y, z);
            dummy.updateMatrix();

            if (type === BLOCK_GRASS) {
                meshGrass.setMatrixAt(countGrass++, dummy.matrix);
            } else if (type === BLOCK_STONE) {
                meshStone.setMatrixAt(countStone++, dummy.matrix);
            } else if (type === BLOCK_WOOD) {
                meshWood.setMatrixAt(countWood++, dummy.matrix);
            }
        }

        meshGrass.count = countGrass;
        meshStone.count = countStone;
        meshWood.count = countWood;

        meshGrass.instanceMatrix.needsUpdate = true;
        meshStone.instanceMatrix.needsUpdate = true;
        meshWood.instanceMatrix.needsUpdate = true;

        scene.add(meshGrass);
        scene.add(meshStone);
        scene.add(meshWood);

        console.log(`World generated with ${countGrass + countStone + countWood} blocks.`);

        // Setup Controls
        const ui = document.getElementById('ui');
        let lastTouchTime = 0;
        document.body.addEventListener('touchstart', () => { lastTouchTime = performance.now(); }, { passive: true });

        document.body.addEventListener('click', () => {
            // Prevent PointerLock on mobile devices (touch interaction) to avoid crashes
            if (performance.now() - lastTouchTime > 1000) {
                controls.lock();
            }
        });
        controls.addEventListener('lock', () => {
            ui.style.display = 'none';
        });
        controls.addEventListener('unlock', () => {
            ui.style.display = 'block';
        });

        const onKeyDown = (event) => {
            switch (event.code) {
                case 'KeyW': player.input.forward = true; break;
                case 'KeyA': player.input.left = true; break;
                case 'KeyS': player.input.backward = true; break;
                case 'KeyD': player.input.right = true; break;
                case 'Space': player.input.jump = true; break;
            }
        };
        const onKeyUp = (event) => {
            switch (event.code) {
                case 'KeyW': player.input.forward = false; break;
                case 'KeyA': player.input.left = false; break;
                case 'KeyS': player.input.backward = false; break;
                case 'KeyD': player.input.right = false; break;
            }
        };
        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keyup', onKeyUp);

        // Mobile inputs
        document.addEventListener('touchstart', (e) => player.handleTouch(e), { passive: false });
        document.addEventListener('touchmove', (e) => { player.handleTouch(e); e.preventDefault(); }, { passive: false });
        document.addEventListener('touchend', (e) => player.handleTouch(e), { passive: false });

        // Setup Player Position (High up to fall securely)
        camera.position.set(0, 30, 30);

        // Animation Loop
        let prevTime = performance.now();
        function animate() {
            requestAnimationFrame(animate);

            try {
                const time = performance.now();
                const delta = Math.min((time - prevTime) / 1000, 0.1); // Cap delta to prevent huge jumps on lag
                prevTime = time;

                // Always update player physics, whether locked or not (supports mobile)
                player.update(delta);

                renderer.render(scene, camera);
            } catch (e) {
                console.error("Loop error:", e);
                // Only alert once to avoid spam
                if (!window.hasAlertedError) {
                    alert("Loop Error: " + e.message);
                    window.hasAlertedError = true;
                }
            }
        }

        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });

        animate();

    } catch (err) {
        console.error("Fatal error in main:", err);
        alert("Fatal error: " + err.message);
    }
}

main();

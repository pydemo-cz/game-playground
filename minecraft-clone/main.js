import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { createNoise2D } from 'https://cdn.jsdelivr.net/npm/simplex-noise/dist/esm/simplex-noise.js';

// --- Player Class ---
class Player {
    constructor(camera) {
        this.camera = camera;
        this.height = 1.8;
        this.radius = 0.4;
        this.velocity = new THREE.Vector3();
        this.onGround = false;
        this.input = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            jump: false
        };

        // Player's bounding box for collision detection
        this.box = new THREE.Box3(
            new THREE.Vector3(-this.radius, 0, -this.radius),
            new THREE.Vector3(this.radius, this.height, this.radius)
        );

        this.touch = {
            joystick: { active: false, startX: 0, startY: 0, currentX: 0, currentY: 0, identifier: -1 },
            camera: { active: false, startX: 0, startY: 0, prevX: 0, prevY: 0, identifier: -1 },
        };
    }

    get position() {
        return this.camera.position;
    }

    applyInputs(delta) {
        const speed = 5.0;
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
            this.velocity.y += 8.0;
            this.onGround = false;
        }
    }

    update(delta, world) {
        // Apply gravity
        this.velocity.y -= 9.8 * 8.0 * delta;

        // Apply friction
        this.velocity.x *= (1 - 10.0 * delta);
        this.velocity.z *= (1 - 10.0 * delta);

        this.applyInputs(delta);

        this.position.addScaledVector(this.velocity, delta);

        // Simple collision detection
        this.onGround = false;
        const playerBox = this.box.clone().translate(this.position);

        world.children.forEach(mesh => {
            if (mesh.geometry.type === 'BoxGeometry') {
                const blockBox = new THREE.Box3().setFromObject(mesh);
                if (playerBox.intersectsBox(blockBox)) {
                    const intersection = playerBox.intersect(blockBox);
                    const size = intersection.getSize(new THREE.Vector3());
                    const push = new THREE.Vector3();

                    if (size.y > size.x && size.y > size.z) { // Vertical collision
                        if (playerBox.min.y < blockBox.max.y && this.velocity.y <= 0) {
                            this.position.y += size.y;
                            this.velocity.y = 0;
                            this.onGround = true;
                        } else {
                            this.position.y -= size.y;
                            this.velocity.y = 0;
                        }
                    } else { // Horizontal collision
                        if (size.x > size.z) {
                           if (playerBox.getCenter(new THREE.Vector3()).x > blockBox.getCenter(new THREE.Vector3()).x) {
                                this.position.x += size.x;
                            } else {
                                this.position.x -= size.x;
                            }
                        } else {
                            if (playerBox.getCenter(new THREE.Vector3()).z > blockBox.getCenter(new THREE.Vector3()).z) {
                                this.position.z += size.z;
                            } else {
                                this.position.z -= size.z;
                            }
                        }
                    }
                }
            }
        });

        // Reset jump input
        this.input.jump = false;
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
                            this.touch.camera.startTime = event.timeStamp;
                        }
                    }
                    break;

                case 'touchmove':
                    if (isLeftSide) {
                        if (this.touch.joystick.active && this.touch.joystick.identifier === touch.identifier) {
                            const deltaX = touch.clientX - this.touch.joystick.startX;
                            const deltaY = touch.clientY - this.touch.joystick.startY;

                            this.input.forward = deltaY < -10;
                            this.input.backward = deltaY > 10;
                            this.input.left = deltaX < -10;
                            this.input.right = deltaX > 10;
                        }
                    } else {
                        if (this.touch.camera.active && this.touch.camera.identifier === touch.identifier) {
                            const deltaX = touch.clientX - this.touch.camera.prevX;
                            const deltaY = touch.clientY - this.touch.camera.prevY;

                            this.camera.rotation.y -= deltaX * 0.002;
                            this.camera.rotation.x -= deltaY * 0.002;
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
                            const tapDuration = event.timeStamp - this.touch.camera.startTime;
                            const tapDistance = Math.hypot(touch.clientX - this.touch.camera.startX, touch.clientY - this.touch.camera.startY);
                            if (tapDistance < 10 && tapDuration < 200) {
                                this.input.jump = true;
                            }
                        }
                    }
                    break;
            }
        }
    }
}

// --- Helper function to create textures ---
function createBlockTextures() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext('2d');

    // Grass Top
    context.fillStyle = '#34a12c'; // Green
    context.fillRect(0, 0, 64, 64);
    const grassTopTexture = new THREE.CanvasTexture(canvas);

    // Dirt/Side
    const dirtCanvas = document.createElement('canvas');
    dirtCanvas.width = 64;
    dirtCanvas.height = 64;
    const dirtContext = dirtCanvas.getContext('2d');
    dirtContext.fillStyle = '#8a5e2e'; // Brown
    dirtContext.fillRect(0, 0, 64, 64);
    dirtContext.strokeStyle = '#a17a4a';
    dirtContext.lineWidth = 2;
    dirtContext.strokeRect(2, 2, 60, 60); // Simple border for detail
    const dirtTexture = new THREE.CanvasTexture(dirtCanvas);

    return [
        new THREE.MeshStandardMaterial({ map: dirtTexture }), // right
        new THREE.MeshStandardMaterial({ map: dirtTexture }), // left
        new THREE.MeshStandardMaterial({ map: grassTopTexture }), // top
        new THREE.MeshStandardMaterial({ map: dirtTexture }), // bottom
        new THREE.MeshStandardMaterial({ map: dirtTexture }), // front
        new THREE.MeshStandardMaterial({ map: dirtTexture })  // back
    ];
}


// --- Main Application ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
const controls = new PointerLockControls(camera, document.body);
const player = new Player(camera);

const objects = [];
let prevTime = performance.now();

function init() {
    scene.background = new THREE.Color(0x87ceeb);
    camera.position.y = 15;
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0x404040, 0.8);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
    directionalLight.position.set(50, 50, 50);
    scene.add(directionalLight);

    const noise2D = createNoise2D();
    const worldSize = 50;
    const blockSize = 1;
    const grassMaterials = createBlockTextures();
    const blockGeometry = new THREE.BoxGeometry(blockSize, blockSize, blockSize);

    for (let x = -worldSize / 2; x < worldSize / 2; x++) {
        for (let z = -worldSize / 2; z < worldSize / 2; z++) {
            const y = Math.round(noise2D(x * 0.08, z * 0.08) * 6);
            const block = new THREE.Mesh(blockGeometry, grassMaterials);
            block.position.set(x, y, z);
            scene.add(block);
            objects.push(block);
        }
    }

    document.body.addEventListener('click', () => controls.lock());
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    document.addEventListener('touchstart', (e) => player.handleTouch(e));
    document.addEventListener('touchmove', (e) => player.handleTouch(e));
    document.addEventListener('touchend', (e) => player.handleTouch(e));
}

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

function animate() {
    requestAnimationFrame(animate);
    const time = performance.now();
    const delta = (time - prevTime) / 1000;

    player.update(delta, scene);

    if (player.position.y < -50) {
        player.velocity.y = 0;
        player.position.set(0, 15, 0);
    }

    prevTime = time;
    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

init();
animate();

console.log("Minecraft Clone v1 initialized with textures and controls.");

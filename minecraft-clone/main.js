import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { createNoise2D } from 'https://cdn.jsdelivr.net/npm/simplex-noise/dist/esm/simplex-noise.js';

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

const objects = [];
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false, canJump = false;
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
}

const onKeyDown = (event) => {
    switch (event.code) {
        case 'KeyW': moveForward = true; break;
        case 'KeyA': moveLeft = true; break;
        case 'KeyS': moveBackward = true; break;
        case 'KeyD': moveRight = true; break;
        case 'Space': if (canJump) velocity.y += 12; canJump = false; break;
    }
};

const onKeyUp = (event) => {
    switch (event.code) {
        case 'KeyW': moveForward = false; break;
        case 'KeyA': moveLeft = false; break;
        case 'KeyS': moveBackward = false; break;
        case 'KeyD': moveRight = false; break;
    }
};

function animate() {
    requestAnimationFrame(animate);
    const time = performance.now();
    const delta = (time - prevTime) / 1000;

    if (controls.isLocked) {
        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;
        velocity.y -= 9.8 * 8.0 * delta;

        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize();

        if (moveForward || moveBackward) velocity.z -= direction.z * 50.0 * delta;
        if (moveLeft || moveRight) velocity.x -= direction.x * 50.0 * delta;

        const playerPosition = controls.getObject().position;
        const groundRaycaster = new THREE.Raycaster(playerPosition, new THREE.Vector3(0, -1, 0), 0, 1.1);
        const intersections = groundRaycaster.intersectObjects(objects);

        if (intersections.length > 0) {
            velocity.y = Math.max(0, velocity.y);
            canJump = true;
        }

        controls.moveRight(-velocity.x * delta);
        controls.moveForward(-velocity.z * delta);
        playerPosition.y += (velocity.y * delta);

        if (playerPosition.y < -50) {
            velocity.y = 0;
            playerPosition.set(0, 15, 0);
        }
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

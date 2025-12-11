export class InputManager {
    constructor(camera) {
        this.camera = camera;
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.keys = {};

        this.setupListeners();
    }

    setupListeners() {
        // Mouse Events
        window.addEventListener('mousedown', (e) => this.onMouseDown(e.clientX, e.clientY));
        window.addEventListener('mousemove', (e) => this.onMouseMove(e.clientX, e.clientY));
        window.addEventListener('mouseup', () => this.onMouseUp());

        // Touch Events
        window.addEventListener('touchstart', (e) => {
            if(e.touches.length === 1) {
                this.onMouseDown(e.touches[0].clientX, e.touches[0].clientY);
            }
        }, { passive: false });

        window.addEventListener('touchmove', (e) => {
            if(e.touches.length === 1) {
                this.onMouseMove(e.touches[0].clientX, e.touches[0].clientY);
            }
        }, { passive: false });

        window.addEventListener('touchend', () => this.onMouseUp());

        // Keyboard Events
        window.addEventListener('keydown', (e) => this.keys[e.code] = true);
        window.addEventListener('keyup', (e) => this.keys[e.code] = false);
    }

    onMouseDown(x, y) {
        this.isDragging = true;
        this.lastMouseX = x;
        this.lastMouseY = y;
    }

    onMouseMove(x, y) {
        if (!this.isDragging) return;

        const dx = x - this.lastMouseX;
        const dy = y - this.lastMouseY;

        // Move camera in opposite direction of drag
        this.camera.x -= dx / this.camera.scale;
        this.camera.y -= dy / this.camera.scale;

        this.lastMouseX = x;
        this.lastMouseY = y;
    }

    onMouseUp() {
        this.isDragging = false;
    }

    update(dt) {
        const speed = 500 * dt; // Pixels per second

        if (this.keys['KeyW'] || this.keys['ArrowUp']) this.camera.y -= speed;
        if (this.keys['KeyS'] || this.keys['ArrowDown']) this.camera.y += speed;
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) this.camera.x -= speed;
        if (this.keys['KeyD'] || this.keys['ArrowRight']) this.camera.x += speed;
    }
}

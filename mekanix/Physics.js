import Matter from 'matter-js';

export class Physics {
    constructor(elementId) {
        this.canvas = document.getElementById(elementId);
        this.engine = Matter.Engine.create();
        this.world = this.engine.world;

        // Create a custom renderer since we want to draw the "Merkur" style ourselves
        // but for now, we can use the built-in renderer for debugging or build our own loop.
        // The plan says "Create a custom renderer function".
        // So we won't use Matter.Render fully, but we might use it for debug initially?
        // Let's stick to the plan and build a custom loop using the canvas context.

        this.ctx = this.canvas.getContext('2d');
        this.runner = Matter.Runner.create();

        // Logical Resolution (9:16 aspect ratio)
        this.logicalWidth = 720;
        // Reserve space at bottom for UI in logical height if we want "Safe Area"?
        // Or just ensure game elements aren't placed there.
        this.logicalHeight = 1280;
        this.scaleFactor = 1;
        this.offsetX = 0;
        this.offsetY = 0;

        this.resize();

        window.addEventListener('resize', () => this.resize());
    }

    start() {
        Matter.Runner.run(this.runner, this.engine);
        this.loop();
    }

    stop() {
        Matter.Runner.stop(this.runner);
        cancelAnimationFrame(this.animationFrameId);
    }

    resize() {
        const winW = window.innerWidth;
        const winH = window.innerHeight;
        const winRatio = winW / winH;
        const targetRatio = this.logicalWidth / this.logicalHeight;

        // Fit containment
        if (winRatio > targetRatio) {
            // Window is wider than target (pillarbox)
            this.scaleFactor = winH / this.logicalHeight;
            this.offsetX = (winW - this.logicalWidth * this.scaleFactor) / 2;
            this.offsetY = 0;
        } else {
            // Window is taller than target (letterbox)
            this.scaleFactor = winW / this.logicalWidth;
            this.offsetX = 0;
            this.offsetY = (winH - this.logicalHeight * this.scaleFactor) / 2;
        }

        this.canvas.width = winW;
        this.canvas.height = winH;
    }

    // Helper to convert screen coordinates to logical world coordinates
    screenToWorld(screenX, screenY) {
        return {
            x: (screenX - this.offsetX) / this.scaleFactor,
            y: (screenY - this.offsetY) / this.scaleFactor
        };
    }

    loop() {
        this.animationFrameId = requestAnimationFrame(() => this.loop());

        // Clear canvas
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Render world (to be implemented)
        if (this.customRender) {
            this.customRender(this.ctx);
        }
    }

    clearWorld() {
        Matter.World.clear(this.world);
        Matter.Engine.clear(this.engine);
    }

    setRenderCallback(callback) {
        this.customRender = callback;
    }
}

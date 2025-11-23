import Matter from 'matter-js';

export class Physics {
    constructor(elementId) {
        this.canvas = document.getElementById(elementId);
        this.engine = Matter.Engine.create();

        // Increase iterations for stiffer constraints (fixes "gap" issue in joints)
        this.engine.positionIterations = 10;
        this.engine.velocityIterations = 10;

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

        // Camera System
        this.camera = { x: 0, y: 0, zoom: 1 };
        this.targetCamera = { x: 0, y: 0, zoom: 1 };

        this.resize();

        window.addEventListener('resize', () => this.resize());
    }

    start() {
        Matter.Runner.run(this.runner, this.engine);
        this.loop();
    }

    focusOn(bounds, padding = 100) {
        // bounds = { min: {x,y}, max: {x,y} }
        const w = bounds.max.x - bounds.min.x;
        const h = bounds.max.y - bounds.min.y;

        // Calculate center
        const centerX = (bounds.min.x + bounds.max.x) / 2;
        const centerY = (bounds.min.y + bounds.max.y) / 2;

        // Calculate zoom to fit (with padding)
        // We want (w + padding) * zoom <= logicalWidth
        // And (h + padding) * zoom <= logicalHeight

        // Actually, logicalWidth is 720.
        // If we select a small part (w=20, h=100), we want to zoom in.
        // But we want to keep "whole robot" visible? The user said:
        // "kdyz je to cast robota tak at zvetsi tak at je ale cely robot vDy na obrazovce"
        // "when it is a part of robot, zoom in such that it is bigger BUT the whole robot is ALWAYS on screen"

        // This is a bit contradictory or means "Zoom in as much as possible while keeping the whole robot visible".
        // Or "Zoom in to the part, but constrain the view so the robot doesn't go off screen".

        // A simple interpretation: Fit the WHOLE ROBOT on screen, but centered on the SELECTED PART?
        // Or just "Fit the Whole Robot".
        // If I select a small part, maybe I want to see details of THAT part.
        // If I zoom in too much on a leg, the head goes off screen.
        // The user says "whole robot ALWAYS on screen".
        // This implies the max zoom is limited by the robot size.

        // So: Target Zoom = Scale that fits the robot.
        // Target Center = Center of Robot.

        // But then selecting a specific part doesn't change the zoom/view much, unless the robot was small.
        // Maybe the user means: Zoom in somewhat, but clamp the camera so the robot isn't clipped?

        // Let's implement: "Focus on the provided bounds"
        // And the caller (Editor) will decide WHAT bounds to pass.
        // If Editor passes the Robot Bounds, we fit the robot.

        let zoomX = this.logicalWidth / (w + padding * 2);
        let zoomY = this.logicalHeight / (h + padding * 2);
        let targetZoom = Math.min(zoomX, zoomY);

        // Limit Max Zoom (don't zoom in to atomic level)
        targetZoom = Math.min(targetZoom, 2.5); // Max 2.5x zoom
        targetZoom = Math.max(targetZoom, 1.0); // Don't zoom OUT further than 1.0 (default view)

        // Center camera on the object
        // Camera (0,0) is usually top-left of logical space?
        // Let's define camera x,y as the displacement from logical origin (0,0).
        // Or better: camera x,y is the world point that should be at the CENTER of the screen.

        // Let's go with: camera x,y is the translation applied.
        // Standard transform: translate(offsetX, offsetY) scale(scaleFactor) scale(camera.zoom) translate(-camera.x + width/2/zoom, -camera.y + height/2/zoom)

        // Simpler:
        // Global Transform = WindowFit * CameraZoom * CameraPan
        // CameraPan: We want `centerX` to be at logical center (360, 640).
        // dx = 360 - centerX
        // dy = 640 - centerY

        // We will store the "Translation required to center the target"
        // Target Translation:
        // tx = (this.logicalWidth / 2) - centerX
        // ty = (this.logicalHeight / 2) - centerY

        // But we apply zoom around the center?
        // It's easier if `this.camera` stores `translation` (x,y) and `zoom`.

        // We want: World Point P -> Screen Point S
        // S = (P + T) * Z
        // S_center = (P_center + T) * Z
        // LogicalCenter = (P_center + T) * Z
        // P_center + T = LogicalCenter / Z
        // T = (LogicalCenter / Z) - P_center

        const logicalCX = this.logicalWidth / 2;
        const logicalCY = this.logicalHeight / 2;

        const tx = (logicalCX / targetZoom) - centerX;
        const ty = (logicalCY / targetZoom) - centerY;

        this.targetCamera = { x: tx, y: ty, zoom: targetZoom };
    }

    resetCamera() {
        this.targetCamera = { x: 0, y: 0, zoom: 1 };
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
        // Reverse transform
        // Screen -> Window Fit -> Camera

        // 1. Remove Window Fit
        let lx = (screenX - this.offsetX) / this.scaleFactor;
        let ly = (screenY - this.offsetY) / this.scaleFactor;

        // 2. Remove Camera Zoom
        lx /= this.camera.zoom;
        ly /= this.camera.zoom;

        // 3. Remove Camera Translation
        lx -= this.camera.x;
        ly -= this.camera.y;

        return { x: lx, y: ly };
    }

    updateCamera() {
        // Smooth Lerp
        const alpha = 0.1; // Smoothing factor
        this.camera.x += (this.targetCamera.x - this.camera.x) * alpha;
        this.camera.y += (this.targetCamera.y - this.camera.y) * alpha;
        this.camera.zoom += (this.targetCamera.zoom - this.camera.zoom) * alpha;

        // Stop small jitter
        if (Math.abs(this.targetCamera.x - this.camera.x) < 0.1) this.camera.x = this.targetCamera.x;
        if (Math.abs(this.targetCamera.y - this.camera.y) < 0.1) this.camera.y = this.targetCamera.y;
        if (Math.abs(this.targetCamera.zoom - this.camera.zoom) < 0.001) this.camera.zoom = this.targetCamera.zoom;
    }

    loop() {
        this.animationFrameId = requestAnimationFrame(() => this.loop());

        this.updateCamera();

        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

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

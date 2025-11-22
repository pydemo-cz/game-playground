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

        this.width = window.innerWidth;
        this.height = window.innerHeight;
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
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
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

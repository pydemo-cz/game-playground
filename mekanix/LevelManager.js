import Matter from 'matter-js';
import { Player } from './Player.js';
import { Goal } from './Goal.js';

export class LevelManager {
    constructor(physics, onLevelComplete) {
        this.physics = physics;
        this.onLevelComplete = onLevelComplete;
        this.currentLevelIndex = 0;
        this.levels = [
            this.level1.bind(this),
            this.level2.bind(this),
            this.level3.bind(this),
            this.level4.bind(this)
        ];
        this.currentEntities = []; // Keep track of walls/ground to remove them
        this.player = null;
        this.goal = null;
        this.isActive = false;
    }

    startLevel(index) {
        this.cleanup();
        if (index >= this.levels.length) {
            console.log("All levels complete!");
            index = 0; // Loop back
        }
        this.currentLevelIndex = index;
        this.levels[index]();

        // Update UI
        document.getElementById('current-level').innerText = index + 1;
        document.getElementById('overlay').classList.add('hidden');
        this.isActive = true;
    }

    cleanup() {
        // Remove everything from world
        Matter.World.clear(this.physics.world, false); // keep static? No, clear all
        // Re-add engine default constraint? Matter.js doesn't have one by default.
        // Actually, we need to be careful not to break the engine.
        // Matter.World.clear(world, keepStatic)

        Matter.World.clear(this.physics.world);
        Matter.Engine.clear(this.physics.engine); // Clears events too? No, just state.

        this.player = null;
        this.goal = null;
    }

    update(dt) {
        if (!this.isActive || !this.goal || !this.player) return;

        if (this.goal.update(dt, this.player.bodies)) {
            this.isActive = false;
            this.onLevelComplete();
        }
    }

    draw(ctx) {
        if (this.goal) this.goal.draw(ctx);
    }

    // Helpers
    createGround(x, y, w, h, angle = 0) {
        const body = Matter.Bodies.rectangle(x, y, w, h, {
            isStatic: true,
            angle: angle,
            render: { fillStyle: '#222' }
        });
        Matter.World.add(this.physics.world, body);
        return body;
    }

    // --- Levels ---

    level1() {
        // Flat ground, target to the right
        const w = window.innerWidth;
        const h = window.innerHeight;

        this.createGround(w/2, h - 20, w, 40);
        this.createGround(0, h/2, 40, h); // Left wall
        this.createGround(w, h/2, 40, h); // Right wall

        this.player = new Player(w/4, h - 100, 'V');
        this.player.addToWorld(this.physics.world);

        this.goal = new Goal(w * 0.75, h - 100, 40);
    }

    level2() {
        // Gap
        const w = window.innerWidth;
        const h = window.innerHeight;

        // Left platform
        this.createGround(w/4, h - 20, w/2 - 50, 40);
        // Right platform
        this.createGround(w * 0.75, h - 20, w/2 - 50, 40);

        this.player = new Player(w/4, h - 100, 'V');
        this.player.addToWorld(this.physics.world);

        this.goal = new Goal(w * 0.8, h - 100, 40);
    }

    level3() {
        // Steps
        const w = window.innerWidth;
        const h = window.innerHeight;

        this.createGround(w/2, h - 20, w, 40); // Base
        this.createGround(w/2, h - 100, 200, 20); // Step 1
        this.createGround(w * 0.8, h - 200, 200, 20); // Step 2

        this.player = new Player(w/4, h - 100, 'L'); // Try L shape
        this.player.addToWorld(this.physics.world);

        this.goal = new Goal(w * 0.8, h - 250, 40);
    }

    level4() {
        // Balance / Slope
        const w = window.innerWidth;
        const h = window.innerHeight;

        this.createGround(w/2, h-10, w, 20);

        // A see-saw or slope?
        // Slope
        this.createGround(w/2, h/2, 600, 20, Math.PI / 12); // 15 deg

        this.player = new Player(w/4, h/2 - 100, 'V');
        this.player.addToWorld(this.physics.world);

        this.goal = new Goal(w * 0.8, h/2 + 50, 40);
    }
}

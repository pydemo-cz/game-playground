import Matter from 'matter-js';
import { Player } from './Player.js';
import { Goal } from './Goal.js';
import { DEFAULT_LEVEL } from './LevelData.js';

export class LevelManager {
    constructor(physics, onLevelComplete) {
        this.physics = physics;
        this.onLevelComplete = onLevelComplete;
        this.currentLevelData = null;

        // We still keep legacy levels for now if needed, but primarily we work with JSON data
        this.player = null;
        this.goal = null;
        this.platforms = []; // Track platform bodies
        this.isActive = false;
    }

    loadLevel(levelData) {
        this.cleanup();
        this.currentLevelData = JSON.parse(JSON.stringify(levelData)); // Deep copy

        // 1. Create Platforms
        if (this.currentLevelData.platforms) {
            for (let p of this.currentLevelData.platforms) {
                this.createPlatform(p);
            }
        }

        // 2. Create Goal
        if (this.currentLevelData.goal) {
            this.goal = new Goal(this.currentLevelData.goal.x, this.currentLevelData.goal.y, this.currentLevelData.goal.radius);
        }

        // 3. Create Player
        if (this.currentLevelData.player) {
             const start = this.currentLevelData.player.startPos;
             // If we have parts/constraints data, use it. Otherwise fallback to 'V' (legacy/default)
             if (this.currentLevelData.player.parts && this.currentLevelData.player.constraints) {
                 this.player = new Player(start.x, start.y, this.currentLevelData.player);
             } else {
                 this.player = new Player(start.x, start.y, 'V');
             }
             this.player.addToWorld(this.physics.world);
        }

        this.isActive = true;
        document.getElementById('overlay').classList.add('hidden');
    }

    resetLevel() {
        if (this.currentLevelData) {
            this.loadLevel(this.currentLevelData);
        } else {
            this.loadLevel(DEFAULT_LEVEL);
        }
    }

    cleanup() {
        Matter.World.clear(this.physics.world);
        Matter.Engine.clear(this.physics.engine);
        this.player = null;
        this.goal = null;
        this.platforms = [];
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

    createPlatform(data) {
        const body = Matter.Bodies.rectangle(data.x, data.y, data.w, data.h, {
            isStatic: true,
            angle: data.angle || 0,
            render: { fillStyle: '#222' }
        });
        // Store reference to data for editor
        body._editorData = data;

        Matter.World.add(this.physics.world, body);
        this.platforms.push(body);
        return body;
    }

    exportLevel() {
        // Update currentLevelData from live objects (in case they moved in editor)
        // Goal
        if (this.goal) {
            this.currentLevelData.goal.x = this.goal.x;
            this.currentLevelData.goal.y = this.goal.y;
        }

        // Platforms
        // We need to map bodies back to data.
        // Since we stored _editorData on body, we can update it.
        this.currentLevelData.platforms = this.platforms.map(body => {
            return {
                x: body.position.x,
                y: body.position.y,
                w: body._editorData.w, // Dimensions don't change easily in Matter.js (need scaling)
                h: body._editorData.h,
                angle: body.angle,
                type: "static"
            };
        });

        // Player
        if (this.player) {
            const playerData = this.player.exportData();
            if (playerData) {
                this.currentLevelData.player = playerData;
            }
        }

        return this.currentLevelData;
    }
}

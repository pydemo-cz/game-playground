import Matter from 'matter-js';

export class Editor {
    constructor(gameManager) {
        this.gm = gameManager;
        this.physics = gameManager.physics;
        this.levelManager = gameManager.levelManager;

        this.selectedEntity = null; // { type: 'platform'|'goal', object: Body/Goal }
        this.dragStart = null;
        this.initialObjState = null;

        // Gizmo handles
        this.gizmoRadius = 15;
        this.activeHandle = null; // 'move' | 'rotate' | 'resize'
        this.resizeHandleIndex = -1; // 0: TL, 1: TR, 2: BR, 3: BL

        // Inputs
        this.handleInput = this.handleInput.bind(this);
    }

    onEnter() {
        // Add event listeners for editor interaction
        // We reuse the same canvas, so we need to be careful not to conflict with game inputs
        // But in Edit Mode, game inputs (Player contract) are disabled by GameManager.
        this.setupInputs();
    }

    onExit() {
        this.removeInputs();
        this.selectedEntity = null;
    }

    setupInputs() {
        const canvas = this.physics.canvas;
        canvas.addEventListener('mousedown', this.handleInput);
        canvas.addEventListener('mousemove', this.handleInput);
        canvas.addEventListener('mouseup', this.handleInput);

        canvas.addEventListener('touchstart', this.handleInput, { passive: false });
        canvas.addEventListener('touchmove', this.handleInput, { passive: false });
        canvas.addEventListener('touchend', this.handleInput);
    }

    removeInputs() {
        const canvas = this.physics.canvas;
        canvas.removeEventListener('mousedown', this.handleInput);
        canvas.removeEventListener('mousemove', this.handleInput);
        canvas.removeEventListener('mouseup', this.handleInput);

        canvas.removeEventListener('touchstart', this.handleInput);
        canvas.removeEventListener('touchmove', this.handleInput);
        canvas.removeEventListener('touchend', this.handleInput);
    }

    handleInput(e) {
        e.preventDefault();
        const type = e.type;
        let x, y;

        if (type.startsWith('touch')) {
            const touch = e.changedTouches[0];
            x = touch.clientX;
            y = touch.clientY;
        } else {
            x = e.clientX;
            y = e.clientY;
        }

        // Convert to World Coordinates
        const worldPos = this.physics.screenToWorld(x, y);

        if (type === 'mousedown' || type === 'touchstart') {
            this.onDown(worldPos);
        } else if (type === 'mousemove' || type === 'touchmove') {
            this.onMove(worldPos);
        } else if (type === 'mouseup' || type === 'touchend') {
            this.onUp();
        }
    }

    onDown(pos) {
        // 1. Check Gizmo Handles (if selection exists)
        if (this.selectedEntity) {
            if (this.checkGizmoHit(pos)) {
                return; // Handled by gizmo
            }
        }

        // 2. Raycast / Hit Test for Objects
        this.activeHandle = null;
        this.selectedEntity = this.hitTest(pos);

        if (this.selectedEntity) {
            this.dragStart = pos;
            // Store initial state for relative movement
            if (this.selectedEntity.type === 'platform') {
                this.initialObjState = {
                    x: this.selectedEntity.object.position.x,
                    y: this.selectedEntity.object.position.y,
                    angle: this.selectedEntity.object.angle
                };
                this.activeHandle = 'move'; // Default to move body on click
            } else if (this.selectedEntity.type === 'goal') {
                this.initialObjState = {
                    x: this.selectedEntity.object.x,
                    y: this.selectedEntity.object.y
                };
                 this.activeHandle = 'move';
            }
        }
    }

    onMove(pos) {
        if (!this.selectedEntity || !this.dragStart) return;

        const dx = pos.x - this.dragStart.x;
        const dy = pos.y - this.dragStart.y;

        if (this.activeHandle === 'move') {
            if (this.selectedEntity.type === 'platform') {
                Matter.Body.setPosition(this.selectedEntity.object, {
                    x: this.initialObjState.x + dx,
                    y: this.initialObjState.y + dy
                });
            } else if (this.selectedEntity.type === 'goal') {
                this.selectedEntity.object.x = this.initialObjState.x + dx;
                this.selectedEntity.object.y = this.initialObjState.y + dy;
            }
        } else if (this.activeHandle === 'rotate' && this.selectedEntity.type === 'platform') {
             const center = this.selectedEntity.object.position;
             const startAngle = Math.atan2(this.dragStart.y - center.y, this.dragStart.x - center.x);
             const currentAngle = Math.atan2(pos.y - center.y, pos.x - center.x);
             const dAngle = currentAngle - startAngle;
             Matter.Body.setAngle(this.selectedEntity.object, this.initialObjState.angle + dAngle);
        } else if (this.activeHandle === 'resize' && this.selectedEntity.type === 'platform') {
            // Simple resizing logic: symmetric or from center?
            // Let's do symmetric resizing (width/height change) based on distance from center
            // Actually, dragging a corner usually changes dimensions.
            // We can project the mouse pos onto the local axes of the body.

            const body = this.selectedEntity.object;
            const angle = body.angle;
            const cos = Math.cos(-angle);
            const sin = Math.sin(-angle);

            // Vector from center to mouse
            const dxLocal = (pos.x - body.position.x) * cos - (pos.y - body.position.y) * sin;
            const dyLocal = (pos.x - body.position.x) * sin + (pos.y - body.position.y) * cos;

            // Determine new Width/Height based on which handle was grabbed?
            // Or just assume we are dragging "outwards".
            // If handle was TR (positive x, negative y), then w = abs(dxLocal)*2, h = abs(dyLocal)*2

            let newW = Math.abs(dxLocal) * 2;
            let newH = Math.abs(dyLocal) * 2;

            // Clamps
            newW = Math.max(20, newW);
            newH = Math.max(20, newH);

            // Update logic: Matter.js doesn't support arbitrary resizing of rectangles easily without scaling.
            // Scaling is cumulative. Better to re-create the body or set vertices.
            // But replacing the body breaks references in the world?
            // LevelManager stores body in this.platforms. We can update it there.
            // But Editor holds reference too.

            // Matter.Body.setVertices is hard for rectangles (need to calculate vertices).
            // Easier: update _editorData dimensions, remove old body, add new body, update selection.

            // Optimization: Don't re-create every frame.
            // Just update visualization or use scale?
            // Body.scale(scaleX, scaleY) scales from current size.
            // So we need relative scale.

            const scaleX = newW / body._editorData.w;
            const scaleY = newH / body._editorData.h;

            Matter.Body.scale(body, scaleX, scaleY);

            // Update stored dims to avoid drift
            body._editorData.w = newW;
            body._editorData.h = newH;
        }
    }

    onUp() {
        this.dragStart = null;
        this.activeHandle = null;
    }

    hitTest(pos) {
        // Check Goal
        const goal = this.levelManager.goal;
        if (goal) {
            const d = Math.hypot(goal.x - pos.x, goal.y - pos.y);
            if (d < goal.radius) return { type: 'goal', object: goal };
        }

        // Check Player Parts
        if (this.levelManager.player) {
            const playerBodies = this.levelManager.player.bodies;
            const hitPlayer = Matter.Query.point(playerBodies, pos)[0];
            if (hitPlayer) {
                return { type: 'player_part', object: hitPlayer };
            }
        }

        // Check Platforms
        const bodies = this.levelManager.platforms;
        const hit = Matter.Query.point(bodies, pos)[0];
        if (hit) {
            return { type: 'platform', object: hit };
        }

        return null;
    }

    checkGizmoHit(pos) {
        if (!this.selectedEntity || this.selectedEntity.type !== 'platform') return false;

        const body = this.selectedEntity.object;
        const angle = body.angle;
        const w = body._editorData.w;
        const h = body._editorData.h;

        // 1. Check Rotation Handle
        const rHandleDist = w/2 + 30;
        const rotateHandlePos = {
            x: body.position.x + Math.cos(angle) * rHandleDist,
            y: body.position.y + Math.sin(angle) * rHandleDist
        };

        if (Math.hypot(rotateHandlePos.x - pos.x, rotateHandlePos.y - pos.y) < 20) {
            this.activeHandle = 'rotate';
            this.dragStart = pos;
            this.initialObjState = { x: body.position.x, y: body.position.y, angle: body.angle };
            return true;
        }

        // 2. Check Resize Handles (4 corners)
        // Calculate corner positions in world space
        const corners = [
            { x: -w/2, y: -h/2 }, // TL
            { x: w/2, y: -h/2 },  // TR
            { x: w/2, y: h/2 },   // BR
            { x: -w/2, y: h/2 }   // BL
        ];

        for (let i = 0; i < 4; i++) {
            const c = corners[i];
            // Rotate and translate
            const wx = body.position.x + c.x * Math.cos(angle) - c.y * Math.sin(angle);
            const wy = body.position.y + c.x * Math.sin(angle) + c.y * Math.cos(angle);

            if (Math.hypot(wx - pos.x, wy - pos.y) < 15) {
                this.activeHandle = 'resize';
                this.resizeHandleIndex = i;
                this.dragStart = pos;
                // Store initial state isn't strictly needed if we scale incrementally,
                // but safer for future drift correction if we rewrite it.
                return true;
            }
        }

        return false;
    }

    update(dt) {
        // Nothing real-time needed unless animating gizmos
    }

    draw(ctx) {
        // Draw selection highlights
        if (this.selectedEntity) {
            const obj = this.selectedEntity.object;

            ctx.save();

            if (this.selectedEntity.type === 'platform') {
                ctx.translate(obj.position.x, obj.position.y);
                ctx.rotate(obj.angle);

                // Bounding box
                ctx.strokeStyle = '#3498db';
                ctx.lineWidth = 2;
                // We use stored dims because body.bounds is AABB
                const w = obj._editorData.w;
                const h = obj._editorData.h;
                ctx.strokeRect(-w/2 - 5, -h/2 - 5, w + 10, h + 10);

                // Rotation Handle
                ctx.beginPath();
                ctx.moveTo(w/2 + 5, 0);
                ctx.lineTo(w/2 + 30, 0);
                ctx.stroke();

                ctx.fillStyle = '#e67e22';
                ctx.beginPath();
                ctx.arc(w/2 + 30, 0, 8, 0, Math.PI * 2);
                ctx.fill();

                // Resize Handles
                ctx.fillStyle = '#3498db';
                const handles = [
                    { x: -w/2, y: -h/2 },
                    { x: w/2, y: -h/2 },
                    { x: w/2, y: h/2 },
                    { x: -w/2, y: h/2 }
                ];
                for(let hPos of handles) {
                    ctx.fillRect(hPos.x - 6, hPos.y - 6, 12, 12);
                }

            } else if (this.selectedEntity.type === 'goal') {
                ctx.strokeStyle = '#3498db';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(obj.x, obj.y, obj.radius + 5, 0, Math.PI*2);
                ctx.stroke();
            }

            ctx.restore();
        }
    }

    // Actions
    addPlatform() {
        // Add to center of view
        const center = { x: this.physics.logicalWidth/2, y: this.physics.logicalHeight/2 };
        this.levelManager.createPlatform({
            x: center.x,
            y: center.y,
            w: 200,
            h: 40,
            angle: 0
        });
    }

    addConnectedPart() {
        if (!this.selectedEntity || this.selectedEntity.type !== 'player_part') {
            alert("Select a robot part first!");
            return;
        }

        // This logic ideally belongs in Player.js or LevelManager, but Editor orchestrates it.
        // We need to add a new body and a constraint connecting to the selected body.
        const parentBody = this.selectedEntity.object;
        const player = this.levelManager.player;

        // Create new part
        // Position it slightly offset
        const newW = 20;
        const newH = 100;
        const x = parentBody.position.x + 20;
        const y = parentBody.position.y + 20;

        const newBody = Matter.Bodies.rectangle(x, y, newW, newH, {
            collisionFilter: parentBody.collisionFilter, // Same group
            chamfer: { radius: 5 },
            density: 0.01,
            friction: 1.0
        });
        newBody._editorData = { x: 0, y: 0, w: newW, h: newH }; // Simplified data tracking

        // Add Constraint (Pivot)
        const pivot = Matter.Constraint.create({
            bodyA: parentBody,
            bodyB: newBody,
            pointA: { x: 0, y: parentBody._editorData.h/2 - 10 }, // End of parent
            pointB: { x: 0, y: -newH/2 + 10 }, // Start of new
            stiffness: 1,
            length: 0
        });

        // Add Muscle?
        // For now just passive joint or default muscle?
        // Let's add a default muscle
        const muscle = Matter.Constraint.create({
            bodyA: parentBody,
            bodyB: newBody,
            pointA: { x: 0, y: 0 },
            pointB: { x: 0, y: 0 },
            stiffness: 0.1,
            damping: 0.05,
            length: 100
        });
        player.muscles.push({ constraint: muscle, relaxedLength: 100, contractedLength: 50 });

        // Register with Player
        player.bodies.push(newBody);
        player.constraints.push(pivot, muscle);
        Matter.Composite.add(player.composite, [newBody, pivot, muscle]);

        // We need to ensure LevelManager.exportLevel() can handle this new structure.
        // Currently exportLevel only handles platforms/goal.
        // Player export is needed.
    }
}

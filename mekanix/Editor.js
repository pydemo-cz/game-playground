import Matter from 'matter-js';

export class Editor {
    constructor(gameManager) {
        this.gm = gameManager;
        this.physics = gameManager.physics;
        this.levelManager = gameManager.levelManager;

        this.selectedEntity = null; // { type: 'platform'|'goal', object: Body/Goal }
        this.dragStart = null;
        this.initialObjState = null;
        this.pendingAttachment = false; // If true, waiting for click on body to attach

        // Gizmo handles
        this.gizmoRadius = 15;
        this.activeHandle = null; // 'move' | 'rotate' | 'resize'
        this.resizeHandleIndex = -1; // 0: TL, 1: TR, 2: BR, 3: BL

        // Inputs
        this.handleInput = this.handleInput.bind(this);
    }

    onEnter() {
        this.setupInputs();
    }

    onExit() {
        this.removeInputs();
        this.selectEntity(null);
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
        if (this.selectedEntity && !this.pendingAttachment) {
            if (this.checkGizmoHit(pos)) {
                return; // Handled by gizmo
            }
        }

        // 2. Raycast / Hit Test for Objects
        this.activeHandle = null;
        const hit = this.hitTest(pos);

        // If pending attachment, check if we hit a valid parent
        if (this.pendingAttachment) {
            if (hit && hit.type === 'player_part') {
                this.createPartAt(hit.object, pos);
                this.pendingAttachment = false;
                document.body.style.cursor = 'default';
                return;
            } else {
                // Cancel if clicked elsewhere? Or just ignore?
                // Let's cancel if clicked on empty space
                if (!hit) {
                    this.pendingAttachment = false;
                    document.body.style.cursor = 'default';
                }
            }
        }

        this.selectEntity(hit);

        if (this.selectedEntity) {
            this.dragStart = pos;
            this._lastMoveX = pos.x;
            this._lastMoveY = pos.y;

            // Store initial state for relative movement
            if (this.selectedEntity.type === 'platform') {
                this.initialObjState = {
                    x: this.selectedEntity.object.position.x,
                    y: this.selectedEntity.object.position.y,
                    angle: this.selectedEntity.object.angle,
                    w: this.selectedEntity.object._editorData.w,
                    h: this.selectedEntity.object._editorData.h
                };
                this.activeHandle = 'move'; // Default to move body on click
            } else if (this.selectedEntity.type === 'goal') {
                this.initialObjState = {
                    x: this.selectedEntity.object.x,
                    y: this.selectedEntity.object.y
                };
                 this.activeHandle = 'move';
            } else if (this.selectedEntity.type === 'player_part') {
                 this.activeHandle = 'move';
                 // Also enable gizmos for player parts
                 this.initialObjState = {
                    x: this.selectedEntity.object.position.x,
                    y: this.selectedEntity.object.position.y,
                    angle: this.selectedEntity.object.angle,
                    w: this.selectedEntity.object._editorData.w,
                    h: this.selectedEntity.object._editorData.h
                };
            } else if (this.selectedEntity.type === 'joint') {
                // No gizmo for joint move (yet), maybe stiffness drag?
            }
        }
    }

    selectEntity(entity) {
        this.selectedEntity = entity;
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
            } else if (this.selectedEntity.type === 'player_part') {
                 // Move the whole robot
                 const lastX = this._lastMoveX || this.dragStart.x;
                 const lastY = this._lastMoveY || this.dragStart.y;

                 const stepDx = pos.x - lastX;
                 const stepDy = pos.y - lastY;

                 const playerBodies = this.levelManager.player.bodies;
                 for (let b of playerBodies) {
                     Matter.Body.translate(b, { x: stepDx, y: stepDy });
                 }

                 this._lastMoveX = pos.x;
                 this._lastMoveY = pos.y;
            }
        } else if (this.selectedEntity.type === 'joint') {
            // Joint Stiffness Editing (Drag Up/Down or Radial?)
            // Let's do radial or distance from center
            const c = this.selectedEntity.object;
            const pA = Matter.Constraint.pointAWorld(c);

            // Angle from center
            // let angle = Math.atan2(pos.y - pA.y, pos.x - pA.x);
            // Normalize angle to 0-1 range?

            // Simpler: Distance from center controls nothing, angle controls value?
            // Or just Y-axis drag like a fader.

            // Let's use angle mapping to 0-1 (0 to 2PI -> 0 to 1)
            // Or simple distance check? No.

            // Let's try: Click and drag. Angle determines value.
            // -PI/2 (Top) = 0, 3PI/2 (Top again) = 1

            let angle = Math.atan2(pos.y - pA.y, pos.x - pA.x);
            // Rotate so -PI/2 is 0
            angle += Math.PI/2;
            if (angle < 0) angle += Math.PI * 2;

            let stiffness = angle / (Math.PI * 2);
            stiffness = Math.max(0.01, Math.min(1, stiffness));

            c.stiffness = stiffness;

        } else if (this.activeHandle === 'rotate' && this.selectedEntity.type === 'platform') {
             const center = this.selectedEntity.object.position;
             const startAngle = Math.atan2(this.dragStart.y - center.y, this.dragStart.x - center.x);
             const currentAngle = Math.atan2(pos.y - center.y, pos.x - center.x);
             const dAngle = currentAngle - startAngle;
             Matter.Body.setAngle(this.selectedEntity.object, this.initialObjState.angle + dAngle);
        } else if (this.activeHandle === 'resize' && (this.selectedEntity.type === 'platform' || this.selectedEntity.type === 'player_part')) {
            const body = this.selectedEntity.object;
            const angle = body.angle;
            const cos = Math.cos(-angle);
            const sin = Math.sin(-angle);

            // Vector from center to mouse
            const dxLocal = (pos.x - body.position.x) * cos - (pos.y - body.position.y) * sin;
            const dyLocal = (pos.x - body.position.x) * sin + (pos.y - body.position.y) * cos;

            // Determine new Width/Height based on distance from center * 2 (symmetric resize)
            let newW = Math.abs(dxLocal) * 2;
            let newH = Math.abs(dyLocal) * 2;

            // Clamps
            newW = Math.max(20, newW);
            newH = Math.max(20, newH);

            const oldW = body._editorData.w;
            const oldH = body._editorData.h;

            // Only update if size actually changed significantly to avoid jitter
            if (Math.abs(newW - oldW) < 0.5 && Math.abs(newH - oldH) < 0.5) return;

            // Robust Resizing using setVertices
            const currentAngle = body.angle;

            // Generate new vertices (optionally with chamfer)
            const chamferRadius = (this.selectedEntity.type === 'player_part') ? 5 : 0;
            // Create a temporary body to get the correct vertices
            const dummy = Matter.Bodies.rectangle(0, 0, newW, newH, { chamfer: { radius: chamferRadius } });

            // Set vertices (must reset angle to 0 for correct axis alignment, then restore)
            Matter.Body.setAngle(body, 0);
            Matter.Body.setVertices(body, dummy.vertices);
            Matter.Body.setAngle(body, currentAngle);

            // Update stored dims
            body._editorData.w = newW;
            body._editorData.h = newH;

            if (this.selectedEntity.type === 'player_part') {
                this.updateConnectedConstraints(body, oldW, oldH, newW, newH);
            }
        }
    }

    updateConnectedConstraints(body, oldW, oldH, newW, newH) {
        const player = this.levelManager.player;
        if (!player) return;

        // Find constraints connected to this body
        const connected = player.constraints.filter(c => c.bodyA === body || c.bodyB === body);

        connected.forEach(c => {
            const point = (c.bodyA === body) ? c.pointA : c.pointB;
            // point is local.
            // Check if point is at Top/Bottom/Left/Right edge
            // Allowing some tolerance for float errors

            // Check Y (Top/Bottom)
            if (Math.abs(Math.abs(point.y) - oldH/2) < 1) {
                // It was at the edge. Update to new edge.
                point.y = Math.sign(point.y) * (newH/2);
            }

            // Check X (Left/Right) - less likely for strips but possible
            if (Math.abs(Math.abs(point.x) - oldW/2) < 1) {
                 point.x = Math.sign(point.x) * (newW/2);
            }
        });
    }

    onUp() {
        this.dragStart = null;
        this.activeHandle = null;
        this._lastMoveX = null;
        this._lastMoveY = null;
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
            // Check Joints (Constraints) first
            const playerConstraints = this.levelManager.player.constraints;
            for (let c of playerConstraints) {
                // Only check pivot types (length 0 usually) or if rendered
                if (c.length > 0 && c.label !== 'Muscle') continue; // Skip muscles if we only want joints?
                // Actually pivot joints have length 0.

                const pA = Matter.Constraint.pointAWorld(c);
                const d = Math.hypot(pA.x - pos.x, pA.y - pos.y);
                if (d < 15) { // 15px radius for joint
                     return { type: 'joint', object: c };
                }
            }

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
        if (!this.selectedEntity) return false;
        // Only platforms and player parts have gizmos
        if (this.selectedEntity.type !== 'platform' && this.selectedEntity.type !== 'player_part') return false;

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

            // Shared Gizmo drawing logic for things with _editorData (Platform & Player Part)
            if (this.selectedEntity.type === 'platform' || this.selectedEntity.type === 'player_part') {
                ctx.translate(obj.position.x, obj.position.y);
                ctx.rotate(obj.angle);

                // Bounding box
                ctx.strokeStyle = (this.selectedEntity.type === 'player_part') ? '#e74c3c' : '#3498db';
                ctx.lineWidth = 2;

                const w = obj._editorData ? obj._editorData.w : 20;
                const h = obj._editorData ? obj._editorData.h : 100;

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
                ctx.fillStyle = (this.selectedEntity.type === 'player_part') ? '#e74c3c' : '#3498db';
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
            } else if (this.selectedEntity.type === 'joint') {
                const c = this.selectedEntity.object;
                const pA = Matter.Constraint.pointAWorld(c);

                ctx.strokeStyle = '#f1c40f';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(pA.x, pA.y, 12, 0, Math.PI * 2);
                ctx.stroke();

                // Drag Handle for Stiffness (Visual Slider)
                const radius = 30;
                ctx.beginPath();
                ctx.arc(pA.x, pA.y, radius, -Math.PI/2, -Math.PI/2 + c.stiffness * Math.PI * 2);
                ctx.strokeStyle = `rgba(241, 196, 15, 0.5)`;
                ctx.lineWidth = 6;
                ctx.stroke();

                ctx.fillStyle = '#333';
                ctx.font = '12px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(`Stiffness: ${c.stiffness.toFixed(2)}`, pA.x, pA.y - radius - 10);
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
        // Enter "Pick Place" mode
        this.pendingAttachment = true;
        this.selectEntity(null);
        document.body.style.cursor = 'crosshair';
        // Optional: Show toast or message "Select a point on a robot part"
    }

    createPartAt(parentBody, worldPos) {
        const player = this.levelManager.player;

        const newW = 20;
        const newH = 100;

        // 1. Calculate Local Anchor Point on Parent
        // Inverse transform: (world - pos) rotated by -angle
        const angle = parentBody.angle;
        const dx = worldPos.x - parentBody.position.x;
        const dy = worldPos.y - parentBody.position.y;

        const cos = Math.cos(-angle);
        const sin = Math.sin(-angle);

        const localX = dx * cos - dy * sin;
        const localY = dx * sin + dy * cos;

        // 2. Create New Body
        // Position it so that its "Top" (or one end) is at the anchor point.
        // Let's say we attach the new part's "Top" (local y = -newH/2 + 10) to this anchor.
        // We need to calculate the World Position of the new body center.

        // New Body Angle: Let's match parent angle initially? Or random? Match parent is safer.
        // If matched, then we just translate along the body's axis.

        // anchorWorld = parentPos + rotate(localAnchor)
        // newBodyPos = anchorWorld - rotate(newBodyLocalAnchor)

        const newBodyLocalAnchorY = -newH/2 + 10; // Top with slight offset
        const newBodyLocalAnchorX = 0;

        // Vector from New Body Center to Anchor (in new body local space) is (0, -newH/2+10).
        // So Vector from Anchor to New Body Center is (0, newH/2-10).

        // Rotate this offset by parent angle (since new body matches angle)
        const offsetDist = (newH/2 - 10);
        const offsetWorldX = -Math.sin(angle) * offsetDist; // assuming standard upright 0 angle
        const offsetWorldY = Math.cos(angle) * offsetDist;
        // Wait, verify rotation again.
        // If angle=0 (upright), cos=1, sin=0. Y increases downwards.
        // localY positive is down.
        // Vector (0, dist). Rotated by 0 is (0, dist).
        // worldY = anchorY + dist. Correct.

        // anchorWorld is worldPos.
        const newWorldX = worldPos.x - Math.sin(angle) * 0 + Math.sin(angle) * offsetDist; // wait, this rotation math is tricky without helper
        // Let's use Matter.Vector.rotate

        const offset = Matter.Vector.rotate({ x: 0, y: offsetDist }, angle);

        const newBody = Matter.Bodies.rectangle(
            worldPos.x + offset.x,
            worldPos.y + offset.y,
            newW, newH, {
            collisionFilter: parentBody.collisionFilter,
            chamfer: { radius: 5 },
            density: 0.01,
            friction: 1.0,
            angle: angle
        });
        newBody._editorData = { w: newW, h: newH };

        // 3. Create Constraints
        const pivot = Matter.Constraint.create({
            bodyA: parentBody,
            bodyB: newBody,
            pointA: { x: localX, y: localY },
            pointB: { x: 0, y: newBodyLocalAnchorY },
            stiffness: 1,
            length: 0,
            render: { visible: true }
        });

        // Muscle (midpoint to midpoint)
        // Default muscle length = distance between centers? No, usually we want some slack or specific logic.
        // Let's just use fixed length for now, or distance.
        // Centers distance:
        const dist = Matter.Vector.magnitude(Matter.Vector.sub(newBody.position, parentBody.position));

        const muscle = Matter.Constraint.create({
            bodyA: parentBody,
            bodyB: newBody,
            pointA: { x: 0, y: 0 },
            pointB: { x: 0, y: 0 },
            stiffness: 0.1,
            damping: 0.05,
            length: dist
        });

        player.muscles.push({ constraint: muscle, relaxedLength: dist, contractedLength: dist * 0.5 });
        player.bodies.push(newBody);
        player.constraints.push(pivot, muscle);
        Matter.Composite.add(player.composite, [newBody, pivot, muscle]);
    }

    deleteSelected() {
        if (!this.selectedEntity) return;

        const player = this.levelManager.player;

        if (this.selectedEntity.type === 'joint') {
            const c = this.selectedEntity.object;
            Matter.Composite.remove(player.composite, c);

            const idxC = player.constraints.indexOf(c);
            if (idxC > -1) player.constraints.splice(idxC, 1);

            const idxM = player.muscles.findIndex(m => m.constraint === c);
            if (idxM > -1) player.muscles.splice(idxM, 1);

            this.selectEntity(null);
            return;
        }

        if (this.selectedEntity.type === 'player_part') {
            // Check minimum parts
            if (player.bodies.length <= 2) {
                alert("Robot must have at least 2 parts!");
                return;
            }

            const body = this.selectedEntity.object;

            // 1. Remove Constraints connected to this body
            const constraintsToRemove = player.constraints.filter(c => c.bodyA === body || c.bodyB === body);
            constraintsToRemove.forEach(c => {
                Matter.Composite.remove(player.composite, c);
                // Remove from player arrays
                const idxC = player.constraints.indexOf(c);
                if (idxC > -1) player.constraints.splice(idxC, 1);

                // Remove from muscles
                const idxM = player.muscles.findIndex(m => m.constraint === c);
                if (idxM > -1) player.muscles.splice(idxM, 1);
            });

            // 2. Remove Body
            Matter.Composite.remove(player.composite, body);
            const idxB = player.bodies.indexOf(body);
            if (idxB > -1) player.bodies.splice(idxB, 1);

            this.selectEntity(null);
        }
    }
}

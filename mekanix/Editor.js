import Matter from 'matter-js';
import { getHolePositions } from './Renderer.js';

export class Editor {
    constructor(gameManager) {
        this.gm = gameManager;
        this.physics = gameManager.physics;
        this.levelManager = gameManager.levelManager;

        this.selectedEntity = null;
        this.dragStart = null;
        this.initialObjState = null;
        this.activeGizmos = [];

        this.activeHandle = null;
        this.resizeHandleIndex = -1;

        this.systemMenu = document.getElementById('system-menu');
        this.menuBtn = document.getElementById('menu-btn');
        this.restartBtn = document.getElementById('restart-btn');
        this.isSystemMenuOpen = false;

        this.menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleSystemMenu();
        });

        this.restartBtn.addEventListener('click', () => {
            this.levelManager.resetLevel();
        });

        document.getElementById('menu-reset').addEventListener('click', () => {
            this.levelManager.resetLevel();
            this.closeSystemMenu();
        });
        document.getElementById('menu-save').addEventListener('click', () => {
            const data = this.levelManager.exportLevel();
            localStorage.setItem('mekanix_saved_level', JSON.stringify(data));
            alert('Level Saved!');
            this.closeSystemMenu();
        });
        document.getElementById('menu-load').addEventListener('click', () => {
            const json = localStorage.getItem('mekanix_saved_level');
            if (json) {
                const data = JSON.parse(json);
                this.levelManager.loadLevel(data);
                this.gm.workingLevelData = data;
            } else {
                alert('No saved level found.');
            }
            this.closeSystemMenu();
        });

        this.modeBtn = document.getElementById('mode-toggle');
        this.modeBtn.addEventListener('click', () => {
             this.gm.toggleMode();
             this.updateModeBtn();
        });

        this.handleInput = this.handleInput.bind(this);

        document.addEventListener('click', (e) => {
            if (this.isSystemMenuOpen && !this.systemMenu.contains(e.target) && e.target !== this.menuBtn) {
                this.closeSystemMenu();
            }
        });

        // Ensure correct initial state
        this.updateModeBtn();
    }

    toggleSystemMenu() {
        this.isSystemMenuOpen = !this.isSystemMenuOpen;
        if (this.isSystemMenuOpen) {
            this.systemMenu.classList.remove('hidden');
        } else {
            this.systemMenu.classList.add('hidden');
        }
    }

    closeSystemMenu() {
        this.isSystemMenuOpen = false;
        this.systemMenu.classList.add('hidden');
    }

    updateModeBtn() {
        if (this.gm.state === 'EDIT') {
            this.modeBtn.textContent = '▶ Play';
            this.modeBtn.style.background = '#2ecc71';
            this.menuBtn.classList.remove('hidden');
            this.restartBtn.classList.add('hidden');
        } else {
            this.modeBtn.textContent = '✎ Edit';
            this.modeBtn.style.background = '#e74c3c';
            this.menuBtn.classList.add('hidden');
            this.restartBtn.classList.remove('hidden');
        }
    }

    onEnter() {
        this.setupInputs();
        this.updateModeBtn();
    }

    onExit() {
        this.removeInputs();
        this.selectEntity(null);
        this.closeSystemMenu();
        this.updateModeBtn();
    }

    setupInputs() {
        const canvas = this.physics.canvas;
        canvas.addEventListener('mousedown', this.handleInput);
        canvas.addEventListener('mousemove', this.handleInput);
        canvas.addEventListener('mouseup', this.handleInput);
        canvas.addEventListener('click', this.stopClickPropagation);
        canvas.addEventListener('touchstart', this.handleInput, { passive: false });
        canvas.addEventListener('touchmove', this.handleInput, { passive: false });
        canvas.addEventListener('touchend', this.handleInput);
    }

    removeInputs() {
        const canvas = this.physics.canvas;
        canvas.removeEventListener('mousedown', this.handleInput);
        canvas.removeEventListener('mousemove', this.handleInput);
        canvas.removeEventListener('mouseup', this.handleInput);
        canvas.removeEventListener('click', this.stopClickPropagation);
        canvas.removeEventListener('touchstart', this.handleInput);
        canvas.removeEventListener('touchmove', this.handleInput);
        canvas.removeEventListener('touchend', this.handleInput);
    }

    stopClickPropagation(e) {
        e.stopPropagation();
    }

    handleInput(e) {
        if (e.target.tagName === 'BUTTON' || e.target.closest('#system-menu')) return;

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

        const worldPos = this.physics.screenToWorld(x, y);

        if (type === 'mousedown' || type === 'touchstart') {
            this.onDown(worldPos, x, y);
        } else if (type === 'mousemove' || type === 'touchmove') {
            this.onMove(worldPos);
        } else if (type === 'mouseup' || type === 'touchend') {
            this.onUp();
        }
    }

    onDown(pos, screenX, screenY) {
        if (this.isSystemMenuOpen) {
            this.closeSystemMenu();
            return;
        }

        // 1. Check Action Gizmos
        for(let g of this.activeGizmos) {
            if (Math.hypot(g.x - pos.x, g.y - pos.y) < g.r) {
                g.callback();
                return;
            }
        }

        // 2. Check Objects (Hit Test) - Prioritize Object Selection over Gizmos on old object if clicked elsewhere
        const hit = this.hitTest(pos);

        // 3. Check Transform Handles (Only if hitting current selection or no other hit)
        if (this.selectedEntity) {
            // If we hit a gizmo on the CURRENT selection, prioritize that.
            if (this.checkGizmoHit(pos)) return;
             // Check Joint Limit Handles
            if (this.selectedEntity.type === 'joint' && this.selectedEntity.object.angleLimits) {
                if (this.checkJointLimitHit(pos)) return;
            }
        }

        if (hit) {
            // New Selection!
            this.selectEntity(hit);
            this.dragStart = pos;
            this._lastMoveX = pos.x;
            this._lastMoveY = pos.y;

            if (hit.type === 'platform') {
                this.initialObjState = {
                    x: hit.object.position.x,
                    y: hit.object.position.y,
                    angle: hit.object.angle,
                    w: hit.object._editorData.w,
                    h: hit.object._editorData.h
                };
                this.activeHandle = 'move';
            } else if (hit.type === 'goal') {
                this.initialObjState = {
                    x: hit.object.x,
                    y: hit.object.y
                };
                this.activeHandle = 'move';
            } else if (hit.type === 'player_part') {
                this.activeHandle = 'move';
                this.initialObjState = {
                    x: hit.object.position.x,
                    y: hit.object.position.y,
                    angle: hit.object.angle,
                    w: hit.object._editorData.w,
                    h: hit.object._editorData.h
                };
            } else if (hit.type === 'whole_robot') {
                const bounds = Matter.Composite.bounds(hit.object.composite);
                const center = {
                    x: (bounds.min.x + bounds.max.x) / 2,
                    y: (bounds.min.y + bounds.max.y) / 2
                };
                this.initialObjState = {
                    center: center,
                    angle: 0 // Start angle is 0 relative to current
                };
                this.activeHandle = 'move_robot';
            } else if (hit.type === 'joint') {
                this.activeHandle = 'move_joint_drag';
            }
        } else {
            // Hit nothing
            if (this.selectedEntity) {
                this.selectEntity(null); // Deselect
            } else {
                this.showAddPlatformGizmo(pos);
            }
        }
    }

    showAddPlatformGizmo(pos) {
        this.activeGizmos = [];
        this.activeGizmos.push({
            x: pos.x,
            y: pos.y,
            r: 25,
            type: 'add_plat',
            render: (ctx, g) => {
                ctx.fillStyle = '#27ae60';
                ctx.beginPath();
                ctx.arc(g.x, g.y, g.r, 0, Math.PI*2);
                ctx.fill();
                ctx.fillStyle = 'white';
                ctx.font = '30px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('+', g.x, g.y);
                ctx.font = '12px Arial';
                ctx.fillStyle = '#333';
                ctx.fillText('Platform', g.x, g.y + 35);
            },
            callback: () => {
                this.levelManager.createPlatform({
                    x: pos.x,
                    y: pos.y,
                    w: 200,
                    h: 40,
                    angle: 0
                });
                this.activeGizmos = [];
            }
        });
    }

    selectEntity(entity) {
        this.selectedEntity = entity;
        this.activeGizmos = [];

        // Restore rotation angle tracker
        this._lastRotationAngle = undefined;
        this._selectionRotation = 0; // Track visual rotation for whole robot

        // Camera Focus Logic
        if (entity) {
             let bounds = null;
             if (entity.type === 'whole_robot') {
                 bounds = Matter.Composite.bounds(entity.object.composite);
             } else if (entity.type === 'player_part') {
                 // If a part is selected, maybe we want to focus on the whole robot still?
                 // Or just the part?
                 // User said: "zoom in such that it is bigger BUT the whole robot is ALWAYS on screen"
                 // This implies we should always use the ROBOT bounds, maybe slightly adjusted?
                 // But simply calling focusOn(robotBounds) will just fit the robot.
                 // If the robot is small, it zooms in. If big, it zooms out.
                 // This satisfies "zoom in such that it is bigger" (if it was small) and "whole robot on screen".
                 if (this.levelManager.player) {
                     bounds = Matter.Composite.bounds(this.levelManager.player.composite);
                 } else {
                     bounds = entity.object.bounds;
                 }
             } else if (entity.type === 'joint' || entity.type === 'hole') {
                 // Focus on the joint but keep robot in view
                  if (this.levelManager.player) {
                     bounds = Matter.Composite.bounds(this.levelManager.player.composite);
                 }
             } else if (entity.type === 'platform' || entity.type === 'goal') {
                 if (entity.object.bounds) bounds = entity.object.bounds;
                 else if (entity.object.radius) {
                     // Goal
                     bounds = {
                         min: { x: entity.object.x - entity.object.radius, y: entity.object.y - entity.object.radius },
                         max: { x: entity.object.x + entity.object.radius, y: entity.object.y + entity.object.radius }
                     };
                 }
             }

             if (bounds) {
                 this.physics.focusOn(bounds, 150); // 150px padding
             }
        } else {
            // Deselected
            this.physics.resetCamera();
        }

        if (entity && entity.type === 'hole') {
             this.spawnEmptyHoleGizmos(entity.object.body, entity.object.hole);
        } else if (entity && entity.type === 'joint') {
             this.spawnJointGizmos(entity.object);
        }
    }

    getHoleWorldPos(body, holeLoc) {
        const angle = body.angle;
        const hx = holeLoc.x * Math.cos(angle) - holeLoc.y * Math.sin(angle);
        const hy = holeLoc.x * Math.sin(angle) + holeLoc.y * Math.cos(angle);
        return {
            x: body.position.x + hx,
            y: body.position.y + hy
        };
    }

    spawnEmptyHoleGizmos(body, holeLoc) {
        const pos = this.getHoleWorldPos(body, holeLoc);

        // Show a "Ghost Part" hint or just the "+" button?
        // User wants "simple clicking" to assemble.
        // A "+" button near the hole is good.

        this.activeGizmos.push({
            x: pos.x, // Draw directly ON the hole for immediacy? Or offset?
            y: pos.y,
            r: 15,
            label: '+',
            type: 'add_part',
            render: (ctx, g) => {
                // Draw a small "ghost" part outline indicating what will happen?
                // For now, a clear Green "+" circle over the hole.

                // Pulsing effect?
                const time = Date.now() / 200;
                const r = g.r + Math.sin(time) * 2;

                ctx.fillStyle = 'rgba(46, 204, 113, 0.8)';
                ctx.beginPath();
                ctx.arc(g.x, g.y, r, 0, Math.PI*2);
                ctx.fill();

                ctx.fillStyle = 'white';
                ctx.font = '20px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('+', g.x, g.y + 2); // Slight offset for vertical align
            },
            callback: () => {
                this.addPartAtHole(body, holeLoc);
                // Don't deselect! We might want to keep adding or edit the new part immediately.
                // Actually, select the NEW part so user can rotate/resize it.
            }
        });
    }

    spawnJointGizmos(constraint) {
        const pos = Matter.Constraint.pointAWorld(constraint);

        // Gizmo to define Limits
        // Logic: Click to toggle/edit limit? Or dragging handles?
        // Let's add a "Limit" toggle button/icon first?
        // Or better, just draw the arc and let them drag limits if they exist.
        // For now, let's just show a "Move" gizmo.

        // Move Gizmo
        this.activeGizmos.push({
            x: pos.x,
            y: pos.y - 50,
            r: 15,
            type: 'move_joint_btn',
            render: (ctx, g) => {
                ctx.beginPath();
                ctx.moveTo(pos.x, pos.y);
                ctx.lineTo(g.x, g.y);
                ctx.strokeStyle = '#3498db';
                ctx.stroke();

                ctx.fillStyle = '#3498db';
                ctx.beginPath();
                ctx.arc(g.x, g.y, g.r, 0, Math.PI*2);
                ctx.fill();
                ctx.fillStyle = 'white';
                ctx.font = '12px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('Move', g.x, g.y);
            },
            callback: () => {
                this.activeHandle = 'drag_joint';
                this.dragStart = pos;
                // We are now dragging the joint. Visual feedback will happen in draw/onMove.
            }
        });

        // Limit Gizmo (Toggle)
        if (!constraint.angleLimits) {
            this.activeGizmos.push({
                x: pos.x + 40,
                y: pos.y,
                r: 15,
                type: 'add_limit',
                render: (ctx, g) => {
                    ctx.fillStyle = '#e67e22';
                    ctx.beginPath();
                    ctx.arc(g.x, g.y, g.r, 0, Math.PI*2);
                    ctx.fill();
                    ctx.fillStyle = 'white';
                    ctx.font = '10px Arial';
                    ctx.fillText('Limit', g.x, g.y);
                },
                callback: () => {
                    constraint.angleLimits = { min: -0.5, max: 0.5 };
                    this.selectEntity(this.selectedEntity); // Refresh gizmos
                }
            });
        } else {
             this.activeGizmos.push({
                x: pos.x + 40,
                y: pos.y,
                r: 15,
                type: 'remove_limit',
                render: (ctx, g) => {
                    ctx.fillStyle = '#c0392b';
                    ctx.beginPath();
                    ctx.arc(g.x, g.y, g.r, 0, Math.PI*2);
                    ctx.fill();
                    ctx.fillStyle = 'white';
                    ctx.font = '10px Arial';
                    ctx.fillText('NoLim', g.x, g.y);
                },
                callback: () => {
                    delete constraint.angleLimits;
                    this.selectEntity(this.selectedEntity); // Refresh gizmos
                }
            });
        }
    }

    hitTest(pos) {
        // 1. Check Goal (High Priority)
        if (this.levelManager.goal) {
            const goal = this.levelManager.goal;
            const d = Math.hypot(goal.x - pos.x, goal.y - pos.y);
            if (d < goal.radius) return { type: 'goal', object: goal };
        }

        if (this.levelManager.player) {
            // 2. Joints (Constraints) - Higher priority than parts
            const playerConstraints = this.levelManager.player.constraints;
            for (let c of playerConstraints) {
                if (c.render && c.render.visible === false) continue;
                const pA = Matter.Constraint.pointAWorld(c);
                // Increased hit radius for better mobile selection
                if (Math.hypot(pA.x - pos.x, pA.y - pos.y) < 20) {
                    return { type: 'joint', object: c };
                }
            }

            // 3. Holes on ANY Player Part
            // We want to be able to select empty holes on any part to add stuff
            const playerBodies = this.levelManager.player.bodies;
            // Check top-most body first? (Reverse order usually)
            for (let i = playerBodies.length - 1; i >= 0; i--) {
                const body = playerBodies[i];
                // Optimization: only check bodies near the click
                if (!Matter.Bounds.contains(body.bounds, pos)) continue;

                const holeHit = this.hitTestHoles(body, pos);
                if (holeHit) {
                    // Check if this hole is already occupied by a joint
                    const isOccupied = playerConstraints.some(c => {
                        // Check distance to constraint anchor
                        const pA = Matter.Constraint.pointAWorld(c);
                        const holeWorld = this.getHoleWorldPos(body, holeHit);
                        return Math.hypot(pA.x - holeWorld.x, pA.y - holeWorld.y) < 5;
                    });

                    if (!isOccupied) {
                        return { type: 'hole', object: { body: body, hole: holeHit } };
                    }
                }
            }

            // 4. Player Parts
            const hitPlayer = Matter.Query.point(playerBodies, pos)[0];
            if (hitPlayer) {
                return { type: 'player_part', object: hitPlayer };
            }

            // 5. Whole Robot Bounds
            const bounds = Matter.Composite.bounds(this.levelManager.player.composite);
            if (Matter.Bounds.contains(bounds, pos)) {
                return { type: 'whole_robot', object: this.levelManager.player };
            }
        }

        // 6. Platforms
        const bodies = this.levelManager.platforms;
        const hit = Matter.Query.point(bodies, pos)[0];
        if (hit) {
            return { type: 'platform', object: hit };
        }

        return null;
    }

    hitTestHoles(body, pos) {
        const { holes } = getHolePositions(body);
        const angle = body.angle;
        const dx = pos.x - body.position.x;
        const dy = pos.y - body.position.y;
        const cos = Math.cos(-angle);
        const sin = Math.sin(-angle);
        const localX = dx * cos - dy * sin;
        const localY = dx * sin + dy * cos;

        for (let hole of holes) {
            if (Math.hypot(localX - hole.x, localY - hole.y) < 10) {
                return hole;
            }
        }
        return null;
    }

    spawnHoleGizmos(body, holeLoc, clickPos) {
        this.activeGizmos = [];
        const angle = body.angle;
        const hx = holeLoc.x * Math.cos(angle) - holeLoc.y * Math.sin(angle);
        const hy = holeLoc.x * Math.sin(angle) + holeLoc.y * Math.cos(angle);
        const holeWorldX = body.position.x + hx;
        const holeWorldY = body.position.y + hy;

        this.activeGizmos.push({
            x: holeWorldX + 30,
            y: holeWorldY,
            r: 15,
            type: 'add_part',
            render: (ctx, g) => {
                ctx.fillStyle = '#e74c3c';
                ctx.beginPath();
                ctx.arc(g.x, g.y, g.r, 0, Math.PI*2);
                ctx.fill();
                ctx.fillStyle = 'white';
                ctx.font = '20px Arial';
                ctx.fillText('+', g.x, g.y);
            },
            callback: () => {
                this.addPartAtHole(body, holeLoc);
                this.activeGizmos = [];
            }
        });

        const player = this.levelManager.player;
        const parentConstraint = player.constraints.find(c =>
            (c.bodyB === body) && c.length === 0
        );

        if (parentConstraint) {
             this.activeGizmos.push({
                x: holeWorldX - 30,
                y: holeWorldY,
                r: 15,
                type: 'move_joint',
                render: (ctx, g) => {
                    ctx.fillStyle = '#3498db';
                    ctx.beginPath();
                    ctx.arc(g.x, g.y, g.r, 0, Math.PI*2);
                    ctx.fill();
                    ctx.fillStyle = 'white';
                    ctx.font = '12px Arial';
                    ctx.fillText('Move', g.x, g.y);
                },
                callback: () => {
                    this.moveJointToHole(parentConstraint, body, holeLoc);
                    this.activeGizmos = [];
                }
            });
        }
    }

    moveJointToHole(constraint, body, holeLoc) {
        constraint.pointB = { x: holeLoc.x, y: holeLoc.y };
        let pivotWorld;
        if (constraint.bodyA === body) pivotWorld = Matter.Constraint.pointBWorld(constraint);
        else pivotWorld = Matter.Constraint.pointAWorld(constraint);

        const angle = body.angle;
        const hx = holeLoc.x * Math.cos(angle) - holeLoc.y * Math.sin(angle);
        const hy = holeLoc.x * Math.sin(angle) + holeLoc.y * Math.cos(angle);

        Matter.Body.setPosition(body, {
            x: pivotWorld.x - hx,
            y: pivotWorld.y - hy
        });
    }

    addPartAtHole(parentBody, holeLoc) {
        const player = this.levelManager.player;

        // Default new part dimensions (Vertical strip)
        const newPartW = 20;
        const newPartH = 100;

        // Create the body FIRST to get its holes dynamically
        // We want to align the parent's angle (extension).
        const angle = parentBody.angle;

        const newBody = Matter.Bodies.rectangle(
            0, 0, // Temp pos
            newPartW, newPartH, {
            collisionFilter: parentBody.collisionFilter, // Shared collision group for overlap
            chamfer: { radius: 5 },
            density: 0.01,
            friction: 1.0,
            angle: angle
        });
        newBody._editorData = { w: newPartW, h: newPartH };

        // Determine anchor on new body (First/Top hole)
        const newBodyHoles = getHolePositions(newBody).holes;
        // Prefer the one with min Y (top)
        let bestHole = newBodyHoles[0];
        for(let h of newBodyHoles) {
            if (h.y < bestHole.y) bestHole = h;
        }
        const newAnchorX = bestHole.x;
        const newAnchorY = bestHole.y;

        // Position Logic:
        // Calculate World Position of the Parent's Hole
        const hx = holeLoc.x * Math.cos(angle) - holeLoc.y * Math.sin(angle);
        const hy = holeLoc.x * Math.sin(angle) + holeLoc.y * Math.cos(angle);
        const holeWorldX = parentBody.position.x + hx;
        const holeWorldY = parentBody.position.y + hy;

        // Calculate Body Position for New Part
        // WorldPos = NewBodyPos + Rotate(NewAnchor)
        // NewBodyPos = WorldPos - Rotate(NewAnchor)

        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        const rotAnchorX = newAnchorX * cos - newAnchorY * sin;
        const rotAnchorY = newAnchorX * sin + newAnchorY * cos;

        const newBodyX = holeWorldX - rotAnchorX;
        const newBodyY = holeWorldY - rotAnchorY;

        // Update newBody position
        Matter.Body.setPosition(newBody, { x: newBodyX, y: newBodyY });

        const pivot = Matter.Constraint.create({
            label: 'pivot', // Ensure it renders as a bolt
            bodyA: parentBody,
            bodyB: newBody,
            pointA: { x: holeLoc.x, y: holeLoc.y },
            pointB: { x: newAnchorX, y: newAnchorY },
            stiffness: 1,
            length: 0,
            render: { visible: true }
        });

        player.bodies.push(newBody);
        player.constraints.push(pivot);
        Matter.Composite.add(player.composite, [newBody, pivot]);

        // Final Validation to ensure perfect alignment
        this.validateJoint(pivot);

        // Select the new part immediately
        this.selectEntity({ type: 'player_part', object: newBody });
    }

    checkJointLimitHit(pos) {
        const c = this.selectedEntity.object;
        const limits = c.angleLimits;
        const pA = Matter.Constraint.pointAWorld(c);
        const r = 30; // Radius of arc
        const angleA = c.bodyA.angle;

        const minAngle = angleA + limits.min;
        const maxAngle = angleA + limits.max;

        const minPos = {
            x: pA.x + r * Math.cos(minAngle),
            y: pA.y + r * Math.sin(minAngle)
        };
        const maxPos = {
            x: pA.x + r * Math.cos(maxAngle),
            y: pA.y + r * Math.sin(maxAngle)
        };

        if (Math.hypot(pos.x - minPos.x, pos.y - minPos.y) < 15) {
            this.activeHandle = 'limit_min';
            this.dragStart = pos;
            return true;
        }
        if (Math.hypot(pos.x - maxPos.x, pos.y - maxPos.y) < 15) {
            this.activeHandle = 'limit_max';
            this.dragStart = pos;
            return true;
        }
        return false;
    }

    checkGizmoHit(pos) {
        if (!this.selectedEntity) return false;

        if (this.selectedEntity.type === 'whole_robot') {
            const player = this.selectedEntity.object;
            const bounds = Matter.Composite.bounds(player.composite);
            // We want to use the ROTATED bounds frame if we track visual rotation.
            // But the bounds themselves are AABB.
            // The handle is drawn relative to AABB center usually.
            // But let's use the center we calculated.
            const midX = (bounds.min.x + bounds.max.x) / 2;
            const midY = (bounds.min.y + bounds.max.y) / 2;
            // The handle should be above the robot (relative to rotation)
            // Let's assume the handle is at (0, -height/2 - 40) relative to center, rotated.
            const h = bounds.max.y - bounds.min.y;
            const r = this._selectionRotation || 0;

            const hLocal = { x: 0, y: -h/2 - 40 };
            const hWorld = {
                x: midX + hLocal.x * Math.cos(r) - hLocal.y * Math.sin(r),
                y: midY + hLocal.x * Math.sin(r) + hLocal.y * Math.cos(r)
            };

            if (Math.hypot(hWorld.x - pos.x, hWorld.y - pos.y) < 20) {
                this.activeHandle = 'rotate_robot';
                this.dragStart = pos;
                this.initialObjState = {
                    center: { x: midX, y: midY },
                    angle: this._selectionRotation || 0
                };
                return true;
            }
            return false;
        }

        if (this.selectedEntity.type === 'goal' || this.selectedEntity.type === 'joint') return false; // No gizmos for goal/joint yet (only move via drag)

        const body = this.selectedEntity.object;
        const w = body._editorData ? body._editorData.w : 20;
        const h = body._editorData ? body._editorData.h : 20;
        const angle = body.angle;

        const tr = { x: w/2 + 20, y: -h/2 - 20 };
        const wx = body.position.x + tr.x * Math.cos(angle) - tr.y * Math.sin(angle);
        const wy = body.position.y + tr.x * Math.sin(angle) + tr.y * Math.cos(angle);

        if (Math.hypot(wx - pos.x, wy - pos.y) < 20) {
            this.deleteSelected();
            return true;
        }

        const rHandleDist = w/2 + 40;
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

        const corners = [
            { x: -w/2, y: -h/2 },
            { x: w/2, y: -h/2 },
            { x: w/2, y: h/2 },
            { x: -w/2, y: h/2 }
        ];

        for (let i = 0; i < 4; i++) {
            const c = corners[i];
            const cwx = body.position.x + c.x * Math.cos(angle) - c.y * Math.sin(angle);
            const cwy = body.position.y + c.x * Math.sin(angle) + c.y * Math.cos(angle);

            if (Math.hypot(cwx - pos.x, cwy - pos.y) < 15) {
                this.activeHandle = 'resize';
                this.resizeHandleIndex = i;
                this.dragStart = pos;
                return true;
            }
        }

        return false;
    }

    deleteSelected() {
        if (!this.selectedEntity) return;
        const player = this.levelManager.player;

        if (this.selectedEntity.type === 'player_part') {
            if (player.bodies.length <= 1) {
                alert("Cannot delete the last part!");
                return;
            }
            const body = this.selectedEntity.object;
            this.removeBodyAndConstraints(body, player);
            this.selectEntity(null);
        } else if (this.selectedEntity.type === 'platform') {
            const body = this.selectedEntity.object;
            Matter.Composite.remove(this.physics.world, body);
            const idx = this.levelManager.platforms.indexOf(body);
            if (idx > -1) this.levelManager.platforms.splice(idx, 1);
            this.selectEntity(null);
        }
    }

    removeBodyAndConstraints(body, player) {
        const toRemove = [];
        for (let c of player.constraints) {
            if (c.bodyA === body || c.bodyB === body) {
                toRemove.push(c);
            }
        }
        toRemove.forEach(c => {
            Matter.Composite.remove(player.composite, c);
            const idx = player.constraints.indexOf(c);
            if (idx > -1) player.constraints.splice(idx, 1);
             const idxM = player.muscles.findIndex(m => m.constraint === c);
            if (idxM > -1) player.muscles.splice(idxM, 1);
        });
        Matter.Composite.remove(player.composite, body);
        const idxB = player.bodies.indexOf(body);
        if (idxB > -1) player.bodies.splice(idxB, 1);
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
        } else if (this.activeHandle === 'move_robot') {
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
        } else if (this.activeHandle === 'rotate') {
             this.handleRotation(pos);
        } else if (this.activeHandle === 'resize') {
            this.handleResize(pos);
        } else if (this.activeHandle === 'rotate_robot') {
            this.handleRobotRotation(pos);
        } else if (this.activeHandle === 'drag_joint') {
            this.handleJointDrag(pos);
        } else if (this.activeHandle === 'limit_min' || this.activeHandle === 'limit_max') {
            this.handleLimitDrag(pos);
        }
    }

    handleLimitDrag(pos) {
        const c = this.selectedEntity.object;
        const pA = Matter.Constraint.pointAWorld(c);
        const angleA = c.bodyA.angle;

        // Angle from center to mouse
        let mouseAngle = Math.atan2(pos.y - pA.y, pos.x - pA.x);
        // Relative to bodyA
        let relAngle = mouseAngle - angleA;

        // Normalize
        while (relAngle < -Math.PI) relAngle += 2*Math.PI;
        while (relAngle > Math.PI) relAngle -= 2*Math.PI;

        if (this.activeHandle === 'limit_min') {
            c.angleLimits.min = relAngle;
            // Ensure min < max?
        } else {
            c.angleLimits.max = relAngle;
        }
    }

    handleJointDrag(pos) {
        const c = this.selectedEntity.object;

        // 1. Find nearest hole on BodyA to the cursor
        const bestHoleA = this.findNearestHole(c.bodyA, pos);

        // 2. Find nearest hole on BodyB to the cursor
        const bestHoleB = this.findNearestHole(c.bodyB, pos);

        // 3. Update anchors if a valid hole was found
        if (bestHoleA) {
            c.pointA = bestHoleA;
        }
        if (bestHoleB) {
            c.pointB = bestHoleB;
        }

        // 4. Force Validation & Alignment immediately
        // This ensures visual feedback is instant and correct
        this.validateJoint(c);
    }

    findNearestHole(body, pos) {
        const { holes } = getHolePositions(body);
        const angle = body.angle;

        // Transform world pos to local (relative to body center) unrotated
        // But getHolePositions returns local coordinates relative to center (unrotated).
        // So we need to transform pos (world) to local.

        const dx = pos.x - body.position.x;
        const dy = pos.y - body.position.y;
        const cos = Math.cos(-angle);
        const sin = Math.sin(-angle);
        const localX = dx * cos - dy * sin;
        const localY = dx * sin + dy * cos;

        let bestHole = null;
        let minDist = 30; // Snap radius

        for (let h of holes) {
            const d = Math.hypot(h.x - localX, h.y - localY);
            if (d < minDist) {
                minDist = d;
                bestHole = h;
            }
        }
        return bestHole;
    }

    handleRobotRotation(pos) {
        const center = this.initialObjState.center;
        const startAngle = Math.atan2(this.dragStart.y - center.y, this.dragStart.x - center.x);
        const currentAngle = Math.atan2(pos.y - center.y, pos.x - center.x);
        const dAngle = currentAngle - startAngle;

        if (this._lastRotationAngle === undefined) this._lastRotationAngle = 0;
        const stepAngle = dAngle - this._lastRotationAngle; // Delta from last move

        Matter.Composite.rotate(this.selectedEntity.object.composite, stepAngle, center);
        this._lastRotationAngle = dAngle;

        // Update visual rotation for frame
        this._selectionRotation = this.initialObjState.angle + dAngle;
    }

    handleRotation(pos) {
        const body = this.selectedEntity.object;
        let pivot = body.position;
        let parentConstraint = null;

        if (this.selectedEntity.type === 'player_part') {
            const player = this.levelManager.player;
            parentConstraint = player.constraints.find(c =>
                (c.bodyA === body || c.bodyB === body) && c.length === 0
            );

            if (parentConstraint) {
                if (parentConstraint.bodyA === body) pivot = Matter.Constraint.pointBWorld(parentConstraint);
                else pivot = Matter.Constraint.pointAWorld(parentConstraint);
            }
        }

        const center = body.position;
        const startAngle = Math.atan2(this.dragStart.y - center.y, this.dragStart.x - center.x);
        const currentAngle = Math.atan2(pos.y - center.y, pos.x - center.x);
        const dAngle = currentAngle - startAngle;

        if (parentConstraint) {
            const newAngle = this.initialObjState.angle + dAngle;
            Matter.Body.setAngle(body, newAngle);

            const anchorLocal = (parentConstraint.bodyA === body) ? parentConstraint.pointA : parentConstraint.pointB;
            const rotatedAnchor = Matter.Vector.rotate(anchorLocal, newAngle);

            let pivotWorld;
            if (parentConstraint.bodyA === body) pivotWorld = Matter.Constraint.pointBWorld(parentConstraint);
            else pivotWorld = Matter.Constraint.pointAWorld(parentConstraint);

            Matter.Body.setPosition(body, {
                x: pivotWorld.x - rotatedAnchor.x,
                y: pivotWorld.y - rotatedAnchor.y
            });

        } else {
            Matter.Body.setAngle(body, this.initialObjState.angle + dAngle);
        }
    }

    handleResize(pos) {
        const body = this.selectedEntity.object;
        const angle = body.angle;
        const cos = Math.cos(-angle);
        const sin = Math.sin(-angle);

        const dxLocal = (pos.x - body.position.x) * cos - (pos.y - body.position.y) * sin;
        const dyLocal = (pos.x - body.position.x) * sin + (pos.y - body.position.y) * cos;

        let newW = Math.abs(dxLocal) * 2;
        let newH = Math.abs(dyLocal) * 2;
        newW = Math.max(20, newW);
        newH = Math.max(20, newH);
        newW = Math.round(newW / 20) * 20;
        newH = Math.round(newH / 20) * 20;

        const oldW = body._editorData.w;
        const oldH = body._editorData.h;
        if (newW === oldW && newH === oldH) return;

        const currentAngle = body.angle;
        const chamferRadius = (this.selectedEntity.type === 'player_part') ? 5 : 0;
        const dummy = Matter.Bodies.rectangle(0, 0, newW, newH, { chamfer: { radius: chamferRadius } });

        Matter.Body.setAngle(body, 0);
        Matter.Body.setVertices(body, dummy.vertices);
        Matter.Body.setAngle(body, currentAngle);

        body._editorData.w = newW;
        body._editorData.h = newH;

        if (this.selectedEntity.type === 'player_part') {
            this.updateConnectedConstraints(body, oldW, oldH, newW, newH);
        }
    }

    updateConnectedConstraints(body, oldW, oldH, newW, newH) {
        const player = this.levelManager.player;
        if (!player) return;

        const connected = player.constraints.filter(c => c.bodyA === body || c.bodyB === body);
        connected.forEach(c => this.validateJoint(c));
    }

    validateJoint(c) {
        // Enforce that joint anchors (pointA/pointB) are valid holes on their respective bodies
        if (c.label === 'muscle') return; // Muscles might not need strict hole snapping? Or yes? Usually pivots.

        this._snapAnchorToNearestHole(c.bodyA, c.pointA);
        this._snapAnchorToNearestHole(c.bodyB, c.pointB);

        // After snapping local anchors, we must ensure physical alignment.
        // We assume BodyA is the "anchor" (or priority) and move BodyB to match.
        // Or if one is static?

        const pAWorld = this.getHoleWorldPos(c.bodyA, c.pointA);
        const pBWorld = this.getHoleWorldPos(c.bodyB, c.pointB);

        // If they are misaligned > 1px, snap them.
        if (Math.hypot(pAWorld.x - pBWorld.x, pAWorld.y - pBWorld.y) > 1) {
            // Move BodyB
            const angleB = c.bodyB.angle;
            const hx = c.pointB.x * Math.cos(angleB) - c.pointB.y * Math.sin(angleB);
            const hy = c.pointB.x * Math.sin(angleB) + c.pointB.y * Math.cos(angleB);

            Matter.Body.setPosition(c.bodyB, {
                x: pAWorld.x - hx,
                y: pAWorld.y - hy
            });
            Matter.Body.setVelocity(c.bodyB, { x: 0, y: 0 });
            Matter.Body.setAngularVelocity(c.bodyB, 0);
        }
    }

    _snapAnchorToNearestHole(body, point) {
        const { holes } = getHolePositions(body);
        let bestHole = null;
        let minD = Infinity;

        // Find nearest hole to the current local point
        for(let h of holes) {
            const d = Math.hypot(h.x - point.x, h.y - point.y);
            if (d < minD) {
                minD = d;
                bestHole = h;
            }
        }

        // If found (always should if body has holes), update point
        if (bestHole) {
            point.x = bestHole.x;
            point.y = bestHole.y;
        }
    }

    onUp() {
        // Enforce constraint validity after ANY interaction that might affect structure
        // This includes drag_joint, move, rotate, resize, move_robot.
        // We broadly validate all constraints on the player to ensure the whole structure remains consistent.
        // This acts as a "physics snap" to keep the Merkur-like rigidity.

        if (this.activeHandle) {
             if (this.levelManager.player) {
                  // Validate ALL player constraints to be safe.
                  // In a larger game, we might optimize to only touched bodies, but for a robot editor, this is negligible.
                  this.levelManager.player.constraints.forEach(c => this.validateJoint(c));
             }
        }

        this.dragStart = null;
        this.activeHandle = null;
        this._lastMoveX = null;
        this._lastMoveY = null;
        this._lastRotationAngle = undefined;
    }

    update(dt) {}

    draw(ctx) {
        for(let g of this.activeGizmos) {
            if (g.render) g.render(ctx, g);
        }

        if (this.selectedEntity) {
            if (this.selectedEntity.type === 'whole_robot') {
                const player = this.selectedEntity.object;
                const bounds = Matter.Composite.bounds(player.composite);
                const midX = (bounds.min.x + bounds.max.x) / 2;
                const midY = (bounds.min.y + bounds.max.y) / 2;
                const w = bounds.max.x - bounds.min.x;
                const h = bounds.max.y - bounds.min.y;
                const r = this._selectionRotation || 0;

                ctx.save();
                ctx.translate(midX, midY);
                ctx.rotate(r);

                ctx.strokeStyle = '#9b59b6';
                ctx.lineWidth = 3;
                ctx.strokeRect(-w/2, -h/2, w, h);

                // Rotation Handle
                ctx.beginPath();
                ctx.moveTo(0, -h/2);
                ctx.lineTo(0, -h/2 - 40);
                ctx.stroke();
                ctx.fillStyle = '#8e44ad';
                ctx.beginPath();
                ctx.arc(0, -h/2 - 40, 8, 0, Math.PI*2);
                ctx.fill();

                ctx.restore();
                return;
            }

            const obj = this.selectedEntity.object;
            ctx.save();

            if (this.selectedEntity.type === 'goal') {
                ctx.strokeStyle = '#3498db';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(obj.x, obj.y, obj.radius + 5, 0, Math.PI*2);
                ctx.stroke();
            } else if (this.selectedEntity.type === 'hole') {
                 const { body, hole } = this.selectedEntity.object;
                 const pos = this.getHoleWorldPos(body, hole);
                 ctx.strokeStyle = '#2ecc71';
                 ctx.lineWidth = 2;
                 ctx.strokeRect(pos.x - 8, pos.y - 8, 16, 16);
            } else if (this.selectedEntity.type === 'joint') {
                const c = this.selectedEntity.object;
                const pA = Matter.Constraint.pointAWorld(c);
                ctx.strokeStyle = '#f1c40f';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(pA.x, pA.y, 12, 0, Math.PI * 2);
                ctx.stroke();

                // Draw Angle Limits if present
                if (c.angleLimits) {
                    const min = c.angleLimits.min;
                    const max = c.angleLimits.max;
                    // We need a reference frame. BodyA's angle?
                    // Limits are usually relative to the initial angle or BodyA.
                    // Let's assume limits are relative to Body A.
                    const angleA = c.bodyA.angle;

                    ctx.beginPath();
                    ctx.arc(pA.x, pA.y, 30, angleA + min, angleA + max);
                    ctx.strokeStyle = 'rgba(231, 76, 60, 0.5)';
                    ctx.lineWidth = 10;
                    ctx.stroke();

                    // Handles
                    const r = 30;
                    const minPos = {
                        x: pA.x + r * Math.cos(angleA + min),
                        y: pA.y + r * Math.sin(angleA + min)
                    };
                    const maxPos = {
                        x: pA.x + r * Math.cos(angleA + max),
                        y: pA.y + r * Math.sin(angleA + max)
                    };

                    ctx.fillStyle = '#e74c3c';
                    ctx.beginPath();
                    ctx.arc(minPos.x, minPos.y, 5, 0, Math.PI*2);
                    ctx.fill();
                    ctx.beginPath();
                    ctx.arc(maxPos.x, maxPos.y, 5, 0, Math.PI*2);
                    ctx.fill();
                }

            } else if (this.selectedEntity.type === 'platform' || this.selectedEntity.type === 'player_part') {
                ctx.translate(obj.position.x, obj.position.y);
                ctx.rotate(obj.angle);

                ctx.strokeStyle = (this.selectedEntity.type === 'player_part') ? '#e74c3c' : '#3498db';
                ctx.lineWidth = 2;
                const w = obj._editorData ? obj._editorData.w : 20;
                const h = obj._editorData ? obj._editorData.h : 100;

                ctx.strokeRect(-w/2 - 5, -h/2 - 5, w + 10, h + 10);

                // Rotation Handle
                ctx.beginPath();
                ctx.moveTo(w/2 + 5, 0);
                ctx.lineTo(w/2 + 40, 0);
                ctx.stroke();

                ctx.fillStyle = '#e67e22';
                ctx.beginPath();
                ctx.arc(w/2 + 40, 0, 8, 0, Math.PI * 2);
                ctx.fill();

                // Delete Handle (Local Draw)
                const dx = w/2 + 20;
                const dy = -h/2 - 20;
                ctx.fillStyle = '#c0392b';
                ctx.beginPath();
                ctx.arc(dx, dy, 10, 0, Math.PI*2);
                ctx.fill();
                ctx.fillStyle = 'white';
                ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('X', dx, dy);

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
            }
            ctx.restore();
        }
    }
}

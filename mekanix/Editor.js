import Matter from 'matter-js';
import { getHolePositions } from './Renderer.js';

export class Editor {
    constructor(gameManager) {
        this.gm = gameManager;
        this.physics = gameManager.physics;
        this.levelManager = gameManager.levelManager;

        this.selectedEntity = null; // { type: 'platform'|'goal'|'player_part'|'whole_robot', object: Body|PlayerObject }
        this.dragStart = null;
        this.initialObjState = null;
        this.activeGizmos = [];

        this.activeHandle = null;
        this.resizeHandleIndex = -1;

        this.systemMenu = document.getElementById('system-menu');
        this.menuBtn = document.getElementById('menu-btn');
        this.isSystemMenuOpen = false;

        this.menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleSystemMenu();
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
        } else {
            this.modeBtn.textContent = '✎ Edit';
            this.modeBtn.style.background = '#e74c3c';
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

        // 2. Check Transform Handles
        if (this.selectedEntity) {
            if (this.checkGizmoHit(pos)) return;
        }

        // 3. Check Objects
        const hit = this.hitTest(pos);

        if (hit) {
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
                    angle: 0
                };
                this.activeHandle = 'move_robot';
            }
        } else {
            if (this.selectedEntity) {
                this.selectEntity(null);
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
    }

    hitTest(pos) {
        if (this.selectedEntity && this.selectedEntity.type === 'player_part') {
            const holeHit = this.hitTestHoles(this.selectedEntity.object, pos);
            if (holeHit) {
                this.spawnHoleGizmos(this.selectedEntity.object, holeHit, pos);
                return this.selectedEntity;
            }
        }

        if (this.levelManager.player) {
             const playerBodies = this.levelManager.player.bodies;
            const hitPlayer = Matter.Query.point(playerBodies, pos)[0];
            if (hitPlayer) {
                return { type: 'player_part', object: hitPlayer };
            }

            const bounds = Matter.Composite.bounds(this.levelManager.player.composite);
            if (Matter.Bounds.contains(bounds, pos)) {
                return { type: 'whole_robot', object: this.levelManager.player };
            }
        }

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
        // pivotWorld should be calculated from A
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
        const newW = 100;
        const newH = 20;
        const angle = parentBody.angle;
        const hx = holeLoc.x * Math.cos(angle) - holeLoc.y * Math.sin(angle);
        const hy = holeLoc.x * Math.sin(angle) + holeLoc.y * Math.cos(angle);
        const holeWorldX = parentBody.position.x + hx;
        const holeWorldY = parentBody.position.y + hy;

        const offsetDist = (newW/2 - 15);
        const newAngle = angle;
        const ox = offsetDist * Math.cos(newAngle);
        const oy = offsetDist * Math.sin(newAngle);

        const newBody = Matter.Bodies.rectangle(
            holeWorldX + ox,
            holeWorldY + oy,
            newW, newH, {
            collisionFilter: parentBody.collisionFilter,
            chamfer: { radius: 5 },
            density: 0.01,
            friction: 1.0,
            angle: newAngle
        });
        newBody._editorData = { w: newW, h: newH };

        const pivot = Matter.Constraint.create({
            bodyA: parentBody,
            bodyB: newBody,
            pointA: { x: holeLoc.x, y: holeLoc.y },
            pointB: { x: -newW/2 + 15, y: 0 },
            stiffness: 1,
            length: 0,
            render: { visible: true }
        });

        player.bodies.push(newBody);
        player.constraints.push(pivot);
        Matter.Composite.add(player.composite, [newBody, pivot]);
        this.selectEntity({ type: 'player_part', object: newBody });
    }

    checkGizmoHit(pos) {
        if (!this.selectedEntity) return false;

        if (this.selectedEntity.type === 'whole_robot') {
            const player = this.selectedEntity.object;
            const bounds = Matter.Composite.bounds(player.composite);
            const midX = (bounds.min.x + bounds.max.x) / 2;
            const topY = bounds.min.y;

            if (Math.hypot(midX - pos.x, (topY - 40) - pos.y) < 20) {
                this.activeHandle = 'rotate_robot';
                this.dragStart = pos;
                this.initialObjState = {
                    center: { x: midX, y: (bounds.min.y + bounds.max.y)/2 },
                    angle: 0
                };
                return true;
            }
            return false;
        }

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
        }
    }

    handleRobotRotation(pos) {
        const center = this.initialObjState.center;
        const startAngle = Math.atan2(this.dragStart.y - center.y, this.dragStart.x - center.x);
        const currentAngle = Math.atan2(pos.y - center.y, pos.x - center.x);

        if (this._lastRotationAngle === undefined) this._lastRotationAngle = startAngle;
        const stepAngle = currentAngle - this._lastRotationAngle;

        Matter.Composite.rotate(this.selectedEntity.object.composite, stepAngle, center);
        this._lastRotationAngle = currentAngle;
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

        connected.forEach(c => {
            const point = (c.bodyA === body) ? c.pointA : c.pointB;
            const { holes } = getHolePositions(body);
            let bestHole = null;
            let minD = Infinity;
            for(let h of holes) {
                const d = Math.hypot(h.x - point.x, h.y - point.y);
                if (d < minD) {
                    minD = d;
                    bestHole = h;
                }
            }
            if (bestHole && minD < 25) {
                point.x = bestHole.x;
                point.y = bestHole.y;
            }
        });
    }

    onUp() {
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
                ctx.strokeStyle = '#9b59b6';
                ctx.lineWidth = 3;
                ctx.strokeRect(bounds.min.x, bounds.min.y, bounds.max.x - bounds.min.x, bounds.max.y - bounds.min.y);

                const midX = (bounds.min.x + bounds.max.x) / 2;
                const topY = bounds.min.y;
                ctx.beginPath();
                ctx.moveTo(midX, topY);
                ctx.lineTo(midX, topY - 40);
                ctx.stroke();
                ctx.fillStyle = '#8e44ad';
                ctx.beginPath();
                ctx.arc(midX, topY - 40, 8, 0, Math.PI*2);
                ctx.fill();
                return;
            }

            const obj = this.selectedEntity.object;
            ctx.save();

            if (this.selectedEntity.type === 'platform' || this.selectedEntity.type === 'player_part') {
                ctx.translate(obj.position.x, obj.position.y);
                ctx.rotate(obj.angle);

                ctx.strokeStyle = (this.selectedEntity.type === 'player_part') ? '#e74c3c' : '#3498db';
                ctx.lineWidth = 2;
                const w = obj._editorData ? obj._editorData.w : 20;
                const h = obj._editorData ? obj._editorData.h : 100;

                ctx.strokeRect(-w/2 - 5, -h/2 - 5, w + 10, h + 10);

                ctx.beginPath();
                ctx.moveTo(w/2 + 5, 0);
                ctx.lineTo(w/2 + 40, 0);
                ctx.stroke();

                ctx.fillStyle = '#e67e22';
                ctx.beginPath();
                ctx.arc(w/2 + 40, 0, 8, 0, Math.PI * 2);
                ctx.fill();

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

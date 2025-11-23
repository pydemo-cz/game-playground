import Matter from 'matter-js';
import { getHolePositions } from './Renderer.js';

export class Editor {
    constructor(gameManager) {
        this.gm = gameManager;
        this.physics = gameManager.physics;
        this.levelManager = gameManager.levelManager;

        this.selectedEntity = null; // { type: 'platform'|'goal'|'player_part', object: Body/Goal }
        this.dragStart = null;
        this.initialObjState = null;

        // Gizmo handles
        this.activeHandle = null; // 'move' | 'rotate' | 'resize'
        this.resizeHandleIndex = -1;

        // Context Menu State
        this.contextMenu = document.getElementById('context-menu');
        this.contextMenuList = document.getElementById('context-menu-list');
        this.isContextMenuOpen = false;

        // UI Binding
        this.modeBtn = document.getElementById('mode-toggle');
        this.modeBtn.addEventListener('click', () => {
             this.gm.toggleMode();
             this.updateModeBtn();
        });

        // Inputs
        this.handleInput = this.handleInput.bind(this);

        // Hide context menu on click elsewhere
        document.addEventListener('click', (e) => {
            if (this.isContextMenuOpen && !this.contextMenu.contains(e.target)) {
                this.closeContextMenu();
            }
        });
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
        this.closeContextMenu();
        this.updateModeBtn();
    }

    setupInputs() {
        const canvas = this.physics.canvas;
        canvas.addEventListener('mousedown', this.handleInput);
        canvas.addEventListener('mousemove', this.handleInput);
        canvas.addEventListener('mouseup', this.handleInput);
        // Prevent click from bubbling to document (which closes the menu)
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
        // Allow default only if clicking UI elements (like buttons)
        if (e.target.tagName === 'BUTTON' || e.target.closest('#context-menu')) return;

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
            this.onDown(worldPos, x, y);
        } else if (type === 'mousemove' || type === 'touchmove') {
            this.onMove(worldPos);
        } else if (type === 'mouseup' || type === 'touchend') {
            this.onUp();
        }
    }

    onDown(pos, screenX, screenY) {
        // If context menu is open, close it (unless we clicked inside, handled by global listener)
        if (this.isContextMenuOpen) {
            this.closeContextMenu();
            return;
        }

        // 1. Check Gizmo Handles
        if (this.selectedEntity) {
            if (this.checkGizmoHit(pos)) return;
        }

        // 2. Check Holes on Selected Entity (for adding parts)
        if (this.selectedEntity && this.selectedEntity.type === 'player_part') {
            const holeHit = this.hitTestHoles(this.selectedEntity.object, pos);
            if (holeHit) {
                this.openPartContextMenu(screenX, screenY, this.selectedEntity.object, holeHit);
                return;
            }
        }

        // 3. Hit Test Objects
        this.activeHandle = null;
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
            }
        } else {
            // Clicked Empty Space -> Open Global Context Menu
            // Deselect first
            this.selectEntity(null);
            this.openGlobalContextMenu(screenX, screenY, pos);
        }
    }

    hitTestHoles(body, pos) {
        const { holes } = getHolePositions(body);
        // holes are in local unrotated space relative to body center?
        // Wait, getHolePositions returns logic coordinates relative to center (0,0) unrotated.
        // We need to transform world pos to local body space.

        const angle = body.angle;
        const dx = pos.x - body.position.x;
        const dy = pos.y - body.position.y;
        const cos = Math.cos(-angle);
        const sin = Math.sin(-angle);
        const localX = dx * cos - dy * sin;
        const localY = dx * sin + dy * cos;

        for (let hole of holes) {
            // Check distance
            const dist = Math.hypot(localX - hole.x, localY - hole.y);
            if (dist < 10) { // Generous hit area for hole (radius 3 drawn, but 10 touch)
                return hole; // Return the hole local pos
            }
        }
        return null;
    }

    openPartContextMenu(x, y, parentBody, holePos) {
        this.isContextMenuOpen = true;
        this.contextMenu.classList.remove('hidden');
        this.contextMenu.style.left = x + 'px';
        this.contextMenu.style.top = y + 'px';

        this.contextMenuList.innerHTML = '';

        const addPart = document.createElement('li');
        addPart.textContent = '+ Add Part Here';
        addPart.onclick = () => {
            this.addPartAtHole(parentBody, holePos);
            this.closeContextMenu();
        };
        this.contextMenuList.appendChild(addPart);

        const deletePart = document.createElement('li');
        deletePart.textContent = 'Delete Parent Part';
        deletePart.className = 'danger';
        deletePart.onclick = () => {
            this.deleteSelected();
            this.closeContextMenu();
        };
        this.contextMenuList.appendChild(deletePart);
    }

    openGlobalContextMenu(x, y, worldPos) {
        this.isContextMenuOpen = true;
        this.contextMenu.classList.remove('hidden');
        this.contextMenu.style.left = x + 'px';
        this.contextMenu.style.top = y + 'px';

        this.contextMenuList.innerHTML = '';

        const addPlat = document.createElement('li');
        addPlat.textContent = '+ Add Platform';
        addPlat.onclick = () => {
            this.levelManager.createPlatform({
                x: worldPos.x,
                y: worldPos.y,
                w: 200,
                h: 40,
                angle: 0
            });
            this.closeContextMenu();
        };
        this.contextMenuList.appendChild(addPlat);

        const save = document.createElement('li');
        save.textContent = 'Save Level';
        save.onclick = () => {
            const data = this.levelManager.exportLevel();
            localStorage.setItem('mekanix_saved_level', JSON.stringify(data));
            alert('Level Saved!');
            this.closeContextMenu();
        };
        this.contextMenuList.appendChild(save);

        const load = document.createElement('li');
        load.textContent = 'Load Level';
        load.onclick = () => {
            const json = localStorage.getItem('mekanix_saved_level');
            if (json) {
                const data = JSON.parse(json);
                this.levelManager.loadLevel(data);
                // Also update gm working data so if we play it uses this
                this.gm.workingLevelData = data;
            } else {
                alert('No saved level found.');
            }
            this.closeContextMenu();
        };
        this.contextMenuList.appendChild(load);
    }

    closeContextMenu() {
        this.isContextMenuOpen = false;
        this.contextMenu.classList.add('hidden');
    }

    addPartAtHole(parentBody, holeLoc) {
        const player = this.levelManager.player;
        const newW = 100; // Standard strip length
        const newH = 20;

        // Parent World Pos of the hole
        const angle = parentBody.angle;
        // rotate holeLoc by angle
        const hx = holeLoc.x * Math.cos(angle) - holeLoc.y * Math.sin(angle);
        const hy = holeLoc.x * Math.sin(angle) + holeLoc.y * Math.cos(angle);

        const holeWorldX = parentBody.position.x + hx;
        const holeWorldY = parentBody.position.y + hy;

        // Create New Body
        // Align new body so one of its holes (e.g. first one) matches this hole.
        // Let's align its center such that its "start" hole is at the pivot.
        // New body "start" hole is at (-newW/2 + 15, 0).
        // So center offset from pivot is (newW/2 - 15, 0).

        const offsetDist = (newW/2 - 15);
        // We want new body to extend outwards? Or just default angle 0?
        // Let's extend in same direction as parent if possible? Or perpendicular?
        // Default to same angle as parent + 90? Or just 0.
        // Let's do same angle as parent for extension.

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

        // Rigid Pivot Constraint (length 0, high stiffness)
        // Anchor A is holeLoc
        // Anchor B is start hole (-newW/2 + 15, 0)
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

        // Select new part
        this.selectEntity({ type: 'player_part', object: newBody });
    }

    deleteSelected() {
        if (!this.selectedEntity) return;

        const player = this.levelManager.player;

        if (this.selectedEntity.type === 'player_part') {
             // Check minimum parts
            if (player.bodies.length <= 1) { // Allow down to 1? Or 2? Original code said 2. Let's say 1 is fine if we want to rebuild.
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
        // 1. Remove Constraints connected to this body
        // We must loop backwards or filter
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
            // Also muscles
             const idxM = player.muscles.findIndex(m => m.constraint === c);
            if (idxM > -1) player.muscles.splice(idxM, 1);
        });

        // 2. Remove Body
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
                 // Move entire robot structure
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
        } else if (this.activeHandle === 'rotate') {
             const center = this.selectedEntity.object.position;
             const startAngle = Math.atan2(this.dragStart.y - center.y, this.dragStart.x - center.x);
             const currentAngle = Math.atan2(pos.y - center.y, pos.x - center.x);
             const dAngle = currentAngle - startAngle;
             Matter.Body.setAngle(this.selectedEntity.object, this.initialObjState.angle + dAngle);
        } else if (this.activeHandle === 'resize') {
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

            // Snap to Hole Spacing? (20px)
            // Optional but good for Merkur feel
            newW = Math.round(newW / 20) * 20;
            newH = Math.round(newH / 20) * 20;
            // Ensure min size after snap
            if (newW < 20) newW = 20;
            if (newH < 20) newH = 20;

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
    }

    updateConnectedConstraints(body, oldW, oldH, newW, newH) {
        const player = this.levelManager.player;
        if (!player) return;

        const connected = player.constraints.filter(c => c.bodyA === body || c.bodyB === body);

        connected.forEach(c => {
            const point = (c.bodyA === body) ? c.pointA : c.pointB;
            // Since we resize from center, relative positions might shift if they were on the edge.
            // But if holes are relative to center, do they move?
            // Holes are calculated from center. (0,0) is center.
            // If we resize, center stays same.
            // Points defined relative to center should stay correct spatially relative to center.
            // BUT if the point was "on the 3rd hole", does the 3rd hole move?
            // Yes, if we resize, the grid might shift if not careful?
            // Logic: Hole 0 is at offset from Left.
            // Left edge moves when Width changes.
            // So yes, holes move relative to center!

            // Old Left Edge X = -oldW/2.
            // New Left Edge X = -newW/2.
            // Shift = (oldW - newW) / 2.

            // If point.y is small (on axis), check X.
            // We need to shift the point to maintain its "index" from the edge?
            // Or just snap to nearest new hole?

            // Assume holes start from Top-Left or similar.
            // Currently getHolePositions centers the group of holes.
            // This means holes DO move relative to center if count changes or parity changes.

            // Simplest fix: Re-snap to nearest valid hole on new dimensions?
            // Or just shift by edge diff.

            // For now, let's just leave it, but it might detach visually from a hole.
            // Correct approach: Find nearest hole on new body and snap to it.

            const { holes } = getHolePositions(body); // New holes
            let bestHole = null;
            let minD = Infinity;

            for(let h of holes) {
                const d = Math.hypot(h.x - point.x, h.y - point.y);
                if (d < minD) {
                    minD = d;
                    bestHole = h;
                }
            }

            if (bestHole && minD < 25) { // If reasonably close
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
    }

    selectEntity(entity) {
        this.selectedEntity = entity;
    }

    hitTest(pos) {
        // ... (Hit test logic similar to before but simplified or updated) ...
        // Check Player Parts
        if (this.levelManager.player) {
             const playerBodies = this.levelManager.player.bodies;
             // Check resize handles? No, handled by gizmo check.

             // Check bodies
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
        const corners = [
            { x: -w/2, y: -h/2 }, // TL
            { x: w/2, y: -h/2 },  // TR
            { x: w/2, y: h/2 },   // BR
            { x: -w/2, y: h/2 }   // BL
        ];

        for (let i = 0; i < 4; i++) {
            const c = corners[i];
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

    update(dt) {}

    draw(ctx) {
        if (this.selectedEntity) {
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
            }
            ctx.restore();
        }
    }
}

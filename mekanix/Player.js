import Matter from 'matter-js';

export class Player {
    constructor(x, y, typeOrData = 'V') {
        this.bodies = [];
        this.constraints = [];
        this.composite = Matter.Composite.create();
        this.muscles = [];

        if (typeof typeOrData === 'string') {
            if (typeOrData === 'V') this.createVWalker(x, y);
            else if (typeOrData === 'L') this.createLWalker(x, y);
        } else {
            // Load from Data
            this.buildFromData(x, y, typeOrData);
        }
    }

    buildFromData(x, y, data) {
        // data = { parts: [], constraints: [] }
        // Parts are relative to (0,0). We offset by (x,y).
        const group = Matter.Body.nextGroup(true);
        const bodyMap = []; // Index -> Body

        // 1. Create Bodies
        data.parts.forEach(p => {
            const body = Matter.Bodies.rectangle(x + p.x, y + p.y, p.w, p.h, {
                angle: p.angle || 0,
                collisionFilter: { group: group },
                chamfer: { radius: 5 }, // Smaller radius for arbitrary parts
                density: 0.01,
                friction: 1.0
            });
            body._editorData = { w: p.w, h: p.h }; // Use explicit editor data
            this.bodies.push(body);
            bodyMap.push(body);
        });

        // 2. Create Constraints
        data.constraints.forEach(c => {
            // Verify indices exist
            if (c.bodyA >= bodyMap.length || c.bodyB >= bodyMap.length) return;

            const opts = {
                bodyA: bodyMap[c.bodyA],
                bodyB: bodyMap[c.bodyB],
                pointA: c.pointA,
                pointB: c.pointB,
                length: c.length, // If muscle
                stiffness: c.stiffness || 1,
                damping: c.damping || 0
            };

            const constraint = Matter.Constraint.create(opts);
            this.constraints.push(constraint);

            if (c.type === 'muscle') {
                 // It's a muscle
                 this.muscles.push({
                     constraint: constraint,
                     relaxedLength: c.length || 100, // Should be defined in data
                     contractedLength: c.contractedLength || (c.length * 0.5)
                 });
            }
        });

        Matter.Composite.add(this.composite, [...this.bodies, ...this.constraints]);
    }

    createVWalker(x, y) {
        // Legacy implementation
        const width = 20;
        const length = 100;
        const group = Matter.Body.nextGroup(true);

        const legA = Matter.Bodies.rectangle(x - length/2 + 5, y, length, width, {
            collisionFilter: { group: group },
            chamfer: { radius: 10 },
            density: 0.01,
            friction: 1.0
        });
        legA._editorData = { w: length, h: width };

        const legB = Matter.Bodies.rectangle(x + length/2 - 5, y, length, width, {
            collisionFilter: { group: group },
            chamfer: { radius: 10 },
            density: 0.01,
            friction: 1.0
        });
        legB._editorData = { w: length, h: width };

        Matter.Body.setAngle(legA, -Math.PI / 6);
        Matter.Body.setAngle(legB, Math.PI / 6);

        const pivot = Matter.Constraint.create({
            bodyA: legA,
            pointA: { x: length/2 - 10, y: 0 },
            bodyB: legB,
            pointB: { x: -length/2 + 10, y: 0 },
            stiffness: 1,
            length: 0
        });

        const muscle = Matter.Constraint.create({
            bodyA: legA,
            pointA: { x: 0, y: 0 },
            bodyB: legB,
            pointB: { x: 0, y: 0 },
            stiffness: 0.1,
            damping: 0.05,
            length: 150
        });

        this.muscles.push({ constraint: muscle, relaxedLength: 150, contractedLength: 50 });
        this.bodies.push(legA, legB);
        this.constraints.push(pivot, muscle);
        Matter.Composite.add(this.composite, [legA, legB, pivot, muscle]);
    }

    createLWalker(x, y) { this.createVWalker(x,y); }

    contract() {
        for (let m of this.muscles) {
            m.constraint.length = m.contractedLength;
            m.constraint.stiffness = 0.2;
        }
    }

    relax() {
        for (let m of this.muscles) {
            m.constraint.length = m.relaxedLength;
            m.constraint.stiffness = 0.1;
        }
    }

    addToWorld(world) {
        Matter.World.add(world, this.composite);
    }

    removeFromWorld(world) {
        Matter.World.remove(world, this.composite);
    }

    exportData() {
        if (this.bodies.length === 0) return null;

        // Use first body as reference anchor? Or center of mass?
        // Using first body is stable if we don't delete it.
        // If we delete the first body, indices shift.
        // Ideally calculate a bounding center.
        // For now, let's use the first body's current position as the "Start" reference
        // and save everything relative to it.

        const anchor = this.bodies[0];
        const startX = anchor.position.x;
        const startY = anchor.position.y;

        // Export Parts relative to anchor
        const parts = this.bodies.map(b => {
             // Retrieve dimension from editorData
             const w = b._editorData ? b._editorData.w : 20;
             const h = b._editorData ? b._editorData.h : 100;

             return {
                 x: b.position.x - startX,
                 y: b.position.y - startY,
                 w: w,
                 h: h,
                 angle: b.angle
             };
        });

        // Export Constraints
        const bodyIndex = new Map();
        this.bodies.forEach((b, i) => bodyIndex.set(b.id, i));

        const constraintsData = this.constraints.map(c => {
             const idxA = bodyIndex.get(c.bodyA.id);
             const idxB = bodyIndex.get(c.bodyB.id);

             // If body was deleted but constraint remains (shouldn't happen with correct logic), skip
             if (idxA === undefined || idxB === undefined) return null;

             const isMuscle = this.muscles.find(m => m.constraint === c);

             return {
                 type: isMuscle ? 'muscle' : 'pivot',
                 bodyA: idxA,
                 bodyB: idxB,
                 pointA: c.pointA, // These are local points, safe to export
                 pointB: c.pointB,
                 length: c.length,
                 stiffness: c.stiffness,
                 damping: c.damping
                 // Add contractedLength for muscles?
             };
        }).filter(c => c !== null);

        return {
            startPos: { x: startX, y: startY },
            parts: parts,
            constraints: constraintsData
        };
    }
}

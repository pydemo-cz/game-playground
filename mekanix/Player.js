import Matter from 'matter-js';

export class Player {
    constructor(x, y, type = 'V') {
        this.bodies = [];
        this.constraints = [];
        this.composite = Matter.Composite.create();
        this.muscles = [];

        if (type === 'V') {
            this.createVWalker(x, y);
        } else if (type === 'L') {
            this.createLWalker(x, y);
        }
    }

    createVWalker(x, y) {
        const width = 20;
        const length = 100;
        const group = Matter.Body.nextGroup(true);

        // Create two segments
        // Left leg
        const legA = Matter.Bodies.rectangle(x - length/2 + 5, y, length, width, {
            collisionFilter: { group: group },
            chamfer: { radius: 10 },
            density: 0.01,
            friction: 1.0, // High friction to grip ground
            restitution: 0.0 // No bounce
        });

        // Right leg
        const legB = Matter.Bodies.rectangle(x + length/2 - 5, y, length, width, {
            collisionFilter: { group: group },
            chamfer: { radius: 10 },
            density: 0.01,
            friction: 1.0,
            restitution: 0.0
        });

        // Rotate them slightly to form a ^ shape initially? Or flat --
        // Let's start flat-ish but connected
        Matter.Body.setAngle(legA, -Math.PI / 6); // -30 deg
        Matter.Body.setAngle(legB, Math.PI / 6);  // 30 deg

        // Position adjustment to connect them
        // We want them connected at the top tips
        // We can calculate positions, or just let the constraint pull them?
        // Better to position them correctly.

        // Pivot Joint (The "Hinge")
        const pivot = Matter.Constraint.create({
            bodyA: legA,
            pointA: { x: length/2 - 10, y: 0 }, // End of legA
            bodyB: legB,
            pointB: { x: -length/2 + 10, y: 0 }, // Start of legB
            stiffness: 1,
            length: 0,
            render: { visible: true }
        });

        // Muscle Joint
        // Connects points further down the legs.
        // When shortened, it pulls the legs together (closes the V).
        const muscle = Matter.Constraint.create({
            bodyA: legA,
            pointA: { x: 0, y: 0 }, // Midpoint
            bodyB: legB,
            pointB: { x: 0, y: 0 }, // Midpoint
            stiffness: 0.1, // Softer than the pivot
            damping: 0.05,
            length: 150, // Relaxed length
            render: { type: 'line', visible: false } // We draw it manually or not at all
        });

        this.muscles.push({ constraint: muscle, relaxedLength: 150, contractedLength: 50 });

        this.bodies.push(legA, legB);
        this.constraints.push(pivot, muscle);

        Matter.Composite.add(this.composite, [legA, legB, pivot, muscle]);
    }

    createLWalker(x, y) {
        // Similar to V but different angles/lengths
        const width = 20;
        const length = 100;
        const group = Matter.Body.nextGroup(true);

        const legA = Matter.Bodies.rectangle(x, y, length, width, {
            collisionFilter: { group: group },
            chamfer: { radius: 10 },
            density: 0.01,
            friction: 1.0
        });
        const legB = Matter.Bodies.rectangle(x + length - 10, y + length/2 - 10, width, length, {
            collisionFilter: { group: group },
            chamfer: { radius: 10 },
            density: 0.01,
            friction: 1.0
        });

         const pivot = Matter.Constraint.create({
            bodyA: legA,
            pointA: { x: length/2 - 10, y: 0 },
            bodyB: legB,
            pointB: { x: 0, y: -length/2 + 10 },
            stiffness: 1,
            length: 0
        });

        // Muscle logic might need to be different for L shape to "curl"
        // Diagonal muscle
        const muscle = Matter.Constraint.create({
            bodyA: legA,
            pointA: { x: 0, y: 0 },
            bodyB: legB,
            pointB: { x: 0, y: 0 },
            stiffness: 0.1,
            damping: 0.05,
            length: Math.sqrt(50*50 + 50*50), // Distance approx
        });

        this.muscles.push({ constraint: muscle, relaxedLength: 120, contractedLength: 60 });

        this.bodies.push(legA, legB);
        this.constraints.push(pivot, muscle);
        Matter.Composite.add(this.composite, [legA, legB, pivot, muscle]);
    }

    contract() {
        for (let m of this.muscles) {
            m.constraint.length = m.contractedLength;
            // Increase stiffness slightly during contraction for snap?
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
}

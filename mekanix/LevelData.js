export const DEFAULT_LEVEL = {
    id: "default",
    name: "New Level",
    platforms: [
        { x: 360, y: 1200, w: 720, h: 50, angle: 0, type: "static" } // Ground
    ],
    goal: { x: 500, y: 1000, radius: 40 },
    player: {
        startPos: { x: 360, y: 1100 },
        parts: [
            { x: -10, y: 0, w: 20, h: 100, angle: -0.5 },
            { x: 10, y: 0, w: 20, h: 100, angle: 0.5 }
        ],
        constraints: [
             // Defined relatively or by index?
             // By index is easier for serialization.
             { type: "pivot", bodyA: 0, bodyB: 1, pointA: {x: 10, y: -50}, pointB: {x: -10, y: -50} },
             { type: "muscle", bodyA: 0, bodyB: 1, pointA: {x: 0, y: 0}, pointB: {x: 0, y: 0}, length: 100, stiffness: 0.1 }
        ]
    }
};

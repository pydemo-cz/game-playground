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
            // Overlapping parts
            // Part 0 centered at x=0
            { x: 0, y: 0, w: 20, h: 100, angle: -0.5 },
            // Part 1 centered at x=0 (They fully overlap if angle is 0)
            { x: 0, y: 0, w: 20, h: 100, angle: 0.5 }
        ],
        constraints: [
             // Pivot at the top hole (y=-30 relative to center, matches Renderer grid)
             // Explicitly set length 0 for clarity (though Player.js now enforces it)
             { type: "pivot", bodyA: 0, bodyB: 1, pointA: {x: 0, y: -30}, pointB: {x: 0, y: -30}, length: 0 },
             { type: "muscle", bodyA: 0, bodyB: 1, pointA: {x: 0, y: 0}, pointB: {x: 0, y: 0}, length: 100, stiffness: 0.1 }
        ]
    }
};

import Matter from 'matter-js';

// Custom renderer logic for "Merkur" style
export function drawMerkur(ctx, physics) {
    // Draw World Border (Background for logical area)
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, physics.logicalWidth, physics.logicalHeight);
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, physics.logicalWidth, physics.logicalHeight);

    const bodies = Matter.Composite.allBodies(physics.world);

    // Draw Bodies
    for (let body of bodies) {
        // Skip ground if we want to style it differently (it usually has label 'Rectangle Body')
        // But for now draw everything

        if (body.isStatic) {
             // Ground/Walls style
            ctx.fillStyle = '#333';
            ctx.beginPath();
            const vertices = body.vertices;
            ctx.moveTo(vertices[0].x, vertices[0].y);
            for (let j = 1; j < vertices.length; j += 1) {
                ctx.lineTo(vertices[j].x, vertices[j].y);
            }
            ctx.fill();
            continue;
        }

        // Merkur Parts
        ctx.save();
        ctx.translate(body.position.x, body.position.y);
        ctx.rotate(body.angle);

        // Draw the strip
        // Assuming rectangle for now
        // We need width/height.
        // Accessing body bounds is one way, or assuming from factory.
        // Matter.js bodies don't easily expose w/h directly if convex hull, but for rectangles area/density works?
        // Actually vertices are easiest source of truth.
        // But to draw rounded rect with holes we need dimensions.
        // Let's approximate dimensions from vertices bounds.
        const min = { x: Infinity, y: Infinity };
        const max = { x: -Infinity, y: -Infinity };
        body.vertices.forEach(v => {
             // Rotate vertex back to local space
             const dx = v.x - body.position.x;
             const dy = v.y - body.position.y;
             // Rotate by -angle
             const cos = Math.cos(-body.angle);
             const sin = Math.sin(-body.angle);
             const lx = dx * cos - dy * sin;
             const ly = dx * sin + dy * cos;

             if (lx < min.x) min.x = lx;
             if (lx > max.x) max.x = lx;
             if (ly < min.y) min.y = ly;
             if (ly > max.y) max.y = ly;
        });

        const w = max.x - min.x;
        const h = max.y - min.y;

        // Metal gradient
        const grad = ctx.createLinearGradient(-w/2, -h/2, w/2, h/2);
        grad.addColorStop(0, '#bdc3c7');
        grad.addColorStop(0.5, '#ecf0f1');
        grad.addColorStop(1, '#bdc3c7');
        ctx.fillStyle = grad;

        // Rounded Rect
        const r = 10; // Radius
        ctx.beginPath();
        ctx.roundRect(-w/2, -h/2, w, h, r);
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#7f8c8d';
        ctx.stroke();

        // Draw Holes (Merkur style)
        ctx.fillStyle = '#2c3e50'; // Dark hole color
        const holeSpacing = 20;
        const holeRadius = 3;

        // Determine if it's a long strip horizontally or vertically
        if (w > h) {
            // Horizontal strip
            const count = Math.floor((w - 20) / holeSpacing);
            for (let i = 0; i < count; i++) {
                const x = -w/2 + 15 + i * holeSpacing; // Offset start
                ctx.beginPath();
                ctx.arc(x, 0, holeRadius, 0, Math.PI * 2);
                ctx.fill();
            }
        } else {
             // Vertical strip
            const count = Math.floor((h - 20) / holeSpacing);
            for (let i = 0; i < count; i++) {
                const y = -h/2 + 15 + i * holeSpacing;
                ctx.beginPath();
                ctx.arc(0, y, holeRadius, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.restore();
    }

    // Draw Joints (Bolts)
    const constraints = Matter.Composite.allConstraints(physics.world);
    ctx.fillStyle = '#f1c40f';
    ctx.strokeStyle = '#d35400';
    ctx.lineWidth = 1;

    for (let c of constraints) {
        if (c.render && c.render.visible === false) continue;

        const pA = Matter.Constraint.pointAWorld(c);
        // Draw a bolt head at the joint location
        ctx.beginPath();
        ctx.arc(pA.x, pA.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Little screw slot
        ctx.beginPath();
        ctx.moveTo(pA.x - 3, pA.y);
        ctx.lineTo(pA.x + 3, pA.y);
        ctx.stroke();
    }

}

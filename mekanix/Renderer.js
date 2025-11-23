import Matter from 'matter-js';

export function getHolePositions(body) {
    let w, h;
    if (body._editorData) {
        w = body._editorData.w;
        h = body._editorData.h;
    } else {
        // Fallback: approximate from vertices
        const min = { x: Infinity, y: Infinity };
        const max = { x: -Infinity, y: -Infinity };
        body.vertices.forEach(v => {
            const dx = v.x - body.position.x;
            const dy = v.y - body.position.y;
            const cos = Math.cos(-body.angle);
            const sin = Math.sin(-body.angle);
            const lx = dx * cos - dy * sin;
            const ly = dx * sin + dy * cos;

            if (lx < min.x) min.x = lx;
            if (lx > max.x) max.x = lx;
            if (ly < min.y) min.y = ly;
            if (ly > max.y) max.y = ly;
        });
        w = max.x - min.x;
        h = max.y - min.y;
    }

    const holes = [];
    const holeSpacing = 20;

    // Use a simpler logic: Start from one end + offset, go until other end - offset.
    // Offset usually 15 or 10.
    const startOffset = 15;

    if (w > h) {
        // Horizontal strip
        // Ensure we center the holes? Or start fixed?
        // Merkur usually has fixed spacing.
        const availableLen = w - 2 * startOffset;
        if (availableLen >= 0) {
            const count = Math.floor(availableLen / holeSpacing) + 1;
            // Center the group of holes?
            const totalHolesLen = (count - 1) * holeSpacing;
            const startX = -totalHolesLen / 2;

            for (let i = 0; i < count; i++) {
                holes.push({ x: startX + i * holeSpacing, y: 0 });
            }
        }
    } else {
        // Vertical strip
        const availableLen = h - 2 * startOffset;
        if (availableLen >= 0) {
            const count = Math.floor(availableLen / holeSpacing) + 1;
            const totalHolesLen = (count - 1) * holeSpacing;
            const startY = -totalHolesLen / 2;

            for (let i = 0; i < count; i++) {
                holes.push({ x: 0, y: startY + i * holeSpacing });
            }
        }
    }
    return { holes, w, h }; // Return w, h too to avoid re-calc
}

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

        const { holes, w, h } = getHolePositions(body);

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
        const holeRadius = 3;

        for(let hole of holes) {
            ctx.beginPath();
            ctx.arc(hole.x, hole.y, holeRadius, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    // Draw Joints (Bolts)
    const constraints = Matter.Composite.allConstraints(physics.world);

    for (let c of constraints) {
        if (c.render && c.render.visible === false) continue;
        const pA = Matter.Constraint.pointAWorld(c);
        const pB = Matter.Constraint.pointBWorld(c);

        if (c.label === 'muscle') {
            // Draw Muscle (Spring/Line)
            ctx.beginPath();
            ctx.moveTo(pA.x, pA.y);
            ctx.lineTo(pB.x, pB.y);
            ctx.strokeStyle = 'rgba(230, 126, 34, 0.6)'; // Semi-transparent orange
            ctx.lineWidth = 4;
            ctx.setLineDash([5, 5]); // Dashed line for muscle
            ctx.stroke();
            ctx.setLineDash([]);
        } else {
            // Default to Pivot (Bolt)
            ctx.fillStyle = '#f1c40f';
            ctx.strokeStyle = '#d35400';
            ctx.lineWidth = 1;

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
}

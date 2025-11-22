export class Goal {
    constructor(x, y, radius) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.contactTime = 0;
        this.requiredTime = 2000; // 2 seconds
        this.isWinning = false;
    }

    update(dt, playerBodies) {
        // Check collision with any player body part
        let touching = false;
        for (let body of playerBodies) {
            // Simple circle vs AABB/Polygon check
            // We can check distance from circle center to body vertices or use Matter.Query?
            // Matter.Query.point implies a point.
            // Matter.Collision.collides is for two bodies.
            // Let's do a simple check: is any vertex inside the circle?
            // Or is the circle center close to the body?

            // Actually, Matter.js bodies have `bounds`.
            if (this.isBodyInGoal(body)) {
                touching = true;
                break;
            }
        }

        if (touching) {
            this.contactTime += dt;
        } else {
            this.contactTime = Math.max(0, this.contactTime - dt * 2); // Decay faster than gain
        }

        if (this.contactTime >= this.requiredTime) {
            this.isWinning = true;
            return true; // Level Complete
        }
        return false;
    }

    isBodyInGoal(body) {
        // Check if any vertex is within radius of center
        // Or use SAT. But for a "Goal Zone", usually getting the COM or any part is enough.
        // Let's require the Center of Mass of at least one body to be in the circle?
        // Or any vertex? Any vertex is easier to trigger.

        for (let v of body.vertices) {
            const dx = v.x - this.x;
            const dy = v.y - this.y;
            if (dx*dx + dy*dy < this.radius * this.radius) {
                return true;
            }
        }
        return false;
    }

    draw(ctx) {
        // Pulse effect
        const pulse = (Math.sin(Date.now() / 200) + 1) / 2;

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(46, 204, 113, 0.3)`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius + pulse * 5, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(46, 204, 113, 0.8)`;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw Progress
        if (this.contactTime > 0) {
            const progress = Math.min(this.contactTime / this.requiredTime, 1);
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.arc(this.x, this.y, this.radius, -Math.PI/2, -Math.PI/2 + progress * Math.PI * 2);
            ctx.lineTo(this.x, this.y);
            ctx.fillStyle = `rgba(46, 204, 113, 0.6)`;
            ctx.fill();
        }
    }
}

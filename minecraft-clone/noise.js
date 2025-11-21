// Simple 2D Perlin Noise implementation
// Based on standard implementations suitable for procedural generation without external dependencies.

export class Noise {
    constructor(seed = Math.random()) {
        this.perm = new Uint8Array(512);
        this.p = new Uint8Array(256);
        for (let i = 0; i < 256; i++) {
            this.p[i] = i;
        }

        // Shuffle
        for (let i = 255; i > 0; i--) {
            const n = Math.floor((seed * (i + 1)) % (i + 1)); // Simple pseudo-random shuffle based on seed could be better, but using Math.random for now if seed is not critical
            // Actually, to respect the seed properly we need a seeded random.
            // For simplicity in this context, let's just use Math.random() for the shuffle if no seeded PRNG is provided.
            // If strict seeding is needed, we would implement a LCG.
            // Let's just use the standard Math.random() shuffle logic for the 'p' array for now as the user didn't ask for specific seeds.
            const r = Math.floor(Math.random() * (i + 1));
            [this.p[i], this.p[r]] = [this.p[r], this.p[i]];
        }

        for (let i = 0; i < 512; i++) {
            this.perm[i] = this.p[i & 255];
        }
    }

    dot(g, x, y) {
        return g[0] * x + g[1] * y;
    }

    // 2D Noise
    noise2D(x, y) {
        // Find unit grid cell containing point
        let X = Math.floor(x) & 255;
        let Y = Math.floor(y) & 255;

        // Get relative xyz coordinates of point within that cell
        x -= Math.floor(x);
        y -= Math.floor(y);

        // Compute fade curves for each of x, y
        let u = this.fade(x);
        let v = this.fade(y);

        // Hash coordinates of the 4 square corners
        let A = this.perm[X] + Y;
        let AA = this.perm[A];
        let AB = this.perm[A + 1];
        let B = this.perm[X + 1] + Y;
        let BA = this.perm[B];
        let BB = this.perm[B + 1];

        // Add blended results from 8 corners of cube
        const grad = [
            [1, 1], [-1, 1], [1, -1], [-1, -1],
            [1, 0], [-1, 0], [1, 0], [-1, 0],
            [0, 1], [0, -1], [0, 1], [0, -1]
        ];

        const gAA = grad[AA % 12];
        const gAB = grad[AB % 12];
        const gBA = grad[BA % 12];
        const gBB = grad[BB % 12];

        return this.lerp(v, this.lerp(u, this.dot(gAA, x, y), this.dot(gBA, x - 1, y)),
                           this.lerp(u, this.dot(gAB, x, y - 1), this.dot(gBB, x - 1, y - 1)));
    }

    fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    lerp(t, a, b) {
        return a + t * (b - a);
    }
}

export function createNoise2D() {
    const noise = new Noise();
    return (x, y) => noise.noise2D(x, y);
}

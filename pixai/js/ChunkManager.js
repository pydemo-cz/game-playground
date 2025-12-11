export class ChunkManager {
    constructor(chunkSize) {
        this.chunkSize = chunkSize;
        this.chunks = new Map(); // Key: "x,y", Value: ChunkData
    }

    // Get chunks that intersect with the camera view
    getVisibleChunks(cameraBounds) {
        const visibleChunks = [];

        const minChunkX = Math.floor(cameraBounds.left / this.chunkSize);
        const maxChunkX = Math.floor(cameraBounds.right / this.chunkSize);
        const minChunkY = Math.floor(cameraBounds.top / this.chunkSize);
        const maxChunkY = Math.floor(cameraBounds.bottom / this.chunkSize);

        for (let x = minChunkX; x <= maxChunkX; x++) {
            for (let y = minChunkY; y <= maxChunkY; y++) {
                visibleChunks.push(this.getChunk(x, y));
            }
        }

        return visibleChunks;
    }

    getChunk(x, y) {
        const key = `${x},${y}`;
        if (!this.chunks.has(key)) {
            this.chunks.set(key, this.generateChunk(x, y));
        }
        return this.chunks.get(key);
    }

    generateChunk(chunkX, chunkY) {
        const objects = [];
        const numObjects = 100; // Number of objects per chunk

        // Deterministic random seed based on chunk coordinates would be better,
        // but for now Math.random() is fine for prototype as long as we cache it.

        const offsetX = chunkX * this.chunkSize;
        const offsetY = chunkY * this.chunkSize;

        for (let i = 0; i < numObjects; i++) {
            const w = 10 + Math.random() * 40;
            const h = 10 + Math.random() * 40;
            const x = offsetX + Math.random() * (this.chunkSize - w);
            const y = offsetY + Math.random() * (this.chunkSize - h);

            // Random color
            const r = Math.floor(Math.random() * 255);
            const g = Math.floor(Math.random() * 255);
            const b = Math.floor(Math.random() * 255);

            objects.push({
                x, y, w, h,
                color: `rgb(${r},${g},${b})`
            });
        }

        return {
            x: chunkX,
            y: chunkY,
            objects: objects
        };
    }
}

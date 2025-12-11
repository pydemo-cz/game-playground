export class Camera {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.scale = 1;
    }

    resize(width, height) {
        this.width = width;
        this.height = height;
    }

    // Convert world coordinate to screen coordinate
    worldToScreen(worldX, worldY) {
        return {
            x: (worldX - this.x) * this.scale + this.width / 2,
            y: (worldY - this.y) * this.scale + this.height / 2
        };
    }

    // Convert screen coordinate to world coordinate
    screenToWorld(screenX, screenY) {
        return {
            x: this.x + (screenX - this.width / 2) / this.scale,
            y: this.y + (screenY - this.height / 2) / this.scale
        };
    }

    // Get the visible world bounds (left, right, top, bottom)
    getBounds() {
        const halfWidth = (this.width / 2) / this.scale;
        const halfHeight = (this.height / 2) / this.scale;
        return {
            left: this.x - halfWidth,
            right: this.x + halfWidth,
            top: this.y - halfHeight,
            bottom: this.y + halfHeight
        };
    }
}

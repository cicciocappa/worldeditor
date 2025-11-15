/**
 * Chunk.js - Represents a single chunk of the game world
 * Contains terrain height data and placed objects
 */

export class Chunk {
    /**
     * Create a new chunk
     * @param {number} size - Size of chunk in world units (default 64)
     * @param {number} resolution - Number of height vertices (default 65)
     */
    constructor(size = 64, resolution = 65) {
        this.size = size;
        this.resolution = resolution;

        // Heightmap: row-major array of height values
        // heights[z * resolution + x] gives height at (x, z)
        this.heights = new Float32Array(resolution * resolution);

        // Initialize to flat terrain at y = 0
        this.heights.fill(0.0);

        // List of placed objects
        this.objects = [];

        // Dirty flag for mesh regeneration
        this.terrainDirty = true;
    }

    /**
     * Get height at specific grid coordinates
     */
    getHeight(x, z) {
        if (x < 0 || x >= this.resolution || z < 0 || z >= this.resolution) {
            return 0;
        }
        return this.heights[z * this.resolution + x];
    }

    /**
     * Set height at specific grid coordinates
     */
    setHeight(x, z, height) {
        if (x < 0 || x >= this.resolution || z < 0 || z >= this.resolution) {
            return;
        }
        this.heights[z * this.resolution + x] = height;
        this.terrainDirty = true;
    }

    /**
     * Get interpolated height at world coordinates
     */
    getHeightAt(worldX, worldZ) {
        // Convert world coords to grid coords
        const gridX = (worldX / this.size) * (this.resolution - 1);
        const gridZ = (worldZ / this.size) * (this.resolution - 1);

        // Clamp to valid range
        const x = Math.max(0, Math.min(this.resolution - 2, Math.floor(gridX)));
        const z = Math.max(0, Math.min(this.resolution - 2, Math.floor(gridZ)));

        // Bilinear interpolation
        const fx = gridX - x;
        const fz = gridZ - z;

        const h00 = this.getHeight(x, z);
        const h10 = this.getHeight(x + 1, z);
        const h01 = this.getHeight(x, z + 1);
        const h11 = this.getHeight(x + 1, z + 1);

        const h0 = h00 * (1 - fx) + h10 * fx;
        const h1 = h01 * (1 - fx) + h11 * fx;

        return h0 * (1 - fz) + h1 * fz;
    }

    /**
     * Modify terrain height in a circular area (brush)
     */
    applyBrush(worldX, worldZ, radius, strength, lower = false) {
        // Convert world position to grid coordinates
        const centerGridX = (worldX / this.size) * (this.resolution - 1);
        const centerGridZ = (worldZ / this.size) * (this.resolution - 1);

        const gridRadius = (radius / this.size) * (this.resolution - 1);

        // Iterate over affected grid cells
        const minX = Math.max(0, Math.floor(centerGridX - gridRadius));
        const maxX = Math.min(this.resolution - 1, Math.ceil(centerGridX + gridRadius));
        const minZ = Math.max(0, Math.floor(centerGridZ - gridRadius));
        const maxZ = Math.min(this.resolution - 1, Math.ceil(centerGridZ + gridRadius));

        for (let z = minZ; z <= maxZ; z++) {
            for (let x = minX; x <= maxX; x++) {
                // Distance from brush center
                const dx = x - centerGridX;
                const dz = z - centerGridZ;
                const dist = Math.sqrt(dx * dx + dz * dz);

                if (dist <= gridRadius) {
                    // Falloff: 1 at center, 0 at edge
                    const falloff = 1.0 - (dist / gridRadius);
                    const delta = strength * falloff * (lower ? -1 : 1);

                    const currentHeight = this.getHeight(x, z);
                    this.setHeight(x, z, currentHeight + delta);
                }
            }
        }

        this.terrainDirty = true;
    }

    /**
     * Add an object to the chunk
     */
    addObject(type, position, rotation = 0, scale = 1.0) {
        // Snap object to terrain height
        const terrainHeight = this.getHeightAt(position[0], position[2]);

        this.objects.push({
            type,
            position: [position[0], terrainHeight, position[2]],
            rotation,
            scale
        });
    }

    /**
     * Remove object at index
     */
    removeObject(index) {
        if (index >= 0 && index < this.objects.length) {
            this.objects.splice(index, 1);
        }
    }

    /**
     * Serialize chunk to JSON
     */
    toJSON() {
        return {
            version: "1.0",
            size: this.size,
            resolution: this.resolution,
            heights: Array.from(this.heights),
            objects: this.objects
        };
    }

    /**
     * Load chunk from JSON
     */
    fromJSON(data) {
        this.size = data.size;
        this.resolution = data.resolution;
        this.heights = new Float32Array(data.heights);
        this.objects = data.objects || [];
        this.terrainDirty = true;
    }

    /**
     * Reset chunk to flat terrain
     */
    reset() {
        this.heights.fill(0.0);
        this.objects = [];
        this.terrainDirty = true;
    }
}

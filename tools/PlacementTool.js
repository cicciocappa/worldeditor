/**
 * PlacementTool.js - Tool for placing static objects on terrain
 * Allows clicking to place trees, rocks, and other objects
 */

export class PlacementTool {
    constructor() {
        this.selectedType = 'tree_pine';  // Currently selected object type
        this.randomRotation = true;       // Randomize rotation on placement
    }

    /**
     * Place an object at world position
     */
    placeObject(chunk, worldX, worldZ) {
        // Ensure position is within chunk bounds
        if (worldX < 0 || worldX > chunk.size || worldZ < 0 || worldZ > chunk.size) {
            console.warn('Cannot place object outside chunk bounds');
            return false;
        }

        // Random rotation for variety
        const rotation = this.randomRotation ? Math.random() * Math.PI * 2 : 0;

        // Random scale variation (±10%)
        const scale = 0.9 + Math.random() * 0.2;

        // Place object (position will be adjusted to terrain height in Chunk.addObject)
        chunk.addObject(this.selectedType, [worldX, 0, worldZ], rotation, scale);

        return true;
    }

    /**
     * Set the currently selected object type
     */
    setObjectType(type) {
        this.selectedType = type;
    }

    /**
     * Get current object type
     */
    getObjectType() {
        return this.selectedType;
    }

    /**
     * Toggle random rotation
     */
    setRandomRotation(enabled) {
        this.randomRotation = enabled;
    }
}

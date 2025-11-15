/**
 * TerrainBrush.js - Tool for modifying terrain height with mouse
 * Supports raising/lowering terrain in a circular area
 */

export class TerrainBrush {
    constructor() {
        this.radius = 5.0;      // Brush radius in world units
        this.strength = 0.5;    // Brush strength
        this.isActive = false;  // Currently painting?
        this.lowerMode = false; // Lower instead of raise
    }

    /**
     * Apply brush to terrain at world position
     */
    apply(chunk, worldX, worldZ, deltaTime = 0.016) {
        if (!this.isActive) return;

        // Apply with time-based strength for smooth editing
        const timeAdjustedStrength = this.strength * deltaTime * 10;

        chunk.applyBrush(worldX, worldZ, this.radius, timeAdjustedStrength, this.lowerMode);
    }

    /**
     * Start painting
     */
    startPaint(lower = false) {
        this.isActive = true;
        this.lowerMode = lower;
    }

    /**
     * Stop painting
     */
    stopPaint() {
        this.isActive = false;
    }

    /**
     * Set brush radius
     */
    setRadius(radius) {
        this.radius = Math.max(0.5, Math.min(20, radius));
    }

    /**
     * Set brush strength
     */
    setStrength(strength) {
        this.strength = Math.max(0.1, Math.min(5.0, strength));
    }

    /**
     * Get current settings
     */
    getSettings() {
        return {
            radius: this.radius,
            strength: this.strength,
            isActive: this.isActive,
            lowerMode: this.lowerMode
        };
    }
}

/**
 * main.js - Application entry point
 * Initializes the engine and starts the editor
 */

import { Engine } from './core/Engine.js';
import { EditorUI } from './ui/EditorUI.js';

// Main application
class StyloWorldEditor {
    constructor() {
        this.engine = null;
        this.ui = null;
    }

    /**
     * Initialize and start the application
     */
    async init() {
        try {
            console.log('Starting StyloWorld Editor...');

            // Create engine
            this.engine = new Engine('gl-canvas');

            // Initialize engine (load shaders, setup renderers)
            await this.engine.init();

            // Create UI controller
            this.ui = new EditorUI(this.engine);

            // Start render loop
            this.engine.start();

            // Start update loop
            this.startUpdateLoop();

            console.log('StyloWorld Editor ready!');

        } catch (error) {
            console.error('Failed to initialize StyloWorld Editor:', error);
            alert('Failed to initialize WebGL 2. Please use a modern browser.');
        }
    }

    /**
     * Update loop for UI interactions
     */
    startUpdateLoop() {
        const update = () => {
            // Update FPS display
            this.ui.updateFPS(this.engine.getFPS());

            // Apply brush if painting
            this.ui.applyBrushAtMouse(this.engine.deltaTime);

            requestAnimationFrame(update);
        };

        update();
    }
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        const app = new StyloWorldEditor();
        app.init();
    });
} else {
    const app = new StyloWorldEditor();
    app.init();
}

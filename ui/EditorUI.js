/**
 * EditorUI.js - Handles all UI interactions and input events
 * Manages toolbar, mouse/keyboard input, and UI state
 */

import { ChunkIO } from '../io/ChunkIO.js';

export class EditorUI {
    constructor(engine) {
        this.engine = engine;

        // UI elements
        this.elements = {
            brushMode: document.getElementById('brush-mode'),
            placeMode: document.getElementById('place-mode'),
            objectType: document.getElementById('object-type'),
            brushStrength: document.getElementById('brush-strength'),
            brushStrengthValue: document.getElementById('brush-strength-value'),
            brushRadius: document.getElementById('brush-radius'),
            brushRadiusValue: document.getElementById('brush-radius-value'),
            bgColor: document.getElementById('bg-color'),
            showGrid: document.getElementById('show-grid'),
            gridY: document.getElementById('grid-y'),
            gridYValue: document.getElementById('grid-y-value'),
            gridColor: document.getElementById('grid-color'),
            save: document.getElementById('save'),
            load: document.getElementById('load'),
            new: document.getElementById('new'),
            fps: document.getElementById('fps'),
            modeInfo: document.getElementById('mode-info'),
            instructions: document.getElementById('instructions'),
            closeInstructions: document.getElementById('close-instructions')
        };

        // Current mode
        this.mode = 'brush'; // 'brush' or 'place'

        // Mouse state
        this.mouseDown = false;
        this.mouseButton = -1;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.currentMouseX = 0;
        this.currentMouseY = 0;

        // Preview object for placement mode
        this.previewObject = null;

        this.setupEventListeners();
    }

    /**
     * Setup all event listeners
     */
    setupEventListeners() {
        // Mode buttons
        this.elements.brushMode.addEventListener('click', () => this.setMode('brush'));
        this.elements.placeMode.addEventListener('click', () => this.setMode('place'));

        // Object type selector
        this.elements.objectType.addEventListener('change', (e) => {
            this.engine.placementTool.setObjectType(e.target.value);
            // Update preview object type if in place mode
            if (this.mode === 'place' && this.previewObject) {
                this.previewObject.type = e.target.value;
            }
        });

        // Brush controls
        this.elements.brushStrength.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.elements.brushStrengthValue.textContent = value.toFixed(1);
            this.engine.terrainBrush.setStrength(value);
        });

        this.elements.brushRadius.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.elements.brushRadiusValue.textContent = value.toFixed(1);
            this.engine.terrainBrush.setRadius(value);
        });

        // Background color picker
        this.elements.bgColor.addEventListener('input', (e) => {
            const hex = e.target.value;
            this.engine.setClearColor(hex);
        });

        // Grid controls
        this.elements.showGrid.addEventListener('change', (e) => {
            this.engine.gridRenderer.setVisible(e.target.checked);
        });

        this.elements.gridY.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.elements.gridYValue.textContent = value.toFixed(1);
            this.engine.gridRenderer.setGridY(value);
        });

        this.elements.gridColor.addEventListener('change', (e) => {
            this.engine.gridRenderer.setColorScheme(e.target.value);
        });

        // File operations
        this.elements.save.addEventListener('click', () => {
            ChunkIO.saveChunk(this.engine.chunk);
        });

        this.elements.load.addEventListener('click', () => {
            ChunkIO.loadChunk(this.engine.chunk).then(() => {
                // Mark terrain as dirty to regenerate mesh
                this.engine.chunk.terrainDirty = true;
            }).catch(err => {
                console.error('Failed to load chunk:', err);
            });
        });

        this.elements.new.addEventListener('click', () => {
            if (confirm('Create new chunk? Current work will be lost unless saved.')) {
                this.engine.chunk.reset();
            }
        });

        // Instructions dialog
        this.elements.closeInstructions.addEventListener('click', () => {
            this.elements.instructions.classList.add('instructions-hidden');
        });

        // Canvas mouse events
        const canvas = this.engine.canvas;

        canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        canvas.addEventListener('wheel', (e) => this.onWheel(e));
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        // Keyboard shortcuts
        window.addEventListener('keydown', (e) => this.onKeyDown(e));
        window.addEventListener('keyup', (e) => this.onKeyUp(e));
    }

    /**
     * Set editor mode
     */
    setMode(mode) {
        this.mode = mode;

        // Update button states
        this.elements.brushMode.classList.toggle('active', mode === 'brush');
        this.elements.placeMode.classList.toggle('active', mode === 'place');

        // Update info text
        this.elements.modeInfo.textContent = `Mode: ${mode === 'brush' ? 'Brush' : 'Place'}`;

        // Create preview object when entering place mode
        if (mode === 'place') {
            this.createPreviewObject();
        } else {
            this.previewObject = null;
        }
    }

    /**
     * Create a preview object for placement mode
     */
    createPreviewObject() {
        const objectType = this.engine.placementTool.getObjectType();
        this.previewObject = {
            type: objectType,
            position: [0, 0, 0],
            rotation: 0,
            scale: 1.0,
            visible: false,
            alpha: 0.5  // Semi-transparent
        };
    }

    /**
     * Mouse down handler
     */
    onMouseDown(e) {
        this.mouseDown = true;
        this.mouseButton = e.button;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        this.currentMouseX = e.clientX;
        this.currentMouseY = e.clientY;

        // Left click
        if (e.button === 0) {
            if (this.mode === 'brush') {
                // Start brush painting
                const lower = e.ctrlKey || e.metaKey;
                this.engine.terrainBrush.startPaint(lower);
            } else if (this.mode === 'place') {
                // Place object
                this.placeObjectAtMouse(e);
            }
        }
    }

    /**
     * Mouse move handler
     */
    onMouseMove(e) {
        const deltaX = e.clientX - this.lastMouseX;
        const deltaY = e.clientY - this.lastMouseY;

        this.currentMouseX = e.clientX;
        this.currentMouseY = e.clientY;

        if (this.mouseDown) {
            // Right or middle mouse: rotate camera
            if (this.mouseButton === 1 || this.mouseButton === 2) {
                const rotSpeed = 0.005;
                this.engine.camera.rotate(deltaX * rotSpeed, -deltaY * rotSpeed);
            }
            // Left mouse in brush mode: continue painting
            else if (this.mouseButton === 0 && this.mode === 'brush') {
                // Brush painting happens in update loop
            }
        }

        // Update preview object position in place mode
        if (this.mode === 'place' && this.previewObject) {
            this.updatePreviewPosition(e);
        }

        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
    }

    /**
     * Update preview object position to follow mouse cursor
     */
    updatePreviewPosition(e) {
        const rect = this.engine.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Cast ray from camera through mouse position
        const ray = this.engine.camera.screenToRay(x, y);

        // Find terrain intersection
        const intersection = this.findTerrainIntersection(ray);

        if (intersection) {
            this.previewObject.position = intersection;
            this.previewObject.visible = true;

            // Add random rotation for preview
            if (!this.previewObject.rotation) {
                this.previewObject.rotation = Math.random() * Math.PI * 2;
            }

            // Add scale variation for preview
            if (this.previewObject.scale === 1.0) {
                this.previewObject.scale = 0.9 + Math.random() * 0.2;
            }
        } else {
            this.previewObject.visible = false;
        }
    }

    /**
     * Mouse up handler
     */
    onMouseUp(e) {
        this.mouseDown = false;

        if (this.mode === 'brush') {
            this.engine.terrainBrush.stopPaint();
        }
    }

    /**
     * Mouse wheel handler
     */
    onWheel(e) {
        e.preventDefault();
        const zoomSpeed = 0.1;
        this.engine.camera.zoom(e.deltaY * zoomSpeed);
    }

    /**
     * Keyboard down handler
     */
    onKeyDown(e) {
        switch (e.key.toLowerCase()) {
            case 'b':
                this.setMode('brush');
                break;
            case 'p':
                this.setMode('place');
                break;
        }
    }

    /**
     * Keyboard up handler
     */
    onKeyUp(e) {
        // Handle key releases if needed
    }

    /**
     * Place object at mouse cursor position
     */
    placeObjectAtMouse(e) {
        // Use preview object position if available
        if (this.previewObject && this.previewObject.visible) {
            const pos = this.previewObject.position;
            this.engine.placementTool.placeObject(
                this.engine.chunk,
                pos[0],
                pos[2]
            );

            // Generate new random values for next preview
            this.previewObject.rotation = Math.random() * Math.PI * 2;
            this.previewObject.scale = 0.9 + Math.random() * 0.2;
        }
    }

    /**
     * Find intersection point with terrain using ray marching
     */
    findTerrainIntersection(ray) {
        const { origin, direction } = ray;
        const maxDistance = 200;
        const step = 0.5;

        for (let t = 0; t < maxDistance; t += step) {
            const worldPoint = [
                origin[0] + direction[0] * t,
                origin[1] + direction[1] * t,
                origin[2] + direction[2] * t
            ];

            // Convert world coordinates (centered at origin) to chunk coordinates (0-64)
            const chunkX = worldPoint[0] + 32;
            const chunkZ = worldPoint[2] + 32;

            // Check if within chunk bounds
            if (chunkX >= 0 && chunkX <= this.engine.chunk.size &&
                chunkZ >= 0 && chunkZ <= this.engine.chunk.size) {

                const terrainHeight = this.engine.chunk.getHeightAt(chunkX, chunkZ);

                // Check if ray intersects terrain
                if (worldPoint[1] <= terrainHeight) {
                    // Return chunk coordinates for tools to use
                    return [chunkX, terrainHeight, chunkZ];
                }
            }
        }

        // Fallback to Y=0 plane intersection, converted to chunk coordinates
        const worldIntersection = this.engine.camera.rayPlaneIntersection(ray, 0);
        if (worldIntersection) {
            return [
                worldIntersection[0] + 32,
                worldIntersection[1],
                worldIntersection[2] + 32
            ];
        }
        return null;
    }

    /**
     * Update FPS display
     */
    updateFPS(fps) {
        this.elements.fps.textContent = `FPS: ${Math.round(fps)}`;
    }

    /**
     * Apply brush at current mouse position
     */
    applyBrushAtMouse(deltaTime) {
        if (!this.mouseDown || this.mode !== 'brush') return;

        const rect = this.engine.canvas.getBoundingClientRect();
        const x = this.currentMouseX - rect.left;
        const y = this.currentMouseY - rect.top;

        // Cast ray
        const ray = this.engine.camera.screenToRay(x, y);
        const intersection = this.findTerrainIntersection(ray);

        if (intersection) {
            this.engine.terrainBrush.apply(
                this.engine.chunk,
                intersection[0],
                intersection[2],
                deltaTime
            );
        }
    }

    /**
     * Get the current preview object (for rendering)
     */
    getPreviewObject() {
        return this.previewObject;
    }
}

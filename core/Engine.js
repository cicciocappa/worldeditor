/**
 * Engine.js - Main engine class
 * Handles WebGL 2 initialization, render loop, and coordination of all systems
 */

// gl-matrix is loaded globally via CDN
const { mat4 } = glMatrix;

import { Camera } from './Camera.js';
import { Chunk } from '../scene/Chunk.js';
import { TerrainRenderer } from '../rendering/TerrainRenderer.js';
import { ObjectRenderer } from '../rendering/ObjectRenderer.js';
import { GridRenderer } from '../rendering/GridRenderer.js';
import { TerrainBrush } from '../tools/TerrainBrush.js';
import { PlacementTool } from '../tools/PlacementTool.js';

export class Engine {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            throw new Error(`Canvas with id "${canvasId}" not found`);
        }

        // Initialize WebGL 2 context
        this.gl = this.canvas.getContext('webgl2', {
            antialias: true,
            alpha: false
        });

        if (!this.gl) {
            throw new Error('WebGL 2 not supported');
        }

        // Core systems
        this.camera = null;
        this.chunk = null;

        // Renderers
        this.terrainRenderer = null;
        this.objectRenderer = null;
        this.gridRenderer = null;

        // Light direction (azimuth and elevation in degrees)
        this.lightAzimuth = 45;     // 0-360 degrees (compass direction)
        this.lightElevation = 45;   // 10-80 degrees (angle above horizon)

        // Tools
        this.terrainBrush = new TerrainBrush();
        this.placementTool = new PlacementTool();

        // UI reference (set later)
        this.ui = null;

        // Timing
        this.lastFrameTime = 0;
        this.deltaTime = 0;
        this.fps = 0;
        this.frameCount = 0;
        this.fpsUpdateTime = 0;

        // State
        this.isRunning = false;

        this.setupCanvas();
        this.setupWebGL();
    }

    /**
     * Setup canvas and handle resizing
     */
    setupCanvas() {
        const resize = () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;

            if (this.gl) {
                this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
            }

            if (this.camera) {
                this.camera.resize();
            }
        };

        window.addEventListener('resize', resize);
        resize();
    }

    /**
     * Setup WebGL state
     */
    setupWebGL() {
        const gl = this.gl;

        // Enable depth testing
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LESS);

        // Enable face culling
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);

        // Set clear color
        gl.clearColor(0.1, 0.1, 0.15, 1.0);
    }

    /**
     * Load shader source from file
     */
    async loadShader(path) {
        const response = await fetch(path);
        if (!response.ok) {
            throw new Error(`Failed to load shader: ${path}`);
        }
        return await response.text();
    }

    /**
     * Initialize the engine
     */
    async init() {
        console.log('Initializing StyloWorld Engine...');

        // Create camera
        this.camera = new Camera(this.canvas);

        // Create chunk
        this.chunk = new Chunk(64, 65);

        // Create some initial terrain features for testing
        this.createInitialTerrain();

        // Load shaders
        const terrainVert = await this.loadShader('shaders/terrain.vert');
        const terrainFrag = await this.loadShader('shaders/terrain.frag');
        const gridVert = await this.loadShader('shaders/grid.vert');
        const gridFrag = await this.loadShader('shaders/grid.frag');

        // Initialize renderers
        this.terrainRenderer = new TerrainRenderer(this.gl);
        await this.terrainRenderer.init(terrainVert, terrainFrag);

        this.objectRenderer = new ObjectRenderer(this.gl);
        await this.objectRenderer.init(terrainVert, terrainFrag);

        this.gridRenderer = new GridRenderer(this.gl);
        await this.gridRenderer.init(gridVert, gridFrag);

        // Generate initial terrain mesh
        this.terrainRenderer.generateMesh(this.chunk);
        this.chunk.terrainDirty = false;

        console.log('Engine initialized successfully!');
        console.log('WebGL Viewport:', this.gl.getParameter(this.gl.VIEWPORT));
        console.log('WebGL version:', this.gl.getParameter(this.gl.VERSION));
        console.log('Canvas dimensions:', this.canvas.width, 'x', this.canvas.height);
    }

    /**
     * Create some initial terrain features
     */
    createInitialTerrain() {
        // Create a gentle hill in the center
        const centerX = this.chunk.size / 2;
        const centerZ = this.chunk.size / 2;

        for (let z = 0; z < this.chunk.resolution; z++) {
            for (let x = 0; x < this.chunk.resolution; x++) {
                const worldX = (x / (this.chunk.resolution - 1)) * this.chunk.size;
                const worldZ = (z / (this.chunk.resolution - 1)) * this.chunk.size;

                const dx = worldX - centerX;
                const dz = worldZ - centerZ;
                const dist = Math.sqrt(dx * dx + dz * dz);

                // Smooth hill
                const height = Math.max(0, 3 * Math.exp(-dist / 15));

                this.chunk.setHeight(x, z, height);
            }
        }
    }

    /**
     * Start the render loop
     */
    start() {
        this.isRunning = true;
        this.lastFrameTime = performance.now();
        this.requestFrame();
    }

    /**
     * Stop the render loop
     */
    stop() {
        this.isRunning = false;
    }

    /**
     * Request next animation frame
     */
    requestFrame() {
        if (this.isRunning) {
            requestAnimationFrame((time) => this.render(time));
        }
    }

    /**
     * Main render loop
     */
    render(currentTime) {
        // Calculate delta time
        this.deltaTime = (currentTime - this.lastFrameTime) / 1000;
        this.lastFrameTime = currentTime;

        // Update FPS counter
        this.frameCount++;
        if (currentTime - this.fpsUpdateTime >= 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.fpsUpdateTime = currentTime;
        }

        // Update systems
        this.update();

        // Render scene
        this.renderScene();

        // Request next frame
        this.requestFrame();
    }

    /**
     * Update game logic
     */
    update() {
        // Regenerate terrain mesh if dirty
        if (this.chunk.terrainDirty) {
            this.terrainRenderer.generateMesh(this.chunk);
            this.chunk.terrainDirty = false;
        }
    }

    /**
     * Render the scene
     */
    renderScene() {
        const gl = this.gl;

        // Clear buffers
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // Get current light direction
        const lightDir = this.getLightDirection();

        // 1. Render grid first (as reference)
        this.gridRenderer.render(this.camera);

        // 2. Render main geometry with dynamic lighting
        this.terrainRenderer.render(this.camera, lightDir);
        this.objectRenderer.render(this.chunk, this.camera, lightDir);

        // 3. Render preview object (semi-transparent)
        if (this.ui) {
            const previewObject = this.ui.getPreviewObject();
            if (previewObject) {
                this.objectRenderer.renderPreview(previewObject, this.camera, lightDir);
            }
        }
    }

    /**
     * Get current FPS
     */
    getFPS() {
        return this.fps;
    }

    /**
     * Set WebGL clear color from hex string
     */
    setClearColor(hex) {
        // Convert hex to RGB (0-1 range)
        const r = parseInt(hex.substr(1, 2), 16) / 255;
        const g = parseInt(hex.substr(3, 2), 16) / 255;
        const b = parseInt(hex.substr(5, 2), 16) / 255;

        this.gl.clearColor(r, g, b, 1.0);
        console.log(`Clear color set to: ${hex} (${r.toFixed(2)}, ${g.toFixed(2)}, ${b.toFixed(2)})`);
    }

    /**
     * Set UI reference (called after UI is created)
     */
    setUI(ui) {
        this.ui = ui;
    }

    /**
     * Set light direction from azimuth and elevation angles
     * @param {number} azimuth - Horizontal angle in degrees (0-360)
     * @param {number} elevation - Vertical angle in degrees (10-80)
     */
    setLightDirection(azimuth, elevation) {
        this.lightAzimuth = azimuth;
        this.lightElevation = elevation;
    }

    /**
     * Get light direction vector from current azimuth/elevation
     * @returns {Array} Normalized direction vector [x, y, z]
     */
    getLightDirection() {
        // Convert degrees to radians
        const azimuthRad = (this.lightAzimuth * Math.PI) / 180;
        const elevationRad = (this.lightElevation * Math.PI) / 180;

        // Calculate direction vector
        // Azimuth 0 = North (+Z), 90 = East (+X), 180 = South (-Z), 270 = West (-X)
        // Elevation is angle above horizon
        const x = Math.cos(elevationRad) * Math.sin(azimuthRad);
        const y = Math.sin(elevationRad);
        const z = Math.cos(elevationRad) * Math.cos(azimuthRad);

        return [x, y, z];
    }
}

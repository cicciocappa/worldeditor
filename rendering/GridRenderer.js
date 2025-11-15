/**
 * GridRenderer.js - Renders a reference grid at y=0
 * Helps visualize scene orientation and camera position
 */

import { Math3D } from '../utils/Math3D.js';

export class GridRenderer {
    constructor(gl) {
        this.gl = gl;

        // Shader program
        this.program = null;

        // Uniform locations
        this.uniforms = {};

        // Vertex array object and buffers
        this.vao = null;
        this.vertexBuffer = null;

        // Grid data
        this.vertexCount = 0;

        // Grid settings
        this.gridSize = 80;      // Total grid size (covers 64x64 chunk + margins)
        this.gridSpacing = 4;    // Spacing between grid lines
        this.gridColor = [0.3, 0.3, 0.4]; // Dark blue-gray
        this.axisXColor = [0.8, 0.2, 0.2]; // Red for X axis
        this.axisZColor = [0.2, 0.2, 0.8]; // Blue for Z axis
    }

    /**
     * Initialize shader program
     */
    async init(vertexShaderSource, fragmentShaderSource) {
        const gl = this.gl;

        // Compile shaders
        const vertexShader = this.compileShader(gl.VERTEX_SHADER, vertexShaderSource);
        const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);

        // Link program
        this.program = gl.createProgram();
        gl.attachShader(this.program, vertexShader);
        gl.attachShader(this.program, fragmentShader);
        gl.linkProgram(this.program);

        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
            console.error('Grid shader link error:', gl.getProgramInfoLog(this.program));
            return;
        }

        // Get uniform locations
        this.uniforms.uModelViewProjection = gl.getUniformLocation(this.program, 'uModelViewProjection');
        this.uniforms.uColor = gl.getUniformLocation(this.program, 'uColor');

        // Create VAO and buffers
        this.vao = gl.createVertexArray();
        this.vertexBuffer = gl.createBuffer();

        // Generate grid mesh
        this.generateGrid();
    }

    /**
     * Compile a shader
     */
    compileShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Grid shader compile error:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }

        return shader;
    }

    /**
     * Generate grid lines at y=0
     */
    generateGrid() {
        const vertices = [];
        const halfSize = this.gridSize / 2;

        // Generate grid lines parallel to X axis (running along Z)
        for (let z = -halfSize; z <= halfSize; z += this.gridSpacing) {
            vertices.push(-halfSize, 0, z);  // Start point
            vertices.push(halfSize, 0, z);   // End point
        }

        // Generate grid lines parallel to Z axis (running along X)
        for (let x = -halfSize; x <= halfSize; x += this.gridSpacing) {
            vertices.push(x, 0, -halfSize);  // Start point
            vertices.push(x, 0, halfSize);   // End point
        }

        this.vertexCount = vertices.length / 3;

        // Upload to GPU
        const gl = this.gl;
        gl.bindVertexArray(this.vao);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

        gl.bindVertexArray(null);
    }

    /**
     * Render the grid
     */
    render(camera) {
        if (!this.program || this.vertexCount === 0) return;

        const gl = this.gl;

        // Disable depth writing for grid (draw behind everything)
        gl.depthMask(false);

        gl.useProgram(this.program);

        // Set uniforms
        const modelMatrix = Math3D.identity();
        const mvpMatrix = Math3D.multiply(camera.viewProjectionMatrix, modelMatrix);

        gl.uniformMatrix4fv(this.uniforms.uModelViewProjection, false, mvpMatrix);
        gl.uniform3fv(this.uniforms.uColor, this.gridColor);

        // Draw grid lines
        gl.bindVertexArray(this.vao);
        gl.drawArrays(gl.LINES, 0, this.vertexCount);
        gl.bindVertexArray(null);

        // Draw axis lines with different colors
        this.renderAxes(camera);

        // Re-enable depth writing
        gl.depthMask(true);
    }

    /**
     * Render X and Z axis lines with distinct colors
     */
    renderAxes(camera) {
        const gl = this.gl;
        const halfSize = this.gridSize / 2;

        // Create axis line vertices
        const axisVertices = [
            // X axis (red)
            -halfSize, 0, 0,
            halfSize, 0, 0,
            // Z axis (blue)
            0, 0, -halfSize,
            0, 0, halfSize
        ];

        // Create temporary buffer for axes
        const axisBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, axisBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(axisVertices), gl.STATIC_DRAW);

        const axisVao = gl.createVertexArray();
        gl.bindVertexArray(axisVao);
        gl.bindBuffer(gl.ARRAY_BUFFER, axisBuffer);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

        const modelMatrix = Math3D.identity();
        const mvpMatrix = Math3D.multiply(camera.viewProjectionMatrix, modelMatrix);
        gl.uniformMatrix4fv(this.uniforms.uModelViewProjection, false, mvpMatrix);

        // Draw X axis in red
        gl.uniform3fv(this.uniforms.uColor, this.axisXColor);
        gl.drawArrays(gl.LINES, 0, 2);

        // Draw Z axis in blue
        gl.uniform3fv(this.uniforms.uColor, this.axisZColor);
        gl.drawArrays(gl.LINES, 2, 2);

        // Cleanup
        gl.bindVertexArray(null);
        gl.deleteVertexArray(axisVao);
        gl.deleteBuffer(axisBuffer);
    }
}

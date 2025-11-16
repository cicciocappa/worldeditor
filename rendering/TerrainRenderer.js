/**
 * TerrainRenderer.js - Generates and renders terrain mesh from heightmap
 * Creates a grid mesh with flat shading from chunk height data
 */

// gl-matrix is loaded globally via CDN
const { mat4, vec3 } = glMatrix;

export class TerrainRenderer {
    constructor(gl) {
        this.gl = gl;

        // Shader program
        this.program = null;

        // Uniform locations
        this.uniforms = {};

        // Vertex array object and buffers
        this.vao = null;
        this.vertexBuffer = null;
        this.normalBuffer = null;
        this.indexBuffer = null;

        // Mesh data
        this.indexCount = 0;

        // Terrain color
        this.color = [0.5, 0.5, 0.5]; // Gray
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
            console.error('Terrain shader link error:', gl.getProgramInfoLog(this.program));
            return;
        }

        console.log('Terrain shader compiled and linked successfully');

        // Get uniform locations
        this.uniforms.uModelViewProjection = gl.getUniformLocation(this.program, 'uModelViewProjection');
        this.uniforms.uModel = gl.getUniformLocation(this.program, 'uModel');
        this.uniforms.uColor = gl.getUniformLocation(this.program, 'uColor');
        this.uniforms.uLightDir = gl.getUniformLocation(this.program, 'uLightDir');
        this.uniforms.uAlpha = gl.getUniformLocation(this.program, 'uAlpha');

        // Create VAO and buffers
        this.vao = gl.createVertexArray();
        this.vertexBuffer = gl.createBuffer();
        this.normalBuffer = gl.createBuffer();
        this.indexBuffer = gl.createBuffer();
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
            console.error('Shader compile error:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }

        return shader;
    }

    /**
     * Generate terrain mesh from chunk heightmap
     */
    generateMesh(chunk) {
        const resolution = chunk.resolution;
        const size = chunk.size;
        const heights = chunk.heights;

        const vertices = [];
        const normals = [];
        const indices = [];

        // Generate vertices
        for (let z = 0; z < resolution; z++) {
            for (let x = 0; x < resolution; x++) {
                const worldX = (x / (resolution - 1)) * size;
                const worldZ = (z / (resolution - 1)) * size;
                const height = heights[z * resolution + x];

                vertices.push(worldX, height, worldZ);
            }
        }

        // Generate indices and compute flat normals
        for (let z = 0; z < resolution - 1; z++) {
            for (let x = 0; x < resolution - 1; x++) {
                const topLeft = z * resolution + x;
                const topRight = topLeft + 1;
                const bottomLeft = (z + 1) * resolution + x;
                const bottomRight = bottomLeft + 1;

                // Two triangles per quad
                // Triangle 1
                indices.push(topLeft, bottomLeft, topRight);
                // Triangle 2
                indices.push(topRight, bottomLeft, bottomRight);
            }
        }

        // Compute flat normals (one normal per triangle)
        const flatNormals = new Array(vertices.length).fill(0);

        for (let i = 0; i < indices.length; i += 3) {
            const i0 = indices[i] * 3;
            const i1 = indices[i + 1] * 3;
            const i2 = indices[i + 2] * 3;

            // Get triangle vertices
            const v0 = vec3.fromValues(vertices[i0], vertices[i0 + 1], vertices[i0 + 2]);
            const v1 = vec3.fromValues(vertices[i1], vertices[i1 + 1], vertices[i1 + 2]);
            const v2 = vec3.fromValues(vertices[i2], vertices[i2 + 1], vertices[i2 + 2]);

            // Compute edges
            const e1 = vec3.create();
            const e2 = vec3.create();
            vec3.subtract(e1, v1, v0);
            vec3.subtract(e2, v2, v0);

            // Cross product for normal
            const n = vec3.create();
            vec3.cross(n, e1, e2);
            vec3.normalize(n, n);

            // Assign same normal to all three vertices (flat shading)
            flatNormals[i0] = flatNormals[i1] = flatNormals[i2] = n[0];
            flatNormals[i0 + 1] = flatNormals[i1 + 1] = flatNormals[i2 + 1] = n[1];
            flatNormals[i0 + 2] = flatNormals[i1 + 2] = flatNormals[i2 + 2] = n[2];
        }

        // Upload to GPU
        this.uploadMesh(new Float32Array(vertices), new Float32Array(flatNormals), new Uint16Array(indices));

        console.log(`Terrain mesh generated: ${vertices.length / 3} vertices, ${indices.length / 3} triangles`);
    }

    /**
     * Upload mesh data to GPU
     */
    uploadMesh(vertices, normals, indices) {
        const gl = this.gl;

        gl.bindVertexArray(this.vao);

        // Vertex positions
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

        // Normals
        gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);

        // Indices
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

        this.indexCount = indices.length;

        gl.bindVertexArray(null);
    }

    /**
     * Render the terrain
     */
    render(camera) {
        if (!this.program || this.indexCount === 0) {
            console.warn('Terrain render skipped - program:', !!this.program, 'indexCount:', this.indexCount);
            return;
        }

        const gl = this.gl;

        gl.useProgram(this.program);

        // Set uniforms
        // Translate terrain to center it at origin (chunk goes from 0-64, we want -32 to +32)
        const modelMatrix = mat4.create();
        mat4.translate(modelMatrix, modelMatrix, [-32, 0, -32]);

        const mvpMatrix = mat4.create();
        mat4.multiply(mvpMatrix, camera.viewProjectionMatrix, modelMatrix);

        gl.uniformMatrix4fv(this.uniforms.uModelViewProjection, false, mvpMatrix);
        gl.uniformMatrix4fv(this.uniforms.uModel, false, modelMatrix);
        gl.uniform3fv(this.uniforms.uColor, this.color);
        gl.uniform3f(this.uniforms.uLightDir, 0.5, 0.7, 0.3); // Directional light
        gl.uniform1f(this.uniforms.uAlpha, 1.0); // Terrain is fully opaque

        // Draw
        gl.bindVertexArray(this.vao);
        gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
        gl.bindVertexArray(null);
    }

    /**
     * Get buffers for outline rendering
     */
    getBuffers() {
        return {
            vao: this.vao,
            indexCount: this.indexCount
        };
    }
}

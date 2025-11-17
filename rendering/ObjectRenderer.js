/**
 * ObjectRenderer.js - Renders static 3D objects (trees, rocks, bushes)
 * Uses the same shader as terrain for consistency
 */

// gl-matrix is loaded globally via CDN
const { mat4 } = glMatrix;

import { MeshGenerator } from '../utils/MeshGenerator.js';

export class ObjectRenderer {
    constructor(gl) {
        this.gl = gl;

        // Shader program (shared with terrain)
        this.program = null;

        // Uniform locations
        this.uniforms = {};

        // Object meshes library
        this.meshes = new Map();

        // Object colors
        this.objectColors = {
            tree_pine: [0.2, 0.5, 0.2],    // Dark green
            rock_large: [0.4, 0.4, 0.45],  // Gray
            bush_small: [0.3, 0.6, 0.3]    // Light green
        };
    }

    /**
     * Initialize renderer and load object meshes
     */
    async init(vertexShaderSource, fragmentShaderSource) {
        const gl = this.gl;

        // Compile shaders (reuse terrain shader)
        const vertexShader = this.compileShader(gl.VERTEX_SHADER, vertexShaderSource);
        const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);

        // Link program
        this.program = gl.createProgram();
        gl.attachShader(this.program, vertexShader);
        gl.attachShader(this.program, fragmentShader);
        gl.linkProgram(this.program);

        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
            console.error('Object shader link error:', gl.getProgramInfoLog(this.program));
            return;
        }

        // Get uniform locations
        this.uniforms.uModelViewProjection = gl.getUniformLocation(this.program, 'uModelViewProjection');
        this.uniforms.uModel = gl.getUniformLocation(this.program, 'uModel');
        this.uniforms.uColor = gl.getUniformLocation(this.program, 'uColor');
        this.uniforms.uLightDir = gl.getUniformLocation(this.program, 'uLightDir');
        this.uniforms.uAlpha = gl.getUniformLocation(this.program, 'uAlpha');
        this.uniforms.uLightSpaceMatrix = gl.getUniformLocation(this.program, 'uLightSpaceMatrix');
        this.uniforms.uShadowMap = gl.getUniformLocation(this.program, 'uShadowMap');

        // Load object meshes
        this.loadMesh('tree_pine', MeshGenerator.generatePineTree());
        this.loadMesh('rock_large', MeshGenerator.generateRock());
        this.loadMesh('bush_small', MeshGenerator.generateBush());
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
     * Load and upload a mesh to GPU
     */
    loadMesh(name, meshData) {
        const gl = this.gl;

        // Create VAO and buffers
        const vao = gl.createVertexArray();
        const vertexBuffer = gl.createBuffer();
        const normalBuffer = gl.createBuffer();
        const indexBuffer = gl.createBuffer();

        gl.bindVertexArray(vao);

        // Vertex positions
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, meshData.vertices, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

        // Normals
        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, meshData.normals, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);

        // Indices
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, meshData.indices, gl.STATIC_DRAW);

        gl.bindVertexArray(null);

        // Store mesh info
        this.meshes.set(name, {
            vao,
            indexCount: meshData.indices.length,
            vertexBuffer,
            normalBuffer,
            indexBuffer
        });
    }

    /**
     * Render all objects in the chunk
     */
    render(chunk, camera, lightDir = [0.5, 0.7, 0.3], lightSpaceMatrix = null) {
        if (!this.program) return;

        const gl = this.gl;
        gl.useProgram(this.program);

        // Render each object
        for (const obj of chunk.objects) {
            this.renderObject(obj, camera, 1.0, lightDir, lightSpaceMatrix);
        }
    }

    /**
     * Render a single object
     */
    renderObject(obj, camera, alpha = 1.0, lightDir = [0.5, 0.7, 0.3], lightSpaceMatrix = null) {
        const mesh = this.meshes.get(obj.type);
        if (!mesh) {
            console.warn('Unknown object type:', obj.type);
            return;
        }

        const gl = this.gl;

        // Enable blending for transparency
        const needsBlending = alpha < 1.0;
        if (needsBlending) {
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        }

        // Build model matrix
        // Convert chunk coordinates (0-64) to world coordinates (centered at origin)
        const worldPos = [
            obj.position[0] - 32,
            obj.position[1],
            obj.position[2] - 32
        ];

        const modelMatrix = mat4.create();
        mat4.translate(modelMatrix, modelMatrix, worldPos);
        mat4.rotateY(modelMatrix, modelMatrix, obj.rotation);
        mat4.scale(modelMatrix, modelMatrix, [obj.scale, obj.scale, obj.scale]);

        // Compute MVP
        const mvpMatrix = mat4.create();
        mat4.multiply(mvpMatrix, camera.viewProjectionMatrix, modelMatrix);

        // Set uniforms
        gl.uniformMatrix4fv(this.uniforms.uModelViewProjection, false, mvpMatrix);
        gl.uniformMatrix4fv(this.uniforms.uModel, false, modelMatrix);

        const color = this.objectColors[obj.type] || [0.5, 0.5, 0.5];
        gl.uniform3fv(this.uniforms.uColor, color);
        gl.uniform3fv(this.uniforms.uLightDir, lightDir);
        gl.uniform1f(this.uniforms.uAlpha, alpha);

        // Shadow mapping uniforms
        if (lightSpaceMatrix) {
            gl.uniformMatrix4fv(this.uniforms.uLightSpaceMatrix, false, lightSpaceMatrix);
        }
        // Shadow map is bound externally before rendering
        gl.uniform1i(this.uniforms.uShadowMap, 0); // Texture unit 0

        // Draw
        gl.bindVertexArray(mesh.vao);
        gl.drawElements(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_SHORT, 0);
        gl.bindVertexArray(null);

        // Disable blending if it was enabled
        if (needsBlending) {
            gl.disable(gl.BLEND);
        }
    }

    /**
     * Render preview object (semi-transparent)
     */
    renderPreview(previewObj, camera, lightDir = [0.5, 0.7, 0.3], lightSpaceMatrix = null) {
        if (!previewObj || !previewObj.visible) return;

        const alpha = previewObj.alpha || 0.5;
        this.renderObject(previewObj, camera, alpha, lightDir, lightSpaceMatrix);
    }

    /**
     * Render outlines for all objects
     */
    renderOutlines(chunk, camera, outlineRenderer) {
        if (!this.program) return;

        for (const obj of chunk.objects) {
            const mesh = this.meshes.get(obj.type);
            if (!mesh) continue;

            // Build model matrix
            // Convert chunk coordinates (0-64) to world coordinates (centered at origin)
            const worldPos = [
                obj.position[0] - 32,
                obj.position[1],
                obj.position[2] - 32
            ];

            const modelMatrix = mat4.create();
            mat4.translate(modelMatrix, modelMatrix, worldPos);
            mat4.rotateY(modelMatrix, modelMatrix, obj.rotation);
            mat4.scale(modelMatrix, modelMatrix, [obj.scale, obj.scale, obj.scale]);

            // Render outline
            outlineRenderer.render(mesh, camera, modelMatrix);
        }
    }

    /**
     * Get mesh data for an object type
     */
    getMesh(type) {
        return this.meshes.get(type);
    }
}

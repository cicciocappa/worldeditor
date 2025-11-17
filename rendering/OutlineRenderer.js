/**
 * OutlineRenderer.js - Renders black outline around meshes
 * Uses double-pass technique: expand geometry along normals
 */

// gl-matrix is loaded globally via CDN
const { mat4 } = glMatrix;

export class OutlineRenderer {
    constructor(gl) {
        this.gl = gl;

        // Shader program
        this.program = null;

        // Uniform locations
        this.uniforms = {};

        // Outline settings
        this.outlineWidth = 0.15;
        this.outlineColor = [0.0, 0.0, 0.0]; // Black
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
            console.error('Outline shader link error:', gl.getProgramInfoLog(this.program));
            return;
        }

        // Get uniform locations
        this.uniforms.uModelViewProjection = gl.getUniformLocation(this.program, 'uModelViewProjection');
        this.uniforms.uOutlineWidth = gl.getUniformLocation(this.program, 'uOutlineWidth');
        this.uniforms.uOutlineColor = gl.getUniformLocation(this.program, 'uOutlineColor');
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
     * Render outline for a mesh
     * @param {Object} buffers - VAO and index count from renderer
     * @param {Camera} camera - Camera for view-projection matrix
     * @param {Float32Array} modelMatrix - Model transformation matrix
     */
    render(buffers, camera, modelMatrix = null) {
        if (!this.program || !buffers.vao) return;

        const gl = this.gl;

        gl.useProgram(this.program);

        // Set uniforms
        const model = modelMatrix || mat4.create();
        const mvpMatrix = mat4.create();
        mat4.multiply(mvpMatrix, camera.viewProjectionMatrix, model);

        gl.uniformMatrix4fv(this.uniforms.uModelViewProjection, false, mvpMatrix);
        gl.uniform1f(this.uniforms.uOutlineWidth, this.outlineWidth);
        gl.uniform3fv(this.uniforms.uOutlineColor, this.outlineColor);

        // Disable depth writing so outline doesn't block the main geometry
        // but keep depth testing enabled so outline respects depth
        gl.depthMask(false);

        // Render with front-face culling (show only back faces)
        // This creates the outline effect
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.FRONT);

        // Draw
        gl.bindVertexArray(buffers.vao);
        gl.drawElements(gl.TRIANGLES, buffers.indexCount, gl.UNSIGNED_SHORT, 0);
        gl.bindVertexArray(null);

        // Restore normal culling and depth writing
        gl.cullFace(gl.BACK);
        gl.depthMask(true);
    }

    /**
     * Set outline width
     */
    setWidth(width) {
        this.outlineWidth = width;
    }

    /**
     * Set outline color
     */
    setColor(r, g, b) {
        this.outlineColor = [r, g, b];
    }
}

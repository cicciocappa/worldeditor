/**
 * TestRenderer.js - Simple test renderer to verify WebGL pipeline
 * Draws a single triangle in NDC space without any transformations
 */

export class TestRenderer {
    constructor(gl) {
        this.gl = gl;
        this.program = null;
        this.vao = null;
        this.vertexBuffer = null;
    }

    /**
     * Initialize test renderer
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
            console.error('Test shader link error:', gl.getProgramInfoLog(this.program));
            return;
        }

        console.log('Test shader compiled successfully');

        // Create a large triangle in NDC space that covers most of the screen
        const vertices = new Float32Array([
            -0.8, -0.8, 0.0,  // Bottom left
             0.8, -0.8, 0.0,  // Bottom right
             0.0,  0.8, 0.0   // Top center
        ]);

        // Create VAO and buffer
        this.vao = gl.createVertexArray();
        gl.bindVertexArray(this.vao);

        this.vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

        gl.bindVertexArray(null);

        console.log('Test triangle created in NDC space');
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
            console.error('Test shader compile error:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }

        return shader;
    }

    /**
     * Render the test triangle
     */
    render() {
        if (!this.program) return;

        const gl = this.gl;

        gl.useProgram(this.program);
        gl.bindVertexArray(this.vao);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.bindVertexArray(null);

        console.log('Test triangle rendered');
    }
}

/**
 * ShadowRenderer.js - Renders scene from light's perspective for shadow mapping
 * Creates and manages shadow map (depth texture) and light-space matrix
 */

// gl-matrix is loaded globally via CDN
const { mat4, vec3 } = glMatrix;

export class ShadowRenderer {
    constructor(gl) {
        this.gl = gl;

        // Shadow map properties
        this.shadowMapSize = 2048;  // Higher = better quality, lower = better performance
        this.shadowMapTexture = null;
        this.shadowFramebuffer = null;

        // Shader program for depth pass
        this.program = null;
        this.uniforms = {};

        // Light projection settings
        this.lightProjectionSize = 80;  // Orthographic projection size
        this.lightNear = 1;
        this.lightFar = 150;

        // Light space matrix (updated each frame)
        this.lightSpaceMatrix = mat4.create();
    }

    /**
     * Initialize shadow renderer
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
            console.error('Shadow shader link error:', gl.getProgramInfoLog(this.program));
            return;
        }

        // Get uniform location
        this.uniforms.uLightSpaceMatrix = gl.getUniformLocation(this.program, 'uLightSpaceMatrix');

        // Create shadow map framebuffer and texture
        this.createShadowMap();

        console.log('ShadowRenderer initialized - shadow map size:', this.shadowMapSize);
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
            console.error('Shadow shader compile error:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }

        return shader;
    }

    /**
     * Create shadow map framebuffer and depth texture
     */
    createShadowMap() {
        const gl = this.gl;

        // Create depth texture
        this.shadowMapTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.shadowMapTexture);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.DEPTH_COMPONENT32F,
            this.shadowMapSize,
            this.shadowMapSize,
            0,
            gl.DEPTH_COMPONENT,
            gl.FLOAT,
            null
        );

        // Set texture parameters
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        // Create framebuffer
        this.shadowFramebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFramebuffer);
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.DEPTH_ATTACHMENT,
            gl.TEXTURE_2D,
            this.shadowMapTexture,
            0
        );

        // Check framebuffer status
        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (status !== gl.FRAMEBUFFER_COMPLETE) {
            console.error('Shadow framebuffer incomplete:', status);
        }

        // Unbind
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }

    /**
     * Calculate light space matrix for given light direction
     */
    updateLightSpaceMatrix(lightDir) {
        // Light position (far away in opposite direction of light)
        const lightDistance = 100;
        const lightPos = vec3.create();
        vec3.scale(lightPos, lightDir, -lightDistance);

        // Light looks at origin
        const target = vec3.fromValues(0, 0, 0);
        const up = vec3.fromValues(0, 1, 0);

        // Create light view matrix
        const lightView = mat4.create();
        mat4.lookAt(lightView, lightPos, target, up);

        // Create orthographic projection matrix
        const lightProjection = mat4.create();
        const size = this.lightProjectionSize;
        mat4.ortho(
            lightProjection,
            -size, size,    // left, right
            -size, size,    // bottom, top
            this.lightNear,
            this.lightFar
        );

        // Combine projection and view
        mat4.multiply(this.lightSpaceMatrix, lightProjection, lightView);
    }

    /**
     * Begin shadow map rendering
     */
    beginShadowPass() {
        const gl = this.gl;

        // Bind shadow framebuffer
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFramebuffer);
        gl.viewport(0, 0, this.shadowMapSize, this.shadowMapSize);

        // Clear depth buffer
        gl.clear(gl.DEPTH_BUFFER_BIT);

        // Use shadow shader
        gl.useProgram(this.program);

        // Enable depth test, disable color writes
        gl.enable(gl.DEPTH_TEST);
        gl.colorMask(false, false, false, false);

        // Use front-face culling to reduce shadow acne and peter panning
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.FRONT);

        // Set light space matrix uniform
        gl.uniformMatrix4fv(this.uniforms.uLightSpaceMatrix, false, this.lightSpaceMatrix);
    }

    /**
     * End shadow map rendering
     */
    endShadowPass(canvas) {
        const gl = this.gl;

        // Restore default framebuffer and viewport
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, canvas.width, canvas.height);

        // Re-enable color writes
        gl.colorMask(true, true, true, true);

        // Restore back-face culling for normal rendering
        gl.cullFace(gl.BACK);
    }

    /**
     * Bind shadow map texture for sampling in main render pass
     */
    bindShadowMap(textureUnit = 0) {
        const gl = this.gl;
        gl.activeTexture(gl.TEXTURE0 + textureUnit);
        gl.bindTexture(gl.TEXTURE_2D, this.shadowMapTexture);
    }

    /**
     * Get light space matrix
     */
    getLightSpaceMatrix() {
        return this.lightSpaceMatrix;
    }
}

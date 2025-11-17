/**
 * ObjectRenderer.js - Renders static 3D objects loaded from external models
 * Supports textures, materials, and transparency (alpha testing for leaves)
 */

// gl-matrix is loaded globally via CDN
const { mat4 } = glMatrix;

import { ModelLoader } from '../utils/ModelLoader.js';

export class ObjectRenderer {
    constructor(gl) {
        this.gl = gl;

        // Shader program for textured objects
        this.program = null;

        // Uniform locations
        this.uniforms = {};

        // Object meshes library (loaded from external files)
        this.meshes = new Map();

        // Textures cache
        this.textures = new Map();

        // Default object colors (fallback when no texture)
        this.objectColors = {
            // No procedural meshes - all models should be loaded externally
        };
    }

    /**
     * Initialize renderer with texture support shaders
     */
    async init(vertexShaderSource, fragmentShaderSource) {
        const gl = this.gl;

        // Compile shaders for textured objects
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
        this.uniforms.uHasTexture = gl.getUniformLocation(this.program, 'uHasTexture');
        this.uniforms.uTexture = gl.getUniformLocation(this.program, 'uTexture');
        this.uniforms.uUseAlphaTest = gl.getUniformLocation(this.program, 'uUseAlphaTest');
        this.uniforms.uAlphaCutoff = gl.getUniformLocation(this.program, 'uAlphaCutoff');

        // No procedural meshes loaded by default
        // All models should be loaded externally via loadExternalModel()
        console.log('ObjectRenderer initialized. Load models using loadExternalModel().');
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
     * Load and upload a mesh to GPU with UV support
     */
    loadMesh(name, meshData) {
        const gl = this.gl;

        // Create VAO and buffers
        const vao = gl.createVertexArray();
        const vertexBuffer = gl.createBuffer();
        const normalBuffer = gl.createBuffer();
        const uvBuffer = gl.createBuffer();
        const indexBuffer = gl.createBuffer();

        gl.bindVertexArray(vao);

        // Vertex positions (location 0)
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, meshData.vertices, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

        // Normals (location 1)
        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, meshData.normals, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);

        // UV coordinates (location 2)
        gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, meshData.uvs, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(2);
        gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);

        // Indices
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, meshData.indices, gl.STATIC_DRAW);

        gl.bindVertexArray(null);

        // Store mesh info with materials and texture info
        this.meshes.set(name, {
            vao,
            indexCount: meshData.indices.length,
            vertexBuffer,
            normalBuffer,
            uvBuffer,
            indexBuffer,
            materials: meshData.materials,
            hasUVs: meshData.hasUVs || false,
            hasTexture: false,  // Will be set when texture is loaded
            texture: null       // WebGL texture object
        });
    }

    /**
     * Load external model from file (OBJ, glTF, GLB) with textures
     * @param {string} name - Name to assign to this model
     * @param {File|File[]} files - The model file(s) to load (can include MTL, textures, etc.)
     * @param {Object} options - Loading options
     * @returns {Promise<string>} The model name
     */
    async loadExternalModel(name, files, options = {}) {
        try {
            const fileArray = Array.isArray(files) ? files : [files];
            console.log(`Loading external model as "${name}" with ${fileArray.length} file(s)`);

            // Load model with ModelLoader
            const meshData = await ModelLoader.loadModel(files, options);

            // Normalize mesh to fit in a unit cube
            this.normalizeMesh(meshData);

            // Load mesh into GPU
            this.loadMesh(name, meshData);

            // Load textures if available
            if (meshData.materials) {
                await this.loadMaterialTextures(name, meshData.materials);
            }

            // Set default color for this model type (fallback)
            this.objectColors[name] = [0.8, 0.8, 0.8]; // Default light gray

            console.log(`Model "${name}" loaded successfully:`, {
                vertices: meshData.vertices.length / 3,
                triangles: meshData.indices.length / 3,
                hasUVs: meshData.hasUVs,
                hasMaterials: !!meshData.materials
            });

            return name;
        } catch (error) {
            console.error(`Failed to load model:`, error);
            throw error;
        }
    }

    /**
     * Load textures from materials
     * @param {string} modelName - The model name
     * @param {Object} materials - Materials data
     */
    async loadMaterialTextures(modelName, materials) {
        const gl = this.gl;
        const mesh = this.meshes.get(modelName);

        if (!mesh) {
            console.warn(`Mesh "${modelName}" not found for texture loading`);
            return;
        }

        // Extract texture URL from materials (simplified - takes first texture found)
        let textureUrl = null;

        if (materials) {
            // For OBJ/MTL materials
            if (typeof materials === 'object' && !Array.isArray(materials)) {
                // materials is a dictionary
                for (const materialName in materials) {
                    const material = materials[materialName];
                    if (material.textures && material.textures.diffuse) {
                        textureUrl = material.textures.diffuse.url;
                        break;
                    }
                }
            }
            // For GLTF materials
            else if (materials.textures && materials.textures.baseColor) {
                textureUrl = materials.textures.baseColor.url;
            }
        }

        if (!textureUrl) {
            console.log(`No texture found for model "${modelName}"`);
            return;
        }

        console.log(`Loading texture for "${modelName}": ${textureUrl}`);

        // Create and configure WebGL texture
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);

        // Set placeholder texture (1x1 white pixel) while loading
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
            new Uint8Array([255, 255, 255, 255]));

        // Load actual image
        const image = new Image();
        image.crossOrigin = 'anonymous';

        return new Promise((resolve, reject) => {
            image.onload = () => {
                gl.bindTexture(gl.TEXTURE_2D, texture);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

                // Check if image is power of 2
                const isPowerOf2 = (value) => (value & (value - 1)) === 0;
                if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
                    gl.generateMipmap(gl.TEXTURE_2D);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
                } else {
                    // Non-power-of-2 textures
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                }
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

                // Update mesh info
                mesh.texture = texture;
                mesh.hasTexture = true;

                console.log(`Texture loaded successfully for "${modelName}"`);
                resolve();
            };

            image.onerror = () => {
                console.error(`Failed to load texture for "${modelName}"`);
                reject(new Error('Texture load failed'));
            };

            image.src = textureUrl;
        });
    }

    /**
     * Normalize mesh vertices to fit in a unit cube centered at origin
     * @param {Object} meshData - Mesh data with vertices array
     */
    normalizeMesh(meshData) {
        const vertices = meshData.vertices;

        // Find bounding box
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

        for (let i = 0; i < vertices.length; i += 3) {
            minX = Math.min(minX, vertices[i]);
            minY = Math.min(minY, vertices[i + 1]);
            minZ = Math.min(minZ, vertices[i + 2]);
            maxX = Math.max(maxX, vertices[i]);
            maxY = Math.max(maxY, vertices[i + 1]);
            maxZ = Math.max(maxZ, vertices[i + 2]);
        }

        // Calculate center and size
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const centerZ = (minZ + maxZ) / 2;

        const sizeX = maxX - minX;
        const sizeY = maxY - minY;
        const sizeZ = maxZ - minZ;
        const maxSize = Math.max(sizeX, sizeY, sizeZ);

        // Normalize to unit cube
        const scale = maxSize > 0 ? 2.0 / maxSize : 1.0;

        for (let i = 0; i < vertices.length; i += 3) {
            vertices[i] = (vertices[i] - centerX) * scale;
            vertices[i + 1] = (vertices[i + 1] - centerY) * scale;
            vertices[i + 2] = (vertices[i + 2] - centerZ) * scale;
        }
    }

    /**
     * Get list of all available model types
     * @returns {Array<string>} Array of model type names
     */
    getAvailableModels() {
        return Array.from(this.meshes.keys());
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
     * Render a single object with texture support
     */
    renderObject(obj, camera, alpha = 1.0, lightDir = [0.5, 0.7, 0.3], lightSpaceMatrix = null) {
        const mesh = this.meshes.get(obj.type);
        if (!mesh) {
            console.warn('Unknown object type:', obj.type);
            return;
        }

        const gl = this.gl;

        // Determine if we need alpha testing (for transparent leaves) or blending
        const useAlphaTest = mesh.hasTexture && mesh.texture;
        const needsBlending = alpha < 1.0 || useAlphaTest;

        // Enable blending for transparency
        if (needsBlending) {
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

            // Disable depth writes for transparent objects to avoid sorting issues
            if (useAlphaTest) {
                gl.depthMask(false);
            }
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

        const color = this.objectColors[obj.type] || [0.8, 0.8, 0.8];
        gl.uniform3fv(this.uniforms.uColor, color);
        gl.uniform3fv(this.uniforms.uLightDir, lightDir);
        gl.uniform1f(this.uniforms.uAlpha, alpha);

        // Texture uniforms
        gl.uniform1i(this.uniforms.uHasTexture, mesh.hasTexture ? 1 : 0);
        gl.uniform1i(this.uniforms.uUseAlphaTest, useAlphaTest ? 1 : 0);
        gl.uniform1f(this.uniforms.uAlphaCutoff, 0.5);

        if (mesh.hasTexture && mesh.texture) {
            // Bind texture to texture unit 1 (unit 0 is reserved for shadow map)
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, mesh.texture);
            gl.uniform1i(this.uniforms.uTexture, 1);
        }

        // Shadow mapping uniforms
        if (lightSpaceMatrix) {
            gl.uniformMatrix4fv(this.uniforms.uLightSpaceMatrix, false, lightSpaceMatrix);
        }
        // Shadow map is bound externally before rendering to texture unit 0
        gl.activeTexture(gl.TEXTURE0);
        gl.uniform1i(this.uniforms.uShadowMap, 0);

        // Draw
        gl.bindVertexArray(mesh.vao);
        gl.drawElements(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_SHORT, 0);
        gl.bindVertexArray(null);

        // Restore state
        if (needsBlending) {
            gl.disable(gl.BLEND);
            if (useAlphaTest) {
                gl.depthMask(true);
            }
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

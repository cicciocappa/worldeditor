/**
 * ModelLoader.js - Load 3D models from various file formats
 * Supports OBJ (with MTL), glTF (with external buffers), and GLB formats
 * Includes support for textures, materials, and UV coordinates
 */

export const ModelLoader = {
    /**
     * Load a model from a file (or multiple files for OBJ+MTL)
     * @param {File|File[]} files - The file(s) to load
     * @param {Object} options - Loading options (baseURL for external resources)
     * @returns {Promise<Object>} Mesh data with vertices, normals, uvs, indices, materials, textures
     */
    async loadModel(files, options = {}) {
        // Handle array of files (e.g., OBJ + MTL + textures)
        const fileArray = Array.isArray(files) ? files : [files];
        const mainFile = fileArray[0];
        const extension = mainFile.name.split('.').pop().toLowerCase();

        // Store all files for easy access by name
        const fileMap = new Map();
        for (const file of fileArray) {
            fileMap.set(file.name, file);
        }

        switch (extension) {
            case 'obj':
                return this.loadOBJ(mainFile, fileMap, options);
            case 'gltf':
            case 'glb':
                return this.loadGLTF(mainFile, fileMap, options);
            default:
                throw new Error(`Unsupported file format: ${extension}`);
        }
    },

    /**
     * Load OBJ file with optional MTL materials
     * @param {File} file - The OBJ file to load
     * @param {Map<string, File>} fileMap - Map of all available files
     * @param {Object} options - Loading options
     * @returns {Promise<Object>} Mesh data
     */
    async loadOBJ(file, fileMap, options = {}) {
        const text = await file.text();

        // Check if MTL file is referenced in OBJ
        const mtlMatch = text.match(/^mtllib\s+(.+)$/m);
        let materials = null;

        if (mtlMatch) {
            const mtlFileName = mtlMatch[1].trim();
            const mtlFile = fileMap.get(mtlFileName);

            if (mtlFile) {
                console.log(`Loading MTL file: ${mtlFileName}`);
                const mtlText = await mtlFile.text();
                materials = await this.parseMTL(mtlText, fileMap, options);
            } else {
                console.warn(`MTL file referenced but not found: ${mtlFileName}`);
            }
        }

        return this.parseOBJ(text, materials);
    },

    /**
     * Parse OBJ file format with UV coordinates and materials
     * @param {string} text - The OBJ file content
     * @param {Object} materials - Optional MTL materials
     * @returns {Object} Mesh data
     */
    parseOBJ(text, materials = null) {
        const vertices = [];
        const normals = [];
        const uvs = [];
        const vertexPositions = []; // v lines
        const vertexNormals = [];   // vn lines
        const vertexUVs = [];       // vt lines
        const faces = [];           // f lines
        let currentMaterial = null;
        const groups = [];          // Material groups

        // Parse lines
        const lines = text.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;

            const parts = trimmed.split(/\s+/);
            const type = parts[0];

            if (type === 'v') {
                // Vertex position: v x y z
                vertexPositions.push([
                    parseFloat(parts[1]),
                    parseFloat(parts[2]),
                    parseFloat(parts[3])
                ]);
            } else if (type === 'vn') {
                // Vertex normal: vn x y z
                vertexNormals.push([
                    parseFloat(parts[1]),
                    parseFloat(parts[2]),
                    parseFloat(parts[3])
                ]);
            } else if (type === 'vt') {
                // Texture coordinate: vt u v
                vertexUVs.push([
                    parseFloat(parts[1]),
                    parseFloat(parts[2] || 0)
                ]);
            } else if (type === 'usemtl') {
                // Material usage: usemtl material_name
                currentMaterial = parts[1];
            } else if (type === 'f') {
                // Face: f v1/vt1/vn1 v2/vt2/vn2 v3/vt3/vn3
                const faceVertices = [];
                for (let i = 1; i < parts.length; i++) {
                    const indices = parts[i].split('/');
                    faceVertices.push({
                        v: parseInt(indices[0]) - 1,  // OBJ indices start at 1
                        vt: indices.length > 1 && indices[1] ? parseInt(indices[1]) - 1 : -1,
                        vn: indices.length > 2 && indices[2] ? parseInt(indices[2]) - 1 : -1,
                        material: currentMaterial
                    });
                }

                // Triangulate face (support quads)
                if (faceVertices.length === 3) {
                    faces.push(faceVertices);
                } else if (faceVertices.length === 4) {
                    // Split quad into two triangles
                    faces.push([faceVertices[0], faceVertices[1], faceVertices[2]]);
                    faces.push([faceVertices[0], faceVertices[2], faceVertices[3]]);
                }
            }
        }

        // Build vertex and index arrays
        const indices = [];
        const vertexMap = new Map(); // Cache for unique vertex combinations
        let nextIndex = 0;

        for (const face of faces) {
            for (const fv of face) {
                // Create unique key for vertex+uv+normal combination
                const key = `${fv.v}_${fv.vt}_${fv.vn}`;

                let index = vertexMap.get(key);
                if (index === undefined) {
                    // Add new vertex
                    index = nextIndex++;
                    vertexMap.set(key, index);

                    const pos = vertexPositions[fv.v];
                    vertices.push(pos[0], pos[1], pos[2]);

                    if (fv.vn >= 0 && vertexNormals[fv.vn]) {
                        const norm = vertexNormals[fv.vn];
                        normals.push(norm[0], norm[1], norm[2]);
                    } else {
                        // Default normal if not provided
                        normals.push(0, 1, 0);
                    }

                    if (fv.vt >= 0 && vertexUVs[fv.vt]) {
                        const uv = vertexUVs[fv.vt];
                        uvs.push(uv[0], uv[1]);
                    } else {
                        // Default UV if not provided
                        uvs.push(0, 0);
                    }
                }

                indices.push(index);
            }
        }

        // If no normals were provided, compute flat normals
        const finalNormals = normals.length > 0 ? normals :
            this.computeFlatNormals(new Float32Array(vertices), new Uint16Array(indices));

        // If no UVs were provided, generate default UVs
        const finalUVs = uvs.length > 0 ? uvs : new Array(vertices.length / 3 * 2).fill(0);

        return {
            vertices: new Float32Array(vertices),
            normals: new Float32Array(finalNormals),
            uvs: new Float32Array(finalUVs),
            indices: new Uint16Array(indices),
            materials: materials,
            hasUVs: uvs.length > 0
        };
    },

    /**
     * Parse MTL file format
     * @param {string} text - The MTL file content
     * @param {Map<string, File>} fileMap - Map of available files for textures
     * @param {Object} options - Loading options
     * @returns {Promise<Object>} Materials dictionary
     */
    async parseMTL(text, fileMap, options = {}) {
        const materials = {};
        let currentMaterial = null;

        const lines = text.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;

            const parts = trimmed.split(/\s+/);
            const type = parts[0];

            if (type === 'newmtl') {
                // New material definition
                const name = parts[1];
                currentMaterial = {
                    name: name,
                    ambient: [0.2, 0.2, 0.2],
                    diffuse: [0.8, 0.8, 0.8],
                    specular: [1.0, 1.0, 1.0],
                    emissive: [0.0, 0.0, 0.0],
                    shininess: 32.0,
                    opacity: 1.0,
                    textures: {}
                };
                materials[name] = currentMaterial;
            } else if (currentMaterial) {
                // Material properties
                if (type === 'Ka') {
                    // Ambient color
                    currentMaterial.ambient = [
                        parseFloat(parts[1]),
                        parseFloat(parts[2]),
                        parseFloat(parts[3])
                    ];
                } else if (type === 'Kd') {
                    // Diffuse color
                    currentMaterial.diffuse = [
                        parseFloat(parts[1]),
                        parseFloat(parts[2]),
                        parseFloat(parts[3])
                    ];
                } else if (type === 'Ks') {
                    // Specular color
                    currentMaterial.specular = [
                        parseFloat(parts[1]),
                        parseFloat(parts[2]),
                        parseFloat(parts[3])
                    ];
                } else if (type === 'Ke') {
                    // Emissive color
                    currentMaterial.emissive = [
                        parseFloat(parts[1]),
                        parseFloat(parts[2]),
                        parseFloat(parts[3])
                    ];
                } else if (type === 'Ns') {
                    // Shininess
                    currentMaterial.shininess = parseFloat(parts[1]);
                } else if (type === 'd' || type === 'Tr') {
                    // Opacity (d) or Transparency (Tr)
                    currentMaterial.opacity = type === 'd' ? parseFloat(parts[1]) : 1.0 - parseFloat(parts[1]);
                } else if (type === 'map_Kd') {
                    // Diffuse texture map
                    const textureName = parts.slice(1).join(' ');
                    currentMaterial.textures.diffuse = textureName;
                } else if (type === 'map_Ka') {
                    // Ambient texture map
                    const textureName = parts.slice(1).join(' ');
                    currentMaterial.textures.ambient = textureName;
                } else if (type === 'map_Ks') {
                    // Specular texture map
                    const textureName = parts.slice(1).join(' ');
                    currentMaterial.textures.specular = textureName;
                } else if (type === 'map_Bump' || type === 'bump') {
                    // Bump/normal map
                    const textureName = parts.slice(1).join(' ');
                    currentMaterial.textures.bump = textureName;
                } else if (type === 'map_d') {
                    // Alpha/opacity map
                    const textureName = parts.slice(1).join(' ');
                    currentMaterial.textures.alpha = textureName;
                }
            }
        }

        // Load texture files if available
        for (const materialName in materials) {
            const material = materials[materialName];
            for (const textureType in material.textures) {
                const textureName = material.textures[textureType];
                const textureFile = fileMap.get(textureName);

                if (textureFile) {
                    console.log(`Loading texture: ${textureName} for ${materialName}`);
                    // Create object URL for the texture
                    material.textures[textureType] = {
                        name: textureName,
                        file: textureFile,
                        url: URL.createObjectURL(textureFile)
                    };
                } else {
                    console.warn(`Texture file not found: ${textureName}`);
                    material.textures[textureType] = null;
                }
            }
        }

        return materials;
    },

    /**
     * Load glTF file with external buffers support
     * @param {File} file - The glTF file to load
     * @param {Map<string, File>} fileMap - Map of available files
     * @param {Object} options - Loading options
     * @returns {Promise<Object>} Mesh data
     */
    async loadGLTF(file, fileMap, options = {}) {
        const extension = file.name.split('.').pop().toLowerCase();

        if (extension === 'glb') {
            return this.loadGLB(file, fileMap, options);
        } else {
            const text = await file.text();
            const gltf = JSON.parse(text);
            return this.parseGLTF(gltf, null, fileMap, options);
        }
    },

    /**
     * Load GLB (binary glTF) file
     * @param {File} file - The GLB file to load
     * @param {Map<string, File>} fileMap - Map of available files
     * @param {Object} options - Loading options
     * @returns {Promise<Object>} Mesh data
     */
    async loadGLB(file, fileMap, options = {}) {
        const arrayBuffer = await file.arrayBuffer();
        const dataView = new DataView(arrayBuffer);

        // GLB header
        const magic = dataView.getUint32(0, true);
        if (magic !== 0x46546C67) { // 'glTF' in ASCII
            throw new Error('Invalid GLB file');
        }

        const version = dataView.getUint32(4, true);
        const length = dataView.getUint32(8, true);

        // Chunk 0 (JSON)
        const chunk0Length = dataView.getUint32(12, true);
        const chunk0Type = dataView.getUint32(16, true);

        if (chunk0Type !== 0x4E4F534A) { // 'JSON' in ASCII
            throw new Error('Invalid GLB chunk type');
        }

        const jsonBytes = new Uint8Array(arrayBuffer, 20, chunk0Length);
        const jsonText = new TextDecoder().decode(jsonBytes);
        const gltf = JSON.parse(jsonText);

        // Chunk 1 (Binary data)
        const chunk1Offset = 20 + chunk0Length;
        const chunk1Length = dataView.getUint32(chunk1Offset, true);
        const chunk1Type = dataView.getUint32(chunk1Offset + 4, true);

        if (chunk1Type !== 0x004E4942) { // 'BIN\0' in ASCII
            throw new Error('Invalid GLB binary chunk type');
        }

        const binaryData = new Uint8Array(arrayBuffer, chunk1Offset + 8, chunk1Length);

        return this.parseGLTF(gltf, binaryData, fileMap, options);
    },

    /**
     * Parse glTF JSON structure with external buffers and textures support
     * @param {Object} gltf - The glTF JSON object
     * @param {Uint8Array} binaryData - Optional binary data from GLB
     * @param {Map<string, File>} fileMap - Map of available files
     * @param {Object} options - Loading options
     * @returns {Promise<Object>} Mesh data
     */
    async parseGLTF(gltf, binaryData = null, fileMap = null, options = {}) {
        // Get first mesh (simplified - assumes single mesh)
        if (!gltf.meshes || gltf.meshes.length === 0) {
            throw new Error('No meshes found in glTF file');
        }

        const mesh = gltf.meshes[0];
        const primitive = mesh.primitives[0];

        // Get accessors for POSITION, NORMAL, TEXCOORD_0, and indices
        const positionAccessor = gltf.accessors[primitive.attributes.POSITION];
        const normalAccessor = primitive.attributes.NORMAL !== undefined ?
            gltf.accessors[primitive.attributes.NORMAL] : null;
        const texcoordAccessor = primitive.attributes.TEXCOORD_0 !== undefined ?
            gltf.accessors[primitive.attributes.TEXCOORD_0] : null;
        const indicesAccessor = primitive.indices !== undefined ?
            gltf.accessors[primitive.indices] : null;

        // Extract data
        const vertices = await this.extractGLTFData(gltf, positionAccessor, binaryData, fileMap);
        const normals = normalAccessor ?
            await this.extractGLTFData(gltf, normalAccessor, binaryData, fileMap) :
            null;
        const uvs = texcoordAccessor ?
            await this.extractGLTFData(gltf, texcoordAccessor, binaryData, fileMap) :
            null;
        const indices = indicesAccessor ?
            await this.extractGLTFData(gltf, indicesAccessor, binaryData, fileMap) :
            null;

        // Compute normals if not provided
        const finalNormals = normals ||
            this.computeFlatNormals(vertices, indices);

        // Generate default UVs if not provided
        const finalUVs = uvs || new Float32Array(vertices.length / 3 * 2);

        // Extract materials and textures
        const materials = await this.extractGLTFMaterials(gltf, primitive, binaryData, fileMap);

        return {
            vertices: vertices,
            normals: finalNormals,
            uvs: finalUVs,
            indices: indices || this.generateSequentialIndices(vertices.length / 3),
            materials: materials,
            hasUVs: uvs !== null
        };
    },

    /**
     * Extract data from glTF accessor with external buffer support
     * @param {Object} gltf - The glTF JSON object
     * @param {Object} accessor - The accessor to extract data from
     * @param {Uint8Array} binaryData - Optional binary data from GLB
     * @param {Map<string, File>} fileMap - Map of available files for external buffers
     * @returns {Promise<TypedArray>} Extracted data
     */
    async extractGLTFData(gltf, accessor, binaryData = null, fileMap = null) {
        const bufferView = gltf.bufferViews[accessor.bufferView];
        const buffer = gltf.buffers[bufferView.buffer];

        let data;
        if (binaryData) {
            // GLB binary data
            data = binaryData;
        } else if (buffer.uri) {
            // Data URI (embedded base64)
            if (buffer.uri.startsWith('data:')) {
                const base64 = buffer.uri.split(',')[1];
                const binary = atob(base64);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) {
                    bytes[i] = binary.charCodeAt(i);
                }
                data = bytes;
            } else {
                // External buffer file
                const bufferFileName = buffer.uri;
                if (fileMap && fileMap.has(bufferFileName)) {
                    console.log(`Loading external buffer: ${bufferFileName}`);
                    const bufferFile = fileMap.get(bufferFileName);
                    const arrayBuffer = await bufferFile.arrayBuffer();
                    data = new Uint8Array(arrayBuffer);
                } else {
                    throw new Error(`External glTF buffer not found: ${bufferFileName}`);
                }
            }
        } else {
            throw new Error('Buffer has no URI and no binary data provided');
        }

        const offset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
        const count = accessor.count;
        const componentSize = this.getGLTFComponentSize(accessor.componentType);
        const numComponents = this.getGLTFNumComponents(accessor.type);

        // Create typed array based on component type
        const ArrayType = this.getGLTFArrayType(accessor.componentType);
        const array = new ArrayType(data.buffer, data.byteOffset + offset, count * numComponents);

        return array;
    },

    /**
     * Extract materials from glTF
     * @param {Object} gltf - The glTF JSON object
     * @param {Object} primitive - The mesh primitive
     * @param {Uint8Array} binaryData - Optional binary data from GLB
     * @param {Map<string, File>} fileMap - Map of available files for textures
     * @returns {Promise<Object>} Materials data
     */
    async extractGLTFMaterials(gltf, primitive, binaryData = null, fileMap = null) {
        if (primitive.material === undefined || !gltf.materials) {
            return null;
        }

        const material = gltf.materials[primitive.material];
        const materialData = {
            name: material.name || 'default',
            baseColor: [1, 1, 1, 1],
            metallic: 1.0,
            roughness: 1.0,
            emissive: [0, 0, 0],
            textures: {}
        };

        // PBR Metallic Roughness
        if (material.pbrMetallicRoughness) {
            const pbr = material.pbrMetallicRoughness;

            if (pbr.baseColorFactor) {
                materialData.baseColor = pbr.baseColorFactor;
            }

            if (pbr.metallicFactor !== undefined) {
                materialData.metallic = pbr.metallicFactor;
            }

            if (pbr.roughnessFactor !== undefined) {
                materialData.roughness = pbr.roughnessFactor;
            }

            // Base color texture
            if (pbr.baseColorTexture) {
                const textureIndex = pbr.baseColorTexture.index;
                const textureInfo = await this.extractGLTFTexture(gltf, textureIndex, binaryData, fileMap);
                if (textureInfo) {
                    materialData.textures.baseColor = textureInfo;
                }
            }
        }

        // Emissive
        if (material.emissiveFactor) {
            materialData.emissive = material.emissiveFactor;
        }

        // Alpha mode
        if (material.alphaMode) {
            materialData.alphaMode = material.alphaMode; // OPAQUE, MASK, BLEND
            materialData.alphaCutoff = material.alphaCutoff || 0.5;
        }

        return materialData;
    },

    /**
     * Extract texture from glTF
     * @param {Object} gltf - The glTF JSON object
     * @param {number} textureIndex - The texture index
     * @param {Uint8Array} binaryData - Optional binary data from GLB
     * @param {Map<string, File>} fileMap - Map of available files
     * @returns {Promise<Object>} Texture info
     */
    async extractGLTFTexture(gltf, textureIndex, binaryData = null, fileMap = null) {
        if (!gltf.textures || textureIndex >= gltf.textures.length) {
            return null;
        }

        const texture = gltf.textures[textureIndex];
        const imageIndex = texture.source;

        if (imageIndex === undefined || !gltf.images) {
            return null;
        }

        const image = gltf.images[imageIndex];

        // Handle different image sources
        if (image.uri) {
            if (image.uri.startsWith('data:')) {
                // Embedded data URI
                return {
                    name: image.name || `texture_${textureIndex}`,
                    url: image.uri
                };
            } else {
                // External image file
                const imageFileName = image.uri;
                if (fileMap && fileMap.has(imageFileName)) {
                    const imageFile = fileMap.get(imageFileName);
                    return {
                        name: image.name || imageFileName,
                        file: imageFile,
                        url: URL.createObjectURL(imageFile)
                    };
                } else {
                    console.warn(`External texture not found: ${imageFileName}`);
                    return null;
                }
            }
        } else if (image.bufferView !== undefined) {
            // Image embedded in buffer view
            const bufferView = gltf.bufferViews[image.bufferView];
            const buffer = gltf.buffers[bufferView.buffer];

            let imageData;
            if (binaryData) {
                // Extract from GLB binary chunk
                const offset = bufferView.byteOffset || 0;
                const length = bufferView.byteLength;
                imageData = binaryData.slice(offset, offset + length);
            } else {
                console.warn('Image in bufferView but no binary data available');
                return null;
            }

            // Create blob and object URL
            const mimeType = image.mimeType || 'image/png';
            const blob = new Blob([imageData], { type: mimeType });
            return {
                name: image.name || `texture_${textureIndex}`,
                url: URL.createObjectURL(blob)
            };
        }

        return null;
    },

    /**
     * Get component size for glTF component type
     */
    getGLTFComponentSize(componentType) {
        const sizes = {
            5120: 1, // BYTE
            5121: 1, // UNSIGNED_BYTE
            5122: 2, // SHORT
            5123: 2, // UNSIGNED_SHORT
            5125: 4, // UNSIGNED_INT
            5126: 4  // FLOAT
        };
        return sizes[componentType];
    },

    /**
     * Get number of components for glTF type
     */
    getGLTFNumComponents(type) {
        const counts = {
            'SCALAR': 1,
            'VEC2': 2,
            'VEC3': 3,
            'VEC4': 4,
            'MAT2': 4,
            'MAT3': 9,
            'MAT4': 16
        };
        return counts[type];
    },

    /**
     * Get typed array type for glTF component type
     */
    getGLTFArrayType(componentType) {
        const types = {
            5120: Int8Array,
            5121: Uint8Array,
            5122: Int16Array,
            5123: Uint16Array,
            5125: Uint32Array,
            5126: Float32Array
        };
        return types[componentType];
    },

    /**
     * Compute flat normals for a mesh
     */
    computeFlatNormals(vertices, indices) {
        const normals = new Float32Array(vertices.length);

        for (let i = 0; i < indices.length; i += 3) {
            const i0 = indices[i] * 3;
            const i1 = indices[i + 1] * 3;
            const i2 = indices[i + 2] * 3;

            // Get triangle vertices
            const v0 = [vertices[i0], vertices[i0 + 1], vertices[i0 + 2]];
            const v1 = [vertices[i1], vertices[i1 + 1], vertices[i1 + 2]];
            const v2 = [vertices[i2], vertices[i2 + 1], vertices[i2 + 2]];

            // Compute edges
            const e1 = [v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]];
            const e2 = [v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2]];

            // Cross product for normal
            const n = [
                e1[1] * e2[2] - e1[2] * e2[1],
                e1[2] * e2[0] - e1[0] * e2[2],
                e1[0] * e2[1] - e1[1] * e2[0]
            ];

            // Normalize
            const len = Math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]);
            if (len > 0) {
                n[0] /= len;
                n[1] /= len;
                n[2] /= len;
            }

            // Assign to all three vertices
            normals[i0] = normals[i1] = normals[i2] = n[0];
            normals[i0 + 1] = normals[i1 + 1] = normals[i2 + 1] = n[1];
            normals[i0 + 2] = normals[i1 + 2] = normals[i2 + 2] = n[2];
        }

        return normals;
    },

    /**
     * Generate sequential indices for non-indexed geometry
     */
    generateSequentialIndices(count) {
        const indices = new Uint16Array(count);
        for (let i = 0; i < count; i++) {
            indices[i] = i;
        }
        return indices;
    }
};

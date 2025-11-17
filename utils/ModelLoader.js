/**
 * ModelLoader.js - Load 3D models from various file formats
 * Supports OBJ and glTF (embedded) formats
 */

export const ModelLoader = {
    /**
     * Load a model from a file
     * @param {File} file - The file to load
     * @returns {Promise<Object>} Mesh data with vertices, normals, and indices
     */
    async loadModel(file) {
        const extension = file.name.split('.').pop().toLowerCase();

        switch (extension) {
            case 'obj':
                return this.loadOBJ(file);
            case 'gltf':
            case 'glb':
                return this.loadGLTF(file);
            default:
                throw new Error(`Unsupported file format: ${extension}`);
        }
    },

    /**
     * Load OBJ file
     * @param {File} file - The OBJ file to load
     * @returns {Promise<Object>} Mesh data
     */
    async loadOBJ(file) {
        const text = await file.text();
        return this.parseOBJ(text);
    },

    /**
     * Parse OBJ file format
     * @param {string} text - The OBJ file content
     * @returns {Object} Mesh data
     */
    parseOBJ(text) {
        const vertices = [];
        const normals = [];
        const vertexPositions = []; // v lines
        const vertexNormals = [];   // vn lines
        const faces = [];            // f lines

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
            } else if (type === 'f') {
                // Face: f v1/vt1/vn1 v2/vt2/vn2 v3/vt3/vn3
                const faceVertices = [];
                for (let i = 1; i < parts.length; i++) {
                    const indices = parts[i].split('/');
                    faceVertices.push({
                        v: parseInt(indices[0]) - 1,  // OBJ indices start at 1
                        vn: indices.length > 2 && indices[2] ? parseInt(indices[2]) - 1 : -1
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
                // Create unique key for vertex+normal combination
                const key = `${fv.v}_${fv.vn}`;

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
                }

                indices.push(index);
            }
        }

        // If no normals were provided, compute flat normals
        const finalNormals = normals.length > 0 ? normals :
            this.computeFlatNormals(new Float32Array(vertices), new Uint16Array(indices));

        return {
            vertices: new Float32Array(vertices),
            normals: new Float32Array(finalNormals),
            indices: new Uint16Array(indices)
        };
    },

    /**
     * Load glTF file
     * @param {File} file - The glTF file to load
     * @returns {Promise<Object>} Mesh data
     */
    async loadGLTF(file) {
        const extension = file.name.split('.').pop().toLowerCase();

        if (extension === 'glb') {
            return this.loadGLB(file);
        } else {
            const text = await file.text();
            const gltf = JSON.parse(text);
            return this.parseGLTF(gltf);
        }
    },

    /**
     * Load GLB (binary glTF) file
     * @param {File} file - The GLB file to load
     * @returns {Promise<Object>} Mesh data
     */
    async loadGLB(file) {
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

        return this.parseGLTF(gltf, binaryData);
    },

    /**
     * Parse glTF JSON structure
     * @param {Object} gltf - The glTF JSON object
     * @param {Uint8Array} binaryData - Optional binary data from GLB
     * @returns {Object} Mesh data
     */
    parseGLTF(gltf, binaryData = null) {
        // Get first mesh (simplified - assumes single mesh)
        if (!gltf.meshes || gltf.meshes.length === 0) {
            throw new Error('No meshes found in glTF file');
        }

        const mesh = gltf.meshes[0];
        const primitive = mesh.primitives[0];

        // Get accessors for POSITION, NORMAL, and indices
        const positionAccessor = gltf.accessors[primitive.attributes.POSITION];
        const normalAccessor = primitive.attributes.NORMAL !== undefined ?
            gltf.accessors[primitive.attributes.NORMAL] : null;
        const indicesAccessor = primitive.indices !== undefined ?
            gltf.accessors[primitive.indices] : null;

        // Extract data
        const vertices = this.extractGLTFData(gltf, positionAccessor, binaryData);
        const normals = normalAccessor ?
            this.extractGLTFData(gltf, normalAccessor, binaryData) :
            null;
        const indices = indicesAccessor ?
            this.extractGLTFData(gltf, indicesAccessor, binaryData) :
            null;

        // Compute normals if not provided
        const finalNormals = normals ||
            this.computeFlatNormals(vertices, indices);

        return {
            vertices: vertices,
            normals: finalNormals,
            indices: indices || this.generateSequentialIndices(vertices.length / 3)
        };
    },

    /**
     * Extract data from glTF accessor
     * @param {Object} gltf - The glTF JSON object
     * @param {Object} accessor - The accessor to extract data from
     * @param {Uint8Array} binaryData - Optional binary data from GLB
     * @returns {TypedArray} Extracted data
     */
    extractGLTFData(gltf, accessor, binaryData = null) {
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
                throw new Error('External glTF buffers not supported');
            }
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

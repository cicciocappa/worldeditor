/**
 * MeshGenerator.js - Procedural mesh generation for simple 3D objects
 * Creates low-poly models for trees, rocks, and bushes
 */

export const MeshGenerator = {
    /**
     * Generate a pine tree mesh (cylinder trunk + cone foliage)
     */
    generatePineTree() {
        const vertices = [];
        const normals = [];
        const indices = [];

        // Trunk (cylinder)
        const trunkRadius = 0.2;
        const trunkHeight = 2.0;
        const trunkSegments = 6;

        for (let i = 0; i <= trunkSegments; i++) {
            const angle = (i / trunkSegments) * Math.PI * 2;
            const x = Math.cos(angle) * trunkRadius;
            const z = Math.sin(angle) * trunkRadius;

            // Bottom
            vertices.push(x, 0, z);
            normals.push(x, 0, z);

            // Top
            vertices.push(x, trunkHeight, z);
            normals.push(x, 0, z);
        }

        // Trunk indices (correct winding order for CCW front faces)
        for (let i = 0; i < trunkSegments; i++) {
            const base = i * 2;
            // Triangle 1: bottom_i, bottom_i+1, top_i
            indices.push(base, base + 2, base + 1);
            // Triangle 2: top_i, bottom_i+1, top_i+1
            indices.push(base + 1, base + 2, base + 3);
        }

        // Foliage (cone)
        const coneBase = vertices.length / 3;
        const coneRadius = 1.2;
        const coneHeight = 3.0;
        const coneSegments = 8;

        // Cone tip
        vertices.push(0, trunkHeight + coneHeight, 0);
        normals.push(0, 1, 0);

        // Cone base
        for (let i = 0; i <= coneSegments; i++) {
            const angle = (i / coneSegments) * Math.PI * 2;
            const x = Math.cos(angle) * coneRadius;
            const z = Math.sin(angle) * coneRadius;

            vertices.push(x, trunkHeight, z);
            normals.push(x, 0.5, z); // Approximate cone normal
        }

        // Cone indices (reversed winding order for correct front-face culling)
        for (let i = 0; i < coneSegments; i++) {
            indices.push(coneBase, coneBase + i + 2, coneBase + i + 1);
        }

        return {
            vertices: new Float32Array(vertices),
            normals: new Float32Array(normals),
            indices: new Uint16Array(indices)
        };
    },

    /**
     * Generate a rock mesh (deformed icosphere)
     */
    generateRock() {
        const vertices = [];
        const normals = [];
        const indices = [];

        // Simple icosphere approximation (octahedron subdivided)
        const size = 1.0;

        // 6 vertices of octahedron
        const v = [
            [0, size, 0],      // top
            [size, 0, 0],      // +X
            [0, 0, size],      // +Z
            [-size, 0, 0],     // -X
            [0, 0, -size],     // -Z
            [0, -size, 0]      // bottom
        ];

        // Add random deformation for rock-like appearance
        const deform = () => (Math.random() - 0.5) * 0.3;

        for (let i = 0; i < v.length; i++) {
            vertices.push(
                v[i][0] + deform(),
                v[i][1] + deform(),
                v[i][2] + deform()
            );
            // Normals will be computed per face
            normals.push(v[i][0], v[i][1], v[i][2]);
        }

        // Octahedron faces
        const faces = [
            [0, 1, 2], [0, 2, 3], [0, 3, 4], [0, 4, 1],
            [5, 2, 1], [5, 3, 2], [5, 4, 3], [5, 1, 4]
        ];

        for (const face of faces) {
            indices.push(face[0], face[1], face[2]);
        }

        return {
            vertices: new Float32Array(vertices),
            normals: new Float32Array(normals),
            indices: new Uint16Array(indices)
        };
    },

    /**
     * Generate a bush mesh (low-poly sphere)
     */
    generateBush() {
        const vertices = [];
        const normals = [];
        const indices = [];

        const radius = 0.8;
        const segments = 6;
        const rings = 4;

        // Generate sphere vertices
        for (let ring = 0; ring <= rings; ring++) {
            const phi = (ring / rings) * Math.PI;
            const y = Math.cos(phi) * radius;
            const ringRadius = Math.sin(phi) * radius;

            for (let seg = 0; seg <= segments; seg++) {
                const theta = (seg / segments) * Math.PI * 2;
                const x = Math.cos(theta) * ringRadius;
                const z = Math.sin(theta) * ringRadius;

                vertices.push(x, y, z);
                normals.push(x, y, z); // Sphere normal
            }
        }

        // Generate indices
        for (let ring = 0; ring < rings; ring++) {
            for (let seg = 0; seg < segments; seg++) {
                const current = ring * (segments + 1) + seg;
                const next = current + segments + 1;

                indices.push(current, next, current + 1);
                indices.push(current + 1, next, next + 1);
            }
        }

        return {
            vertices: new Float32Array(vertices),
            normals: new Float32Array(normals),
            indices: new Uint16Array(indices)
        };
    },

    /**
     * Compute flat normals for a mesh (one normal per face)
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
    }
};

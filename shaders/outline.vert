#version 300 es

// Outline vertex shader - expands geometry along normals
in vec3 position;
in vec3 normal;

uniform mat4 uModelViewProjection;
uniform float uOutlineWidth; // Outline thickness

void main() {
    // Expand vertex along its normal
    vec3 expandedPos = position + normal * uOutlineWidth;

    // Transform to clip space
    gl_Position = uModelViewProjection * vec4(expandedPos, 1.0);
}

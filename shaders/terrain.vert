#version 300 es

// Terrain vertex shader with flat shading support
in vec3 position;
in vec3 normal;

uniform mat4 uModelViewProjection;
uniform mat4 uModel;

// Use flat qualifier for flat shading effect
flat out vec3 vNormal;
out vec3 vWorldPos;

void main() {
    // Transform vertex position
    gl_Position = uModelViewProjection * vec4(position, 1.0);

    // Transform normal to world space
    vNormal = mat3(uModel) * normal;

    // World position for lighting
    vWorldPos = (uModel * vec4(position, 1.0)).xyz;
}

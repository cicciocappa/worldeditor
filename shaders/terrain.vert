#version 300 es

// Terrain vertex shader with flat shading support
in vec3 position;
in vec3 normal;

uniform mat4 uModelViewProjection;
uniform mat4 uModel;
uniform mat4 uLightSpaceMatrix;  // For shadow mapping

// Use flat qualifier for flat shading effect
flat out vec3 vNormal;
out vec3 vWorldPos;
out vec4 vLightSpacePos;  // Position in light space for shadow mapping

void main() {
    // Transform vertex position
    gl_Position = uModelViewProjection * vec4(position, 1.0);

    // Transform normal to world space
    vNormal = mat3(uModel) * normal;

    // World position for lighting
    vec4 worldPos = uModel * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;

    // Position in light space for shadow mapping
    vLightSpacePos = uLightSpaceMatrix * worldPos;
}

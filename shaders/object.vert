#version 300 es

// Object vertex shader with texture coordinate support
in vec3 position;
in vec3 normal;
in vec2 uv;

uniform mat4 uModelViewProjection;
uniform mat4 uModel;
uniform mat4 uLightSpaceMatrix;  // For shadow mapping

// Use smooth qualifier for smooth shading with textures
out vec3 vNormal;
out vec2 vUV;
out vec3 vWorldPos;
out vec4 vLightSpacePos;  // Position in light space for shadow mapping

void main() {
    // Transform vertex position
    gl_Position = uModelViewProjection * vec4(position, 1.0);

    // Transform normal to world space
    vNormal = mat3(uModel) * normal;

    // Pass through UV coordinates
    vUV = uv;

    // World position for lighting
    vec4 worldPos = uModel * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;

    // Position in light space for shadow mapping
    vLightSpacePos = uLightSpaceMatrix * worldPos;
}

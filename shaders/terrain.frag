#version 300 es
precision highp float;

// Flat shading - normal is constant per triangle
flat in vec3 vNormal;
in vec3 vWorldPos;

uniform vec3 uColor;
uniform vec3 uLightDir; // Directional light direction
uniform float uAlpha;   // Alpha/transparency (default 1.0)

out vec4 fragColor;

void main() {
    // Normalize the flat normal
    vec3 N = normalize(vNormal);

    // Simple directional lighting
    float diffuse = max(dot(N, uLightDir), 0.0);

    // Ambient + diffuse lighting
    float ambient = 0.3;
    float lighting = ambient + diffuse * 0.7;

    // Apply lighting to base color
    vec3 finalColor = uColor * lighting;

    fragColor = vec4(finalColor, uAlpha);
}

#version 300 es
precision highp float;

// Flat shading - normal is constant per triangle
flat in vec3 vNormal;
in vec3 vWorldPos;
in vec4 vLightSpacePos;

uniform vec3 uColor;
uniform vec3 uLightDir; // Directional light direction
uniform float uAlpha;   // Alpha/transparency (default 1.0)
uniform sampler2D uShadowMap;  // Shadow map texture

out vec4 fragColor;

/**
 * Calculate shadow factor (0.0 = fully shadowed, 1.0 = fully lit)
 * Uses PCF (Percentage Closer Filtering) for softer shadows
 */
float calculateShadow() {
    // Perform perspective divide
    vec3 projCoords = vLightSpacePos.xyz / vLightSpacePos.w;

    // Transform to [0,1] range (from NDC [-1,1])
    projCoords = projCoords * 0.5 + 0.5;

    // Outside shadow map bounds = no shadow
    if (projCoords.z > 1.0 || projCoords.x < 0.0 || projCoords.x > 1.0 ||
        projCoords.y < 0.0 || projCoords.y > 1.0) {
        return 1.0;
    }

    // Get current fragment depth
    float currentDepth = projCoords.z;

    // Dynamic bias based on surface angle to light (reduces shadow acne)
    vec3 N = normalize(vNormal);
    float cosTheta = max(dot(N, uLightDir), 0.0);
    float bias = max(0.002 * (1.0 - cosTheta), 0.001);

    // PCF (Percentage Closer Filtering) for softer shadows
    float shadow = 0.0;
    vec2 texelSize = 1.0 / vec2(textureSize(uShadowMap, 0));

    // 3x3 PCF kernel
    for(int x = -1; x <= 1; ++x) {
        for(int y = -1; y <= 1; ++y) {
            vec2 offset = vec2(float(x), float(y)) * texelSize;
            float pcfDepth = texture(uShadowMap, projCoords.xy + offset).r;
            shadow += currentDepth - bias > pcfDepth ? 0.0 : 1.0;
        }
    }
    shadow /= 9.0;  // Average of 9 samples

    return shadow;
}

void main() {
    // Normalize the flat normal
    vec3 N = normalize(vNormal);

    // Simple directional lighting
    float diffuse = max(dot(N, uLightDir), 0.0);

    // Calculate shadow
    float shadow = calculateShadow();

    // Ambient + diffuse lighting with shadows
    float ambient = 0.3;
    float lighting = ambient + (diffuse * 0.7 * shadow);

    // Apply lighting to base color
    vec3 finalColor = uColor * lighting;

    fragColor = vec4(finalColor, uAlpha);
}

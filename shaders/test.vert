#version 300 es

// Simple test shader - draws triangle in NDC space
in vec3 position;

void main() {
    // Use positions directly in NDC space (no transformation)
    gl_Position = vec4(position, 1.0);
}

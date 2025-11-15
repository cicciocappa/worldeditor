#version 300 es

// Simple grid vertex shader
in vec3 position;

uniform mat4 uModelViewProjection;

void main() {
    gl_Position = uModelViewProjection * vec4(position, 1.0);
}

#version 300 es

in vec3 position;

uniform mat4 uLightSpaceMatrix;

void main() {
    gl_Position = uLightSpaceMatrix * vec4(position, 1.0);
}

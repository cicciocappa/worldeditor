#version 300 es
precision highp float;

uniform vec3 uOutlineColor; // Typically black

out vec4 fragColor;

void main() {
    // Solid outline color (usually black)
    fragColor = vec4(uOutlineColor, 1.0);
}

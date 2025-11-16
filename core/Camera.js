/**
 * Camera.js - Orbit camera with pan/zoom controls
 * Provides smooth camera movement for 3D scene navigation
 */

// gl-matrix is loaded globally via CDN
const { mat4, vec3 } = glMatrix;

export class Camera {
    constructor(canvas) {
        this.canvas = canvas;

        // Camera spherical coordinates (orbit mode)
        this.distance = 50.0;      // Distance from target
        this.azimuth = Math.PI / 4; // Horizontal angle
        this.elevation = Math.PI / 6; // Vertical angle

        // Target point (what we're looking at)
        this.target = [0, 0, 0]; // Center (origin) - terrain is centered here

        // Limits
        this.minDistance = 10.0;
        this.maxDistance = 150.0;
        this.minElevation = 0.1;
        this.maxElevation = Math.PI / 2 - 0.1;

        // Projection settings
        this.fov = Math.PI / 4; // 45 degrees
        this.near = 0.1;
        this.far = 1000.0;

        // Computed matrices
        this.viewMatrix = mat4.create();
        this.projectionMatrix = mat4.create();
        this.viewProjectionMatrix = mat4.create();

        this.updateMatrices();
    }

    /**
     * Get camera position in world space
     */
    getPosition() {
        const x = this.target[0] + this.distance * Math.cos(this.elevation) * Math.cos(this.azimuth);
        const y = this.target[1] + this.distance * Math.sin(this.elevation);
        const z = this.target[2] + this.distance * Math.cos(this.elevation) * Math.sin(this.azimuth);
        return [x, y, z];
    }

    /**
     * Rotate camera around target
     */
    rotate(deltaAzimuth, deltaElevation) {
        this.azimuth += deltaAzimuth;
        this.elevation = Math.max(
            this.minElevation,
            Math.min(this.maxElevation, this.elevation + deltaElevation)
        );
        this.updateMatrices();
    }

    /**
     * Zoom camera (change distance from target)
     */
    zoom(delta) {
        this.distance = Math.max(
            this.minDistance,
            Math.min(this.maxDistance, this.distance + delta)
        );
        this.updateMatrices();
    }

    /**
     * Pan camera (move target in screen space)
     */
    pan(deltaX, deltaY) {
        // Get camera right and up vectors
        const pos = this.getPosition();
        const forward = vec3.create();
        vec3.subtract(forward, this.target, pos);
        vec3.normalize(forward, forward);

        const right = vec3.create();
        vec3.cross(right, forward, [0, 1, 0]);
        vec3.normalize(right, right);

        const up = vec3.create();
        vec3.cross(up, right, forward);

        // Move target
        const panSpeed = this.distance * 0.001;
        this.target[0] += right[0] * deltaX * panSpeed - up[0] * deltaY * panSpeed;
        this.target[1] += right[1] * deltaX * panSpeed - up[1] * deltaY * panSpeed;
        this.target[2] += right[2] * deltaX * panSpeed - up[2] * deltaY * panSpeed;

        this.updateMatrices();
    }

    /**
     * Update all camera matrices
     */
    updateMatrices() {
        // Update aspect ratio
        const aspect = this.canvas.width / this.canvas.height;

        // Compute projection matrix
        mat4.perspective(this.projectionMatrix, this.fov, aspect, this.near, this.far);

        // Compute view matrix
        const eye = this.getPosition();
        const up = [0, 1, 0];
        mat4.lookAt(this.viewMatrix, eye, this.target, up);

        // Combined view-projection
        mat4.multiply(this.viewProjectionMatrix, this.projectionMatrix, this.viewMatrix);

        // Debug log (first time only)
        if (!this._logged) {
            console.log('Camera initialized (gl-matrix):');
            console.log('  Position:', eye);
            console.log('  Target:', this.target);
            console.log('  Distance:', this.distance);
            console.log('  Aspect:', aspect);
            console.log('  Canvas size:', this.canvas.width, 'x', this.canvas.height);
            console.log('  View-Projection Matrix:', this.viewProjectionMatrix);
            this._logged = true;
        }
    }

    /**
     * Resize handler
     */
    resize() {
        this.updateMatrices();
    }

    /**
     * Cast a ray from screen coordinates into the world
     * Returns ray origin and direction
     */
    screenToRay(screenX, screenY) {
        const aspect = this.canvas.width / this.canvas.height;

        // Normalized device coordinates (-1 to 1)
        const ndcX = (screenX / this.canvas.width) * 2 - 1;
        const ndcY = 1 - (screenY / this.canvas.height) * 2;

        // Ray in view space
        const tanHalfFov = Math.tan(this.fov / 2);
        const rayViewX = ndcX * aspect * tanHalfFov;
        const rayViewY = ndcY * tanHalfFov;
        const rayViewZ = -1;

        // Transform to world space
        const pos = this.getPosition();
        const forward = vec3.create();
        vec3.subtract(forward, this.target, pos);
        vec3.normalize(forward, forward);

        const right = vec3.create();
        vec3.cross(right, forward, [0, 1, 0]);
        vec3.normalize(right, right);

        const up = vec3.create();
        vec3.cross(up, forward, right);

        const rayDir = vec3.fromValues(
            right[0] * rayViewX + up[0] * rayViewY + forward[0] * rayViewZ,
            right[1] * rayViewX + up[1] * rayViewY + forward[1] * rayViewZ,
            right[2] * rayViewX + up[2] * rayViewY + forward[2] * rayViewZ
        );
        vec3.normalize(rayDir, rayDir);

        return {
            origin: pos,
            direction: rayDir
        };
    }

    /**
     * Intersect ray with Y=0 plane (or specified height)
     * Returns [x, y, z] world position or null
     */
    rayPlaneIntersection(ray, planeY = 0) {
        const { origin, direction } = ray;

        // Avoid division by zero
        if (Math.abs(direction[1]) < 0.0001) {
            return null;
        }

        // t = (planeY - origin.y) / direction.y
        const t = (planeY - origin[1]) / direction[1];

        if (t < 0) {
            return null; // Intersection behind camera
        }

        return [
            origin[0] + direction[0] * t,
            planeY,
            origin[2] + direction[2] * t
        ];
    }
}

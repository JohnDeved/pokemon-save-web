precision mediump float;
uniform vec2 resolution;
uniform float time;
varying vec2 vUv;

// Hash function for random values based on position
float hash(vec2 p) { 
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

// Unified shape drawing function
// type: 0 = cross, 1 = circle, 2 = square, 3 = triangle
float shape(vec2 pos, vec2 center, float size, float type) {
    vec2 p = pos - center;
    
    // Cross symbol
    if(type < 1.0) {
        // Rotate 45 degrees
        mat2 rotation = mat2(0.707, -0.707, 0.707, 0.707);
        p = rotation * p;
        
        vec2 d = abs(p);
        float thickness = size * 0.15;
        float horizontal = smoothstep(thickness, thickness - 0.002, abs(d.y)) * 
                         smoothstep(size, size - 0.002, abs(d.x));
        float vertical = smoothstep(thickness, thickness - 0.002, abs(d.x)) * 
                        smoothstep(size, size - 0.002, abs(d.y));
        return horizontal + vertical;
    } 
    // Circle symbol
    else if(type < 2.0) {
        float distance = length(p);
        float outer = 1.0 - smoothstep(size - 0.002, size, distance);
        float inner = smoothstep(size * 0.8 - 0.002, size * 0.8, distance);
        return outer * inner;
    } 
    // Square symbol
    else if(type < 3.0) {
        vec2 d = abs(p) - size;
        float outer = 1.0 - smoothstep(0.0, 0.002, max(d.x, d.y));
        float inner = smoothstep(0.0, 0.002, max(abs(p).x, abs(p).y) - size * 0.8);
        return outer * inner;
    }
    // Triangle symbol
    else {
        // Point upward and adjust size
        p.y += size * 0.2;
        p /= size * 1.3;  // Adjusted scale factor
        
        // Equilateral triangle
        const float k = sqrt(3.0);
        p.x = abs(p.x) - 1.0;
        p.y = p.y + 1.0/k;
        if(p.x + k*p.y > 0.0) {
            p = vec2(p.x - k*p.y, -k*p.x - p.y)/2.0;
        }
        p.x -= clamp(p.x, -2.0, 0.0);
        float d = -length(p)*sign(p.y);
        
        // Create thicker hollow effect
        float outer = 1.0 - smoothstep(-0.05, 0.0, d);
        float inner = smoothstep(-0.16, -0.13, d);
        return outer * inner;
    }
}

void main() {
    // Setup coordinate system
    vec2 pos = (vUv * 2.0 - 1.0) * vec2(resolution.x/resolution.y, 1.0);
    
    // Apply movement
    pos.y -= time * 0.05;  // Upward drift
    pos.x += sin(time * 0.2) * 0.05;  // Gentle sway
    
    // Grid setup
    float gridSize = 0.5;
    vec2 gridPos = floor(pos / gridSize);
    float result = 0.0;
    
    // Sample surrounding grid cells
    for(int y = -1; y <= 1; y++) 
    for(int x = -1; x <= 1; x++) {
        vec2 cellOffset = vec2(float(x), float(y));
        vec2 cellId = gridPos + cellOffset;
        
        // Generate stable random values for this cell
        vec2 random = vec2(hash(cellId), hash(cellId + 1.0));
        
        // Calculate rotation
        float rotationSpeed = hash(cellId + 2.0) - 0.5;
        float angle = time * rotationSpeed + random.x * 6.28;
        mat2 rotation = mat2(cos(angle), sin(angle), -sin(angle), cos(angle));
        
        // Calculate cell center with wobble
        vec2 wobble = sin(time * vec2(0.4, 0.3) + random * 6.28) * 0.25;
        vec2 center = (cellId + 0.5 + wobble) * gridSize;
        
        // Draw shape
        vec2 rotatedPos = rotation * (pos - center) + center;
        float shapeType = floor(hash(cellId + 3.0) * 4.0);  // Changed from 3.0 to 4.0
        result = max(result, shape(rotatedPos, center, 0.02, shapeType));
    }
    
    gl_FragColor = vec4(vec3(result), result);
}
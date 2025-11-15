# StyloWorld Editor - Implementation Guide

A WebGL 2-based 3D level editor for creating game worlds with stylized rendering.

## Features

- **Terrain Editing**: Sculpt terrain with brush tool (raise/lower)
- **Object Placement**: Place trees, rocks, and bushes on the terrain
- **Stylized Rendering**: Flat shading with black outlines (non-photorealistic)
- **Camera Controls**: Orbit, pan, and zoom around the scene
- **Save/Load**: Export and import chunks as JSON files

## Running the Editor

Since this is a pure client-side WebGL application, you need to serve it through a local web server (browsers block ES6 modules from `file://` URLs for security reasons).

### Option 1: Python HTTP Server (Recommended)

```bash
# Python 3
python3 -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000
```

Then open: `http://localhost:8000`

### Option 2: Node.js HTTP Server

```bash
# Install http-server globally
npm install -g http-server

# Run server
http-server -p 8000
```

Then open: `http://localhost:8000`

### Option 3: VS Code Live Server

1. Install "Live Server" extension in VS Code
2. Right-click `index.html`
3. Select "Open with Live Server"

## Controls

### Mouse Controls
- **Left Click + Drag** (Brush Mode): Raise terrain
- **Ctrl + Left Click** (Brush Mode): Lower terrain
- **Left Click** (Place Mode): Place selected object
- **Right/Middle Mouse + Drag**: Rotate camera
- **Mouse Wheel**: Zoom in/out

### Keyboard Shortcuts
- **B**: Switch to Brush mode
- **P**: Switch to Place mode

### Toolbar
- **Brush/Place Buttons**: Switch between editing modes
- **Object Selector**: Choose object type to place (tree, rock, bush)
- **Brush Strength**: Control how fast terrain changes
- **Brush Radius**: Control brush size
- **Save**: Export chunk to JSON file
- **Load**: Import chunk from JSON file
- **New**: Reset to empty chunk

## Project Structure

```
worldeditor/
├── index.html              # Main HTML file
├── style.css              # UI styling
├── main.js                # Application entry point
├── core/
│   ├── Engine.js          # Main engine & render loop
│   └── Camera.js          # Orbit camera controller
├── scene/
│   └── Chunk.js           # Chunk data structure
├── rendering/
│   ├── TerrainRenderer.js # Terrain mesh generation & rendering
│   ├── ObjectRenderer.js  # Static object rendering
│   └── OutlineRenderer.js # Outline effect rendering
├── tools/
│   ├── TerrainBrush.js    # Terrain sculpting tool
│   └── PlacementTool.js   # Object placement tool
├── ui/
│   └── EditorUI.js        # UI event handling
├── io/
│   └── ChunkIO.js         # Save/load functionality
├── utils/
│   ├── Math3D.js          # 3D math utilities
│   └── MeshGenerator.js   # Procedural mesh generation
└── shaders/
    ├── terrain.vert       # Terrain vertex shader
    ├── terrain.frag       # Terrain fragment shader
    ├── outline.vert       # Outline vertex shader
    └── outline.frag       # Outline fragment shader
```

## Technical Details

### Rendering Pipeline

1. **Outline Pass**: Render expanded geometry (front-face culled) in black
2. **Main Pass**: Render terrain and objects with flat shading

### Chunk Format

- **Size**: 64×64 world units
- **Resolution**: 65×65 height vertices
- **Heightmap**: Float32Array in row-major order
- **Objects**: Array of positioned instances

### Shaders

All shaders use **GLSL ES 3.00** (WebGL 2):
- Flat shading using `flat` interpolation qualifier
- Simple directional lighting
- Outline effect via vertex displacement along normals

## Browser Compatibility

Requires a browser with WebGL 2 support:
- Chrome 56+
- Firefox 51+
- Edge 79+
- Safari 15+

## Development Notes

- Pure vanilla JavaScript (ES6 modules)
- No external dependencies (Three.js, Babylon.js, etc.)
- Direct WebGL 2 API usage for maximum control
- Modular architecture for easy extension

## Future Enhancements

Potential improvements for the MVP:
- Texture painting on terrain
- Multiple chunks (world streaming)
- Undo/redo system
- More object types
- Lighting controls
- Export to game engine formats

## License

This is a technical demonstration project.

---

**Made with WebGL 2 and vanilla JavaScript**

# 📄 **Specifica Tecnica: StyloWorld Editor (WebGL 2)**

## 🎯 **Scopo**
Creare un **editor 3D in-browser** per progettare livelli di un videogioco open-world, organizzati in **chunk quadrati**. Ogni chunk contiene:
- Un **terrain** (altimetria sotto forma di griglia regolare).
- Un elenco di **oggetti statici** (alberi, rocce, ecc.) posizionati su di esso.

L’editor deve permettere:
1. Navigazione libera nella scena (orbit/pan/zoom).
2. Modifica interattiva del terreno con brush.
3. Posizionamento manuale di oggetti tramite click.
4. Visualizzazione **non fotorealistica** (flat shading + outline).
5. Salvataggio e caricamento del chunk corrente in formato JSON.

> **Obiettivo MVP**: L’utente apre la pagina, vede un terreno piano, può alzarne le colline con il mouse e piazzare alberi. Il rendering è stilizzato, con contorni neri.

---

## 🧱 **Architettura del sistema (moduli JS)**

Il codice deve essere organizzato in **moduli ES6** (o IIFE se necessario), con separazione chiara delle responsabilità.

### Moduli richiesti:
1. `core/Engine.js` – Loop di rendering, inizializzazione WebGL 2.
2. `core/Camera.js` – Telecamera orbitante (arcball o free-look).
3. `scene/Chunk.js` – Rappresenta un chunk (dati: altezze, oggetti).
4. `rendering/TerrainRenderer.js` – Genera e disegna la mesh del terreno.
5. `rendering/ObjectRenderer.js` – Disegna oggetti statici (instancing opzionale).
6. `rendering/OutlineRenderer.js` – Effetto contorno (solo terreno e oggetti selezionabili).
7. `tools/TerrainBrush.js` – Logica per modificare altezze con mouse.
8. `tools/PlacementTool.js` – Piazza oggetti con click.
9. `ui/EditorUI.js` – Interfaccia con **vanilla JS + HTML** o **lite framework (es. Alpine.js)**.
10. `io/ChunkIO.js` – Salva/carica chunk in JSON.

> **No framework pesanti** (React, Three.js, Babylon.js): usare **solo WebGL 2 nativo** per massimo controllo e apprendimento.

---

## 📐 **Parametri fondamentali**

| Parametro | Valore |
|--------|--------|
| Dimensione chunk | `64 × 64` unità (1 unità = 1 metro virtuale) |
| Risoluzione heightmap | `65 × 65` vertici (step = 1 unità) |
| Formato altezze | `Float32Array` (0.0 = livello del mare) |
| Oggetti supportati (iniziali) | `tree_pine`, `rock_large`, `bush_small` (mesh semplici, low-poly) |
| Sistema di coordinate | Y = up, X/Z = piano orizzontale |

---

## 🖥️ **Rendering pipeline (WebGL 2)**

### Shader richiesti:
1. **`terrain.vert` / `terrain.frag`**  
   - Attributi: `position`, `normal`  
   - Uniforms: `uModelViewProjection`, `uColor`  
   - Stile: **flat shading** (normale per faccia, non per vertice)

2. **`outline.vert` / `outline.frag`**  
   - Disegna una versione leggermente scalata del mesh in nero dietro l’originale  
   - Tecnica: double-pass o geometry shader (fallback a double mesh se necessario)

3. **(Opzionale)** `object.vert` / `object.frag` – simile al terrain, ma per oggetti.

### Passaggi di rendering (per frame):
1. Clear depth + color.
2. Render **outline** di terreno e oggetti (con `gl.disable(gl.DEPTH_TEST)` o offset).
3. Render **geometry principale** con flat shading.
4. (Futuro) Post-processing (non richiesto nell’MVP).

---

## 🛠️ **Funzionalità editor (MVP)**

### Strumenti:
- **Terrain Brush**:  
  - Click + drag → alza/abbassa terreno in un raggio (es. 5 unità).  
  - Tasto Ctrl → abbassa invece di alzare.  
  - Intensità regolabile (slider in UI).

- **Object Placement**:  
  - Seleziona un tipo di oggetto da dropdown (`tree_pine`, ecc.).  
  - Click su terreno → posiziona oggetto alla posizione 3D sotto il mouse.  
  - Oggetto allineato alla normale del terreno (Y-up sufficiente per MVP).

### UI minima (HTML):
```html
<div id="toolbar">
  <button id="brush-mode">🖌️ Brush</button>
  <button id="place-mode">📌 Place</button>
  <select id="object-type">
    <option value="tree_pine">Pine Tree</option>
    <option value="rock_large">Large Rock</option>
    <option value="bush_small">Small Bush</option>
  </select>
  <input type="range" id="brush-strength" min="0.1" max="2" step="0.1" value="0.5">
  <button id="save">💾 Save Chunk</button>
  <button id="load">📂 Load Chunk</button>
</div>
<canvas id="gl-canvas"></canvas>
```

---

## 💾 **Formato di salvataggio (Chunk JSON)**

```json
{
  "version": "1.0",
  "size": 64,
  "resolution": 65,
  "heights": [0.0, 0.0, ..., 1.2, ...], // array di 65*65 numeri
  "objects": [
    {
      "type": "tree_pine",
      "position": [12.3, 0.0, 42.1],
      "rotation": 0.0,
      "scale": 1.0
    }
  ]
}
```

> `heights` è un array 1D in row-major order: `heights[z * 65 + x]`.

---

## 🧪 **Requisiti tecnici minimi**

- **Browser**: Chrome/Firefox/Edge moderno (WebGL 2 supportato).
- **Mesh di esempio**: includere mesh molto semplici come:
  - Albero: cilindro + cono
  - Roccia: sfera distorta
  - Cespuglio: sfera verde
- **Nessuna dipendenza esterna**: solo `index.html`, `style.css`, `*.js`, `*.glsl`.

---

## 🚀 **Output atteso (MVP)**

All’avvio:
- Una pagina con un canvas WebGL.
- Un terreno piano grigio con bordi neri (outline).
- Toolbar in alto con strumenti.
- Possibilità di:
  - Creare colline con il mouse.
  - Piazzare alberi che “crescono” dal terreno.
  - Salvare il lavoro in un file `.json`.

---

## 📌 **Note per l’agente LLM**

- Usa **WebGL 2** direttamente, senza wrapper.
- Genera shader **GLSL ES 3.00**.
- Priorità a **leggibilità e modularità**, non a ottimizzazione estrema.
- Includi commenti esplicativi per ogni modulo.
- Fornisci un `README.md` con istruzioni per eseguire localmente (es. `python3 -m http.server`).

---

Questa specifica è pronta per essere usata da un **agente di generazione codice**. Se vuoi, posso anche:
- Generare direttamente la struttura di base dei file.
- Fornire lo scheletro del codice per un modulo specifico (es. `Chunk.js` o shader outline).
- Suggerire un asset semplice per i modelli di prova.

Fammi sapere come vuoi procedere!

# Islamic Architecture 3D Models - Manifest

## Summary

This collection contains 3D models of Islamic architectural elements for use in style transfer experiments. Models were obtained from free/open sources or generated programmatically.

**Total models:** 26 files across 6 categories
**Formats:** OBJ, STL, GLTF, BLEND
**Date collected:** 2026-03-14

---

## Models by Category

### muqarnas/

| File | Format | Source | License | Description |
|------|--------|--------|---------|-------------|
| muqarnas_vault.obj | OBJ | Programmatically generated | Public Domain | Multi-layer stalactite vault with 5 concentric rings (8-24 cells per layer) |
| muqarnas_vault.stl | STL | Programmatically generated | Public Domain | Same model in STL format |

### arches/

| File | Format | Source | License | Description |
|------|--------|--------|---------|-------------|
| pointed_arch.obj | OBJ | Programmatically generated | Public Domain | Islamic pointed (two-center) arch with pillar supports |
| pointed_arch.stl | STL | Programmatically generated | Public Domain | Same model in STL format |
| islamic_column.obj | OBJ | Programmatically generated | Public Domain | Fluted column with muqarnas-inspired stepped capital, 16-sided |
| islamic_column.stl | STL | Programmatically generated | Public Domain | Same model in STL format |
| mihrab_niche.obj | OBJ | Programmatically generated | Public Domain | Prayer niche (mihrab) with pointed arch profile |
| mihrab_niche.stl | STL | Programmatically generated | Public Domain | Same model in STL format |
| mihrab_niche.gltf | GLTF | Programmatically generated | Public Domain | Same model in glTF 2.0 format |

### geometric_patterns/

| File | Format | Source | License | Description |
|------|--------|--------|---------|-------------|
| islamic_star_pattern_8point.obj | OBJ | Programmatically generated | Public Domain | 3x3 tiled grid of 8-pointed Islamic star motifs |
| islamic_star_pattern_8point.stl | STL | Programmatically generated | Public Domain | Same model in STL format |
| arabesque_panel.obj | OBJ | Programmatically generated | Public Domain | 3x3 grid of 6-fold rosette arabesque patterns |
| arabesque_panel.stl | STL | Programmatically generated | Public Domain | Same model in STL format |
| dodecahedron.obj | OBJ | FSU Burkardt OBJ collection (people.sc.fsu.edu/~jburkardt/data/obj/) | GNU LGPL | 12-faced regular polyhedron (geometric reference) |
| icosahedron.obj | OBJ | FSU Burkardt OBJ collection | GNU LGPL | 20-faced regular polyhedron (geometric reference) |
| octahedron.obj | OBJ | FSU Burkardt OBJ collection | GNU LGPL | 8-faced regular polyhedron (geometric reference) |

### mashrabiya/

| File | Format | Source | License | Description |
|------|--------|--------|---------|-------------|
| mashrabiya_screen.obj | OBJ | Programmatically generated | Public Domain | Lattice screen panel (4x6 units) with horizontal, vertical, and diagonal bars |
| mashrabiya_screen.stl | STL | Programmatically generated | Public Domain | Same model in STL format |

### domes/

| File | Format | Source | License | Description |
|------|--------|--------|---------|-------------|
| islamic_dome.obj | OBJ | Programmatically generated | Public Domain | Hemispherical dome with 16-fold symmetry and cylindrical drum base |
| islamic_dome.stl | STL | Programmatically generated | Public Domain | Same model in STL format |
| islamic_dome.gltf | GLTF | Programmatically generated | Public Domain | Same model in glTF 2.0 format |
| DomeGenerator.blend | BLEND | GitHub: IRCSS/Procedural-Islamic-Dome-Generator | Not specified (open-source repo) | Blender file for procedural Islamic dome generation |
| pyramid.obj | OBJ | FSU Burkardt OBJ collection | GNU LGPL | Pyramid geometric primitive |

### other/

| File | Format | Source | License | Description |
|------|--------|--------|---------|-------------|
| minaret.obj | OBJ | Programmatically generated | Public Domain | Minaret tower with two balconies and tapered finial, 12-sided |
| minaret.stl | STL | Programmatically generated | Public Domain | Same model in STL format |
| minaret.gltf | GLTF | Programmatically generated | Public Domain | Same model in glTF 2.0 format |

---

## Sources Investigated

### Successfully Used

1. **GitHub: IRCSS/Procedural-Islamic-Dome-Generator** - Cloned; obtained `DomeGenerator.blend` (Blender file for procedural dome generation)
2. **FSU Burkardt OBJ Collection** (people.sc.fsu.edu/~jburkardt/data/obj/) - Downloaded geometric primitives (dodecahedron, icosahedron, octahedron, pyramid) under GNU LGPL
3. **Programmatic Generation** - Created 9 unique Islamic architectural models (in OBJ, STL, and GLTF formats) using Python with numpy, covering all major categories

### Investigated but Requires Authentication

4. **Sketchfab API** - Found 30+ CC-licensed downloadable Islamic architecture models (muqarnas, domes, arches, mashrabiya, geometric patterns, mosque fragments). The search API works without auth, but the download endpoint (`/v3/models/{uid}/download`) requires authentication. Notable freely-licensed models found:
   - `cb7f34f0bad74d499ce85aae221adfe1` - Mosque of Tree of Al Buqayawiyya (CC-BY)
   - `cefd48a8a50b4fc39cbe69f3f63e5a37` - Door Panel, 14th century Egyptian (CC0)
   - `0ade13f4a9724e67a68a5fd8935903eb` - Muqarnas Wall (CC-BY)
   - `21b2aa7053b14730b51d9a4956b3b007` - Muqarnas Archway (CC-BY)
   - `542ce00ef4a74305b94ea9cd95e6f10a` - Muqarnas Small Dome (CC-BY)
   - `a60e4d5f34aa4a6280343a8f15bb1c13` - Mashrabiya (CC-BY)
   - `bd1ad1598f0b440ebf1bea0c55346cac` - Islamic Dome Yazd (CC-BY)
   - `2ba2841ece1e46e5b877858c7e17c8dd` - Islamic Patterns (CC-BY)
   - To download: create a free Sketchfab account and use `Authorization: Token <your-token>` header with the download API

5. **Thingiverse API** - Requires API token (401 Unauthorized without auth)

### Investigated but No Relevant Results

6. **Smithsonian 3D** (3d.si.edu) - API endpoints returned 404; search results did not surface Islamic architecture models
7. **GitHub Code Search** - No STL/OBJ files found matching Islamic pattern queries
8. **GitHub: TheBeachLab/islamic-geometry** - Contains code for generating patterns but no pre-built 3D model files
9. **GitHub: mariellad/Procedural-Modeling-of-Muqarnas** - Code only, no exported models
10. **Poly Pizza API** - Requires API key
11. **Printables, MyMiniFactory** - Returned 403 errors
12. **MorphoSource, Poly Haven** - No relevant results or API issues

---

## How to Get More Models

To expand this collection with real-world scanned/artist-created models:

1. **Sketchfab** (best source): Create a free account at sketchfab.com, generate an API token, then download models using:
   ```bash
   curl -H "Authorization: Token YOUR_TOKEN" \
     "https://api.sketchfab.com/v3/models/{UID}/download" -o model.zip
   ```
   The UIDs listed above are confirmed CC-licensed and downloadable.

2. **Thingiverse**: Create an account and search for "islamic pattern", "muqarnas", "mashrabiya" for STL files.

3. **Blender with DomeGenerator.blend**: Open in Blender and export generated domes as OBJ/GLB.

---

## License Summary

- **Programmatically generated models**: Public Domain (no restrictions)
- **FSU Burkardt models**: GNU LGPL
- **DomeGenerator.blend**: Open-source (check repo for specific license)
- **Sketchfab models** (not yet downloaded): Various CC licenses (CC-BY, CC0, CC-BY-NC) - see per-model notes above

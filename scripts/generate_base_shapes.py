#!/usr/bin/env python3
"""
Generate plain/generic architectural 3D base shapes using trimesh.

These are simple, undecorated shapes suitable for applying style transfer:
  - Doric/Tuscan column (cylinder shaft + simple capital + base)
  - Pointed arch with pillars
  - Flat rectangular wall panel
  - Simple dome (hemisphere on a cylindrical drum)
  - Basic balustrade / railing section
  - Simple window frame

Usage:
    pip install trimesh numpy
    python scripts/generate_base_shapes.py

Outputs GLB files to assets/models/base_shapes/
"""

import numpy as np
from pathlib import Path

try:
    import trimesh
    from trimesh.creation import cylinder, box, capsule
    from trimesh.transformations import rotation_matrix, translation_matrix
except ImportError:
    print("ERROR: trimesh is required. Install with: pip install trimesh numpy")
    raise

OUTPUT_DIR = Path(__file__).parent.parent / "assets" / "models" / "base_shapes"


def create_doric_column(
    shaft_radius: float = 0.15,
    shaft_height: float = 2.0,
    base_radius: float = 0.22,
    base_height: float = 0.12,
    capital_radius: float = 0.24,
    capital_height: float = 0.10,
    abacus_size: float = 0.30,
    abacus_height: float = 0.06,
    flutes: int = 0,
) -> trimesh.Trimesh:
    """
    Generate a basic Doric/Tuscan column.

    Structure (bottom to top):
      - Square plinth
      - Circular torus base
      - Cylindrical shaft (optionally fluted)
      - Echinus (flared capital)
      - Square abacus
    """
    meshes = []

    # 1. Plinth (square base pad)
    plinth = box(extents=[base_radius * 2.2, base_radius * 2.2, 0.06])
    plinth.apply_translation([0, 0, 0.03])
    meshes.append(plinth)

    z_cursor = 0.06

    # 2. Torus base molding (approximated as a slightly wider cylinder)
    base = cylinder(radius=base_radius, height=base_height, sections=48)
    base.apply_translation([0, 0, z_cursor + base_height / 2])
    meshes.append(base)
    z_cursor += base_height

    # 3. Shaft
    shaft = cylinder(radius=shaft_radius, height=shaft_height, sections=48)
    shaft.apply_translation([0, 0, z_cursor + shaft_height / 2])
    meshes.append(shaft)
    z_cursor += shaft_height

    # 4. Necking ring (thin annular ring at top of shaft)
    necking = cylinder(radius=shaft_radius + 0.01, height=0.03, sections=48)
    necking.apply_translation([0, 0, z_cursor + 0.015])
    meshes.append(necking)
    z_cursor += 0.03

    # 5. Echinus (flared capital - a truncated cone)
    echinus = _create_truncated_cone(
        bottom_radius=shaft_radius + 0.01,
        top_radius=capital_radius,
        height=capital_height,
        sections=48,
    )
    echinus.apply_translation([0, 0, z_cursor + capital_height / 2])
    meshes.append(echinus)
    z_cursor += capital_height

    # 6. Abacus (square slab on top)
    abacus = box(extents=[abacus_size * 2, abacus_size * 2, abacus_height])
    abacus.apply_translation([0, 0, z_cursor + abacus_height / 2])
    meshes.append(abacus)

    combined = trimesh.util.concatenate(meshes)
    return combined


def _create_truncated_cone(
    bottom_radius: float,
    top_radius: float,
    height: float,
    sections: int = 32,
) -> trimesh.Trimesh:
    """Create a truncated cone (frustum)."""
    angles = np.linspace(0, 2 * np.pi, sections + 1)[:-1]

    # Bottom circle vertices
    bottom_verts = np.column_stack([
        bottom_radius * np.cos(angles),
        bottom_radius * np.sin(angles),
        np.full(sections, -height / 2),
    ])

    # Top circle vertices
    top_verts = np.column_stack([
        top_radius * np.cos(angles),
        top_radius * np.sin(angles),
        np.full(sections, height / 2),
    ])

    # Center vertices for caps
    bottom_center = np.array([[0, 0, -height / 2]])
    top_center = np.array([[0, 0, height / 2]])

    vertices = np.vstack([bottom_verts, top_verts, bottom_center, top_center])
    # Indices: bottom = 0..s-1, top = s..2s-1, bottom_center = 2s, top_center = 2s+1

    faces = []
    bc = 2 * sections      # bottom center index
    tc = 2 * sections + 1  # top center index

    for i in range(sections):
        j = (i + 1) % sections
        # Side quad as two triangles
        faces.append([i, j, sections + j])
        faces.append([i, sections + j, sections + i])
        # Bottom cap
        faces.append([bc, j, i])
        # Top cap
        faces.append([tc, sections + i, sections + j])

    return trimesh.Trimesh(vertices=vertices, faces=np.array(faces))


def create_pointed_arch(
    width: float = 1.2,
    height: float = 2.0,
    depth: float = 0.3,
    pillar_width: float = 0.2,
    arch_thickness: float = 0.15,
    n_segments: int = 32,
    pointedness: float = 0.7,
) -> trimesh.Trimesh:
    """
    Generate a pointed (Gothic/Islamic) arch with two pillars.

    The arch is created by sweeping two arcs from each side that meet
    at a point at the top. `pointedness` controls how pointed the arch is
    (0 = semicircular, 1 = very pointed).
    """
    meshes = []

    half_w = width / 2
    spring_height = height * 0.5  # where arch springs from

    # 1. Left pillar
    left_pillar = box(extents=[pillar_width, depth, spring_height])
    left_pillar.apply_translation([-half_w + pillar_width / 2, 0, spring_height / 2])
    meshes.append(left_pillar)

    # 2. Right pillar
    right_pillar = box(extents=[pillar_width, depth, spring_height])
    right_pillar.apply_translation([half_w - pillar_width / 2, 0, spring_height / 2])
    meshes.append(right_pillar)

    # 3. Arch (pointed)
    # For a pointed arch, we use two arc centers offset inward
    inner_left = -half_w + pillar_width
    inner_right = half_w - pillar_width
    span = inner_right - inner_left
    arch_height = height - spring_height

    # Arc radius and centers for pointed arch
    # The two arcs originate from offset centers
    offset = span * (1 - pointedness) * 0.5
    left_center_x = inner_left + offset
    right_center_x = inner_right - offset

    # Calculate radius so arcs meet at top
    # The apex is at x=0, z=height
    radius = np.sqrt((0 - left_center_x) ** 2 + (height - spring_height) ** 2)

    # Generate arch profile (outer and inner curves)
    def arch_point(t, r, cx):
        """Get point on arc from center cx at parameter t."""
        # t goes from 0 (spring) to 1 (apex)
        angle_at_spring = np.arctan2(0, inner_left - cx) if cx == left_center_x else np.arctan2(0, inner_right - cx)
        angle_at_apex = np.arctan2(height - spring_height, 0 - cx)
        angle = angle_at_spring + t * (angle_at_apex - angle_at_spring)
        x = cx + r * np.cos(angle)
        z = spring_height + r * np.sin(angle)
        return x, z

    # Build arch as extruded profile
    outer_points = []
    inner_points = []

    # Left half of arch (from left pillar to apex)
    for i in range(n_segments // 2 + 1):
        t = i / (n_segments // 2)
        x_out, z_out = arch_point(t, radius, left_center_x)
        x_in, z_in = arch_point(t, radius - arch_thickness, left_center_x)
        outer_points.append((x_out, z_out))
        inner_points.append((x_in, z_in))

    # Right half of arch (from apex to right pillar)
    for i in range(n_segments // 2, -1, -1):
        t = i / (n_segments // 2)
        x_out, z_out = arch_point(t, radius, right_center_x)
        x_in, z_in = arch_point(t, radius - arch_thickness, right_center_x)
        outer_points.append((x_out, z_out))
        inner_points.append((x_in, z_in))

    # Create mesh from arch profile by extruding along Y
    half_d = depth / 2
    n_pts = len(outer_points)
    vertices = []
    faces = []

    # Front face outer, front face inner, back face outer, back face inner
    for x, z in outer_points:
        vertices.append([x, -half_d, z])  # front outer
    for x, z in inner_points:
        vertices.append([x, -half_d, z])  # front inner
    for x, z in outer_points:
        vertices.append([x, half_d, z])   # back outer
    for x, z in inner_points:
        vertices.append([x, half_d, z])   # back inner

    # Indices: front_outer=0..n-1, front_inner=n..2n-1,
    #          back_outer=2n..3n-1, back_inner=3n..4n-1
    fo, fi, bo, bi = 0, n_pts, 2 * n_pts, 3 * n_pts

    for i in range(n_pts - 1):
        j = i + 1
        # Outer surface (front to back)
        faces.append([fo + i, fo + j, bo + j])
        faces.append([fo + i, bo + j, bo + i])
        # Inner surface (back to front, reversed normals)
        faces.append([fi + i, bi + i, bi + j])
        faces.append([fi + i, bi + j, fi + j])
        # Front face (outer to inner)
        faces.append([fo + i, fi + i, fi + j])
        faces.append([fo + i, fi + j, fo + j])
        # Back face (inner to outer)
        faces.append([bo + i, bo + j, bi + j])
        faces.append([bo + i, bi + j, bi + i])

    arch_mesh = trimesh.Trimesh(
        vertices=np.array(vertices),
        faces=np.array(faces),
    )
    arch_mesh.fix_normals()
    meshes.append(arch_mesh)

    # 4. Base slab
    base = box(extents=[width + 0.1, depth + 0.05, 0.05])
    base.apply_translation([0, 0, -0.025])
    meshes.append(base)

    combined = trimesh.util.concatenate(meshes)
    return combined


def create_wall_panel(
    width: float = 2.0,
    height: float = 2.5,
    thickness: float = 0.15,
) -> trimesh.Trimesh:
    """Generate a flat rectangular wall panel."""
    panel = box(extents=[width, thickness, height])
    panel.apply_translation([0, 0, height / 2])
    return panel


def create_dome(
    dome_radius: float = 1.0,
    drum_radius: float = 1.0,
    drum_height: float = 0.5,
    n_phi: int = 32,
    n_theta: int = 24,
) -> trimesh.Trimesh:
    """
    Generate a simple dome (hemisphere sitting on a cylindrical drum).
    """
    meshes = []

    # 1. Drum (cylinder base)
    drum = cylinder(radius=drum_radius, height=drum_height, sections=n_phi)
    drum.apply_translation([0, 0, drum_height / 2])
    meshes.append(drum)

    # 2. Hemisphere dome
    dome = trimesh.creation.icosphere(subdivisions=3, radius=dome_radius)
    # Keep only the top hemisphere (z >= 0)
    mask = dome.vertices[:, 2] >= -0.01
    dome.update_vertices(mask)
    dome.apply_translation([0, 0, drum_height])
    meshes.append(dome)

    combined = trimesh.util.concatenate(meshes)
    return combined


def create_balustrade(
    length: float = 2.0,
    height: float = 0.9,
    baluster_radius: float = 0.03,
    baluster_spacing: float = 0.15,
    rail_width: float = 0.08,
    rail_height: float = 0.04,
    base_height: float = 0.06,
) -> trimesh.Trimesh:
    """
    Generate a basic balustrade / railing section.

    Structure: bottom rail + vertical balusters + top rail (handrail).
    """
    meshes = []

    # 1. Bottom rail
    bottom_rail = box(extents=[length, rail_width, base_height])
    bottom_rail.apply_translation([0, 0, base_height / 2])
    meshes.append(bottom_rail)

    # 2. Balusters (evenly spaced cylinders)
    baluster_height = height - base_height - rail_height
    n_balusters = int(length / baluster_spacing)
    start_x = -length / 2 + baluster_spacing / 2

    for i in range(n_balusters):
        x = start_x + i * baluster_spacing
        bal = cylinder(radius=baluster_radius, height=baluster_height, sections=12)
        bal.apply_translation([x, 0, base_height + baluster_height / 2])
        meshes.append(bal)

    # 3. Top rail (handrail)
    top_rail = box(extents=[length, rail_width, rail_height])
    top_rail.apply_translation([0, 0, height - rail_height / 2])
    meshes.append(top_rail)

    # 4. End posts (slightly thicker)
    for x in [-length / 2, length / 2]:
        post = cylinder(radius=baluster_radius * 1.8, height=height, sections=12)
        post.apply_translation([x, 0, height / 2])
        meshes.append(post)

    combined = trimesh.util.concatenate(meshes)
    return combined


def create_window_frame(
    width: float = 0.8,
    height: float = 1.2,
    frame_thickness: float = 0.06,
    frame_depth: float = 0.08,
    sill_depth: float = 0.12,
    sill_height: float = 0.04,
) -> trimesh.Trimesh:
    """
    Generate a simple rectangular window frame.

    Structure: four frame members forming a rectangle + a protruding sill at bottom.
    """
    meshes = []
    ht = frame_thickness / 2

    # 1. Bottom frame member
    bottom = box(extents=[width, frame_depth, frame_thickness])
    bottom.apply_translation([0, 0, ht])
    meshes.append(bottom)

    # 2. Top frame member
    top = box(extents=[width, frame_depth, frame_thickness])
    top.apply_translation([0, 0, height - ht])
    meshes.append(top)

    # 3. Left frame member
    left = box(extents=[frame_thickness, frame_depth, height])
    left.apply_translation([-width / 2 + ht, 0, height / 2])
    meshes.append(left)

    # 4. Right frame member
    right = box(extents=[frame_thickness, frame_depth, height])
    right.apply_translation([width / 2 - ht, 0, height / 2])
    meshes.append(right)

    # 5. Sill (protruding ledge at bottom)
    sill = box(extents=[width + 0.04, sill_depth, sill_height])
    sill.apply_translation([0, -sill_depth / 2 + frame_depth / 2, -sill_height / 2])
    meshes.append(sill)

    # 6. Optional: center mullion (horizontal divider)
    mullion = box(extents=[width - frame_thickness * 2, frame_depth * 0.8, frame_thickness * 0.6])
    mullion.apply_translation([0, 0, height * 0.5])
    meshes.append(mullion)

    combined = trimesh.util.concatenate(meshes)
    return combined


def create_semicircular_arch(
    width: float = 1.2,
    height: float = 2.0,
    depth: float = 0.3,
    pillar_width: float = 0.2,
    arch_thickness: float = 0.15,
    n_segments: int = 32,
) -> trimesh.Trimesh:
    """
    Generate a simple semicircular (Roman) arch with two pillars.
    """
    meshes = []

    half_w = width / 2
    spring_height = height - (half_w - pillar_width)  # semicircle fits in remaining height

    # 1. Left pillar
    left_pillar = box(extents=[pillar_width, depth, spring_height])
    left_pillar.apply_translation([-half_w + pillar_width / 2, 0, spring_height / 2])
    meshes.append(left_pillar)

    # 2. Right pillar
    right_pillar = box(extents=[pillar_width, depth, spring_height])
    right_pillar.apply_translation([half_w - pillar_width / 2, 0, spring_height / 2])
    meshes.append(right_pillar)

    # 3. Semicircular arch
    inner_radius = (width - 2 * pillar_width) / 2
    outer_radius = inner_radius + arch_thickness

    outer_points = []
    inner_points = []

    for i in range(n_segments + 1):
        angle = np.pi * i / n_segments
        cos_a = np.cos(angle)
        sin_a = np.sin(angle)
        outer_points.append((-outer_radius * cos_a, spring_height + outer_radius * sin_a))
        inner_points.append((-inner_radius * cos_a, spring_height + inner_radius * sin_a))

    half_d = depth / 2
    n_pts = len(outer_points)
    vertices = []
    faces = []

    for x, z in outer_points:
        vertices.append([x, -half_d, z])
    for x, z in inner_points:
        vertices.append([x, -half_d, z])
    for x, z in outer_points:
        vertices.append([x, half_d, z])
    for x, z in inner_points:
        vertices.append([x, half_d, z])

    fo, fi, bo, bi = 0, n_pts, 2 * n_pts, 3 * n_pts

    for i in range(n_pts - 1):
        j = i + 1
        faces.append([fo + i, fo + j, bo + j])
        faces.append([fo + i, bo + j, bo + i])
        faces.append([fi + i, bi + i, bi + j])
        faces.append([fi + i, bi + j, fi + j])
        faces.append([fo + i, fi + i, fi + j])
        faces.append([fo + i, fi + j, fo + j])
        faces.append([bo + i, bo + j, bi + j])
        faces.append([bo + i, bi + j, bi + i])

    arch_mesh = trimesh.Trimesh(vertices=np.array(vertices), faces=np.array(faces))
    arch_mesh.fix_normals()
    meshes.append(arch_mesh)

    # 4. Base slab
    base = box(extents=[width + 0.1, depth + 0.05, 0.05])
    base.apply_translation([0, 0, -0.025])
    meshes.append(base)

    combined = trimesh.util.concatenate(meshes)
    return combined


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    shapes = {
        "doric_column": (create_doric_column, {}),
        "pointed_arch": (create_pointed_arch, {}),
        "semicircular_arch": (create_semicircular_arch, {}),
        "wall_panel": (create_wall_panel, {}),
        "dome": (create_dome, {}),
        "balustrade": (create_balustrade, {}),
        "window_frame": (create_window_frame, {}),
    }

    print(f"Generating {len(shapes)} base architectural shapes...\n")

    for name, (func, kwargs) in shapes.items():
        print(f"  Generating {name}...")
        mesh = func(**kwargs)

        # Export as GLB (binary glTF)
        glb_path = OUTPUT_DIR / f"{name}.glb"
        mesh.export(str(glb_path), file_type="glb")

        # Also export as OBJ
        obj_path = OUTPUT_DIR / f"{name}.obj"
        mesh.export(str(obj_path), file_type="obj")

        print(f"    -> {glb_path.relative_to(OUTPUT_DIR.parent.parent.parent)}")
        print(f"    -> {obj_path.relative_to(OUTPUT_DIR.parent.parent.parent)}")
        print(f"       Vertices: {len(mesh.vertices)}, Faces: {len(mesh.faces)}")

    print(f"\nDone! All shapes saved to {OUTPUT_DIR}")
    print("\nGenerated shapes:")
    print("  1. doric_column    - Cylinder shaft + base + capital + abacus")
    print("  2. pointed_arch    - Gothic/Islamic pointed arch with pillars")
    print("  3. semicircular_arch - Roman semicircular arch with pillars")
    print("  4. wall_panel      - Flat rectangular wall panel")
    print("  5. dome            - Hemisphere on cylindrical drum")
    print("  6. balustrade      - Railing with vertical balusters")
    print("  7. window_frame    - Rectangular frame with sill and mullion")


if __name__ == "__main__":
    main()

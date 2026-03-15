#!/usr/bin/env python3
"""
Generate Islamic Architectural Design Template Units
=====================================================

Generates small, minimal, atomic/repeating design components used in
Islamic architecture as 3D meshes. These are the building blocks that
an architect would use to compose larger designs — stamps/molds that
get applied to columns, walls, arches, etc.

Generated templates:
1. 8-pointed star pattern tile (10x10cm flat tile with star cut)
2. Single muqarnas cell (basic squinch/niche shape)
3. Arabesque/vine relief panel
4. Mashrabiya lattice section (grid of geometric openings)
5. Girih tile set (5 basic girih tile shapes as 3D pieces)
6. Pointed arch profile
7. Carved rosette ornament

All models saved in OBJ and GLB format.

Requirements: trimesh, numpy, scipy, shapely
"""

import os
import sys
import numpy as np
from pathlib import Path

import trimesh
from trimesh.creation import extrude_polygon
from shapely.geometry import Polygon, MultiPolygon, box
from shapely.ops import unary_union
from shapely import affinity

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "assets" / "models" / "templates"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def save_mesh(mesh, name):
    """Save mesh in both OBJ and GLB formats."""
    obj_path = OUTPUT_DIR / f"{name}.obj"
    glb_path = OUTPUT_DIR / f"{name}.glb"
    mesh.export(str(obj_path), file_type="obj")
    mesh.export(str(glb_path), file_type="glb")
    print(f"  Saved: {obj_path}")
    print(f"  Saved: {glb_path}")


# ---------------------------------------------------------------------------
# 1. Eight-pointed star pattern tile
# ---------------------------------------------------------------------------
def generate_star_tile():
    """
    A flat 10x10cm square tile with an 8-pointed star pattern extruded
    from the surface. The star is formed by overlapping two squares
    rotated 45 degrees — the classic Islamic khatam pattern.
    """
    print("\n[1/7] Generating 8-pointed star pattern tile...")

    size = 100.0  # 10 cm in mm
    half = size / 2.0
    star_r = size * 0.38  # star outer radius

    # Create 8-pointed star as union of two rotated squares
    def make_square(cx, cy, r, angle_deg):
        pts = []
        for i in range(4):
            a = np.radians(angle_deg + i * 90)
            pts.append((cx + r * np.cos(a), cy + r * np.sin(a)))
        return Polygon(pts)

    sq1 = make_square(half, half, star_r, 0)
    sq2 = make_square(half, half, star_r, 45)
    star_poly = sq1.union(sq2)

    # Create the surrounding cross/kite shapes that fill the gaps
    # These are the typical "petal" shapes around the star
    petal_polys = []
    for i in range(8):
        angle = np.radians(i * 45 + 22.5)
        px = half + star_r * 0.72 * np.cos(angle)
        py = half + star_r * 0.72 * np.sin(angle)
        pr = star_r * 0.18
        kite = make_square(px, py, pr, np.degrees(angle))
        petal_polys.append(kite)

    pattern = star_poly
    for p in petal_polys:
        pattern = pattern.union(p)

    # Clip to tile boundary
    tile_boundary = box(2, 2, size - 2, size - 2)
    pattern = pattern.intersection(tile_boundary)

    # Base tile
    base = trimesh.creation.box(extents=[size, size, 3.0])
    base.apply_translation([half, half, 1.5])

    # Extruded star pattern on top
    star_mesh = extrude_polygon(pattern, height=2.0)
    star_mesh.apply_translation([0, 0, 3.0])

    combined = trimesh.util.concatenate([base, star_mesh])
    save_mesh(combined, "star_tile_8point")
    return combined


# ---------------------------------------------------------------------------
# 2. Single muqarnas cell
# ---------------------------------------------------------------------------
def generate_muqarnas_cell():
    """
    A single muqarnas cell — the basic niche/squinch unit.
    This is the concave quarter-dome shape that tiles together
    to form the honeycomb vaulting in Islamic architecture.
    """
    print("\n[2/7] Generating single muqarnas cell...")

    # Parametric muqarnas cell: a concave niche
    # We create it as a curved surface using vertices and faces
    n_u = 20  # divisions along width
    n_v = 20  # divisions along height

    width = 40.0   # mm
    depth = 40.0
    height = 50.0

    vertices = []
    faces = []

    # Generate the concave niche surface
    # The cell is like a quarter-sphere carved into a rectangular block
    for j in range(n_v + 1):
        v = j / n_v  # 0 to 1 (bottom to top)
        for i in range(n_u + 1):
            u = i / n_u  # 0 to 1 (left to right)

            # Parametric concave surface
            theta = u * np.pi / 2  # 0 to pi/2
            phi = v * np.pi / 2    # 0 to pi/2

            # The niche curves inward
            x = width * (u - 0.5)
            y_flat = depth * 0.5
            z = height * v

            # Apply concave curvature
            curve_amount = np.sin(np.pi * u) * np.sin(np.pi * v * 0.5)
            y = y_flat - depth * 0.45 * curve_amount

            vertices.append([x, y, z])

    # Create faces for the curved surface
    for j in range(n_v):
        for i in range(n_u):
            idx = j * (n_u + 1) + i
            a = idx
            b = idx + 1
            c = idx + (n_u + 1) + 1
            d = idx + (n_u + 1)
            faces.append([a, b, c])
            faces.append([a, c, d])

    # Add back wall vertices and faces
    back_offset = len(vertices)
    for j in range(n_v + 1):
        v = j / n_v
        for i in range(n_u + 1):
            u = i / n_u
            x = width * (u - 0.5)
            y = depth * 0.5
            z = height * v
            vertices.append([x, y, z])

    for j in range(n_v):
        for i in range(n_u):
            idx = back_offset + j * (n_u + 1) + i
            a = idx
            b = idx + 1
            c = idx + (n_u + 1) + 1
            d = idx + (n_u + 1)
            faces.append([a, c, b])
            faces.append([a, d, c])

    # Side walls
    # Left side
    left_offset = len(vertices)
    for j in range(n_v + 1):
        v = j / n_v
        # Front edge point
        front_idx = j * (n_u + 1) + 0
        fv = vertices[front_idx]
        # Back edge point
        bv = [width * (0 - 0.5), depth * 0.5, height * v]
        vertices.append(fv)
        vertices.append(bv)

    for j in range(n_v):
        idx = left_offset + j * 2
        a = idx
        b = idx + 1
        c = idx + 3
        d = idx + 2
        faces.append([a, b, c])
        faces.append([a, c, d])

    # Right side
    right_offset = len(vertices)
    for j in range(n_v + 1):
        v = j / n_v
        front_idx = j * (n_u + 1) + n_u
        fv = vertices[front_idx]
        bv = [width * (1 - 0.5), depth * 0.5, height * v]
        vertices.append(fv)
        vertices.append(bv)

    for j in range(n_v):
        idx = right_offset + j * 2
        a = idx
        b = idx + 1
        c = idx + 3
        d = idx + 2
        faces.append([a, c, b])
        faces.append([a, d, c])

    # Bottom face
    bot_offset = len(vertices)
    # Four corners of the bottom
    vertices.append([width * -0.5, vertices[0][1], 0])
    vertices.append([width * 0.5, vertices[n_u][1], 0])
    vertices.append([width * 0.5, depth * 0.5, 0])
    vertices.append([width * -0.5, depth * 0.5, 0])
    faces.append([bot_offset, bot_offset + 1, bot_offset + 2])
    faces.append([bot_offset, bot_offset + 2, bot_offset + 3])

    # Top face
    top_offset = len(vertices)
    top_front_left = n_v * (n_u + 1) + 0
    top_front_right = n_v * (n_u + 1) + n_u
    vertices.append(vertices[top_front_left].copy())
    vertices.append(vertices[top_front_right].copy())
    vertices.append([width * 0.5, depth * 0.5, height])
    vertices.append([width * -0.5, depth * 0.5, height])
    faces.append([top_offset, top_offset + 2, top_offset + 1])
    faces.append([top_offset, top_offset + 3, top_offset + 2])

    mesh = trimesh.Trimesh(vertices=np.array(vertices), faces=np.array(faces))
    mesh.fix_normals()
    save_mesh(mesh, "muqarnas_cell")
    return mesh


# ---------------------------------------------------------------------------
# 3. Arabesque vine relief panel
# ---------------------------------------------------------------------------
def generate_arabesque_panel():
    """
    A flat panel with a vine/floral arabesque relief pattern.
    Uses parametric spiraling vine curves with leaf shapes.
    """
    print("\n[3/7] Generating arabesque vine relief panel...")

    panel_w = 100.0  # mm
    panel_h = 100.0
    base_thick = 3.0
    relief_height = 2.5

    # Base panel
    base = trimesh.creation.box(extents=[panel_w, panel_h, base_thick])
    base.apply_translation([panel_w / 2, panel_h / 2, base_thick / 2])

    meshes = [base]

    def vine_path(t_array, cx, cy, scale=1.0, rotation=0.0):
        """Generate a spiral vine path."""
        cos_r = np.cos(rotation)
        sin_r = np.sin(rotation)
        pts = []
        for t in t_array:
            r = scale * (5 + t * 8)
            x = r * np.cos(t * 2.5)
            y = r * np.sin(t * 2.5)
            # Rotate
            rx = x * cos_r - y * sin_r + cx
            ry = x * sin_r + y * cos_r + cy
            pts.append((rx, ry))
        return pts

    def make_vine_segment(p1, p2, width=2.5):
        """Create a rectangular segment between two points."""
        dx = p2[0] - p1[0]
        dy = p2[1] - p1[1]
        length = np.sqrt(dx * dx + dy * dy)
        if length < 0.01:
            return None
        nx = -dy / length * width / 2
        ny = dx / length * width / 2
        poly = Polygon([
            (p1[0] + nx, p1[1] + ny),
            (p2[0] + nx, p2[1] + ny),
            (p2[0] - nx, p2[1] - ny),
            (p1[0] - nx, p1[1] - ny),
        ])
        return poly

    def make_leaf(cx, cy, angle, size=6.0):
        """Create a leaf shape (pointed ellipse)."""
        pts = []
        n = 16
        for i in range(n):
            t = i / n * 2 * np.pi
            # Leaf shape: elongated in one direction
            r = size * (0.3 + 0.7 * abs(np.cos(t)))
            x = r * np.cos(t) * 0.4
            y = r * np.sin(t)
            # Rotate by angle
            cos_a = np.cos(angle)
            sin_a = np.sin(angle)
            rx = x * cos_a - y * sin_a + cx
            ry = x * sin_a + y * cos_a + cy
            pts.append((rx, ry))
        try:
            p = Polygon(pts)
            if p.is_valid and p.area > 0.1:
                return p
        except:
            pass
        return None

    # Generate vine paths spiraling from center with 4-fold symmetry
    vine_polys = []
    tile_clip = box(2, 2, panel_w - 2, panel_h - 2)

    for rot in [0, np.pi / 2, np.pi, 3 * np.pi / 2]:
        t_arr = np.linspace(0, 3.5, 80)
        path = vine_path(t_arr, panel_w / 2, panel_h / 2, scale=1.8, rotation=rot)

        for i in range(len(path) - 1):
            seg = make_vine_segment(path[i], path[i + 1], width=2.2)
            if seg and seg.is_valid:
                vine_polys.append(seg)

            # Add leaves at intervals
            if i % 8 == 4:
                dx = path[i + 1][0] - path[i][0]
                dy = path[i + 1][1] - path[i][1]
                angle = np.arctan2(dy, dx)
                for leaf_angle_offset in [np.pi / 3, -np.pi / 3]:
                    leaf = make_leaf(
                        path[i][0], path[i][1],
                        angle + leaf_angle_offset, size=5.0
                    )
                    if leaf:
                        vine_polys.append(leaf)

    # Add central rosette
    n_petals = 8
    for i in range(n_petals):
        angle = i * 2 * np.pi / n_petals
        petal = make_leaf(
            panel_w / 2 + 4 * np.cos(angle),
            panel_h / 2 + 4 * np.sin(angle),
            angle, size=7.0
        )
        if petal:
            vine_polys.append(petal)

    # Union all vine elements
    valid_polys = [p for p in vine_polys if p.is_valid and not p.is_empty]
    if valid_polys:
        vine_union = unary_union(valid_polys)
        vine_union = vine_union.intersection(tile_clip)

        if isinstance(vine_union, MultiPolygon):
            polys = list(vine_union.geoms)
        elif isinstance(vine_union, Polygon):
            polys = [vine_union]
        else:
            polys = []

        for poly in polys:
            if poly.is_valid and poly.area > 1.0:
                try:
                    relief = extrude_polygon(poly, height=relief_height)
                    relief.apply_translation([0, 0, base_thick])
                    meshes.append(relief)
                except Exception:
                    pass

    combined = trimesh.util.concatenate(meshes)
    save_mesh(combined, "arabesque_panel")
    return combined


# ---------------------------------------------------------------------------
# 4. Mashrabiya lattice section
# ---------------------------------------------------------------------------
def generate_mashrabiya():
    """
    A small section of mashrabiya lattice screen — a grid of
    geometric openings (octagonal and cross-shaped) in a flat panel.
    """
    print("\n[4/7] Generating mashrabiya lattice section...")

    panel_w = 100.0
    panel_h = 100.0
    thickness = 5.0

    # Grid parameters
    n_cells_x = 5
    n_cells_y = 5
    cell_w = panel_w / n_cells_x
    cell_h = panel_h / n_cells_y
    wall_thick = 2.0  # thickness of lattice bars

    # Create octagonal openings
    opening_polys = []
    for iy in range(n_cells_y):
        for ix in range(n_cells_x):
            cx = (ix + 0.5) * cell_w
            cy = (iy + 0.5) * cell_h

            # Octagonal opening
            r = min(cell_w, cell_h) / 2 - wall_thick
            pts = []
            for k in range(8):
                angle = k * np.pi / 4 + np.pi / 8
                pts.append((cx + r * np.cos(angle), cy + r * np.sin(angle)))
            opening_polys.append(Polygon(pts))

    # Small diamond openings at intersections
    for iy in range(n_cells_y + 1):
        for ix in range(n_cells_x + 1):
            cx = ix * cell_w
            cy = iy * cell_h
            r = wall_thick * 0.8
            pts = [
                (cx, cy - r), (cx + r, cy),
                (cx, cy + r), (cx - r, cy)
            ]
            opening_polys.append(Polygon(pts))

    # Panel outline minus openings
    panel_poly = box(0, 0, panel_w, panel_h)
    openings = unary_union(opening_polys)
    lattice_poly = panel_poly.difference(openings)

    # Clip
    lattice_poly = lattice_poly.intersection(box(0, 0, panel_w, panel_h))

    if isinstance(lattice_poly, MultiPolygon):
        polys = list(lattice_poly.geoms)
    elif isinstance(lattice_poly, Polygon):
        polys = [lattice_poly]
    else:
        polys = []

    meshes = []
    for poly in polys:
        if poly.is_valid and poly.area > 0.5:
            try:
                m = extrude_polygon(poly, height=thickness)
                meshes.append(m)
            except Exception:
                pass

    if meshes:
        combined = trimesh.util.concatenate(meshes)
    else:
        combined = trimesh.creation.box(extents=[panel_w, panel_h, thickness])

    save_mesh(combined, "mashrabiya_lattice")
    return combined


# ---------------------------------------------------------------------------
# 5. Girih tile set (5 basic shapes)
# ---------------------------------------------------------------------------
def generate_girih_tiles():
    """
    The 5 basic girih tile shapes used in Islamic geometric art:
    1. Regular decagon (tabl)
    2. Elongated hexagon (shesh band)
    3. Bow tie / concave hexagon (sormeh dan)
    4. Rhombus (torange)
    5. Regular pentagon (panj)

    All tiles have edge length = 20mm and height = 3mm.
    Arranged side by side for easy use.
    """
    print("\n[5/7] Generating girih tile set...")

    edge = 20.0  # mm
    height = 3.0
    spacing = 10.0

    # All girih tiles have sides of equal length.
    # Interior angles are multiples of 36 degrees.

    def polygon_from_angles_and_sides(angles_deg, n_sides, edge_len):
        """Build polygon from sequence of interior angles, all sides equal length."""
        pts = [(0, 0)]
        heading = 0  # degrees
        for i in range(n_sides - 1):
            dx = edge_len * np.cos(np.radians(heading))
            dy = edge_len * np.sin(np.radians(heading))
            pts.append((pts[-1][0] + dx, pts[-1][1] + dy))
            # Turn: exterior angle = 180 - interior_angle
            heading += (180 - angles_deg[i])
        return Polygon(pts)

    tiles = {}

    # 1. Regular decagon (tabl) — all angles 144°
    angles = [144] * 10
    tiles["girih_decagon"] = polygon_from_angles_and_sides(angles, 10, edge)

    # 2. Elongated hexagon (shesh band) — angles: 72, 144, 144, 72, 144, 144
    angles = [72, 144, 144, 72, 144, 144]
    tiles["girih_hexagon"] = polygon_from_angles_and_sides(angles, 6, edge)

    # 3. Bow tie (sormeh dan) — angles: 72, 72, 216, 72, 72, 216
    angles = [72, 72, 216, 72, 72, 216]
    tiles["girih_bowtie"] = polygon_from_angles_and_sides(angles, 6, edge)

    # 4. Rhombus (torange) — angles: 72, 108, 72, 108
    angles = [72, 108, 72, 108]
    tiles["girih_rhombus"] = polygon_from_angles_and_sides(angles, 4, edge)

    # 5. Regular pentagon (panj) — all angles 108°
    angles = [108] * 5
    tiles["girih_pentagon"] = polygon_from_angles_and_sides(angles, 5, edge)

    # Add decorative strapwork lines on each tile
    all_meshes = []
    x_offset = 0

    for name, poly in tiles.items():
        if not poly.is_valid:
            poly = poly.buffer(0)

        # Center the polygon
        cx, cy = poly.centroid.coords[0]
        poly = affinity.translate(poly, -cx + x_offset, -cy)

        # Extrude the base tile
        base_mesh = extrude_polygon(poly, height=height)

        # Add a thin border/frame on top
        border = poly.buffer(-1.5)
        if border.is_valid and not border.is_empty and border.area > 1.0:
            frame_poly = poly.difference(border)
            if frame_poly.is_valid and not frame_poly.is_empty:
                if isinstance(frame_poly, MultiPolygon):
                    frame_parts = list(frame_poly.geoms)
                else:
                    frame_parts = [frame_poly]
                for fp in frame_parts:
                    if fp.is_valid and fp.area > 0.5:
                        try:
                            frame_mesh = extrude_polygon(fp, height=1.0)
                            frame_mesh.apply_translation([0, 0, height])
                            all_meshes.append(frame_mesh)
                        except:
                            pass

        all_meshes.append(base_mesh)

        # Save individual tile too
        individual = trimesh.util.concatenate([base_mesh])
        save_mesh(individual, name)

        # Move offset for next tile
        bounds = poly.bounds  # minx, miny, maxx, maxy
        x_offset += (bounds[2] - bounds[0]) + spacing

    # Save complete set
    if all_meshes:
        full_set = trimesh.util.concatenate(all_meshes)
        save_mesh(full_set, "girih_tile_set")

    return all_meshes


# ---------------------------------------------------------------------------
# 6. Pointed arch profile
# ---------------------------------------------------------------------------
def generate_pointed_arch():
    """
    A pointed (ogee/lancet) arch profile — just the arch molding shape,
    not a full doorway. This is the classic Islamic pointed arch formed
    by two circular arcs meeting at a point.
    """
    print("\n[6/7] Generating pointed arch profile...")

    width = 60.0     # mm span
    height = 80.0    # mm total height
    thickness = 5.0  # mm depth (extrusion)
    molding_w = 4.0  # width of the arch molding band

    half_w = width / 2.0

    # The pointed arch: two arcs from the base that meet at the top
    # Each arc center is offset inward from the base
    # For a classic Islamic arch, centers are at ~1/3 of the span from each side
    center_offset = half_w * 0.35  # how far inward the arc centers are
    arc_radius = np.sqrt((half_w - center_offset) ** 2 + height ** 2) * 0.72

    # Left arc center and right arc center
    lc = (-center_offset, 0)
    rc = (center_offset, 0)

    # Generate outer arch profile points
    n_pts = 40

    def arch_points(radius, inner=False):
        pts = []
        offset = -molding_w if inner else 0

        # Left side: arc from left base up to apex
        # Find angles
        for i in range(n_pts + 1):
            t = i / n_pts
            # Interpolate from base to apex on left arc
            base_angle = np.arctan2(0, half_w + center_offset)
            # Point on left arc going up
            angle = base_angle + t * (np.pi / 2 + 0.3)
            x = lc[0] + (radius + offset) * np.cos(angle)
            y = lc[1] + (radius + offset) * np.sin(angle)
            if y >= 0 and x <= half_w * 0.1:  # only upper half, left side
                pts.append((x, y))

        # Right side: mirror
        right_pts = []
        for i in range(n_pts + 1):
            t = i / n_pts
            angle = np.pi - (base_angle + t * (np.pi / 2 + 0.3))
            x = rc[0] + (radius + offset) * np.cos(angle)
            y = rc[1] + (radius + offset) * np.sin(angle)
            if y >= 0 and x >= -half_w * 0.1:
                right_pts.append((x, y))

        return pts, right_pts

    # Simpler approach: parametric pointed arch
    outer_pts = []
    inner_pts = []

    for i in range(n_pts * 2 + 1):
        t = i / (n_pts * 2)  # 0 to 1
        x = width * (t - 0.5)

        # Arch height at position x: pointed arch formula
        # Two circular arcs meeting at center top
        norm_x = abs(x) / half_w  # 0 at center, 1 at edges

        # Pointed arch profile using sine-based approximation
        if norm_x <= 1.0:
            # Classic pointed arch shape
            h = height * (1.0 - norm_x ** 1.3) * (np.cos(norm_x * np.pi / 4) ** 0.5)
        else:
            h = 0

        if h > 0:
            outer_pts.append((x, h))
            inner_h = h - molding_w
            if inner_h > 0:
                inner_pts.append((x, inner_h))

    # Build arch as a band between outer and inner profiles
    # Add base segments
    if outer_pts and inner_pts:
        # Add vertical legs
        leg_height = height * 0.15
        left_base_outer = outer_pts[0]
        right_base_outer = outer_pts[-1]
        left_base_inner = inner_pts[0]
        right_base_inner = inner_pts[-1]

        # Full outline: outer arch + legs down + inner arch reversed + legs up
        outline = []

        # Left leg outer
        outline.append((left_base_outer[0], 0))
        outline.append((left_base_outer[0], left_base_outer[1]))

        # Outer arch (already have points)
        outline.extend(outer_pts[1:])

        # Right leg outer going down
        outline.append((right_base_outer[0], 0))

        # Right leg inner going up
        outline.append((right_base_outer[0] + molding_w, 0))
        outline.append((right_base_inner[0], right_base_inner[1]))

        # Inner arch reversed
        outline.extend(reversed(inner_pts[:-1]))

        # Left leg inner going down
        outline.append((left_base_inner[0], left_base_inner[1]))
        outline.append((left_base_outer[0] - molding_w, 0))

        # Close - but we need this to be a valid polygon
        # Simplify: just use outer as a solid arch band
        arch_outer = [(left_base_outer[0], 0)] + outer_pts + [(right_base_outer[0], 0)]
        arch_inner = [(left_base_inner[0], 0)] + inner_pts + [(right_base_inner[0], 0)]

        outer_poly = Polygon(arch_outer)
        inner_poly = Polygon(arch_inner)

        if outer_poly.is_valid and inner_poly.is_valid:
            band = outer_poly.difference(inner_poly)
        else:
            band = outer_poly.buffer(0)

        if band.is_valid and not band.is_empty:
            arch_mesh = extrude_polygon(band, height=thickness)
            # Rotate so it stands upright (XZ plane)
            save_mesh(arch_mesh, "pointed_arch_profile")
            return arch_mesh

    # Fallback: simpler arch
    pts = []
    for i in range(n_pts * 2 + 1):
        t = i / (n_pts * 2)
        x = width * (t - 0.5)
        norm_x = abs(x) / half_w
        h = height * max(0, 1.0 - norm_x ** 1.3)
        pts.append((x, h))

    pts = [(pts[0][0], 0)] + pts + [(pts[-1][0], 0)]
    poly = Polygon(pts).buffer(0)
    inner = poly.buffer(-molding_w)
    if inner.is_valid and not inner.is_empty:
        band = poly.difference(inner)
    else:
        band = poly

    mesh = extrude_polygon(band, height=thickness)
    save_mesh(mesh, "pointed_arch_profile")
    return mesh


# ---------------------------------------------------------------------------
# 7. Carved rosette ornament
# ---------------------------------------------------------------------------
def generate_rosette():
    """
    A circular carved rosette ornament — a multi-layered flower/geometric
    pattern commonly found in Islamic architectural decoration.
    """
    print("\n[7/7] Generating carved rosette ornament...")

    radius = 40.0   # mm
    base_thick = 3.0
    n_petals_outer = 12
    n_petals_inner = 8

    meshes = []

    # Circular base disk
    disk_pts = []
    n = 64
    for i in range(n):
        angle = i * 2 * np.pi / n
        disk_pts.append((radius * np.cos(angle), radius * np.sin(angle)))
    disk_poly = Polygon(disk_pts)
    base_disk = extrude_polygon(disk_poly, height=base_thick)
    meshes.append(base_disk)

    # Outer ring of petals
    outer_petals = []
    for i in range(n_petals_outer):
        angle = i * 2 * np.pi / n_petals_outer
        # Petal shape: pointed ellipse
        petal_pts = []
        petal_len = radius * 0.55
        petal_width = radius * 0.22
        n_p = 20
        for j in range(n_p):
            t = j / n_p * 2 * np.pi
            # Pointed petal
            pr = petal_len * (0.5 + 0.5 * np.cos(t))
            px = pr * np.cos(t) * 0.3
            py = pr * np.sin(t) * 0.8
            # Offset from center and rotate
            dist = radius * 0.55
            cx = dist * np.cos(angle)
            cy = dist * np.sin(angle)
            cos_a = np.cos(angle)
            sin_a = np.sin(angle)
            rx = px * cos_a - py * sin_a + cx
            ry = px * sin_a + py * cos_a + cy
            petal_pts.append((rx, ry))
        try:
            petal = Polygon(petal_pts)
            if petal.is_valid and petal.area > 1.0:
                petal = petal.intersection(disk_poly)
                if not petal.is_empty:
                    outer_petals.append(petal)
        except:
            pass

    if outer_petals:
        outer_union = unary_union(outer_petals)
        if isinstance(outer_union, MultiPolygon):
            parts = list(outer_union.geoms)
        else:
            parts = [outer_union]
        for p in parts:
            if p.is_valid and p.area > 1.0:
                try:
                    m = extrude_polygon(p, height=2.0)
                    m.apply_translation([0, 0, base_thick])
                    meshes.append(m)
                except:
                    pass

    # Inner ring of petals (smaller, rotated)
    inner_petals = []
    for i in range(n_petals_inner):
        angle = i * 2 * np.pi / n_petals_inner + np.pi / n_petals_inner
        petal_pts = []
        petal_len = radius * 0.35
        n_p = 20
        for j in range(n_p):
            t = j / n_p * 2 * np.pi
            pr = petal_len * (0.5 + 0.5 * np.cos(t))
            px = pr * np.cos(t) * 0.3
            py = pr * np.sin(t) * 0.8
            dist = radius * 0.3
            cx = dist * np.cos(angle)
            cy = dist * np.sin(angle)
            cos_a = np.cos(angle)
            sin_a = np.sin(angle)
            rx = px * cos_a - py * sin_a + cx
            ry = px * sin_a + py * cos_a + cy
            petal_pts.append((rx, ry))
        try:
            petal = Polygon(petal_pts)
            if petal.is_valid and petal.area > 1.0:
                inner_petals.append(petal)
        except:
            pass

    if inner_petals:
        inner_union = unary_union(inner_petals)
        if isinstance(inner_union, MultiPolygon):
            parts = list(inner_union.geoms)
        else:
            parts = [inner_union]
        for p in parts:
            if p.is_valid and p.area > 1.0:
                try:
                    m = extrude_polygon(p, height=1.5)
                    m.apply_translation([0, 0, base_thick + 2.0])
                    meshes.append(m)
                except:
                    pass

    # Central boss
    boss_pts = []
    boss_r = radius * 0.15
    for i in range(32):
        angle = i * 2 * np.pi / 32
        boss_pts.append((boss_r * np.cos(angle), boss_r * np.sin(angle)))
    boss_poly = Polygon(boss_pts)
    boss = extrude_polygon(boss_poly, height=3.0)
    boss.apply_translation([0, 0, base_thick + 2.0])
    meshes.append(boss)

    # Decorative ring between layers
    ring_outer_r = radius * 0.45
    ring_inner_r = radius * 0.40
    ring_outer_pts = [(ring_outer_r * np.cos(a), ring_outer_r * np.sin(a))
                      for a in np.linspace(0, 2 * np.pi, 64, endpoint=False)]
    ring_inner_pts = [(ring_inner_r * np.cos(a), ring_inner_r * np.sin(a))
                      for a in np.linspace(0, 2 * np.pi, 64, endpoint=False)]
    ring_outer = Polygon(ring_outer_pts)
    ring_inner = Polygon(ring_inner_pts)
    ring_poly = ring_outer.difference(ring_inner)
    if ring_poly.is_valid and not ring_poly.is_empty:
        if isinstance(ring_poly, MultiPolygon):
            ring_parts = list(ring_poly.geoms)
        else:
            ring_parts = [ring_poly]
        for rp in ring_parts:
            if rp.is_valid and rp.area > 0.5:
                try:
                    rm = extrude_polygon(rp, height=2.5)
                    rm.apply_translation([0, 0, base_thick])
                    meshes.append(rm)
                except:
                    pass

    combined = trimesh.util.concatenate(meshes)
    save_mesh(combined, "carved_rosette")
    return combined


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    print("=" * 60)
    print("Islamic Architectural Design Template Generator")
    print("=" * 60)
    print(f"Output directory: {OUTPUT_DIR}")

    generate_star_tile()
    generate_muqarnas_cell()
    generate_arabesque_panel()
    generate_mashrabiya()
    generate_girih_tiles()
    generate_pointed_arch()
    generate_rosette()

    print("\n" + "=" * 60)
    print("All templates generated successfully!")
    print("=" * 60)

    # List all generated files
    files = sorted(OUTPUT_DIR.glob("*"))
    print(f"\nGenerated {len(files)} files:")
    for f in files:
        size_kb = f.stat().st_size / 1024
        print(f"  {f.name:40s} {size_kb:8.1f} KB")


if __name__ == "__main__":
    main()

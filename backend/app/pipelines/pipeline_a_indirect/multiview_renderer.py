"""Render multi-view images from a 3D model using matplotlib (no GPU/display needed)."""

import math
from pathlib import Path

import numpy as np
from PIL import Image


async def render_multiview(
    model_path: Path,
    output_dir: Path,
    num_views: int = 8,
    resolution: int = 512,
) -> list[Path]:
    """Render the model from multiple camera angles using matplotlib 3D.

    Returns list of paths to rendered PNG images.
    """
    output_dir.mkdir(parents=True, exist_ok=True)

    import trimesh
    import matplotlib
    matplotlib.use("Agg")  # Non-interactive backend
    import matplotlib.pyplot as plt
    from mpl_toolkits.mplot3d.art3d import Poly3DCollection

    # Load the mesh
    loaded = trimesh.load(str(model_path))
    if isinstance(loaded, trimesh.Scene):
        mesh = loaded.dump(concatenate=True) if hasattr(loaded, 'dump') else loaded.to_geometry()
    else:
        mesh = loaded

    # Center and normalize
    mesh.vertices -= mesh.centroid
    scale = mesh.extents.max()
    if scale > 0:
        mesh.vertices /= scale

    vertices = mesh.vertices
    faces = mesh.faces

    # Compute face normals for shading
    v0 = vertices[faces[:, 0]]
    v1 = vertices[faces[:, 1]]
    v2 = vertices[faces[:, 2]]
    face_normals = np.cross(v1 - v0, v2 - v0)
    norms = np.linalg.norm(face_normals, axis=1, keepdims=True)
    norms[norms < 1e-10] = 1
    face_normals /= norms

    rendered_paths = []
    camera_distance = 2.0

    for i in range(num_views):
        angle = 2 * math.pi * i / num_views
        elevation_deg = 25 + 10 * math.sin(angle * 2)

        # Camera position
        azimuth_deg = math.degrees(angle)

        fig = plt.figure(figsize=(resolution / 100, resolution / 100), dpi=100)
        ax = fig.add_subplot(111, projection='3d')

        # Light direction (from camera-ish direction)
        light_dir = np.array([
            math.cos(math.radians(elevation_deg)) * math.cos(angle),
            math.cos(math.radians(elevation_deg)) * math.sin(angle),
            math.sin(math.radians(elevation_deg)),
        ])
        light_dir /= np.linalg.norm(light_dir)

        # Compute face colors based on lighting
        ndl = np.clip(np.sum(face_normals * light_dir, axis=1), 0, 1)
        # Ambient + diffuse
        intensities = 0.25 + 0.65 * ndl

        # Try to get face colors from mesh
        try:
            if hasattr(mesh.visual, 'face_colors') and mesh.visual.face_colors is not None:
                base_colors = mesh.visual.face_colors[:, :3] / 255.0
            else:
                base_colors = np.full((len(faces), 3), [0.75, 0.65, 0.55])
        except Exception:
            base_colors = np.full((len(faces), 3), [0.75, 0.65, 0.55])

        face_colors = base_colors * intensities[:, np.newaxis]
        face_colors = np.clip(face_colors, 0, 1)

        # Build polygon collection
        triangles = vertices[faces]
        poly = Poly3DCollection(triangles, linewidths=0.1)
        poly.set_facecolor(face_colors)
        poly.set_edgecolor(face_colors * 0.8)
        ax.add_collection3d(poly)

        # Set view
        bound = 0.6
        ax.set_xlim(-bound, bound)
        ax.set_ylim(-bound, bound)
        ax.set_zlim(-bound, bound)
        ax.view_init(elev=elevation_deg, azim=azimuth_deg)

        # Clean up axes for a clean render
        ax.set_facecolor((0.92, 0.92, 0.92))
        ax.xaxis.pane.fill = False
        ax.yaxis.pane.fill = False
        ax.zaxis.pane.fill = False
        ax.xaxis.pane.set_edgecolor('none')
        ax.yaxis.pane.set_edgecolor('none')
        ax.zaxis.pane.set_edgecolor('none')
        ax.set_axis_off()

        fig.subplots_adjust(left=0, right=1, top=1, bottom=0)

        path = output_dir / f"view_{i:03d}.png"
        fig.savefig(path, dpi=100, bbox_inches='tight', pad_inches=0,
                    facecolor=(0.92, 0.92, 0.92))
        plt.close(fig)

        # Resize to exact resolution
        img = Image.open(path)
        if img.size != (resolution, resolution):
            img = img.resize((resolution, resolution), Image.LANCZOS)
            img.save(path)

        rendered_paths.append(path)

    return rendered_paths

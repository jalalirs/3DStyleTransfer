"""Render multi-view images from a 3D model using trimesh + pyrender."""

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
    """Render the model from multiple camera angles.

    Returns list of paths to rendered PNG images.
    """
    output_dir.mkdir(parents=True, exist_ok=True)

    import trimesh

    # Load the mesh
    scene_or_mesh = trimesh.load(str(model_path))

    if isinstance(scene_or_mesh, trimesh.Scene):
        mesh = scene_or_mesh.dump(concatenate=True)
    else:
        mesh = scene_or_mesh

    # Center and normalize the mesh
    mesh.vertices -= mesh.centroid
    scale = mesh.extents.max()
    if scale > 0:
        mesh.vertices /= scale

    rendered_paths = []

    try:
        # Try pyrender for higher quality renders
        rendered_paths = _render_with_pyrender(mesh, output_dir, num_views, resolution)
    except Exception:
        # Fallback: render with trimesh's built-in renderer
        rendered_paths = _render_with_trimesh(mesh, output_dir, num_views, resolution)

    return rendered_paths


def _render_with_pyrender(
    mesh, output_dir: Path, num_views: int, resolution: int
) -> list[Path]:
    """Render using pyrender (requires OpenGL)."""
    import pyrender

    # Create pyrender mesh
    pr_mesh = pyrender.Mesh.from_trimesh(mesh)
    scene = pyrender.Scene(ambient_light=[0.3, 0.3, 0.3])
    scene.add(pr_mesh)

    # Add light
    light = pyrender.DirectionalLight(color=[1.0, 1.0, 1.0], intensity=3.0)
    scene.add(light, pose=np.eye(4))

    # Camera
    camera = pyrender.PerspectiveCamera(yfov=np.pi / 3.0)
    renderer = pyrender.OffscreenRenderer(resolution, resolution)

    rendered_paths = []
    camera_distance = 2.0

    for i in range(num_views):
        angle = 2 * math.pi * i / num_views
        elevation = math.pi / 6  # 30 degrees above horizon

        # Camera position on a sphere
        x = camera_distance * math.cos(elevation) * math.cos(angle)
        y = camera_distance * math.cos(elevation) * math.sin(angle)
        z = camera_distance * math.sin(elevation)

        # Look-at camera pose
        camera_pose = _look_at(
            eye=np.array([x, y, z]),
            target=np.array([0, 0, 0]),
            up=np.array([0, 0, 1]),
        )

        cam_node = scene.add(camera, pose=camera_pose)
        color, _ = renderer.render(scene)
        scene.remove_node(cam_node)

        img = Image.fromarray(color)
        path = output_dir / f"view_{i:03d}.png"
        img.save(path)
        rendered_paths.append(path)

    renderer.delete()
    return rendered_paths


def _render_with_trimesh(
    mesh, output_dir: Path, num_views: int, resolution: int
) -> list[Path]:
    """Fallback render using trimesh's scene rendering (no GPU needed)."""
    import trimesh

    rendered_paths = []
    camera_distance = 2.5

    for i in range(num_views):
        angle = 2 * math.pi * i / num_views
        elevation = math.pi / 6

        x = camera_distance * math.cos(elevation) * math.cos(angle)
        y = camera_distance * math.cos(elevation) * math.sin(angle)
        z = camera_distance * math.sin(elevation)

        scene = trimesh.Scene(mesh)
        camera_transform = _look_at(
            eye=np.array([x, y, z]),
            target=np.array([0, 0, 0]),
            up=np.array([0, 0, 1]),
        )
        scene.camera_transform = camera_transform

        try:
            # Try to get a PNG snapshot
            png_data = scene.save_image(resolution=(resolution, resolution))
            path = output_dir / f"view_{i:03d}.png"
            with open(path, "wb") as f:
                f.write(png_data)
            rendered_paths.append(path)
        except Exception:
            # If no display, create a simple depth-based rendering
            path = _render_depth_image(mesh, angle, elevation, camera_distance, resolution, output_dir / f"view_{i:03d}.png")
            rendered_paths.append(path)

    return rendered_paths


def _render_depth_image(
    mesh, angle: float, elevation: float, distance: float, resolution: int, output_path: Path
) -> Path:
    """Create a simple depth/silhouette render as ultimate fallback."""
    import trimesh

    # Create a ray-based depth image
    eye = np.array([
        distance * math.cos(elevation) * math.cos(angle),
        distance * math.cos(elevation) * math.sin(angle),
        distance * math.sin(elevation),
    ])

    # Project vertices to 2D
    forward = -eye / np.linalg.norm(eye)
    right = np.cross(forward, np.array([0, 0, 1]))
    if np.linalg.norm(right) < 1e-6:
        right = np.cross(forward, np.array([0, 1, 0]))
    right = right / np.linalg.norm(right)
    up = np.cross(right, forward)

    vertices = mesh.vertices
    # Project to camera space
    relative = vertices - eye
    z_depth = relative @ forward
    x_proj = relative @ right
    y_proj = relative @ up

    # Only keep vertices in front of camera
    valid = z_depth > 0
    if not valid.any():
        # Empty image
        img = Image.new("RGB", (resolution, resolution), (200, 200, 200))
        img.save(output_path)
        return output_path

    x_proj = x_proj[valid]
    y_proj = y_proj[valid]
    z_depth = z_depth[valid]

    # Normalize to image coords
    scale = resolution / 3.0
    cx, cy = resolution / 2, resolution / 2

    img = Image.new("RGB", (resolution, resolution), (240, 240, 240))
    pixels = img.load()

    for xi, yi, zi in zip(x_proj, y_proj, z_depth):
        px = int(cx + xi * scale)
        py = int(cy - yi * scale)
        if 0 <= px < resolution and 0 <= py < resolution:
            intensity = max(50, min(220, int(220 - zi * 80)))
            pixels[px, py] = (intensity, intensity, intensity)

    img.save(output_path)
    return output_path


def _look_at(eye: np.ndarray, target: np.ndarray, up: np.ndarray) -> np.ndarray:
    """Create a 4x4 camera transform matrix (look-at)."""
    forward = target - eye
    forward = forward / np.linalg.norm(forward)

    right = np.cross(forward, up)
    if np.linalg.norm(right) < 1e-6:
        right = np.cross(forward, np.array([0, 1, 0]))
    right = right / np.linalg.norm(right)

    true_up = np.cross(right, forward)

    mat = np.eye(4)
    mat[:3, 0] = right
    mat[:3, 1] = true_up
    mat[:3, 2] = -forward
    mat[:3, 3] = eye
    return mat

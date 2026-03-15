"""MeshUp wrapper — 3D mesh deformation guided by text or image targets."""

import logging
import subprocess
import sys
from pathlib import Path

logger = logging.getLogger(__name__)

MESHUP_DIR = Path("/opt/MeshUp")


def ensure_meshup():
    """Clone MeshUp if not present."""
    if MESHUP_DIR.exists():
        return
    logger.info("Cloning MeshUp...")
    subprocess.run(
        ["git", "clone", "https://github.com/threedle/MeshUp.git", str(MESHUP_DIR)],
        check=True,
    )
    # Install deps
    subprocess.run(
        [sys.executable, "-m", "pip", "install", "-r", str(MESHUP_DIR / "requirements.txt")],
        check=True,
    )
    # Install nvdiffrast
    subprocess.run(
        [sys.executable, "-m", "pip", "install", "git+https://github.com/NVlabs/nvdiffrast.git"],
        check=True,
    )


def run_meshup(
    source_mesh_path: Path,
    text_prompt: str,
    output_dir: Path,
    num_iterations: int = 500,
) -> Path:
    """Run MeshUp to deform a source mesh toward a text/image target.

    Args:
        source_mesh_path: Path to source OBJ mesh
        text_prompt: Text description of desired style
        output_dir: Where to save results
        num_iterations: Optimization steps (default 500, more = better but slower)

    Returns:
        Path to deformed OBJ mesh
    """
    ensure_meshup()

    output_dir.mkdir(parents=True, exist_ok=True)

    logger.info(f"MeshUp: {source_mesh_path.name} → '{text_prompt}'")

    cmd = [
        sys.executable, str(MESHUP_DIR / "main.py"),
        "--no-cpu_offload",
        "--config", str(MESHUP_DIR / "configs" / "base_config.yml"),
        "--mesh", str(source_mesh_path),
        "--output_path", str(output_dir),
        "--model_size", "XL",
        "--dtype", "float16",
        "--score", "SDS",
        "--text_prompt", text_prompt,
    ]

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        cwd=str(MESHUP_DIR),
        timeout=1800,  # 30 min max
    )

    if result.returncode != 0:
        logger.error(f"MeshUp stderr: {result.stderr[-500:]}")
        raise RuntimeError(f"MeshUp failed: {result.stderr[-300:]}")

    # Find the output mesh
    mesh_dir = output_dir / "images" / "mesh_final"
    if not mesh_dir.exists():
        mesh_dir = output_dir

    for obj_file in sorted(mesh_dir.glob("*.obj")):
        logger.info(f"MeshUp output: {obj_file}")
        return obj_file

    raise RuntimeError(f"MeshUp produced no output mesh in {mesh_dir}")

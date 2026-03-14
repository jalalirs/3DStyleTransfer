"""InstantMesh wrapper — single image to high-quality 3D mesh."""

import logging
import subprocess
import sys
from pathlib import Path

import torch
import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)

INSTANTMESH_REPO = "TencentARC/InstantMesh"
_repo_dir = Path("/opt/InstantMesh")


def _ensure_repo():
    """Clone InstantMesh repo if not present."""
    if _repo_dir.exists():
        return
    logger.info("Cloning InstantMesh repository...")
    subprocess.run(
        ["git", "clone", f"https://github.com/{INSTANTMESH_REPO}.git", str(_repo_dir)],
        check=True,
    )
    # Install its dependencies
    subprocess.run(
        [sys.executable, "-m", "pip", "install", "-e", str(_repo_dir)],
        check=True,
    )


def load_instantmesh_model():
    """Load InstantMesh model pipeline."""
    _ensure_repo()
    sys.path.insert(0, str(_repo_dir))

    device = "cuda" if torch.cuda.is_available() else "cpu"

    # Load the multi-view diffusion model and reconstruction model
    from huggingface_hub import hf_hub_download

    # Download model weights
    model_dir = Path("/opt/instantmesh_weights")
    model_dir.mkdir(exist_ok=True)

    config = {
        "device": device,
        "repo_dir": _repo_dir,
        "model_dir": model_dir,
    }

    # Load pipeline components
    try:
        from src.models.instantmesh import InstantMesh
        model = InstantMesh(device=device)
        model.load_weights()
    except ImportError:
        # Alternative: use the simpler inference script approach
        config["use_script"] = True
        logger.info("Using InstantMesh script-based inference")

    logger.info(f"InstantMesh loaded on {device}")
    return config


def run_instantmesh_inference(config: dict, input_path: Path, output_dir: Path) -> Path:
    """Run InstantMesh on a single image."""
    device = config["device"]
    repo_dir = config["repo_dir"]

    # Remove background
    image = Image.open(input_path).convert("RGB")
    try:
        from rembg import remove
        image = remove(image)
        clean_path = output_dir / "input_clean.png"
        image.save(clean_path)
        input_for_model = clean_path
    except Exception:
        input_for_model = input_path

    output_path = output_dir / "reconstructed.obj"

    if config.get("use_script"):
        # Run via command line
        result = subprocess.run(
            [
                sys.executable,
                str(repo_dir / "run.py"),
                str(input_for_model),
                "--output-dir", str(output_dir),
                "--export-mesh",
            ],
            capture_output=True,
            text=True,
            cwd=str(repo_dir),
        )
        if result.returncode != 0:
            raise RuntimeError(f"InstantMesh failed: {result.stderr}")

        # Find the output mesh
        for ext in ["*.obj", "*.ply", "*.glb"]:
            found = list(output_dir.rglob(ext))
            if found:
                # Rename to standard name
                found[0].rename(output_path)
                break
    else:
        # Direct Python API
        sys.path.insert(0, str(repo_dir))
        from src.models.instantmesh import InstantMesh
        model = InstantMesh(device=device)
        model.load_weights()
        mesh = model.generate(image)
        mesh.export(str(output_path))

    if not output_path.exists():
        raise RuntimeError("InstantMesh produced no output mesh")

    logger.info(f"InstantMesh output: {output_path} ({output_path.stat().st_size} bytes)")
    return output_path

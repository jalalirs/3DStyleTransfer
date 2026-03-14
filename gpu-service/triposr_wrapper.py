"""TripoSR wrapper — single image to 3D mesh in ~0.5s on GPU."""

import logging
from pathlib import Path

import torch
import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)


def load_triposr_model():
    """Load TripoSR model from HuggingFace."""
    from tsr.system import TSR

    model = TSR.from_pretrained(
        "stabilityai/TripoSR",
        config_name="config.yaml",
        weight_name="model.ckpt",
    )

    device = "cuda" if torch.cuda.is_available() else "cpu"
    model.to(device)
    logger.info(f"TripoSR loaded on {device}")
    return model


def run_triposr_inference(model, input_path: Path, output_dir: Path) -> Path:
    """Run TripoSR on a single image, returns path to output OBJ."""
    from tsr.utils import remove_background, resize_foreground

    image = Image.open(input_path).convert("RGB")

    # Remove background for better reconstruction
    try:
        from rembg import remove
        image = remove(image)
        image = resize_foreground(image, ratio=0.85)
    except Exception:
        logger.warning("Background removal failed, using original image")

    # Run model
    with torch.no_grad():
        scene_codes = model([image], device=model.device)

    # Extract mesh
    meshes = model.extract_mesh(scene_codes, resolution=256)
    mesh = meshes[0]

    # Export as OBJ
    output_path = output_dir / "reconstructed.obj"
    mesh.export(str(output_path))

    logger.info(f"TripoSR output: {output_path} ({output_path.stat().st_size} bytes)")
    return output_path

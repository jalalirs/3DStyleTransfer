"""TripoSR wrapper — single image to 3D mesh in ~0.5s on GPU."""

import sys
import logging
from pathlib import Path

import torch
import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)

# Add TripoSR to path
sys.path.insert(0, "/opt/TripoSR")


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
    image = Image.open(input_path)

    # Remove background for better reconstruction
    try:
        from rembg import remove
        image_rgba = remove(image.convert("RGB"))
        # Composite RGBA onto white background to get clean RGB
        bg = Image.new("RGB", image_rgba.size, (255, 255, 255))
        bg.paste(image_rgba, mask=image_rgba.split()[3])
        image = bg
    except Exception as e:
        logger.warning(f"Background removal failed: {e}, using original image")
        image = image.convert("RGB")

    # Ensure RGB
    image = image.convert("RGB")
    logger.info(f"Input image: {image.size}, mode={image.mode}")

    # Run model
    device = "cuda" if torch.cuda.is_available() else "cpu"
    with torch.no_grad():
        scene_codes = model([image], device=device)

    # Extract mesh
    import inspect
    sig = inspect.signature(model.extract_mesh)
    if 'has_vertex_color' in sig.parameters:
        meshes = model.extract_mesh(scene_codes, has_vertex_color=True, resolution=256)
    else:
        meshes = model.extract_mesh(scene_codes, resolution=256)
    mesh = meshes[0]

    # Export as OBJ
    output_path = output_dir / "reconstructed.obj"
    mesh.export(str(output_path))

    logger.info(f"TripoSR output: {output_path} ({output_path.stat().st_size} bytes)")
    return output_path

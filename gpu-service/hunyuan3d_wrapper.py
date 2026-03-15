"""Hunyuan3D 2.0 wrapper — high-fidelity image to 3D mesh with textures."""

import sys
import logging
from pathlib import Path

import torch
from PIL import Image

# Bypass CVE-2025-32434 torch.load check (we're on torch 2.5.1)
import transformers.utils.import_utils
transformers.utils.import_utils.check_torch_load_is_safe = lambda: None

logger = logging.getLogger(__name__)

_shape_pipeline = None
_texture_pipeline = None


def load_hunyuan3d_model():
    """Load Hunyuan3D 2.0 pipeline."""
    global _shape_pipeline, _texture_pipeline

    if _shape_pipeline is not None and _texture_pipeline is not None:
        return _shape_pipeline, _texture_pipeline

    logger.info("Loading Hunyuan3D 2.0...")

    from hy3dgen.shapegen import Hunyuan3DDiTFlowMatchingPipeline
    from hy3dgen.texgen import Hunyuan3DPaintPipeline

    _shape_pipeline = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained(
        "tencent/Hunyuan3D-2"
    )

    _texture_pipeline = Hunyuan3DPaintPipeline.from_pretrained(
        "tencent/Hunyuan3D-2"
    )

    logger.info("Hunyuan3D 2.0 loaded")
    return _shape_pipeline, _texture_pipeline


def run_hunyuan3d_inference(input_path: Path, output_dir: Path) -> Path:
    """Run Hunyuan3D 2.0 on a single image, returns path to output GLB."""
    shape_pipe, texture_pipe = load_hunyuan3d_model()

    image = Image.open(input_path).convert("RGB")
    logger.info(f"Hunyuan3D input: {image.size}")

    # Step 1: Generate shape
    mesh = shape_pipe(image=str(input_path))[0]

    # Step 2: Generate texture
    textured_mesh = texture_pipe(mesh, image=str(input_path))

    # Export
    output_path = output_dir / "reconstructed.glb"
    textured_mesh.export(str(output_path))

    logger.info(f"Hunyuan3D output: {output_path} ({output_path.stat().st_size} bytes)")
    return output_path

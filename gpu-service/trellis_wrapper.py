"""TRELLIS.2 wrapper — high-quality image to 3D mesh."""

import sys
import logging
from pathlib import Path

import torch
from PIL import Image

logger = logging.getLogger(__name__)

_pipeline = None


def load_trellis_model():
    """Load TRELLIS.2 pipeline."""
    global _pipeline
    if _pipeline is not None:
        return _pipeline

    logger.info("Loading TRELLIS.2 model...")

    sys.path.insert(0, "/opt/TRELLIS.2")
    from trellis.pipelines import TrellisImageTo3DPipeline

    _pipeline = TrellisImageTo3DPipeline.from_pretrained("microsoft/TRELLIS.2-4B")
    _pipeline.cuda()

    logger.info("TRELLIS.2 loaded on CUDA")
    return _pipeline


def run_trellis_inference(input_path: Path, output_dir: Path) -> Path:
    """Run TRELLIS.2 on a single image, returns path to output GLB."""
    pipeline = load_trellis_model()

    image = Image.open(input_path).convert("RGB")
    logger.info(f"TRELLIS input: {image.size}")

    # Run pipeline
    outputs = pipeline.run(image, seed=42)

    # Export as GLB (TRELLIS outputs Gaussian splats + mesh)
    output_path = output_dir / "reconstructed.glb"
    pipeline.to_glb(outputs, output_path)

    logger.info(f"TRELLIS output: {output_path} ({output_path.stat().st_size} bytes)")
    return output_path

"""TRELLIS.2 wrapper — high-quality image to 3D mesh."""

import logging
from pathlib import Path

import torch
from PIL import Image

logger = logging.getLogger(__name__)

_pipeline = None


def load_trellis_model():
    global _pipeline
    if _pipeline is not None:
        return _pipeline

    logger.info("Loading TRELLIS.2 model...")
    from trellis2.pipelines import Trellis2ImageTo3DPipeline

    _pipeline = Trellis2ImageTo3DPipeline.from_pretrained("microsoft/TRELLIS.2-4B")
    _pipeline.cuda()

    logger.info("TRELLIS.2 loaded on CUDA")
    return _pipeline


def run_trellis_inference(input_path: Path, output_dir: Path) -> Path:
    pipeline = load_trellis_model()

    image = Image.open(input_path).convert("RGB")
    logger.info(f"TRELLIS input: {image.size}")

    outputs = pipeline.run(image, seed=42)
    mesh = outputs[0]
    mesh.simplify(16777216)

    import o_voxel
    glb = o_voxel.postprocess.to_glb(
        vertices=mesh.vertices,
        faces=mesh.faces,
        attr_volume=mesh.attrs,
        coords=mesh.coords,
        attr_layout=mesh.layout,
        voxel_size=mesh.voxel_size,
        aabb=[[-0.5, -0.5, -0.5], [0.5, 0.5, 0.5]],
        decimation_target=1000000,
        texture_size=4096,
        remesh=True,
        remesh_band=1,
        remesh_project=0,
        verbose=True,
    )

    output_path = output_dir / "reconstructed.glb"
    glb.export(str(output_path), extension_webp=True)

    logger.info(f"TRELLIS output: {output_path} ({output_path.stat().st_size} bytes)")
    return output_path

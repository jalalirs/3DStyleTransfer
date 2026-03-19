"""Image-based style transfer API — split into style + reconstruct steps."""

import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse

from app.config import settings

router = APIRouter(prefix="/api/style-transfer", tags=["style-transfer"])

OUTPUTS_DIR = "assets/models/outputs"


def _job_dir(job_id: str) -> Path:
    d = settings.project_root / OUTPUTS_DIR / job_id
    d.mkdir(parents=True, exist_ok=True)
    return d


@router.post("/style")
async def style_image(
    image: UploadFile = File(...),
    prompt: str = Form(...),
    negative_prompt: str = Form("blurry, low quality, distorted, modern, plastic"),
    strength: float = Form(0.6),
):
    """Step 1: Upload captured view + prompt → Gemini styles it. Returns styled image."""
    job_id = str(uuid.uuid4())
    job_dir = _job_dir(job_id)

    content = await image.read()
    input_path = job_dir / "input.png"
    with open(input_path, "wb") as f:
        f.write(content)

    from app.pipelines.pipeline_a_indirect.image_stylizer import stylize_images

    try:
        styled_paths = await stylize_images(
            input_images=[input_path],
            prompt=prompt,
            negative_prompt=negative_prompt,
            strength=strength,
            output_dir=job_dir,
        )
    except Exception as e:
        raise HTTPException(500, f"Gemini styling failed: {str(e)}")

    if not styled_paths or not styled_paths[0].exists():
        raise HTTPException(500, "Gemini produced no styled image")

    rel_styled = str(styled_paths[0].relative_to(settings.project_root))
    rel_input = str(input_path.relative_to(settings.project_root))

    return {
        "job_id": job_id,
        "input_path": rel_input,
        "styled_image_path": rel_styled,
    }


@router.post("/reconstruct")
async def reconstruct_from_styled(
    job_id: str = Form(...),
    styled_image_path: str = Form(...),
):
    """Step 2: Take a styled image and reconstruct 3D with TRELLIS."""
    styled_path = settings.project_root / styled_image_path
    if not styled_path.exists():
        raise HTTPException(404, f"Styled image not found: {styled_image_path}")

    job_dir = _job_dir(job_id)

    from app.pipelines.pipeline_a_indirect.reconstructor import reconstruct_3d

    try:
        recon_path = await reconstruct_3d(
            styled_images=[styled_path],
            method="trellis",
            output_dir=job_dir,
        )
    except Exception as e:
        raise HTTPException(500, f"TRELLIS reconstruction failed: {str(e)}")

    rel_recon = str(recon_path.relative_to(settings.project_root))

    return {
        "job_id": job_id,
        "output_path": rel_recon,
        "method": "trellis",
    }


@router.get("/outputs/{job_id}/{filename}")
async def get_output_file(job_id: str, filename: str):
    """Serve output files (styled images, reconstructed models)."""
    filepath = settings.project_root / OUTPUTS_DIR / job_id / filename
    if not filepath.exists():
        raise HTTPException(404, "File not found")
    if filename.endswith(".png"):
        return FileResponse(filepath, media_type="image/png")
    elif filename.endswith(".glb"):
        return FileResponse(filepath, media_type="model/gltf-binary")
    return FileResponse(filepath, media_type="application/octet-stream")

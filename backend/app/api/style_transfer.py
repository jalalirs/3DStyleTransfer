"""Image-based style transfer API: captured view + prompt → styled image → 3D reconstruction."""

import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile, File, Form

from app.config import settings

router = APIRouter(prefix="/api/style-transfer", tags=["style-transfer"])


@router.post("/image")
async def image_style_transfer(
    image: UploadFile = File(...),
    prompt: str = Form(...),
    negative_prompt: str = Form("blurry, low quality, distorted, modern, plastic"),
    strength: float = Form(0.6),
):
    """Full pipeline: captured view → Gemini styling → TRELLIS 3D reconstruction.

    Returns the output 3D model path.
    """
    job_id = str(uuid.uuid4())
    job_dir = settings.project_root / "assets" / "models" / "outputs" / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    # 1. Save uploaded image
    content = await image.read()
    input_path = job_dir / "input.png"
    with open(input_path, "wb") as f:
        f.write(content)

    # 2. Style with Gemini
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

    # 3. Reconstruct 3D with TRELLIS
    from app.pipelines.pipeline_a_indirect.reconstructor import reconstruct_3d

    try:
        recon_path = await reconstruct_3d(
            styled_images=styled_paths,
            method="trellis",
            output_dir=job_dir,
        )
    except Exception as e:
        raise HTTPException(500, f"TRELLIS reconstruction failed: {str(e)}")

    # Relative paths for frontend
    rel_styled = str(styled_paths[0].relative_to(settings.project_root))
    rel_recon = str(recon_path.relative_to(settings.project_root))

    return {
        "id": job_id,
        "styled_image_path": rel_styled,
        "output_path": rel_recon,
        "method": "trellis",
    }

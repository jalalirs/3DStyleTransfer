"""Image-based style transfer API — split into style + reconstruct steps.

Each job is stored as a folder under assets/models/outputs/<reference_id>/<job_id>/
with metadata.json tracking prompt, paths, and status.
"""

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse

from app.config import settings

router = APIRouter(prefix="/api/style-transfer", tags=["style-transfer"])

OUTPUTS_DIR = "assets/models/outputs"


def _job_dir(reference_id: str, job_id: str) -> Path:
    d = settings.project_root / OUTPUTS_DIR / reference_id / job_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def _save_metadata(job_dir: Path, meta: dict):
    with open(job_dir / "metadata.json", "w") as f:
        json.dump(meta, f, indent=2, default=str)


def _load_metadata(job_dir: Path) -> dict | None:
    meta_path = job_dir / "metadata.json"
    if not meta_path.exists():
        return None
    with open(meta_path) as f:
        return json.load(f)


@router.get("/jobs/{reference_id}")
async def list_jobs(reference_id: str):
    """List all style transfer jobs for a reference model."""
    ref_dir = settings.project_root / OUTPUTS_DIR / reference_id
    if not ref_dir.exists():
        return []

    jobs = []
    for job_dir in sorted(ref_dir.iterdir(), reverse=True):
        if not job_dir.is_dir():
            continue
        meta = _load_metadata(job_dir)
        if meta:
            jobs.append(meta)
    return jobs


@router.post("/style")
async def style_image(
    image: UploadFile = File(...),
    prompt: str = Form(...),
    negative_prompt: str = Form("blurry, low quality, distorted, modern, plastic"),
    strength: float = Form(0.6),
    reference_id: str = Form(...),
    method: str = Form("image-style"),
):
    """Step 1: Upload captured view + prompt → Gemini styles it. Returns styled image."""
    job_id = str(uuid.uuid4())[:8]
    job_dir = _job_dir(reference_id, job_id)

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

    meta = {
        "job_id": job_id,
        "reference_id": reference_id,
        "method": method,
        "prompt": prompt,
        "negative_prompt": negative_prompt,
        "strength": strength,
        "input_path": rel_input,
        "styled_image_path": rel_styled,
        "output_path": None,
        "status": "styled",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    _save_metadata(job_dir, meta)

    return meta


@router.post("/reconstruct")
async def reconstruct_from_styled(
    job_id: str = Form(...),
    reference_id: str = Form(...),
    styled_image_path: str = Form(...),
):
    """Step 2: Take a styled image and reconstruct 3D with TRELLIS."""
    styled_path = settings.project_root / styled_image_path
    if not styled_path.exists():
        raise HTTPException(404, f"Styled image not found: {styled_image_path}")

    job_dir = _job_dir(reference_id, job_id)

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

    # Update metadata
    meta = _load_metadata(job_dir) or {}
    meta["output_path"] = rel_recon
    meta["status"] = "done"
    meta["completed_at"] = datetime.now(timezone.utc).isoformat()
    _save_metadata(job_dir, meta)

    return meta


@router.get("/outputs/{reference_id}/{job_id}/{filename}")
async def get_output_file(reference_id: str, job_id: str, filename: str):
    """Serve output files (styled images, reconstructed models)."""
    filepath = settings.project_root / OUTPUTS_DIR / reference_id / job_id / filename
    if not filepath.exists():
        raise HTTPException(404, "File not found")
    if filename.endswith(".png"):
        return FileResponse(filepath, media_type="image/png")
    elif filename.endswith(".glb"):
        return FileResponse(filepath, media_type="model/gltf-binary")
    return FileResponse(filepath, media_type="application/octet-stream")

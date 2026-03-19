"""MeshUp API — 3D style transfer: source mesh + text prompt → deformed mesh."""

import uuid
from pathlib import Path

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.config import settings
from app.database import get_session
from app.db_models.assets import Reconstruction
from app.db_models.model3d import Model3D
from app.services import model_service
from sqlmodel import select

router = APIRouter(prefix="/api/meshup", tags=["meshup"])


class MeshUpRequest(BaseModel):
    model_id: str  # Source mesh model ID
    text_prompt: str  # What to deform toward
    num_iterations: int = 500


@router.post("")
async def run_meshup(
    req: MeshUpRequest,
    session: AsyncSession = Depends(get_session),
):
    """Run MeshUp: deform a 3D model toward a text-described style."""
    gpu_url = settings.meshup_service_url or settings.gpu_service_url
    if not gpu_url:
        raise HTTPException(500, "MESHUP_SERVICE_URL not set")

    # Get the source model
    model = await model_service.get_model_by_id(session, req.model_id)
    if not model:
        raise HTTPException(404, "Model not found")

    model_path = settings.project_root / model.file_path

    # Send mesh to GPU service
    async with httpx.AsyncClient(timeout=1800) as client:
        with open(model_path, "rb") as f:
            resp = await client.post(
                f"{gpu_url}/meshup",
                files={"mesh": (model_path.name, f, "application/octet-stream")},
                data={
                    "text_prompt": req.text_prompt,
                    "num_iterations": str(req.num_iterations),
                },
            )

        if resp.status_code != 200:
            raise HTTPException(500, f"MeshUp failed: {resp.text[:300]}")

        # Save result
        recon_id = str(uuid.uuid4())
        recon_dir = settings.storage_dir / "model_assets" / req.model_id / "meshup"
        recon_dir.mkdir(parents=True, exist_ok=True)
        output_path = recon_dir / f"{recon_id}.obj"

        with open(output_path, "wb") as f:
            f.write(resp.content)

    rel_path = str(output_path.relative_to(settings.storage_dir))

    # Save as reconstruction
    recon = Reconstruction(
        id=recon_id,
        model_id=req.model_id,
        styled_image_id="meshup",  # special marker
        method="meshup",
        file_path=rel_path,
    )
    session.add(recon)
    await session.commit()
    await session.refresh(recon)

    return {
        "id": recon_id,
        "model_id": req.model_id,
        "prompt": req.text_prompt,
        "file_path": rel_path,
        "method": "meshup",
    }

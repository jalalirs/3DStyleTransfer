"""MeshUp API — 3D style transfer: source mesh + text prompt → deformed mesh.

Both machines share the same repo clone, so we pass file paths instead of
transferring large model files over the network.
"""

import uuid
from pathlib import Path

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.config import settings
from app.database import get_session
from app.db_models.assets import Reconstruction

router = APIRouter(prefix="/api/meshup", tags=["meshup"])


class MeshUpRequest(BaseModel):
    model_path: str  # Relative path to OBJ file (e.g. "assets/models/references/PG215.OBJ")
    text_prompt: str
    num_iterations: int = 500


@router.post("")
async def run_meshup(
    req: MeshUpRequest,
    session: AsyncSession = Depends(get_session),
):
    """Run MeshUp: deform a 3D model toward a text-described style.

    Both machines have the same repo, so we pass the file path
    instead of transferring the large OBJ over the network.
    """
    gpu_url = settings.meshup_service_url or settings.gpu_service_url
    if not gpu_url:
        raise HTTPException(500, "MESHUP_SERVICE_URL not set")

    # Verify file exists locally
    local_path = settings.project_root / req.model_path
    if not local_path.exists():
        raise HTTPException(404, f"Model file not found: {req.model_path}")

    async with httpx.AsyncClient(timeout=1800) as client:
        resp = await client.post(
            f"{gpu_url}/meshup",
            json={
                "model_path": req.model_path,
                "text_prompt": req.text_prompt,
                "num_iterations": req.num_iterations,
            },
        )

        if resp.status_code != 200:
            raise HTTPException(500, f"MeshUp failed: {resp.text[:300]}")

        # Save the output mesh to outputs folder
        recon_id = str(uuid.uuid4())
        output_dir = settings.project_root / "assets" / "models" / "outputs"
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = output_dir / f"{recon_id}.obj"

        with open(output_path, "wb") as f:
            f.write(resp.content)

    return {
        "id": recon_id,
        "model_path": req.model_path,
        "prompt": req.text_prompt,
        "output_path": f"assets/models/outputs/{recon_id}.obj",
        "method": "meshup",
    }

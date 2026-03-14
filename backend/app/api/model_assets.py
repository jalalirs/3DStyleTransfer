"""Model assets API — views, styled images, reconstructions. All persistent."""

import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from pydantic import BaseModel

from app.config import settings
from app.database import get_session
from app.db_models.assets import ModelView, StyledImage, Reconstruction

router = APIRouter(prefix="/api/models/{model_id}", tags=["model-assets"])

PROMPT_TEMPLATES = [
    {
        "id": "ottoman",
        "name": "Ottoman Iznik",
        "prompt": "Ottoman blue Iznik ceramic tiles with intricate gold arabesque patterns and calligraphy",
        "negative_prompt": "blurry, low quality, distorted, modern, plastic",
    },
    {
        "id": "alhambra",
        "name": "Alhambra Moorish",
        "prompt": "Alhambra Moorish carved red and gold stucco with intricate geometric star patterns and muqarnas detailing",
        "negative_prompt": "blurry, low quality, distorted, modern, plastic",
    },
    {
        "id": "persian",
        "name": "Persian Mosaic",
        "prompt": "Persian turquoise and cobalt blue mosaic tilework with floral arabesque patterns and geometric borders",
        "negative_prompt": "blurry, low quality, distorted, modern, plastic",
    },
    {
        "id": "mughal",
        "name": "Mughal Marble",
        "prompt": "Mughal white marble with pietra dura floral inlay in semi-precious stones, lapis lazuli and carnelian details",
        "negative_prompt": "blurry, low quality, distorted, modern, plastic",
    },
]


def _model_dir(model_id: str) -> Path:
    d = settings.storage_dir / "model_assets" / model_id
    d.mkdir(parents=True, exist_ok=True)
    return d


# ---- Templates ----

@router.get("/templates")
async def get_templates():
    return PROMPT_TEMPLATES


# ---- Views ----

@router.get("/views")
async def list_views(model_id: str, session: AsyncSession = Depends(get_session)):
    result = await session.execute(
        select(ModelView).where(ModelView.model_id == model_id).order_by(ModelView.created_at)
    )
    return list(result.scalars().all())


@router.post("/views")
async def upload_view(
    model_id: str,
    image: UploadFile = File(...),
    name: str = Form(""),
    session: AsyncSession = Depends(get_session),
):
    view_id = str(uuid.uuid4())
    view_dir = _model_dir(model_id) / "views"
    view_dir.mkdir(exist_ok=True)

    filename = f"{view_id}.png"
    filepath = view_dir / filename
    content = await image.read()
    with open(filepath, "wb") as f:
        f.write(content)

    rel_path = str(filepath.relative_to(settings.storage_dir))
    view = ModelView(
        id=view_id, model_id=model_id, name=name or f"View", file_path=rel_path,
    )
    session.add(view)
    await session.commit()
    await session.refresh(view)
    return view


@router.get("/views/{view_id}/image")
async def get_view_image(model_id: str, view_id: str):
    filepath = settings.storage_dir / "model_assets" / model_id / "views" / f"{view_id}.png"
    if not filepath.exists():
        raise HTTPException(404, "View image not found")
    return FileResponse(filepath, media_type="image/png")


@router.delete("/views/{view_id}")
async def delete_view(model_id: str, view_id: str, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(ModelView).where(ModelView.id == view_id))
    view = result.scalar_one_or_none()
    if not view:
        raise HTTPException(404)
    await session.delete(view)
    await session.commit()
    # Delete file too
    filepath = settings.storage_dir / "model_assets" / model_id / "views" / f"{view_id}.png"
    if filepath.exists():
        filepath.unlink()
    return {"ok": True}


# ---- Styled Images ----

class StyleRequest(BaseModel):
    view_id: str
    prompt: str
    negative_prompt: str = "blurry, low quality, distorted, modern, plastic"
    strength: float = 0.6


@router.get("/styled")
async def list_styled(model_id: str, session: AsyncSession = Depends(get_session)):
    result = await session.execute(
        select(StyledImage).where(StyledImage.model_id == model_id).order_by(StyledImage.created_at)
    )
    return list(result.scalars().all())


@router.post("/styled")
async def create_styled(
    model_id: str,
    req: StyleRequest,
    session: AsyncSession = Depends(get_session),
):
    # Get the view
    result = await session.execute(select(ModelView).where(ModelView.id == req.view_id))
    view = result.scalar_one_or_none()
    if not view:
        raise HTTPException(404, "View not found")

    view_path = settings.storage_dir / view.file_path

    styled_id = str(uuid.uuid4())
    styled_dir = _model_dir(model_id) / "styled"
    styled_dir.mkdir(exist_ok=True)
    output_path = styled_dir / f"{styled_id}.png"

    from app.pipelines.pipeline_a_indirect.image_stylizer import stylize_images

    try:
        results = await stylize_images(
            input_images=[view_path],
            prompt=req.prompt,
            negative_prompt=req.negative_prompt,
            strength=req.strength,
            output_dir=styled_dir,
        )
        # Rename to our ID-based name
        if results and results[0].exists():
            results[0].rename(output_path)
    except Exception as e:
        raise HTTPException(500, f"Styling failed: {str(e)}")

    rel_path = str(output_path.relative_to(settings.storage_dir))
    styled = StyledImage(
        id=styled_id,
        model_id=model_id,
        view_id=req.view_id,
        prompt=req.prompt,
        negative_prompt=req.negative_prompt,
        strength=req.strength,
        file_path=rel_path,
    )
    session.add(styled)
    await session.commit()
    await session.refresh(styled)
    return styled


@router.get("/styled/{styled_id}/image")
async def get_styled_image(model_id: str, styled_id: str):
    filepath = settings.storage_dir / "model_assets" / model_id / "styled" / f"{styled_id}.png"
    if not filepath.exists():
        raise HTTPException(404, "Styled image not found")
    return FileResponse(filepath, media_type="image/png")


@router.delete("/styled/{styled_id}")
async def delete_styled(model_id: str, styled_id: str, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(StyledImage).where(StyledImage.id == styled_id))
    styled = result.scalar_one_or_none()
    if not styled:
        raise HTTPException(404)
    await session.delete(styled)
    await session.commit()
    filepath = settings.storage_dir / "model_assets" / model_id / "styled" / f"{styled_id}.png"
    if filepath.exists():
        filepath.unlink()
    return {"ok": True}


# ---- Reconstructions ----

class ReconstructRequest(BaseModel):
    styled_image_id: str
    method: str = "trellis"  # trellis, hunyuan3d, triposr


@router.get("/reconstructions")
async def list_reconstructions(model_id: str, session: AsyncSession = Depends(get_session)):
    result = await session.execute(
        select(Reconstruction).where(Reconstruction.model_id == model_id).order_by(Reconstruction.created_at)
    )
    return list(result.scalars().all())


@router.post("/reconstructions")
async def create_reconstruction(
    model_id: str,
    req: ReconstructRequest,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(StyledImage).where(StyledImage.id == req.styled_image_id))
    styled = result.scalar_one_or_none()
    if not styled:
        raise HTTPException(404, "Styled image not found")

    styled_path = settings.storage_dir / styled.file_path

    recon_id = str(uuid.uuid4())
    recon_dir = _model_dir(model_id) / "reconstructions"
    recon_dir.mkdir(exist_ok=True)

    from app.pipelines.pipeline_a_indirect.reconstructor import reconstruct_3d

    try:
        result_path = await reconstruct_3d(
            styled_images=[styled_path],
            method=req.method,
            output_dir=recon_dir,
        )
        # Rename to our ID-based name, keeping the extension
        ext = result_path.suffix  # .obj or .glb
        output_path = recon_dir / f"{recon_id}{ext}"
        if result_path.exists() and result_path != output_path:
            result_path.rename(output_path)
    except Exception as e:
        raise HTTPException(500, f"Reconstruction failed: {str(e)}")

    rel_path = str(output_path.relative_to(settings.storage_dir))
    recon = Reconstruction(
        id=recon_id,
        model_id=model_id,
        styled_image_id=req.styled_image_id,
        method=req.method,
        file_path=rel_path,
    )
    session.add(recon)
    await session.commit()
    await session.refresh(recon)
    return recon


@router.get("/reconstructions/{recon_id}/model.obj")
async def get_reconstruction_obj(model_id: str, recon_id: str):
    return _serve_reconstruction(model_id, recon_id)


@router.get("/reconstructions/{recon_id}/model.glb")
async def get_reconstruction_glb(model_id: str, recon_id: str):
    return _serve_reconstruction(model_id, recon_id)


def _serve_reconstruction(model_id: str, recon_id: str):
    recon_dir = settings.storage_dir / "model_assets" / model_id / "reconstructions"
    # Try both extensions
    for ext in [".glb", ".obj"]:
        filepath = recon_dir / f"{recon_id}{ext}"
        if filepath.exists():
            media = "model/gltf-binary" if ext == ".glb" else "application/octet-stream"
            return FileResponse(filepath, media_type=media, filename=f"model{ext}")
    raise HTTPException(404, "Reconstruction not found")

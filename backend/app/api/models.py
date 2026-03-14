"""REST API for 3D model management."""

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.services import model_service
from app.services.storage import get_upload_path
from app.schemas.model import ModelResponse, ModelUploadResponse

router = APIRouter(prefix="/api/models", tags=["models"])


@router.get("", response_model=list[ModelResponse])
async def list_models(
    category: str | None = None,
    session: AsyncSession = Depends(get_session),
):
    models = await model_service.get_all_models(session)
    if category:
        models = [m for m in models if m.category == category]
    return models


@router.get("/{model_id}", response_model=ModelResponse)
async def get_model(model_id: str, session: AsyncSession = Depends(get_session)):
    model = await model_service.get_model_by_id(session, model_id)
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    return model


@router.post("", response_model=ModelUploadResponse)
async def upload_model(
    file: UploadFile = File(...),
    name: str = "",
    category: str = "other",
    session: AsyncSession = Depends(get_session),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    allowed_exts = {".obj", ".gltf", ".glb", ".stl", ".fbx"}
    ext = "." + file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in allowed_exts:
        raise HTTPException(status_code=400, detail=f"Unsupported format. Use: {allowed_exts}")

    upload_name = name or file.filename.rsplit(".", 1)[0]
    dest = get_upload_path(file.filename)

    content = await file.read()
    with open(dest, "wb") as f:
        f.write(content)

    rel_path = f"storage/uploads/{file.filename}"
    model = await model_service.register_model(
        session=session,
        name=upload_name,
        file_path=rel_path,
        category=category,
        source="uploaded",
    )

    return ModelUploadResponse(id=model.id, name=model.name, message="Model uploaded successfully")

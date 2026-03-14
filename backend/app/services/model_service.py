"""Service for managing 3D models — registration, upload, metadata extraction."""

from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.db_models.model3d import Model3D
from app.config import settings


async def get_all_models(session: AsyncSession) -> list[Model3D]:
    result = await session.execute(select(Model3D).order_by(Model3D.created_at.desc()))
    return list(result.scalars().all())


async def get_model_by_id(session: AsyncSession, model_id: str) -> Model3D | None:
    result = await session.execute(select(Model3D).where(Model3D.id == model_id))
    return result.scalar_one_or_none()


async def register_model(
    session: AsyncSession,
    name: str,
    file_path: str,
    category: str = "",
    source: str = "uploaded",
    description: str = "",
    license_info: str = "",
    source_job_id: str | None = None,
) -> Model3D:
    """Register a 3D model file in the database."""
    # Extract mesh info if file is small enough (skip large files to avoid blocking startup)
    vertex_count, face_count = 0, 0
    fmt = Path(file_path).suffix.lstrip(".")

    full_path = settings.project_root / file_path
    # Check total size of directory (for glTF with .bin) or file
    total_size = 0
    if full_path.is_file():
        parent = full_path.parent
        total_size = sum(f.stat().st_size for f in parent.iterdir() if f.is_file())
    max_size_for_parsing = 5 * 1024 * 1024  # 5MB total dir size
    if full_path.exists() and total_size < max_size_for_parsing:
        try:
            import trimesh
            mesh = trimesh.load(str(full_path), force="mesh")
            vertex_count = len(mesh.vertices)
            face_count = len(mesh.faces)
        except Exception:
            pass

    model = Model3D(
        name=name,
        description=description,
        category=category,
        source=source,
        license=license_info,
        file_path=file_path,
        original_format=fmt,
        vertex_count=vertex_count,
        face_count=face_count,
        source_job_id=source_job_id,
    )
    session.add(model)
    await session.commit()
    await session.refresh(model)
    return model


async def seed_builtin_models(session: AsyncSession):
    """Seed the database with models from assets/models/ on first run."""
    result = await session.execute(
        select(Model3D).where(Model3D.source == "builtin").limit(1)
    )
    if result.scalar_one_or_none():
        return  # Already seeded

    assets_dir = settings.assets_dir
    if not assets_dir.exists():
        return

    # Scan for model files
    for ext in ["*.obj", "*.gltf", "*.glb"]:
        for path in assets_dir.rglob(ext):
            # Determine category from parent dir
            rel = path.relative_to(settings.project_root)
            parts = path.relative_to(assets_dir).parts
            category = parts[0] if len(parts) > 1 else "other"

            # Skip duplicate formats (prefer gltf > glb > obj)
            name = path.stem
            if ext == "*.obj":
                gltf_exists = path.with_suffix(".gltf").exists()
                if gltf_exists:
                    continue

            # Check for sketchfab nested structure
            if "sketchfab" in str(path):
                category_parts = path.relative_to(assets_dir / "sketchfab").parts
                category = category_parts[0] if len(category_parts) > 1 else "other"
                name = category_parts[1] if len(category_parts) > 2 else path.stem

            await register_model(
                session=session,
                name=name.replace("_", " ").title(),
                file_path=str(rel),
                category=category,
                source="builtin",
                description=f"Built-in {category} model",
            )

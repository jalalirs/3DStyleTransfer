"""FastAPI application for 3D Style Transfer Platform."""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import init_db, get_session, async_session
from app.api import models, jobs, pipelines


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    # Seed built-in models
    async with async_session() as session:
        from app.services.model_service import seed_builtin_models
        await seed_builtin_models(session)
    yield
    # Shutdown


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    lifespan=lifespan,
)

# CORS for frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve files under /static/{file_path} where file_path matches DB entries
# file_path in DB looks like: "assets/models/sketchfab/.../scene.gltf" or "storage/jobs/..."
# Mount project_root so all paths resolve correctly
if settings.project_root.exists():
    app.mount("/static", StaticFiles(directory=str(settings.project_root)), name="static_files")

# API routes
app.include_router(models.router)
app.include_router(jobs.router)
app.include_router(pipelines.router)


@app.get("/api/health")
async def health():
    from app.pipelines.registry import list_pipelines
    return {
        "status": "ok",
        "pipelines": len(list_pipelines()),
    }

"""Manual workshop API — step-by-step style transfer with manual control."""

import uuid
import base64
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.config import settings
from app.database import get_session

router = APIRouter(prefix="/api/workshop", tags=["workshop"])

# In-memory workshop sessions (simple for now)
_sessions: dict[str, dict] = {}


class WorkshopCreate(BaseModel):
    model_id: str
    name: str = ""


class StyleRequest(BaseModel):
    prompt: str
    negative_prompt: str = "blurry, low quality, distorted"
    strength: float = 0.6


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


@router.get("/templates")
async def get_prompt_templates():
    return PROMPT_TEMPLATES


@router.post("/sessions")
async def create_session(req: WorkshopCreate):
    """Create a new workshop session."""
    session_id = str(uuid.uuid4())
    session_dir = settings.jobs_dir / f"workshop_{session_id}"
    session_dir.mkdir(parents=True, exist_ok=True)
    (session_dir / "snapshots").mkdir(exist_ok=True)
    (session_dir / "styled").mkdir(exist_ok=True)

    _sessions[session_id] = {
        "id": session_id,
        "model_id": req.model_id,
        "name": req.name or f"Workshop {session_id[:8]}",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "snapshots": [],
        "styled": [],
        "reconstruction": None,
        "status": "capturing",  # capturing, styling, styled, reconstructing, done
    }
    return _sessions[session_id]


@router.get("/sessions")
async def list_sessions():
    return list(_sessions.values())


@router.get("/sessions/{session_id}")
async def get_session_detail(session_id: str):
    if session_id not in _sessions:
        raise HTTPException(404, "Session not found")
    return _sessions[session_id]


@router.post("/sessions/{session_id}/snapshots")
async def upload_snapshot(session_id: str, image: UploadFile = File(...)):
    """Upload a manually captured viewport snapshot."""
    if session_id not in _sessions:
        raise HTTPException(404, "Session not found")

    session = _sessions[session_id]
    session_dir = settings.jobs_dir / f"workshop_{session_id}"
    snap_dir = session_dir / "snapshots"

    idx = len(session["snapshots"])
    filename = f"snap_{idx:03d}.png"
    filepath = snap_dir / filename

    content = await image.read()
    with open(filepath, "wb") as f:
        f.write(content)

    session["snapshots"].append({
        "index": idx,
        "filename": filename,
        "path": str(filepath),
    })

    return {"index": idx, "filename": filename, "total": len(session["snapshots"])}


@router.get("/sessions/{session_id}/snapshots/{index}")
async def get_snapshot(session_id: str, index: int):
    if session_id not in _sessions:
        raise HTTPException(404, "Session not found")
    session_dir = settings.jobs_dir / f"workshop_{session_id}"
    filepath = session_dir / "snapshots" / f"snap_{index:03d}.png"
    if not filepath.exists():
        raise HTTPException(404, "Snapshot not found")
    return FileResponse(filepath, media_type="image/png")


@router.post("/sessions/{session_id}/stylize")
async def stylize_snapshots(session_id: str, req: StyleRequest):
    """Send all snapshots to Gemini for styling."""
    if session_id not in _sessions:
        raise HTTPException(404, "Session not found")

    session = _sessions[session_id]
    if not session["snapshots"]:
        raise HTTPException(400, "No snapshots captured yet")

    session["status"] = "styling"
    session_dir = settings.jobs_dir / f"workshop_{session_id}"
    styled_dir = session_dir / "styled"

    from app.pipelines.pipeline_a_indirect.image_stylizer import stylize_images

    snap_paths = [Path(s["path"]) for s in session["snapshots"]]

    try:
        styled_paths = await stylize_images(
            input_images=snap_paths,
            prompt=req.prompt,
            negative_prompt=req.negative_prompt,
            strength=req.strength,
            output_dir=styled_dir,
        )

        session["styled"] = [
            {"index": i, "filename": p.name, "path": str(p)}
            for i, p in enumerate(styled_paths)
        ]
        session["status"] = "styled"

    except Exception as e:
        session["status"] = "capturing"
        raise HTTPException(500, f"Styling failed: {str(e)}")

    return session


@router.get("/sessions/{session_id}/styled/{index}")
async def get_styled(session_id: str, index: int):
    if session_id not in _sessions:
        raise HTTPException(404, "Session not found")
    session_dir = settings.jobs_dir / f"workshop_{session_id}"
    filepath = session_dir / "styled" / f"styled_{index:03d}.png"
    if not filepath.exists():
        raise HTTPException(404, "Styled image not found")
    return FileResponse(filepath, media_type="image/png")


@router.post("/sessions/{session_id}/reconstruct")
async def reconstruct(session_id: str, method: str = "triposr", image_index: int = 0):
    """Send a styled image to GPU service for 3D reconstruction."""
    if session_id not in _sessions:
        raise HTTPException(404, "Session not found")

    session = _sessions[session_id]
    if not session["styled"]:
        raise HTTPException(400, "No styled images yet")

    if image_index >= len(session["styled"]):
        raise HTTPException(400, f"Image index {image_index} out of range")

    session["status"] = "reconstructing"
    session_dir = settings.jobs_dir / f"workshop_{session_id}"
    output_dir = session_dir / "output"
    output_dir.mkdir(exist_ok=True)

    styled_path = Path(session["styled"][image_index]["path"])

    from app.pipelines.pipeline_a_indirect.reconstructor import reconstruct_3d

    try:
        output_path = await reconstruct_3d(
            styled_images=[styled_path],
            method=method,
            output_dir=output_dir,
        )
        session["reconstruction"] = {
            "filename": output_path.name,
            "path": str(output_path),
        }
        session["status"] = "done"
    except Exception as e:
        session["status"] = "styled"
        raise HTTPException(500, f"Reconstruction failed: {str(e)}")

    return session


@router.get("/sessions/{session_id}/reconstruction/{filename}")
async def get_reconstruction(session_id: str, filename: str = "model.obj"):
    if session_id not in _sessions:
        raise HTTPException(404, "Session not found")
    session = _sessions[session_id]
    if not session.get("reconstruction"):
        raise HTTPException(404, "No reconstruction yet")
    filepath = Path(session["reconstruction"]["path"])
    if not filepath.exists():
        raise HTTPException(404, "Reconstruction file not found")
    return FileResponse(filepath, media_type="application/octet-stream", filename="reconstructed.obj")

"""GPU Service — MeshUp style transfer only. CLIP model loaded at startup."""

import logging
import tempfile
from pathlib import Path

import torch
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="MeshUp Service", version="2.0.0")

WORK_DIR = Path(tempfile.mkdtemp(prefix="meshup_"))
DATA_ROOT = Path("/data")  # Shared volume mount


def get_gpu_info() -> str:
    if torch.cuda.is_available():
        name = torch.cuda.get_device_name(0)
        mem = torch.cuda.get_device_properties(0).total_memory / 1024**3
        return f"{name} ({mem:.0f}GB)"
    return "No GPU (CPU mode)"


# --- Preload CLIP at startup so first request is fast ---
_clip_loaded = False


@app.on_event("startup")
async def startup_preload():
    global _clip_loaded
    logger.info("Pre-loading CLIP model for MeshUp...")
    try:
        import clip
        clip.load("ViT-B/32", device="cuda" if torch.cuda.is_available() else "cpu")
        _clip_loaded = True
        logger.info("CLIP model loaded. MeshUp ready.")
    except Exception as e:
        logger.warning(f"CLIP pre-load failed (will retry on first request): {e}")


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "gpu": get_gpu_info(),
        "cuda_available": torch.cuda.is_available(),
        "clip_loaded": _clip_loaded,
        "service": "meshup",
    }


class MeshUpRequest(BaseModel):
    model_path: str  # Relative path e.g. "assets/models/references/PG215.OBJ"
    text_prompt: str
    num_iterations: int = 500


@app.post("/meshup")
async def meshup_stylize(req: MeshUpRequest):
    """Deform a 3D mesh toward a text-described style using MeshUp."""
    input_path = DATA_ROOT / req.model_path
    if not input_path.exists():
        raise HTTPException(404, f"Model not found: {req.model_path}")

    logger.info(f"MeshUp: '{req.text_prompt}', iterations={req.num_iterations}, mesh={input_path}")

    job_dir = WORK_DIR / f"meshup_{hash(str(input_path)) % 100000}"
    job_dir.mkdir(parents=True, exist_ok=True)

    try:
        from meshup_wrapper import run_meshup
        output_path = run_meshup(
            source_mesh_path=input_path,
            text_prompt=req.text_prompt,
            output_dir=job_dir / "output",
            num_iterations=req.num_iterations,
        )
    except Exception as e:
        logger.error(f"MeshUp failed: {e}", exc_info=True)
        raise HTTPException(500, f"MeshUp failed: {str(e)}")

    return FileResponse(output_path, media_type="application/octet-stream", filename="deformed.obj")


if __name__ == "__main__":
    uvicorn.run("server_meshup:app", host="0.0.0.0", port=8878, reload=False)

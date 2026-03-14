"""GPU Reconstruction Service — runs InstantMesh and TripoSR locally."""

import io
import logging
import tempfile
from pathlib import Path

import torch
import uvicorn
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from PIL import Image

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="3D Reconstruction GPU Service", version="0.1.0")

# Global model holders — loaded on first use
_triposr_model = None
_instantmesh_model = None

WORK_DIR = Path(tempfile.mkdtemp(prefix="recon3d_"))


def get_gpu_info() -> str:
    if torch.cuda.is_available():
        return torch.cuda.get_device_name(0)
    return "No GPU (CPU mode)"


@app.get("/health")
async def health():
    models_loaded = []
    if _triposr_model is not None:
        models_loaded.append("triposr")
    if _instantmesh_model is not None:
        models_loaded.append("instantmesh")
    return {
        "status": "ok",
        "gpu": get_gpu_info(),
        "cuda_available": torch.cuda.is_available(),
        "models_loaded": models_loaded,
    }


@app.post("/reconstruct")
async def reconstruct(
    image: UploadFile = File(...),
    method: str = Form("instantmesh"),
):
    """Reconstruct a 3D model from a single image.

    Args:
        image: Input PNG image
        method: "instantmesh" (better quality) or "triposr" (faster)

    Returns:
        OBJ file
    """
    if method not in ("instantmesh", "triposr"):
        raise HTTPException(400, f"Unknown method: {method}. Use 'instantmesh' or 'triposr'")

    # Save uploaded image
    content = await image.read()
    input_image = Image.open(io.BytesIO(content)).convert("RGB")

    job_dir = WORK_DIR / f"job_{id(content)}"
    job_dir.mkdir(parents=True, exist_ok=True)
    input_path = job_dir / "input.png"
    input_image.save(input_path)

    logger.info(f"Reconstructing with {method}, image size: {input_image.size}")

    try:
        if method == "triposr":
            output_path = run_triposr(input_path, job_dir)
        else:
            output_path = run_instantmesh(input_path, job_dir)
    except Exception as e:
        logger.error(f"Reconstruction failed: {e}", exc_info=True)
        raise HTTPException(500, f"Reconstruction failed: {str(e)}")

    return FileResponse(
        output_path,
        media_type="application/octet-stream",
        filename=f"reconstructed.obj",
    )


# ---------------------------------------------------------------------------
# TripoSR
# ---------------------------------------------------------------------------

def load_triposr():
    global _triposr_model
    if _triposr_model is not None:
        return _triposr_model

    logger.info("Loading TripoSR model...")
    from triposr_wrapper import load_triposr_model
    _triposr_model = load_triposr_model()
    logger.info("TripoSR loaded.")
    return _triposr_model


def run_triposr(input_path: Path, output_dir: Path) -> Path:
    model = load_triposr()
    from triposr_wrapper import run_triposr_inference
    return run_triposr_inference(model, input_path, output_dir)


# ---------------------------------------------------------------------------
# InstantMesh
# ---------------------------------------------------------------------------

def load_instantmesh():
    global _instantmesh_model
    if _instantmesh_model is not None:
        return _instantmesh_model

    logger.info("Loading InstantMesh model...")
    from instantmesh_wrapper import load_instantmesh_model
    _instantmesh_model = load_instantmesh_model()
    logger.info("InstantMesh loaded.")
    return _instantmesh_model


def run_instantmesh(input_path: Path, output_dir: Path) -> Path:
    model = load_instantmesh()
    from instantmesh_wrapper import run_instantmesh_inference
    return run_instantmesh_inference(model, input_path, output_dir)


# ---------------------------------------------------------------------------
# Preload models on startup (optional, controlled by env)
# ---------------------------------------------------------------------------

@app.on_event("startup")
async def startup():
    import os
    if os.environ.get("PRELOAD_MODELS", "0") == "1":
        logger.info("Preloading models...")
        try:
            load_instantmesh()
        except Exception as e:
            logger.warning(f"Failed to preload InstantMesh: {e}")
        try:
            load_triposr()
        except Exception as e:
            logger.warning(f"Failed to preload TripoSR: {e}")


if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8877, reload=False)

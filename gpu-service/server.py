"""GPU Reconstruction Service — runs TRELLIS.2, Hunyuan3D 2.0, and TripoSR."""

import io
import logging
import tempfile
from pathlib import Path

import torch
import uvicorn
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.responses import FileResponse
from PIL import Image

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="3D Reconstruction GPU Service", version="0.2.0")

WORK_DIR = Path(tempfile.mkdtemp(prefix="recon3d_"))

# Track loaded models
_loaded_models = set()


def get_gpu_info() -> str:
    if torch.cuda.is_available():
        name = torch.cuda.get_device_name(0)
        mem = torch.cuda.get_device_properties(0).total_mem / 1024**3
        return f"{name} ({mem:.0f}GB)"
    return "No GPU (CPU mode)"


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "gpu": get_gpu_info(),
        "cuda_available": torch.cuda.is_available(),
        "models_loaded": list(_loaded_models),
        "available_methods": ["trellis", "hunyuan3d", "triposr"],
    }


@app.post("/reconstruct")
async def reconstruct(
    image: UploadFile = File(...),
    method: str = Form("trellis"),
):
    """Reconstruct a 3D model from a single image.

    Methods:
        - trellis: TRELLIS.2 (Microsoft) — best quality, ~30s
        - hunyuan3d: Hunyuan3D 2.0 (Tencent) — high quality with textures, ~45s
        - triposr: TripoSR (Stability AI) — fastest, lower quality, ~2s
    """
    if method not in ("trellis", "hunyuan3d", "triposr"):
        raise HTTPException(400, f"Unknown method: {method}. Use 'trellis', 'hunyuan3d', or 'triposr'")

    content = await image.read()
    input_image = Image.open(io.BytesIO(content)).convert("RGB")

    job_dir = WORK_DIR / f"job_{hash(content) % 100000}"
    job_dir.mkdir(parents=True, exist_ok=True)
    input_path = job_dir / "input.png"
    input_image.save(input_path)

    logger.info(f"Reconstructing with {method}, image: {input_image.size}")

    try:
        if method == "trellis":
            output_path = _run_trellis(input_path, job_dir)
        elif method == "hunyuan3d":
            output_path = _run_hunyuan3d(input_path, job_dir)
        else:
            output_path = _run_triposr(input_path, job_dir)
    except Exception as e:
        logger.error(f"Reconstruction failed: {e}", exc_info=True)
        raise HTTPException(500, f"Reconstruction failed: {str(e)}")

    # Determine content type based on extension
    ext = output_path.suffix.lower()
    media_type = "model/gltf-binary" if ext == ".glb" else "application/octet-stream"
    filename = f"reconstructed{ext}"

    return FileResponse(output_path, media_type=media_type, filename=filename)


# ---------------------------------------------------------------------------
# TRELLIS.2
# ---------------------------------------------------------------------------

def _run_trellis(input_path: Path, output_dir: Path) -> Path:
    from trellis_wrapper import run_trellis_inference
    _loaded_models.add("trellis")
    return run_trellis_inference(input_path, output_dir)


# ---------------------------------------------------------------------------
# Hunyuan3D 2.0
# ---------------------------------------------------------------------------

def _run_hunyuan3d(input_path: Path, output_dir: Path) -> Path:
    from hunyuan3d_wrapper import run_hunyuan3d_inference
    _loaded_models.add("hunyuan3d")
    return run_hunyuan3d_inference(input_path, output_dir)


# ---------------------------------------------------------------------------
# TripoSR
# ---------------------------------------------------------------------------

_triposr_model = None


def _run_triposr(input_path: Path, output_dir: Path) -> Path:
    global _triposr_model
    if _triposr_model is None:
        from triposr_wrapper import load_triposr_model
        _triposr_model = load_triposr_model()
        _loaded_models.add("triposr")
    from triposr_wrapper import run_triposr_inference
    return run_triposr_inference(_triposr_model, input_path, output_dir)


if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8877, reload=False)

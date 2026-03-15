"""GPU Reconstruction Service — TRELLIS.2 only."""

import io
import logging
import tempfile
from pathlib import Path

import torch
import uvicorn
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import FileResponse
from PIL import Image

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="3D Reconstruction — TRELLIS.2", version="1.0.0")

WORK_DIR = Path(tempfile.mkdtemp(prefix="recon3d_"))


def get_gpu_info() -> str:
    if torch.cuda.is_available():
        name = torch.cuda.get_device_name(0)
        mem = torch.cuda.get_device_properties(0).total_memory / 1024**3
        return f"{name} ({mem:.0f}GB)"
    return "No GPU (CPU mode)"


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "gpu": get_gpu_info(),
        "cuda_available": torch.cuda.is_available(),
    }


@app.post("/reconstruct")
async def reconstruct(image: UploadFile = File(...)):
    """Reconstruct a 3D model from a single image using TRELLIS.2."""
    content = await image.read()
    input_image = Image.open(io.BytesIO(content)).convert("RGB")

    job_dir = WORK_DIR / f"job_{hash(content) % 100000}"
    job_dir.mkdir(parents=True, exist_ok=True)
    input_path = job_dir / "input.png"
    input_image.save(input_path)

    logger.info(f"Reconstructing, image: {input_image.size}")

    try:
        from trellis_wrapper import run_trellis_inference
        output_path = run_trellis_inference(input_path, job_dir)
    except Exception as e:
        logger.error(f"Reconstruction failed: {e}", exc_info=True)
        raise HTTPException(500, f"Reconstruction failed: {str(e)}")

    ext = output_path.suffix.lower()
    media_type = "model/gltf-binary" if ext == ".glb" else "application/octet-stream"
    return FileResponse(output_path, media_type=media_type, filename=f"reconstructed{ext}")


if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8877, reload=False)

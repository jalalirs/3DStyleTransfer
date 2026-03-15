"""GPU Service — TRELLIS.2 reconstruction + MeshUp style transfer."""

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

app = FastAPI(title="GPU Service — TRELLIS.2 + MeshUp", version="2.0.0")

WORK_DIR = Path(tempfile.mkdtemp(prefix="gpu_service_"))


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
        "services": ["trellis", "meshup"],
    }


# ---------------------------------------------------------------------------
# TRELLIS.2 — Image → 3D
# ---------------------------------------------------------------------------

@app.post("/reconstruct")
async def reconstruct(image: UploadFile = File(...)):
    """Reconstruct a 3D model from a single image using TRELLIS.2."""
    content = await image.read()
    input_image = Image.open(io.BytesIO(content)).convert("RGB")

    job_dir = WORK_DIR / f"trellis_{hash(content) % 100000}"
    job_dir.mkdir(parents=True, exist_ok=True)
    input_path = job_dir / "input.png"
    input_image.save(input_path)

    logger.info(f"TRELLIS reconstructing, image: {input_image.size}")

    try:
        from trellis_wrapper import run_trellis_inference
        output_path = run_trellis_inference(input_path, job_dir)
    except Exception as e:
        logger.error(f"TRELLIS failed: {e}", exc_info=True)
        raise HTTPException(500, f"Reconstruction failed: {str(e)}")

    ext = output_path.suffix.lower()
    media_type = "model/gltf-binary" if ext == ".glb" else "application/octet-stream"
    return FileResponse(output_path, media_type=media_type, filename=f"reconstructed{ext}")


# ---------------------------------------------------------------------------
# MeshUp — 3D + text/image → deformed 3D
# ---------------------------------------------------------------------------

@app.post("/meshup")
async def meshup_stylize(
    mesh: UploadFile = File(...),
    text_prompt: str = Form(...),
    num_iterations: int = Form(500),
):
    """Deform a 3D mesh toward a text-described style using MeshUp.

    Input: OBJ mesh file + text prompt describing the target style
    Output: Deformed OBJ mesh
    """
    content = await mesh.read()

    job_dir = WORK_DIR / f"meshup_{hash(content) % 100000}"
    job_dir.mkdir(parents=True, exist_ok=True)

    # Save input mesh
    input_path = job_dir / "input.obj"
    with open(input_path, "wb") as f:
        f.write(content)

    logger.info(f"MeshUp: '{text_prompt}', iterations={num_iterations}")

    try:
        from meshup_wrapper import run_meshup
        output_path = run_meshup(
            source_mesh_path=input_path,
            text_prompt=text_prompt,
            output_dir=job_dir / "output",
            num_iterations=num_iterations,
        )
    except Exception as e:
        logger.error(f"MeshUp failed: {e}", exc_info=True)
        raise HTTPException(500, f"MeshUp failed: {str(e)}")

    return FileResponse(output_path, media_type="application/octet-stream", filename="deformed.obj")


if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8877, reload=False)

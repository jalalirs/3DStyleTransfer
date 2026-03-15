"""3D reconstruction from styled 2D images — calls the GPU service over network."""

from pathlib import Path

import httpx

from app.config import settings


async def reconstruct_3d(
    styled_images: list[Path],
    method: str,
    output_dir: Path,
) -> Path:
    """Send the best styled image to the GPU reconstruction service.

    Methods: trellis, hunyuan3d, triposr
    Returns path to output 3D file (GLB or OBJ).
    """
    output_dir.mkdir(parents=True, exist_ok=True)

    gpu_url = settings.gpu_service_url
    if not gpu_url:
        raise ValueError(
            "GPU_SERVICE_URL not set. Run the gpu-service on your GPU machine "
            "and set the Tailscale URL in docker-compose.yml"
        )

    from PIL import Image
    import io

    best_image = styled_images[0]
    img = Image.open(best_image).convert("RGB")
    img_buffer = io.BytesIO()
    img.save(img_buffer, format="PNG")
    img_bytes = img_buffer.getvalue()

    async with httpx.AsyncClient(timeout=600) as client:
        try:
            health = await client.get(f"{gpu_url}/health")
            health.raise_for_status()
        except Exception as e:
            raise RuntimeError(f"GPU service not reachable at {gpu_url}: {e}")

        resp = await client.post(
            f"{gpu_url}/reconstruct",
            files={"image": ("styled.png", img_bytes, "image/png")},
        )

        if resp.status_code != 200:
            raise RuntimeError(f"GPU reconstruction failed ({resp.status_code}): {resp.text}")

        # Determine output extension from response
        content_disp = resp.headers.get("content-disposition", "")
        if ".glb" in content_disp or method in ("trellis", "hunyuan3d"):
            ext = ".glb"
        else:
            ext = ".obj"

        output_path = output_dir / f"reconstructed{ext}"
        with open(output_path, "wb") as f:
            f.write(resp.content)

    return output_path

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

    Returns path to output OBJ file.
    """
    output_dir.mkdir(parents=True, exist_ok=True)

    gpu_url = settings.gpu_service_url
    if not gpu_url:
        raise ValueError(
            "GPU_SERVICE_URL not set. Run the gpu-service on your GPU machine "
            "and set the Tailscale URL in docker-compose.yml"
        )

    # Use the front-facing view (first image) for best reconstruction
    best_image = styled_images[0]

    async with httpx.AsyncClient(timeout=300) as client:
        # Check GPU service health
        try:
            health = await client.get(f"{gpu_url}/health")
            health.raise_for_status()
        except Exception as e:
            raise RuntimeError(
                f"GPU service not reachable at {gpu_url}: {e}. "
                f"Make sure the gpu-service is running on your GPU machine."
            )

        # Send image for reconstruction
        with open(best_image, "rb") as f:
            resp = await client.post(
                f"{gpu_url}/reconstruct",
                files={"image": ("styled.png", f, "image/png")},
                data={"method": method},
            )

        if resp.status_code != 200:
            raise RuntimeError(f"GPU reconstruction failed ({resp.status_code}): {resp.text}")

        # Save the returned OBJ file
        output_path = output_dir / "reconstructed.obj"
        with open(output_path, "wb") as f:
            f.write(resp.content)

    return output_path

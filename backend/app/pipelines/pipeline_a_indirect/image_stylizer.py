"""Image stylization via Google Imagen 3 (Vertex AI)."""

import base64
import json
from pathlib import Path
from typing import Callable, Awaitable

import httpx

from app.config import settings


async def stylize_images(
    input_images: list[Path],
    prompt: str,
    negative_prompt: str,
    strength: float,
    output_dir: Path,
    progress_callback: Callable[[float], Awaitable[None]] | None = None,
) -> list[Path]:
    """Stylize a list of rendered images using Google Imagen.

    Returns list of paths to styled images.
    """
    output_dir.mkdir(parents=True, exist_ok=True)

    styled_paths = []
    for i, img_path in enumerate(input_images):
        output_path = output_dir / f"styled_{i:03d}.png"
        await _stylize_google_imagen(
            input_path=img_path,
            output_path=output_path,
            prompt=prompt,
            negative_prompt=negative_prompt,
            strength=strength,
        )
        styled_paths.append(output_path)

        if progress_callback:
            await progress_callback((i + 1) / len(input_images))

    return styled_paths


def _get_google_access_token() -> str:
    """Get an access token from the GCP service account credentials."""
    creds_path = settings.gcp_credentials_path
    if not creds_path or not Path(creds_path).exists():
        raise ValueError(
            "GCP_CREDENTIALS_PATH not set or file not found. "
            "Point it to your service account JSON file in .env"
        )

    with open(creds_path) as f:
        creds = json.load(f)

    from google.oauth2 import service_account
    from google.auth.transport.requests import Request

    credentials = service_account.Credentials.from_service_account_info(
        creds,
        scopes=["https://www.googleapis.com/auth/cloud-platform"],
    )
    credentials.refresh(Request())
    return credentials.token


async def _stylize_google_imagen(
    input_path: Path,
    output_path: Path,
    prompt: str,
    negative_prompt: str,
    strength: float,
) -> None:
    """Use Google Imagen 3 via Vertex AI for image stylization.

    Strategy:
    1. Try Imagen 3 edit mode (BGSWAP) with the input as a reference image
    2. If that fails, use Imagen 3 generation with a detailed prompt
    """
    access_token = _get_google_access_token()
    project_id = settings.gcp_project_id
    location = settings.gcp_location

    with open(input_path, "rb") as f:
        img_b64 = base64.b64encode(f.read()).decode()

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=120) as client:
        # Approach 1: Edit mode with reference image
        edit_url = (
            f"https://{location}-aiplatform.googleapis.com/v1/"
            f"projects/{project_id}/locations/{location}/publishers/google/"
            f"models/imagen-3.0-capability-001:predict"
        )

        edit_payload = {
            "instances": [{
                "prompt": prompt,
                "referenceImages": [{
                    "referenceType": "REFERENCE_TYPE_RAW",
                    "referenceId": 1,
                    "referenceImage": {"bytesBase64Encoded": img_b64},
                }],
            }],
            "parameters": {
                "sampleCount": 1,
                "editConfig": {"editMode": "EDIT_MODE_BGSWAP"},
                "negativePrompt": negative_prompt,
            },
        }

        resp = await client.post(edit_url, headers=headers, json=edit_payload)

        if resp.status_code == 200:
            result = resp.json()
            predictions = result.get("predictions", [])
            if predictions and predictions[0].get("bytesBase64Encoded"):
                img_bytes = base64.b64decode(predictions[0]["bytesBase64Encoded"])
                with open(output_path, "wb") as f:
                    f.write(img_bytes)
                return

        # Approach 2: Pure generation with descriptive prompt
        gen_url = (
            f"https://{location}-aiplatform.googleapis.com/v1/"
            f"projects/{project_id}/locations/{location}/publishers/google/"
            f"models/imagen-3.0-generate-001:predict"
        )

        gen_payload = {
            "instances": [{
                "prompt": (
                    f"{prompt}, 3D rendered architectural element, "
                    f"studio lighting, clean background, high detail"
                ),
            }],
            "parameters": {
                "sampleCount": 1,
                "aspectRatio": "1:1",
                "negativePrompt": negative_prompt,
            },
        }

        resp = await client.post(gen_url, headers=headers, json=gen_payload)
        resp.raise_for_status()

        result = resp.json()
        predictions = result.get("predictions", [])
        if not predictions or not predictions[0].get("bytesBase64Encoded"):
            raise RuntimeError(f"Imagen returned no image: {result}")

        img_bytes = base64.b64decode(predictions[0]["bytesBase64Encoded"])
        with open(output_path, "wb") as f:
            f.write(img_bytes)

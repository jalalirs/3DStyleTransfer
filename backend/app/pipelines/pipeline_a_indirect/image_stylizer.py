"""Image stylization via Google Gemini image generation (img2img)."""

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
    """Stylize rendered images using Gemini image-to-image generation.

    Returns list of paths to styled images.
    """
    output_dir.mkdir(parents=True, exist_ok=True)

    styled_paths = []
    for i, img_path in enumerate(input_images):
        output_path = output_dir / f"styled_{i:03d}.png"
        await _stylize_gemini(
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


async def _stylize_gemini(
    input_path: Path,
    output_path: Path,
    prompt: str,
    negative_prompt: str,
    strength: float,
) -> None:
    """Use Gemini Flash Image model for true image-to-image style transfer.

    Sends the input render + style prompt, gets back a transformed image
    that preserves the structure but applies the requested style.
    """
    access_token = _get_google_access_token()
    project_id = settings.gcp_project_id
    location = settings.gcp_location

    with open(input_path, "rb") as f:
        img_b64 = base64.b64encode(f.read()).decode()

    model_name = "gemini-2.5-flash-image"

    style_prompt = (
        f"Transform this 3D rendered architectural element by applying this style: {prompt}. "
        f"Keep the exact same shape, structure, viewpoint and proportions of the object. "
        f"Only change the surface appearance, materials and textures. "
        f"The object should remain centered and the same size in the image. "
        f"Do not change the camera angle or add any new objects. "
        f"Avoid: {negative_prompt}."
    )

    url = (
        f"https://{location}-aiplatform.googleapis.com/v1/"
        f"projects/{project_id}/locations/{location}/publishers/google/"
        f"models/{model_name}:generateContent"
    )

    payload = {
        "contents": [{
            "role": "user",
            "parts": [
                {
                    "inlineData": {
                        "mimeType": "image/png",
                        "data": img_b64,
                    }
                },
                {
                    "text": style_prompt,
                },
            ],
        }],
        "generationConfig": {
            "responseModalities": ["IMAGE", "TEXT"],
            "temperature": 0.4 + (strength * 0.6),
        },
    }

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }

    # Retry with backoff for rate limiting
    import asyncio
    max_retries = 5
    async with httpx.AsyncClient(timeout=120) as client:
        for attempt in range(max_retries):
            resp = await client.post(url, headers=headers, json=payload)

            if resp.status_code == 429:
                wait = 10 * (attempt + 1)
                print(f"Rate limited, waiting {wait}s (attempt {attempt + 1}/{max_retries})")
                await asyncio.sleep(wait)
                continue

            if resp.status_code != 200:
                raise RuntimeError(f"Gemini failed ({resp.status_code}): {resp.text[:300]}")

            result = resp.json()
            candidates = result.get("candidates", [])
            if not candidates:
                raise RuntimeError(f"Gemini returned no candidates: {result}")

            # Find image part in response
            for part in candidates[0].get("content", {}).get("parts", []):
                if "inlineData" in part:
                    img_bytes = base64.b64decode(part["inlineData"]["data"])
                    with open(output_path, "wb") as f:
                        f.write(img_bytes)
                    return

            # No image in response — retry (Gemini sometimes returns text-only)
            print(f"No image in response, retrying (attempt {attempt + 1}/{max_retries})")
            await asyncio.sleep(5)
            continue

    raise RuntimeError("Gemini failed to generate an image after all retries")

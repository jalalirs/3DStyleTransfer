"""File storage service — abstracts local filesystem (dev) or S3 (prod)."""

import shutil
from pathlib import Path

from app.config import settings


def get_upload_path(filename: str) -> Path:
    path = settings.uploads_dir / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def get_job_dir(job_id: str) -> Path:
    path = settings.jobs_dir / job_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def get_job_input_dir(job_id: str) -> Path:
    path = get_job_dir(job_id) / "input"
    path.mkdir(parents=True, exist_ok=True)
    return path


def get_job_intermediate_dir(job_id: str) -> Path:
    path = get_job_dir(job_id) / "intermediate"
    path.mkdir(parents=True, exist_ok=True)
    return path


def get_job_output_dir(job_id: str) -> Path:
    path = get_job_dir(job_id) / "output"
    path.mkdir(parents=True, exist_ok=True)
    return path


def copy_file(src: Path, dst: Path) -> Path:
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    return dst


def get_model_file_url(file_path: str) -> str:
    """Convert a file path to a URL served by the static files endpoint."""
    return f"/static/{file_path}"

import os
from pathlib import Path
from pydantic_settings import BaseSettings


def _default_project_root() -> Path:
    """In Docker: /data, locally: two levels up from this file."""
    if os.environ.get("DOCKER_ENV"):
        return Path("/data")
    return Path(__file__).parent.parent.parent


class Settings(BaseSettings):
    app_name: str = "3D Style Transfer Platform"
    debug: bool = True
    docker_env: bool = False

    # Paths — overridable via env vars
    project_root: Path = _default_project_root()
    assets_dir: Path = Path("")
    storage_dir: Path = Path("")
    uploads_dir: Path = Path("")
    jobs_dir: Path = Path("")
    thumbnails_dir: Path = Path("")

    # Database
    database_url: str = "sqlite+aiosqlite:///./style_transfer.db"

    # Celery / Redis
    redis_url: str = "redis://localhost:6379/0"

    # Google Cloud (Imagen)
    gcp_credentials_path: str = ""  # Path to service account JSON
    gcp_project_id: str = "m3ajem"
    gcp_location: str = "us-central1"

    # GPU reconstruction service (runs on separate GPU machine via Tailscale)
    gpu_service_url: str = ""  # e.g. "http://100.x.x.x:8877"

    # Rendering
    render_width: int = 512
    render_height: int = 512
    default_num_views: int = 8

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    def model_post_init(self, __context):
        # Resolve paths relative to project_root if not explicitly set
        if str(self.assets_dir) == ".":
            self.assets_dir = self.project_root / "assets" / "models"
        if str(self.storage_dir) == ".":
            self.storage_dir = self.project_root / "storage"
        if str(self.uploads_dir) == ".":
            self.uploads_dir = self.storage_dir / "uploads"
        if str(self.jobs_dir) == ".":
            self.jobs_dir = self.storage_dir / "jobs"
        if str(self.thumbnails_dir) == ".":
            self.thumbnails_dir = self.storage_dir / "thumbnails"


settings = Settings()

# Ensure storage dirs exist
for d in [settings.storage_dir, settings.uploads_dir, settings.jobs_dir, settings.thumbnails_dir]:
    d.mkdir(parents=True, exist_ok=True)

from datetime import datetime
from pydantic import BaseModel
from typing import Optional


class ModelResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    name: str
    description: str
    category: str
    source: str
    license: str
    file_path: str
    original_format: str
    thumbnail_path: Optional[str]
    vertex_count: int
    face_count: int
    created_at: datetime
    source_job_id: Optional[str]


class ModelUploadResponse(BaseModel):
    id: str
    name: str
    message: str

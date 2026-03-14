from datetime import datetime
from pydantic import BaseModel
from typing import Optional


class JobCreate(BaseModel):
    pipeline_id: str
    input_model_id: str
    config: dict = {}


class JobResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    pipeline_id: str
    status: str
    input_model_id: str
    config: dict
    current_stage: str
    progress: float
    error_message: Optional[str]
    output_model_id: Optional[str]
    intermediate_artifacts: dict
    created_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]


class PipelineInfo(BaseModel):
    id: str
    name: str
    description: str
    config_schema: dict
    stages: list[dict]

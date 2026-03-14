import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import SQLModel, Field, Column
from sqlalchemy import JSON


class Job(SQLModel, table=True):
    __tablename__ = "jobs"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    pipeline_id: str  # e.g. "pipeline_a_indirect"
    status: str = "pending"  # pending, queued, running, completed, failed, cancelled
    input_model_id: str
    config: dict = Field(default_factory=dict, sa_column=Column(JSON))

    # Progress tracking
    current_stage: str = ""
    progress: float = 0.0
    error_message: Optional[str] = None

    # Results
    output_model_id: Optional[str] = None
    intermediate_artifacts: dict = Field(default_factory=dict, sa_column=Column(JSON))

    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

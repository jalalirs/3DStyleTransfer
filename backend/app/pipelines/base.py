from abc import ABC, abstractmethod
from pathlib import Path
from typing import Awaitable, Callable

from pydantic import BaseModel


class PipelineStage(BaseModel):
    name: str
    description: str
    progress_weight: float  # fraction of total (all stages should sum to 1.0)


ProgressCallback = Callable[[str, float, dict | None], Awaitable[None]]
"""Signature: (stage_name, fraction_complete, optional_metadata) -> None"""


class BasePipeline(ABC):
    """Abstract base class for all style transfer pipelines.

    To add a new pipeline:
    1. Create a folder under pipelines/ (e.g. pipeline_d_mymethod/)
    2. Create pipeline.py with a class inheriting BasePipeline
    3. It will be auto-discovered by the registry
    """

    id: str
    name: str
    description: str

    @abstractmethod
    def get_config_schema(self) -> dict:
        """Return JSON Schema for pipeline-specific configuration.
        The frontend renders a dynamic form from this."""
        ...

    @abstractmethod
    def get_stages(self) -> list[PipelineStage]:
        """Return ordered list of stages for progress tracking."""
        ...

    @abstractmethod
    async def execute(
        self,
        job_id: str,
        input_model_path: Path,
        config: dict,
        working_dir: Path,
        progress_callback: ProgressCallback,
    ) -> Path:
        """Run the pipeline. Returns path to output 3D model file.

        Args:
            job_id: Unique job identifier
            input_model_path: Path to input 3D model (glTF/OBJ)
            config: Pipeline-specific configuration (validated against config_schema)
            working_dir: Directory for intermediate files (renders, styled images, etc.)
            progress_callback: Call to report progress updates
        """
        ...

"""REST API for pipeline discovery."""

from fastapi import APIRouter

from app.pipelines.registry import list_pipelines, get_pipeline
from app.schemas.job import PipelineInfo

router = APIRouter(prefix="/api/pipelines", tags=["pipelines"])


@router.get("", response_model=list[PipelineInfo])
async def list_all_pipelines():
    return [
        PipelineInfo(
            id=p.id,
            name=p.name,
            description=p.description,
            config_schema=p.get_config_schema(),
            stages=[s.model_dump() for s in p.get_stages()],
        )
        for p in list_pipelines()
    ]


@router.get("/{pipeline_id}", response_model=PipelineInfo)
async def get_pipeline_info(pipeline_id: str):
    p = get_pipeline(pipeline_id)
    if not p:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Pipeline not found")
    return PipelineInfo(
        id=p.id,
        name=p.name,
        description=p.description,
        config_schema=p.get_config_schema(),
        stages=[s.model_dump() for s in p.get_stages()],
    )

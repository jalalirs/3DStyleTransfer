"""REST API for job management."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.database import get_session
from app.db_models.job import Job
from app.schemas.job import JobCreate, JobResponse
from app.pipelines.registry import get_pipeline
from app.services.storage import get_job_dir

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


@router.get("", response_model=list[JobResponse])
async def list_jobs(
    status: str | None = None,
    session: AsyncSession = Depends(get_session),
):
    query = select(Job).order_by(Job.created_at.desc())
    if status:
        query = query.where(Job.status == status)
    result = await session.execute(query)
    return list(result.scalars().all())


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(job_id: str, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.post("", response_model=JobResponse)
async def create_job(
    req: JobCreate,
    session: AsyncSession = Depends(get_session),
):
    pipeline = get_pipeline(req.pipeline_id)
    if not pipeline:
        raise HTTPException(status_code=400, detail=f"Unknown pipeline: {req.pipeline_id}")

    job = Job(
        pipeline_id=req.pipeline_id,
        input_model_id=req.input_model_id,
        config=req.config,
        status="pending",
    )
    session.add(job)
    await session.commit()
    await session.refresh(job)

    # Create working directory
    get_job_dir(job.id)

    # TODO: Dispatch to Celery worker
    # For now, we'll run inline (see /api/jobs/{id}/run)

    return job


@router.post("/{job_id}/run", response_model=JobResponse)
async def run_job(job_id: str, session: AsyncSession = Depends(get_session)):
    """Run a job synchronously (dev mode — later replaced by Celery dispatch)."""
    from app.services import model_service
    from app.services.storage import get_job_input_dir, get_job_output_dir, copy_file
    from app.config import settings
    from pathlib import Path

    result = await session.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    pipeline = get_pipeline(job.pipeline_id)
    if not pipeline:
        raise HTTPException(status_code=400, detail=f"Unknown pipeline: {job.pipeline_id}")

    # Get input model
    model = await model_service.get_model_by_id(session, job.input_model_id)
    if not model:
        raise HTTPException(status_code=400, detail="Input model not found")

    input_path = settings.project_root / model.file_path
    working_dir = get_job_input_dir(job.id).parent

    # Update status
    job.status = "running"
    job.started_at = datetime.now(timezone.utc)
    session.add(job)
    await session.commit()

    async def progress_callback(stage: str, progress: float, metadata: dict | None = None):
        job.current_stage = stage
        job.progress = progress
        if metadata:
            artifacts = dict(job.intermediate_artifacts)
            artifacts.update(metadata)
            job.intermediate_artifacts = artifacts
        session.add(job)
        await session.commit()

    try:
        output_path = await pipeline.execute(
            job_id=job.id,
            input_model_path=input_path,
            config=job.config,
            working_dir=working_dir,
            progress_callback=progress_callback,
        )

        # Register output model
        rel_output = output_path.relative_to(settings.project_root)
        output_model = await model_service.register_model(
            session=session,
            name=f"{model.name} - Styled ({pipeline.name})",
            file_path=str(rel_output),
            category=model.category,
            source="generated",
            source_job_id=job.id,
        )

        job.status = "completed"
        job.progress = 1.0
        job.output_model_id = output_model.id
        job.completed_at = datetime.now(timezone.utc)

    except Exception as e:
        job.status = "failed"
        job.error_message = str(e)
        job.completed_at = datetime.now(timezone.utc)

    session.add(job)
    await session.commit()
    await session.refresh(job)
    return job


@router.post("/{job_id}/cancel")
async def cancel_job(job_id: str, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status in ("completed", "failed", "cancelled"):
        raise HTTPException(status_code=400, detail=f"Job already {job.status}")
    job.status = "cancelled"
    job.completed_at = datetime.now(timezone.utc)
    session.add(job)
    await session.commit()
    return {"status": "cancelled"}

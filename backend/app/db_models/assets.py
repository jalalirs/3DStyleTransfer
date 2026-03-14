"""Persistent assets linked to models — views, styled images, reconstructions."""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import SQLModel, Field


class ModelView(SQLModel, table=True):
    """A captured viewport snapshot of a 3D model."""
    __tablename__ = "model_views"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    model_id: str = Field(index=True)
    name: str = ""
    file_path: str  # relative path to PNG
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StyledImage(SQLModel, table=True):
    """A styled variation generated from a view."""
    __tablename__ = "styled_images"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    model_id: str = Field(index=True)
    view_id: str  # FK to ModelView
    prompt: str
    negative_prompt: str = ""
    strength: float = 0.6
    file_path: str  # relative path to PNG
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Reconstruction(SQLModel, table=True):
    """A 3D reconstruction from a styled image."""
    __tablename__ = "reconstructions"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    model_id: str = Field(index=True)
    styled_image_id: str  # FK to StyledImage
    method: str = "triposr"
    file_path: str  # relative path to OBJ
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

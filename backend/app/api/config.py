"""Config API — serves the style transfer configuration loaded from XML."""

from fastapi import APIRouter

from app.services.config_loader import load_config

router = APIRouter(prefix="/api/config", tags=["config"])


@router.get("")
async def get_config():
    """Return the full style transfer config: references, targets, methods."""
    cfg = load_config()
    return {
        "references": [
            {
                "id": m.id,
                "name": m.name,
                "path": m.path,
                "category": m.category,
                "description": m.description,
                "role": m.role,
            }
            for m in cfg.references
        ],
        "targets": [
            {
                "id": m.id,
                "name": m.name,
                "path": m.path,
                "category": m.category,
                "description": m.description,
                "role": m.role,
            }
            for m in cfg.targets
        ],
        "methods": [
            {
                "id": m.id,
                "name": m.name,
                "enabled": m.enabled,
                "description": m.description,
            }
            for m in cfg.methods
        ],
    }


@router.get("/references")
async def get_references():
    """Return only reference models."""
    cfg = load_config()
    return [
        {
            "id": m.id,
            "name": m.name,
            "path": m.path,
            "category": m.category,
            "description": m.description,
        }
        for m in cfg.references
    ]


@router.get("/targets")
async def get_targets():
    """Return only target models."""
    cfg = load_config()
    return [
        {
            "id": m.id,
            "name": m.name,
            "path": m.path,
            "category": m.category,
            "description": m.description,
        }
        for m in cfg.targets
    ]


@router.get("/methods")
async def get_methods():
    """Return available transfer methods."""
    cfg = load_config()
    return [
        {
            "id": m.id,
            "name": m.name,
            "enabled": m.enabled,
            "description": m.description,
        }
        for m in cfg.methods
    ]

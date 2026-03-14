"""Auto-discovers and registers all pipeline implementations."""

import importlib
import pkgutil
from pathlib import Path

from app.pipelines.base import BasePipeline

_registry: dict[str, BasePipeline] = {}


def discover_pipelines():
    """Scan pipeline_* subdirectories for BasePipeline subclasses."""
    pipelines_dir = Path(__file__).parent
    for item in pipelines_dir.iterdir():
        if item.is_dir() and item.name.startswith("pipeline_"):
            module_name = f"app.pipelines.{item.name}.pipeline"
            try:
                module = importlib.import_module(module_name)
                for attr_name in dir(module):
                    attr = getattr(module, attr_name)
                    if (
                        isinstance(attr, type)
                        and issubclass(attr, BasePipeline)
                        and attr is not BasePipeline
                    ):
                        instance = attr()
                        _registry[instance.id] = instance
            except (ImportError, Exception) as e:
                print(f"Warning: Failed to load pipeline from {module_name}: {e}")


def get_pipeline(pipeline_id: str) -> BasePipeline | None:
    return _registry.get(pipeline_id)


def list_pipelines() -> list[BasePipeline]:
    return list(_registry.values())


# Auto-discover on import
discover_pipelines()

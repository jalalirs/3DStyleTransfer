"""Load style transfer configuration from XML."""

import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from app.config import settings


@dataclass
class ModelEntry:
    id: str
    name: str
    path: str
    category: str
    description: str
    role: str  # "reference" or "target"


@dataclass
class MethodEntry:
    id: str
    name: str
    enabled: bool
    description: str


@dataclass
class StyleTransferConfig:
    references: list[ModelEntry] = field(default_factory=list)
    targets: list[ModelEntry] = field(default_factory=list)
    methods: list[MethodEntry] = field(default_factory=list)


_cached_config: Optional[StyleTransferConfig] = None


def load_config(force_reload: bool = False) -> StyleTransferConfig:
    """Load and cache the XML config from assets/models/config.xml."""
    global _cached_config
    if _cached_config and not force_reload:
        return _cached_config

    config_path = settings.assets_dir / "config.xml"
    if not config_path.exists():
        # Fallback: check project root
        config_path = settings.project_root / "assets" / "models" / "config.xml"

    if not config_path.exists():
        _cached_config = StyleTransferConfig()
        return _cached_config

    tree = ET.parse(config_path)
    root = tree.getroot()

    references = []
    refs_el = root.find("references")
    if refs_el is not None:
        for m in refs_el.findall("model"):
            references.append(ModelEntry(
                id=m.get("id", ""),
                name=m.get("name", ""),
                path=m.get("path", ""),
                category=m.get("category", ""),
                description=m.get("description", ""),
                role="reference",
            ))

    targets = []
    tgts_el = root.find("targets")
    if tgts_el is not None:
        for m in tgts_el.findall("model"):
            targets.append(ModelEntry(
                id=m.get("id", ""),
                name=m.get("name", ""),
                path=m.get("path", ""),
                category=m.get("category", ""),
                description=m.get("description", ""),
                role="target",
            ))

    methods = []
    methods_el = root.find("methods")
    if methods_el is not None:
        for m in methods_el.findall("method"):
            methods.append(MethodEntry(
                id=m.get("id", ""),
                name=m.get("name", ""),
                enabled=m.get("enabled", "false").lower() == "true",
                description=m.get("description", ""),
            ))

    _cached_config = StyleTransferConfig(
        references=references,
        targets=targets,
        methods=methods,
    )
    return _cached_config

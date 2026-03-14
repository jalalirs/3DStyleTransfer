# 3D Reconstruction GPU Service

Standalone service that runs open-source 2D→3D reconstruction models on a GPU machine.
Exposes a simple REST API that the main platform calls over Tailscale.

## Models

- **InstantMesh** (default) — best quality, single image → textured 3D mesh
- **TripoSR** — fastest, single image → 3D mesh

## Setup

```bash
# Clone on your GPU machine
git clone <repo-url>
cd 3DStyleTransfer/gpu-service

# Build and run
docker compose up -d

# Or without Docker (requires CUDA):
pip install -r requirements.txt
python server.py
```

## API

```
POST /reconstruct
  Body: multipart/form-data
    - image: PNG file
    - method: "instantmesh" or "triposr" (default: instantmesh)

  Returns: OBJ file binary

GET /health
  Returns: {"status": "ok", "gpu": "NVIDIA ...", "models_loaded": [...]}
```

## Connect via Tailscale

The service runs on port 8877. Once Tailscale is set up on both machines:
```
# From main platform, the GPU service is at:
http://<gpu-machine-tailscale-ip>:8877
```

Set `GPU_SERVICE_URL` in the main platform's docker-compose.yml.

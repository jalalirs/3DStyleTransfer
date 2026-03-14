FROM nvidia/cuda:12.4.1-devel-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-dev \
    git wget \
    ninja-build cmake \
    libgl1 libglib2.0-0 libegl1 \
    && rm -rf /var/lib/apt/lists/*

RUN ln -s /usr/bin/python3 /usr/bin/python

WORKDIR /app

# ---- Single coherent install of torch + all CUDA extensions ----
# Pin torch version so nothing overrides it later
RUN pip install --no-cache-dir \
    torch==2.5.1 torchvision==0.20.1 --index-url https://download.pytorch.org/whl/cu124

# Install xformers and flash-attn matched to this torch version BEFORE anything else
RUN pip install --no-cache-dir xformers==0.0.28.post3 --index-url https://download.pytorch.org/whl/cu124 || true
RUN pip install --no-cache-dir flash-attn --no-build-isolation || true

# Common deps — torch is already pinned above so pip won't replace it
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# torchmcubes (for TripoSR)
RUN pip install --no-cache-dir git+https://github.com/tatsy/torchmcubes.git

# ---- Clone repos ----
RUN git clone https://github.com/VAST-AI-Research/TripoSR.git /opt/TripoSR
RUN git clone --recurse-submodules https://github.com/microsoft/TRELLIS.2.git /opt/TRELLIS.2
RUN git clone https://github.com/Tencent-Hunyuan/Hunyuan3D-2.git /opt/Hunyuan3D-2

# ---- Install repo deps WITHOUT letting them upgrade torch ----
RUN cd /opt/TripoSR && \
    pip install --no-cache-dir --no-deps -r requirements.txt 2>/dev/null || true

RUN cd /opt/TRELLIS.2 && \
    pip install --no-cache-dir --no-deps -r requirements.txt 2>/dev/null || true && \
    pip install --no-cache-dir --no-deps -e . 2>/dev/null || true

RUN cd /opt/Hunyuan3D-2 && \
    pip install --no-cache-dir --no-deps -r requirements.txt 2>/dev/null || true && \
    pip install --no-cache-dir --no-deps -e . 2>/dev/null || true

# ---- TRELLIS custom CUDA extensions ----
RUN cd /opt/TRELLIS.2 && pip install --no-cache-dir --no-deps -e extensions/diffoctreerast 2>/dev/null || true
RUN cd /opt/TRELLIS.2 && pip install --no-cache-dir --no-deps -e extensions/mipgaussian 2>/dev/null || true
RUN pip install --no-cache-dir spconv-cu124 2>/dev/null || true
RUN pip install --no-cache-dir nvdiffrast 2>/dev/null || true
RUN pip install --no-cache-dir kaolin -f https://nvidia-kaolin.s3.us-east-2.amazonaws.com/torch-2.5.1_cu124.html 2>/dev/null || true

# ---- Fill in any missing deps that --no-deps skipped ----
RUN pip install --no-cache-dir \
    einops omegaconf huggingface-hub transformers accelerate \
    trimesh pillow numpy scipy rembg onnxruntime-gpu \
    pygltflib safetensors diffusers tokenizers sentencepiece \
    starlette uvicorn fastapi python-multipart httpx \
    2>/dev/null || true

# Verify torch wasn't replaced
RUN python -c "import torch; print(f'torch={torch.__version__}, cuda={torch.cuda.is_available()}')"

# Copy service code
COPY . .

ENV PYTHONPATH="/opt/TripoSR:/opt/TRELLIS.2:/opt/Hunyuan3D-2:${PYTHONPATH}"

EXPOSE 8877

CMD ["python", "server.py"]

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

# Install PyTorch with CUDA 12.4
RUN pip install --no-cache-dir \
    torch torchvision --index-url https://download.pytorch.org/whl/cu124

# Install common deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install torchmcubes (for TripoSR)
RUN pip install --no-cache-dir git+https://github.com/tatsy/torchmcubes.git

# Clone TripoSR
RUN git clone https://github.com/VAST-AI-Research/TripoSR.git /opt/TripoSR \
    && cd /opt/TripoSR \
    && pip install --no-cache-dir -r requirements.txt 2>/dev/null || true

# Clone and install TRELLIS.2
RUN git clone --recurse-submodules https://github.com/microsoft/TRELLIS.2.git /opt/TRELLIS.2 \
    && cd /opt/TRELLIS.2 \
    && pip install --no-cache-dir -r requirements.txt 2>/dev/null || true \
    && pip install --no-cache-dir -e . 2>/dev/null || true

# Install TRELLIS.2 custom ops (xformers, flash-attn, etc.)
RUN pip install --no-cache-dir xformers 2>/dev/null || true
RUN pip install --no-cache-dir flash-attn --no-build-isolation 2>/dev/null || true
RUN cd /opt/TRELLIS.2 && pip install --no-cache-dir -e extensions/diffoctreerast 2>/dev/null || true
RUN cd /opt/TRELLIS.2 && pip install --no-cache-dir -e extensions/mipgaussian 2>/dev/null || true
RUN pip install --no-cache-dir kaolin -f https://nvidia-kaolin.s3.us-east-2.amazonaws.com/torch-2.5.1_cu124.html 2>/dev/null || true
RUN pip install --no-cache-dir spconv-cu124 2>/dev/null || true
RUN pip install --no-cache-dir nvdiffrast 2>/dev/null || true

# Clone and install Hunyuan3D 2.0
RUN git clone https://github.com/Tencent-Hunyuan/Hunyuan3D-2.git /opt/Hunyuan3D-2 \
    && cd /opt/Hunyuan3D-2 \
    && pip install --no-cache-dir -r requirements.txt 2>/dev/null || true \
    && pip install --no-cache-dir -e . 2>/dev/null || true

# Copy service code
COPY . .

# Add to path
ENV PYTHONPATH="/opt/TripoSR:/opt/TRELLIS.2:/opt/Hunyuan3D-2:${PYTHONPATH}"

EXPOSE 8877

CMD ["python", "server.py"]

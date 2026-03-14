FROM nvidia/cuda:12.1.1-devel-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-dev \
    git wget \
    ninja-build \
    libgl1 libglib2.0-0 libegl1 \
    && rm -rf /var/lib/apt/lists/*

RUN ln -s /usr/bin/python3 /usr/bin/python

WORKDIR /app

# Install PyTorch with CUDA
RUN pip install --no-cache-dir \
    torch torchvision --index-url https://download.pytorch.org/whl/cu121

# Install other deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install torchmcubes (needed by TripoSR, must build from source)
RUN pip install --no-cache-dir git+https://github.com/tatsy/torchmcubes.git

# Clone TripoSR and install its dependencies
RUN git clone https://github.com/VAST-AI-Research/TripoSR.git /opt/TripoSR \
    && cd /opt/TripoSR \
    && pip install --no-cache-dir -r requirements.txt 2>/dev/null || true

# Clone InstantMesh and install its dependencies
RUN git clone https://github.com/TencentARC/InstantMesh.git /opt/InstantMesh \
    && cd /opt/InstantMesh \
    && pip install --no-cache-dir -r requirements.txt 2>/dev/null || true

# Copy service code
COPY . .

# Add TripoSR to path
ENV PYTHONPATH="/opt/TripoSR:${PYTHONPATH}"

EXPOSE 8877

CMD ["python", "server.py"]

FROM fishwowater/trellis2:latest

WORKDIR /app

# Install server dependencies
RUN pip install --no-cache-dir fastapi uvicorn python-multipart httpx

# Copy server code (TRELLIS.2 is already at /app/trellis2/)
COPY server.py .
COPY trellis_wrapper.py .

EXPOSE 8877

CMD ["python", "server.py"]

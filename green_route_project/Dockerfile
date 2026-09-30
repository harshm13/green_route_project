# Multi-Tenant Enterprise B2B GreenRoute Platform Dockerfile
FROM python:3.12-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements and install dependencies
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt \
    && pip install --no-cache-dir websockets

# Copy backend and frontend code
COPY backend/ /app/backend/
COPY frontend/ /app/frontend/
COPY mock_bins.json /app/mock_bins.json
COPY test_integration.py /app/test_integration.py

# Expose FastAPI & WebSockets port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

# Start GreenRoute Enterprise Server
CMD ["sh", "-c", "python -m backend.app.seed && uvicorn backend.app.main:app --host 0.0.0.0 --port 8000"]

# ============================================
# Multi-Agent System — Ultra Lightweight Dockerfile
# Optimized for 512MB RAM/Disk Free Cloud Deployments
# ============================================

FROM python:3.11-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements and install without cache
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r /app/requirements.txt

# Final minimal production stage
FROM python:3.11-slim

WORKDIR /app

# Copy installed python site-packages from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy application source code
COPY backend /app/backend
COPY frontend /app/frontend

# Ensure upload directory exists
RUN mkdir -p /app/backend/app/upload

# Set environment
ENV PYTHONUNBUFFERED=1
ENV PORT=8990

EXPOSE 8990

# Launch server
CMD ["sh", "-c", "uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT:-8990}"]

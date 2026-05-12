# Windsurf Logger Dashboard - Multi-stage Docker Build
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend
COPY dashboard/frontend/package*.json ./
RUN npm ci --silent
COPY dashboard/frontend/ ./
RUN npm run build

# Production image
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies from the pinned lock file for reproducible
# builds. Cloud SDK extras live in requirements-cloud.txt — install them
# at runtime only if S3 / Azure storage adapters are needed.
COPY requirements.lock ./
RUN pip install --no-cache-dir -r requirements.lock

# Copy application files - maintain directory structure for imports
COPY config.py ./
COPY constants.py ./
COPY cascade_logger.py ./
COPY windsurf_paths.py ./
COPY dashboard/backend/app.py ./dashboard/backend/
COPY dashboard/backend/storage_adapters.py ./dashboard/backend/
# Create __init__.py files for proper Python package structure
RUN touch ./dashboard/__init__.py ./dashboard/backend/__init__.py

# Copy built frontend
COPY --from=frontend-builder /app/frontend/dist ./dashboard/frontend/dist

# Create logs directory
RUN mkdir -p /app/logs

# Run as non-root for defence-in-depth (FedRAMP / CIS Docker benchmark).
# Create the user AFTER all files are copied and chown the workdir.
RUN useradd --create-home --shell /bin/bash appuser && chown -R appuser:appuser /app
USER appuser

# Environment variables
ENV WINDSURF_LOG_DIR=/app/logs
# FLASK_HOST=0.0.0.0 is required inside the container so the port is
# reachable from outside; the application default (config.py) is the
# loopback interface for direct local runs.
ENV FLASK_HOST=0.0.0.0
ENV FLASK_PORT=5173
ENV FLASK_DEBUG=false
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5173/health || exit 1

# Expose port
EXPOSE 5173

# Run with gunicorn for production
CMD ["gunicorn", "--bind", "0.0.0.0:5173", "--workers", "2", "--threads", "4", "--chdir", "/app/dashboard/backend", "app:app"]

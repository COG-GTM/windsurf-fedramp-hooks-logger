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

# Copy and install Python dependencies
COPY dashboard/backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY config.py ./
COPY cascade_logger.py ./
COPY windsurf_paths.py ./
COPY dashboard/backend/app.py ./dashboard/backend/
COPY dashboard/backend/storage_adapters.py ./dashboard/backend/

# Copy built frontend
COPY --from=frontend-builder /app/frontend/dist ./dashboard/frontend/dist

# Create logs directory
RUN mkdir -p /app/logs

# Environment variables
ENV WINDSURF_LOG_DIR=/app/logs
ENV FLASK_HOST=0.0.0.0
ENV FLASK_PORT=5173
ENV FLASK_DEBUG=false
ENV PYTHONUNBUFFERED=1

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5173/health || exit 1

# Expose port
EXPOSE 5173

# Run with gunicorn for production
CMD ["gunicorn", "--bind", "0.0.0.0:5173", "--workers", "2", "--threads", "4", "dashboard.backend.app:app"]

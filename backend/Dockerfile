FROM python:3.12-slim

WORKDIR /app

# System deps (minimal)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Install python deps
COPY backend/pyproject.toml /app/pyproject.toml

RUN pip install --no-cache-dir --upgrade pip \
  && pip install --no-cache-dir -e .

# Copy app code
COPY backend/app /app/app

ENV PYTHONUNBUFFERED=1
EXPOSE 8787

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8787"]

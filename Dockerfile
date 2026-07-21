FROM node:22-slim AS web
WORKDIR /web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
COPY --from=web /web/dist ./web/dist

# `python -m api.main`, not bare uvicorn: __main__ also starts the fusion feed
# thread, without which /live never emits a RiskScore.
CMD ["python", "-m", "api.main"]

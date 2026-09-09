FROM python:3.12-slim
RUN pip install --no-cache-dir uv==0.11.33
WORKDIR /app
COPY pyproject.toml uv.lock ./
COPY src ./src
RUN uv sync --frozen --no-dev
COPY alembic.ini ./
COPY migrations ./migrations
RUN useradd --uid 10001 --create-home app && chown -R app:app /app
USER app
ENV PATH="/app/.venv/bin:$PATH"
EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn crimestack.main:app --host 0.0.0.0 --port 8000"]

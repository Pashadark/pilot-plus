FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app

RUN groupadd --system pilotbot && useradd --system --gid pilotbot --home /app pilotbot
COPY bot/pyproject.toml /app/pyproject.toml
COPY bot /app/bot
RUN pip install . && chown -R pilotbot:pilotbot /app

USER pilotbot
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD python -c "from pathlib import Path; value=Path('/proc/1/cmdline').read_text(); raise SystemExit(0 if 'bot.main' in value or 'bot.client_main' in value else 1)"
CMD ["python", "-m", "bot.main"]

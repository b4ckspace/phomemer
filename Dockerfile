FROM node:20-alpine as frontend

WORKDIR /app

COPY frontend /app/

RUN npm ci
RUN npm run build

# ---

FROM python:3.12-alpine as backend

WORKDIR /app

RUN pip install wheel
RUN pip install uv
COPY pyproject.toml poetry.lock README.md /app/
RUN uv pip compile pyproject.toml -o requirements.txt
RUN uv venv
RUN uv pip install --requirement=requirements.txt

# ---

FROM python:3.12-alpine

WORKDIR /app

COPY phomeme /app/phomeme/
COPY --from=backend /app /app/
COPY --from=frontend /app/dist/phomemer/browser /app/phomeme/static

CMD /app/.venv/bin/gunicorn -w 1 'phomeme:app' -b [::0]

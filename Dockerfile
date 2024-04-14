FROM node:20 as frontend

WORKDIR /app

ADD angular.json package.json package-lock.json tsconfig.app.json tsconfig.json tsconfig.spec.json /app/
ADD src /app/src

RUN npm ci
RUN npm run build

# ---

FROM python:3.12 as backend

WORKDIR /app

RUN pip install uv
ADD pyproject.toml poetry.lock README.md /app
RUN uv pip compile pyproject.toml -o requirements.txt
RUN uv venv
RUN uv pip install --requirement=requirements.txt

# ---

FROM python:3.12

WORKDIR /app

ADD phomeme /app/phomeme
COPY --from=backend /app /app
COPY --from=frontend /app/dist/phomemer/browser /app/phomeme/static

CMD /app/.venv/bin/gunicorn -w 1 'phomeme:app' -b [::0]

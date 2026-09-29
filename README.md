# StatusWatch

[![CI](https://github.com/asa-aning/statuswatch/actions/workflows/ci.yml/badge.svg)](https://github.com/asa-aning/statuswatch/actions/workflows/ci.yml)

A small uptime monitor. It checks a list of websites on a timer and shows
the results on a status page, as JSON and as Prometheus metrics.

Built as a hands-on DevOps learning project, one phase at a time.

## Run it

Requires Node.js 22 or newer.

```sh
npm install
npm start          # http://localhost:3000
npm run dev        # restarts automatically when you edit code
npm test
```

## Run it with Docker

```sh
docker build -t statuswatch .
docker run -d --name statuswatch -p 3000:3000 statuswatch
```

To watch your own sites without rebuilding, mount your own targets file:

```sh
docker run -d --name statuswatch -p 3000:3000 \
  -v ./my-targets.json:/app/targets.json:ro statuswatch
```

The container runs as a non-root user, reports its health to Docker
(`docker ps` shows `healthy`), and shuts down cleanly on `docker stop`.

## Endpoints

| Path          | What it returns                                        |
|---------------|--------------------------------------------------------|
| `/`           | Status page, refreshes every 30 seconds                |
| `/api/status` | Current state and recent history of each target (JSON) |
| `/health`     | `{"status":"ok"}` if StatusWatch itself is running     |
| `/metrics`    | Prometheus metrics                                     |

## Configuration

The websites to check are listed in [`targets.json`](targets.json):

```json
[
  { "name": "My site", "url": "https://example.com" }
]
```

Everything else is set with environment variables:

| Variable                 | Default          | Meaning                              |
|--------------------------|------------------|--------------------------------------|
| `PORT`                   | `3000`           | Port the web server listens on       |
| `CHECK_INTERVAL_SECONDS` | `60`             | Time between checks                  |
| `CHECK_TIMEOUT_MS`       | `10000`          | A check slower than this counts as down |
| `TARGETS_FILE`           | `./targets.json` | Path to the targets list             |

A target counts as **up** when it answers with an HTTP status from 200 to
299 (after following redirects) within the timeout.

## Metrics

| Metric                               | Type      | Labels             |
|--------------------------------------|-----------|--------------------|
| `statuswatch_target_up`              | gauge     | `target`           |
| `statuswatch_check_duration_seconds` | histogram | `target`           |
| `statuswatch_checks_total`           | counter   | `target`, `result` |

The standard Node.js process metrics (CPU, memory, event loop) are
included too.

## Roadmap

- [x] **Phase 1:** the app, with tests
- [x] **Phase 2:** Docker image
- [ ] **Phase 3:** CI: run tests, build and publish the image to GitHub Container Registry
- [ ] **Phase 4:** Docker Compose with Prometheus and Grafana
- [ ] **Phase 5:** Alerts when a site goes down
- [ ] **Phase 6:** Deploy to a cloud server with Terraform

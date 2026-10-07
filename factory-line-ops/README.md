# Factory Line Operations

A Splunk application for **real-time factory line shift and personnel monitoring**, with plant-level operations views and an enterprise business dashboard that rolls up every factory being monitored.

This directory is the **intended root of a new GitHub repository**. It is staged here only because this agent cannot create repositories under `wolf359-ai`. See [docs/NEW_REPOSITORY.md](docs/NEW_REPOSITORY.md).

| Package | Folder | Role |
| --- | --- | --- |
| Technology add-on | `packages/TA-factory_line` | Indexes, sourcetypes, parsing, CIM / OT Intelligence field mapping |
| Splunk app | `packages/factory_line_ops` | Dashboards, navigation, KV Store, alerts, macros |

**Factory Line Operations is a standalone Splunk product.** Do not mix it with other applications in one runtime or one Splunk app. App icons under `packages/*/appserver/static/` are original industrial artwork for this product.

## Read first

1. [Project plan](docs/PROJECT_PLAN.md) — vision, architecture, phases, open decisions
2. [New repository](docs/NEW_REPOSITORY.md) — how to publish this as its own GitHub repo
3. [Data model](docs/DATA_MODEL.md) — events, indexes, hierarchy
4. [TA ingest](docs/TA_INGEST.md) — HEC, routing, OT mapping, PII backstop
5. [Dashboards and alerts](docs/DASHBOARDS.md) — personas and drill-down
6. [Security](docs/SECURITY.md) — PII, roles, secrets

## What it monitors

- Who is on which **shift**, **line**, and **station** right now
- Clock-in / clock-out, no-shows, overtime, and staffing gaps
- Line run / down / changeover state and production counts for the current shift
- Plant rollup (all lines in one factory) and **business-layer rollup** (all factories)

## Secrets

HEC tokens, Splunk passwords, and any other credentials **must never be committed**. Send sample events with:

```bash
export SPLUNK_HEC_URL="https://splunk.example.com:8088/services/collector/event"
export SPLUNK_HEC_TOKEN="..."   # from your secret store, not from git
./scripts/send_sample_events.sh
```

## Package locally

```bash
make package
```

Produces AppInspect-ready `.spl` files under `dist/` (no `local/`, no hidden files, no sample secrets).

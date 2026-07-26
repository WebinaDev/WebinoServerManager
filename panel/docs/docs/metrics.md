---
sidebar_position: 16
---

# Metrics

Time-series host metrics and threshold alerts. Samples collected by `panel:collect-metrics` (every minute); live fallback when stale.

UI: `/metrics-alerts` + dashboard gauges on `/`.

## Current & history

| Method | Path | Permission | Notes |
|--------|------|------------|--------|
| `GET` | `/api/v1/metrics/current` | read-open | Live CPU/RAM/disk/net when last sample >5 min old |
| `GET` | `/api/v1/metrics/history` | read-open | Series incl. `net_rx_bps`, `net_tx_bps`, `disk_read_bps`, `disk_write_bps` |

## Alerts

| Method | Path | Permission | Notes |
|--------|------|------------|--------|
| `GET` | `/api/v1/metrics/alerts` | read-open | List rules |
| `POST` | `/api/v1/metrics/alerts` | `system.manage` | `{ metric, comparison, threshold, severity?, channels? }` |
| `PATCH` | `/api/v1/metrics/alerts/{alert}` | `system.manage` | Update rule |
| `DELETE` | `/api/v1/metrics/alerts/{alert}` | `system.manage` | Remove |

**Severity (Phase D):** `soft` (warn) or `hard` (critical). Fired alerts dispatch via `NotificationDispatcher` (Telegram, Slack, webhook, email).

## Agent source

Structured metrics from `GET /v1/system/info` — CPU, memory, disk, network IO, load average.

## Related

Hosting quota breach alerts use separate `hosting_quota_alerts` table — see [Hosting](./hosting.md).

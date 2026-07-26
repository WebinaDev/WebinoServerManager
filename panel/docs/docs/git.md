---
sidebar_position: 19
---

# Git

Git repository registry on the host. Panel stores repo metadata; clone/pull/destroy via agent.

Mutations require `permission:system.manage`. UI: `/git`.

## Repositories

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/v1/git` | List repos (panel DB + agent reconcile) |
| `POST` | `/api/v1/git` | `{ url, path, branch? }` — HTTPS-only clone |
| `POST` | `/api/v1/git/{repo}/pull` | `git pull` in repo path |
| `DELETE` | `/api/v1/git/{repo}` | Remove repo registration + optional directory |

## Agent

`/v1/git` — list, clone (HTTPS URL validation), pull, delete. Paths jailed under allowed web roots.

## Reconcile

`panel:reconcile-host` flags drift when agent list differs from panel rows.

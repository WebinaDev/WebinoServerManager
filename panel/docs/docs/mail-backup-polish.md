# Mail & Backup polish (Wave 11)

## Mailing lists

- `PATCH /api/v1/email/lists/{id}` — update destinations / active status
- `POST/DELETE /api/v1/email/lists/{id}/members` — add/remove single member
- UI: `MailingListsPage` edit dialog, enable/disable, member CRUD

## Backups

- Verify status surfaced in `BackupsPage` (`verified_at`, checksum)
- Retention hint on schedules (restic forget/prune when offsite target set)
- Restore wizard dialog with confirm step (existing `POST /api/v1/backups/{id}/restore`)

Permissions: `system.manage` on mutations via `RequireRouteWrite`.

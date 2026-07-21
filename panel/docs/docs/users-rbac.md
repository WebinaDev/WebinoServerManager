---
sidebar_position: 4
---

# Users & RBAC

Manage panel users and role-based access control (RBAC) via Spatie Permission.

## Overview

The panel uses Spatie's `laravel-permission` package. Every user carries one role; every role carries a set of permissions. The `admin` role is seeded automatically and is protected — it cannot be modified or deleted through the API.

---

## Users API

All routes require `auth:sanctum` + the `users.manage` permission.

### List users

```
GET /api/v1/users
```

Response:

```json
{
  "users": [
    {
      "id": 1,
      "name": "Alice",
      "username": "alice",
      "email": "alice@example.com",
      "roles": [{ "name": "admin" }]
    }
  ]
}
```

### Create user

```
POST /api/v1/users
```

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | Display name |
| `username` | string | 3–32 chars, letters/numbers/underscore |
| `email` | string? | Optional |
| `password` | string | Min 8 chars |
| `password_confirmation` | string | Must match `password` |
| `role` | string | Must exist in the `roles` table |

Returns `201` with `{ "user": { ... } }`.

### Update user

```
PATCH /api/v1/users/{id}
```

Accepted fields: `name`, `email`, `password` + `password_confirmation`, `role`.

Guards:
- Cannot demote the last admin.
- Cannot change your own role while being the only admin.

Returns `200` with `{ "user": { ... } }`.

### Delete user

```
DELETE /api/v1/users/{id}
```

Guards:
- Cannot delete yourself.
- Cannot delete the last admin.

Returns `200` with `{ "message": "User deleted." }`.

---

## Roles API

All routes require `auth:sanctum` + `users.manage`.

### List roles & permissions

```
GET /api/v1/roles
```

Returns all roles with their assigned permissions, plus the full list of known permissions:

```json
{
  "roles": [
    {
      "id": 1,
      "name": "admin",
      "permissions": [{ "name": "users.manage" }, ...]
    }
  ],
  "permissions": ["backups.manage", "databases.read", "domains.read", ...]
}
```

### List permissions only

```
GET /api/v1/permissions
```

Returns `{ "permissions": ["..."] }`.

### Create role

```
POST /api/v1/roles
```

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | Lowercase, pattern `^[a-z][a-z0-9_-]*$`, unique |
| `permissions` | string[]? | Permission names to assign |

Returns `201`. Rejects the name `admin` with `422`.

### Update role

```
PATCH /api/v1/roles/{id}
```

| Field | Type | Notes |
|-------|------|-------|
| `name` | string? | New name (same pattern, unique) |
| `permissions` | string[]? | Full replacement set |

Returns `200` with `{ "role": { ... } }`. Rejects modifications to the `admin` role.

### Delete role

```
DELETE /api/v1/roles/{id}
```

Guards:
- Cannot delete the `admin` role.
- Cannot delete a role that is currently assigned to at least one user.

Returns `200` with `{ "message": "Role deleted." }`.

---

## Seeded roles

| Role | Permissions |
|------|-------------|
| `admin` | All permissions |
| `operator` | Most management permissions (no `users.manage`) |
| `viewer` | Read-only permissions |

---

## Frontend

The **Users & access** page (`/rbac`) in the panel provides:

- **Users table** — search, view role badge, edit (name/email/password/role) and delete with `RequireRouteWrite` guards.
- **Create user form** — hidden for read-only users.
- **Roles card** — lists all roles with their permissions; create new roles with a permission checklist; edit existing roles' permissions; delete unused non-protected roles.

Write actions are gated by `RequireRouteWrite`, which checks the `users.manage` write permission for the current route.

---

## Error reference

| Code | Message |
|------|---------|
| `users.role_protected` | Cannot modify or delete the admin role |
| `users.role_in_use` | Role is assigned to one or more users |
| `users.last_admin` | Cannot demote the last administrator |
| `users.cannot_delete_self` | Cannot delete your own account |

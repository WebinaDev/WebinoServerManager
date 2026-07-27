## Setup wizard

First-run flow (**aaPanel-style installer UX**):

1. `install.sh --panel` brings up Docker, runs `panel:bootstrap-admin`, prints **Panel URL + username + password**.
2. Open `/login` with printed credentials.
3. Post-login software wizard at `/setup/stack` (Nginx/Apache, MariaDB/MySQL, PHP, optionals) with a **terminal-like install log**.
4. `setup_completed` after stack success or explicit skip → dashboard.

Fallback: if bootstrap-admin fails, `/setup` still creates the admin (legacy multi-step).

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/v1/setup/status` | `needs_setup`, `setup_completed`, `admin_created`, `needs_stack`, `stack` |
| `GET` | `/api/v1/setup/stack` | Poll install progress (`percent`, steps, `log`) |
| `POST` | `/api/v1/setup` | Create admin + start stack (or `stack.skip`); if admin exists → stack-only |
| `POST` | `/api/v1/setup/stack` | Start/skip hosting stack when admin already exists |
| `POST` | `/api/v1/setup/stack/retry` | Retry failed stack steps |
| CLI | `php artisan panel:bootstrap-admin` | Create/reset initial admin for installer printout |

Default stack: Nginx, MariaDB, PHP 8.2+8.3, Composer, UFW (22/80/443/2090), Fail2ban; optional Redis/Memcached/Pure-FTPd.

Tables: `setup_stack_runs`, `setup_stack_steps`.

UI: `/setup` (admin fallback), `/setup/stack` (post-login software + terminal log).

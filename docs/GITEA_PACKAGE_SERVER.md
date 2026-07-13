# Legacy Gitea Package Server (package.webina.dev)

> **Default:** Installers now download from [GitHub — WebinaDev](https://github.com/WebinaDev/). This document applies only when overriding with `WEBINO_PACKAGE_BASE=https://package.webina.dev` and `WEBINO_PACKAGE_BACKEND=gitea`.

Bootstrap can download **WebinoServerManager** from a self-hosted Gitea instance. If archive or git endpoints return **500** or hang, the installer appears stuck on "Downloading WebinoServerManager...".

Run the verification script from any machine (with Gitea env vars set):

```bash
WEBINO_PACKAGE_BASE=https://package.webina.dev \
WEBINO_PACKAGE_BACKEND=gitea \
WEBINO_REPO_SLUG=webina/WebinoServerManager \
  ./scripts/verify-package-server.sh
```

Or pipe from GitHub (default):

```bash
curl -fsSL https://raw.githubusercontent.com/WebinaDev/WebinoServerManager/main/scripts/verify-package-server.sh | bash
```

All checks should return **OK**. Archive and git smart HTTP must return HTTP **200**.

## Diagnose on the Gitea host

Watch logs while hitting endpoints from another machine:

```bash
journalctl -u gitea -f
```

In another terminal:

```bash
curl -I "https://package.webina.dev/webina/WebinoServerManager/archive/main.tar.gz"
curl -I "https://package.webina.dev/webina/WebinoServerManager/info/refs?service=git-upload-pack"
git ls-remote https://package.webina.dev/webina/WebinoServerManager.git HEAD
```

## Common causes of 500 on archive/git

### 1. Git binary missing or wrong path

In Gitea `app.ini`:

```ini
[git]
PATH = /usr/bin:/usr/local/bin
```

Verify:

```bash
sudo -u git which git
sudo -u git git --version
```

Restart Gitea after changes.

### 2. Broken or unreadable bare repository

Find the repo on disk (path varies by install):

```bash
sudo -u git ls -la /var/lib/gitea/data/gitea-repositories/webina/webinoservermanager.git
sudo -u git git --git-dir=/path/to/webinoservermanager.git fsck
```

Re-push from a known-good clone if the bare repo is corrupt:

```bash
git remote add gitea https://package.webina.dev/webina/WebinoServerManager.git
git push gitea main --force
```

### 3. Reverse proxy blocking git or large responses

Ensure nginx/Caddy passes through without truncating:

- `GET /{owner}/{repo}/archive/*`
- `GET /{owner}/{repo}/info/refs?service=git-upload-pack`
- `POST /{owner}/{repo}/git-upload-pack`

### 4. Insufficient memory during archive generation

Archive creation runs `git archive` on the server. Add swap or increase RAM if OOM kills appear in logs during tarball requests.

## Verify after fix

```bash
curl -fsSLI "https://package.webina.dev/webina/WebinoServerManager/archive/main.tar.gz"   # expect 200
git ls-remote https://package.webina.dev/webina/WebinoServerManager.git HEAD              # expect SHA
./scripts/verify-package-server.sh                                                        # all OK
```

## GitHub (recommended)

Default bootstrap — no env overrides needed:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/WebinaDev/WebinoServerManager/main/bootstrap.sh) --full
```

Product repos on GitHub:

| Product | Repository |
|---------|------------|
| Webino | [WebinaDev/WebinoDashboard](https://github.com/WebinaDev/WebinoDashboard) |
| WebinoERM | [WebinaDev/WebinoERP](https://github.com/WebinaDev/WebinoERP) |
| Orchestrator | [WebinaDev/WebinoServerManager](https://github.com/WebinaDev/WebinoServerManager) |

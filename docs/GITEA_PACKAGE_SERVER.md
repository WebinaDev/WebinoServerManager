# Gitea Package Server (package.webina.dev)

Bootstrap downloads **WebinoServer** from `package.webina.dev`. If archive or git endpoints return **500** or hang, the installer appears stuck on "Downloading WebinoServer...".

Run the verification script from any machine:

```bash
curl -fsSL https://package.webina.dev/webina/WebinoServer/raw/branch/main/scripts/verify-package-server.sh | bash
```

Or from a local clone:

```bash
./scripts/verify-package-server.sh
```

All checks should return **OK**. Archive and git smart HTTP must return HTTP **200**.

## Diagnose on the Gitea host

Watch logs while hitting endpoints from another machine:

```bash
journalctl -u gitea -f
```

In another terminal:

```bash
curl -I "https://package.webina.dev/webina/WebinoServer/archive/main.tar.gz"
curl -I "https://package.webina.dev/webina/WebinoServer/info/refs?service=git-upload-pack"
git ls-remote https://package.webina.dev/webina/WebinoServer.git HEAD
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
sudo -u git ls -la /var/lib/gitea/data/gitea-repositories/webina/webinoserver.git
sudo -u git git --git-dir=/path/to/webinoserver.git fsck
```

Re-push from a known-good clone if the bare repo is corrupt:

```bash
git remote add gitea https://package.webina.dev/webina/WebinoServer.git
git push gitea main --force
```

### 3. Reverse proxy blocking git or large responses

Ensure nginx/Caddy passes through without truncating:

- `GET /{owner}/{repo}/archive/*`
- `GET /{owner}/{repo}/info/refs?service=git-upload-pack`
- `POST /{owner}/{repo}/git-upload-pack`

Example nginx additions:

```nginx
location ~ ^/.+/[^/]+/(git-upload-pack|git-receive-pack|info/refs|archive/) {
    proxy_pass http://127.0.0.1:3000;
    proxy_buffering off;
    proxy_request_buffering off;
    client_max_body_size 0;
}
```

### 4. Insufficient memory during archive generation

Archive creation runs `git archive` on the server. Add swap or increase RAM if OOM kills appear in logs during tarball requests.

## Verify after fix

```bash
curl -fsSLI "https://package.webina.dev/webina/WebinoServer/archive/main.tar.gz"   # expect 200
git ls-remote https://package.webina.dev/webina/WebinoServer.git HEAD              # expect SHA
./scripts/verify-package-server.sh                                                 # all OK
```

Then re-run bootstrap on the VPS:

```bash
bash <(curl -fsSL https://package.webina.dev/webina/WebinoServer/raw/branch/main/bootstrap.sh) --full
```

## GitHub mirror fallback

If Gitea is temporarily unavailable, point bootstrap at another git host (adjust owner/repo as needed):

```bash
WEBINO_PACKAGE_BASE=https://github.com WEBINO_REPO_SLUG=your-org/WebinoServer \
  bash <(curl -fsSL https://raw.githubusercontent.com/your-org/WebinoServer/main/bootstrap.sh) --full
```

# wpanel — WebinoServer panel CLI

Public command-line client for the WebinoServer hosting panel REST API.

## Install

```bash
cd WebinoServerManager/panel/cli
go build -o wpanel .
```

## Usage

```bash
# Password: stdin prompt, WPANEL_PASSWORD env, or optional 4th argument
wpanel login https://panel.example.com admin
WPANEL_PASSWORD='secret' wpanel login https://panel.example.com admin

# Two-factor authentication
WPANEL_OTP='123456' wpanel login https://panel.example.com admin
WPANEL_RECOVERY_CODE='RCODE-XXXX' wpanel login https://panel.example.com admin
# Or enter OTP / recovery code when prompted after 422

wpanel config
wpanel auth user
wpanel auth tokens
wpanel auth tokens create automation --abilities domains.manage
wpanel auth tokens revoke 1

wpanel domains list
wpanel domains create example.com --slug example
wpanel domains delete 1

wpanel databases list
wpanel databases create mydb --engine mysql

wpanel webhooks list
wpanel webhooks create ops https://example.com/hook --events backup.completed,ssl.expiring
wpanel webhooks delete 1

wpanel apps list
wpanel monitoring services

# Generic API access
wpanel api GET /api/v1/domains --json
wpanel api POST /api/v1/domains --json '{"domain":"test.local"}'
wpanel domains list --json
```

Credentials are stored in `~/.config/wpanel/config.json`.

HTTP requests use a 30-second timeout.

## API tokens

Create scoped tokens via the panel UI, `wpanel auth tokens create`, or `POST /api/v1/auth/tokens`, then set `token` in the config file manually for automation.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `WPANEL_PASSWORD` | Login password (avoids stdin prompt) |
| `WPANEL_OTP` | TOTP code when 2FA is enabled |
| `WPANEL_RECOVERY_CODE` | One-time recovery code for 2FA |

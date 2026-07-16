# @webina/panel-sdk

TypeScript client for the WebinoServer panel API.

## Regenerate types

```bash
cd WebinoServerManager/panel/backend && composer openapi
cd ../sdk/typescript
npm install
npm run generate
npm run build
```

Or from the monorepo root:

```bash
./scripts/sdk-generate-all.sh
```

Types are generated from `../../backend/storage/app/openapi.json`.

## Usage

```ts
import { PanelClient } from "@webina/panel-sdk"

const client = new PanelClient({
  baseUrl: "https://panel.example.com",
  token: process.env.WPANEL_TOKEN!,
})

const domains = await client.listDomains()
```

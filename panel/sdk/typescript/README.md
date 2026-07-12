# @webina/panel-sdk

TypeScript client for the WebinoServer panel API.

## Regenerate types

```bash
npm install
npm run generate
npm run build
```

Types are generated from `../../backend/storage/app/openapi.json` (run `composer openapi` in backend first).

## Usage

```ts
import { PanelClient } from "@webina/panel-sdk"

const client = new PanelClient({
  baseUrl: "https://panel.example.com",
  token: process.env.WPANEL_TOKEN!,
})

const domains = await client.listDomains()
```

# @webina/ui

Shared UI primitives for Webina products (ERP, Dashboard, ServerManager panel).

## Contents

- **Accent palette** — `data-accent` helpers (`zinc`, `slate`, `blue`, `green`, `rose`, `orange`)
- **Charts** — accent-aware Recharts bar chart
- **API envelope** — unwrap `{ success, data, message, meta, errors }` responses

## Panel install (shipped copy)

This tree is the **vendored** copy used by `panel/frontend` and Docker builds
(`file:../packages/webina-ui`). Development SSOT may live at
`Plugins/Webina/packages/webina-ui` in the monorepo; sync changes here before
shipping the panel.

```json
"@webina/ui": "file:../packages/webina-ui"
```

## Publish (Gitea package registry)

```bash
npm run build
npm publish --registry https://git.webina.ir/api/packages/webina/npm/
```

## Usage

```tsx
import { AccentBarChart, unwrapApiData, persistAccent } from "@webina/ui"
import "@webina/ui/styles/themes.css"
```

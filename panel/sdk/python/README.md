# webina-panel-sdk

Python client for the WebinoServer panel API.

## Install

```bash
cd WebinoServerManager/panel/sdk/python
pip install -e .
```

## Usage

```python
from webina_panel import PanelClient

client = PanelClient("https://panel.example.com", token="...")
print(client.list_domains())
```

Regenerate from OpenAPI after backend changes:

```bash
cd WebinoServerManager/panel/backend && composer openapi
# optional suite-wide: ./scripts/sdk-generate-all.sh
```

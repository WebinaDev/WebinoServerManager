# webina-panel-sdk

Python client for the WebinoServer panel API.

## Install

```bash
cd WebinoServer/panel/sdk/python
pip install -e .
```

## Usage

```python
from webina_panel import PanelClient

client = PanelClient("https://panel.example.com", token="...")
print(client.list_domains())
```

Regenerate from OpenAPI after backend changes: run `composer openapi` in `panel/backend`.

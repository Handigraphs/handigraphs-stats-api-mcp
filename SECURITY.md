# Security

## Reporting a vulnerability

Do not open a public issue containing credentials, exploit details, subscriber data, or sensitive logs. Use this repository's **Security** tab to submit a private vulnerability report. If private reporting is unavailable, contact the Handigraphs maintainers through the support channel at [handigraphs.com](https://handigraphs.com).

## API key handling

- Supply the key only through `HANDIGRAPHS_API_KEY` in the MCP process environment.
- Never put a real key in tool arguments, source files, committed MCP configuration, screenshots, or support logs.
- The server sends the key only as a Bearer credential to same-origin protected paths under the configured `/api/v1` root.
- Public discovery requests never receive Authorization.
- Rotate or revoke a key immediately from `/account/api` if exposure is suspected.

The package recursively redacts the configured key and authorization-like fields in errors and stderr diagnostics. Redaction is defense in depth, not permission to log credentials.

Upstream JSON is rejected before parsing when its declared or streamed size exceeds `HANDIGRAPHS_MAX_RESPONSE_BYTES`. Keep this guard enabled to bound memory use from both successful and problem responses.

## Transport and trust boundary

The server supports stdio only. The base URL must use HTTPS; plain HTTP is accepted only for a loopback hostname to support local tests. Redirects are not followed. Credentialed URLs, cross-origin links, and discovery links outside `/api/v1` are rejected.

Do not weaken these controls to accommodate a proxy. Configure a trusted same-origin HTTPS endpoint instead.

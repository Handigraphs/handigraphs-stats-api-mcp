# Contributing

Thank you for helping improve the Handigraphs Stats API MCP server.

## Development

Use Node.js 22 or newer, then install and validate the package:

```bash
npm ci
npm test
npm run typecheck
npm run build
npm run pack:check
```

Tests must use mocked REST endpoints. Never commit or attach a live Handigraphs API key to an issue, test, screenshot, or pull request.

## Pull requests

Keep changes focused, preserve stdio stdout for MCP protocol messages, and update tests and documentation with behavior changes. Open security reports through the private process in [SECURITY.md](SECURITY.md), not a public issue.

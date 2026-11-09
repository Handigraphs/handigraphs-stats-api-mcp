# MCP recovery guidance acceptance

This proposal records a scoped sandbox replay on November 8, 2026, Eastern time.

- MCP source `50ee30d66abb4f79a16842f878329c501ea86d44`, deployed as sandbox gateway release v8. [Sandbox deploy run](https://github.com/Handigraphs/handigraphs-stats-api-mcp/actions/runs/42550383877)
- Web source `b749e8ae72cd59c125c316e054a159151a2290d5`, deployed to both web environments. Sandbox v1405, the test flag release v1406, and cleanup release v1407 shared the same slug. [Sandbox web deploy](https://github.com/cjbuskey/handigraphs-app/actions/runs/42541395148) and [production web deploy](https://github.com/cjbuskey/handigraphs-app/actions/runs/42543684314)
- Claude Desktop 4.23118.0.0 used the connected sandbox gateway in a fresh chat. The SHA-256 in the acceptance record identifies the redacted operator receipt. The receipt and authenticated tool payloads stay private.

## Observations

| Check | Invalid request | Corrected request and result |
| --- | --- | --- |
| NHL skater sort | `sog_per_game:desc` returned a validation error with ascending and descending examples. | `-sog_per_game` succeeded. The sandbox returned zero skater rows with the default and explicit season. |
| NHL prop market | `sog` returned a validation error naming NHL skater discovery, `prop_evidence.markets[].key`, and ten advertised market keys. | The discovery call confirmed `skater_shots_on_goal`. Retrying with that key and a known player ID returned both-side hit rates and five game logs. |
| Gamecenter selector | `sections=["props"]` returned a validation error listing all five selectors and explaining where props and market reviews live. | `sections=["analysis"]` succeeded on the same scheduled game with `not_published` availability. On a November 6 stored publication it returned seven props and six market reviews. A separate request by ID returned one cited fact. |

The NHL slate query and prop history endpoint had different sandbox coverage. The stored Gamecenter packet had a partial assessment, and Claude used its saved output to inspect the larger analysis response. This acceptance covers the error guidance, valid retries, and targeted citation retrieval. The prior OAuth and client acceptance retains its original scope in [the previous record](https://github.com/Handigraphs/handigraphs-stats-api-mcp/blob/846e6113/deploy/owner-acceptance.json). The record's legacy client fields carry those historical versions. The fresh observation here is Claude Desktop.

The temporary prop-evidence flag returned to unset after the replay. Sandbox web release v1407 succeeded. The MCP deploy switch, temporary deploy secret, and Heroku authorization were cleaned up after the sandbox build.

## Owner review

Review the scoped evidence and approve the acceptance record through the PR. After merge, the production workflow takes the full current MCP main SHA and the record's `accepted_app_sha`. The runtime comparison must pass before the native `production` environment review. See the [hosted MCP runbook](hosted-operations.md#production-gate-owner-acceptance).

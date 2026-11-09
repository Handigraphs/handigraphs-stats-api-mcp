# Compact Gamecenter pagination acceptance

This proposal records the November 9, 2026 sandbox replay of the paged response
introduced in [PR #44](https://github.com/Handigraphs/handigraphs-stats-api-mcp/pull/44).

- MCP source `e457b815c71bf7601e7a5001841e86cb17f0498c` ran on gateway sandbox v10.
  [Sandbox MCP deploy](https://github.com/Handigraphs/handigraphs-stats-api-mcp/actions/runs/42644842745)
- App source `3d9d1f8452083371881f5cf9fe41b481df8d91fb` ran on sandbox web v1408
  and production web v642. Both deploy logs tie that source to the resulting release.
  [Sandbox web deploy](https://github.com/cjbuskey/handigraphs-app/actions/runs/42638413313),
  [Production web deploy](https://github.com/cjbuskey/handigraphs-app/actions/runs/42639412158)
- Claude Desktop 4.23118.0.0 Chat used the existing hosted sandbox OAuth connector.
  The record's SHA-256 identifies the private redacted receipt.

## Hosted replay

The November 6 CBJ–BUF packet had previously clipped in the expanded tool card.
Claude fetched it using `format: "compact_page"` and followed the cursors at offsets
0, 1, 2, 3, 4, 5, 6, and 10. Each of the eight expanded cards showed the final
cursor field without an output truncation warning. The last cursor was null.
All seven props, six market reviews, and 145 distinct citation IDs appeared across
the pages, with zero oversized item markers. The card at offset six exposed 3,167
UTF-8 bytes of complete JSON. The other seven cards rendered named fields, so the
client view established completeness without exposing their raw byte counts.

The prop at offset zero and a market review at offset ten each supplied a
page-local index into the canonical ID table. Separate evidence calls each
returned exactly the requested fact. Claude initially reported a cached tool
schema. The explicit string format worked for every page call. The `clients`
fields retain their historical values from the
[November 8 record](https://github.com/Handigraphs/handigraphs-stats-api-mcp/blob/70aadbbe004bf796efb3eb01d937e9d7ebb31d73/deploy/owner-acceptance.json).

The sandbox deploy opt-in and secret were removed, and the temporary Heroku
authorization was revoked.

## Owner review

Review the scoped replay and exact source pair in the acceptance PR. Production
dispatch takes the full merged MCP main SHA and the record's `accepted_app_sha`.
The production runtime comparison and native environment approval apply separately.
See the [hosted MCP runbook](hosted-operations.md#production-gate-owner-acceptance).

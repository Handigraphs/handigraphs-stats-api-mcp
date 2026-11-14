# Incremental slate acceptance

`browser-oauth.mjs` is an operator-only, fixed-sandbox client. It uses installed
Playwright Chromium and the pinned official MCP SDK. It is excluded from the
gateway runtime, npm package and client distributions. It does not exercise a
native Codex, Claude or ChatGPT product-client catalog.

The application repository's `web/backend/scripts/accept_slate_oauth_sandbox.py`
creates an exact fresh synthetic owner, temporarily adds only that owner to the
three existing sandbox cohorts, accepts current Terms and creates/verifies its
temporary personal key. It passes generated website credentials over private
stdin, never a file, URL or command argument. It restores its temporary flags,
removes its own cohort membership, revokes credentials and deletes only its
synthetic owner and now-unreferenced registration. It journals noncredential IDs
for recovery and never clears Redis or unrelated account objects.

Supply the client script path and an installed Playwright module path to that
operator, with its exact `ACCEPT_NHL_SLATE_SANDBOX` confirmation, tested source
SHAs and private report/recovery-journal destinations. The report contains only
safe counts, bytes, times, HTTP statuses and stage names. No authenticated traces,
HAR, screenshots, storage state or raw responses are recorded. Do not run this
client manually with a real user's credentials.

The flow discovers both OAuth metadata documents, dynamically registers a public
client, signs in using the actual website, clicks the real consent UI, verifies
callback state and issuer, exchanges PKCE code, and starts a new hosted MCP client.
It verifies the fresh tool catalog, complete slate and full result byte bound,
invokes all five advertised evidence sections, compares candidate hit rates and
sample to the evidence drill-down, rotates refresh twice with a new connection
each time, revokes in Account, observes a completed gateway 401 with the still-live
frozen access token and confirms refresh returns invalid_grant. No retry or
automatic interactive recovery can turn a revoked credential into a passing read.

This is bounded functional acceptance, not a new multi-client load campaign or
publication. Record the actual source pair and cleanup result; retain historical
native-client versions only when they are clearly labeled historical.

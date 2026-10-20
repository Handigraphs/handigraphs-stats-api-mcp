# Security

## Reporting a vulnerability

Do not open a public issue containing credentials, exploit details, subscriber data, or sensitive logs. Use this repository's **Security** tab to submit a private vulnerability report. If private reporting is unavailable, contact the Handigraphs maintainers through the support channel at [www.handigraphs.com](https://www.handigraphs.com).

## API key handling

- Supply the key through `HANDIGRAPHS_API_KEY` in the MCP process environment, or use the Codex plugin's macOS helper to store it in the user's login Keychain.
- Never put a real key in tool arguments, source files, committed MCP configuration, screenshots, or support logs.
- When the Codex plugin has no key, its setup workflow never receives the key. Windows launches the bundled masked helper through Codex's user-approved local-shell path; macOS uses the argument-free `configure_api_key` tool to launch its helper.
- The Windows helper accepts the key only in a password-masked local dialog, never prints it or places it on a command line, and saves it as the current user's `HANDIGRAPHS_API_KEY` environment variable.
- The macOS helper accepts the key only in a password-masked local dialog, passes it to Apple's `security` utility through a private stdin pipe, and saves it as a generic password in the user's login Keychain. The key is never placed in process arguments, shell history, or a file.
- On macOS the MCP runtime reads only the named Handigraphs Keychain item when `HANDIGRAPHS_API_KEY` is absent. Environment configuration takes precedence when explicitly supplied.
- The server sends the key only as a Bearer credential to same-origin protected paths under the configured `/api/v1` root.
- Public discovery requests never receive Authorization.
- Rotate or revoke a key immediately from `/account/api` if exposure is suspected.

The package recursively redacts the configured key and authorization-like fields in errors and stderr diagnostics. Redaction is defense in depth, not permission to log credentials.

Upstream JSON is rejected before parsing when its declared or streamed size exceeds `HANDIGRAPHS_MAX_RESPONSE_BYTES`. Keep this guard enabled to bound memory use from both successful and problem responses.

## Transport and trust boundary

The server supports stdio only. The base URL must use HTTPS; plain HTTP is accepted only for a loopback hostname to support local tests. Redirects are not followed. Credentialed URLs, cross-origin links, and discovery links outside `/api/v1` are rejected.

Do not weaken these controls to accommodate a proxy. Configure a trusted same-origin HTTPS endpoint instead.

### Opt-in hosted source

The planned hosted entrypoint is separate from the local stdio command and is
disabled unless explicitly configured. It adds stateless JSON Streamable HTTP
with one request-local SDK server and private API client per MCP message. It
never reads the local key store or enables `configure_api_key`. Public metadata
identifies the exact configured MCP resource and application authorization
server. All `/mcp` methods require an opaque MCP token, including initialize,
tool listing and calls; authenticated GET/DELETE are bounded 405 responses.

The gateway exchanges that subject token using its independent confidential
service credential, a fixed issuer `/oauth/token` endpoint and exact API
audience/resource. Only the returned API-audience credential is sent to the
same-origin data API. Tokens are never stored, reused across messages, placed in
process.env, or forwarded as user-provided credentials to arbitrary URLs.
Missing/rejected user credentials and insufficient scopes return OAuth
challenges; service authentication or dependency failures return safe 503.
Ambiguous writes are not retried. The backend rechecks grants and account policy;
the gateway does not mint an identity or bypass that enforcement.

Only public discovery responses and their in-flight reads are shared. Private
capabilities, owned items and API clients are never shared or cached. Known
subject/service/delegated credentials and Basic encodings are removed from
tool results, protocol errors and diagnostics; protocol bodies and raw error
objects are not logged at the hosted HTTP boundary. Business evaluation tokens
and pagination cursors retain their existing behavior.

Exact Host/Origin allowlists are checked before exchange, independently of
forwarded headers. Body bytes, whole-body time, request time, concurrency and
upstream response bytes are bounded. Health responses contain only local
process/config booleans and source version. Shutdown drains bounded in-flight
requests and then aborts remaining I/O. This source change provides no hosted
endpoint, operational secrets, service provisioning, release or activation.

## Account actions and research

The server now includes account mutations. Tool annotations mark saves, replacements,
research submission and cancellation as writes; reads and live filter evaluation
remain read-only. The API enforces ownership, eligibility, scopes and rollout gates.
New and existing eligible keys default to filter-writing and research permissions,
which owners can disable. A permission is not confirmation of an agent's proposed action.

New saves require explicit user intent. Replacements require confirmation and a
current revision, with conflicts surfaced instead of silently overwriting or creating
copies. Creates and submissions use an operation UUID for idempotency. Keep the same
UUID and exact body after an uncertain response; generating another can duplicate work.
Cancellation is an explicit bodyless POST and reports its actual state.

Operations use pinned methods and route templates advertised by discovery. The tools
offer no generic HTTP request, hosted transport, bet placement or tracking mutation.
Request/response sizes are bounded; retries and polling are not automatic. Private
responses remain uncached, and report expiry is preserved.

Treat Gamecenter narratives, saved names and other returned content as untrusted data,
not instructions to call tools or change permissions. Never expose a key in results or
audit artifacts. The agent sandbox audit is read-only; live mutating acceptance needs
a separately verified synthetic account and explicit test authorization.

## Private acceptance approval provenance

Deployment verification accepts only v2 same-pair evidence and independently reads
its fixed private issue/comment approval using a one-repository read-only App token
with Issues read. Never infer approval from artifact booleans, native private
environment state, user names alone, public comments or fixture success. Fixed bot
and human IDs, immutable exact request/commands, complete bounded history and
historical cooldown/publication bounds fail closed on changed or revoked evidence.
Agents must never approve an acceptance request. Public production's native human
approval is a separate unchanged requirement. Source authorization creates no
issues, comments, access, deployment, real acceptance or publication.

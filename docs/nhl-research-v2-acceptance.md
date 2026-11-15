# NHL research v2 acceptance

The final sandbox SDK/browser cohort passed. Actual Claude.ai replay is in
progress; no new owner production decision is recorded yet.

| Component | Tested revision |
| --- | --- |
| Application, contract 1.24.1 | `aec596bf9d51bf21c5d0f3d48feb47b88db16dee` |
| Hosted MCP runtime | `f9d9b4a5c87cb6eb306fdc897b329e2101352d09` |
| Operator checkpoint | `5f84a971a9a62173c59831f20f57774a3a3837ca` |

## Five fresh owners, real browser OAuth and official SDK

The finite fixed-sandbox cohort used five new synthetic owners and independently
verified all five temporary key digests. Real Chromium login/consent, DCR, PKCE,
state and issuer checks preceded the synchronized MCP-first protected reads.
No REST brief warmed the endpoint. Context and skater-history cache misses were
observed. All five clients used the 24-tool catalog, contract 1.24.1 and the five
advertised evidence sections, with exact player/market/line/sample parity.

| Check | Observed result |
| --- | --- |
| Cold / warm samples | 5 / 15 |
| Cold p95 | 3610 ms (target <6000) |
| Warm p95 | 1248 ms (target <2000) |
| Largest complete serialized MCP result | 31490 bytes (limit 32768) |
| Unexpected 429 / 503 | 0 / 0 |
| Refresh rotations | Two per owner, fresh connections |
| Browser revocation | Five completed, followed by gateway 401 and invalid_grant |
| Cleanup | Exact owners/registrations removed, flags restored, journal removed |

The SDK is 1.32.1 and Chromium is 147.0.7727.15. This is distinct from the actual
Claude.ai acceptance below and does not establish every native product's behavior.

## Repairs established during acceptance

Repeated game certification and offer parsing caused the first latency failures.
The brief now shares canonical completed-game proofs and time-independent offer
preparation. Every read still checks quote age, game start, exact family/line,
starter status and live book selection. No betting probabilities or EV model was
introduced. Source parity and aged-quote/book-reselection regressions passed.

Native screening exposed old projected rows whose day_label still said today.
Read-only sandbox SQL found 11 November 12 rows with that label alongside 14
current November 14 rows. Shared goalie/skater readers now use the Eastern
calendar date. Real PostgreSQL regressions passed; read-only readers returned
28 unique goalies and 504 unique skaters with zero duplicates. The cache namespace
is 1.24.1. Explicit replay selectors and intentional prior-season defaults remain.

The cohort harness initially clicked revocation in the account page's loading
branch; replacing that panel could discard confirmation before submission.
It now awaits the loaded/error account page before clicking. Denial assertions,
timeouts and no-retry behavior are unchanged. The website's early-click panel
reset remains an independent UX follow-up.

## Actual Claude.ai

Final fresh-catalog replay and focused evidence/goalie/Gamecenter checks pending.

## Limits and rollout boundary

- Complete context and named key/GTD/goalie alerts have byte priority. This slate
  returned five candidates, with byte limits, exclusions and drill-down selectors
  disclosed. Up to twelve is a ceiling, not a guaranteed pick count.
- Sandbox histories and source observations can be old or unknown; timestamps
  remain separate and no generation time substitutes for source freshness.
- Omitted NHL season can intentionally use the prior-season early-season baseline;
  use the brief's explicit season ID for a current-season stats comparison.
- Gamecenter remains optional stored analysis. No new generation was authorized.
- No production activation or npm/plugin/MCPB publication is established by these
  sandbox tests. Production retains owner acceptance and native human approval.

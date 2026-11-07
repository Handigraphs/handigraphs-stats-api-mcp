# Sandbox build source preparation

Active writer: Codex, Windows desktop, 2026-11-07. Branch
`codex/sandbox-build-start`, base `96cdcae2a462e6886dfade24445de6623fdf0c22`.
The user authorized investigating/fixing the Heroku startup failure, sandbox
retries and temporary credentials, with production untouched. Protected-write
scope received a separate explicit approval. Source merge approval remains
separate under this repository's rules.

Repeated sandbox requests reached Heroku and immediately failed before a slug
was created. Scope tests, including explicit ordinary/protected read/write,
and a pinned official Git buildpack did not resolve the failure. Registry
buildpack configuration was restored after testing. All temporary authorizations,
environment secrets and deployment opt-ins were removed. The raw generic build
output, signed URLs, credentials and private API bodies were never logged.
The current gateway remains on its previous release; NHL evidence is disabled.

This change isolates the source retrieval path. Sandbox downloads the exact
reviewed public codeload archive without credentials/redirects, bounds it to
10 MiB/15 seconds, checks gzip, reserves one fixed-app Heroku Sources object,
uploads once without Authorization, and supplies the private expiring URL and
SHA-256 to the single build request. S3 origins and object paths are validated.
Main is rechecked before build submission. Production retains its original path.
No runtime, token, plugin, owner acceptance, package or lockfile change is made.
Dependabot PR #37 touches the lockfile and does not overlap this source change.

Validation: full canonical profile passed, including 174 tests with two existing
platform-dependent skips, typecheck, production audit (zero vulnerabilities),
build, package, local/hosted distributions and MCPB. New cases cover source size,
malformed gzip, redirects, upload origin/object/userinfo/fragment, upload failure,
main moving after upload, checksum and credential isolation. Production's exact
old one-build request is retained by its existing regression.

This is a proposed sandbox source-path fix, not proof of the original platform
cause or a successful deployment. After merge approval/CI, deploy via the fixed
sandbox workflow and validate the full source pair before using the approved
fresh cohort. The app's `codex/nhl-prop-acceptance` branch contains the finite
official-SDK/native-client acceptance harness and cleanup guards. Update its
MCP source pin to the actually deployed new main SHA. No production operation or
distribution publication is authorized. The code checkpoint is the commit
containing this note; report the verified pushed tip in the session closeout.

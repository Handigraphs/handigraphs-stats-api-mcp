# Connect Handigraphs to Codex

The normal Windows and macOS setup requires one Codex starter and one masked paste. You do not need to edit `config.toml`, write shell commands, or send your API key to an agent.

The normal installation below is the supported **local** `handigraphs-stats-api`
plugin. The hosted plugin (browser sign-in, no API key) is described in
[Hosted connection](#hosted-connection). Do not put a local key into an HTTP
connection or replace an existing local installation.

## Install

1. Install Node.js 22 or newer.
2. Update Codex and confirm it starts:

   ```console
   npm install --global @openai/codex@latest
   codex --version
   ```

3. Install the marketplace and plugin:

   ```console
   codex plugin marketplace add Handigraphs/handigraphs-stats-api-mcp
   codex plugin add handigraphs-stats-api@handigraphs
   ```

4. Start a new Codex task with the Handigraphs plugin and select **Connect my Handigraphs account**. On Windows, approve the local helper launch when Codex asks; the approval is only for opening the password-masked setup window.
5. In the local setup window, open the Handigraphs API key page, create or copy your reveal-once key, paste it into the masked field, and select **Save**. The helper sends `hg_test_` keys to the sandbox API and `hg_live_` keys to production automatically.
6. Fully quit and reopen Codex. Start a new task and ask a Handigraphs stats question.

The plugin starts safely even when the key is absent. In that state its setup skill launches the bundled Windows helper through Codex's approved local-shell path; on macOS it uses the argument-free `configure_api_key` MCP tool. The API key is never included in the shell command, tool call, or Codex conversation. Windows saves it as a user environment variable; macOS saves it in the user's login Keychain and reads it directly when the MCP process starts.

## Update an existing installation

Update Codex first, then reinstall the plugin from its marketplace entry:

```console
npm install --global @openai/codex@latest
codex plugin add handigraphs-stats-api@handigraphs
```

Start a new task after reinstalling so Codex loads the current plugin skills and MCP configuration.

## Rotate a key

Select **Connect my Handigraphs account** again. The same masked setup window replaces the saved Windows user value or macOS Keychain item. Fully quit and reopen Codex afterward.

## Platform behavior

- **Windows:** The masked helper saves `HANDIGRAPHS_API_KEY` and the matching sandbox or production API URL as current-user environment variables.
- **macOS:** The masked helper saves the key as a generic password in the user's login Keychain. The MCP runtime retrieves it locally at startup and infers sandbox for `hg_test_` or production for `hg_live_`.
- **Linux:** Automatic secret storage is not yet bundled. Set `HANDIGRAPHS_API_KEY` through the user-controlled environment or secret manager that launches Codex, keep it out of prompts and shell history, and fully restart Codex.

## Troubleshooting

- If Codex says the setup window opened on Windows but no dialog appears, install plugin version `0.2.6` or newer, fully quit Codex, and try **Connect my Handigraphs account** in a new task. Approve the out-of-sandbox local helper launch when prompted; a helper started inside the Windows sandbox can be isolated on Codex's private desktop and remain invisible.
- If Codex writes out commands for you to paste instead of launching the masked helper itself, the installed plugin is outdated. Update Codex, reinstall the plugin, and start a new task.
- If Codex says the setup window opened on macOS but no dialog appears, reinstall plugin version `0.2.2` or newer, fully quit Codex, and try **Connect my Handigraphs account** in a new task.
- If stats tools are unavailable immediately after saving, fully quit Codex rather than only closing the task window, then reopen it.
- If the setup window reports an invalid key, use a reveal-once key beginning with `hg_test_` or `hg_live_` from [www.handigraphs.com/account/api](https://www.handigraphs.com/account/api).
- If a test key reaches the production API, reinstall the latest plugin and run **Connect my Handigraphs account** again so it saves the sandbox environment selection.
- Never paste a real key into a conversation, issue, screenshot, committed configuration file, or support log.

## Hosted connection

The hosted plugin connects to `https://mcp.handigraphs.com/mcp` with browser sign-in; there is no
API key, local helper or secret setting. It is available to eligible Handigraphs
All Access members (paid, non-trial, current API Terms).

### Codex

```console
codex plugin marketplace add Handigraphs/handigraphs-stats-api-mcp
codex plugin add handigraphs-stats-api-hosted@handigraphs
```

Start a new task. When Codex asks to connect, sign in as your Handigraphs account
in the browser, review the API Terms if asked and choose permissions. `stats:read`
is required; `filters:write` and `research:run` are independent choices. The
desktop app and CLI share this configuration, as described in the
[official Codex MCP documentation](https://learn.chatgpt.com/docs/extend/mcp?surface=cli).

### Claude Code

```console
claude plugin marketplace add Handigraphs/handigraphs-stats-api-mcp
claude plugin install handigraphs-stats-api-hosted@handigraphs
```

Start a new session, run `/mcp`, select `handigraphs-stats-hosted` and follow the
browser sign-in. Do not use the local plugin's sensitive-key configuration screen
for hosted OAuth. See the [official Claude Code MCP guide](https://code.claude.com/docs/en/mcp)
and [plugin reference](https://code.claude.com/docs/en/plugins-reference).

### Direct URL instead of the plugin

You can register the server URL directly. This supplies the 19 tools but not the
plugin's installed skills:

```console
codex mcp add handigraphs-stats-hosted --url https://mcp.handigraphs.com/mcp
codex mcp login handigraphs-stats-hosted
```

```console
claude mcp add --transport http handigraphs-stats-hosted https://mcp.handigraphs.com/mcp
```

In Claude Code, run `/mcp` afterwards to sign in. No fixed client ID, callback
port, client secret, bearer header or key setting is needed: the client discovers
the public registration and OAuth metadata. Do not register the same server both
directly and through the plugin. Claude Desktop remains on the supported local
MCPB path.

### Reconnect, permissions and choosing local

For expired/revoked authorization or `401`, use the client's login/reconnect flow
as the intended owner. For missing scopes, explain the denial; revoke the app in
Account → API access and reconnect with explicit consent to change permissions.
Eligibility/Terms/rollout failures do not justify broader consent, a different
account, repeated submissions or silently using a local key. A lapsed owner can
still inspect and revoke connections. Never paste API keys, website JWTs,
refresh/access tokens or gateway service secrets into chat, configuration, tool
arguments or support logs. Browser login handles credentials; the hosted package
contains no local setup helpers or credential placeholders.

Use **one connection at a time** to avoid duplicate tool choices. Do not register
the same hosted server both directly and through a plugin. If local access is
preferred, choose the existing local plugin and its masked setup explicitly;
never automatically disable, uninstall or migrate either installation. Revoking
an OAuth grant leaves personal-key slots, permissions and saved objects intact.
Keys and multiple grants share the same account limits, so switching does not
increase a budget. Technical scope never authorizes an unrequested save, and
replacement still requires explicit confirmation and a current revision.

Hosted handler changes deploy centrally, but tool definitions can remain cached
in an active chat. Reconnect or start a new conversation/task when definitions
change. Updating installed skills is a separate plugin update, followed by a new
task/session; it is not guaranteed by a server deployment. Do not promise an
instant tool refresh or silently retry an ambiguous write during reconnect.

# Connect Handigraphs to Codex

The normal Windows and macOS setup requires one Codex starter and one masked paste. You do not need to edit `config.toml`, write shell commands, or send your API key to an agent.

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

- If Codex says the setup window opened on Windows but no dialog appears, install plugin version `0.2.4` or newer, fully quit Codex, and try **Connect my Handigraphs account** in a new task. Approve the local helper launch when prompted.
- If Codex writes out commands for you to paste instead of launching the masked helper itself, the installed plugin is outdated. Update Codex, reinstall the plugin, and start a new task.
- If Codex says the setup window opened on macOS but no dialog appears, reinstall plugin version `0.2.2` or newer, fully quit Codex, and try **Connect my Handigraphs account** in a new task.
- If stats tools are unavailable immediately after saving, fully quit Codex rather than only closing the task window, then reopen it.
- If the setup window reports an invalid key, use a reveal-once key beginning with `hg_test_` or `hg_live_` from [www.handigraphs.com/account/api](https://www.handigraphs.com/account/api).
- If a test key reaches the production API, reinstall the latest plugin and run **Connect my Handigraphs account** again so it saves the sandbox environment selection.
- Never paste a real key into a conversation, issue, screenshot, committed configuration file, or support log.

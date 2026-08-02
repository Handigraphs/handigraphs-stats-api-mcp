# Connect Handigraphs to Codex

The normal Windows setup requires one Codex starter and one masked paste. You do not need to edit `config.toml`, write PowerShell, or send your API key to an agent.

## Install

1. Install Node.js 22 or newer.
2. Update Codex and confirm it starts:

   ```powershell
   npm install --global @openai/codex@latest
   codex --version
   ```

3. Install the marketplace and plugin:

   ```powershell
   codex plugin marketplace add Handigraphs/handigraphs-stats-api-mcp
   codex plugin add handigraphs-stats-api@handigraphs
   ```

4. Start a new Codex task with the Handigraphs plugin and select **Connect my Handigraphs account**.
5. In the local setup window, open the Handigraphs API key page, create or copy your reveal-once key, paste it into the masked field, and select **Save**. The helper sends `hg_test_` keys to the sandbox API and `hg_live_` keys to production automatically.
6. Fully quit and reopen Codex. Start a new task and ask a Handigraphs stats question.

The plugin starts safely even when the key is absent. In that state it exposes only `configure_api_key`, an argument-free tool that opens the setup window. The API key is never included in the tool call or Codex conversation.

## Update an existing installation

Update Codex first, then reinstall the plugin from its marketplace entry:

```powershell
npm install --global @openai/codex@latest
codex plugin add handigraphs-stats-api@handigraphs
```

Start a new task after reinstalling so Codex loads the current plugin skills and MCP configuration.

## Rotate a key

Select **Connect my Handigraphs account** again. The same masked setup window replaces the saved Windows user value. Fully quit and reopen Codex afterward.

## macOS and Linux

Codex does not currently provide an install-time secret field for local stdio plugins. Set `HANDIGRAPHS_API_KEY` through the user-controlled environment or secret manager that launches Codex, keep the value out of prompts and shell history, and fully restart Codex. The plugin forwards the variable only to its local MCP process.

## Troubleshooting

- If Codex writes out PowerShell instructions instead of opening a setup window, the installed plugin is outdated. Update Codex, reinstall the plugin, and start a new task.
- If stats tools are unavailable immediately after saving, fully quit Codex rather than only closing the task window, then reopen it.
- If the setup window reports an invalid key, use a reveal-once key beginning with `hg_test_` or `hg_live_` from [handigraphs.com/account/api](https://handigraphs.com/account/api).
- If a test key reaches the production API, reinstall the latest plugin and run **Connect my Handigraphs account** again so it saves the sandbox environment selection.
- Never paste a real key into a conversation, issue, screenshot, committed configuration file, or support log.

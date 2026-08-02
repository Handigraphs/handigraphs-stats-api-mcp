---
name: setup-handigraphs-stats-api
description: Configure the reveal-once Handigraphs Stats API key for the installed Codex plugin without putting the key in chat, prompts, shell history, repository files, or tool arguments. Trigger when the Handigraphs MCP server reports that HANDIGRAPHS_API_KEY is missing, immediately after plugin installation, or when the user asks to set up, authenticate, replace, or rotate the plugin API key.
---

# Set Up Handigraphs Stats API

Configure the local plugin without exposing the reveal-once key to the model or conversation.

## Security rules

- Never ask the user to paste, type, upload, or repeat the API key in chat.
- Never pass the API key as a shell command argument, tool argument, environment dump, log message, or test fixture.
- Never read or print the current value. Credential checks may return only whether a value is present.
- Direct the user to create or rotate a key at `https://handigraphs.com/account/api` when they do not already have a copied reveal-once key.

## Windows agent-assisted setup

1. Call the plugin MCP tool `configure_api_key` immediately. It takes no arguments and launches the bundled password-masked local setup window.
2. Do not generate or show PowerShell code unless that MCP tool is unavailable in the installed plugin version.
3. Tell the user to finish the steps in the setup window and fully quit and reopen Codex. The already-running Codex process cannot inherit a user environment variable written after it started.

If `configure_api_key` is unavailable, explain that the installed plugin is outdated and direct the user to update Codex and reinstall the latest Handigraphs plugin. The bundled `../../scripts/configure-windows.ps1` helper is a last-resort local fallback, not the normal user flow.

Do not claim authentication is verified in the current task. After restart, a normal Handigraphs query confirms that the MCP server can load the credential and authenticate.

## macOS and Linux

Codex does not currently expose an install-time secret field for local stdio plugins. Do not collect the key through the agent as a workaround. Direct the user to set `HANDIGRAPHS_API_KEY` in the environment that launches Codex, keeping the key out of shell history, and then fully restart Codex. If their desktop environment does not inherit shell variables, direct them to their operating system's user-environment or secret-manager documentation rather than inventing a credential store.

## Rotation

On Windows, rerun the bundled helper and replace the saved user environment variable. On other platforms, replace the variable through the same user-controlled environment or secret manager used during setup. A full Codex restart is required after rotation.

[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ($env:OS -ne "Windows_NT") {
    throw "This helper supports Windows only."
}

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public static class HandigraphsEnvironmentNotifier
{
    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern IntPtr SendMessageTimeout(
        IntPtr hWnd,
        uint message,
        UIntPtr wParam,
        string lParam,
        uint flags,
        uint timeout,
        out UIntPtr result);
}
"@

$form = New-Object System.Windows.Forms.Form
$form.Text = "Handigraphs Stats API setup"
$form.StartPosition = "CenterScreen"
$form.Size = New-Object System.Drawing.Size(560, 285)
$form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::FixedDialog
$form.MaximizeBox = $false
$form.MinimizeBox = $false
$form.TopMost = $true

$instructions = New-Object System.Windows.Forms.Label
$instructions.Location = New-Object System.Drawing.Point(20, 18)
$instructions.Size = New-Object System.Drawing.Size(505, 55)
$instructions.Text = "Create or copy your reveal-once key, then paste it below. The key stays in this masked local window and is saved only as a Windows user environment variable."
$form.Controls.Add($instructions)

$accountLink = New-Object System.Windows.Forms.LinkLabel
$accountLink.Location = New-Object System.Drawing.Point(20, 76)
$accountLink.Size = New-Object System.Drawing.Size(505, 24)
$accountLink.Text = "Open Handigraphs API key page"
$accountLink.Add_LinkClicked({
    Start-Process "https://handigraphs.com/account/api"
})
$form.Controls.Add($accountLink)

$keyBox = New-Object System.Windows.Forms.TextBox
$keyBox.Location = New-Object System.Drawing.Point(20, 110)
$keyBox.Size = New-Object System.Drawing.Size(505, 24)
$keyBox.UseSystemPasswordChar = $true
$form.Controls.Add($keyBox)

$status = New-Object System.Windows.Forms.Label
$status.Location = New-Object System.Drawing.Point(20, 140)
$status.Size = New-Object System.Drawing.Size(505, 24)
$status.ForeColor = [System.Drawing.Color]::DarkRed
$form.Controls.Add($status)

$saveButton = New-Object System.Windows.Forms.Button
$saveButton.Location = New-Object System.Drawing.Point(345, 185)
$saveButton.Size = New-Object System.Drawing.Size(85, 30)
$saveButton.Text = "Save"
$form.Controls.Add($saveButton)

$cancelButton = New-Object System.Windows.Forms.Button
$cancelButton.Location = New-Object System.Drawing.Point(440, 185)
$cancelButton.Size = New-Object System.Drawing.Size(85, 30)
$cancelButton.Text = "Cancel"
$cancelButton.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
$form.CancelButton = $cancelButton
$form.Controls.Add($cancelButton)

$saveButton.Add_Click({
    $candidate = $keyBox.Text.Trim()
    $hasSupportedPrefix = $candidate.StartsWith("hg_test_") -or $candidate.StartsWith("hg_live_")
    if (-not $hasSupportedPrefix -or $candidate.Length -le 16) {
        $status.Text = "Enter a valid key beginning with hg_test_ or hg_live_."
        return
    }

    $apiBaseUrl = if ($candidate.StartsWith("hg_test_")) {
        "https://handigraphs-sandbox-web-49829810d1bb.herokuapp.com/api/v1"
    } else {
        $null
    }
    [Environment]::SetEnvironmentVariable("HANDIGRAPHS_API_BASE_URL", $apiBaseUrl, "User")
    [Environment]::SetEnvironmentVariable("HANDIGRAPHS_API_KEY", $candidate, "User")
    $keyBox.Clear()
    $candidate = $null
    $apiBaseUrl = $null
    $form.DialogResult = [System.Windows.Forms.DialogResult]::OK
    $form.Close()
})

$form.AcceptButton = $saveButton
$form.Add_Shown({ $keyBox.Focus() })
$result = $form.ShowDialog()
$form.Dispose()

if ($result -ne [System.Windows.Forms.DialogResult]::OK) {
    Write-Output "Handigraphs Stats API setup was cancelled."
    exit 1
}

$broadcastResult = [UIntPtr]::Zero
[HandigraphsEnvironmentNotifier]::SendMessageTimeout(
    [IntPtr]0xffff,
    0x001A,
    [UIntPtr]::Zero,
    "Environment",
    0x0002,
    5000,
    [ref]$broadcastResult
) | Out-Null

[System.Windows.Forms.MessageBox]::Show(
    "Your API key and matching API environment are saved. Fully quit and reopen Codex, then start a new task.",
    "Handigraphs connected",
    [System.Windows.Forms.MessageBoxButtons]::OK,
    [System.Windows.Forms.MessageBoxIcon]::Information
) | Out-Null

Write-Output "Handigraphs Stats API key configured. Restart Codex before using the plugin."

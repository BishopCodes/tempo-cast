# Tempo Time Tracking (Raycast)

Raycast extension to log time against Jira issues using **Tempo** APIs.

## Features

- **Time Logging**: Create new time entries for Jira issues
- **Timer**: Start/stop timers for issues with automatic time tracking
- **Worklogs**: View and manage your daily time entries
- **Week Backfill**: Quickly backfill time entries for the previous week
- **AI Summaries**: Generate weekly summaries using GitHub Copilot (with OAuth!)
- **JQL Queries**: Save and manage custom JQL queries for quick issue access
- **Menu Bar Timer**: Live timer display in the menu bar

## GitHub Copilot Integration

This extension supports **GitHub OAuth** for seamless integration with GitHub Copilot models!

### Authorization Options

1. **OAuth (Recommended)**: Run the "Authorize GitHub Copilot" command
   - One-click authorization
   - No manual token creation needed
   - Secure device flow authentication
   - Works with GitHub Copilot subscription or free tier

### How to Authorize

1. Open Raycast and run: `Tempo: Authorize GitHub Copilot`
2. You'll see a verification code
3. Your browser will open to GitHub's authorization page
4. Enter the code and authorize
5. Return to Raycast - you're done!

The extension will automatically use your authorized account for AI summaries.

## Setup

1. Install the extension in Raycast
2. Configure your Jira and Tempo API credentials in preferences
3. (Optional) Authorize GitHub Copilot for AI features
4. Start tracking your time!

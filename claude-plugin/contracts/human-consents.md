# Human consent contract

The installer can automate setup, validation, retries and secret transfer. It cannot and should not bypass the account owner or workspace administrator at the following trust boundaries.

## Before installation

The user must confirm:

1. Which VPS will host the dedicated Brain4U instance.
2. Which model provider account pays for inference.
3. Which Slack workspace and Google Workspace identity may be connected.
4. That Brain4U may read data in the explicitly selected sources.

No external account, server or application is created before this confirmation.

## Model provider

The MVP uses a client-owned API key. Local Claude Code authentication stays on the user's computer and is not copied to the VPS.

The installer may securely transfer the API key after showing its destination and purpose. It must never print the value, write it to the brain repository or include it in diagnostics.

## Slack

The user or a Slack administrator must:

1. Create the Slack app from the supplied manifest while logged into the target workspace.
2. Generate the app-level token required by Socket Mode.
3. Install the app and approve the requested bot scopes.
4. Give the installer the `xapp` and `xoxb` tokens through masked inputs.
5. Invite Brain4U only to the channels it is allowed to read.

The MVP does not request `assistant:write`, `files:write` or administrative workspace scopes. It does not expose Hermes commands for unattended updates, debug uploads, model switching or bypassing approvals.

## Google Workspace

The MVP assumes a client-owned Google Cloud project and a client-owned OAuth app marked **Internal** in the client's Workspace. Brain4U does not provide or control a shared Google OAuth app.

The user or Workspace administrator must:

1. Select or create the client-owned Google Cloud project.
2. Enable Gmail, Drive and Calendar APIs.
3. Configure an Internal OAuth consent screen.
4. Create a Desktop OAuth client.
5. Approve or allow-list the requested read-only scopes if the organization's policy requires it.
6. Let the installer open Google's authorization screen.
7. Select the identity Brain4U will use and approve the displayed read-only scopes.

Steps 6 and 7 happen inside the guided installation. The installer exchanges the one-time authorization code for offline access and stores the refresh token only in the client's dedicated VPS secret store.

The MVP deliberately excludes domain-wide delegation and service-account impersonation. Personal `@gmail.com` accounts and External apps in Testing mode are not considered durable production installations in this phase.

## Completion evidence

Installation is complete only when the user sees a redacted report proving:

- Hermes is healthy after a restart.
- Slack can receive a direct message or mention and return a reply.
- Gmail, Drive and Calendar each pass a read-only query.
- Re-running the installer changes nothing unless configuration changed.
- No credential is present in logs or the brain repository.

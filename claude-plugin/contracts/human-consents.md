# Accounts and connections owned by the recipient

The installer prepares and verifies components. Account authorization belongs to the recipient or their workspace administrator. It never connects Growth4U's company Brain or shared Slack or Google credentials.

## GitHub and infrastructure

The recipient signs in to their own GitHub account. The Brain is created as a private repository owned by that account, with a dedicated runtime deploy key. If GitHub refuses creating template workflows because authorization lacks the `workflow` scope, use `gh auth refresh -s workflow` to authorize that capability in the recipient's account and retry; never substitute a Growth4U token.

For a new Hermes runtime, OpenRouter and Hetzner accounts belong to the recipient. The installation plan must show the current server cost and receive explicit confirmation before creating resources. A Brain-only installation stops before those providers.

## Slack

Follow `docs/messaging.md`. Generate the app manifest from the installed Hermes version. The bundled JSON is a reference generated from the tested Hermes 0.20.5 image; it is not a preconfigured Slack app or a connection.

The recipient or their administrator creates an app in the intended workspace, reviews its scopes, enables Socket Mode and installs it. The manifest includes assistant and file capabilities as well as conversation scopes and Hermes commands. Use an explicit allowed-user list. Limit channel membership to the channels the recipient authorizes.

Bot and app tokens enter the private Hermes setup assistant and stay in that installation. Never paste them into Claude, the Brain repository, a guide or a support transcript. Confirm a real reply before describing Slack as connected.

## Google Chat

Follow `docs/messaging.md`. Google Workspace and a Google Cloud project, service account and Pub/Sub subscription belong to the recipient. Store the private service-account file outside the Brain with restrictive permissions and configure the allowed users. Confirm a reply in the intended space before describing Chat as connected.

`google-scopes.json` is a reference for separate optional Gmail, Drive and Calendar content connectors. It does not configure Google Chat and is not activated by this installer. Connecting Chat does not authorize reading the recipient's inbox or Drive.

## Verification

Report which components passed their actual checks, which accounts were authorized and which channels remain pending. Do not equate an installed manifest, guide, health endpoint or local test with a real authorized messaging connection.

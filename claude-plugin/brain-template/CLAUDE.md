# Brain4U operating instructions

This repository is the company's durable shared memory.

## Read order

1. Read `INDEX.md`.
2. Load only the pages relevant to the current task.
3. Treat source systems as authoritative for live operational state.

## Write rules

- Store reusable decisions, principles, playbooks and distilled learnings.
- Use Markdown with provenance, date, owner and privacy metadata.
- Never store credentials, raw inboxes, raw chats, raw meeting transcripts or unredacted personal data.
- Propose durable changes through a branch and pull request.
- Preserve source references so every learning can be audited.
- Run `./lint-brain.sh` before committing.

## Memory boundary

The Brain stores what the company learned. It does not replace project management, CRM, email, chat, document storage or analytics systems.

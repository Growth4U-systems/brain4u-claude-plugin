---
type: policy
title: Memory writeback policy
status: active
privacy: shared
---

# Memory writeback policy

## Shared route

Write durable and reusable knowledge to the Brain when it helps the company make future decisions or repeat a workflow. Every write includes provenance, date, owner and privacy classification.

## Private route

Keep personal preferences, machine-local state, temporary notes and private administrative context outside this repository.

## Sensitive route

Never write passwords, tokens, API keys, credentials, raw exports, raw messages, raw transcripts or unnecessary personal data to the Brain. Redaction is mandatory before persistence.

## Promotion rule

When the owner requests remembering a sourced decision or learning, or has granted standing permission for that class of memory, agents may publish the distilled record directly with `node scripts/publish-memory.mjs wiki/company/learnings/<record>.md` (or `decisions`). The helper checks metadata, sensitive content and Git state, publishes only the selected record and verifies the remote commit. A local file or failed push is not canonical memory. Do not invent authorization or bypass branch protection.

Changes to identity, principles, playbooks, skills, prompts, hooks, governance or agent behavior require a focused pull request and human review. If ownership, provenance or privacy is unclear, ask before publishing. Never promote an unverified generated summary automatically.

Official released logic may update unchanged distribution files through the separately documented updater in `docs/updates.md`. Business memory and customized files remain owned by this installation.

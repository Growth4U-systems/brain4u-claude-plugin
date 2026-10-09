---
name: brain-write
description: Persist authorized, sourced decisions and learnings; propose behavior changes through reviewed pull requests.
---

# Brain write

Classify the content, remove raw or sensitive material, add provenance and metadata and choose the canonical path from `governance/content-map.md`. Respect the owner's authorization and privacy policy.

For authorized decisions and learnings, create a sourced record under `wiki/company/decisions/` or `wiki/company/learnings/`, then run `node scripts/publish-memory.mjs <record-path>` from the Brain root. Check the reported canonical result before saying it was remembered. A failed push remains pending; preserve local work and explain the required reconciliation.

For policies, agent behavior, identity, principles, playbooks, skills and other protected paths, run the linter and open a focused pull request for human review. Do not treat a generated summary as verified evidence.

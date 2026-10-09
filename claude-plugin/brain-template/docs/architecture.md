# Architecture

Brain4U uses Markdown and git as the durable source of truth.

The `wiki/` layout follows the LLM Wiki pattern: agents compile stable knowledge instead of searching raw data for every question. `gbrain.yml` defines a read-only retrieval boundary that can be consumed by GBrain-compatible tooling without giving the index authority to change memory. The behavior layer adopts GStack's useful discipline of explicit skills, roles, commands, review and QA workflows without making GStack the memory backend.

MemSearch is the episodic memory layer for Claude Code. Memory files live under `.memsearch/` in each local project, while embeddings and the semantic index stay on the user's computer as a rebuildable cache. Its hooks send parsed turn content to Claude Haiku to produce summaries. The first activation downloads the local ONNX bge-m3 model, approximately 558 MB.

```text
Claude Code session -> MemSearch local files and index
                                  |
                                  | verified distillation and authorization
                                  v
Sources -> redaction -> sourced record -> verified publication -> Brain4U -> Hermes
Behavior changes -> focused pull request -> human review -> Brain4U
```

MemSearch does not write directly to Brain4U. A generated summary points to evidence, not canonical knowledge. Authorized, sourced learning and decision records use the memory publication helper; changes to agent behavior and policy require a reviewed pull request.

The Brain repository is cloned into the VPS and mounted in Hermes as `/opt/brain`. Hermes reads that repository and its rules. It cannot read the MemSearch index on the user's computer.

Raw source data, `.memsearch/`, semantic index files and live operational state remain outside git.

The default role is Chief of Staff, defined under `agents/chief-of-staff/` and referenced in the root agent rules and runtime prompt. The template's `scripts/` helpers publish authorized memory and apply official stable logic updates while preserving company knowledge and local customizations. See `docs/updates.md` for conditions and limits.

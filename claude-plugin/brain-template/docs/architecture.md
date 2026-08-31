# Architecture

Brain4U uses Markdown and git as the durable source of truth.

The `wiki/` layout follows the LLM Wiki pattern: agents compile stable knowledge instead of searching raw data for every question. `gbrain.yml` defines a read-only retrieval boundary that can be consumed by GBrain-compatible tooling without giving the index authority to change memory. The behavior layer adopts GStack's useful discipline of explicit skills, roles, commands, review and QA workflows without making GStack the memory backend.

```text
Sources -> redaction and distillation -> pull request -> Brain4U
                                                     -> read-only index
                                                     -> Hermes retrieval
```

Raw source data and live operational state remain outside git.

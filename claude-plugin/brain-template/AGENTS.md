# Agent rules

Agents may read the Brain to ground their work. They may write only distilled, durable knowledge that complies with `governance/memory-writeback-policy.md`.

Required behavior:

- cite the source and date of material claims;
- distinguish facts, decisions, hypotheses and proposals;
- redact secrets and unnecessary personal information before persistence;
- never treat memory as live state;
- use pull requests for shared changes;
- stop when the correct privacy route or owner is unclear.

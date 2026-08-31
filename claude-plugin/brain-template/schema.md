# Page schema

Durable knowledge pages should start with YAML frontmatter:

```yaml
---
type: decision | learning | principle | playbook | snapshot
title: Short descriptive title
date: YYYY-MM-DD
owner: person-or-team
privacy: shared | restricted
sources:
  - stable source reference
status: proposed | active | superseded
---
```

Record what changed, why it matters, the evidence, limitations and the next review date when applicable.

# Privacy policy

- Collect only explicitly authorized sources.
- Preserve source access boundaries during retrieval.
- Minimize personal data before persistence.
- Keep raw payloads outside git with bounded retention.
- Keep MemSearch files and semantic indexes local. Never commit `.memsearch/` or copy it into the Brain.
- Remember that parsed turn content is processed by Claude Haiku to generate MemSearch summaries. Treat those summaries as unapproved working material until a person reviews the source, privacy classification and proposed destination.
- Move only distilled, durable and explicitly approved knowledge into the Brain through a pull request.
- Never put credentials in prompts, logs, commits or pull requests.
- A deletion request must identify both the source record and any distilled page derived from it.
- Restricted material requires explicit owners and reviewers.
- Do not assume Hermes can access local episodic memory. Hermes reads the Brain mounted in its VPS, not the user's MemSearch index.

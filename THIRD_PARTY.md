# Components and references

The Brain4U installer packages its own engine, generic company-memory template and Claude Code skill. It does not redistribute private Growth4U company knowledge.

- [Claude Code](https://code.claude.com/docs/en/plugin-marketplaces): required host application with its own account, terms and licensing.
- [Hermes Agent](https://github.com/NousResearch/hermes-agent): separately downloaded official container image, pinned by digest. Its upstream license and bundled component terms apply.
- [MemSearch](https://github.com/zilliztech/memsearch): optional plugin obtained from its upstream marketplace, with its own license and runtime downloads.
- [GStack](https://github.com/garrytan/gstack): architectural reference for explicit skills, workflows and review. Brain4U's template does not vendor a GStack runtime.

`gbrain.yml` is a read-only indexing contract, not a bundled retrieval server. LLM Wiki is an architectural pattern implemented with Markdown and Git.

No third-party project's name implies sponsorship or a single license covering every dependency. Check upstream notices when redistributing downloaded components.

# Agentic software factory

Personal Cursor overlay on [pstack](https://github.com/cursor/plugins/tree/main/pstack) and [cursor-team-kit](https://github.com/cursor/plugins). Those plugins are the worker brain.

Install them in Cursor:

```
/add-plugin pstack
/add-plugin cursor-team-kit
```

Then run `/setup-pstack` if you have not already. This repo ships the model map in `.cursor/rules/pstack-models.mdc`. Cloud agent builds copy that file to `$HOME/.cursor/rules/` so pstack skills can read it.

Day to day: Plan Mode, build, parallel cloud agents, `/poteto-mode`.

`factory/` is a separate tree. It is not always-on agent context.

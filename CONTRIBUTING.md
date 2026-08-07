# Contributing to JØNEX

## Principles

- Submit working software rather than speculative scaffolding.
- Preserve platform and security boundaries.
- Keep local-first operation functional.
- Add tests for behavioral changes.
- Update documentation with implementation changes.
- Do not add tracking or remote dependencies without explicit review.
- Do not weaken plugin permissions to simplify an integration.

## Validate a change

```powershell
$ErrorActionPreference = 'Stop'
npm install
npm run check
npm run build
```

## Commit examples

```text
feat(telemetry): add network throughput sampling
fix(plugin-host): reject duplicate plugin identifiers
docs(plugin-sdk): document notification permission
test(shell): cover disabled widget filtering
```

## Pull request content

- Problem statement
- Implementation summary
- Security or permission impact
- Test evidence
- Documentation changes
- Screenshots for visible interface changes

Everything is unstable before version 1.0 unless explicitly marked stable.

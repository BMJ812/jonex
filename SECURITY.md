# Security Policy

JØNEX is pre-alpha software and must not yet be treated as a hardened
administrative control plane.

## Security-sensitive boundaries

- Plugin permissions
- Native command invocation
- Credential storage
- Remote access
- Container and virtual-machine control
- Home automation commands
- Filesystem access
- Process execution
- Update signing

Changes to these areas require explicit review, test coverage, and documented
threat analysis.

## Reporting

A useful report includes:

- Affected component and version
- Reproduction procedure
- Required privileges
- Expected and observed behavior
- Potential impact
- Proposed mitigation, when known

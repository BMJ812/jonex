# Validation Record

The packaged source was checked for:

- Valid JSON syntax across all `.json` files
- TypeScript/TSX parser acceptance
- Consistent JØNEX public branding
- ASCII-only `jonex` technical identifiers
- Absence of legacy project-name identifiers
- Complete source, documentation, CI, and PowerShell bootstrap structure

The packaging environment could not perform a full dependency install or Rust
build because its internal npm mirror did not contain the Tauri packages and
the environment did not include a Rust toolchain.

`Bootstrap-Jonex.ps1` performs the authoritative local validation:

```powershell
npm install
cargo fmt --all
npm run check
npm run build
```

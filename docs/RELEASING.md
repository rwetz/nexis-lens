# Releasing

Releases are built by [`.github/workflows/release.yml`](../.github/workflows/release.yml)
on GitHub-hosted Windows and macOS runners.

| Platform | Output | Runner |
| --- | --- | --- |
| Windows x64 | NSIS `…_x64-setup.exe` (per-user install) and `…_x64_en-US.msi` | `windows-latest` |
| macOS | `…_universal.dmg` + `.app` (Apple Silicon and Intel in one binary) | `macos-latest` |

## Cutting a release

1. Bump the version in **all three** manifests — the workflow fails fast if they disagree with the tag:
   - `package.json` → `version`
   - `src-tauri/Cargo.toml` → `version`
   - `src-tauri/tauri.conf.json` → `version`
2. Commit, then tag and push:
   ```bash
   git tag v0.2.0
   git push origin main v0.2.0
   ```
3. The workflow creates a **draft** release named `Nexis Lens v0.2.0` with the installers attached. Check it, edit the notes, publish.

To test the build without releasing, run **Actions → Release → Run workflow** on any branch. The installers are attached to the run as workflow artifacts.

## Signing

Without secrets the workflow still succeeds, but the builds are unsigned:

- **Windows:** SmartScreen shows "Windows protected your PC" — users have to click *More info → Run anyway*.
- **macOS:** Gatekeeper refuses to open the app. Users have to right-click → *Open*, or run `xattr -dr com.apple.quarantine "/Applications/Nexis Lens.app"`.

### macOS (Developer ID + notarization)

Needs an Apple Developer Program membership. Add these repository secrets
(*Settings → Secrets and variables → Actions*):

| Secret | Value |
| --- | --- |
| `APPLE_CERTIFICATE` | base64 of the exported *Developer ID Application* `.p12` (`base64 -i cert.p12 \| pbcopy`) |
| `APPLE_CERTIFICATE_PASSWORD` | password set when exporting the `.p12` |
| `APPLE_SIGNING_IDENTITY` | e.g. `Developer ID Application: Ryan Wetzstein (TEAMID)` |
| `APPLE_ID` | Apple ID email used for notarization |
| `APPLE_PASSWORD` | an [app-specific password](https://support.apple.com/102654) for that Apple ID |
| `APPLE_TEAM_ID` | 10-character team ID |

With the first three the app is signed; adding the last three also notarizes it.
The hardened runtime is on and `src-tauri/Entitlements.plist` grants
`com.apple.security.device.camera` — without that entitlement a signed build
gets no camera, and gesture tracking silently sees nothing.

### Windows (Authenticode)

Not wired up yet. The cheapest current route is **Azure Trusted Signing**:

1. Create a Trusted Signing account and certificate profile in Azure, and a service principal with the *Trusted Signing Certificate Profile Signer* role.
2. Add `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID` as secrets and expose them to the build step.
3. Set `bundle.windows.signCommand` in `tauri.conf.json` to call `trusted-signing-cli` (install it in the workflow with `cargo install trusted-signing-cli`).

An OV/EV certificate on a hardware token also works, but cannot be used from a hosted runner.

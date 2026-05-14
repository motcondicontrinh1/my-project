# Install the Bundled Skill

This bundle includes the reusable Codex skill at:

```text
skills/html-review-artifacts
```

To make `$html-review-artifacts` available in Codex, copy that folder into your Codex skills directory:

```powershell
$source = ".\skills\html-review-artifacts"
$target = "$env:USERPROFILE\.codex\skills\html-review-artifacts"
New-Item -ItemType Directory -Force -Path (Split-Path $target) | Out-Null
Copy-Item -LiteralPath $source -Destination $target -Recurse -Force
```

After installing, open a project that contains this bundle's `AGENTS.md`, `DESIGN.md`, and `styles.css`. Future HTML review requests can use:

```text
Use $html-review-artifacts to create a browser-openable HTML review artifact.
```

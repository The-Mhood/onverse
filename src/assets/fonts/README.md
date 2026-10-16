# Reviewed self-hosted typography assets

Engineering review: **2026-10-15**, COORD-006. These are assets for Slice A, not an npm dependency installation or a claim that the current interface has already stopped requesting Google Fonts.

## Concrete option A mapping

The owner approved **self-hosted delivery**. No independently published historical option-A family specification was available to the lead; do not invent one. For this implementation, option A maps to the existing verifiable families, delivered locally:

| Role | Family / reviewed files | Weights |
| --- | --- | --- |
| Brand / occasional display | Orbitron, `orbitron-latin-wght-normal.woff2` | Variable 400–900; current headings use 500/700/800/900 |
| Interface / readable labels | Rajdhani, `rajdhani-latin-{400,500,600,700}-normal.woff2` and corresponding `latin-ext` files | 400/500/600/700 |
| Numbers / technical readouts | Share Tech Mono, `share-tech-mono-latin-400-normal.woff2` | 400 |

Use system sans-serif/monospace fallbacks for missing glyphs. These subsets are not complete multilingual coverage; never replace untrusted imported names with transliteration or lose characters to fit a font. Rajdhani latin-ext faces need the matching Fontsource unicode ranges (see the pinned source package CSS) rather than declaring two competing full-range faces. Display type is not a requirement for dense essential controls.

## Provenance and licence/dependency review

`manifest.json` pins all three Fontsource packages at **5.3.0**, their registry tarball URLs and SHA-512 integrity, each extracted member, byte length and SHA-256. Tarballs were downloaded outside the repository, their bytes checked against registry integrity, and only regular WOFF2/licence members copied. No package scripts or new dependency were installed; package.json and package-lock.json are unchanged. Registry attestations/signatures and a binary security audit are **not** claimed. Magic bytes were checked; browser font rendering is still to be tested.

The complete copyright notices and **SIL Open Font License 1.1** are retained in `orbitron-OFL.txt`, `rajdhani-OFL.txt`, and `share-tech-mono-OFL.txt`. OFL permits bundling/embedding with software with the notices/licence retained; the fonts cannot be sold by themselves or relicensed. Share's reserved-name restriction matters if modifying fonts; these files are unchanged from the pinned distributions. This is an engineering licence review, not external legal certification.

## Integration and distribution obligations

- Use Vite explicit `?inline` URLs for WOFF2 in CSS (`url('./orbitron-latin-wght-normal.woff2?inline')`), not a CDN, absolute public path or a binary-relative URL left over after CSS is moved into HTML.
- Import the complete three OFL texts using `?raw` and expose an accessible **Font licences** notice in the UI. The final single-file HTML must contain those texts, not just repository links or tree-shaken unused imports. Desktop packaging includes dist, not this source directory. Preserve notices also when redistributing font files separately.
- Slice A removes Google Fonts preconnect/stylesheet declarations in index.html and any runtime font CDN imports. Do not claim offline fonts before verifying that actual diff/build/network behavior.
- A scratch build with the installed Vite and the existing production inliner algorithm preserved a real inline WOFF2, a local PNG and full raw OFL text with no external script/style/font/texture URL. This is artifact-level packaging evidence, **not** browser/file:// or Electron runtime proof. No build script/config change was needed.
- Check the final Slice A build for data URLs, complete notices, no runtime font/texture fetch, readable fallback glyphs and actual file:// loading. Report unavailable browser/Electron checks honestly.

## Verification

From the repository root, without a dependency installation:

```bash
python3 - <<'PY'
import hashlib, json
from pathlib import Path
root = Path('src/assets/fonts')
for package in json.loads((root / 'manifest.json').read_text())['packages']:
    for file in package['files']:
        data = (root / file['path']).read_bytes()
        assert len(data) == file['bytes']
        assert hashlib.sha256(data).hexdigest() == file['sha256']
        assert file['path'].endswith('.txt') or data[:4] == b'wOF2'
print('All vendored font and licence hashes match')
PY
```

To reproduce acquisition, fetch each manifest tarball into a scratch directory, verify the full SHA-512 integrity before opening it, then read only the listed regular `sourceMember` entries. Never blindly extract a tarball into the checkout. Upgrades, modifications and extra font/dependency acquisitions require a new scoped review.

## Sora (COORD-010 resolution 6213314954, 2026-10-16)

- Package: `@fontsource-variable/sora` 5.3.0, licence OFL-1.1 (copyright The Sora Project Authors). Tarball SHA-256 `e0cff41b28e72b9441c7c599c310a9e4f13d44ac87d8d534746d50d6fbe9d726`; npm integrity `sha512-h8kHta4Z8SkfUGeI82TUy1n3rbrKpBRGwuk4t4qCwto5oEHxlbOFD2yGP+Df5fbmTXwKGn+o667vYp0E4K8Whw==`.
- Vendored unmodified: `sora-latin-wght-normal.woff2` (weights 100–800), `sora-latin-ext-wght-normal.woff2`, and `sora-OFL.txt` (from `package/LICENSE`). Hashes are in `manifest.json`.
- Used as the first family in `--pf-font-display` and `--pf-font-ui`. Orbitron, Rajdhani and Share Tech Mono stay in the stacks as fallbacks.
- No npm dependency was added; the package was fetched only for review and the files were copied from it.

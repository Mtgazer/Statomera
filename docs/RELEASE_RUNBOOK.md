# STATOMERA public beta release runbook

The candidate is a static Cloudflare Pages Free Direct Upload on the provided `pages.dev` subdomain. Use the portable build. Keep the DuckDB builds as local reference artifacts. The web app requires zero backend services, paid dependencies, accounts, or analytics. [Direct Upload and limits](https://developers.cloudflare.com/pages/get-started/direct-upload/) · [Static pricing](https://developers.cloudflare.com/pages/functions/pricing/#static-asset-requests)

## Prepare and retain the artifact

From the approved clean checkout, install locked dependencies and build locally. These commands need Node.js 22.18 or newer, npm, Python 3.9 or newer, `sha256sum`, and `unzip`.

```sh
npm ci --ignore-scripts
npm run build:portable
release_dir=$(mktemp -d "${TMPDIR:-/tmp}/statomera-release.XXXXXX")
python3 scripts/package-portable.py "$release_dir/statomera-portable.zip"
(cd "$release_dir" && sha256sum statomera-portable.zip > SHA256SUMS)
(cd dist-portable && find . -type f -print0 | LC_ALL=C sort -z | xargs -0 sha256sum) > "$release_dir/ASSET-SHA256SUMS"
```

Use a durable local location for the ZIP and both checksum files. Keep a `BUILD-INFO.txt` with the full source commit, clean-tree status, tool versions, build command, lockfile SHA-256, file count, total and largest file sizes, and ZIP SHA-256. The ZIP contains the files inside `dist-portable/` at its root, including `_headers` and `third-party-notices.txt`. Upload only that ZIP after approval. The dashboard Direct Upload limit is 1,000 files and 25 MiB per asset. The packaging command enforces these limits and excludes reference binaries, source maps, and server files. [Direct Upload limits](https://developers.cloudflare.com/pages/get-started/direct-upload/#limits)

## Verify and restore locally

```sh
(cd "$release_dir" && sha256sum -c SHA256SUMS && unzip -t statomera-portable.zip)
restore_dir=$(mktemp -d "${TMPDIR:-/tmp}/statomera-restore.XXXXXX")
unzip -q "$release_dir/statomera-portable.zip" -d "$restore_dir"
(cd "$restore_dir" && sha256sum -c "$release_dir/ASSET-SHA256SUMS")
npm run preview:portable -- --host 127.0.0.1 --outDir "$restore_dir"
```

Check the restored file list before serving it. Open the loopback preview and verify CSS and logo delivery, the notices link, and a known CSV, JSON, and XLSX import. Confirm the salary fixture mean of 20. Keep the actual `_headers` in the archive. Vite injects the matching header policy for loopback previews. A separate loopback TLS check can serve the restored archive with its `_headers` parsed and applied to simulate HTTPS. Local checks establish archive integrity and app behavior. Cloudflare’s header handling and certificates still require hosted verification. [Pages headers](https://developers.cloudflare.com/pages/configuration/headers/)

## After separate founder authorization

1. Confirm the approved name, free host and operator, feedback recipient and retention, test evidence, public exposure approval, and rollback target. Preview URLs are public by default. Obtain separate approval for any Cloudflare preview or production upload. Use a free controlled test setup or a preview whose audience the founder has approved. [Preview access](https://developers.cloudflare.com/pages/configuration/preview-deployments/#customize-preview-deployments-access)
2. Use the dashboard Direct Upload flow and the exact verified ZIP on the free `pages.dev` subdomain. Record the resulting deployment ID, URL, and archive hash together. Keep Functions and analytics disabled. Direct Upload and Git integration are distinct project types. [Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/)
3. Check anonymous HTTPS access, root and worker CSP, `nosniff`, `no-referrer`, and HTML, JavaScript, CSS, SVG, and notices response types. Verify old and fresh clients load the expected assets and that imports, questions, and reports make only same-origin static GETs with no dataset payload or storage writes. Verify the reviewed feedback flow and the release device checks before inviting pilot users.
4. For a privacy, numerical, or availability regression, pause the rollout. On an existing Pages project, use **Rollback to this deployment** to recover a previous successful production deployment. Preview deployments cannot be rollback targets. On a first launch, retain a separately approved verified fallback archive and use Direct Upload if there is no eligible prior production deployment. Verify the restored deployment against its artifact and repeat the hosted smoke checks before reopening access. [Cloudflare rollbacks](https://developers.cloudflare.com/pages/configuration/rollbacks/)

## Feedback and current archive status

The bilingual feedback link discloses `uktbli.eg@gmail.com` and retention of 12 months from receipt. The inbox operator applies this policy. No automatic deletion runs in the app. Activating the link opens an editable email draft with the fixed subject `STATOMERA Feedback` and an empty body. The user chooses whether to send in their mail client. The link carries no dataset data, attachments, filename, question, result, or diagnostics. Verify the destination and empty draft by intercepting the link in browser tests. Keep the email client closed during automated verification.

The retained ZIP and checksum still identify the verified pre-feedback build at `31a2093a6a5b4b40c800f2ef5db8630b35c066e7`. Rebuild and package the feedback-enabled source into a new archive, generate new archive and file checksums, record its commit, and verify restoration and loopback responses before offering it for independent QA or hosted approval.

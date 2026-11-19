# Security principles

Treat the file picker, file contents, filenames, column labels, question text, worker messages, model outputs and exports as trust boundaries. Keep datasets and derived results on-device by default. Feedback transmits only the fields shown at submission. Obtain separate consent and explain destination, purpose and scope before any future remote processing.

- Validate format and parse bounded input. Enforce caps on input bytes, records, columns, field length, expanded bytes and result size. Stop work when time or quota runs out. Reject unsupported archive features and handle cancellation and resource cleanup.
- Render dataset text with safe text APIs, including previews, chart tooltips and report labels. Treat formulas as inert data on import. Design spreadsheet-safe exports and test the chosen quoting and neutralization policy with supported spreadsheet readers.
- Accept only registry operations and validate revision, field IDs, types, eligibility and budgets. Bind data values, generate internal identifiers and permit only reviewed code or SQL templates. Disable unneeded external access, extensions and network loaders. Use restrictive CSP for both app and worker and verify the deployed behavior. A worker provides responsiveness and termination, with browser origin isolation and CSP as separate controls.
- Keep local AI optional. Pass minimal schema context and treat dataset text and model output as untrusted. Require intent validation before execution. Keep secrets out of front-end bundles and all datasets, prompts and result values out of logs by default.
- Serve pinned same-origin scripts and assets over HTTPS. Audit dependencies and licenses, review CI permissions and artifacts, and verify app-shell cache updates. Store user data only by deliberate, reviewed design with clear deletion controls.
- Use synthetic regression fixtures for malformed files, inert text, fixed-operation enforcement, budget limits and outgoing-request checks. Track findings privately until remediation. Pause rollout for privacy or correctness regressions and redeploy the last verified artifact.

## Public beta candidate

The portable archive ships a browsable third-party notices file. Verify the current lockfile against package advisories and the actual portable dependency inventory before approving a release. Keep `_headers` at the root of the upload. Verify the CSP, expected content types, `nosniff`, and `no-referrer` on both the app and worker responses after hosting is approved. [Release runbook](RELEASE_RUNBOOK.md)

The interface distinguishes in-tab dataset processing from ordinary app asset requests to the host, which can include the visitor’s IP address. The candidate has no feedback endpoint or email link. Adding a link requires a founder-approved recipient and retention disclosure. The link may open an editable draft only on user action and must carry no dataset, filename, question, result, or diagnostic data.

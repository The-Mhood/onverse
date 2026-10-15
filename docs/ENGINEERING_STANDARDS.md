# Engineering Standards

These are the minimum standards for extending MusicOnVerse toward a professional creative application.

## Change strategy

- Prefer small, reversible changes to large rewrites.
- Preserve the existing workflow unless a ticket explicitly changes it.
- Every feature must define behavior, failure cases, tests and acceptance criteria before implementation.
- Keep domain rules independent of the DOM, Electron IPC and AI provider SDKs.
- Use a service/adapter boundary when wrapping existing modules; do not prematurely split into network microservices.

## Audio correctness

- Never overwrite the user's source file by default.
- All renders must declare sample rate, channel layout, bit depth/encoding, target loudness where applicable, and peak ceiling.
- Distinguish estimated metrics from standards-validated measurements.
- Use level-matched A/B comparisons when evaluating tonal or dynamics changes.
- Avoid discontinuities at region boundaries; test fades/crossfades and short clips.
- Long operations must report progress, support cancellation where practical, and release buffers/object URLs/resources.
- Audio-thread work must avoid blocking, unnecessary allocation, network calls and UI operations.
- Do not describe a stereo mix as independently editable stems.

## AI command safety

- AI output is untrusted data.
- Use versioned, operation-specific schemas with numeric bounds and explicit units.
- Validate target IDs, permissions, processor capabilities, time ranges and estimated cost.
- The AI must not execute arbitrary code or directly access files, shell commands, credentials or unrestricted network tools.
- Preview before commit; keep undo data for accepted edits.
- Ask for clarification when the target source or desired result is ambiguous.
- Require explicit approval for destructive edits, cloud uploads, paid jobs and overwriting exports.

## Desktop security

- Keep Electron context isolation, sandbox and disabled Node integration.
- Expose only narrow preload APIs and validate IPC payloads on both sides.
- Use secure OS storage for credentials.
- Validate imported paths and project archives against traversal and malformed data.
- Configure a restrictive Content Security Policy appropriate to the chosen bundle strategy.
- External links open in the system browser, never as trusted in-app pages.
- Disable production auto-update until the release feed, signing and update verification are configured.

## Repository hygiene

- Never commit API keys, signing keys/certificates, private audio, account exports, local env files, or release credentials.
- Commit lockfiles; don't commit `node_modules`, generated release installers or machine-specific files.
- Use example environment files with placeholder values only.
- Keep build outputs reproducible from source.
- Review dependency licenses and plugin licensing before distribution.

## Definition of done

A feature is done when:
1. It has a clear user outcome and documented limitation.
2. It works on a clean install and on supported target hardware.
3. Success, loading, empty, error and cancellation states are handled.
4. Tests cover core logic and regression-prone paths.
5. Audio changes are previewable and reversible unless explicitly destructive.
6. Accessibility, keyboard behavior and performance are considered.
7. Security/privacy and cloud-cost implications are documented.
8. Documentation and release notes are updated.

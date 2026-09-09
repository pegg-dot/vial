# Security Policy

Security is part of the VialGrade product, but no software should be described as perfectly secure.

## Reporting a vulnerability

Please do **not** open a public GitHub issue containing exploit details, credentials, private data, or a working proof of concept against the production service.

If GitHub private vulnerability reporting is available in the repository's **Security** tab, use that channel. Otherwise, contact the repository owner privately through GitHub. If no private channel is available, open a minimal issue asking for a private contact method without including technical exploit details.

A useful report should include the affected area, the potential impact, and the minimum information needed to reproduce the problem safely. Remove unrelated personal data, credentials, and session material from screenshots or logs.

There is no bug-bounty commitment unless one is explicitly announced.

## Testing boundaries

Good-faith research should stay on systems owned by VialGrade and should avoid harming availability, integrity, or other users.

Please do not:

- access, alter, or delete another user's data
- perform denial-of-service or high-volume load testing
- use VialGrade to probe third-party vendors, laboratories, or unrelated infrastructure
- publish secrets, session material, private vulnerability details, or sensitive production data
- socially engineer users, vendors, laboratories, or operators

Third-party sites referenced by VialGrade are not in scope merely because the product links to or researches them.

## Security posture

At a high level, VialGrade is designed around:

- authenticated and permissioned operational surfaces
- separation between public, preview, test, and production environments
- automated release, dependency, and access-control checks
- defensive handling of untrusted external content and uploaded material
- source provenance and review boundaries for published information
- fail-closed behavior for security-sensitive production configuration

Implementation details are intentionally not documented here as a public hardening guide.

## Secrets

Production credentials and signing material do not belong in source control. If a credential is ever exposed, removing it from a later commit is not sufficient; it should be revoked or rotated and the exposure window assessed.

## Incident handling

If a credible production security issue is discovered, the priority is to contain the affected capability, rotate or revoke exposed credentials where applicable, preserve relevant evidence, fix the underlying boundary, and add regression coverage before normal operation resumes.

Thank you for reporting issues responsibly.
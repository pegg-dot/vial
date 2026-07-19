# VIAL 0.2 Release Notes

Version 0.2 converts the visual prototype into a functioning provenance application.

## Demonstrable workflow

1. Sign in as a staff administrator or reviewer.
2. Capture a controlled source and select its canonical listing.
3. Run the deterministic tool loop.
4. Inspect each proposed atomic change.
5. Approve or reject the selected claim.
6. Inspect the publication receipt.
7. Open the public product page and see the published field.

## Local staff access

In development only:

```text
Administrator token: vial-admin
Reviewer token: vial-reviewer
```

Production requires explicit environment tokens and a session secret.

## Important limitation

The workflow accepts staff-supplied source content. It does not yet fetch external pages. This is deliberate. The next release should add safe fetching, schedules, retries, parser profiles, and accuracy benchmarks without weakening the human publication gate.

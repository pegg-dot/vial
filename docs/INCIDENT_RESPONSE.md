# VIAL incident response

## Severity

- SEV-1: confirmed unauthorized access, financial corruption, broad outage, or secret exposure
- SEV-2: material degradation, isolated tenant exposure, stalled publication pipeline, or reconciliation variance
- SEV-3: limited defect with a workaround and no sensitive exposure

## Immediate actions

1. Open an incident record and assign an incident commander.
2. Preserve request IDs, security events, application logs, and database evidence.
3. Disable affected feature flags or routes.
4. Revoke compromised sessions and rotate affected secrets.
5. Pause publication, refresh, payout, or commerce workflows when integrity is uncertain.
6. Verify database and ledger invariants before restoring writes.

## Identity incident

- Revoke affected sessions in `auth_sessions`.
- Review `auth_login_attempts` and `security_audit_events`.
- Rotate the session secret only with a coordinated global logout.
- Review staff permission assignments and recent privileged actions.

## Data integrity incident

- Stop mutations.
- Capture a database backup before repair.
- Compare publication receipts, causal roots, and ledger entries.
- Restore from a verified backup if integrity cannot be proven.
- Run reconciliation and source-lineage checks before reopening writes.

## Source or agent incident

- Disable the source policy or agent workflow.
- Preserve the immutable snapshot and tool-call receipts.
- Revert unsupported public claims through a reviewed correction.
- Add the failure case to the evaluation dataset.

## Recovery criteria

- Root cause identified or safely contained
- Unauthorized sessions revoked
- Data and financial invariants pass
- Readiness and critical queues are healthy
- Required customer, seller, or regulator notifications are approved
- A follow-up owner and deadline are assigned

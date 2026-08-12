# VialGrade 6.0 evidence and laboratory network

## Purpose

VialGrade 6.0 connects market evidence to controlled laboratory work. The system does not treat a PDF, a laboratory name, or a vendor-selected sample as universal proof. It records exactly which method was used, which physical sample was tested, who controlled the sample, how custody changed, what result was approved, which report version carries it, and what remains unknown.

## Core graph

```text
Laboratory profile
  ├─ team and permissions
  ├─ quality-system and accreditation claims
  └─ method registry
       ↓
Testing program / test order
       ↓
Sample kit and physical sample
       ↓
Append-only custody events
       ↓
Analytical run
       ↓
Structured reviewed result
       ↓
Versioned laboratory report
       ↓
Batch passport evidence link
       ↓
Public dimensions, conflicts, limitations, and history
```

## Laboratory competence

Competence is represented by method, not by a universal laboratory badge. Each method includes:

- Stable method identifier and version
- Technique
- Analytes and matrices
- Evidence dimensions addressed
- Result units
- Detection and quantitation limits where applicable
- Measurement uncertainty where applicable
- Validation state
- Standard references
- Whether the method is recorded as inside the laboratory's declared accreditation scope

A laboratory profile may contain methods both inside and outside its declared scope. The public interface keeps those states visible.

## Sampling hierarchy

VialGrade distinguishes evidence by sample control:

| Level | Meaning |
|---|---|
| D0 | Vendor-uploaded document only |
| D1 | Issuer-confirmed document |
| S1 | Vendor-selected physical sample |
| S2 | Customer-submitted sealed sample |
| S3 | Blind independent purchase |
| S4 | Multiple independently sourced samples agree |
| S5 | Continuous surveillance and repeated agreement |

The hierarchy describes provenance and representativeness confidence. It does not determine product safety.

## Chain of custody

Every custody event records:

- Sample
- Sequence number
- Event type
- Actor type and identifier
- Location
- Timestamp
- Structured metadata
- Previous event hash
- Current event hash
- Root event identifier

The hash payload uses deterministic key ordering and exact ISO timestamps. Verification recomputes every event in order. Changed metadata, missing events, reordered events, or altered previous hashes invalidate the chain.

The custody chain is append-only at the application layer. Corrections should be represented as additional events rather than overwriting history.

## Analytical work

An analytical run links:

- Test order
- Sample
- Method version
- Instrument and identifier
- Analyst and reviewer
- Raw-data hash
- System-suitability record
- Deviations
- Start, completion, and review times

Structured results preserve numeric or categorical values, units, qualifiers, specifications, conclusions, uncertainty, detection limits, review state, and metadata. Failing or conflicting results remain in the evidence graph.

## Report lifecycle

Reports are immutable versions. A correction creates a new version and supersedes the prior version. Revocation changes lifecycle state without deleting the report or its events.

Lifecycle events include:

```text
issued → superseded
issued → revoked
superseded → historical
```

Public verification can resolve a report identifier or report version and expose its current status.

## Batch passports

A batch passport is a living evidence record for a declared batch. It links reports and structured results into separate dimensions such as:

- Identity
- Purity or related-substance profile
- Declared quantity
- Sterility
- Endotoxin
- Particulates
- Sampling provenance

Each dimension can be established, conflicting, unknown, revoked, or unsupported. Conflicts are stored as first-class records and are never averaged away merely to produce a cleaner score.

A passport includes:

- Declared batch code
- Vendor, product, listing, and seller-batch relationships when available
- Sampling level
- Evidence confidence
- Current report and complete report history
- Dimension-level observations
- Open conflicts
- Known limitations
- Last evidence and publication timestamps
- Sample custody history

## Independent testing programs

Testing programs define:

- Sponsor type and identity
- Sampling model
- Subject
- Target and collected sample counts
- Funding target and collected funding
- Required dimensions
- Public summary
- Root provenance event

Production programs would require documented sampler identity, purchasing controls, sample-kit logistics, payment handling, and laboratory agreements. V6 provides the internal architecture and fictional sandbox program only.

## Laboratory APIs and MCP

Session-authenticated APIs support laboratory users. Scoped bearer APIs support external laboratory systems. Tokens are laboratory-scoped, permission-scoped, hashed at rest, revocable, and auditable.

The Laboratory MCP exposes six tools:

- `get_lab_status`
- `list_test_orders`
- `list_methods`
- `get_sample_custody`
- `prepare_result_proposal`
- `prepare_report_draft`

The two write-capable tools create proposals only. They cannot approve a result, issue or revoke a report, or publish a passport.

## Authority boundaries

Conventional permissioned code controls:

- Laboratory identity
- Team membership
- Accessioning
- Custody event append
- Result review state
- Report issuance and revocation
- Passport publication
- Public status
- Token scope

AI and MCP tools may help structure or prepare work, but they do not hold report-signing or publication authority.

## Production gates

Before real use, VialGrade would need:

- Direct laboratory agreements
- Verified legal entity and authorized representatives
- Accreditation and scope verification where claimed
- Method validation and change-control review
- Quality-system and data-integrity review
- Secure raw-data retention
- Calibrated instrument and reference-standard records
- Sampler identity and logistics controls
- Real object storage and malware scanning
- Privacy and retention policies
- Contractual correction and revocation procedures
- External security review

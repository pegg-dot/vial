# VialGrade 5.0 commerce architecture

## Objective

VialGrade 5 converts the earlier commerce simulator into a processor-ready architecture while preserving a fail-closed launch boundary. Payment creation is the final step after policy evaluation, not the first step in eligibility.

## Independent activation gates

Every checkout evaluates and persists a versioned decision across:

1. Commerce environment and provider mode
2. Seller agreement and marketplace standing
3. Provider account onboarding and capabilities
4. Underwriting status and expiry
5. Listing and SKU policy state
6. Customer type
7. Buyer and shipping jurisdiction
8. Evidence requirements
9. Inventory and reservation state
10. Fraud decision
11. Tax-liability model
12. Charge model and merchant of record

An unknown or failed required check prevents payment creation. Review outcomes can proceed only in the self-contained sandbox; test and live modes hold them.

## Merchant and charge models

### Direct charge

Used when one approved seller owns the cart. The payment is associated with that seller's connected provider account, the seller is modeled as merchant of record, and VialGrade records an application fee. VialGrade does not create a second platform transfer or platform reserve for this model.

### Platform separate charge and transfers

Used for multi-seller carts in sandbox and test mode. VialGrade creates one platform payment, seller allocations, provider transfers, and risk-based reserves. The platform is modeled as merchant of record.

The current live policy blocks this platform merchant model until external underwriting, legal, tax, reserve, dispute, and loss-allocation approval exists.

## Two-stage checkout lifecycle

```text
Activation decision
→ fraud and tax decisions
→ inventory reservation
→ prepared checkout attempt
→ provider payment intent
→ customer authentication when required
→ verified provider event
→ atomic order finalization
→ seller allocation and settlement
```

Mock payments can succeed synchronously. Stripe test payments may return `requires_action` or `processing`; the client renders Payment Element and polls only for status. The order is created by the verified provider-event path, not by trusting the browser.

## Webhook finalization

A provider event is accepted only after signature verification. VialGrade stores the provider event ID under a unique constraint, suppresses duplicates, and processes supported event types idempotently.

`payment_intent.succeeded`:

- Marks the provider intent succeeded
- Locks the prepared checkout attempt
- Verifies the inventory reservation is active
- Creates one order and seller-specific order lines
- Writes shipments and financial ledger entries
- Consumes the reservation and inventory
- Converts the cart
- Allocates seller transfers and reserves

`payment_intent.payment_failed`:

- Marks the provider intent failed
- Marks the checkout attempt failed
- Releases reserved inventory
- Creates no order

Replay is permitted only for signature-verified events and reuses the same idempotent processing path.

## Provider abstractions

`PaymentProcessorAdapter` defines:

- Connected account creation
- Hosted or embedded onboarding session creation
- Capability synchronization
- Payment intent creation
- Refund creation
- Transfer creation
- Signed event verification

`TaxProviderAdapter` and `FraudProviderAdapter` separately own tax and risk decisions. Provider output is persisted rather than flattened into an order record.

## Financial records

VialGrade keeps independent records for:

- Provider payment intents
- Provider transfers
- Reserve holds and releases
- Tax transactions and liable party
- Fraud decisions and rule version
- Ledger entries
- Refunds and disputes
- Settlement runs and variance

Idempotency keys are unique at payment and transfer boundaries. One seller/order reserve record is unique. Reconciliation compares expected commerce state against the ledger and provider-facing records.

## Environment safety

Modes are separate:

```text
sandbox
 test
 live
```

Stripe requires secret, publishable, and webhook keys. Test mode requires test keys. Live keys are rejected outside live mode. Live mode requires:

- Explicit enable flag
- Exact human acknowledgement value
- Stripe provider
- Live secret and publishable keys
- Valid webhook secret
- Policy approval for every seller, SKU, customer type, jurisdiction, and merchant model

No global UI switch can override these gates.

## Current limits

- No production credentials are included.
- No real seller or product has processor or legal approval.
- Multi-seller platform-MoR live commerce remains blocked.
- Tax and fraud are deterministic mock providers unless replaced.
- Real refund transfer reversals, provider balance behavior, disputes, and reserve economics require test-mode and underwriting validation.
- Physical-product quality is outside the payment architecture.

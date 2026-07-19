# VIAL 5.0 release notes

## Approved commerce architecture

VIAL 5.0 connects the existing carts, orders, inventory, returns, disputes, payouts, and ledger to an approval-gated provider layer. The release remains sandbox and test oriented; it does not activate real transactions.

## Policy before payment

A checkout now persists a versioned decision covering seller standing, provider capabilities, underwriting, SKU status, evidence, customer type, destination, inventory, fraud, tax liability, charge model, and merchant of record.

## Provider modes

- `sandbox`: self-contained mock payment, tax, and fraud providers
- `test`: processor test credentials and signed test events
- `live`: disabled unless independent environment and policy gates pass

## Seller payments

Sellers can view provider-account readiness, onboarding requirements, capabilities, underwriting state, and test onboarding sessions from `/seller/payments`.

## Staff control plane

V5 adds:

- `/admin/underwriting`
- `/admin/activation`
- `/admin/settlements`
- `/admin/provider-events`

These surfaces separate underwriting, activation, event processing, and finance responsibilities.

## Async checkout

V5 supports Payment Element for Stripe test mode. A pending provider payment does not create an order. A signed `payment_intent.succeeded` event atomically finalizes the prepared checkout. A signed failure releases inventory. Duplicate and replayed events do not duplicate orders.

## Settlement

Single-seller direct charges avoid unnecessary platform transfers. Multi-seller platform payments create seller allocations, provider transfers, and risk-based reserve records. Settlement runs expose gross, refunds, disputes, reserves, seller payable, platform revenue, variance, and issues.

## Security improvements

- Stripe webhook secret is mandatory in Stripe mode.
- Seller sessions cannot enter customer account, cart, checkout, or order pages.
- Checkout email is bound to the authenticated customer account.
- Live credentials are rejected outside live mode.
- Live activation requires multiple independent environment gates.

## Boundary

All data and transactions remain fictional or test mode. Production launch still requires processor underwriting, participating seller agreements, legal SKU and jurisdiction approval, tax determination, fraud operations, insurance, and production credentials.

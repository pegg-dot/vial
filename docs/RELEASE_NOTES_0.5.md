# VIAL 0.5 — Commerce Sandbox

VIAL 0.5 implements the complete test-mode marketplace transaction skeleton without enabling real payments or product sales.

## Included
- Mock Connect-compatible payment-provider abstraction
- Participating seller accounts and capability states
- Per-listing commerce eligibility
- Database-backed carts and multi-seller shipping
- Server-side eligibility recheck before payment
- Idempotent checkout attempts
- Order and seller line splitting
- Immutable finance ledger
- Refund and dispute domain records
- Customer, seller, and administrator commerce interfaces

## Explicit limitation
No real card data is collected. No production processor is connected. All products, companies, accounts, orders, and transactions remain fictional sandbox data.

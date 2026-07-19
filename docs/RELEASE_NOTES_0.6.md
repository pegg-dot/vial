# VIAL 0.6 Commerce Operations

VIAL 0.6 closes the operational gaps after checkout. It adds inventory reservations, tax and risk records, shipments, returns, refunds, disputes and evidence, webhook replay, and financial reconciliation. The payment provider remains a mock adapter and production activation remains impossible by design.

## New routes

- `/account/orders/[id]/return`
- `/admin/returns`
- `/admin/fulfillment`
- `/admin/inventory`
- `/admin/risk`
- `/admin/webhooks`
- `/admin/reconciliation`
- `/api/v1/commerce/returns`
- `/api/v1/commerce/refunds`
- `/api/v1/commerce/shipments`
- `/api/v1/commerce/disputes`
- `/api/v1/commerce/disputes/evidence`
- `/api/v1/commerce/webhooks`
- `/api/v1/commerce/reconciliation`

## Verification

- ESLint passed
- 12 tests passed
- Production build passed
- End-to-end commerce operations integration test passed

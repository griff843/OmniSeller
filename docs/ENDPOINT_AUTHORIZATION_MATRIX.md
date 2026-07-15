# Endpoint authorization matrix

All non-health API requests require both the server-only `x-omniseller-internal-secret` and a current, enabled user identified by `x-omniseller-user-id`. The browser never supplies either header directly; authenticated Next.js route handlers add them. Missing, unknown, or disabled identities receive `401`. Object enumeration receives `404`.

| Endpoint | Ownership and validation | Rate limit | External side effect / idempotency |
| --- | --- | --- | --- |
| `GET /health/live` | Public; no data | None | None |
| `GET /health/ready` | Public; returns dependency names, not credentials | None | PostgreSQL/Redis probes only |
| `GET /`, `/health`, `/api/docs` | Internal identity required | None | None |
| `GET /inventory`, `/inventory/bins` | Current user's rows only; query DTO allowlist | None | None |
| `POST /inventory` | Creates for current user; DTO lengths | None | Local DB write; SKU unique |
| `GET/PATCH /inventory/:id` | `InventoryItem.userId` must match; DTO enum/length validation | None | Local DB write |
| Inventory photo POST/DELETE routes | Parent item and photo ownership; MIME, 15 MB, complete-set ordering | 30/min for reservation/completion | Tenant-prefixed key; reservation IDs unique; stale cleanup repeat job |
| Listing draft and AI workspace routes | Parent inventory ownership; DTO/schema validation | 10/min for generation | AI optional; suggestions immutable and drafts editable |
| `POST /listings/:id/publish` | Parent ownership and readiness | 5/min | Atomic state claim and deterministic Bull job ID prevent concurrent publication |
| `GET /ebay/authorize`, `/callback`, `/status` | Current user; web callback also validates HttpOnly OAuth state | None | OAuth exchange upserts one user's account; tokens encrypted |
| `POST /ebay/orders/sync` | Current user's eBay account | 12/min | Provider-order and line-item unique keys; serializable upsert; overlapped checkpoint |
| `GET /orders`, `/orders/:id` | Marketplace account must belong to current user | None | None |
| `POST /shipping/rates` | Order marketplace account ownership; address/parcel DTOs | 30/min | EasyPost timeout; no local shipment until purchase |
| `POST /shipping/purchase` | Order ownership; DTO validation | 10/min | Unique `(orderId,idempotencyKey)` claim prevents concurrent label purchase |
| `POST /shipping/:id/void` | Shipment → order → account ownership | None | Already-voided returns persisted result; provider failure remains recoverable |
| `GET /shipping/order/:id` | Order ownership | None | None |

Production authentication attempts are handled and rate-limited by Auth0. Development credentials do not exist in the production provider list. API-side limits use atomic Redis `INCR`/`EXPIRE` and fail closed when Redis is unavailable in production.

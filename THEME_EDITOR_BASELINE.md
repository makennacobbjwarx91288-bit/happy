# Theme Editor Baseline (Do Not Break)

This document defines the current production behavior that must remain intact while implementing a stronger self-use theme editor.

## 1) Scope and Rule

- Goal: add stronger storefront customization.
- Hard rule: existing checkout, admin review, risk control, account/permission, and multi-shop behavior must not regress.
- Strategy: keep old behavior as default, introduce new editor/render path behind store-level feature flag and versioned schema.

## 2) Current Frontend Route Baseline

### Store routes

- `/` home
- `/checkout`
- `/verify-coupon`
- `/verify-sms`
- `/verify-pin`
- `/product/:id`
- `/order-confirmation/:orderId`
- `/shop`, `/deals`, `/beard`, `/hair`, `/body`, `/fragrances`, `/bundles`
- Compatibility aliases: `/category/beard`, `/category/hair`, `/category/body`, `/category/fragrances`
- Support: `/contact`, `/shipping`, `/returns`, `/faq`
- Company: `/about`, `/blog`, `/careers`, `/press`
- Fallback: `*` -> NotFound

### Admin routes

- `ADMIN_PATH` (login)
- `ADMIN_PATH/dashboard`

Admin path source of truth:
- `__ADMIN_PATH__` (build-time) -> `VITE_ADMIN_PATH` -> `/manage-admin`

## 3) Current Backend API Baseline

### Health and public

- `GET /api/health`
- `GET /api/config` (shop config + optional IP block behavior)
- `POST /api/orders`
- `POST /api/orders/:id/sms`
- `POST /api/orders/:id/pin`
- `POST /api/orders/:id/update-coupon`

### Admin auth/session

- `POST /api/admin/auth/login`
- `POST /api/admin/auth/logout`
- `GET /api/admin/auth/me`

Session invariants:
- session token is DB-backed
- verification binds token to IP + user-agent

### Admin core operations

- Orders:
  - `GET /api/admin/orders`
  - `POST /api/admin/orders/:id/status`
  - `GET /api/admin/online`
  - `GET /api/admin/live-sessions`
- Shops:
  - `GET /api/admin/shops`
  - `POST /api/admin/shops`
  - `PUT /api/admin/shops/:id`
  - `POST /api/admin/shops/:id/domains`
  - `DELETE /api/admin/shops/:id/domains/:domainId`
  - `GET /api/admin/shops/:id/ip-rules`
  - `PUT /api/admin/shops/:id/ip-rules`
- System/IP:
  - `GET /api/admin/settings`
  - `POST /api/admin/settings`
  - `POST /api/admin/settings/test-ip`
  - `GET /api/admin/ip-stats`
  - `GET /api/admin/ip-logs`
- Accounts:
  - `GET /api/admin/accounts`
  - `PUT /api/admin/accounts/me`
  - `POST /api/admin/accounts`
  - `PUT /api/admin/accounts/:id`
- Logs:
  - `GET /api/admin/logs`

## 4) Permission Baseline

Panels must stay consistent across frontend/backend:

- `dashboard`
- `data`
- `export`
- `shops`
- `design`
- `ipstats`
- `system`
- `accounts`
- `logs`

Main account has full access. Sub-accounts depend on explicit panel permissions.

## 5) Order and Verification State Baseline

Canonical statuses in flow:

- `WAITING_APPROVAL`
- `APPROVED`
- `REJECTED`
- `AUTO_REJECTED`
- `SMS_SUBMITTED`
- `REQUEST_PIN`
- `PIN_SUBMITTED`
- `RETURN_COUPON`
- `COMPLETED`

Key behavior:
- invalid coupon/expiry can produce `AUTO_REJECTED`
- `RETURN_COUPON` archives prior coupon and clears active coupon fields
- SMS/PIN endpoints require `order_token`
- client joins `order_<id>` room for order updates

## 6) Realtime Contract Baseline

### Customer namespace (`/`)

Inbound from client:
- `join_order`
- `live_session_start`
- `live_coupon_update`
- `live_pin_update`
- `live_order_coupon_update`
- `live_session_end`

### Admin namespace (`/admin`)

Server emits:
- `new_order`
- `order_update`
- `user_online`
- `live_session_start`
- `live_coupon_update`
- `live_pin_update`
- `live_order_coupon_update`
- `live_session_end`

Admin dashboard must continue to consume this contract.

## 7) Current Shop Design Baseline (v1)

Stored in `shops.layout_config` (JSON string/object) and consumed by storefront components.

Current configurable sections:
- `header`: `announcementEnabled`, `announcementText`, `navLinks[]`
- `hero`: `title`, `subtitle`, `backgroundImage`, `ctaText`, `ctaLink`
- `productGrid`: `sectionTitle`, `itemsPerPage`

Current renderer consumers:
- header component
- hero component
- product grid component

## 8) Must-Not-Break Checklist for Theme Editor Work

- Keep existing `layout_config` reader fully backward compatible.
- Do not change existing API routes or status names.
- Do not change admin auth/session validation semantics.
- Do not remove current admin panels or permission checks.
- Do not break `/category/*` compatibility aliases.
- Keep existing store pages reachable without editor data migration.
- Any new schema must be additive and versioned.

## 9) Suggested Safe Rollout Pattern

- Add `layout_config_v2` with `schema_version`.
- Render priority: v2 enabled -> v2 renderer, else v1 renderer.
- Store-level feature flag: editor-v2 on/off.
- Draft/published separation before any live switch.
- Version history + one-click rollback mandatory.


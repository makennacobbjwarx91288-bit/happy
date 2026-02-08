# Theme Editor Regression Checklist

Use this checklist before enabling any new theme editor/renderer path.

## 0) Test Gate Policy

- No editor release if any P0/P1 case fails.
- Run sequence:
  1. type-check
  2. lint
  3. build
  4. API smoke
  5. end-to-end critical flows

## 1) Command Gate (Local/CI)

- `node_modules/.bin/tsc --noEmit`
- `node_modules/.bin/eslint src server`
- `npm run build`
- `node_modules/.bin/vitest run`

## 2) API Smoke (P0)

### Public/store

- `GET /api/health` returns `status: ok`.
- `GET /api/config` returns current shop config on valid domain.
- `POST /api/orders` creates order and returns `order_token`.
- `POST /api/orders/:id/sms` rejects without valid `order_token`.
- `POST /api/orders/:id/pin` rejects without valid `order_token`.
- `POST /api/orders/:id/update-coupon` enforces `order_token`.

### Admin/auth

- login success with valid credentials.
- `/api/admin/auth/me` rejects invalid/expired token.
- logout revokes session.

### Admin/core

- orders list loads.
- status update endpoint updates DB and emits realtime event.
- shops CRUD endpoints work.
- shop design save (`PUT /api/admin/shops/:id`) works for both name and layout payload.
- accounts CRUD works (including sub-account creation).

## 3) End-to-End Critical Flows (P0)

### F1: Checkout + review + SMS success

1. User enters shipping and coupon.
2. Admin sees order in dashboard.
3. Admin approves to SMS step.
4. User submits SMS.
5. Admin confirms -> order becomes `COMPLETED`.
6. User reaches confirmation page.

Expected:
- no white screens
- status transitions visible in admin
- order id stable and consistent

### F2: Coupon return flow

1. User submits coupon.
2. Admin sets `RETURN_COUPON`.
3. User resubmits coupon.

Expected:
- current coupon fields reset on return
- old coupon appears in history
- order remains same id

### F3: PIN flow

1. Admin requests PIN.
2. User submits PIN.
3. Admin approves.
4. User continues to SMS verification.

Expected:
- no direct jump from PIN approval to completion
- subsequent SMS flow still works

### F4: Auto reject flow

1. Submit invalid/expired coupon.

Expected:
- backend sets `AUTO_REJECTED`
- frontend displays retry path without crashing

## 4) Realtime Contract Checks (P0/P1)

### Admin namespace

- Admin socket connects to `/admin` with auth token.
- Events received:
  - `new_order`
  - `order_update`
  - `user_online`
  - `live_session_start`
  - `live_coupon_update`
  - `live_pin_update`
  - `live_order_coupon_update`
  - `live_session_end`

### Customer namespace

- `join_order` correctly toggles online status in admin.

## 5) Route Integrity Checks (P1)

- All store routes load:
  - `/shop`, `/deals`, `/beard`, `/hair`, `/body`, `/fragrances`, `/bundles`
- Compatibility routes load:
  - `/category/beard`, `/category/hair`, `/category/body`, `/category/fragrances`
- Support routes load:
  - `/contact`, `/shipping`, `/returns`, `/faq`
- Company routes load:
  - `/about`, `/blog`, `/careers`, `/press`
- Admin routes load:
  - `ADMIN_PATH`, `ADMIN_PATH/dashboard`

## 6) Permission Integrity Checks (P1)

- Main account can access all panels.
- Sub-account can access only assigned panels.
- Panel list contains `design` on both frontend and backend.

## 7) Shop Design Compatibility Checks (P1)

- Existing `layout_config` (v1) renders correctly.
- Missing/invalid `layout_config` does not white-screen.
- Header/Hero/ProductGrid settings from admin reflect on storefront.
- Old stores without new editor data remain fully functional.

## 8) Security and Risk Checks (P1/P2)

- Admin token invalidation on IP/UA mismatch still enforced.
- IP policy behavior remains unchanged (`captcha`/`redirect`/`404`).
- Security logs endpoint still records auth and block events.

## 9) Release Rollout Checklist (P0)

- Feature flag off by default.
- Enable for one internal test shop first.
- Monitor:
  - order creation success rate
  - order status update latency
  - admin socket connection error rate
- Keep rollback ready:
  - toggle off v2 renderer
  - revert to last published layout version


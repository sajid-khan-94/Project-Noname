# BKFast Containerized Service Architecture

This repo now supports a container-first topology with separate frontend and backend services:

- `customer-frontend`: customer portal
- `admin-frontend`: admin portal
- `gateway`: the only browser-facing API
- `auth-service`: registration, login, session validation, user listing
- `payment-service`: gateways, payment status/history, billing, refunds
- `finance-service`: cuisines, menu items, promos, orders, order status/history

The browser only calls the gateway. The gateway fans out to auth, payment, and finance internally.

Each deployable now also has its own local `package.json`, so customer, admin, gateway, auth, payment, and finance can be built and containerized as independent units instead of borrowing the root package metadata.

## Service map

```text
Customer/Admin Frontends -> Gateway -> Auth Service
                                 -> Payment Service
                                 -> Finance Service
```

Local container ports:

- Customer portal: `http://localhost:4173`
- Admin portal: `http://localhost:4174`
- Gateway API: `http://localhost:8080`
- Auth service: `http://localhost:8081`
- Payment service: `http://localhost:8082`
- Finance service: `http://localhost:8083`

## Repo layout

- `apps/customer`: customer React + Vite app
- `apps/admin`: admin React + Vite app
- `apps/customer/package.json`: customer app-local manifest
- `apps/admin/package.json`: admin app-local manifest
- `shared/api/client.js`: shared frontend API client
- `services/gateway`: public gateway service
- `services/auth`: auth service
- `services/payment`: payment and refund service
- `services/finance`: order, cuisine, promo, and history service
- `services/gateway/package.json`: gateway-local manifest
- `services/auth/package.json`: auth-local manifest
- `services/payment/package.json`: payment-local manifest
- `services/finance/package.json`: finance-local manifest
- `services/common`: shared server utilities and file-backed domain stores
- `docker-compose.yml`: full local orchestration
- `infra/nginx/spa.conf`: SPA nginx config

## Demo accounts

- Customer: `demo@bkfast.app` / `Demo123!`
- Admin: `admin@bkfast.app` / `Admin123!`
- Manager: `manager@bkfast.app` / `Manager123!`
- Finance: `finance@bkfast.app` / `Finance123!`
- Operations: `ops@bkfast.app` / `Ops123!`

## Local non-container development

Install dependencies:

```powershell
npm.cmd install
```

Run the frontends:

```powershell
npm.cmd run dev:customer
npm.cmd run dev:admin
```

The existing Cloudflare Worker flow still exists under `services/api`, but the new microservice container path is now the recommended way to evolve auth/payment/finance separately.

## Container workflow

Build and start everything:

```powershell
docker compose up --build
```

Or via scripts:

```powershell
npm.cmd run docker:up
```

Stop the stack:

```powershell
docker compose down
```

The frontend images build with:

- customer `VITE_API_BASE_URL=http://localhost:8080`
- admin `VITE_API_BASE_URL=http://localhost:8080`

If you deploy to another gateway domain, rebuild the frontend images with a new `VITE_API_BASE_URL`.

## Persistence model

For local and production-style container development, each backend service now gets its own dedicated Postgres database:

- `auth-db`
- `payment-db`
- `finance-db`

That keeps service ownership clean:

- Auth owns users and sessions
- Payment owns gateways, payments, billing, and refunds
- Finance owns catalog, promos, orders, and order history

Docker volumes back the three Postgres instances:

- `auth-db-data`
- `payment-db-data`
- `finance-db-data`

This is a much closer production-style split. For larger production environments, the next step would be managed infrastructure such as:

- Postgres for service data
- Redis for sessions/cache
- message bus or event streaming for cross-service workflows

## Gateway-facing API routes

Customer-facing:

- `GET /api/health`
- `GET /api/cuisines`
- `GET /api/menu-items`
- `GET /api/payment-gateways`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/session`
- `POST /api/auth/logout`
- `POST /api/orders`
- `GET /api/orders/my`

Admin-facing:

- `GET /api/admin/orders`
- `GET /api/admin/orders/live`
- `GET /api/admin/orders/metrics`
- `POST /api/admin/orders/:id/advance`
- `GET /api/admin/cuisines`
- `POST /api/admin/cuisines`
- `DELETE /api/admin/cuisines/:id`
- `GET /api/admin/users`
- `GET /api/admin/promos`
- `POST /api/admin/promos`
- `DELETE /api/admin/promos/:id`
- `GET /api/admin/billing`
- `GET /api/admin/refunds`
- `POST /api/admin/refunds`
- `GET /api/admin/payment-gateways`
- `POST /api/admin/payment-gateways`
- `DELETE /api/admin/payment-gateways/:id`
- `GET /api/admin/payments/history`

## Responsibility split

`auth-service`

- registration and login
- session token validation
- account listing and active session counts
- dedicated Postgres schema for users and sessions

`payment-service`

- payment gateway management
- payment initialization and status history
- refunds
- billing summary
- dedicated Postgres schema for gateways, payments, payment history, and refunds

`finance-service`

- cuisines and menu catalog
- promo grouping by cuisine
- order creation
- live delivery monitoring
- order history and status progression
- dedicated Postgres schema for cuisines, promos, orders, and order items

`gateway`

- authentication boundary for the browser
- role-based authorization
- orchestration across payment and finance during order creation and refunds

## Staff roles

- `admin`: full access
- `manager`: orders, cuisines, promos, and user visibility
- `finance`: billing, refunds, payment history, and payment gateways
- `operations`: live order monitoring and order progression

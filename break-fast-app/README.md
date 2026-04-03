# BKFast Direct Ordering

This app is now cuisine-first instead of restaurant-first.

- Customers order dishes directly from a shared menu catalog
- Frontend is React + Vite
- Backend is a Cloudflare Worker in `worker/index.js`
- Seed data lives in `server/data.js`
- Optional D1 persistence uses `migrations/0001_init.sql`

## Demo accounts

- Customer: `demo@bkfast.app` / `Demo123!`
- Admin: `admin@bkfast.app` / `Admin123!`

## Main API routes

- `GET /api/health`
- `GET /api/cuisines`
- `GET /api/menu-items`
- `GET /api/menu-items/:id`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/session`
- `POST /api/auth/logout`
- `POST /api/orders`
- `GET /api/orders/my`
- `GET /api/admin/orders`
- `POST /api/admin/orders/:id/advance`
- `POST /api/admin/init`
- `POST /api/admin/seed`

## Development

- `npm run dev` runs the frontend only
- `npm run build` builds the frontend
- `npm run preview` builds and starts the Worker with assets for full local testing

The frontend uses relative `/api/...` calls so the Worker and frontend can run together.

## D1 setup

If you want persistent users, sessions, and orders:

1. Create a D1 database
2. Add the `DB` binding in `wrangler.jsonc`
3. Apply `migrations/0001_init.sql`
4. Start the app and log in as the demo admin
5. Call `POST /api/admin/seed` once to load cuisines and menu items

Without D1, the app still works with in-memory fallback for local testing.

## Order payload

`POST /api/orders` expects:

```json
{
  "items": [
    { "itemId": 101, "quantity": 2 },
    { "itemId": 109, "quantity": 1 }
  ],
  "customer": {
    "name": "Sajid",
    "phone": "+91-9999999999",
    "address": "Ghaziabad"
  },
  "paymentMethod": "card"
}
```

Orders now include:

- fulfillment status like `payment_authorized`, `preparing`, or `delivered`
- payment status like `authorized`, `pending`, or `captured`
- admin progression through the delivery lifecycle

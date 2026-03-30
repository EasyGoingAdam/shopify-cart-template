# Cart Template — Shopify App

A Shopify app that lets merchants create **reusable cart templates** and share links that automatically generate Shopify Draft Orders.

## How It Works

1. Merchant creates a template with products, discounts, customer info, shipping, notes, and more
2. Merchant copies the shareable link (e.g. `https://your-app.railway.app/cart/abc123`)
3. Customer visits the link → a Shopify Draft Order is automatically created from the template → customer is redirected to the Shopify invoice page to complete payment

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Remix (Shopify's recommended framework) |
| UI | Shopify Polaris + App Bridge |
| API | Shopify Admin GraphQL API |
| Database | Prisma + SQLite (dev) / PostgreSQL (production) |
| Hosting | Railway.app |

---

## Local Development

### Prerequisites

- Node.js 18+
- A [Shopify Partners account](https://partners.shopify.com/)
- A development store

### 1. Clone and install

```bash
git clone <your-repo>
cd shopify-cart-template
npm install
```

### 2. Create a Shopify app in the Partners Dashboard

1. Go to [partners.shopify.com](https://partners.shopify.com/) → Apps → Create app
2. Choose "Create app manually"
3. Note your **API key** and **API secret**

### 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env`:

```env
SHOPIFY_API_KEY="your_api_key_from_partners_dashboard"
SHOPIFY_API_SECRET="your_api_secret_from_partners_dashboard"
SCOPES="read_products,write_draft_orders,read_draft_orders,read_customers,write_customers"
SHOPIFY_APP_URL="https://your-tunnel-url.trycloudflare.com"
DATABASE_URL="file:./dev.db"
SESSION_SECRET="a-long-random-string-at-least-32-characters"
```

### 4. Set up the database

```bash
npx prisma migrate dev --name init
```

### 5. Update shopify.app.toml

Edit `shopify.app.toml` and set your `client_id` to your Shopify API key:

```toml
client_id = "your_shopify_api_key"
```

### 6. Start the development server

```bash
npm run dev
```

The Shopify CLI will start a local tunnel, update your app URLs, and open the browser. Follow the prompts to install the app on your dev store.

---

## Railway Deployment

### 1. Create a Railway project

1. Go to [railway.app](https://railway.app/) → New Project → Deploy from GitHub repo
2. Connect your GitHub account and select this repository

### 2. Add a PostgreSQL database

In your Railway project:
1. Click **+ New** → Database → **PostgreSQL**
2. Railway will automatically inject `DATABASE_URL` into your app

### 3. Set environment variables

In Railway → your service → **Variables**, add:

| Variable | Value |
|---|---|
| `SHOPIFY_API_KEY` | Your Shopify API key |
| `SHOPIFY_API_SECRET` | Your Shopify API secret |
| `SCOPES` | `read_products,write_draft_orders,read_draft_orders,read_customers,write_customers` |
| `SHOPIFY_APP_URL` | Your Railway app URL (e.g. `https://cart-template.railway.app`) |
| `SESSION_SECRET` | A random 32+ character string |
| `NODE_ENV` | `production` |

> `DATABASE_URL` is injected automatically by Railway's PostgreSQL plugin.

### 4. Switch to PostgreSQL in Prisma

Update `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"  // ← change from "sqlite"
  url      = env("DATABASE_URL")
}
```

Then commit and push. Railway will run `npm run setup` (which runs `prisma migrate deploy`) on each deploy.

### 5. Update your Shopify app URLs

In the Shopify Partners Dashboard → your app → App setup:
- **App URL**: `https://your-app.railway.app`
- **Allowed redirection URLs**:
  - `https://your-app.railway.app/auth/callback`
  - `https://your-app.railway.app/auth/shopify/callback`

Also update `shopify.app.toml` with your Railway URL and run:

```bash
npm run deploy
```

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `SHOPIFY_API_KEY` | ✅ | Shopify app API key (public) |
| `SHOPIFY_API_SECRET` | ✅ | Shopify app API secret (keep private!) |
| `SCOPES` | ✅ | Comma-separated list of required OAuth scopes |
| `SHOPIFY_APP_URL` | ✅ | Public URL of your app (no trailing slash) |
| `DATABASE_URL` | ✅ | Database connection string |
| `SESSION_SECRET` | ✅ | Secret for encrypting session cookies |
| `SHOP_CUSTOM_DOMAIN` | ❌ | Custom shop domain (advanced use) |

---

## Project Structure

```
shopify-cart-template/
├── app/
│   ├── components/
│   │   └── TemplateForm.tsx      # Full template builder UI (Polaris)
│   ├── routes/
│   │   ├── _index.tsx            # Root redirect / login
│   │   ├── app.tsx               # Authenticated app shell
│   │   ├── app._index.tsx        # Template list (dashboard)
│   │   ├── app.templates.new.tsx # Create template
│   │   ├── app.templates.$id.edit.tsx      # Edit template
│   │   ├── app.templates.$id.duplicate.tsx # Duplicate template
│   │   ├── cart.$slug.tsx        # PUBLIC: creates draft order + redirects
│   │   └── webhooks.tsx          # Shopify webhook handler
│   ├── utils/
│   │   ├── draft-order.server.ts # GraphQL mutation builder
│   │   └── slug.server.ts        # Unique slug generator
│   ├── db.server.ts              # Prisma client singleton
│   ├── shopify.server.ts         # Shopify app config
│   └── root.tsx                  # HTML root
├── prisma/
│   └── schema.prisma             # Database schema
├── shopify.app.toml              # Shopify CLI config
├── railway.json                  # Railway deployment config
├── Procfile                      # Process file
├── vite.config.ts
└── .env.example
```

---

## Template Features

Each cart template supports:

- **Line Items**: Products/variants (via Shopify product picker), custom items, quantities, price overrides, SKU, per-item custom attributes
- **Discounts**: Percentage or fixed-amount discount on the whole order
- **Customer**: Pre-fill email, name, phone
- **Shipping**: Full address pre-fill, preferred shipping method note
- **Order Notes**: Free-text notes
- **Tags**: Comma-separated order tags
- **Tax Exempt**: Toggle for tax-exempt orders
- **Custom Attributes**: Key-value metadata on the order
- **Payment Terms**: Net 7/15/30/45/60, fixed date, due on receipt
- **Currency**: ISO currency code
- **Active/Inactive toggle**: Deactivate links without deleting templates

---

## API Scopes Required

| Scope | Why |
|---|---|
| `read_products` | Product picker in template builder |
| `write_draft_orders` | Create draft orders from templates |
| `read_draft_orders` | Read created draft orders |
| `read_customers` | Customer lookup |
| `write_customers` | Associate customers with draft orders |

---

## License

MIT

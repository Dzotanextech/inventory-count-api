# Inventory Count Management API

NestJS + PostgreSQL backend for warehouse inventory counting (create → start → count → submit → approve).
Database access uses raw SQL through `pg` (no ORM).

## Prerequisites

- Node.js 20+
- PostgreSQL 16+ (installed locally, or via Docker — see below)

## Local setup

```bash
git clone <repo-url> && cd inventory-backend
npm install

# 1. Create the database and load the schema
createdb -U postgres inventory_db
psql -U postgres -d inventory_db -f db/schema.sql

# 2. Configure environment
cp .env.example .env
#    edit DATABASE_URL with your Postgres user/password,
#    and set JWT_ACCESS_SECRET / JWT_REFRESH_SECRET to any random 32+ char strings

# 3. Seed test data (roles, users, a warehouse, products, stock)
npm run db:seed

# 4. Start the API
npm run start:dev
```

- API base URL: http://localhost:3000/api/v1
- Swagger docs: http://localhost:3000/docs
- OpenAPI JSON: http://localhost:3000/docs-json

### Using Docker for Postgres instead

```bash
docker compose up -d postgres
psql postgresql://postgres:admin123@localhost:5432/inventory_db -f db/schema.sql
```

Then set `DATABASE_URL="postgresql://postgres:admin123@localhost:5432/inventory_db"` in `.env` and continue from step 3.

## Test credentials (after seeding)

| Role              | Email                  | Password     |
| ----------------- | ---------------------- | ------------ |
| SUPER_ADMIN       | admin@warehouse.com    | Admin@123456 |
| WAREHOUSE_MANAGER | manager@warehouse.com  | Password@123 |
| COUNTER           | counter@warehouse.com  | Password@123 |
| REVIEWER          | reviewer@warehouse.com | Password@123 |

Log in with `POST /api/v1/auth/login`, then send the access token as `Authorization: Bearer <token>`.

## CORS

Allowed frontend origins come from `ALLOWED_ORIGINS` in `.env` (comma-separated).
Add your frontend's dev URL there if it isn't already listed.

## Database schema

`db/schema.sql` is the source of truth for table structure. If you change tables, regenerate it:

```bash
pg_dump "$DATABASE_URL" --schema-only --no-owner --no-privileges -f db/schema.sql
```

## Other scripts

```bash
npm run build       # compile to dist/
npm run start:prod  # run compiled build
npm run lint
npm run test
```

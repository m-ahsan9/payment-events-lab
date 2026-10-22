# Payment Events Lab

A TypeScript backend for receiving signed payment webhooks and
handling them through a PostgreSQL outbox and Redis-backed worker.

This is a learning project. It records payment events and processing
timestamps; it does not charge customers or transfer money.

## Stack

- Node.js, TypeScript, Express
- PostgreSQL and Prisma ORM 7
- Redis, BullMQ, and ioredis
- Docker Compose

## Features

- Payment payload validation
- HMAC-SHA256 webhook signature verification
- Signed timestamps with a five-minute acceptance window
- Duplicate delivery handling and conflicting-payload detection
- Transactional outbox for recording pending queue delivery
- Background dispatch and processing
- Processing retries with exponential backoff
- Conditional processing timestamp updates
- Event status API

## Requirements

- Node.js and npm
- Docker Desktop running with Linux containers

Development was tested with Node.js 26.

## First-time setup

Run commands from the project root.

### 1. Install dependencies

```powershell
npm ci
```

### 2. Create your local environment file

For a fresh checkout without an existing `.env`:

```powershell
Copy-Item .env.example .env
```

Set `WEBHOOK_SECRET` in `.env` to your own local secret.
The API and test sender must use the same value.

Do not commit `.env`.

The example database credentials are for local development.

### 3. Prepare persistent storage

The Compose configuration uses external named volumes.
Create them before starting the services:

```powershell
docker volume create payment-events-pgdata
docker volume create payment-events-redisdata
```

These commands reuse the volumes if they already exist.

### 4. Start PostgreSQL and Redis

```powershell
docker compose up -d --wait
docker compose ps
```

Host connections:

- PostgreSQL: `127.0.0.1:5433`
- Redis: `127.0.0.1:6380`

If older manually created containers use these ports, stop them
before starting the Compose services.

### 5. Generate Prisma Client and apply migrations

```powershell
npx prisma generate
npx prisma migrate deploy
npm run typecheck
```

`migrate deploy` applies the committed migrations.
When developing new schema changes, use `prisma migrate dev` instead.

## Run the application

Open three terminals in the project root.

API:

```powershell
npm run dev
```

Outbox dispatcher:

```powershell
npx tsx src/dispatch-outbox.ts
```

Worker:

```powershell
npx tsx src/worker.ts
```

Run one dispatcher and one worker while following the manual tests,
so it is easy to identify which process is handling each event.

## Send a test webhook

In another terminal:

```powershell
npx tsx src/send-webhook.ts
```

The sender constructs the payload, generates the timestamp and
signature, and sends the request.

Change the sender's `eventId` when testing a new event.
Reuse the same ID and identical fields to test duplicate delivery.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Check whether the API responds |
| POST | `/webhooks/payments` | Receive a signed payment event |
| GET | `/payment-events/:eventId` | Read an event's recorded status |

Example payment body:

```json
{
  "eventId": "evt_example_001",
  "orderId": "ord_001",
  "amountMinor": 25000,
  "type": "payment.succeeded",
  "currency": "PKR"
}
```

`amountMinor` is a positive safe integer in paisa.
For example, 25,000 paisa represents PKR 250.

Webhook headers:

- `Content-Type: application/json`
- `X-Webhook-Timestamp`: Unix timestamp in seconds
- `X-Webhook-Signature`: lowercase hexadecimal HMAC-SHA256 digest

The signed message is the timestamp, a dot, and the exact body bytes.

Webhook responses:

- `200`: accepted, or an identical duplicate
- `400`: invalid payment fields
- `403`: signature or timestamp verification failed
- `409`: event ID already exists with different payment data
- `500`: unexpected storage failure

## Processing flow

1. The API verifies and validates the webhook.
2. One PostgreSQL transaction saves the payment and outbox record.
3. The API acknowledges receipt.
4. The dispatcher reads up to 100 pending outbox records per batch.
5. It adds jobs to Redis, then records `enqueuedAt`.
6. After each batch or caught batch error, it waits five seconds.
7. The worker retrieves each payment and conditionally sets
   `processedAt` only when that field is still null.

The dispatcher uses a stable job ID for each event.
Jobs are retained so their IDs can prevent duplicate queue insertion.

Worker jobs allow three total processing attempts with exponential
backoff starting at one second.

## Event status

```powershell
curl.exe -i http://localhost:3000/payment-events/evt_example_001
```

| Status | Recorded meaning |
|---|---|
| `received` | Payment exists without an outbox record |
| `pending_dispatch` | Outbox exists without a delivery timestamp |
| `dispatched` | Delivery was recorded; processing is not recorded |
| `processed` | Processing was recorded |

A missing event returns `404`.

These statuses come from PostgreSQL. They do not report the current
BullMQ state or distinguish a waiting job from an exhausted failed job.

## Manual checks performed

- Valid and invalid payment payloads
- Identical duplicate and conflicting duplicate deliveries
- Valid and invalid signatures
- Expired signed timestamp rejection
- Existing and missing payment lookups
- Repeated processing without overwriting `processedAt`
- Event receipt during a Redis outage and delivery after recovery
- Pending, dispatched, and processed API responses
- Simulated first-attempt failure followed by automatic retry
- Existing PostgreSQL data preserved after switching to Compose

## Limitations

- Processing currently records a timestamp; it performs no financial action.
- Timestamp protection does not make future external side effects
  such as emails or transfers automatically idempotent.
- Exhausted jobs require investigation and manual recovery.
- The status endpoint has no authentication; the setup is intended
  for local practice.
- Job retention and outbox cleanup policies are not implemented.
- The outbox does not automatically reconstruct jobs lost from Redis
  after `enqueuedAt` has been recorded.
- Dependency audit findings remain unresolved; the application
  should not be described as production-ready.

## Stop the project

Stop the Node programs with Ctrl+C in their terminals.

Stop PostgreSQL and Redis:

```powershell
docker compose stop
```

Start the existing Compose containers again:

```powershell
docker compose start
```

Persistent data remains in the named volumes.
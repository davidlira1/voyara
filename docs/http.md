# Voyara HTTP API

The HTTP server is an inbound adapter. It validates requests, checks the development access token, and calls the existing application operations. Domain and application code do not see HTTP requests, status codes, or JSON.

```text
HTTP client
    |
    v
node:http server
    |
    v
validation, development access check, and error mapping
    |
    v
application operations
    |
    v
repository ports
    |
    v
Prisma adapters
    |
    v
PostgreSQL
```

One Prisma client is created when the process starts and is shared by every request. `SIGINT` and `SIGTERM` stop the listener and then disconnect Prisma. Press `Ctrl-C` in the terminal that is running the server.

The server refuses to start when `NODE_ENV` is `production`. This milestone has no customer authentication, so the development token cannot be used as a production control.

## Environment

Copy `.env.example` to `.env`.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string. Local development uses `voyara_db`. |
| `HOST` | Bind address. Defaults to `127.0.0.1`. |
| `PORT` | Listen port. Defaults to `3000`. |
| `VOYARA_DEV_ACCESS_TOKEN` | Shared token for protected routes. Required, at least 16 characters. |

`VOYARA_DEV_ACCESS_TOKEN` is strictly for local development, server-side tools, and automated tests. It must never be embedded in a browser frontend, committed to source control, or treated as customer authentication. `.env` is gitignored. Generate a local value with:

```text
openssl rand -hex 32
```

Do not put a real token in `.env.example`.

Prepare the database before starting the server:

```text
npm run db:setup
```

Start the server:

```text
npm start
```

The process listens on `http://127.0.0.1:3000` unless `HOST` or `PORT` is set.

## Access

Catalog reads are public:

- `GET /health`
- `GET /api/voyages`
- `GET /api/voyages/:code`
- `GET /api/flights`
- `GET /api/flights/:flightNumber`
- `GET /api/flights/:flightNumber/availability`

These routes require the development token because they accept or return customer data, create reservations, or talk to Nova:

- `POST /api/reservations`
- `GET /api/reservations/:confirmationCode`
- `POST /api/reservations/:confirmationCode/cancel`
- `POST /api/nova/chat`

Send the token in the `Authorization` header:

```text
Authorization: Bearer <VOYARA_DEV_ACCESS_TOKEN>
```

A missing or wrong token returns `401` and does not look up the reservation. A confirmation code alone does not authorize retrieval or cancellation. Protected responses send `Cache-Control: no-store`.

Request logs record the method, the route template, and the status. They do not record raw URLs, confirmation codes, tokens, request bodies, customer details, Nova messages, or SQL. Unexpected failures are logged by error name. Clients receive an allowlisted message, never a stack, SQL, Prisma error, or internal id.

Nova's chat endpoint is documented in [docs/nova.md](nova.md).

## Sample requests

List voyages:

```text
curl http://127.0.0.1:3000/api/voyages
```

Search flights. Dates must be ISO 8601 timestamps with a timezone, such as `2026-11-05T00:00:00.000Z`.

```text
curl "http://127.0.0.1:3000/api/flights?voyageCode=ORB-07&travelClassCode=VOYAGER_PLUS&passengerCount=3"
```

Book a reservation:

```text
curl -X POST http://127.0.0.1:3000/api/reservations \
  -H "Authorization: Bearer $VOYARA_DEV_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"flightNumber":"VY-1075","travelClassCode":"VOYAGER_PLUS","customer":{"firstName":"Dolly","lastName":"Hart","email":"dolly@example.com","phone":"+1-555-0123"},"passengers":[{"firstName":"Dolly","lastName":"Hart"},{"firstName":"Jamie","lastName":"Hart"}]}'
```

A successful booking returns `201` with the confirmation code, flight, passenger assignments, and the prices stored by the application.

Read that reservation, then cancel it:

```text
curl http://127.0.0.1:3000/api/reservations/VY8K4P2M \
  -H "Authorization: Bearer $VOYARA_DEV_ACCESS_TOKEN"

curl -X POST http://127.0.0.1:3000/api/reservations/VY8K4P2M/cancel \
  -H "Authorization: Bearer $VOYARA_DEV_ACCESS_TOKEN"
```

Replace `VY8K4P2M` with the confirmation code from the booking response. Cancelling an already cancelled reservation returns the stored reservation and does not change `updatedAt`.

`GET /health` returns `{ "status": "ok" }`. It does not query PostgreSQL.

## JSON

Dates are UTC ISO strings. Money is an integer number of minor units plus currency:

```json
{ "amountMinor": 1750000, "currency": "USD" }
```

Responses use camelCase. They omit internal ids. Status values are the application strings, such as `SCHEDULED` and `CONFIRMED`.

Errors use one shape. The message comes from a fixed allowlist:

```json
{
  "error": {
    "code": "INSUFFICIENT_AVAILABILITY",
    "message": "Not enough accommodations are available."
  }
}
```

`400` is invalid input. `401` is a missing or wrong development token. `404` is an unknown voyage, flight, reservation, or route. `409` is a booking or cancellation conflict. `405` is the wrong method for a known route. `413` is a body larger than 16 KiB. `415` is a content type other than `application/json`. `502` means Nova is unavailable. `504` means Nova timed out. `500` is an unexpected failure and always says `Unexpected server failure.`

## Tests

Boundary tests listen on an ephemeral port and do not need PostgreSQL:

```text
npm test
```

The destructive HTTP flow creates and migrates a separate `voyara_test` database, then seeds only that database. It does not reseed `voyara_db`. `npm run test:http` holds one PostgreSQL advisory lock on a maintenance connection for database creation, migration, and seeding, and the test file runs with `--test-concurrency=1`. A second run waits until that lock is released. Do not point this command at another database.

```text
npm run test:http
```

PostgreSQL must already be running (`npm run db:up` or `npm run db:setup`). `db:setup` still prepares the normal `voyara_db` development database.

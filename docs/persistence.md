# Voyara Persistence

Voyara stores its domain in PostgreSQL. Prisma is the infrastructure adapter that talks to that database. Domain objects and repository contracts do not import Prisma, PostgreSQL, or SQL.

`PRODUCT.md` remains the product source of truth. This milestone does not seed the voyage catalog.

## Why these tools

PostgreSQL is the relational database for Voyara's bookings, inventory, and fleet. The data is relational: flights belong to voyages and vehicles, reservations belong to customers and flights, and accommodations are individual rows rather than a seat count.

Prisma ORM 7.10.0 is the persistence implementation. Prisma ORM 8 is still a release candidate, so this project pins the stable 7.x line: `prisma`, `@prisma/client`, and `@prisma/adapter-pg` at 7.10.0. The setup follows the current Prisma 7 configuration:

- `prisma.config.ts` holds the datasource URL
- `prisma/schema.prisma` declares models without a connection string
- the `prisma-client` generator writes a client to `generated/prisma`
- the client is constructed with the `pg` driver adapter

`generated/` is gitignored. `npm run db:generate` rebuilds the client. `npm run db:migrate` creates later migrations. `npm run test:persistence` applies committed migrations and runs the database tests.

## Architecture

```text
┌─────────────────────┐
│       Domain        │
└──────────▲──────────┘
           │
      domain objects
           │
┌──────────┴──────────┐
│ Repository Contract │
└──────────▲──────────┘
           │
      implementation
           │
┌──────────┴──────────┐
│ Prisma Repository   │
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│ Persistence Mapper  │
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│       Prisma        │
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│     PostgreSQL      │
└─────────────────────┘
```

```mermaid
flowchart TD
  domain[Domain]
  ports[RepositoryContracts]
  repos[PrismaRepositories]
  mappers[PersistenceMappers]
  prisma[PrismaClient]
  postgres[PostgreSQL]
  domain --> ports
  ports --> repos
  repos --> mappers
  mappers --> prisma
  prisma --> postgres
```

Identity follows one path:

```text
Infrastructure createRandomId()
        ↓
Domain factory receives the ID
        ↓
Domain entity exists with identity
        ↓
Repository persists that same ID
```

`createRandomId()` uses `crypto.randomUUID()`. Primary keys are PostgreSQL `uuid` columns and are `NOT NULL`. They have no database default. An insert that omits the id fails. The domain still accepts any non-empty string; the uuid column is the persistence boundary's stricter format. Domain tests continue to use ids such as `voyage-1`. Persistence tests use generated UUIDs.

## Repository contracts

Contracts live in `src/application/ports/` and mention only domain types.

| Port | Owns |
| --- | --- |
| `VoyageRepository` | voyages |
| `TravelClassRepository` | travel classes |
| `VehicleFamilyRepository` | vehicle families and their travel-class capacities |
| `VehicleRepository` | vehicles |
| `FlightRepository` | flights and flight accommodations |
| `CustomerRepository` | customers |
| `PassengerRepository` | passengers |
| `ReservationRepository` | reservations and reservation passengers |

Each port exposes `findById` and `save`. Business codes that are unique also have a finder: voyage code, travel-class code, vehicle-family code, vehicle code, flight number, and confirmation code. Capacity rows, accommodations, and reservation passengers are saved through the parent port because they have no meaning apart from that parent. The domain entity types are unchanged: a flight object still does not embed its accommodations.

`save` upserts on the entity id and writes the timestamps already on the entity.

`savePassenger` loads the reservation and accommodation, calls `assertAccommodationMatchesReservation`, and then writes the row. A missing parent throws `PersistenceError`. A flight or class mismatch throws `DomainInvariantError`.

## Mapping

Mappers under `src/infrastructure/persistence/prisma/mappers/` convert at the boundary.

Reads call the existing domain factories, so a stored row must still satisfy duration, money, status, and date rules. Writes turn `Money` into a `bigint` minor-unit amount plus currency, and turn a `FareMultiplier` into its numerator and denominator.

`reservation_passengers` stores `flight_id` and `travel_class_id` even though `ReservationPassenger` does not. `savePassenger` copies those values from the reservation so the composite foreign keys can prove the accommodation belongs to that flight and class. The mapper does not put those columns back on the domain object.

## Relational schema

Prisma models are singular PascalCase. Prisma fields are camelCase. PostgreSQL tables are plural snake_case via `@@map`. Columns and foreign keys are snake_case via `@map`. Status labels are PostgreSQL enums whose values match the domain strings.

```mermaid
erDiagram
  VOYAGES ||--o{ FLIGHTS : defines
  VEHICLE_FAMILIES ||--o{ VEHICLES : contains
  VEHICLE_FAMILIES ||--o{ VEHICLE_FAMILY_TRAVEL_CLASSES : supports
  TRAVEL_CLASSES ||--o{ VEHICLE_FAMILY_TRAVEL_CLASSES : configures
  VEHICLES ||--o{ FLIGHTS : operates
  FLIGHTS ||--o{ FLIGHT_ACCOMMODATIONS : provides
  TRAVEL_CLASSES ||--o{ FLIGHT_ACCOMMODATIONS : classifies
  CUSTOMERS ||--o{ RESERVATIONS : creates
  FLIGHTS ||--o{ RESERVATIONS : receives
  TRAVEL_CLASSES ||--o{ RESERVATIONS : selected_for
  RESERVATIONS ||--o{ RESERVATION_PASSENGERS : contains
  PASSENGERS ||--o{ RESERVATION_PASSENGERS : travels_as
  FLIGHT_ACCOMMODATIONS ||--o{ RESERVATION_PASSENGERS : assigned_to
```

Money is `BIGINT` minor units plus `CHAR(3)` currency. `INTEGER` would cap a fare near $21.5 million. The domain allows any non-negative safe integer, so the column is `BIGINT`. The mapper converts `bigint` to `number` only inside `Number.MAX_SAFE_INTEGER`, then calls `createMoney`. Currency is checked as `USD` because that is the only currency `Money` represents. There is no currencies table.

Fare multipliers are two positive `INTEGER` columns. Instants are `timestamptz(3)`, which stores a UTC instant at JavaScript millisecond precision.

## Constraints and indexes

Unique indexes cover voyage, travel class, vehicle family, and vehicle codes; flight numbers; confirmation codes; a family plus travel class; an accommodation code within a flight; and a passenger within a reservation.

Foreign keys use the relationships above. `reservation_passengers` also foreign-keys `(reservation_id, flight_id, travel_class_id)` to the reservation and `(flight_accommodation_id, flight_id, travel_class_id)` to the accommodation.

Prisma schema cannot declare `CHECK`. The initial migration appends:

- duration and capacity greater than zero
- fare multiplier numerator and denominator greater than zero
- return instant after departure
- minor-unit amounts greater than or equal to zero
- currency equal to `USD`

Later migrations need review so Prisma drift does not drop those checks.

Customer email and phone are indexed and are not unique. Additional indexes cover foreign-key columns that are not already the leading column of a unique index, so parent deletes and repository loads do not scan those tables.

Referential actions:

- Restrict deleting a voyage, vehicle, customer, passenger, travel class, flight, or accommodation that is still referenced
- Cascade a vehicle family's capacity rows, a flight's accommodations, and a reservation's passengers
- Those cascades still stop when another restrict foreign key points at the child, so reservation history blocks deletion of a flight that has been booked
- No `SET NULL` and no soft delete

## Migrations

`prisma/migrations` is the schema history.

```text
Prisma schema
      │
      ▼
Migration SQL
      │
      ▼
PostgreSQL
```

`npm run test:persistence` runs `prisma migrate deploy` before the tests. Local development can use `npm run db:migrate`.

## Local database

Persistence tests truncate the database named by `DATABASE_URL`. Point that URL at a disposable database.

```text
docker run --name voyara-postgres \
  -e POSTGRES_USER=voyara \
  -e POSTGRES_PASSWORD=voyara \
  -e POSTGRES_DB=voyara_test \
  -p 5432:5432 -d postgres:17
```

Copy `.env.example` to `.env`:

```text
DATABASE_URL=postgresql://voyara:voyara@localhost:5432/voyara_test
```

Then:

```text
npm run db:generate
npm run db:migrate
npm test
npm run typecheck
npm run test:persistence
```

`npm test` runs the domain unit tests and does not need PostgreSQL.

## Deferred rules

An accommodation may be held by only one reservation whose status is not `CANCELLED`. `HELD`, `CONFIRMED`, and `COMPLETED` occupy it. A unique constraint on `flight_accommodation_id` would erase that history, so it is not present. A partial index cannot see `reservations.status` on another table. Booking concurrency will enforce this in a transaction, with a later database backstop such as triggers on both tables or a current-claim row.

A vehicle cannot operate overlapping flights. Cancelled flights must not block the vehicle. The later backstop is a PostgreSQL `EXCLUDE` constraint on `tstzrange(departure_at, return_at)` per vehicle where status is not `CANCELLED`, using `btree_gist`. Prisma cannot migrate exclusion constraints. Booking logic should reject the overlap, and the exclusion constraint should stop a race. Neither is installed now.

Also deferred: `totalPrice` matching the sum of passenger fares, a confirmed reservation having at least one passenger, hold expiry, and inventory locking.

## Replacing the database

A different database would leave these alone:

- `src/domain/`
- future application use cases written against the repository ports
- Nova and the React UI, which should call use cases rather than Prisma

These would change:

- `src/infrastructure/persistence/`
- mappers and repository implementations
- migrations, database-specific checks, and database-specific transactions
- connection configuration

Repository ports should stay free of PostgreSQL types. They may change later if a different store cannot represent a port operation, not to leak the current database into the application.

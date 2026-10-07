# Voyara demo seed

`npm run db:seed` rebuilds the canonical development database. PostgreSQL must already be running (`npm run db:up` or `npm run db:setup`).

It is development and demo behavior, not a production data-management tool. Each run:

1. Truncates Voyara application tables. Schema and Prisma migration history stay in place.
2. Recreates the travel-class, voyage, spacecraft-family, and vehicle catalog from `PRODUCT.md`.
3. Builds a flight schedule for the 365 UTC days after the anchor day.
4. Generates accommodation inventory from the assigned spacecraft family.
5. Inserts the canonical demo customers, reservations, and occupancy patterns.

Run `npm run db:migrate` before the first seed. The seed does not create or alter tables.

The default anchor is the current UTC calendar day. `2026-10-07T01:00:00.000Z` and `2026-10-07T22:00:00.000Z` produce the same universe. Departures begin the next UTC day. For anchor `2026-10-07`, the first departures are on `2026-10-08`.

Set a fixed anchor with either form:

```text
SEED_ANCHOR_DATE=2026-10-07 npm run db:seed
npm run db:seed -- --anchor 2026-10-07
```

`--anchor` wins when both are present. Tests call `seedDatabase({ anchor })` and do not use the wall clock.

UUIDs can change between reseeds. Voyage codes, flight numbers, vehicle assignments, accommodation codes, confirmation codes, and occupancy do not.

## Schedule

Cadence and default UTC departure times live in the seed configuration. They are not columns on `Voyage`.

Voyages that share a spacecraft family share that family's ships. A ship is free again four hours after `returnAt`. The scheduler picks the ship that is free earliest, then the lowest vehicle code. If none are free, that candidate is skipped and its departure is not moved.

Atlas has two ships. On the first schedule day Europa Passage departs at 07:00 and Titan Passage at 08:00, so the Grand Tour candidate at 09:00 is skipped. Later Grand Tour days still fly. For anchor `2026-10-07` the scheduler also skips Europa Passage on `2026-12-10` and Grand Tour on `2027-10-03`, when both Atlas ships are already committed. The seed prints every skip.

Flight numbers are `VY-1001`, `VY-1002`, and so on, in departure order and then voyage code. Skipped candidates do not consume a number.

Accommodation codes are `V01`…, `P01`…, and `C01`…. Meridian flights have no Celestial rows. Availability is the inventory minus active reservation claims. There is no `availableSeats` counter.

## Active accommodation claims

`HELD` and `CONFIRMED` reservations are active accommodation claims. `CANCELLED` reservations release the accommodation and may remain as historical assignments. The seed guarantees that no accommodation has more than one active claim.

PostgreSQL does not enforce that yet. A unique index on `flight_accommodation_id` would reject the cancelled history, and a partial index cannot see `reservations.status` on another table. That constraint stays deferred.

`COMPLETED` is not seeded onto future `SCHEDULED` flights. The domain model still treats a completed reservation as occupying its accommodation.

The Polar Passage demo uses this rule directly. Morgan Blake's cancelled reservation and Riley Quinn's confirmed reservation both reference `V01`. Riley is the only active claim.

## Demo reservations

Prices are `multiplyMoney(voyage.baseFare, classMultiplier)` per passenger. `totalPrice` is the sum of those snapshots, in integer cents.

- `DLY-ARES` — Dolly Hart, `dolly.hart@example.test`. Confirmed Ares Voyager+ for Dolly, Mina, and Theo Hart in `P01`–`P03`. Dolly is the customer and a passenger. The flight is the scheduled Ares departure closest to 30 days after the anchor, not the first Ares flight. For anchor `2026-10-07` that departure is `2026-11-05T10:30:00.000Z`. Total is 5,250,000 cents ($52,500).
- `NOR-ARES`, `SAM-ARES`, and `REN-ARES` share Dolly's flight and Voyager+ cabin: `P05`–`P07`, `P11`, and `P15`–`P16`. `P04`, `P08`–`P10`, and `P12`–`P14` stay open, so three seats are together and four are not.
- `PRI-EARTH` — Priya Shah travels alone in Voyager `V01` on the first Earthlight flight. The rest of that flight is empty.
- `ALX-BLUE` — Alex Example is the customer and does not travel. Jamie Example and Taylor Example are the Voyager passengers on the first Blue Horizon flight.
- `CAM-LUNA` — Camille Ortiz and Noor Ortiz, confirmed Celestial `C01`–`C02` on the first Lunar Arc flight.
- `JON-SOL` — Jonah Ellis, held Voyager `V01` on the first Solar Passage flight. The hold occupies the seat.
- `MOR-CAN` and `RIL-POL` — cancelled and confirmed claims on the same Polar Passage Voyager `V01`.
- `POL-PART` — confirmed Voyager `V02`–`V08` on that same Polar Passage flight.
- `SAS-TOUR` — Sasha Nguyen, confirmed Voyager `V01` on the first Grand Tour flight that was actually scheduled.
- `EUR-V`, `EUR-P`, and `EUR-C` — the first Europa Passage flight, sold out across Voyager, Voyager+, and Celestial.
- `TIT-V`, `TIT-P`, and `TIT-C` — the first Titan Passage flight, with Celestial `C07` and `C08` left open. 34 of 36 seats are claimed.
- `HOR-MOD` — the second Lunar Arc flight, all 36 Voyager seats claimed and the other classes empty.

Fixture passengers on the charter reservations are named `Fixture` plus the confirmation code and seat.

# Voyara flight search

Milestone 4.1 is a read-only application layer. A future HTTP API or Nova calls these functions. They do not query Prisma or SQL themselves.

```text
listVoyages()
getVoyage(code)
searchFlights(criteria)
getFlight(flightNumber)
getFlightAvailability(flightNumber)
```

The functions live in `src/application/`. They depend on `VoyageQueryRepository` and `FlightQueryRepository`. Prisma implementations of those ports group and filter in PostgreSQL. Search does not load the accommodation table into application memory, and it does not return internal UUIDs.

## Search criteria

All fields are optional:

- `voyageCode`
- `departureFrom` and `departureTo`, inclusive instants
- `travelClassCode`
- `passengerCount`
- `limit`

`passengerCount` and `limit` must be positive integers when supplied. `departureTo` must not precede `departureFrom`. The default limit is 20. The maximum is 100.

Results are ordered by departure, then flight number. A flight is included only when its status is `SCHEDULED` or `DELAYED` and its departure is strictly after the search reference time. A `SCHEDULED` flight that has already departed is excluded, even if its status was never updated.

`searchFlights` takes a clock and uses `clock.now()` as that reference time. The default clock is the current time. Tests pass a fixed clock so results do not depend on the wall clock. The instant is copied before the query. `getFlight` and `getFlightAvailability` still read a flight in any status, including one that has already departed.

A missing voyage or flight throws `VoyageNotFoundError` or `FlightNotFoundError`. Invalid criteria throws `InvalidSearchCriteriaError`. Search with no matches returns an empty array.

## Passenger count

`passengerCount` is the number of currently available accommodations required in a single travel class.

With `travelClassCode`, that class must have at least that many open seats. Without it, the flight qualifies when at least one of its classes can hold the party. Available seats are not added across classes. Two Voyager seats and two Voyager+ seats do not satisfy a party of four, because a reservation uses one class.

A travel class without a passenger count returns flights that offer that class. A Meridian flight has no Celestial accommodations, so it is excluded from a Celestial search. Matching flights still list every class they offer.

## Availability and price

Availability is derived. An accommodation is occupied when a reservation passenger references it and the reservation is `HELD`, `CONFIRMED`, or `COMPLETED`. `CANCELLED` releases it and does not reduce the available count. `COMPLETED` still occupies the seat, so the seat is not offered again. It does not put an arrived trip back into search results, because those flights are not `SCHEDULED` or `DELAYED`.

There is no stored `availableSeats` value.

The fare per passenger is `multiplyMoney(voyage.baseFare, travelClass.fareMultiplier)`. Ares is `1_250_000` cents in Voyager, `1_750_000` in Voyager+, and `3_125_000` in Celestial. Returned dates are copies.

`searchFlights` and `getFlight` return compact class summaries: code, name, fare, and available count. `getFlightAvailability` adds the total count and the codes of the open accommodations, such as `P04`. It does not list occupied seats or database ids.

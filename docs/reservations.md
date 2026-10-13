# Reservation retrieval and cancellation

`getReservation` and `cancelReservation` are application operations. A future HTTP API, operations dashboard, or Nova calls them. They do not query Prisma themselves, and a confirmation code is not an authorization check. That check belongs at the future interface boundary.

## Retrieval

`getReservation(confirmationCode)` returns the stored reservation: customer, flight, voyage, travel class, passengers, accommodation codes, fare snapshots, total, status, and timestamps. Prices are the amounts saved at booking time, not a new quote from the current catalog. Passengers are ordered by accommodation code. Dates returned to the caller are copies. Internal ids are omitted.

The public read is one SQL statement. Status, timestamps, passengers, and fare snapshots come from that statement together, so a retrieval overlapping a cancellation sees either the committed reservation before the cancellation or the committed reservation after it.

A blank code raises `InvalidReservationError`. An unknown code raises `ReservationNotFoundError`.

## Lifecycle

| Status | Before departure | After departure |
| --- | --- | --- |
| `HELD` | May be cancelled | Cannot be cancelled |
| `CONFIRMED` | May be cancelled | Cannot be cancelled |
| `CANCELLED` | Stays cancelled | Stays cancelled |
| `COMPLETED` | Cannot be cancelled | Cannot be cancelled |

Departure is strictly after the cancellation clock. The default clock is the current time. Tests pass a fixed clock. There is no fee, refund, or notification in this version.

Cancelling a `HELD` or `CONFIRMED` reservation sets its status to `CANCELLED` and sets `updatedAt` to the clock instant. The customer, passengers, and accommodation assignments remain. `HELD`, `CONFIRMED`, and `COMPLETED` occupy a seat. `CANCELLED` does not, so those seats become available to a later booking. The cancelled assignment stays on the reservation as history.

Cancelling a reservation that is already `CANCELLED` returns the stored reservation and does not change `updatedAt`. `CancellationNotAllowedError` means the reservation is `COMPLETED` or the flight has already departed. The row is left unchanged.

## Concurrency

Cancellation locks the reservation row with `SELECT … FOR UPDATE` before it reads status or decides whether cancellation is allowed. A second cancellation waits for that lock. After the first commit, the second read sees `CANCELLED` and returns without another write.

Cancellation does not lock accommodation rows. Booking claims seats with `SELECT … FOR UPDATE OF fa SKIP LOCKED`, then inserts a new reservation. Locking those same rows during cancellation would deadlock with that order. A booking that still sees the reservation as occupied, because the cancellation has not committed, can receive `InsufficientAvailabilityError`. After the cancellation commits, a new booking can lock and claim the released accommodation. Committed state still has at most one occupying assignment per accommodation.

The value returned by `cancelReservation` is the reservation state from that same transaction: the locked row, its passenger fare snapshots, and the status and `updatedAt` that were committed.

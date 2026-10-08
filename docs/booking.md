# Confirmed reservation booking

`createConfirmedReservation` is the application operation that books a flight. A future HTTP API or Nova calls it. They do not choose prices, accommodation ids, or reservation status.

The caller supplies:

- flight number
- travel class code
- customer first name, last name, email, and phone
- one or more passengers, each with a first and last name

Voyara resolves the flight, checks that it is bookable, prices each passenger as `voyage.baseFare × travelClass.fareMultiplier`, and assigns the lowest available accommodation codes in that class. The reservation is stored as `CONFIRMED`. The result includes the confirmation code, flight, voyage, class, each passenger's accommodation code and fare, and the total. It does not include internal ids.

A flight is bookable when its status is `SCHEDULED` or `DELAYED` and its departure is strictly after the booking clock. The default clock is the current time. Tests pass a fixed clock.

`HELD`, `CONFIRMED`, and `COMPLETED` reservations occupy an accommodation. `CANCELLED` assignments remain as history and do not block a new booking.

The booking runs in one database transaction. Available accommodations are locked with `SELECT … FOR UPDATE OF fa SKIP LOCKED`, ordered by accommodation code. Another booking skips those locked rows and takes the next free codes. If too few free rows remain, the attempt throws `InsufficientAvailabilityError` and inserts nothing. The booking does not wait for locks to be released.

This allocation is safe only when every write that claims an accommodation uses the same locking protocol: select the free rows with `FOR UPDATE SKIP LOCKED`, then insert the occupying assignment in that same transaction. A path that inserts a `HELD`, `CONFIRMED`, or `COMPLETED` assignment without taking that lock can claim a seat another transaction has already selected. Future hold and modification operations must follow this rule. Cancelled assignments stay in place and do not take the lock.

Confirmation codes are generated and inserted. `reservations.confirmation_code` is unique. If two attempts generate the same code, PostgreSQL rejects the insert, the transaction rolls back, and the booking tries a new code. That retry is bounded and stays in the persistence adapter. Prisma errors are not returned to the caller.

Other failures use `InvalidBookingError`, `FlightNotFoundError`, `FlightNotBookableError`, and `UnsupportedTravelClassError`.

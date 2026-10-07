import { ReservationStatus } from "../../domain/reservations/reservation-status.js";
import { voyageByCode } from "./catalog.js";
import {
  addUtcDays,
  normalizeUtcDay,
  type ScheduledFlight,
  type ScheduleResult,
} from "./schedule.js";

const activeClaimStatuses = new Set<string>([
  ReservationStatus.Held,
  ReservationStatus.Confirmed,
]);

export type DemoCustomer = {
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly phone: string;
};

export type DemoPassenger = {
  readonly firstName: string;
  readonly lastName: string;
  readonly accommodationCode: string;
};

export type DemoReservationPlan = {
  readonly confirmationCode: string;
  readonly flightNumber: string;
  readonly voyageCode: string;
  readonly travelClassCode: string;
  readonly status: ReservationStatus;
  readonly customer: DemoCustomer;
  readonly passengers: readonly DemoPassenger[];
};

export function selectAresDemoFlight(
  schedule: ScheduleResult,
  anchor: Date,
): ScheduledFlight {
  const target = addUtcDays(normalizeUtcDay(anchor), 30).getTime();
  const aresFlights = schedule.flights.filter(
    (flight) => flight.voyageCode === "ORB-07",
  );
  const first = aresFlights[0];

  if (first === undefined) {
    throw new Error("The schedule has no Ares flight.");
  }

  return aresFlights.reduce((closest, flight) => {
    const closestDistance = Math.abs(closest.departureAt.getTime() - target);
    const flightDistance = Math.abs(flight.departureAt.getTime() - target);

    if (flightDistance < closestDistance) {
      return flight;
    }

    if (
      flightDistance === closestDistance &&
      flight.departureAt.getTime() < closest.departureAt.getTime()
    ) {
      return flight;
    }

    return closest;
  }, first);
}

export function buildDemoScenarios(
  schedule: ScheduleResult,
  anchor: Date,
): readonly DemoReservationPlan[] {
  const ares = selectAresDemoFlight(schedule, anchor);
  const earthlight = requireFlight(schedule, "ORB-01", 0);
  const blueHorizon = requireFlight(schedule, "ORB-02", 0);
  const polar = requireFlight(schedule, "ORB-03", 0);
  const lunar = requireFlight(schedule, "ORB-04", 0);
  const laterLunar = requireFlight(schedule, "ORB-04", 1);
  const solar = requireFlight(schedule, "ORB-05", 0);
  const europa = requireFlight(schedule, "ORB-08", 0);
  const titan = requireFlight(schedule, "ORB-09", 0);
  const grandTour = requireFlight(schedule, "ORB-10", 0);

  const plans: DemoReservationPlan[] = [
    reservation({
      confirmationCode: "DLY-ARES",
      flight: ares,
      travelClassCode: "VOYAGER_PLUS",
      status: ReservationStatus.Confirmed,
      customer: person("Dolly", "Hart", "dolly.hart@example.test", "+1-555-0101"),
      passengers: [
        seat("Dolly", "Hart", "P01"),
        seat("Mina", "Hart", "P02"),
        seat("Theo", "Hart", "P03"),
      ],
    }),
    reservation({
      confirmationCode: "NOR-ARES",
      flight: ares,
      travelClassCode: "VOYAGER_PLUS",
      status: ReservationStatus.Confirmed,
      customer: person("Nora", "Hale", "nora.hale@example.test", "+1-555-0102"),
      passengers: [
        seat("Nora", "Hale", "P05"),
        seat("Ivo", "Hale", "P06"),
        seat("June", "Hale", "P07"),
      ],
    }),
    reservation({
      confirmationCode: "SAM-ARES",
      flight: ares,
      travelClassCode: "VOYAGER_PLUS",
      status: ReservationStatus.Confirmed,
      customer: person("Sam", "Idris", "sam.idris@example.test", "+1-555-0103"),
      passengers: [seat("Sam", "Idris", "P11")],
    }),
    reservation({
      confirmationCode: "REN-ARES",
      flight: ares,
      travelClassCode: "VOYAGER_PLUS",
      status: ReservationStatus.Confirmed,
      customer: person("Ren", "Cho", "ren.cho@example.test", "+1-555-0104"),
      passengers: [seat("Ren", "Cho", "P15"), seat("Ari", "Cho", "P16")],
    }),
    reservation({
      confirmationCode: "PRI-EARTH",
      flight: earthlight,
      travelClassCode: "VOYAGER",
      status: ReservationStatus.Confirmed,
      customer: person("Priya", "Shah", "priya.shah@example.test", "+1-555-0105"),
      passengers: [seat("Priya", "Shah", "V01")],
    }),
    reservation({
      confirmationCode: "ALX-BLUE",
      flight: blueHorizon,
      travelClassCode: "VOYAGER",
      status: ReservationStatus.Confirmed,
      customer: person(
        "Alex",
        "Example",
        "alex.example@example.test",
        "+1-555-0106",
      ),
      passengers: [
        seat("Jamie", "Example", "V01"),
        seat("Taylor", "Example", "V02"),
      ],
    }),
    reservation({
      confirmationCode: "CAM-LUNA",
      flight: lunar,
      travelClassCode: "CELESTIAL",
      status: ReservationStatus.Confirmed,
      customer: person(
        "Camille",
        "Ortiz",
        "camille.ortiz@example.test",
        "+1-555-0107",
      ),
      passengers: [seat("Camille", "Ortiz", "C01"), seat("Noor", "Ortiz", "C02")],
    }),
    reservation({
      confirmationCode: "JON-SOL",
      flight: solar,
      travelClassCode: "VOYAGER",
      status: ReservationStatus.Held,
      customer: person(
        "Jonah",
        "Ellis",
        "jonah.ellis@example.test",
        "+1-555-0108",
      ),
      passengers: [seat("Jonah", "Ellis", "V01")],
    }),
    reservation({
      confirmationCode: "MOR-CAN",
      flight: polar,
      travelClassCode: "VOYAGER",
      status: ReservationStatus.Cancelled,
      customer: person(
        "Morgan",
        "Blake",
        "morgan.blake@example.test",
        "+1-555-0109",
      ),
      passengers: [seat("Morgan", "Blake", "V01")],
    }),
    reservation({
      confirmationCode: "RIL-POL",
      flight: polar,
      travelClassCode: "VOYAGER",
      status: ReservationStatus.Confirmed,
      customer: person(
        "Riley",
        "Quinn",
        "riley.quinn@example.test",
        "+1-555-0110",
      ),
      passengers: [seat("Riley", "Quinn", "V01")],
    }),
    reservation({
      confirmationCode: "SAS-TOUR",
      flight: grandTour,
      travelClassCode: "VOYAGER",
      status: ReservationStatus.Confirmed,
      customer: person(
        "Sasha",
        "Nguyen",
        "sasha.nguyen@example.test",
        "+1-555-0111",
      ),
      passengers: [seat("Sasha", "Nguyen", "V01")],
    }),
    filledClass({
      confirmationCode: "EUR-V",
      flight: europa,
      travelClassCode: "VOYAGER",
      customer: person(
        "Europa",
        "Charter",
        "europa.charter@example.test",
        "+1-555-0112",
      ),
    }),
    filledClass({
      confirmationCode: "EUR-P",
      flight: europa,
      travelClassCode: "VOYAGER_PLUS",
      customer: person(
        "Europa",
        "Charter",
        "europa.charter@example.test",
        "+1-555-0112",
      ),
    }),
    filledClass({
      confirmationCode: "EUR-C",
      flight: europa,
      travelClassCode: "CELESTIAL",
      customer: person(
        "Europa",
        "Charter",
        "europa.charter@example.test",
        "+1-555-0112",
      ),
    }),
    filledClass({
      confirmationCode: "TIT-V",
      flight: titan,
      travelClassCode: "VOYAGER",
      customer: person(
        "Titan",
        "Charter",
        "titan.charter@example.test",
        "+1-555-0113",
      ),
    }),
    filledClass({
      confirmationCode: "TIT-P",
      flight: titan,
      travelClassCode: "VOYAGER_PLUS",
      customer: person(
        "Titan",
        "Charter",
        "titan.charter@example.test",
        "+1-555-0113",
      ),
    }),
    partialClass({
      confirmationCode: "TIT-C",
      flight: titan,
      travelClassCode: "CELESTIAL",
      keepOpen: 2,
      customer: person(
        "Titan",
        "Charter",
        "titan.charter@example.test",
        "+1-555-0113",
      ),
    }),
    filledClass({
      confirmationCode: "HOR-MOD",
      flight: laterLunar,
      travelClassCode: "VOYAGER",
      customer: person(
        "Horizon",
        "Charter",
        "horizon.charter@example.test",
        "+1-555-0114",
      ),
    }),
    partialClass({
      confirmationCode: "POL-PART",
      flight: polar,
      travelClassCode: "VOYAGER",
      codes: ["V02", "V03", "V04", "V05", "V06", "V07", "V08"],
      customer: person(
        "Meridian",
        "Charter",
        "meridian.charter@example.test",
        "+1-555-0115",
      ),
    }),
  ];

  const duplicates = duplicateActiveClaims(plans);

  if (duplicates.length > 0) {
    throw new Error(
      `Demo scenarios assign more than one active claim: ${duplicates.join(", ")}.`,
    );
  }

  return plans;
}

export function duplicateActiveClaims(
  plans: readonly DemoReservationPlan[],
): string[] {
  const claims = new Map<string, number>();

  for (const plan of plans) {
    if (!activeClaimStatuses.has(plan.status)) {
      continue;
    }

    for (const passenger of plan.passengers) {
      const key = `${plan.flightNumber}:${passenger.accommodationCode}`;
      claims.set(key, (claims.get(key) ?? 0) + 1);
    }
  }

  return [...claims.entries()]
    .filter(([, count]) => count > 1)
    .map(([key]) => key);
}

function requireFlight(
  schedule: ScheduleResult,
  voyageCode: string,
  index: number,
): ScheduledFlight {
  const flights = schedule.flights.filter(
    (flight) => flight.voyageCode === voyageCode,
  );
  const flight = flights[index];

  if (flight === undefined) {
    throw new Error(
      `Schedule is missing ${voyageByCode(voyageCode).name} flight ${index + 1}.`,
    );
  }

  return flight;
}

function person(
  firstName: string,
  lastName: string,
  email: string,
  phone: string,
): DemoCustomer {
  return { firstName, lastName, email, phone };
}

function seat(
  firstName: string,
  lastName: string,
  accommodationCode: string,
): DemoPassenger {
  return { firstName, lastName, accommodationCode };
}

function reservation(input: {
  confirmationCode: string;
  flight: ScheduledFlight;
  travelClassCode: string;
  status: ReservationStatus;
  customer: DemoCustomer;
  passengers: readonly DemoPassenger[];
}): DemoReservationPlan {
  for (const passenger of input.passengers) {
    const accommodation = input.flight.accommodations.find(
      (item) => item.code === passenger.accommodationCode,
    );

    if (
      accommodation === undefined ||
      accommodation.travelClassCode !== input.travelClassCode
    ) {
      throw new Error(
        `${input.confirmationCode} references ${passenger.accommodationCode}, which is not a ${input.travelClassCode} seat on ${input.flight.flightNumber}.`,
      );
    }
  }

  return {
    confirmationCode: input.confirmationCode,
    flightNumber: input.flight.flightNumber,
    voyageCode: input.flight.voyageCode,
    travelClassCode: input.travelClassCode,
    status: input.status,
    customer: input.customer,
    passengers: input.passengers,
  };
}

function filledClass(input: {
  confirmationCode: string;
  flight: ScheduledFlight;
  travelClassCode: string;
  customer: DemoCustomer;
}): DemoReservationPlan {
  return partialClass({ ...input, keepOpen: 0 });
}

function partialClass(input: {
  confirmationCode: string;
  flight: ScheduledFlight;
  travelClassCode: string;
  customer: DemoCustomer;
  keepOpen?: number;
  codes?: readonly string[];
}): DemoReservationPlan {
  const codes =
    input.codes ??
    input.flight.accommodations
      .filter((item) => item.travelClassCode === input.travelClassCode)
      .map((item) => item.code);
  const keepOpen = input.keepOpen ?? 0;
  const taken = codes.slice(0, codes.length - keepOpen);

  return reservation({
    confirmationCode: input.confirmationCode,
    flight: input.flight,
    travelClassCode: input.travelClassCode,
    status: ReservationStatus.Confirmed,
    customer: input.customer,
    passengers: taken.map((code) =>
      seat("Fixture", `${input.confirmationCode} ${code}`, code),
    ),
  });
}

import {
  familyCapacityCatalog,
  HORIZON_DAYS,
  TURNAROUND_MINUTES,
  vehicleCatalog,
  voyageCatalog,
} from "./catalog.js";

const dayMs = 24 * 60 * 60 * 1000;
const turnaroundMs = TURNAROUND_MINUTES * 60 * 1000;

const classOrder = ["VOYAGER", "VOYAGER_PLUS", "CELESTIAL"] as const;

const accommodationPrefix = {
  VOYAGER: "V",
  VOYAGER_PLUS: "P",
  CELESTIAL: "C",
} as const;

export type ScheduledAccommodation = {
  readonly travelClassCode: string;
  readonly code: string;
};

export type ScheduledFlight = {
  readonly voyageCode: string;
  readonly vehicleCode: string;
  readonly departureAt: Date;
  readonly returnAt: Date;
  readonly flightNumber: string;
  readonly accommodations: readonly ScheduledAccommodation[];
};

export type SkippedCandidate = {
  readonly voyageCode: string;
  readonly departureAt: Date;
};

export type ScheduleResult = {
  readonly flights: readonly ScheduledFlight[];
  readonly skipped: readonly SkippedCandidate[];
};

type VehicleState = {
  code: string;
  freeAt: number;
};

export function normalizeUtcDay(value: Date): Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error("Anchor must be a valid date.");
  }

  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

export function addUtcDays(day: Date, days: number): Date {
  return new Date(day.getTime() + days * dayMs);
}

export function generateSchedule(anchor: Date): ScheduleResult {
  const horizonStart = addUtcDays(normalizeUtcDay(anchor), 1);
  const candidates = voyageCatalog.flatMap((voyage) => {
    const departures: Array<{ voyageCode: string; departureAt: Date }> = [];

    for (let offset = 0; offset < HORIZON_DAYS; offset += voyage.intervalDays) {
      const day = addUtcDays(horizonStart, offset);
      departures.push({
        voyageCode: voyage.code,
        departureAt: new Date(
          Date.UTC(
            day.getUTCFullYear(),
            day.getUTCMonth(),
            day.getUTCDate(),
            voyage.hour,
            voyage.minute,
            0,
            0,
          ),
        ),
      });
    }

    return departures;
  });

  candidates.sort(
    (left, right) =>
      left.departureAt.getTime() - right.departureAt.getTime() ||
      left.voyageCode.localeCompare(right.voyageCode),
  );

  const fleets = new Map<string, VehicleState[]>();

  for (const vehicle of vehicleCatalog) {
    const fleet = fleets.get(vehicle.familyCode) ?? [];
    fleet.push({ code: vehicle.code, freeAt: 0 });
    fleets.set(vehicle.familyCode, fleet);
  }

  const flights: ScheduledFlight[] = [];
  const skipped: SkippedCandidate[] = [];

  for (const candidate of candidates) {
    const voyage = voyageCatalog.find(
      (item) => item.code === candidate.voyageCode,
    );

    if (voyage === undefined) {
      throw new Error(`Unknown voyage code ${candidate.voyageCode}.`);
    }

    const vehicle = takeVehicle(
      fleets.get(voyage.familyCode) ?? [],
      candidate.departureAt.getTime(),
    );

    if (vehicle === undefined) {
      skipped.push({
        voyageCode: candidate.voyageCode,
        departureAt: candidate.departureAt,
      });
      continue;
    }

    const returnAt = new Date(
      candidate.departureAt.getTime() + voyage.durationMinutes * 60 * 1000,
    );
    vehicle.freeAt = returnAt.getTime() + turnaroundMs;
    const flightNumber = `VY-${1001 + flights.length}`;

    flights.push({
      voyageCode: voyage.code,
      vehicleCode: vehicle.code,
      departureAt: candidate.departureAt,
      returnAt,
      flightNumber,
      accommodations: accommodationsFor(voyage.familyCode),
    });
  }

  return { flights, skipped };
}

function takeVehicle(
  fleet: readonly VehicleState[],
  departureMs: number,
): VehicleState | undefined {
  const available = fleet
    .filter((vehicle) => vehicle.freeAt <= departureMs)
    .sort(
      (left, right) =>
        left.freeAt - right.freeAt || left.code.localeCompare(right.code),
    );

  return available[0];
}

function accommodationsFor(familyCode: string): ScheduledAccommodation[] {
  const accommodations: ScheduledAccommodation[] = [];

  for (const travelClassCode of classOrder) {
    const capacity = familyCapacityCatalog.find(
      (item) =>
        item.familyCode === familyCode &&
        item.travelClassCode === travelClassCode,
    );

    if (capacity === undefined) {
      continue;
    }

    const prefix = accommodationPrefix[travelClassCode];

    for (let number = 1; number <= capacity.capacity; number += 1) {
      accommodations.push({
        travelClassCode,
        code: `${prefix}${String(number).padStart(2, "0")}`,
      });
    }
  }

  return accommodations;
}

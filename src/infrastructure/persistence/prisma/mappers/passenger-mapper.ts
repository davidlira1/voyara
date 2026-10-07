import type { Passenger as PassengerRecord } from "../../../../../generated/prisma/client.js";
import {
  createPassenger,
  type Passenger,
} from "../../../../domain/passengers/passenger.js";

export function passengerToDomain(record: PassengerRecord): Passenger {
  return createPassenger({
    id: record.id,
    firstName: record.firstName,
    lastName: record.lastName,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

export function passengerToPersistence(passenger: Passenger): {
  id: string;
  firstName: string;
  lastName: string;
  createdAt: Date;
  updatedAt: Date;
} {
  return {
    id: passenger.id,
    firstName: passenger.firstName,
    lastName: passenger.lastName,
    createdAt: passenger.createdAt,
    updatedAt: passenger.updatedAt,
  };
}

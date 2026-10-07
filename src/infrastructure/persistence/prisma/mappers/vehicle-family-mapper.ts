import type {
  VehicleFamily as VehicleFamilyRecord,
  VehicleFamilyTravelClass as VehicleFamilyTravelClassRecord,
} from "../../../../../generated/prisma/client.js";
import {
  createVehicleFamily,
  type VehicleFamily,
} from "../../../../domain/vehicles/vehicle-family.js";
import {
  createVehicleFamilyTravelClass,
  type VehicleFamilyTravelClass,
} from "../../../../domain/vehicles/vehicle-family-travel-class.js";

export function vehicleFamilyToDomain(
  record: VehicleFamilyRecord,
): VehicleFamily {
  return createVehicleFamily({
    id: record.id,
    code: record.code,
    name: record.name,
  });
}

export function vehicleFamilyToPersistence(family: VehicleFamily): {
  id: string;
  code: string;
  name: string;
} {
  return {
    id: family.id,
    code: family.code,
    name: family.name,
  };
}

export function vehicleFamilyTravelClassToDomain(
  record: VehicleFamilyTravelClassRecord,
): VehicleFamilyTravelClass {
  return createVehicleFamilyTravelClass({
    id: record.id,
    vehicleFamilyId: record.vehicleFamilyId,
    travelClassId: record.travelClassId,
    capacity: record.capacity,
  });
}

export function vehicleFamilyTravelClassToPersistence(
  travelClass: VehicleFamilyTravelClass,
): {
  id: string;
  vehicleFamilyId: string;
  travelClassId: string;
  capacity: number;
} {
  return {
    id: travelClass.id,
    vehicleFamilyId: travelClass.vehicleFamilyId,
    travelClassId: travelClass.travelClassId,
    capacity: travelClass.capacity,
  };
}

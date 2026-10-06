-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "vehicle_status" AS ENUM ('ACTIVE', 'MAINTENANCE', 'RETIRED');

-- CreateEnum
CREATE TYPE "flight_status" AS ENUM ('SCHEDULED', 'BOARDING', 'DEPARTED', 'IN_FLIGHT', 'RETURNING', 'ARRIVED', 'DELAYED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "reservation_status" AS ENUM ('HELD', 'CONFIRMED', 'CANCELLED', 'COMPLETED');

-- CreateTable
CREATE TABLE "voyages" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "base_fare_amount_minor" BIGINT NOT NULL,
    "base_fare_currency" CHAR(3) NOT NULL,

    CONSTRAINT "voyages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "travel_classes" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fare_multiplier_numerator" INTEGER NOT NULL,
    "fare_multiplier_denominator" INTEGER NOT NULL,

    CONSTRAINT "travel_classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_families" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "vehicle_families_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_family_travel_classes" (
    "id" UUID NOT NULL,
    "vehicle_family_id" UUID NOT NULL,
    "travel_class_id" UUID NOT NULL,
    "capacity" INTEGER NOT NULL,

    CONSTRAINT "vehicle_family_travel_classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vehicle_family_id" UUID NOT NULL,
    "status" "vehicle_status" NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flights" (
    "id" UUID NOT NULL,
    "flight_number" TEXT NOT NULL,
    "voyage_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "departure_at" TIMESTAMPTZ(3) NOT NULL,
    "return_at" TIMESTAMPTZ(3) NOT NULL,
    "status" "flight_status" NOT NULL,

    CONSTRAINT "flights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flight_accommodations" (
    "id" UUID NOT NULL,
    "flight_id" UUID NOT NULL,
    "travel_class_id" UUID NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "flight_accommodations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "passengers" (
    "id" UUID NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "passengers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "id" UUID NOT NULL,
    "confirmation_code" TEXT NOT NULL,
    "customer_id" UUID NOT NULL,
    "flight_id" UUID NOT NULL,
    "travel_class_id" UUID NOT NULL,
    "status" "reservation_status" NOT NULL,
    "total_price_amount_minor" BIGINT NOT NULL,
    "total_price_currency" CHAR(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservation_passengers" (
    "id" UUID NOT NULL,
    "reservation_id" UUID NOT NULL,
    "passenger_id" UUID NOT NULL,
    "flight_accommodation_id" UUID NOT NULL,
    "flight_id" UUID NOT NULL,
    "travel_class_id" UUID NOT NULL,
    "fare_amount_minor" BIGINT NOT NULL,
    "fare_currency" CHAR(3) NOT NULL,

    CONSTRAINT "reservation_passengers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "voyages_code_key" ON "voyages"("code");

-- CreateIndex
CREATE UNIQUE INDEX "travel_classes_code_key" ON "travel_classes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_families_code_key" ON "vehicle_families"("code");

-- CreateIndex
CREATE INDEX "vehicle_family_travel_classes_travel_class_id_idx" ON "vehicle_family_travel_classes"("travel_class_id");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_family_travel_classes_vehicle_family_id_travel_clas_key" ON "vehicle_family_travel_classes"("vehicle_family_id", "travel_class_id");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_code_key" ON "vehicles"("code");

-- CreateIndex
CREATE INDEX "vehicles_vehicle_family_id_idx" ON "vehicles"("vehicle_family_id");

-- CreateIndex
CREATE UNIQUE INDEX "flights_flight_number_key" ON "flights"("flight_number");

-- CreateIndex
CREATE INDEX "flights_voyage_id_idx" ON "flights"("voyage_id");

-- CreateIndex
CREATE INDEX "flights_vehicle_id_idx" ON "flights"("vehicle_id");

-- CreateIndex
CREATE INDEX "flight_accommodations_travel_class_id_idx" ON "flight_accommodations"("travel_class_id");

-- CreateIndex
CREATE UNIQUE INDEX "flight_accommodations_flight_id_code_key" ON "flight_accommodations"("flight_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "flight_accommodations_id_flight_id_travel_class_id_key" ON "flight_accommodations"("id", "flight_id", "travel_class_id");

-- CreateIndex
CREATE INDEX "customers_email_idx" ON "customers"("email");

-- CreateIndex
CREATE INDEX "customers_phone_idx" ON "customers"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "reservations_confirmation_code_key" ON "reservations"("confirmation_code");

-- CreateIndex
CREATE INDEX "reservations_customer_id_idx" ON "reservations"("customer_id");

-- CreateIndex
CREATE INDEX "reservations_flight_id_idx" ON "reservations"("flight_id");

-- CreateIndex
CREATE INDEX "reservations_travel_class_id_idx" ON "reservations"("travel_class_id");

-- CreateIndex
CREATE UNIQUE INDEX "reservations_id_flight_id_travel_class_id_key" ON "reservations"("id", "flight_id", "travel_class_id");

-- CreateIndex
CREATE INDEX "reservation_passengers_passenger_id_idx" ON "reservation_passengers"("passenger_id");

-- CreateIndex
CREATE INDEX "reservation_passengers_flight_accommodation_id_idx" ON "reservation_passengers"("flight_accommodation_id");

-- CreateIndex
CREATE UNIQUE INDEX "reservation_passengers_reservation_id_passenger_id_key" ON "reservation_passengers"("reservation_id", "passenger_id");

-- AddForeignKey
ALTER TABLE "vehicle_family_travel_classes" ADD CONSTRAINT "vehicle_family_travel_classes_vehicle_family_id_fkey" FOREIGN KEY ("vehicle_family_id") REFERENCES "vehicle_families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_family_travel_classes" ADD CONSTRAINT "vehicle_family_travel_classes_travel_class_id_fkey" FOREIGN KEY ("travel_class_id") REFERENCES "travel_classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_vehicle_family_id_fkey" FOREIGN KEY ("vehicle_family_id") REFERENCES "vehicle_families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flights" ADD CONSTRAINT "flights_voyage_id_fkey" FOREIGN KEY ("voyage_id") REFERENCES "voyages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flights" ADD CONSTRAINT "flights_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flight_accommodations" ADD CONSTRAINT "flight_accommodations_flight_id_fkey" FOREIGN KEY ("flight_id") REFERENCES "flights"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flight_accommodations" ADD CONSTRAINT "flight_accommodations_travel_class_id_fkey" FOREIGN KEY ("travel_class_id") REFERENCES "travel_classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_flight_id_fkey" FOREIGN KEY ("flight_id") REFERENCES "flights"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_travel_class_id_fkey" FOREIGN KEY ("travel_class_id") REFERENCES "travel_classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_passengers" ADD CONSTRAINT "reservation_passengers_reservation_id_flight_id_travel_cla_fkey" FOREIGN KEY ("reservation_id", "flight_id", "travel_class_id") REFERENCES "reservations"("id", "flight_id", "travel_class_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_passengers" ADD CONSTRAINT "reservation_passengers_passenger_id_fkey" FOREIGN KEY ("passenger_id") REFERENCES "passengers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_passengers" ADD CONSTRAINT "reservation_passengers_flight_accommodation_id_flight_id_t_fkey" FOREIGN KEY ("flight_accommodation_id", "flight_id", "travel_class_id") REFERENCES "flight_accommodations"("id", "flight_id", "travel_class_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Domain checks that Prisma schema cannot declare.
ALTER TABLE "voyages" ADD CONSTRAINT "voyages_duration_minutes_positive" CHECK ("duration_minutes" > 0);
ALTER TABLE "voyages" ADD CONSTRAINT "voyages_base_fare_non_negative" CHECK ("base_fare_amount_minor" >= 0);
ALTER TABLE "voyages" ADD CONSTRAINT "voyages_base_fare_currency_usd" CHECK ("base_fare_currency" = 'USD');

ALTER TABLE "travel_classes" ADD CONSTRAINT "travel_classes_fare_multiplier_numerator_positive" CHECK ("fare_multiplier_numerator" > 0);
ALTER TABLE "travel_classes" ADD CONSTRAINT "travel_classes_fare_multiplier_denominator_positive" CHECK ("fare_multiplier_denominator" > 0);

ALTER TABLE "vehicle_family_travel_classes" ADD CONSTRAINT "vehicle_family_travel_classes_capacity_positive" CHECK ("capacity" > 0);

ALTER TABLE "flights" ADD CONSTRAINT "flights_return_after_departure" CHECK ("return_at" > "departure_at");

ALTER TABLE "reservations" ADD CONSTRAINT "reservations_total_price_non_negative" CHECK ("total_price_amount_minor" >= 0);
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_total_price_currency_usd" CHECK ("total_price_currency" = 'USD');

ALTER TABLE "reservation_passengers" ADD CONSTRAINT "reservation_passengers_fare_non_negative" CHECK ("fare_amount_minor" >= 0);
ALTER TABLE "reservation_passengers" ADD CONSTRAINT "reservation_passengers_fare_currency_usd" CHECK ("fare_currency" = 'USD');

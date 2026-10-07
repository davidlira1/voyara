export const HORIZON_DAYS = 365;
export const TURNAROUND_MINUTES = 4 * 60;

export const travelClassCatalog = [
  {
    code: "VOYAGER",
    name: "Voyager",
    numerator: 1,
    denominator: 1,
  },
  {
    code: "VOYAGER_PLUS",
    name: "Voyager+",
    numerator: 7,
    denominator: 5,
  },
  {
    code: "CELESTIAL",
    name: "Celestial",
    numerator: 5,
    denominator: 2,
  },
] as const;

export const voyageCatalog = [
  {
    code: "ORB-01",
    name: "Earthlight",
    description: "Low Earth orbit with panoramic Earth views",
    durationMinutes: 4 * 60,
    baseFareMinor: 120_000,
    familyCode: "MERIDIAN",
    intervalDays: 1,
    hour: 9,
    minute: 0,
  },
  {
    code: "ORB-02",
    name: "Blue Horizon",
    description: "High Earth orbit emphasizing full-Earth views",
    durationMinutes: 8 * 60,
    baseFareMinor: 240_000,
    familyCode: "MERIDIAN",
    intervalDays: 2,
    hour: 10,
    minute: 0,
  },
  {
    code: "ORB-03",
    name: "Polar Passage",
    description: "Polar orbit passing over both poles",
    durationMinutes: 10 * 60,
    baseFareMinor: 310_000,
    familyCode: "MERIDIAN",
    intervalDays: 3,
    hour: 8,
    minute: 0,
  },
  {
    code: "ORB-04",
    name: "Lunar Arc",
    description: "Circumlunar voyage around the far side of the Moon",
    durationMinutes: 18 * 60,
    baseFareMinor: 480_000,
    familyCode: "HORIZON",
    intervalDays: 4,
    hour: 11,
    minute: 0,
  },
  {
    code: "ORB-05",
    name: "Solar Passage",
    description: "Inner-system voyage optimized for solar observation",
    durationMinutes: 24 * 60,
    baseFareMinor: 650_000,
    familyCode: "HORIZON",
    intervalDays: 7,
    hour: 9,
    minute: 30,
  },
  {
    code: "ORB-06",
    name: "Aphrodite",
    description: "Close Venus flyby",
    durationMinutes: 30 * 60,
    baseFareMinor: 950_000,
    familyCode: "ODYSSEY",
    intervalDays: 10,
    hour: 8,
    minute: 30,
  },
  {
    code: "ORB-07",
    name: "Ares",
    description: "Mars flyby with extended observation window",
    durationMinutes: 40 * 60,
    baseFareMinor: 1_250_000,
    familyCode: "ODYSSEY",
    intervalDays: 14,
    hour: 10,
    minute: 30,
  },
  {
    code: "ORB-08",
    name: "Europa Passage",
    description: "Jupiter-system voyage featuring Europa and Jupiter",
    durationMinutes: 72 * 60,
    baseFareMinor: 1_900_000,
    familyCode: "ATLAS",
    intervalDays: 21,
    hour: 7,
    minute: 0,
  },
  {
    code: "ORB-09",
    name: "Titan Passage",
    description: "Saturn-system voyage featuring Saturn's rings and Titan",
    durationMinutes: 96 * 60,
    baseFareMinor: 2_400_000,
    familyCode: "ATLAS",
    intervalDays: 30,
    hour: 8,
    minute: 0,
  },
  {
    code: "ORB-10",
    name: "Grand Tour",
    description: "Voyara's flagship multi-planet deep-space experience",
    durationMinutes: 7 * 24 * 60,
    baseFareMinor: 3_800_000,
    familyCode: "ATLAS",
    intervalDays: 60,
    hour: 9,
    minute: 0,
  },
] as const;

export const vehicleFamilyCatalog = [
  { code: "MERIDIAN", name: "Meridian" },
  { code: "HORIZON", name: "Horizon" },
  { code: "ODYSSEY", name: "Odyssey" },
  { code: "ATLAS", name: "Atlas" },
] as const;

export const familyCapacityCatalog = [
  { familyCode: "MERIDIAN", travelClassCode: "VOYAGER", capacity: 48 },
  { familyCode: "MERIDIAN", travelClassCode: "VOYAGER_PLUS", capacity: 24 },
  { familyCode: "HORIZON", travelClassCode: "VOYAGER", capacity: 36 },
  { familyCode: "HORIZON", travelClassCode: "VOYAGER_PLUS", capacity: 16 },
  { familyCode: "HORIZON", travelClassCode: "CELESTIAL", capacity: 8 },
  { familyCode: "ODYSSEY", travelClassCode: "VOYAGER", capacity: 24 },
  { familyCode: "ODYSSEY", travelClassCode: "VOYAGER_PLUS", capacity: 16 },
  { familyCode: "ODYSSEY", travelClassCode: "CELESTIAL", capacity: 8 },
  { familyCode: "ATLAS", travelClassCode: "VOYAGER", capacity: 16 },
  { familyCode: "ATLAS", travelClassCode: "VOYAGER_PLUS", capacity: 12 },
  { familyCode: "ATLAS", travelClassCode: "CELESTIAL", capacity: 8 },
] as const;

export const vehicleCatalog = [
  "Meridian-01",
  "Meridian-02",
  "Meridian-03",
  "Meridian-04",
  "Horizon-01",
  "Horizon-02",
  "Horizon-03",
  "Odyssey-01",
  "Odyssey-02",
  "Odyssey-03",
  "Atlas-01",
  "Atlas-02",
].map((code) => ({
  code,
  name: code,
  familyCode: code.startsWith("Meridian")
    ? "MERIDIAN"
    : code.startsWith("Horizon")
      ? "HORIZON"
      : code.startsWith("Odyssey")
        ? "ODYSSEY"
        : "ATLAS",
}));

export type VoyageSpec = (typeof voyageCatalog)[number];

export function voyageByCode(code: string): VoyageSpec {
  const voyage = voyageCatalog.find((candidate) => candidate.code === code);

  if (voyage === undefined) {
    throw new Error(`Unknown voyage code ${code}.`);
  }

  return voyage;
}

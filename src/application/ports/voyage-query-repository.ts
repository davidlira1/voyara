export type VoyageFacts = {
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly durationMinutes: number;
  readonly baseFareAmountMinor: number;
};

export type VoyageQueryRepository = {
  list(): Promise<readonly VoyageFacts[]>;
  findByCode(code: string): Promise<VoyageFacts | null>;
};

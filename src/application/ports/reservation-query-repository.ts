export type ReservationPassengerFacts = {
  readonly firstName: string;
  readonly lastName: string;
  readonly accommodationCode: string;
  readonly fareAmountMinor: number;
};

export type ReservationFacts = {
  readonly confirmationCode: string;
  readonly status: string;
  readonly customerFirstName: string;
  readonly customerLastName: string;
  readonly customerEmail: string;
  readonly customerPhone: string;
  readonly flightNumber: string;
  readonly departureAt: Date;
  readonly returnAt: Date;
  readonly flightStatus: string;
  readonly voyageCode: string;
  readonly voyageName: string;
  readonly travelClassCode: string;
  readonly travelClassName: string;
  readonly passengers: readonly ReservationPassengerFacts[];
  readonly totalPriceAmountMinor: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type ReservationQueryRepository = {
  findByConfirmationCode(confirmationCode: string): Promise<ReservationFacts | null>;
};

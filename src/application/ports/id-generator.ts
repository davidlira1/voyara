export type IdGenerator = {
  newId(): string;
  newConfirmationCode(): string;
};

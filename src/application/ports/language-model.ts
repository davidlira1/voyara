export type LanguageModelRequest = {
  readonly systemInstruction: string;
  readonly userMessage: string;
  readonly maxOutputTokens: number;
  readonly signal: AbortSignal;
};

export type LanguageModel = {
  generate(input: LanguageModelRequest): Promise<string>;
};

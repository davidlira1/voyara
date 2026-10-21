# Nova

Nova is Voyara's flight concierge. This version answers one text message. It does not search flights, check availability or prices, read or change reservations, or remember the conversation.

Nova cannot see live Voyara records. It must not invent flight numbers, fares, seat counts, or confirmation codes. If a customer asks for those, Nova says it cannot check live Voyara records yet.

## Setup

Copy `.env.example` to `.env` and set:

- `VOYARA_DEV_ACCESS_TOKEN`, the same local development token used by the other protected routes. It is not customer authentication, and it must not be embedded in a browser.
- `GEMINI_API_KEY`, a Gemini API key that stays on the server. Do not commit it or send it to the browser.
- `GEMINI_MODEL`, optional. The default is `gemini-2.5-flash`.
- `NOVA_TIMEOUT_MS`, optional. The default is 20000, and the allowed range is 1000 to 120000.

`npm start` refuses to boot when `GEMINI_API_KEY` is missing. Automated tests do not call Gemini. They use a fake language model.

Prepare the database, then start the server:

```text
npm run db:setup
npm start
```

The server listens on `http://127.0.0.1:3000` unless `HOST` or `PORT` is set. Stop it with `Ctrl-C`.

## One live conversation

```text
curl -X POST http://127.0.0.1:3000/api/nova/chat \
  -H "Authorization: Bearer $VOYARA_DEV_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"I want to see Mars."}'
```

A successful response is `200`:

```json
{ "reply": "..." }
```

The request accepts only `message`. A message must be a non-blank string of at most 2000 characters. The reply is capped at 4000 characters. Nova's instructions are fixed on the server and are not part of the request.

Missing or wrong development tokens return `401` and do not call the model. An invalid message returns `400`. If Gemini fails or returns nothing usable, the response is `502` with `Nova is unavailable.` If the call exceeds the timeout, the response is `504` with `Nova took too long to respond.` Those bodies do not include the API key, the user message, or the provider payload.

Logs record the method, the route template, the status, and, for a server-side failure, the error name. They do not record the message, the reply, or the API key.

## Gemini client

Nova calls Gemini's `generateContent` REST method with Node's `fetch`. The official Google Gen AI SDK is not a dependency. This call is one JSON body: the fixed system instruction and a single user message. Keeping it as REST leaves the provider behind the `LanguageModel` port, makes the timeout and error mapping explicit, and avoids an SDK for a request that does not use tools.

A timeout while connecting, waiting for headers, or reading the response body becomes `504`. Any other Gemini failure, including a non-OK status or an unusable payload, becomes `502`. Neither error includes the API key or the provider body.

Tool calling in M5.2 should adopt the official SDK behind the same port. Function declarations and tool results are easy to get wrong in hand-written JSON, and the SDK is the maintained client for that protocol. There is no reason to replace this single-turn REST call before those tools exist.

// Supabase and Postgres speak to developers. These are the failures a person
// using Opervia can actually meet, said plainly. Anything unrecognised is passed
// through unchanged rather than hidden behind a generic message.
const ERROR_MESSAGES: [RegExp, string][] = [
  [
    /failed to fetch|network ?error|fetch failed|ERR_INTERNET|ERR_NETWORK/i,
    "Opervia could not reach the internet. Check your connection, then try again.",
  ],
  [
    /timeout|timed out|ETIMEDOUT/i,
    "The connection took too long. Check your signal, then try again.",
  ],
  [
    /jwt|token is expired|invalid claim|session (has )?expired|not authenticated|JWSError/i,
    "Your session has ended. Sign in again to continue.",
  ],
  [
    /row-level security|permission denied|insufficient privilege|42501/i,
    "This record belongs to another account, so it cannot be changed here.",
  ],
  [
    /duplicate key|already exists|23505/i,
    "That record already exists. Refresh to see the current version.",
  ],
  [
    /violates foreign key|23503/i,
    "Something this record depends on is missing. Refresh and try again.",
  ],
  [
    /violates check constraint|23514|invalid input syntax|22P02/i,
    "One of the values entered is not valid. Check the amounts and dates, then try again.",
  ],
  [
    /rate limit|too many requests|429/i,
    "Too many attempts in a short time. Wait a moment, then try again.",
  ],
  [
    /5\d\d|internal server error|service unavailable|upstream/i,
    "The service is temporarily unavailable. Your records are safe. Try again in a moment.",
  ],
];
export function plainError(raw: string) {
  for (const [pattern, message] of ERROR_MESSAGES)
    if (pattern.test(raw)) return message;
  return null;
}
/** Turns anything thrown by the API layer into a sentence worth showing. */
export function errorText(e: unknown) {
  const raw =
    e instanceof Error
      ? e.message
      : typeof e === "object" && e && "message" in e
        ? String(e.message)
        : "";
  if (!raw) return "Something went wrong. Please try again.";
  return plainError(raw) ?? raw;
}

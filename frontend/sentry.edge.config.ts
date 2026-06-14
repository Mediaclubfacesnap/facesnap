import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN || "https://da4eadaeebeba88308d79d43ecdc1f73@o4511354850246656.ingest.us.sentry.io/4511511646437376";

Sentry.init({
  dsn: SENTRY_DSN,
  tracesSampleRate: 1.0,
});

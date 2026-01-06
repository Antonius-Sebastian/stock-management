// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: 'https://20b1e76920e8e6e7bd9851918ff34a5f@o4510643961856000.ingest.us.sentry.io/4510643963559936',

  // Add optional integrations for additional features
  integrations: [
    Sentry.replayIntegration(),
    // Console logging integration - automatically captures console.log, console.warn, and console.error
    Sentry.consoleLoggingIntegration({
      levels: ['log', 'warn', 'error'],
    }),
  ],

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Define how likely Replay events are sampled.
  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Define how likely Replay events are sampled when an error occurs.
  replaysOnErrorSampleRate: 1.0,

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,

  // Environment
  environment: process.env.NODE_ENV || 'development',
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart

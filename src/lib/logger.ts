/**
 * Logging Utility
 * Centralized logging with different levels
 * Integrated with Sentry for error tracking and logging
 */

import * as Sentry from '@sentry/nextjs'

type LogLevel = 'info' | 'warn' | 'error' | 'debug'

interface LogContext {
  [key: string]: unknown
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development'
  private isProduction = process.env.NODE_ENV === 'production'

  /**
   * Format log message with context
   */
  private formatMessage(
    level: LogLevel,
    message: string,
    context?: LogContext
  ): string {
    const timestamp = new Date().toISOString()
    const contextStr = context ? ` | Context: ${JSON.stringify(context)}` : ''
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`
  }

  /**
   * Send log to Sentry in production
   * Uses Sentry.logger for structured logging and Sentry.captureException for errors
   */
  private sendToService(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error
  ) {
    if (!this.isProduction) return

    try {
      if (level === 'error' && error) {
        // Capture exceptions with context using captureException
        Sentry.captureException(error, {
          extra: context,
          tags: { source: 'logger' },
        })
      } else if (level === 'error') {
        // Use Sentry.logger for error messages (structured logging)
        Sentry.logger.error(message, context)
      } else if (level === 'warn') {
        // Use Sentry.logger for warnings (structured logging)
        Sentry.logger.warn(message, context)
      } else if (level === 'info') {
        // Use Sentry.logger for info messages (structured logging)
        Sentry.logger.info(message, context)
      }
      // Debug logs are only in development, not sent to Sentry
    } catch (err) {
      // Fallback to console if Sentry fails
      console.error('Failed to send log to Sentry:', err)
    }
  }

  /**
   * Log info message
   */
  info(message: string, context?: LogContext) {
    const formatted = this.formatMessage('info', message, context)
    // eslint-disable-next-line no-console
    console.log(formatted)
    this.sendToService('info', message, context)
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: LogContext) {
    const formatted = this.formatMessage('warn', message, context)
    console.warn(formatted)
    this.sendToService('warn', message, context)
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error | unknown, context?: LogContext) {
    const errorObj = error instanceof Error ? error : new Error(String(error))
    const formatted = this.formatMessage('error', message, {
      ...context,
      error: errorObj.message,
      stack: this.isDevelopment ? errorObj.stack : undefined,
    })

    console.error(formatted)
    this.sendToService('error', message, context, errorObj)
  }

  /**
   * Log debug message (only in development)
   */
  debug(message: string, context?: LogContext) {
    if (!this.isDevelopment) return

    const formatted = this.formatMessage('debug', message, context)
    // eslint-disable-next-line no-console
    console.debug(formatted)
  }

  /**
   * Log API request
   */
  apiRequest(method: string, path: string, userId?: string) {
    this.info(`API Request: ${method} ${path}`, {
      method,
      path,
      userId,
    })
  }

  /**
   * Log API response
   */
  apiResponse(method: string, path: string, status: number, duration: number) {
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info'
    this[level](`API Response: ${method} ${path} - ${status}`, {
      method,
      path,
      status,
      duration: `${duration}ms`,
    })
  }

  /**
   * Log database query
   */
  dbQuery(query: string, duration: number) {
    if (duration > 1000) {
      this.warn(`Slow query detected: ${duration}ms`, { query, duration })
    } else {
      this.debug(`Database query: ${duration}ms`, { query, duration })
    }
  }

  /**
   * Log authentication event
   */
  auth(event: 'login' | 'logout' | 'failed', userId?: string, reason?: string) {
    const level = event === 'failed' ? 'warn' : 'info'
    this[level](`Auth event: ${event}`, {
      event,
      userId,
      reason,
    })
  }

  /**
   * Log security event
   */
  security(event: string, details?: LogContext) {
    this.warn(`Security event: ${event}`, details)
  }
}

// Export singleton instance
export const logger = new Logger()

// Convenience exports for common patterns
export const logError = (
  message: string,
  error?: Error | unknown,
  context?: LogContext
) => logger.error(message, error, context)

export const logInfo = (message: string, context?: LogContext) =>
  logger.info(message, context)

export const logWarn = (message: string, context?: LogContext) =>
  logger.warn(message, context)

export const logDebug = (message: string, context?: LogContext) =>
  logger.debug(message, context)

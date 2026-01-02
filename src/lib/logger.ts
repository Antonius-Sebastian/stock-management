/**
 * Logging Utility
 * Centralized logging with different levels
 * Can be extended to send logs to external services (Sentry, LogRocket, etc.)
 */

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
   * Send log to external service in production
   * TODO: Integrate with Sentry, LogRocket, or other service
   */
  private sendToService(
    _level: LogLevel,
    _message: string,
    _context?: LogContext,
    _error?: Error
  ) {
    if (!this.isProduction) return

    // TODO: Implement external logging service
    // Example:
    // if (level === 'error' && error) {
    //   Sentry.captureException(error, { extra: context })
    // }
  }

  /**
   * Log info message
   */
  info(message: string, context?: LogContext) {
    const formatted = this.formatMessage('info', message, context)
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

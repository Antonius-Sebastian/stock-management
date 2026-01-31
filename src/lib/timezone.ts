/**
 * Timezone Utility Functions
 *
 * All date/time operations should use WIB (Waktu Indonesia Barat) timezone
 * WIB = GMT+7 (Asia/Jakarta)
 */

/**
 * Convert a date to WIB timezone
 * @param date - Date to convert (can be UTC or any timezone)
 * @returns Date object representing the same moment in WIB timezone
 */
export function toWIB(date: Date): Date {
  // Create a date string in WIB format
  const wibDate = new Date(
    date.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })
  )
  return wibDate
}

/**
 * Get current date/time in WIB timezone
 * @returns Current date in WIB
 */
export function getWIBDate(): Date {
  return toWIB(new Date())
}

/**
 * Get start of day (00:00:00) in WIB timezone for a given date
 * @param date - Date to get start of day for
 * @returns Start of day in WIB
 */
export function startOfDayWIB(date: Date): Date {
  const wibDate = toWIB(date)
  wibDate.setHours(0, 0, 0, 0)
  return wibDate
}

/**
 * Get end of day (23:59:59.999) in WIB timezone for a given date
 * @param date - Date to get end of day for
 * @returns End of day in WIB
 */
export function endOfDayWIB(date: Date): Date {
  const wibDate = toWIB(date)
  wibDate.setHours(23, 59, 59, 999)
  return wibDate
}

/**
 * Convert a date string to WIB Date object
 * Useful for parsing ISO strings and converting to WIB
 * @param dateString - ISO date string or date string
 * @returns Date object in WIB timezone
 */
export function parseToWIB(dateString: string): Date {
  const date = new Date(dateString)
  return toWIB(date)
}

/**
 * Format date to ISO string in WIB timezone
 * @param date - Date to format
 * @returns ISO string representation in WIB
 */
export function toWIBISOString(date: Date): string {
  const wibDate = toWIB(date)
  return wibDate.toISOString()
}

/**
 * Get date range for a month in WIB timezone
 * @param year - Year
 * @param month - Month (1-12)
 * @returns Object with startDate and endDate in WIB
 */
export function getMonthRangeWIB(
  year: number,
  month: number
): { startDate: Date; endDate: Date; daysInMonth: number } {
  // Create date in WIB timezone
  const startDate = new Date(year, month - 1, 1)
  const startWIB = startOfDayWIB(startDate)

  // Get last day of month
  const endDate = new Date(year, month, 0)
  const endWIB = endOfDayWIB(endDate)

  const daysInMonth = endDate.getDate()

  return { startDate: startWIB, endDate: endWIB, daysInMonth }
}

/**
 * Convert a WIB calendar date to UTC Date representing WIB 00:00:00
 * This is used for database queries where dates are stored in UTC
 *
 * @param wibDate - Date object representing a WIB calendar date
 * @returns UTC Date object that represents WIB 00:00:00 for that calendar date
 *
 * @example
 * // For WIB calendar date Jan 31, 2026 00:00:00
 * // Returns UTC Date: Jan 30, 2026 17:00:00 (WIB is UTC+7)
 */
export function wibCalendarDateToUTCStartOfDay(wibDate: Date): Date {
  // Validate input
  if (!(wibDate instanceof Date) || isNaN(wibDate.getTime())) {
    throw new Error('Invalid date provided to wibCalendarDateToUTCStartOfDay')
  }

  // Get the calendar date components in WIB timezone
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(wibDate)

  const wibYear = parts.find((p) => p.type === 'year')?.value
  const wibMonth = parts.find((p) => p.type === 'month')?.value
  const wibDay = parts.find((p) => p.type === 'day')?.value

  // Validate that we extracted all required parts
  if (!wibYear || !wibMonth || !wibDay) {
    throw new Error(
      `Failed to extract date parts from date: ${wibDate.toISOString()}`
    )
  }

  // Create ISO string for WIB 00:00:00 and parse as UTC
  // WIB is UTC+7, so we format as ISO with +07:00 offset
  // This creates a UTC Date object representing WIB 00:00:00 for that calendar date
  const isoString = `${wibYear}-${wibMonth}-${wibDay}T00:00:00+07:00`

  // Parse and return as UTC Date
  const result = new Date(isoString)

  // Validate the result
  if (isNaN(result.getTime())) {
    throw new Error(
      `Failed to parse date string: ${isoString} (from input: ${wibDate.toISOString()})`
    )
  }

  return result
}

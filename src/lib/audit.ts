/**
 * Audit Logging System
 * Tracks sensitive operations for compliance and security monitoring
 */

import { logger } from '@/lib/logger'

export type AuditAction =
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_DELETED'
  | 'BATCH_CREATED'
  | 'BATCH_DELETED'
  | 'STOCK_ADJUSTED'
  | 'MATERIAL_DELETED'
  | 'PRODUCT_DELETED'
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'PERMISSION_DENIED'

export interface AuditLogEntry {
  action: AuditAction
  userId?: string
  userName?: string
  userRole?: string
  details: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
}

/**
 * Log an audit event to both logger and database (if needed)
 */
export async function logAudit(entry: AuditLogEntry): Promise<void> {
  try {
    // Log to logger system (will send to external service in production)
    logger.info(`AUDIT: ${entry.action}`, {
      action: entry.action,
      userId: entry.userId,
      userName: entry.userName,
      userRole: entry.userRole,
      details: entry.details,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      timestamp: new Date().toISOString(),
    })

    // TODO: Optionally store critical audit logs in database
    // Uncomment when audit table is added to schema:
    /*
    if (isCriticalAction(entry.action)) {
      await prisma.auditLog.create({
        data: {
          action: entry.action,
          userId: entry.userId,
          details: entry.details,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
        },
      })
    }
    */
  } catch (error) {
    // Never let audit logging crash the application
    logger.error('Failed to log audit entry', error, { action: entry.action })
  }
}

/**
 * Check if an action requires database persistence
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function isCriticalAction(action: AuditAction): boolean {
  const criticalActions: AuditAction[] = [
    'USER_DELETED',
    'BATCH_DELETED',
    'MATERIAL_DELETED',
    'PRODUCT_DELETED',
    'PERMISSION_DENIED',
  ]
  return criticalActions.includes(action)
}

/**
 * Extract IP address from request headers
 */
export function getIpAddress(headers: Headers): string | undefined {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    undefined
  )
}

/**
 * Extract user agent from request headers
 */
export function getUserAgent(headers: Headers): string | undefined {
  return headers.get('user-agent') || undefined
}

/**
 * Audit helpers for common operations
 */
export const AuditHelpers = {
  userCreated: (
    userId: string,
    userName: string,
    createdBy: { id: string; name: string; role: string },
    ipAddress?: string
  ) =>
    logAudit({
      action: 'USER_CREATED',
      userId: createdBy.id,
      userName: createdBy.name,
      userRole: createdBy.role,
      details: {
        newUserId: userId,
        newUserName: userName,
      },
      ipAddress,
    }),

  userDeleted: (
    deletedUserId: string,
    deletedUserName: string,
    deletedBy: { id: string; name: string; role: string },
    ipAddress?: string
  ) =>
    logAudit({
      action: 'USER_DELETED',
      userId: deletedBy.id,
      userName: deletedBy.name,
      userRole: deletedBy.role,
      details: {
        deletedUserId,
        deletedUserName,
      },
      ipAddress,
    }),

  batchCreated: (
    batchCode: string,
    finishedGood: string,
    materials: Array<{ name: string; quantity: number }>,
    createdBy: { id: string; name: string; role: string }
  ) =>
    logAudit({
      action: 'BATCH_CREATED',
      userId: createdBy.id,
      userName: createdBy.name,
      userRole: createdBy.role,
      details: {
        batchCode,
        finishedGood,
        materials,
        totalMaterials: materials.length,
      },
    }),

  batchDeleted: (
    batchCode: string,
    finishedGood: string,
    deletedBy: { id: string; name: string; role: string }
  ) =>
    logAudit({
      action: 'BATCH_DELETED',
      userId: deletedBy.id,
      userName: deletedBy.name,
      userRole: deletedBy.role,
      details: {
        batchCode,
        finishedGood,
      },
    }),

  stockAdjusted: (
    itemType: 'raw-material' | 'finished-good',
    itemName: string,
    movementType: 'IN' | 'OUT',
    quantity: number,
    adjustedBy: { id: string; name: string; role: string }
  ) =>
    logAudit({
      action: 'STOCK_ADJUSTED',
      userId: adjustedBy.id,
      userName: adjustedBy.name,
      userRole: adjustedBy.role,
      details: {
        itemType,
        itemName,
        movementType,
        quantity,
      },
    }),

  materialDeleted: (
    materialCode: string,
    materialName: string,
    deletedBy: { id: string; name: string; role: string }
  ) =>
    logAudit({
      action: 'MATERIAL_DELETED',
      userId: deletedBy.id,
      userName: deletedBy.name,
      userRole: deletedBy.role,
      details: {
        materialCode,
        materialName,
      },
    }),

  productDeleted: (
    productName: string,
    deletedBy: { id: string; name: string; role: string }
  ) =>
    logAudit({
      action: 'PRODUCT_DELETED',
      userId: deletedBy.id,
      userName: deletedBy.name,
      userRole: deletedBy.role,
      details: {
        productName,
      },
    }),

  loginSuccess: (userId: string, userName: string, ipAddress?: string, userAgent?: string) =>
    logAudit({
      action: 'LOGIN_SUCCESS',
      userId,
      userName,
      details: {},
      ipAddress,
      userAgent,
    }),

  loginFailed: (username: string, reason: string, ipAddress?: string, userAgent?: string) =>
    logAudit({
      action: 'LOGIN_FAILED',
      details: {
        username,
        reason,
      },
      ipAddress,
      userAgent,
    }),

  permissionDenied: (
    userId: string,
    userName: string,
    userRole: string,
    action: string,
    resource: string,
    ipAddress?: string
  ) =>
    logAudit({
      action: 'PERMISSION_DENIED',
      userId,
      userName,
      userRole,
      details: {
        attemptedAction: action,
        resource,
      },
      ipAddress,
    }),
}

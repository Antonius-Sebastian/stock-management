/**
 * Role-Based Access Control (RBAC) Helper
 *
 * Defines permission rules for each user role:
 * - ADMIN: Full access to everything
 * - FACTORY: Production-focused (batches, stock entry, view data)
 * - OFFICE: Inventory management (materials, products, reports)
 */

export type UserRole = 'ADMIN' | 'FACTORY' | 'OFFICE'

/**
 * Check if user can create/edit/delete raw materials
 * @param role - User's role
 * @returns true if ADMIN or OFFICE
 */
export function canManageMaterials(role: string | undefined): boolean {
  if (!role) return false
  return ['ADMIN', 'OFFICE'].includes(role)
}

/**
 * Check if user can create/edit/delete finished goods
 * @param role - User's role
 * @returns true if ADMIN or OFFICE
 */
export function canManageFinishedGoods(role: string | undefined): boolean {
  if (!role) return false
  return ['ADMIN', 'OFFICE'].includes(role)
}

/**
 * Check if user can create batches
 * @param role - User's role
 * @returns true if ADMIN or FACTORY
 */
export function canCreateBatches(role: string | undefined): boolean {
  if (!role) return false
  return ['ADMIN', 'FACTORY'].includes(role)
}

/**
 * Check if user can edit batches
 * @param role - User's role
 * @returns true if ADMIN or FACTORY
 */
export function canEditBatches(role: string | undefined): boolean {
  if (!role) return false
  return ['ADMIN', 'FACTORY'].includes(role)
}

/**
 * Check if user can delete batches
 * @param role - User's role
 * @returns true if ADMIN only (batches affect stock reconciliation)
 */
export function canDeleteBatches(role: string | undefined): boolean {
  if (!role) return false
  return role === 'ADMIN'
}

/**
 * Check if user can create stock entries (IN/OUT)
 * @param role - User's role
 * @returns true for all authenticated users
 */
export function canCreateStockEntries(role: string | undefined): boolean {
  if (!role) return false
  return ['ADMIN', 'FACTORY', 'OFFICE'].includes(role)
}

/**
 * Check if user can view reports
 * @param role - User's role
 * @returns true for all authenticated users
 */
export function canViewReports(role: string | undefined): boolean {
  if (!role) return false
  return ['ADMIN', 'FACTORY', 'OFFICE'].includes(role)
}

/**
 * Check if user can export reports
 * @param role - User's role
 * @returns true for all authenticated users
 */
export function canExportReports(role: string | undefined): boolean {
  if (!role) return false
  return ['ADMIN', 'FACTORY', 'OFFICE'].includes(role)
}

/**
 * Check if user can manage other users
 * @param role - User's role
 * @returns true if ADMIN only
 */
export function canManageUsers(role: string | undefined): boolean {
  if (!role) return false
  return role === 'ADMIN'
}

/**
 * Get user-friendly error message for permission denial
 * @param action - The action being attempted
 * @param role - User's role
 * @returns Error message string
 */
export function getPermissionErrorMessage(action: string, role?: string): string {
  const roleDisplay = role || 'your role'
  return `Access denied: ${roleDisplay} users cannot ${action}`
}

/**
 * Permission matrix for quick reference
 */
export const PERMISSIONS = {
  ADMIN: {
    canManageMaterials: true,
    canManageFinishedGoods: true,
    canCreateBatches: true,
    canEditBatches: true,
    canDeleteBatches: true,
    canCreateStockEntries: true,
    canViewReports: true,
    canExportReports: true,
    canManageUsers: true,
  },
  FACTORY: {
    canManageMaterials: false,
    canManageFinishedGoods: false,
    canCreateBatches: true,
    canEditBatches: true,
    canDeleteBatches: false,
    canCreateStockEntries: true,
    canViewReports: true,
    canExportReports: true,
    canManageUsers: false,
  },
  OFFICE: {
    canManageMaterials: true,
    canManageFinishedGoods: true,
    canCreateBatches: false,
    canEditBatches: false,
    canDeleteBatches: false,
    canCreateStockEntries: true,
    canViewReports: true,
    canExportReports: true,
    canManageUsers: false,
  },
} as const

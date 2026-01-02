/**
 * Role-Based Access Control (RBAC) Helper
 *
 * Defines permission rules for each user role to prevent data manipulation:
 * - ADMIN: Full access to everything (manager/boss)
 * - FACTORY: Production staff - can create batches (finished good IN is automatic via batch workflow)
 * - OFFICE: Office staff - can input raw material IN (purchases) and finished good OUT (distribution)
 *
 * Business Rules:
 * - Raw material IN: Only OFFICE (when purchasing from supplier)
 * - Raw material OUT: Only FACTORY via batch creation (automatic, cannot manually create)
 * - Finished good IN: Only via batch workflow (automatic when FACTORY creates batch)
 * - Finished good OUT: Only OFFICE (when sending to distributor)
 */

export type UserRole = 'ADMIN' | 'FACTORY' | 'OFFICE'

/**
 * Check if user can create/edit raw materials
 * @param role - User's role
 * @returns true if ADMIN or OFFICE
 */
export function canManageMaterials(role: string | undefined): boolean {
  if (!role) return false
  return ['ADMIN', 'OFFICE'].includes(role)
}

/**
 * Check if user can delete raw materials
 * @param role - User's role
 * @returns true if ADMIN only
 */
export function canDeleteMaterials(role: string | undefined): boolean {
  if (!role) return false
  return role === 'ADMIN'
}

/**
 * Check if user can create/edit finished goods
 * @param role - User's role
 * @returns true if ADMIN or OFFICE
 */
export function canManageFinishedGoods(role: string | undefined): boolean {
  if (!role) return false
  return ['ADMIN', 'OFFICE'].includes(role)
}

/**
 * Check if user can delete finished goods
 * @param role - User's role
 * @returns true if ADMIN only
 */
export function canDeleteFinishedGoods(role: string | undefined): boolean {
  if (!role) return false
  return role === 'ADMIN'
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
 * @returns true if ADMIN only (FACTORY can only create, not edit)
 */
export function canEditBatches(role: string | undefined): boolean {
  if (!role) return false
  return role === 'ADMIN'
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
 * Check if user can add finished goods to batches
 * @param role - User's role
 * @returns true if ADMIN or FACTORY
 */
export function canAddFinishedGoodsToBatch(role: string | undefined): boolean {
  if (!role) return false
  return ['ADMIN', 'FACTORY'].includes(role)
}

/**
 * Check if user can create stock entries (IN/OUT)
 * @param role - User's role
 * @returns true for all authenticated users
 * @deprecated Use canCreateStockMovement() for granular control
 */
export function canCreateStockEntries(role: string | undefined): boolean {
  if (!role) return false
  return ['ADMIN', 'FACTORY', 'OFFICE'].includes(role)
}

/**
 * Check if user can create a specific type of stock movement
 * @param role - User's role
 * @param itemType - Type of item ('raw-material' or 'finished-good')
 * @param movementType - Type of movement ('IN' or 'OUT')
 * @returns true if user has permission
 *
 * @remarks
 * Business Rules (for data integrity and transparency):
 * - ADMIN: Can create all types of movements (full access)
 * - FACTORY:
 *   - Raw material OUT: Automatic via batch creation (cannot manually create)
 *   - Finished good IN: Only via batch workflow (automatic), cannot manually create
 *   - Raw material IN: No (only OFFICE can input purchases)
 *   - Finished good OUT: No (only OFFICE handles distribution)
 * - OFFICE:
 *   - Raw material IN: Yes (when purchasing from supplier)
 *   - Finished good OUT: Yes (when sending to distributor)
 *   - Raw material OUT: No (only via batch - automatic)
 *   - Finished good IN: No (only via batch workflow - automatic)
 */
export function canCreateStockMovement(
  role: string | undefined,
  itemType: 'raw-material' | 'finished-good',
  movementType: 'IN' | 'OUT' | 'ADJUSTMENT'
): boolean {
  if (!role) return false

  // ADMIN can do everything
  if (role === 'ADMIN') return true

  // ADJUSTMENT type is only for ADMIN
  if (movementType === 'ADJUSTMENT') return false

  // FACTORY permissions
  if (role === 'FACTORY') {
    // Finished good IN: not allowed (only via batch workflow now)
    // Raw material OUT: not allowed (only automatic via batch creation)
    // All other movements: not allowed
    return false
  }

  // OFFICE permissions
  if (role === 'OFFICE') {
    // Raw material IN: allowed (when purchasing from supplier)
    if (itemType === 'raw-material' && movementType === 'IN') return true

    // Finished good OUT: allowed (when sending to distributor)
    if (itemType === 'finished-good' && movementType === 'OUT') return true

    // Raw material OUT: not allowed (only via batch - automatic)
    // Finished good IN: not allowed (only FACTORY inputs production results)
    return false
  }

  return false
}

/**
 * Check if user can edit stock movements
 * @param role - User's role
 * @returns true if ADMIN only
 */
export function canEditStockMovements(role: string | undefined): boolean {
  if (!role) return false
  return role === 'ADMIN'
}

/**
 * Check if user can delete stock movements
 * @param role - User's role
 * @returns true if ADMIN only
 */
export function canDeleteStockMovements(role: string | undefined): boolean {
  if (!role) return false
  return role === 'ADMIN'
}

/**
 * Check if user can create stock adjustments
 * @param role - User's role
 * @returns true if ADMIN only
 */
export function canCreateStockAdjustment(role: string | undefined): boolean {
  if (!role) return false
  return role === 'ADMIN'
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
export function getPermissionErrorMessage(
  action: string,
  role?: string
): string {
  const roleDisplay = role || 'your role'
  return `Access denied: ${roleDisplay} users cannot ${action}`
}

/**
 * Permission matrix for quick reference
 */
export const PERMISSIONS = {
  ADMIN: {
    canManageMaterials: true, // Create/edit material metadata
    canDeleteMaterials: true, // Delete materials
    canManageFinishedGoods: true, // Create/edit product metadata
    canDeleteFinishedGoods: true, // Delete products
    canCreateBatches: true,
    canEditBatches: true,
    canDeleteBatches: true,
    canCreateStockMovements: true, // All types
    canCreateStockAdjustment: true, // Stock adjustment
    canEditStockMovements: true,
    canDeleteStockMovements: true,
    canViewReports: true,
    canExportReports: true,
    canManageUsers: true,
  },
  FACTORY: {
    canManageMaterials: false, // Cannot create/edit materials
    canDeleteMaterials: false, // Cannot delete materials
    canManageFinishedGoods: false, // Cannot create/edit products
    canDeleteFinishedGoods: false, // Cannot delete products
    canCreateBatches: true, // ✅ Can create batches (auto-creates raw material OUT)
    canEditBatches: false, // Cannot edit batches
    canDeleteBatches: false, // Cannot delete batches
    canCreateStockMovements: false, // ❌ Cannot create any stock movements (only via batch)
    canCreateStockAdjustment: false, // Cannot adjust stock
    canEditStockMovements: false, // Cannot edit movements
    canDeleteStockMovements: false, // Cannot delete movements
    canViewReports: true,
    canExportReports: true,
    canManageUsers: false,
  },
  OFFICE: {
    canManageMaterials: true, // ✅ Can create/edit materials
    canDeleteMaterials: false, // ❌ Cannot delete materials
    canManageFinishedGoods: true, // ✅ Can create/edit products
    canDeleteFinishedGoods: false, // ❌ Cannot delete products
    canCreateBatches: false, // Cannot create batches
    canEditBatches: false, // ❌ Cannot edit batches
    canDeleteBatches: false, // ❌ Cannot delete batches
    canCreateStockMovements: true, // ✅ Can create: Raw material IN, Finished good OUT
    canCreateStockAdjustment: false, // Cannot adjust stock
    canEditStockMovements: false, // ❌ Cannot edit movements
    canDeleteStockMovements: false, // ❌ Cannot delete movements
    canViewReports: true,
    canExportReports: true,
    canManageUsers: false,
  },
} as const

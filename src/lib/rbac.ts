/**
 * Role-Based Access Control (RBAC) Helper
 *
 * Defines permission rules for each user role to prevent data manipulation:
 * - ADMIN: Full access to everything (manager/boss)
 * - OFFICE_PURCHASING: Purchasing staff - can input raw material IN (purchases) and finished good IN (receiving from production/purchasing)
 * - OFFICE_WAREHOUSE: Warehouse staff - can input finished good OUT (distribution/shipping) and raw material OUT (production usage)
 *
 * Business Rules:
 * - Raw material IN: Only OFFICE_PURCHASING (when purchasing from supplier)
 * - Raw material OUT: Only OFFICE_WAREHOUSE (when using for production, typically via batch)
 * - Finished good IN: Only OFFICE_PURCHASING (when receiving from production/purchasing)
 * - Finished good OUT: Only OFFICE_WAREHOUSE (when distributing/shipping)
 */

export type UserRole = 'ADMIN' | 'OFFICE_PURCHASING' | 'OFFICE_WAREHOUSE'

/**
 * Check if user can create/edit raw materials
 * @param role - User's role
 * @returns true if ADMIN, OFFICE_PURCHASING, or OFFICE_WAREHOUSE
 */
export function canManageMaterials(role: string | undefined): boolean {
  if (!role) return false
  return ['ADMIN', 'OFFICE_PURCHASING', 'OFFICE_WAREHOUSE'].includes(role)
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
 * @returns true if ADMIN, OFFICE_PURCHASING, or OFFICE_WAREHOUSE
 */
export function canManageFinishedGoods(role: string | undefined): boolean {
  if (!role) return false
  return ['ADMIN', 'OFFICE_PURCHASING', 'OFFICE_WAREHOUSE'].includes(role)
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
 * @returns true if ADMIN or OFFICE_WAREHOUSE only (batch = raw material OUT movement)
 */
export function canCreateBatches(role: string | undefined): boolean {
  if (!role) return false
  return ['ADMIN', 'OFFICE_WAREHOUSE'].includes(role)
}

/**
 * Check if user can edit batches
 * @param role - User's role
 * @returns true if ADMIN only
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
 * @returns true if ADMIN or OFFICE_WAREHOUSE only (batch = raw material OUT movement)
 */
export function canAddFinishedGoodsToBatch(role: string | undefined): boolean {
  if (!role) return false
  return ['ADMIN', 'OFFICE_WAREHOUSE'].includes(role)
}

/**
 * Check if user can create stock entries (IN/OUT)
 * @param role - User's role
 * @returns true for all authenticated users
 * @deprecated Use canCreateStockMovement() for granular control
 */
export function canCreateStockEntries(role: string | undefined): boolean {
  if (!role) return false
  return ['ADMIN', 'OFFICE_PURCHASING', 'OFFICE_WAREHOUSE'].includes(role)
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
 * - OFFICE_PURCHASING:
 *   - Raw material IN: Yes (when purchasing from supplier)
 *   - Finished good IN: Yes (when receiving from production/purchasing)
 *   - Raw material OUT: No
 *   - Finished good OUT: No
 * - OFFICE_WAREHOUSE:
 *   - Finished good OUT: Yes (when distributing/shipping)
 *   - Raw material OUT: Yes (when using for production)
 *   - Raw material IN: No
 *   - Finished good IN: No
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

  // OFFICE_PURCHASING: Raw IN, Finished IN
  if (role === 'OFFICE_PURCHASING') {
    if (itemType === 'raw-material' && movementType === 'IN') return true
    if (itemType === 'finished-good' && movementType === 'IN') return true
    return false
  }

  // OFFICE_WAREHOUSE: Finished OUT, Raw OUT
  if (role === 'OFFICE_WAREHOUSE') {
    if (itemType === 'finished-good' && movementType === 'OUT') return true
    if (itemType === 'raw-material' && movementType === 'OUT') return true
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
 * @returns true for all authenticated users (ADMIN, OFFICE_PURCHASING, OFFICE_WAREHOUSE)
 */
export function canViewReports(role: string | undefined): boolean {
  if (!role) return false
  return ['ADMIN', 'OFFICE_PURCHASING', 'OFFICE_WAREHOUSE'].includes(role)
}

/**
 * Check if user can export reports
 * @param role - User's role
 * @returns true for all authenticated users (ADMIN, OFFICE_PURCHASING, OFFICE_WAREHOUSE)
 */
export function canExportReports(role: string | undefined): boolean {
  if (!role) return false
  return ['ADMIN', 'OFFICE_PURCHASING', 'OFFICE_WAREHOUSE'].includes(role)
}

/**
 * Check if user can manage locations (create/edit)
 * @param role - User's role
 * @returns true if ADMIN, OFFICE_PURCHASING, or OFFICE_WAREHOUSE
 */
export function canManageLocations(role: string | undefined): boolean {
  if (!role) return false
  return ['ADMIN', 'OFFICE_PURCHASING', 'OFFICE_WAREHOUSE'].includes(role)
}

/**
 * Check if user can delete locations
 * @param role - User's role
 * @returns true if ADMIN only
 */
export function canDeleteLocations(role: string | undefined): boolean {
  if (!role) return false
  return role === 'ADMIN'
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
 * Get user-friendly display name for role
 * @param role - Internal role enum value
 * @returns Display name for UI
 */
export function getRoleDisplayName(role: string | undefined): string {
  if (!role) return 'Unknown'

  switch (role) {
    case 'ADMIN':
      return 'Admin'
    case 'OFFICE_PURCHASING':
      return 'Office A'
    case 'OFFICE_WAREHOUSE':
      return 'Office B'
    default:
      return role
  }
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
    canManageLocations: true,
    canDeleteLocations: true,
  },
  OFFICE_PURCHASING: {
    canManageMaterials: true, // ✅ Can create/edit materials
    canDeleteMaterials: false, // ❌ Cannot delete materials
    canManageFinishedGoods: true, // ✅ Can create/edit products
    canDeleteFinishedGoods: false, // ❌ Cannot delete products
    canCreateBatches: false, // ❌ Cannot create batches (batch = raw material OUT, only WAREHOUSE)
    canEditBatches: false, // ❌ Cannot edit batches
    canDeleteBatches: false, // ❌ Cannot delete batches
    canCreateStockMovements: true, // ✅ Can create: Raw material IN, Finished good IN
    canCreateStockAdjustment: false, // Cannot adjust stock
    canEditStockMovements: false, // ❌ Cannot edit movements
    canDeleteStockMovements: false, // ❌ Cannot delete movements
    canViewReports: true,
    canExportReports: true,
    canManageUsers: false,
    canManageLocations: true,
    canDeleteLocations: false,
  },
  OFFICE_WAREHOUSE: {
    canManageMaterials: true, // ✅ Can create/edit materials
    canDeleteMaterials: false, // ❌ Cannot delete materials
    canManageFinishedGoods: true, // ✅ Can create/edit products
    canDeleteFinishedGoods: false, // ❌ Cannot delete products
    canCreateBatches: true, // ✅ Can create batches
    canEditBatches: false, // ❌ Cannot edit batches
    canDeleteBatches: false, // ❌ Cannot delete batches
    canCreateStockMovements: true, // ✅ Can create: Finished good OUT, Raw material OUT
    canCreateStockAdjustment: false, // Cannot adjust stock
    canEditStockMovements: false, // ❌ Cannot edit movements
    canDeleteStockMovements: false, // ❌ Cannot delete movements
    canViewReports: true,
    canExportReports: true,
    canManageUsers: false,
    canManageLocations: true,
    canDeleteLocations: false,
  },
} as const

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api-client"
import { RawMaterialInput } from "@/lib/validations"

/**
 * Raw Materials Query Hooks
 * React Query hooks for raw materials data fetching
 *
 * These are NOT used yet - existing code still uses useState + useEffect
 * Safe to add without breaking anything
 */

export interface RawMaterial {
  id: string
  kode: string
  name: string
  currentStock: number
  moq: number
  createdAt: string
  updatedAt: string
}

/**
 * Fetch all raw materials
 */
export function useRawMaterials() {
  return useQuery({
    queryKey: ["raw-materials"],
    queryFn: () => apiGet<RawMaterial[]>("/api/raw-materials"),
  })
}

/**
 * Fetch single raw material by ID
 */
export function useRawMaterial(id: string) {
  return useQuery({
    queryKey: ["raw-materials", id],
    queryFn: () => apiGet<RawMaterial>(`/api/raw-materials/${id}`),
    enabled: !!id, // Only run if ID exists
  })
}

/**
 * Create new raw material
 */
export function useCreateRawMaterial() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: RawMaterialInput) =>
      apiPost<RawMaterial>("/api/raw-materials", data),
    onSuccess: () => {
      // Invalidate and refetch materials list
      queryClient.invalidateQueries({ queryKey: ["raw-materials"] })
    },
  })
}

/**
 * Update raw material
 */
export function useUpdateRawMaterial(id: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: Partial<RawMaterialInput>) =>
      apiPut<RawMaterial>(`/api/raw-materials/${id}`, data),
    onSuccess: () => {
      // Invalidate specific material and list
      queryClient.invalidateQueries({ queryKey: ["raw-materials", id] })
      queryClient.invalidateQueries({ queryKey: ["raw-materials"] })
    },
  })
}

/**
 * Delete raw material
 */
export function useDeleteRawMaterial() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) =>
      apiDelete<void>(`/api/raw-materials/${id}`),
    onSuccess: () => {
      // Invalidate materials list
      queryClient.invalidateQueries({ queryKey: ["raw-materials"] })
    },
  })
}

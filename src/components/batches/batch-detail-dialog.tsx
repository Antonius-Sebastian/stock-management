'use client'

import React from 'react'
import { format } from 'date-fns'
import Link from 'next/link'
import { Batch, BatchUsage, RawMaterial } from '@prisma/client'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Calendar, Package, FileText } from 'lucide-react'

type BatchWithUsage = Batch & {
  batchUsages: (BatchUsage & {
    rawMaterial: RawMaterial
    drum: {
      id: string
      label: string
    } | null
  })[]
}

interface BatchDetailDialogProps {
  batch: BatchWithUsage | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BatchDetailDialog({
  batch,
  open,
  onOpenChange,
}: BatchDetailDialogProps) {
  if (!batch) return null

  // Group batch usages by rawMaterialId
  const groupedMaterials = batch.batchUsages.reduce(
    (acc, usage) => {
      const materialId = usage.rawMaterialId
      if (!acc[materialId]) {
        acc[materialId] = {
          rawMaterial: usage.rawMaterial,
          usages: [],
          totalQuantity: 0,
        }
      }
      acc[materialId].usages.push(usage)
      acc[materialId].totalQuantity += usage.quantity
      return acc
    },
    {} as Record<
      string,
      {
        rawMaterial: RawMaterial
        usages: (BatchUsage & {
          rawMaterial: RawMaterial
          drum: { id: string; label: string } | null
        })[]
        totalQuantity: number
      }
    >
  )

  const totalMaterialsUsed = batch.batchUsages.reduce(
    (sum, usage) => sum + usage.quantity,
    0
  )

  const uniqueMaterialCount = Object.keys(groupedMaterials).length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-[95vw] overflow-y-auto sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle className="text-xl sm:text-2xl">
            Detail Batch
          </DialogTitle>
          <DialogDescription>
            Informasi lengkap tentang batch produksi ini
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Batch Information */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Package className="h-4 w-4" />
                <span>Kode Batch</span>
              </div>
              <div className="text-lg font-semibold">{batch.code}</div>
            </div>

            <div className="space-y-1">
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4" />
                <span>Tanggal Produksi</span>
              </div>
              <div className="text-lg font-semibold">
                {format(new Date(batch.date), 'MMMM dd, yyyy')}
              </div>
            </div>

            {batch.description && (
              <div className="space-y-1 sm:col-span-2">
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4" />
                  <span>Deskripsi</span>
                </div>
                <div className="text-sm">{batch.description}</div>
              </div>
            )}
          </div>

          {/* Raw Materials Used */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                Bahan Baku yang Digunakan
              </h3>
              <Badge variant="secondary">
                {uniqueMaterialCount}{' '}
                {uniqueMaterialCount === 1 ? 'bahan' : 'bahan'}
              </Badge>
            </div>

            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[80px]">Kode</TableHead>
                    <TableHead className="min-w-[150px]">
                      Nama Bahan Baku
                    </TableHead>
                    <TableHead className="min-w-[100px]">Drum</TableHead>
                    <TableHead className="min-w-[100px] text-right">
                      Jumlah Digunakan
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batch.batchUsages.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-muted-foreground text-center"
                      >
                        Tidak ada bahan baku yang dicatat
                      </TableCell>
                    </TableRow>
                  ) : (
                    Object.values(groupedMaterials).map((group, groupIndex) => {
                      const hasMultipleDrums = group.usages.length > 1
                      return (
                        <React.Fragment key={group.rawMaterial.id}>
                          {/* Main material row */}
                          <TableRow
                            className={
                              hasMultipleDrums
                                ? 'bg-muted/30 dark:bg-muted/20'
                                : ''
                            }
                          >
                            <TableCell className="font-medium">
                              {group.rawMaterial.kode}
                            </TableCell>
                            <TableCell>
                              <Link
                                href={`/raw-materials/${group.rawMaterial.id}`}
                                className="text-primary hover:underline"
                              >
                                {group.rawMaterial.name}
                              </Link>
                            </TableCell>
                            <TableCell>
                              {hasMultipleDrums ? (
                                <div className="flex flex-wrap gap-1">
                                  {group.usages.map((usage) => (
                                    <Badge
                                      key={usage.id}
                                      variant="outline"
                                      className="font-medium"
                                    >
                                      {usage.drum?.label || '-'}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                group.usages[0]?.drum ? (
                                  <Badge variant="outline" className="font-medium">
                                    {group.usages[0].drum.label}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )
                              )}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {group.totalQuantity.toLocaleString()}
                            </TableCell>
                          </TableRow>
                          {/* Drum detail rows (only if multiple drums) */}
                          {hasMultipleDrums &&
                            group.usages.map((usage) => (
                              <TableRow
                                key={usage.id}
                                className="bg-muted/10 dark:bg-muted/5"
                              >
                                <TableCell />
                                <TableCell className="pl-8 text-sm text-muted-foreground">
                                  Drum: {usage.drum?.label || '-'}
                                </TableCell>
                                <TableCell />
                                <TableCell className="text-right text-sm">
                                  {usage.quantity.toLocaleString()}
                                </TableCell>
                              </TableRow>
                            ))}
                        </React.Fragment>
                      )
                    })
                  )}
                  {batch.batchUsages.length > 0 && (
                    <TableRow className="bg-muted/50 font-semibold dark:bg-muted/30">
                      <TableCell colSpan={3} className="text-right">
                        Total:
                      </TableCell>
                      <TableCell className="text-right">
                        {totalMaterialsUsed.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

"use client"

import { format } from "date-fns"
import Link from "next/link"
import { Batch, BatchUsage, RawMaterial, FinishedGood } from "@prisma/client"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Calendar, Package, FileText } from "lucide-react"

type BatchWithUsage = Batch & {
  finishedGood?: FinishedGood | null
  batchUsages: (BatchUsage & {
    rawMaterial: RawMaterial
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

  const totalMaterialsUsed = batch.batchUsages.reduce(
    (sum, usage) => sum + usage.quantity,
    0
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Batch Details</DialogTitle>
          <DialogDescription>
            Complete information about this production batch
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Batch Information */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Package className="h-4 w-4" />
                <span>Batch Code</span>
              </div>
              <div className="text-lg font-semibold">{batch.code}</div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Production Date</span>
              </div>
              <div className="text-lg font-semibold">
                {format(new Date(batch.date), "MMMM dd, yyyy")}
              </div>
            </div>

            <div className="space-y-1 col-span-2">
              <div className="text-sm text-muted-foreground">Finished Good</div>
              <div className="text-lg font-semibold">
                {batch.finishedGood?.name || "-"}
              </div>
            </div>

            {batch.description && (
              <div className="space-y-1 col-span-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span>Description</span>
                </div>
                <div className="text-sm">{batch.description}</div>
              </div>
            )}
          </div>

          {/* Raw Materials Used */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Raw Materials Used</h3>
              <Badge variant="secondary">
                {batch.batchUsages.length} {batch.batchUsages.length === 1 ? "material" : "materials"}
              </Badge>
            </div>

            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Material Name</TableHead>
                    <TableHead className="text-right">Quantity Used</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batch.batchUsages.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        No materials recorded
                      </TableCell>
                    </TableRow>
                  ) : (
                    batch.batchUsages.map((usage) => (
                      <TableRow key={usage.id}>
                        <TableCell className="font-medium">
                          {usage.rawMaterial.kode}
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/raw-materials/${usage.rawMaterial.id}`}
                            className="text-primary hover:underline"
                          >
                            {usage.rawMaterial.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {usage.quantity.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                  {batch.batchUsages.length > 0 && (
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell colSpan={2} className="text-right">
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

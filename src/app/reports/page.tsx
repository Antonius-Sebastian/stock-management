"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import { StockReportTable } from "@/components/reports/stock-report-table"

interface StockReportData {
  id: string
  name: string
  code: string
  [key: string]: string | number
}

interface StockReportResponse {
  data: StockReportData[]
  meta: {
    year: number
    month: number
    type: string
    dataType: string
    daysInMonth: number
    currentDay: number
  }
}

const MONTHS = [
  { value: "1", label: "Januari" },
  { value: "2", label: "Februari" },
  { value: "3", label: "Maret" },
  { value: "4", label: "April" },
  { value: "5", label: "Mei" },
  { value: "6", label: "Juni" },
  { value: "7", label: "Juli" },
  { value: "8", label: "Agustus" },
  { value: "9", label: "September" },
  { value: "10", label: "Oktober" },
  { value: "11", label: "November" },
  { value: "12", label: "Desember" },
]

const YEARS = ["2023", "2024", "2025"]

const DATA_TYPES = [
  { value: "stok-awal", label: "Stok Awal" },
  { value: "stok-masuk", label: "Stok Masuk" },
  { value: "stok-keluar", label: "Stok Keluar" },
  { value: "stok-sisa", label: "Stok Sisa" },
]

export default function ReportsPage() {
  const [reportType, setReportType] = useState("raw-materials")
  const [dataType, setDataType] = useState("stok-sisa")
  const [year, setYear] = useState("2025")
  const [month, setMonth] = useState("10")
  const [reportData, setReportData] = useState<StockReportResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const fetchReport = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        year,
        month,
        type: reportType,
        dataType,
      })

      const response = await fetch(`/api/reports/stock?${params}`)
      if (!response.ok) {
        throw new Error("Gagal memuat laporan")
      }
      const data = await response.json()
      setReportData(data)
    } catch (error) {
      console.error("Error fetching report:", error)
      toast.error("Gagal memuat laporan. Silakan coba lagi.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchReport()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportType, dataType, year, month])

  const getReportTitle = () => {
    const typeLabel = reportType === "raw-materials" ? "Laporan Bahan Baku" : "Laporan Produk Jadi"
    const dataTypeLabel = DATA_TYPES.find(dt => dt.value === dataType)?.label || ""
    const monthLabel = MONTHS.find(m => m.value === month)?.label || ""

    return `${typeLabel} - ${dataTypeLabel} - ${monthLabel} ${year}`
  }

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const params = new URLSearchParams({
        year,
        month,
        type: reportType,
      })

      const response = await fetch(`/api/reports/export?${params}`)
      if (!response.ok) {
        throw new Error("Gagal mengekspor laporan")
      }

      // Get the filename from the Content-Disposition header
      const contentDisposition = response.headers.get("Content-Disposition")
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/)
      const filename = filenameMatch ? filenameMatch[1] : "report.xlsx"

      // Download the file
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success("Laporan berhasil diekspor")
    } catch (error) {
      console.error("Error exporting report:", error)
      toast.error("Gagal mengekspor laporan. Silakan coba lagi.")
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Laporan Stok</h1>
        <p className="text-muted-foreground">
          Laporan pergerakan stok interaktif dengan rincian harian
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div className="flex gap-4 items-center">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder="Tahun" />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Bulan" />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleExport} variant="outline" disabled={isExporting}>
          <Download className="mr-2 h-4 w-4" />
          {isExporting ? "Mengekspor..." : "Ekspor ke Excel"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{getReportTitle()}</CardTitle>
          <CardDescription>
            Pergerakan stok harian dalam format tabel pivot dengan kolom item yang tetap
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={reportType} onValueChange={setReportType}>
            <TabsList className="mb-4">
              <TabsTrigger value="raw-materials">Laporan Bahan Baku</TabsTrigger>
              <TabsTrigger value="finished-goods">Laporan Produk Jadi</TabsTrigger>
            </TabsList>

            <TabsContent value={reportType}>
              <Tabs value={dataType} onValueChange={setDataType}>
                <TabsList className="mb-6">
                  {DATA_TYPES.map((dt) => (
                    <TabsTrigger key={dt.value} value={dt.value}>
                      {dt.label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                <TabsContent value={dataType}>
                  {isLoading ? (
                    <div className="flex items-center justify-center h-64">
                      <div className="text-lg">Memuat laporan...</div>
                    </div>
                  ) : reportData ? (
                    <StockReportTable
                      data={reportData.data}
                      currentDay={reportData.meta.currentDay}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-64">
                      <div className="text-lg">Tidak ada data tersedia</div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
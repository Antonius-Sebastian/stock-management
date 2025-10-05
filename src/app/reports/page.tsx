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
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
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
        throw new Error("Failed to fetch report")
      }
      const data = await response.json()
      setReportData(data)
    } catch (error) {
      console.error("Error fetching report:", error)
      toast.error("Failed to load report. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchReport()
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
        throw new Error("Failed to export report")
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

      toast.success("Report exported successfully")
    } catch (error) {
      console.error("Error exporting report:", error)
      toast.error("Failed to export report. Please try again.")
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Stock Reports</h1>
        <p className="text-muted-foreground">
          Interactive stock movement reports with daily breakdown
        </p>
      </div>

      <div className="flex gap-4 items-center justify-between">
        <div className="flex gap-4 items-center">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder="Year" />
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
              <SelectValue placeholder="Month" />
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
          {isExporting ? "Exporting..." : "Export to Excel"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{getReportTitle()}</CardTitle>
          <CardDescription>
            Daily stock movements in a pivoted table format with sticky item column
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
                      <div className="text-lg">Loading report...</div>
                    </div>
                  ) : reportData ? (
                    <StockReportTable
                      data={reportData.data}
                      currentDay={reportData.meta.currentDay}
                      dataType={dataType}
                      itemType={reportType === 'raw-materials' ? 'raw-material' : 'finished-good'}
                      year={parseInt(year)}
                      month={parseInt(month)}
                      onRefresh={fetchReport}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-64">
                      <div className="text-lg">No data available</div>
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
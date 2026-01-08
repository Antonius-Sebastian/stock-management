'use client'

import { useEffect, useState, useMemo } from 'react'
import { toast } from 'sonner'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import { StockReportTable } from '@/components/reports/stock-report-table'
import { logger } from '@/lib/logger'

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

// Nested structure for finished goods (by location), flat for raw materials
interface AllReportData {
  [dataType: string]:
    | StockReportResponse
    | { [locationId: string]: StockReportResponse | null }
    | null
}

interface Location {
  id: string
  name: string
  isDefault: boolean
}

const MONTHS = [
  { value: '1', label: 'Januari' },
  { value: '2', label: 'Februari' },
  { value: '3', label: 'Maret' },
  { value: '4', label: 'April' },
  { value: '5', label: 'Mei' },
  { value: '6', label: 'Juni' },
  { value: '7', label: 'Juli' },
  { value: '8', label: 'Agustus' },
  { value: '9', label: 'September' },
  { value: '10', label: 'Oktober' },
  { value: '11', label: 'November' },
  { value: '12', label: 'Desember' },
]

// YEARS will be populated dynamically from API

const DATA_TYPES = [
  { value: 'stok-awal', label: 'Stok Awal' },
  { value: 'stok-masuk', label: 'Stok Masuk' },
  { value: 'stok-keluar', label: 'Stok Keluar' },
  { value: 'stok-sisa', label: 'Stok Sisa' },
]

export default function ReportsPage() {
  const [reportType, setReportType] = useState('raw-materials')
  const [dataType, setDataType] = useState('stok-sisa')
  const [availableYears, setAvailableYears] = useState<string[]>([])
  const [year, setYear] = useState('')
  const [month, setMonth] = useState('')
  const [allReportData, setAllReportData] = useState<AllReportData>({
    'stok-awal': null,
    'stok-masuk': null,
    'stok-keluar': null,
    'stok-sisa': null,
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isLoadingYears, setIsLoadingYears] = useState(true)
  const [locations, setLocations] = useState<Location[]>([])
  const [selectedLocation, setSelectedLocation] = useState<string>('')

  // Filter by dataType and location on client side
  const reportData = useMemo(() => {
    const dataTypeData = allReportData[dataType]
    if (!dataTypeData) return null

    // For finished goods, filter by location
    if (reportType === 'finished-goods') {
      if (
        typeof dataTypeData === 'object' &&
        dataTypeData !== null &&
        !('data' in dataTypeData)
      ) {
        // Safety check: ensure selectedLocation is set
        if (!selectedLocation) return null
        return (
          (
            dataTypeData as { [locationId: string]: StockReportResponse | null }
          )[selectedLocation] || null
        )
      }
    }

    // For raw materials, return directly
    return dataTypeData as StockReportResponse | null
  }, [allReportData, dataType, reportType, selectedLocation])

  // Fetch all dataTypes (and locations for finished goods) in parallel
  const fetchAllReportData = async () => {
    setIsLoading(true)
    try {
      const baseParams = new URLSearchParams({
        year,
        month,
        type: reportType,
      })

      // For finished goods: fetch all locations × all dataTypes
      if (reportType === 'finished-goods') {
        if (locations.length === 0) {
          toast.error('Silakan pilih lokasi terlebih dahulu')
          setIsLoading(false)
          return
        }

        // Create promises for all combinations: locations × dataTypes
        const allPromises: Array<
          Promise<{
            dataType: string
            locationId: string
            data: StockReportResponse
          }>
        > = []

        for (const location of locations) {
          for (const dt of DATA_TYPES) {
            const params = new URLSearchParams(baseParams)
            params.append('dataType', dt.value)
            params.append('locationId', location.id)

            const promise = fetch(`/api/reports/stock?${params}`).then(
              async (response) => {
                if (!response.ok) {
                  throw new Error(
                    `Gagal memuat laporan ${dt.label} untuk ${location.name}`
                  )
                }
                const data = await response.json()
                return { dataType: dt.value, locationId: location.id, data }
              }
            )

            allPromises.push(promise)
          }
        }

        const results = await Promise.all(allPromises)

        // Store in nested structure: allReportData[dataType][locationId]
        const newAllReportData: AllReportData = {
          'stok-awal': {},
          'stok-masuk': {},
          'stok-keluar': {},
          'stok-sisa': {},
        }

        results.forEach(({ dataType, locationId, data }) => {
          if (
            typeof newAllReportData[dataType] === 'object' &&
            newAllReportData[dataType] !== null &&
            !('data' in newAllReportData[dataType])
          ) {
            ;(
              newAllReportData[dataType] as {
                [locationId: string]: StockReportResponse | null
              }
            )[locationId] = data
          }
        })

        setAllReportData(newAllReportData)
      } else {
        // For raw materials: fetch all 4 dataTypes in parallel
        const dataTypePromises = DATA_TYPES.map(async (dt) => {
          const params = new URLSearchParams(baseParams)
          params.append('dataType', dt.value)

          const response = await fetch(`/api/reports/stock?${params}`)
          if (!response.ok) {
            throw new Error(`Gagal memuat laporan ${dt.label}`)
          }
          const data = await response.json()
          return { dataType: dt.value, data }
        })

        const results = await Promise.all(dataTypePromises)

        // Store all dataTypes in state
        const newAllReportData: AllReportData = {
          'stok-awal': null,
          'stok-masuk': null,
          'stok-keluar': null,
          'stok-sisa': null,
        }

        results.forEach(({ dataType, data }) => {
          newAllReportData[dataType] = data
        })

        setAllReportData(newAllReportData)
      }
    } catch (error) {
      logger.error('Error fetching report:', error)
      toast.error('Gagal memuat laporan. Silakan coba lagi.')
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch available years from earliest data
  useEffect(() => {
    const fetchAvailableYears = async () => {
      try {
        const response = await fetch('/api/reports/available-years')
        if (!response.ok) {
          throw new Error('Failed to fetch available years')
        }
        const data = await response.json()
        const years = data.years || []

        // Filter out future years - only allow current year or earlier
        const currentDate = new Date()
        const currentYear = currentDate.getFullYear()
        const filteredYears = years.filter(
          (y: string) => parseInt(y) <= currentYear
        )
        setAvailableYears(filteredYears)

        // Set default to current year/month if available
        const currentYearStr = currentYear.toString()
        const currentMonth = (currentDate.getMonth() + 1).toString()

        if (filteredYears.includes(currentYearStr)) {
          setYear(currentYearStr)
        } else if (filteredYears.length > 0) {
          setYear(filteredYears[filteredYears.length - 1]) // Use latest available year
        }

        setMonth(currentMonth)
      } catch (error) {
        logger.error('Error fetching available years:', error)
        // Fallback to current year if API fails
        const currentYear = new Date().getFullYear().toString()
        setAvailableYears([currentYear])
        setYear(currentYear)
        setMonth((new Date().getMonth() + 1).toString())
      } finally {
        setIsLoadingYears(false)
      }
    }

    fetchAvailableYears()
  }, [])

  // Fetch locations for finished goods filter
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const response = await fetch('/api/locations')
        if (response.ok) {
          const data = await response.json()
          setLocations(data)
          // Set default to first location if available and no location selected
          if (data.length > 0 && !selectedLocation) {
            setSelectedLocation(data[0].id)
          }
        }
      } catch (error) {
        logger.error('Error fetching locations:', error)
      }
    }
    if (reportType === 'finished-goods') {
      fetchLocations()
      // Reset allReportData structure when switching to finished goods
      setAllReportData({
        'stok-awal': {},
        'stok-masuk': {},
        'stok-keluar': {},
        'stok-sisa': {},
      })
    } else {
      // Clear location when switching to raw materials
      setSelectedLocation('')
      // Reset allReportData structure when switching to raw materials
      setAllReportData({
        'stok-awal': null,
        'stok-masuk': null,
        'stok-keluar': null,
        'stok-sisa': null,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportType])

  useEffect(() => {
    if (!isLoadingYears && year && month) {
      // For finished goods, require locations to be loaded
      if (reportType === 'finished-goods' && locations.length === 0) {
        return
      }
      fetchAllReportData() // Fetch all dataTypes (and locations for finished goods)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportType, year, month, isLoadingYears, locations.length])
  // Note: dataType and selectedLocation removed from dependencies - filtered client-side

  const getReportTitle = () => {
    const typeLabel =
      reportType === 'raw-materials'
        ? 'Laporan Bahan Baku'
        : 'Laporan Produk Jadi'
    const dataTypeLabel =
      DATA_TYPES.find((dt) => dt.value === dataType)?.label || ''
    const monthLabel = MONTHS.find((m) => m.value === month)?.label || ''

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
        throw new Error('Gagal mengekspor laporan')
      }

      // Get the filename from the Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition')
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/)
      const filename = filenameMatch ? filenameMatch[1] : 'report.xlsx'

      // Download the file
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success('Laporan berhasil diekspor')
    } catch (error) {
      logger.error('Error exporting report:', error)
      toast.error('Gagal mengekspor laporan. Silakan coba lagi.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">
            Laporan Stok
          </h1>
          <p className="text-muted-foreground">
            Laporan pergerakan stok interaktif dengan rincian harian
          </p>
        </div>
      </div>

      <div className="flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:gap-4">
          <Select
            value={year}
            onValueChange={setYear}
            disabled={isLoadingYears || availableYears.length === 0}
          >
            <SelectTrigger className="w-full sm:w-[100px]">
              <SelectValue
                placeholder={isLoadingYears ? 'Loading...' : 'Tahun'}
              />
            </SelectTrigger>
            <SelectContent>
              {isLoadingYears ? (
                <SelectItem value="loading" disabled>
                  Loading...
                </SelectItem>
              ) : availableYears.length === 0 ? (
                <SelectItem value="no-data" disabled>
                  No data available
                </SelectItem>
              ) : (
                availableYears.map((y) => (
                  <SelectItem key={y} value={y}>
                    {y}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>

          <Select value={month} onValueChange={setMonth} disabled={!year}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue placeholder="Bulan" />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m) => {
                const monthNum = parseInt(m.value)
                const yearNum = year ? parseInt(year) : new Date().getFullYear()
                const currentDate = new Date()
                const currentYear = currentDate.getFullYear()
                const currentMonth = currentDate.getMonth() + 1

                // Disable future months/years
                const isFuture =
                  yearNum > currentYear ||
                  (yearNum === currentYear && monthNum > currentMonth)

                return (
                  <SelectItem key={m.value} value={m.value} disabled={isFuture}>
                    {m.label}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={handleExport}
          variant="outline"
          disabled={isExporting}
          className="w-full sm:w-auto"
        >
          <Download className="mr-2 h-4 w-4" />
          {isExporting ? 'Mengekspor...' : 'Ekspor ke Excel'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{getReportTitle()}</CardTitle>
          <CardDescription>
            Pergerakan stok harian dalam format tabel pivot dengan kolom item
            yang tetap
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={reportType} onValueChange={setReportType}>
            <TabsList className="mb-4 grid w-full grid-cols-2 justify-start sm:inline-flex sm:w-auto">
              <TabsTrigger value="raw-materials" className="text-xs sm:text-sm">
                Laporan Bahan Baku
              </TabsTrigger>
              <TabsTrigger
                value="finished-goods"
                className="text-xs sm:text-sm"
              >
                Laporan Produk Jadi
              </TabsTrigger>
            </TabsList>

            <TabsContent value={reportType}>
              {/* Location tabs for finished goods */}
              {reportType === 'finished-goods' && locations.length > 0 && (
                <Tabs
                  value={selectedLocation}
                  onValueChange={setSelectedLocation}
                  className="mb-4 w-full"
                >
                  <TabsList className="grid w-full grid-cols-2 justify-start gap-1 sm:inline-flex sm:w-auto sm:grid-cols-none">
                    {locations.map((loc) => (
                      <TabsTrigger
                        key={loc.id}
                        value={loc.id}
                        className="flex-1 sm:flex-initial"
                      >
                        {loc.name}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              )}

              <Tabs value={dataType} onValueChange={setDataType}>
                <TabsList className="mb-6 grid h-auto w-full grid-cols-2 justify-start sm:grid-cols-4">
                  {DATA_TYPES.map((dt) => (
                    <TabsTrigger
                      key={dt.value}
                      value={dt.value}
                      className="text-xs sm:text-sm"
                    >
                      {dt.label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                <TabsContent value={dataType}>
                  {isLoading ? (
                    <div className="flex h-64 items-center justify-center">
                      <div className="text-lg">Memuat laporan...</div>
                    </div>
                  ) : reportData ? (
                    <StockReportTable
                      data={reportData.data}
                      currentDay={reportData.meta.currentDay}
                    />
                  ) : (
                    <div className="flex h-64 items-center justify-center">
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

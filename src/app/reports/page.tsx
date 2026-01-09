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
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Download,
  Loader2,
  BarChart3,
  Package,
  ShoppingCart,
} from 'lucide-react'
import { StockReportTable } from '@/components/reports/stock-report-table'
import { logger } from '@/lib/logger'
import { cn } from '@/lib/utils'

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

      // Add locationId for finished goods
      if (reportType === 'finished-goods' && selectedLocation) {
        params.append('locationId', selectedLocation)
      }

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

      toast.success(
        `Laporan berhasil diekspor: ${filename}. File telah didownload ke perangkat Anda.`
      )
    } catch (error) {
      logger.error('Error exporting report:', error)
      toast.error('Gagal mengekspor laporan. Silakan coba lagi.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Laporan Stok
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Laporan pergerakan stok interaktif dengan rincian harian
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filter Laporan</CardTitle>
          <CardDescription>
            Pilih periode dan tipe laporan yang ingin dilihat
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="grid grid-cols-2 gap-3 sm:flex sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="year-select">Tahun</Label>
                <Select
                  value={year}
                  onValueChange={setYear}
                  disabled={isLoadingYears || availableYears.length === 0}
                >
                  <SelectTrigger id="year-select" className="w-full sm:w-[120px]">
                    <SelectValue
                      placeholder={isLoadingYears ? 'Loading...' : 'Tahun'}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingYears ? (
                      <SelectItem value="loading" disabled>
                        Memuat...
                      </SelectItem>
                    ) : availableYears.length === 0 ? (
                      <SelectItem value="no-data" disabled>
                        Tidak ada data tersedia
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="month-select">Bulan</Label>
                <Select value={month} onValueChange={setMonth} disabled={!year}>
                  <SelectTrigger id="month-select" className="w-full sm:w-[160px]">
                    <SelectValue placeholder="Bulan" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m) => {
                      const monthNum = parseInt(m.value)
                      const yearNum = year
                        ? parseInt(year)
                        : new Date().getFullYear()
                      const currentDate = new Date()
                      const currentYear = currentDate.getFullYear()
                      const currentMonth = currentDate.getMonth() + 1

                      // Disable future months/years
                      const isFuture =
                        yearNum > currentYear ||
                        (yearNum === currentYear && monthNum > currentMonth)

                      return (
                        <SelectItem
                          key={m.value}
                          value={m.value}
                          disabled={isFuture}
                        >
                          {m.label}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
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

          {/* Active filters summary */}
          {(year || month || reportType) && (
            <div className="flex flex-wrap gap-2 pt-2 border-t">
              <span className="text-muted-foreground text-sm font-medium flex items-center">
                Filter aktif:
              </span>
              {year && (
                <Badge variant="secondary" className="text-xs">
                  Tahun: {year}
                </Badge>
              )}
              {month && (
                <Badge variant="secondary" className="text-xs">
                  {MONTHS.find((m) => m.value === month)?.label || 'Bulan'}
                </Badge>
              )}
              {reportType && (
                <Badge variant="secondary" className="text-xs">
                  {reportType === 'raw-materials'
                    ? 'Bahan Baku'
                    : 'Produk Jadi'}
                </Badge>
              )}
              {reportType === 'finished-goods' && selectedLocation && (
                <Badge variant="secondary" className="text-xs">
                  {locations.find((l) => l.id === selectedLocation)?.name ||
                    'Lokasi'}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

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
            <TabsList className="mb-4 grid w-full grid-cols-2 gap-2 sm:inline-flex sm:w-auto sm:gap-2">
              <TabsTrigger
                value="raw-materials"
                className={cn(
                  'text-xs sm:text-sm transition-all duration-200',
                  'data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm'
                )}
              >
                <Package className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Laporan Bahan Baku</span>
                <span className="sm:hidden">Bahan Baku</span>
              </TabsTrigger>
              <TabsTrigger
                value="finished-goods"
                className={cn(
                  'text-xs sm:text-sm transition-all duration-200',
                  'data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm'
                )}
              >
                <ShoppingCart className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Laporan Produk Jadi</span>
                <span className="sm:hidden">Produk Jadi</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value={reportType}>
              {/* Location tabs for finished goods */}
              {reportType === 'finished-goods' && locations.length > 0 && (
                <div className="mb-4 w-full overflow-x-auto sm:overflow-visible">
                  <Tabs
                    value={selectedLocation}
                    onValueChange={setSelectedLocation}
                    className="w-full"
                  >
                    <TabsList className="grid w-full min-w-max grid-cols-2 justify-start gap-2 sm:inline-flex sm:w-auto sm:grid-cols-none">
                      {locations.map((loc) => (
                        <TabsTrigger
                          key={loc.id}
                          value={loc.id}
                          className={cn(
                            'flex-1 sm:flex-initial transition-all duration-200',
                            'data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm'
                          )}
                        >
                          {loc.name}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </div>
              )}

              <Tabs value={dataType} onValueChange={setDataType}>
                <TabsList className="mb-6 grid h-auto w-full grid-cols-2 gap-2 justify-start sm:grid-cols-4 sm:gap-2">
                  {DATA_TYPES.map((dt) => (
                    <TabsTrigger
                      key={dt.value}
                      value={dt.value}
                      className={cn(
                        'text-xs sm:text-sm transition-all duration-200',
                        'data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm'
                      )}
                    >
                      {dt.label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                <TabsContent value={dataType}>
                  {isLoading ? (
                    <div className="flex h-64 flex-col items-center justify-center space-y-4">
                      <div className="relative">
                        <Loader2 className="text-primary h-12 w-12 animate-spin transition-opacity duration-300" />
                        <Loader2
                          className="text-primary/50 absolute inset-0 h-12 w-12 animate-spin transition-opacity duration-300"
                          style={{
                            animationDirection: 'reverse',
                            animationDuration: '1.5s',
                          }}
                        />
                      </div>
                      <div className="text-center space-y-1">
                        <p className="text-muted-foreground animate-pulse text-sm font-medium">
                          Memuat laporan...
                        </p>
                        <p className="text-muted-foreground text-xs">
                          Mohon tunggu, sedang mengambil data
                        </p>
                      </div>
                    </div>
                  ) : reportData && reportData.data.length > 0 ? (
                    <StockReportTable
                      data={reportData.data}
                      currentDay={reportData.meta.currentDay}
                    />
                  ) : (
                    <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/20">
                      <div className="text-muted-foreground rounded-full bg-muted/50 p-3">
                        <BarChart3 className="h-6 w-6" />
                      </div>
                      <div className="text-center">
                        <p className="text-muted-foreground font-medium">
                          Tidak ada data tersedia
                        </p>
                        <p className="text-muted-foreground mt-1 text-sm">
                          Coba pilih periode lain atau filter yang berbeda
                        </p>
                      </div>
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

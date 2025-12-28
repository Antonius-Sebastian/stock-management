"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { StockReportTable } from "@/components/reports/stock-report-table";

interface StockReportData {
  id: string;
  name: string;
  code: string;
  [key: string]: string | number;
}

interface StockReportResponse {
  data: StockReportData[];
  meta: {
    year: number;
    month: number;
    type: string;
    dataType: string;
    daysInMonth: number;
    currentDay: number;
  };
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
];

// YEARS will be populated dynamically from API

const DATA_TYPES = [
  { value: "stok-awal", label: "Stok Awal" },
  { value: "stok-masuk", label: "Stok Masuk" },
  { value: "stok-keluar", label: "Stok Keluar" },
  { value: "stok-sisa", label: "Stok Sisa" },
];

export default function ReportsPage() {
  const [reportType, setReportType] = useState("raw-materials");
  const [dataType, setDataType] = useState("stok-sisa");
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [reportData, setReportData] = useState<StockReportResponse | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isLoadingYears, setIsLoadingYears] = useState(true);

  const fetchReport = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        year,
        month,
        type: reportType,
        dataType,
      });

      const response = await fetch(`/api/reports/stock?${params}`);
      if (!response.ok) {
        throw new Error("Gagal memuat laporan");
      }
      const data = await response.json();
      setReportData(data);
    } catch (error) {
      console.error("Error fetching report:", error);
      toast.error("Gagal memuat laporan. Silakan coba lagi.");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch available years from earliest data
  useEffect(() => {
    const fetchAvailableYears = async () => {
      try {
        const response = await fetch("/api/reports/available-years");
        if (!response.ok) {
          throw new Error("Failed to fetch available years");
        }
        const data = await response.json();
        const years = data.years || [];
        setAvailableYears(years);

        // Set default to current year/month if available
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear().toString();
        const currentMonth = (currentDate.getMonth() + 1).toString();

        if (years.includes(currentYear)) {
          setYear(currentYear);
        } else if (years.length > 0) {
          setYear(years[years.length - 1]); // Use latest available year
        }

        setMonth(currentMonth);
      } catch (error) {
        console.error("Error fetching available years:", error);
        // Fallback to current year if API fails
        const currentYear = new Date().getFullYear().toString();
        setAvailableYears([currentYear]);
        setYear(currentYear);
        setMonth((new Date().getMonth() + 1).toString());
      } finally {
        setIsLoadingYears(false);
      }
    };

    fetchAvailableYears();
  }, []);

  useEffect(() => {
    if (!isLoadingYears && year && month) {
      fetchReport();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportType, dataType, year, month, isLoadingYears]);

  const getReportTitle = () => {
    const typeLabel =
      reportType === "raw-materials"
        ? "Laporan Bahan Baku"
        : "Laporan Produk Jadi";
    const dataTypeLabel =
      DATA_TYPES.find((dt) => dt.value === dataType)?.label || "";
    const monthLabel = MONTHS.find((m) => m.value === month)?.label || "";

    return `${typeLabel} - ${dataTypeLabel} - ${monthLabel} ${year}`;
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams({
        year,
        month,
        type: reportType,
      });

      const response = await fetch(`/api/reports/export?${params}`);
      if (!response.ok) {
        throw new Error("Gagal mengekspor laporan");
      }

      // Get the filename from the Content-Disposition header
      const contentDisposition = response.headers.get("Content-Disposition");
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : "report.xlsx";

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Laporan berhasil diekspor");
    } catch (error) {
      console.error("Error exporting report:", error);
      toast.error("Gagal mengekspor laporan. Silakan coba lagi.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">
          Laporan Stok
        </h1>
        <p className="text-muted-foreground">
          Laporan pergerakan stok interaktif dengan rincian harian
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto">
          <Select
            value={year}
            onValueChange={setYear}
            disabled={isLoadingYears || availableYears.length === 0}
          >
            <SelectTrigger className="w-full sm:w-[100px]">
              <SelectValue
                placeholder={isLoadingYears ? "Loading..." : "Tahun"}
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
              {MONTHS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
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
          {isExporting ? "Mengekspor..." : "Ekspor ke Excel"}
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
            <TabsList className="mb-4 w-full sm:w-auto grid grid-cols-2 sm:inline-grid">
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
              <Tabs value={dataType} onValueChange={setDataType}>
                <TabsList className="mb-6 w-full grid grid-cols-2 sm:grid-cols-4 h-auto">
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
  );
}

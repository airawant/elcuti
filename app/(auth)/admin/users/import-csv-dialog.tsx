"use client";

import { useState, useRef, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Upload,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  Loader2,
  X,
  FileUp,
} from "lucide-react";

// ==========================================
// CSV Parser (tanpa library eksternal)
// ==========================================

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        current += '"';
        i++; // skip next quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
  }
  result.push(current);
  return result;
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((l) => l.trim() !== "");

  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase());

  return lines.slice(1).map((line) => {
    const values = parseCSVLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((header, i) => {
      obj[header] = values[i]?.trim() || "";
    });
    return obj;
  });
}

// ==========================================
// Template CSV Download
// ==========================================

function downloadTemplate() {
  const currentYear = new Date().getFullYear();
  const headers = [
    "nip",
    "name",
    "password",
    "role",
    "position",
    "workunit",
    "email",
    "phone",
    "address",
    "isapprover",
    "isauthorizedofficer",
    "masa_kerja",
    "tipe_pengguna",
    `cuti_${currentYear - 2}`,
    `cuti_${currentYear - 1}`,
    `cuti_${currentYear}`,
  ];

  // Contoh data
  const exampleRow = [
    "199001012020011001",
    "Budi Santoso",
    "password123",
    "user",
    "Staf",
    "Unit Kerja A",
    "budi@email.com",
    "081234567890",
    "Jl. Contoh No. 1",
    "false",
    "false",
    "2020-01-01",
    "PNS",
    "0",
    "6",
    "12",
  ];

  const csvContent = [headers.join(","), exampleRow.join(",")].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "template_import_pegawai.csv");
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ==========================================
// Tipe
// ==========================================

interface ImportError {
  row: number;
  message: string;
}

interface ImportResult {
  total: number;
  success: number;
  failed: number;
  errors: ImportError[];
}

type ImportStep = "upload" | "preview" | "importing" | "result";

interface ImportCSVDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportSuccess: () => void;
}

// ==========================================
// Komponen Utama
// ==========================================

export function ImportCSVDialog({
  open,
  onOpenChange,
  onImportSuccess,
}: ImportCSVDialogProps) {
  const [step, setStep] = useState<ImportStep>("upload");
  const [parsedData, setParsedData] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [clientErrors, setClientErrors] = useState<ImportError[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state saat dialog ditutup
  const handleClose = useCallback(() => {
    setStep("upload");
    setParsedData([]);
    setFileName("");
    setImportResult(null);
    setIsImporting(false);
    setDragOver(false);
    setClientErrors([]);
    onOpenChange(false);
  }, [onOpenChange]);

  // Proses file CSV
  const processFile = useCallback((file: File) => {
    if (!file.name.endsWith(".csv")) {
      alert("Hanya file CSV (.csv) yang didukung.");
      return;
    }

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const data = parseCSV(text);

      if (data.length === 0) {
        alert("File CSV kosong atau format tidak valid.");
        return;
      }

      // Validasi header wajib
      const requiredHeaders = ["nip", "name", "password", "role"];
      const headers = Object.keys(data[0]);
      const missingHeaders = requiredHeaders.filter(
        (h) => !headers.includes(h)
      );

      if (missingHeaders.length > 0) {
        alert(
          `Kolom wajib tidak ditemukan: ${missingHeaders.join(", ")}\n\nPastikan file CSV memiliki kolom: ${requiredHeaders.join(", ")}`
        );
        return;
      }

      // Validasi client-side dasar
      const errors: ImportError[] = [];
      data.forEach((row, i) => {
        const rowNum = i + 2;
        if (!row.nip?.trim()) errors.push({ row: rowNum, message: "NIP wajib diisi" });
        if (!row.name?.trim()) errors.push({ row: rowNum, message: "Nama wajib diisi" });
        if (!row.password?.trim()) errors.push({ row: rowNum, message: "Password wajib diisi" });
        if (!row.role?.trim()) errors.push({ row: rowNum, message: "Role wajib diisi" });

        const role = row.role?.toLowerCase().trim();
        if (role && role !== "admin" && role !== "user") {
          errors.push({ row: rowNum, message: `Role tidak valid: "${row.role}"` });
        }

        if (row.tipe_pengguna?.trim()) {
          const tipe = row.tipe_pengguna.toUpperCase().trim();
          if (tipe !== "PNS" && tipe !== "PPPK") {
            errors.push({ row: rowNum, message: `Tipe pengguna tidak valid: "${row.tipe_pengguna}"` });
          }
        }

        if (row.email?.trim()) {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email.trim())) {
            errors.push({ row: rowNum, message: `Email tidak valid: "${row.email}"` });
          }
        }
      });

      setClientErrors(errors);
      setParsedData(data);
      setStep("preview");
    };
    reader.readAsText(file);
  }, []);

  // Handle file input change
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  // Handle drag & drop
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  // Kirim data ke API
  const handleImport = async () => {
    setIsImporting(true);
    setStep("importing");

    try {
      const response = await fetch("/api/users/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: parsedData }),
      });

      const result = await response.json();

      if (!response.ok) {
        setImportResult({
          total: parsedData.length,
          success: 0,
          failed: parsedData.length,
          errors: [{ row: 0, message: result.error || "Terjadi kesalahan saat import" }],
        });
      } else {
        setImportResult(result);
        if (result.success > 0) {
          onImportSuccess();
        }
      }
    } catch (error) {
      setImportResult({
        total: parsedData.length,
        success: 0,
        failed: parsedData.length,
        errors: [
          {
            row: 0,
            message: error instanceof Error ? error.message : "Terjadi kesalahan jaringan",
          },
        ],
      });
    } finally {
      setIsImporting(false);
      setStep("result");
    }
  };

  // Hitung kolom cuti_* yang terdeteksi
  const cutiColumns =
    parsedData.length > 0
      ? Object.keys(parsedData[0]).filter((k) => k.startsWith("cuti_"))
      : [];

  return (
    <Sheet open={open} onOpenChange={(v) => (v ? onOpenChange(v) : handleClose())}>
      <SheetContent className="w-full sm:max-w-2xl overflow-hidden flex flex-col">
        <SheetHeader className="flex-shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5" />
            Import Pegawai dari CSV
          </SheetTitle>
          <SheetDescription>
            Upload file CSV untuk menambahkan data pegawai secara massal.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-hidden flex flex-col mt-4">
          {/* ========== STEP: UPLOAD ========== */}
          {step === "upload" && (
            <div className="flex flex-col gap-4 h-full">
              {/* Download Template */}
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-600" />
                  <span className="text-sm text-blue-800">
                    Belum punya template?
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadTemplate}
                  className="text-blue-700 border-blue-300 hover:bg-blue-100"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Download Template
                </Button>
              </div>

              {/* Drop Zone */}
              <div
                className={`flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-xl transition-all cursor-pointer min-h-[250px] ${
                  dragOver
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-300 hover:border-gray-400 bg-gray-50/50"
                }`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <Upload
                  className={`h-12 w-12 mb-4 ${
                    dragOver ? "text-blue-500" : "text-gray-400"
                  }`}
                />
                <p className="text-lg font-medium text-gray-700">
                  {dragOver
                    ? "Lepas file di sini..."
                    : "Klik atau seret file CSV ke sini"}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Format yang didukung: .csv
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            </div>
          )}

          {/* ========== STEP: PREVIEW ========== */}
          {step === "preview" && (
            <div className="flex flex-col gap-4 h-full overflow-hidden">
              {/* Info file */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border flex-shrink-0">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-gray-600" />
                  <span className="text-sm font-medium">{fileName}</span>
                </div>
                <Badge variant="secondary">{parsedData.length} baris data</Badge>
              </div>

              {/* Client-side error warning */}
              {clientErrors.length > 0 && (
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 flex-shrink-0">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <span className="text-sm font-medium text-amber-800">
                      Ditemukan {clientErrors.length} masalah pada data
                    </span>
                  </div>
                  <div className="max-h-24 overflow-y-auto">
                    {clientErrors.slice(0, 5).map((err, i) => (
                      <p key={i} className="text-xs text-amber-700">
                        Baris {err.row}: {err.message}
                      </p>
                    ))}
                    {clientErrors.length > 5 && (
                      <p className="text-xs text-amber-600 mt-1">
                        ...dan {clientErrors.length - 5} masalah lainnya
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Kolom cuti terdeteksi */}
              {cutiColumns.length > 0 && (
                <div className="p-3 bg-green-50 rounded-lg border border-green-200 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-green-800">
                      Kolom saldo cuti terdeteksi:{" "}
                      <strong>{cutiColumns.join(", ")}</strong> → akan dikonversi
                      ke <code className="bg-green-100 px-1 rounded">leave_balance</code>
                    </span>
                  </div>
                </div>
              )}

              {/* Tabel preview */}
              <ScrollArea className="flex-1 border rounded-lg">
                <div className="min-w-max">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12 sticky left-0 bg-white z-10">
                          #
                        </TableHead>
                        <TableHead className="sticky left-12 bg-white z-10">
                          NIP
                        </TableHead>
                        <TableHead>Nama</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Jabatan</TableHead>
                        <TableHead>Unit Kerja</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Tipe</TableHead>
                        {cutiColumns.map((col) => (
                          <TableHead key={col}>{col}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedData.slice(0, 50).map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs text-gray-500 sticky left-0 bg-white z-10">
                            {i + 2}
                          </TableCell>
                          <TableCell className="font-mono text-xs sticky left-12 bg-white z-10">
                            {row.nip}
                          </TableCell>
                          <TableCell className="text-sm">{row.name}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                row.role?.toLowerCase() === "admin"
                                  ? "default"
                                  : "secondary"
                              }
                              className="text-xs"
                            >
                              {row.role}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {row.position || "-"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {row.workunit || "-"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {row.email || "-"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {row.tipe_pengguna || "-"}
                          </TableCell>
                          {cutiColumns.map((col) => (
                            <TableCell key={col} className="text-sm text-center">
                              {row[col] || "0"}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {parsedData.length > 50 && (
                  <div className="p-3 text-center text-sm text-gray-500 bg-gray-50 border-t">
                    Menampilkan 50 dari {parsedData.length} baris. Semua data akan
                    diimport.
                  </div>
                )}
              </ScrollArea>

              {/* Tombol aksi */}
              <div className="flex items-center justify-between flex-shrink-0 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setStep("upload");
                    setParsedData([]);
                    setFileName("");
                    setClientErrors([]);
                  }}
                >
                  <X className="h-4 w-4 mr-1" />
                  Ganti File
                </Button>
                <Button onClick={handleImport} disabled={parsedData.length === 0}>
                  <Upload className="h-4 w-4 mr-1" />
                  Import {parsedData.length} Data
                </Button>
              </div>
            </div>
          )}

          {/* ========== STEP: IMPORTING ========== */}
          {step === "importing" && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
              <div className="text-center">
                <p className="text-lg font-medium text-gray-700">
                  Mengimport data...
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Memproses {parsedData.length} baris data. Mohon tunggu...
                </p>
              </div>
            </div>
          )}

          {/* ========== STEP: RESULT ========== */}
          {step === "result" && importResult && (
            <div className="flex flex-col gap-4 h-full overflow-hidden">
              {/* Ringkasan */}
              <div className="grid grid-cols-3 gap-3 flex-shrink-0">
                <div className="p-4 bg-gray-50 rounded-lg border text-center">
                  <p className="text-2xl font-bold text-gray-800">
                    {importResult.total}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Total Data</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg border border-green-200 text-center">
                  <p className="text-2xl font-bold text-green-700">
                    {importResult.success}
                  </p>
                  <p className="text-xs text-green-600 mt-1">Berhasil</p>
                </div>
                <div className="p-4 bg-red-50 rounded-lg border border-red-200 text-center">
                  <p className="text-2xl font-bold text-red-700">
                    {importResult.failed}
                  </p>
                  <p className="text-xs text-red-600 mt-1">Gagal</p>
                </div>
              </div>

              {/* Status icon */}
              {importResult.success > 0 && importResult.failed === 0 && (
                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200 flex-shrink-0">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="text-sm text-green-800 font-medium">
                    Semua data berhasil diimport!
                  </span>
                </div>
              )}

              {importResult.success > 0 && importResult.failed > 0 && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200 flex-shrink-0">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  <span className="text-sm text-amber-800 font-medium">
                    Sebagian data berhasil diimport. Periksa daftar error di bawah.
                  </span>
                </div>
              )}

              {importResult.success === 0 && (
                <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg border border-red-200 flex-shrink-0">
                  <XCircle className="h-5 w-5 text-red-600" />
                  <span className="text-sm text-red-800 font-medium">
                    Tidak ada data yang berhasil diimport.
                  </span>
                </div>
              )}

              {/* Daftar error */}
              {importResult.errors.length > 0 && (
                <div className="flex-1 overflow-hidden flex flex-col">
                  <h4 className="text-sm font-medium text-gray-700 mb-2 flex-shrink-0">
                    Daftar Error ({importResult.errors.length})
                  </h4>
                  <ScrollArea className="flex-1 border rounded-lg">
                    <div className="p-3 space-y-2">
                      {importResult.errors.map((err, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 p-2 bg-red-50 rounded-md"
                        >
                          <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="text-xs font-medium text-red-800">
                              {err.row > 0 ? `Baris ${err.row}` : "Umum"}
                            </span>
                            <p className="text-xs text-red-700">{err.message}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Tombol selesai */}
              <div className="flex items-center justify-between flex-shrink-0 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setStep("upload");
                    setParsedData([]);
                    setFileName("");
                    setImportResult(null);
                    setClientErrors([]);
                  }}
                >
                  Import Lagi
                </Button>
                <Button onClick={handleClose}>Selesai</Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

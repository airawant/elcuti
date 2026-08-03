"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/lib/auth-context"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  CheckSquare,
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Download,
  User,
  Building,
  Briefcase,
  AlertCircle,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface KegiatanRow {
  id?: number
  tanggal: string
  uraian_tugas: string | string[]
  realisasi: string | string[]
  urutan: number
}

interface LaporanApproval {
  id: number
  user_id: number
  approver_id: number
  bulan: number
  tahun: number
  dasar: string
  status: "draft" | "submitted" | "approved" | "rejected"
  pdf_url?: string
  approval_note?: string
  approved_at?: string
  created_at: string
  updated_at: string
  pegawai?: {
    id: number
    name: string
    nip: string
    position?: string
    workunit?: string
    email?: string
    phone?: string
  }
  kegiatan: KegiatanRow[]
}

const NAMA_BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
]

function formatText(content: string | string[]): string {
  if (Array.isArray(content)) {
    return content.join("\n")
  }
  return content || ""
}

export default function PersetujuanLkhPage() {
  const { user } = useAuth()
  const { toast } = useToast()

  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [daftarApproval, setDaftarApproval] = useState<LaporanApproval[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // State Detail & Persetujuan Modal
  const [selectedLaporan, setSelectedLaporan] = useState<LaporanApproval | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [approvalNote, setApprovalNote] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)

  // Fetch data pengajuan persetujuan LKH
  const fetchApprovalList = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/lkh/approval", { credentials: "include" })
      const json = await res.json()
      if (res.ok) {
        setDaftarApproval(json.data ?? [])
      } else {
        toast({ title: "Gagal memuat persetujuan LKH", description: json.error, variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "Gagal terhubung ke server", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (user && (user.isapprover || user.role === "admin")) {
      fetchApprovalList()
    }
  }, [user, fetchApprovalList])

  // Handle Approve / Reject
  const handleProcessApproval = async (newStatus: "approved" | "rejected") => {
    if (!selectedLaporan) return
    setIsProcessing(true)

    try {
      // Simulasikan pembuatan / link download PDF jika approved
      const fakePdfUrl = newStatus === "approved"
        ? `/api/lkh/${selectedLaporan.id}/download-pdf`
        : null

      const res = await fetch(`/api/lkh/${selectedLaporan.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          approval_note: approvalNote,
          approved_at: new Date().toISOString(),
          pdf_url: fakePdfUrl,
        }),
        credentials: "include",
      })

      if (res.ok) {
        toast({
          title: newStatus === "approved" ? "Data berhasil diperbarui" : "Data berhasil ditolak",
          description:
            newStatus === "approved"
              ? `Laporan LKH ${selectedLaporan.pegawai?.name || ""} berhasil disetujui.`
              : `Laporan LKH ${selectedLaporan.pegawai?.name || ""} berhasil ditolak.`,
        })
        setIsDetailOpen(false)
        setSelectedLaporan(null)
        setApprovalNote("")
        fetchApprovalList()
      } else {
        const json = await res.json()
        toast({
          title: "Gagal memperbarui data",
          description: json.error,
          variant: "destructive",
        })
      }
    } catch {
      toast({
        title: "Gagal memperbarui data",
        description: "Gagal terhubung ke server",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // Handle Download PDF
  const handleDownloadPdf = (laporan: LaporanApproval) => {
    toast({
      title: "Download PDF Persetujuan",
      description: `Mengunduh hasil persetujuan LKH ${NAMA_BULAN[laporan.bulan - 1]} ${laporan.tahun} milik ${laporan.pegawai?.name}.`,
    })
  }

  if (!user || (!user.isapprover && user.role !== "admin")) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full text-center p-6">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
          <CardTitle className="text-lg font-bold text-gray-800">Akses Dibatasi</CardTitle>
          <CardDescription className="mt-2 text-sm text-gray-600">
            Halaman ini khusus untuk Atasan / Pejabat Penandatangan yang memiliki hak persetujuan (`isapprover = true`).
          </CardDescription>
        </Card>
      </div>
    )
  }

  const pendingList = daftarApproval.filter((a) => a.status === "submitted")
  const historyList = daftarApproval.filter((a) => a.status === "approved" || a.status === "rejected")

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Mobile sidebar */}
      <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
        <SheetContent side="left" className="p-0">
          <Sidebar />
        </SheetContent>
      </Sheet>

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          title="Persetujuan LKH Pegawai"
          onMenuClick={() => setIsMobileOpen(true)}
        />

        <main className="flex-1 p-4 md:p-6 space-y-6 max-w-6xl mx-auto w-full">

          {/* Banner Header */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-700 via-emerald-700 to-cyan-800 text-white p-6 shadow-lg">
            <div className="relative z-10 flex items-start gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm shrink-0">
                <CheckSquare className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold mb-1">Daftar Persetujuan LKH</h2>
                <p className="text-teal-100 text-sm leading-relaxed max-w-xl">
                  Evaluasi dan beri pengesahan persetujuan Laporan Kinerja Harian bawahan Anda.
                </p>
              </div>
            </div>
          </div>

          {/* Tab Pending Approval */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />
                Menunggu Persetujuan
                <Badge className="bg-amber-100 text-amber-800 border border-amber-300 ml-1">
                  {pendingList.length}
                </Badge>
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchApprovalList}
                disabled={isLoading}
                className="h-8 text-xs text-gray-500 hover:text-gray-800"
              >
                {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Refresh"}
              </Button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-gray-400">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span>Memuat daftar persetujuan...</span>
              </div>
            ) : pendingList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200 shadow-sm">
                <CheckCircle2 className="h-10 w-10 mb-2 text-emerald-400" />
                <p className="text-sm font-medium text-gray-600">Tidak ada LKH yang menunggu persetujuan</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingList.map((item) => (
                  <Card key={item.id} className="border border-amber-200 bg-amber-50/30 hover:shadow-md transition-all">
                    <CardHeader className="pb-3 pt-4 px-5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-base font-bold text-gray-800">
                            {item.pegawai?.name || "Pegawai"}
                          </CardTitle>
                          <CardDescription className="text-xs text-gray-500 mt-0.5">
                            NIP. {item.pegawai?.nip || "-"} &bull; {item.pegawai?.position || "-"}
                          </CardDescription>
                        </div>
                        <Badge className="bg-amber-100 text-amber-800 border border-amber-300">
                          Pending
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="px-5 pb-3 text-xs space-y-1.5">
                      <div className="flex items-center justify-between text-gray-600 bg-white p-2 rounded-lg border border-amber-100">
                        <span>Periode LKH:</span>
                        <strong className="text-gray-800">{NAMA_BULAN[item.bulan - 1]} {item.tahun}</strong>
                      </div>
                      <div className="flex items-center justify-between text-gray-600">
                        <span>Total Kegiatan:</span>
                        <span className="font-semibold text-gray-700">{item.kegiatan?.length || 0} Hari</span>
                      </div>
                    </CardContent>
                    <div className="px-5 py-3 border-t border-amber-100 bg-amber-100/30 flex justify-end gap-2">
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8"
                        onClick={() => {
                          setSelectedLaporan(item)
                          setApprovalNote(item.approval_note || "")
                          setIsDetailOpen(true)
                        }}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1.5" />
                        Tinjau & Setujui
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* History Approval */}
          <div className="space-y-4 pt-4">
            <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Riwayat Persetujuan
              <Badge className="bg-gray-100 text-gray-600 border border-gray-200 ml-1">
                {historyList.length}
              </Badge>
            </h3>

            {historyList.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400 bg-white rounded-xl border border-gray-200">
                Belum ada riwayat persetujuan LKH.
              </div>
            ) : (
              <div className="space-y-3">
                {historyList.map((item) => (
                  <Card key={item.id} className="border border-gray-200 hover:border-gray-300">
                    <div className="p-4 flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.status === "approved" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                          {item.status === "approved" ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{item.pegawai?.name}</p>
                          <p className="text-xs text-gray-500">
                            Periode: {NAMA_BULAN[item.bulan - 1]} {item.tahun} &bull; NIP: {item.pegawai?.nip}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={item.status === "approved" ? "bg-emerald-100 text-emerald-700 border border-emerald-300" : "bg-red-100 text-red-700 border border-red-300"}>
                          {item.status === "approved" ? "Disetujui" : "Ditolak"}
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadPdf(item)}
                          className="h-8 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                        >
                          <Download className="h-3.5 w-3.5 mr-1" /> PDF
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

        </main>
      </div>

      {/* Modal Detail & Persetujuan */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-5 pb-3 border-b border-gray-100 bg-gray-50/50">
            <DialogTitle className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <FileText className="h-5 w-5 text-emerald-600" />
              Tinjauan LKH Pegawai
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Periksa rincian kegiatan harian sebelum memberikan keputusan persetujuan.
            </DialogDescription>
          </DialogHeader>

          {selectedLaporan && (
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Header Pegawai */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-100 text-xs">
                <div>
                  <span className="text-gray-500 block">Nama Pegawai:</span>
                  <strong className="text-gray-800">{selectedLaporan.pegawai?.name}</strong>
                </div>
                <div>
                  <span className="text-gray-500 block">NIP:</span>
                  <strong className="text-gray-800">{selectedLaporan.pegawai?.nip}</strong>
                </div>
                <div>
                  <span className="text-gray-500 block">Jabatan:</span>
                  <strong className="text-gray-800">{selectedLaporan.pegawai?.position || "-"}</strong>
                </div>
              </div>

              {/* Tabel Kegiatan */}
              <div className="rounded-xl border border-gray-200 overflow-hidden text-xs">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-200">
                      <th className="px-3 py-2 text-left text-gray-600 font-semibold w-10">No</th>
                      <th className="px-3 py-2 text-left text-gray-600 font-semibold w-28">Tanggal</th>
                      <th className="px-3 py-2 text-left text-gray-600 font-semibold">Rencana Hasil Kerja</th>
                      <th className="px-3 py-2 text-left text-gray-600 font-semibold">Realisasi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedLaporan.kegiatan?.map((k, idx) => (
                      <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 align-top">
                        <td className="px-3 py-2 text-gray-400">{idx + 1}</td>
                        <td className="px-3 py-2 font-medium text-gray-700 whitespace-nowrap">
                          {new Date(k.tanggal + "T00:00:00").toLocaleDateString("id-ID", {
                            day: "numeric", month: "short", year: "numeric",
                          })}
                        </td>
                        <td className="px-3 py-2 text-gray-800 whitespace-pre-line leading-relaxed">
                          {formatText(k.uraian_tugas)}
                        </td>
                        <td className="px-3 py-2 text-gray-800 whitespace-pre-line leading-relaxed">
                          {formatText(k.realisasi)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Input Catatan Persetujuan */}
              <div className="space-y-1.5 pt-2">
                <label className="text-xs font-semibold text-gray-700">Catatan Persetujuan (Opsional):</label>
                <Textarea
                  value={approvalNote}
                  onChange={(e) => setApprovalNote(e.target.value)}
                  placeholder="Tambahkan arahan atau catatan persetujuan di sini..."
                  rows={3}
                  className="text-xs"
                />
              </div>
            </div>
          )}

          <DialogFooter className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between sm:justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDetailOpen(false)}
              disabled={isProcessing}
            >
              Batal
            </Button>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={isProcessing}
                onClick={() => handleProcessApproval("approved")}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
              >
                {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
                Setujui & Sahkan
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

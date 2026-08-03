"use client"

import { useState, useEffect, useCallback } from "react"
import useRouter from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  ClipboardList,
  Plus,
  Trash2,
  Send,
  ChevronDown,
  ChevronUp,
  FileText,
  Pencil,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Download,
  Eye,
  Copy,
  Link2,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"

// ─── Tipe Data ────────────────────────────────────────────────────────────────

export interface KegiatanRow {
  id?: number
  tanggal: string
  uraian_tugas: string | string[]
  realisasi: string | string[]
  urutan: number
}

export interface LaporanLKH {
  id: number
  user_id: number
  approver_id?: number
  bulan: number
  tahun: number
  dasar: string
  status: "draft" | "submitted" | "approved" | "rejected" | "signed"
  pdf_url?: string
  approval_note?: string
  approved_at?: string
  approver?: {
    id: number
    name: string
    nip: string
    position?: string
    workunit?: string
  }
  atasan_penandatangan?: {
    nama: string
    nip: string
    jabatan: string
  }
  created_at: string
  updated_at: string
  kegiatan: KegiatanRow[]
}

const NAMA_BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
]

// Helper format text
function formatText(content: string | string[]): string {
  if (Array.isArray(content)) {
    return content.join("\n")
  }
  return content || ""
}

// ─── Sub-komponen: Kartu Laporan Tersimpan ────────────────────────────────────
interface KartuLaporanProps {
  laporan: LaporanLKH
  onEdit: (laporan: LaporanLKH) => void
  onDelete: (id: number) => void
  onDuplicate: (laporan: LaporanLKH) => void
  onSendPdf: (laporan: LaporanLKH) => void
  onDownloadPdf: (laporan: LaporanLKH) => void
  onCopyPdfLink: (pdfUrl: string) => void
  isDuplicating?: boolean
}

function KartuLaporan({
  laporan,
  onEdit,
  onDelete,
  onDuplicate,
  onSendPdf,
  onDownloadPdf,
  onCopyPdfLink,
  isDuplicating = false,
}: KartuLaporanProps) {
  const [expanded, setExpanded] = useState(false)
  const jumlahBaris = laporan.kegiatan?.length ?? 0
  const isDraft = laporan.status === "draft"
  const isApproved = laporan.status === "approved" || laporan.status === "signed"
  const isRejected = laporan.status === "rejected"

  return (
    <Card className="border border-gray-200 hover:border-emerald-300 hover:shadow-md transition-all duration-200">
      <CardHeader className="pb-3 pt-4 px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 shrink-0">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold text-gray-800">
                {NAMA_BULAN[(laporan.bulan ?? 1) - 1]} {laporan.tahun}
              </CardTitle>
              <CardDescription className="text-xs text-gray-500 mt-0.5">
                {jumlahBaris} baris kegiatan &bull; Dibuat{" "}
                {new Date(laporan.created_at).toLocaleDateString("id-ID")}
                {laporan.approver?.name && (
                  <span className="block text-[11px] text-gray-500 mt-0.5">
                    Atasan Approver: <strong className="text-gray-700">{laporan.approver.name}</strong>
                  </span>
                )}
              </CardDescription>
            </div>
          </div>
          <Badge
            className={
              isApproved
                ? "bg-emerald-100 text-emerald-700 border border-emerald-300 font-medium"
                : isRejected
                ? "bg-red-100 text-red-700 border border-red-300 font-medium"
                : isDraft
                ? "bg-amber-100 text-amber-700 border border-amber-300 font-medium"
                : "bg-blue-100 text-blue-700 border border-blue-300 font-medium"
            }
          >
            {isApproved ? (
              <><CheckCircle2 className="h-3 w-3 mr-1" />Disetujui</>
            ) : isRejected ? (
              "Ditolak"
            ) : isDraft ? (
              "Draft"
            ) : (
              <><CheckCircle2 className="h-3 w-3 mr-1" />Menunggu Persetujuan</>
            )}
          </Badge>
        </div>
      </CardHeader>

      {laporan.pdf_url && (
        <CardContent className="px-5 pb-3 pt-0">
          <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 px-3 py-2.5">
            <p className="text-[11px] font-medium text-emerald-700 uppercase tracking-wide mb-1.5">
              Link PDF
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <a
                href={laporan.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-emerald-700 hover:text-emerald-900 underline break-all flex items-center gap-1 min-w-0"
              >
                <Link2 className="h-3.5 w-3.5 shrink-0" />
                {laporan.pdf_url}
              </a>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onCopyPdfLink(laporan.pdf_url!)}
                className="h-7 px-2.5 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-100 shrink-0"
              >
                <Copy className="h-3 w-3 mr-1" />
                Salin Link
              </Button>
            </div>
          </div>
        </CardContent>
      )}

      {/* Pratinjau kegiatan */}
      {expanded && laporan.kegiatan && laporan.kegiatan.length > 0 && (
        <CardContent className="px-5 pb-4">
          <div className="rounded-lg border border-gray-100 overflow-hidden text-xs">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-3 py-2 text-left text-gray-500 font-medium w-8">No</th>
                  <th className="px-3 py-2 text-left text-gray-500 font-medium w-28">Tanggal</th>
                  <th className="px-3 py-2 text-left text-gray-500 font-medium">Rencana Hasil Kerja</th>
                  <th className="px-3 py-2 text-left text-gray-500 font-medium">Realisasi</th>
                </tr>
              </thead>
              <tbody>
                {laporan.kegiatan.map((k, idx) => (
                  <tr key={idx} className="border-b border-gray-50 last:border-0 align-top">
                    <td className="px-3 py-2 text-gray-400">{idx + 1}</td>
                    <td className="px-3 py-2 text-gray-600 font-medium whitespace-nowrap">
                      {new Date(k.tanggal + "T00:00:00").toLocaleDateString("id-ID", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </td>
                    <td className="px-3 py-2 text-gray-700 whitespace-pre-line leading-relaxed">
                      {formatText(k.uraian_tugas)}
                    </td>
                    <td className="px-3 py-2 text-gray-700 whitespace-pre-line leading-relaxed">
                      {formatText(k.realisasi)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      )}

      <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50/50 flex-wrap gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-gray-600 hover:text-gray-900 h-7 px-2"
        >
          {expanded ? <ChevronUp className="h-3.5 w-3.5 mr-1" /> : <ChevronDown className="h-3.5 w-3.5 mr-1" />}
          {expanded ? "Sembunyikan" : "Lihat Detail"}
        </Button>
        <div className="flex gap-2 flex-wrap">
          {isDraft && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(laporan)}
              className="h-7 px-3 text-xs border-gray-200 text-gray-700 hover:border-emerald-300 hover:text-emerald-700"
            >
              <Pencil className="h-3 w-3 mr-1" />Edit
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDuplicate(laporan)}
            disabled={isDuplicating}
            className="h-7 px-3 text-xs border-violet-200 text-violet-600 hover:bg-violet-50"
          >
            {isDuplicating ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Copy className="h-3 w-3 mr-1" />
            )}
            Duplikat
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSendPdf(laporan)}
            className="h-7 px-3 text-xs border-blue-200 text-blue-600 hover:bg-blue-50"
          >
            <Send className="h-3 w-3 mr-1" />Kirim PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDownloadPdf(laporan)}
            className="h-7 px-3 text-xs border-emerald-200 text-emerald-600 hover:bg-emerald-50"
          >
            <Download className="h-3 w-3 mr-1" />Download PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDelete(laporan.id)}
            className="h-7 px-3 text-xs border-red-200 text-red-500 hover:bg-red-50"
          >
            <Trash2 className="h-3 w-3 mr-1" />Hapus
          </Button>
        </div>
      </div>
    </Card>
  )
}

// ─── Halaman Utama (List View) ──────────────────────────────────────────────────

export default function LkhPage() {
  const { user } = useAuth()
  const { toast } = useToast()

  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [daftarLaporan, setDaftarLaporan] = useState<LaporanLKH[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showDeleteDialog, setShowDeleteDialog] = useState<number | null>(null)
  const [duplicatingId, setDuplicatingId] = useState<number | null>(null)

  // Ambil daftar laporan dari API / mock local state
  const fetchLaporan = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/lkh", { credentials: "include" })
      const json = await res.json()
      if (res.ok) {
        setDaftarLaporan(json.data ?? [])
      } else {
        toast({ title: "Gagal memuat laporan", description: json.error, variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "Gagal terhubung ke server", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (user) fetchLaporan()
  }, [user, fetchLaporan])

  // Hapus laporan
  const handleHapus = async (id: number) => {
    try {
      const res = await fetch(`/api/lkh/${id}`, {
        method: "DELETE",
        credentials: "include",
      })

      if (res.ok) {
        toast({ title: "Data berhasil dihapus" })
        fetchLaporan()
      } else {
        const json = await res.json()
        toast({
          title: "Gagal menghapus data",
          description: json.error,
          variant: "destructive",
        })
      }
    } catch {
      toast({
        title: "Gagal menghapus data",
        description: "Gagal terhubung ke server",
        variant: "destructive",
      })
    } finally {
      setShowDeleteDialog(null)
    }
  }

  // Duplikasi laporan
  const handleDuplicate = async (laporan: LaporanLKH) => {
    setDuplicatingId(laporan.id)
    try {
      const res = await fetch(`/api/lkh/${laporan.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      })

      const json = await res.json()

      if (res.ok) {
        const newLaporan = json.data as LaporanLKH
        toast({
          title: "Data berhasil ditambahkan",
          description: `Salinan laporan ${NAMA_BULAN[(newLaporan.bulan ?? 1) - 1]} ${newLaporan.tahun} berhasil dibuat sebagai draft.`,
        })
        fetchLaporan()
      } else {
        toast({
          title: "Gagal menambah data",
          description: json.error,
          variant: "destructive",
        })
      }
    } catch {
      toast({
        title: "Gagal menambah data",
        description: "Gagal terhubung ke server",
        variant: "destructive",
      })
    } finally {
      setDuplicatingId(null)
    }
  }

  const handleCopyPdfLink = async (pdfUrl: string) => {
    try {
      await navigator.clipboard.writeText(pdfUrl)
      toast({ title: "Link disalin" })
    } catch {
      toast({
        title: "Gagal menyalin",
        description: "Tidak dapat menyalin link ke clipboard.",
        variant: "destructive",
      })
    }
  }

  // Handle Kirim PDF
  const handleSendPdf = (laporan: LaporanLKH) => {
    // console.log("[LKH PDF ACTION] Kirim PDF untuk Laporan:", laporan)
    toast({
      title: "Kirim PDF",
      description: `Proses pengiriman PDF laporan ${NAMA_BULAN[laporan.bulan - 1]} ${laporan.tahun} disimulasikan.`,
    })
  }

  // Handle Download PDF
  const handleDownloadPdf = (laporan: LaporanLKH) => {
    if (laporan.pdf_url) {
      window.open(laporan.pdf_url, "_blank", "noopener,noreferrer")
      return
    }

    toast({
      title: "PDF belum tersedia",
      description: `PDF laporan ${NAMA_BULAN[laporan.bulan - 1]} ${laporan.tahun} belum tersedia.`,
      variant: "destructive",
    })
  }

  if (!user) return null

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
          title="LKH – Laporan Kinerja Harian"
          onMenuClick={() => setIsMobileOpen(true)}
        />

        <main className="flex-1 p-4 md:p-6 space-y-6 max-w-6xl mx-auto w-full">

          {/* ── Header Info Pegawai Banner ── */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 text-white p-6 shadow-lg">
            <div className="relative z-10">
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div className="flex items-start gap-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm shrink-0">
                    <ClipboardList className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold mb-1">Laporan Kinerja Harian</h2>
                    <p className="text-emerald-100 text-sm leading-relaxed max-w-lg">
                      Kelola dan buat laporan kinerja harian pegawai Aparatur Sipil Negara sesuai ketentuan Kementerian Agama.
                    </p>
                  </div>
                </div>

                {/* Tombol Utama Buat Laporan */}
                <Link href="/lkh/buat">
                  <Button className="bg-white text-emerald-700 hover:bg-emerald-50 shadow-md font-semibold text-sm px-5 py-2.5 rounded-xl flex items-center gap-2">
                    <Plus className="h-4 w-4 stroke-[3]" />
                    Buat Laporan
                  </Button>
                </Link>
              </div>

              {/* Info pegawai */}
              <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Nama Pegawai", value: user.name },
                  { label: "NIP", value: user.nip },
                  { label: "Jabatan", value: user.position || "-" },
                  { label: "Unit Organisasi", value: user.workunit || "-" },
                ].map((item) => (
                  <div key={item.label} className="bg-white/15 backdrop-blur-sm rounded-xl px-3.5 py-2.5">
                    <p className="text-[10px] text-emerald-200 uppercase tracking-wide font-medium mb-0.5">{item.label}</p>
                    <p className="text-sm font-semibold text-white leading-tight truncate" title={item.value}>
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Background elements */}
            <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/5" />
            <div className="absolute -right-4 -bottom-12 w-56 h-56 rounded-full bg-white/5" />
          </div>

          {/* ── Daftar Laporan Tersimpan ── */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                <Eye className="h-4 w-4 text-gray-500" />
                Laporan Tersimpan
                {daftarLaporan.length > 0 && (
                  <Badge className="bg-gray-100 text-gray-600 border border-gray-200 ml-1">
                    {daftarLaporan.length}
                  </Badge>
                )}
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchLaporan}
                disabled={isLoading}
                className="h-8 text-xs text-gray-500 hover:text-gray-800"
              >
                {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Refresh"}
              </Button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-gray-400">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span>Memuat laporan...</span>
              </div>
            ) : daftarLaporan.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200 shadow-sm">
                <ClipboardList className="h-12 w-12 mb-3 text-gray-300" />
                <p className="text-sm font-medium text-gray-600">Belum ada laporan tersimpan</p>
                <p className="text-xs text-gray-400 mt-1 mb-4">Klik tombol di bawah untuk membuat laporan kinerja harian baru</p>
                <Link href="/lkh/buat">
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    <Plus className="h-4 w-4 mr-1.5" /> Buat Laporan Baru
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {daftarLaporan.map((laporan) => (
                  <KartuLaporan
                    key={laporan.id}
                    laporan={laporan}
                    onEdit={(l) => window.location.href = `/lkh/buat?id=${l.id}`}
                    onDelete={(id) => setShowDeleteDialog(id)}
                    onDuplicate={handleDuplicate}
                    onSendPdf={handleSendPdf}
                    onDownloadPdf={handleDownloadPdf}
                    onCopyPdfLink={handleCopyPdfLink}
                    isDuplicating={duplicatingId === laporan.id}
                  />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ── Konfirmasi Hapus ── */}
      <AlertDialog open={showDeleteDialog !== null} onOpenChange={() => setShowDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Hapus Laporan?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Laporan beserta seluruh baris kegiatannya akan dihapus secara permanen.
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => showDeleteDialog !== null && handleHapus(showDeleteDialog)}
              className="bg-red-600 hover:bg-red-700"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

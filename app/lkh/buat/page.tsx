"use client"

import { useState, useEffect, useCallback, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Save,
  Send,
  Loader2,
  ArrowLeft,
  UserCheck,
  ClipboardList,
  Calendar,
  AlertCircle,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"

// ─── Tipe Data ────────────────────────────────────────────────────────────────

interface KegiatanRowMinimal {
  tanggal: string // YYYY-MM-DD
  dayName: string // Sen, Sel, Rab, Kam, Jum, Sab, Min
  dayNumber: number // 1..31
  isWeekend: boolean
  isLeave: boolean
  leaveType?: string
  rencana_hasil_kerja: string
  realisasi: string
}

interface PegawaiOption {
  id: number
  name: string
  nip: string
  position: string
  isapprover: boolean
  workunit?: string
}

interface LeaveRequestItem {
  id: string
  user_id: number
  type: string
  status: string
  start_date: string
  end_date: string
}

const NAMA_BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
]

const TAHUN_OPTIONS = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 2 + i)

const DASAR_DEFAULT =
  "Surat Edaran Sekretaris Jenderal Kementerian Agama Nomor 7 Tahun 2026 tentang Pelaksanaan Tugas Kedinasan Bagi Pegawai Aparatur Sipil Negara dan Percepatan Transformasi Tata Kelola Penyelenggaraan Pemerintahan pada Kementerian Agama"

const HARI_INDONESIA = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"]

// Helper menghitung hari dalam bulan & mendeteksi cuti
function generateDaysForMonth(
  bulan: number,
  tahun: number,
  leaveRequests: LeaveRequestItem[],
  existingKegiatan?: any[]
): KegiatanRowMinimal[] {
  const daysInMonth = new Date(tahun, bulan, 0).getDate()
  const rows: KegiatanRowMinimal[] = []

  for (let d = 1; d <= daysInMonth; d++) {
    const monthStr = String(bulan).padStart(2, "0")
    const dayStr = String(d).padStart(2, "0")
    const dateFormatted = `${tahun}-${monthStr}-${dayStr}`

    const dateObj = new Date(tahun, bulan - 1, d)
    const dayOfWeek = dateObj.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    const dayName = HARI_INDONESIA[dayOfWeek]

    // Cek apakah tanggal ini berada di rentang cuti yang disetujui/pending
    let isLeave = false
    let leaveType = ""

    for (const req of leaveRequests) {
      if (req.status !== "Rejected" && req.start_date <= dateFormatted && dateFormatted <= req.end_date) {
        isLeave = true
        leaveType = req.type || "Cuti"
        break
      }
    }

    // Cari data yang sudah disimpan sebelumnya (jika edit)
    const existing = existingKegiatan?.find((k: any) => k.tanggal === dateFormatted)

    rows.push({
      tanggal: dateFormatted,
      dayName,
      dayNumber: d,
      isWeekend,
      isLeave,
      leaveType,
      rencana_hasil_kerja: existing
        ? Array.isArray(existing.uraian_tugas)
          ? existing.uraian_tugas.join("\n")
          : existing.uraian_tugas || ""
        : isLeave
          ? `[${leaveType.toUpperCase()}]`
          : "",
      realisasi: existing
        ? Array.isArray(existing.realisasi)
          ? existing.realisasi.join("\n")
          : existing.realisasi || ""
        : isLeave
          ? `[${leaveType.toUpperCase()}]`
          : "",
    })
  }

  return rows
}

// ─── Component Inner (Buat/Edit Form Minimalis) ────────────────────────────────

function BuatLkhForm() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get("id")
  const { toast } = useToast()

  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [isFetchingDetail, setIsFetchingDetail] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // ── Options Data ────────────────────────────────────────────────────────────
  const [atasanOptions, setAtasanOptions] = useState<PegawaiOption[]>([])
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequestItem[]>([])

  // ── Form State ──────────────────────────────────────────────────────────────
  const [formBulan, setFormBulan] = useState<number>(new Date().getMonth() + 1)
  const [formTahun, setFormTahun] = useState<number>(new Date().getFullYear())
  const [formDasar, setFormDasar] = useState<string>(DASAR_DEFAULT)
  const [formKegiatan, setFormKegiatan] = useState<KegiatanRowMinimal[]>([])
  const [selectedAtasanId, setSelectedAtasanId] = useState<string>("")

  // Fetch Atasan & Data Cuti
  const loadMasterData = useCallback(async () => {
    try {
      // 1. Fetch pegawai dari Database table `pegawai`
      const resUsers = await fetch("/api/users", { credentials: "include" })
      if (resUsers.ok) {
        const usersData = await resUsers.json()
        if (Array.isArray(usersData)) {
          // Filter pegawai selain user yang sedang login DAN wajib isapprover === true
          const options = usersData
            .filter((u: any) => String(u.id) !== String(user?.id) && Boolean(u.isapprover) === true)
            .map((u: any) => ({
              id: u.id,
              name: u.name,
              nip: u.nip,
              position: u.position || "Atasan / Pejabat",
              isapprover: Boolean(u.isapprover),
              workunit: u.workunit,
            }))
          setAtasanOptions(options)
        }
      }

      // 2. Fetch Cuti Pegawai dari table `leave_requests`
      const resLeave = await fetch("/api/leave-requests", { credentials: "include" })
      if (resLeave.ok) {
        const leaveData = await resLeave.json()
        const requests = Array.isArray(leaveData.data) ? leaveData.data : Array.isArray(leaveData) ? leaveData : []
        // Filter cuti milik user saat ini
        const myLeaves = requests.filter((r: any) => String(r.user_id) === String(user?.id))
        setLeaveRequests(myLeaves)
        return myLeaves
      }
    } catch (err) {
      console.error("Error loading master data:", err)
    }
    return []
  }, [user?.id])

  // Load Laporan Detail & Generate Days
  const loadFormContent = useCallback(async () => {
    setIsFetchingDetail(true)
    const leaves = await loadMasterData()

    if (editId) {
      try {
        const res = await fetch(`/api/lkh/${editId}`, { credentials: "include" })
        const json = await res.json()
        if (res.ok && json.data) {
          const lap = json.data
          setFormBulan(lap.bulan)
          setFormTahun(lap.tahun)
          setFormDasar(lap.dasar || DASAR_DEFAULT)

          if (lap.approver_id) {
            setSelectedAtasanId(String(lap.approver_id))
          } else if (lap.atasan_penandatangan?.nip) {
            const found = atasanOptions.find((a) => a.nip === lap.atasan_penandatangan.nip)
            if (found) setSelectedAtasanId(String(found.id))
          }

          const generated = generateDaysForMonth(lap.bulan, lap.tahun, leaves, lap.kegiatan)
          setFormKegiatan(generated)
        }
      } catch {
        toast({ title: "Error", description: "Gagal memuat laporan edit", variant: "destructive" })
      } finally {
        setIsFetchingDetail(false)
      }
    } else {
      // Form Baru: otomatis generate baris sesuai jumlah hari bulan terpilih
      const generated = generateDaysForMonth(formBulan, formTahun, leaves)
      setFormKegiatan(generated)
      setIsFetchingDetail(false)
    }
  }, [editId, formBulan, formTahun, loadMasterData, atasanOptions, toast])

  useEffect(() => {
    if (user) {
      loadFormContent()
    }
  }, [user, editId])

  // Update baris ketika Bulan/Tahun berubah pada Form Baru
  const handlePeriodeChange = (newBulan: number, newTahun: number) => {
    setFormBulan(newBulan)
    setFormTahun(newTahun)
    if (!editId) {
      const generated = generateDaysForMonth(newBulan, newTahun, leaveRequests)
      setFormKegiatan(generated)
    }
  }

  // Update cell textarea
  const updateKegiatanCell = (idx: number, field: "rencana_hasil_kerja" | "realisasi", val: string) => {
    setFormKegiatan((prev) => {
      const copy = [...prev]
      copy[idx] = { ...copy[idx], [field]: val }
      return copy
    })
  }

  // Submit Handler
  const submitLaporanKinerja = async (status: "draft" | "final") => {
    if (status === "final" && !selectedAtasanId) {
      toast({
        title: "Atasan Wajib Dipilih",
        description: "Pilihlah Atasan Penandatangan sebelum melakukan pengiriman final.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    const selectedAtasanObj = atasanOptions.find((a) => String(a.id) === selectedAtasanId)
    const atasanPenandatangan = selectedAtasanObj
      ? { nama: selectedAtasanObj.name, nip: selectedAtasanObj.nip, jabatan: selectedAtasanObj.position }
      : { nama: "", nip: "", jabatan: "" }

    // Filter kegiatan yang diisi (atau tanggal cuti)
    const kegiatanPayload = formKegiatan
      .filter((k) => k.rencana_hasil_kerja.trim() || k.realisasi.trim() || k.isLeave)
      .map((k, idx) => ({
        tanggal: k.tanggal,
        rencana_hasil_kerja: k.rencana_hasil_kerja,
        realisasi: k.realisasi,
        urutan: idx + 1,
      }))

    const payloadSpec = {
      action: status === "final" ? "submit_laporan_kinerja" : "save_draft",
      pegawai: {
        nama: user?.name || "",
        nip: user?.nip || "",
        jabatan: user?.position || "",
        unit_organisasi: user?.workunit || "",
      },
      periode: {
        bulan: NAMA_BULAN[formBulan - 1],
        tahun: formTahun,
        label: `${NAMA_BULAN[formBulan - 1]} ${formTahun}`,
      },
      dasar: formDasar,
      kegiatan: kegiatanPayload,
      ...(status === "final" ? { atasan_penandatangan: atasanPenandatangan } : {}),
      status,
      timestamp: new Date().toISOString(),
    }

    console.log("[LKH API SPEC] Endpoint:", "POST https://script.google.com/macros/s/{SCRIPT_ID}/exec")
    console.log("[LKH API SPEC] Payload:", payloadSpec)

    try {
      const internalPayload = {
        bulan: formBulan,
        tahun: formTahun,
        dasar: formDasar,
        approver_id: selectedAtasanId ? Number(selectedAtasanId) : null,
        status: status === "final" ? "submitted" : "draft",
        atasan_penandatangan: atasanPenandatangan,
        kegiatan: kegiatanPayload.map((k) => ({
          tanggal: k.tanggal,
          uraian_tugas: k.rencana_hasil_kerja.split("\n"),
          realisasi: k.realisasi.split("\n"),
          urutan: k.urutan,
        })),
      }

      let res: Response
      if (editId) {
        res = await fetch(`/api/lkh/${editId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(internalPayload),
          credentials: "include",
        })
      } else {
        res = await fetch("/api/lkh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(internalPayload),
          credentials: "include",
        })
      }

      await new Promise((resolve) => setTimeout(resolve, 600))

      if (res.ok) {
        toast({
          title: status === "final" ? "Laporan Berhasil Dikirim" : "Draft Laporan Tersimpan",
          description: `Laporan ${NAMA_BULAN[formBulan - 1]} ${formTahun} berhasil diproses.`,
        })
        router.push("/lkh")
      } else {
        const errJson = await res.json()
        toast({ title: "Gagal menyimpan laporan", description: errJson.error, variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "Gagal terhubung ke server", variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
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
          title={editId ? "Edit LKH" : "Buat Laporan Kinerja Harian"}
          onMenuClick={() => setIsMobileOpen(true)}
        />

        <main className="flex-1 p-3 md:p-5 space-y-4 max-w-6xl mx-auto w-full">

          {/* Top Bar */}
          <div className="flex items-center justify-between">
            <Link href="/lkh">
              <Button variant="ghost" size="sm" className="text-gray-600 hover:text-emerald-700 h-8 text-xs -ml-2">
                <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                Kembali ke Daftar LKH
              </Button>
            </Link>
            <span className="text-xs text-gray-400 font-medium">
              {editId ? `Editing #${editId}` : `${NAMA_BULAN[formBulan - 1]} ${formTahun}`}
            </span>
          </div>

          {isFetchingDetail ? (
            <Card className="p-12 flex flex-col items-center justify-center text-gray-400">
              <Loader2 className="h-8 w-8 animate-spin mb-3 text-emerald-600" />
              <p className="text-sm font-medium">Menyiapkan form tanggal & data cuti...</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Header Periode Minimalis */}
              <Card className="border border-gray-200 shadow-sm p-4 bg-white">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <Label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Bulan</Label>
                    <Select
                      value={String(formBulan)}
                      onValueChange={(v) => handlePeriodeChange(Number(v), formTahun)}
                    >
                      <SelectTrigger className="h-8 text-xs bg-gray-50/50 mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {NAMA_BULAN.map((nama, i) => (
                          <SelectItem key={i + 1} value={String(i + 1)}>{nama}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Tahun</Label>
                    <Select
                      value={String(formTahun)}
                      onValueChange={(v) => handlePeriodeChange(formBulan, Number(v))}
                    >
                      <SelectTrigger className="h-8 text-xs bg-gray-50/50 mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TAHUN_OPTIONS.map((t) => (
                          <SelectItem key={t} value={String(t)}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-2">
                    <Label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Dasar SE</Label>
                    <Input
                      value={formDasar}
                      onChange={(e) => setFormDasar(e.target.value)}
                      className="h-8 text-xs bg-gray-50/50 mt-1 truncate"
                      title={formDasar}
                    />
                  </div>
                </div>
              </Card>

              {/* Tabel Minimalis Ramping Style spreadsheet */}
              <Card className="border border-gray-200 shadow-sm overflow-hidden bg-white">
                <CardHeader className="py-2.5 px-4 bg-teal-600 text-white flex flex-row items-center justify-between">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                    <ClipboardList className="h-4 w-4" />
                    Pengisian Kinerja Harian ({formKegiatan.length} Hari)
                  </CardTitle>
                  <span className="text-[11px] text-teal-100 font-normal">
                    *Tarik sudut kanan bawah textarea untuk memperbesar baris
                  </span>
                </CardHeader>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead>
                      <tr className="bg-teal-700 text-white text-xs font-semibold uppercase tracking-wider border-b border-teal-800">
                        <th className="py-2 px-3 w-28 text-center border-r border-teal-600/50">Tanggal</th>
                        <th className="py-2 px-3 border-r border-teal-600/50">Rencana Hasil Kerja</th>
                        <th className="py-2 px-3">Realisasi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 text-xs">
                      {formKegiatan.map((row, idx) => (
                        <tr
                          key={row.tanggal}
                          className={
                            row.isLeave
                              ? "bg-amber-50/80 hover:bg-amber-100/80 transition-colors"
                              : row.isWeekend
                                ? "bg-gray-100/70 text-gray-400"
                                : "hover:bg-teal-50/30 transition-colors"
                          }
                        >
                          {/* Kolom Tanggal */}
                          <td className="py-2 px-3 text-center align-top border-r border-gray-200 select-none">
                            <div className="font-semibold text-gray-700">
                              {row.dayName}, {row.dayNumber}
                            </div>
                            <div className="text-[10px] text-gray-400">
                              {NAMA_BULAN[formBulan - 1].slice(0, 3)}
                            </div>

                            {/* Badge Cuti / Weekend */}
                            {row.isLeave && (
                              <span className="mt-1 inline-block px-1.5 py-0.5 rounded bg-amber-200 text-amber-800 text-[9px] font-bold">
                                {row.leaveType}
                              </span>
                            )}
                            {row.isWeekend && !row.isLeave && (
                              <span className="mt-1 inline-block text-[9px] text-gray-400 italic">
                                Libur
                              </span>
                            )}
                          </td>

                          {/* Kolom Rencana Hasil Kerja */}
                          <td className="p-1 border-r border-gray-200 align-top">
                            <Textarea
                              value={row.rencana_hasil_kerja}
                              onChange={(e) => updateKegiatanCell(idx, "rencana_hasil_kerja", e.target.value)}
                              placeholder={row.isLeave ? `Sedang ${row.leaveType}` : row.isWeekend ? "Hari Libur..." : "Ketik rencana hasil kerja..."}
                              disabled={row.isLeave}
                              className={`w-full min-h-[42px] text-xs leading-relaxed p-2 resize-y border-none focus:ring-1 focus:ring-teal-500 rounded-none bg-transparent ${row.isLeave ? "text-amber-800 font-medium italic opacity-90" : ""
                                }`}
                            />
                          </td>

                          {/* Kolom Realisasi */}
                          <td className="p-1 align-top">
                            <Textarea
                              value={row.realisasi}
                              onChange={(e) => updateKegiatanCell(idx, "realisasi", e.target.value)}
                              placeholder={row.isLeave ? `Sedang ${row.leaveType}` : row.isWeekend ? "Hari Libur..." : "Ketik realisasi kegiatan..."}
                              disabled={row.isLeave}
                              className={`w-full min-h-[42px] text-xs leading-relaxed p-2 resize-y border-none focus:ring-1 focus:ring-teal-500 rounded-none bg-transparent ${row.isLeave ? "text-amber-800 font-medium italic opacity-90" : ""
                                }`}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Pemilihan Atasan Penandatangan dari Table `pegawai` */}
              <Card className="border border-amber-200 bg-amber-50/40 p-3.5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-amber-700 shrink-0" />
                    <div>
                      <Label className="text-xs font-bold text-amber-900">Atasan Penandatangan</Label>
                      <p className="text-[11px] text-amber-700">Wajib dipilih sebelum Kirim & Finalisasi</p>
                    </div>
                  </div>

                  <div className="w-full sm:w-72">
                    <Select
                      value={selectedAtasanId}
                      onValueChange={setSelectedAtasanId}
                    >
                      <SelectTrigger className="h-8 text-xs bg-white border-amber-300">
                        <SelectValue placeholder="-- Pilih Atasan --" />
                      </SelectTrigger>
                      <SelectContent>
                        {atasanOptions.map((a) => (
                          <SelectItem key={a.id} value={String(a.id)}>
                            <div className="text-left py-0.5">
                              <span className="font-semibold text-xs text-gray-800">{a.name}</span>
                              <span className="block text-[10px] text-gray-500">{a.position} &bull; NIP. {a.nip}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </Card>

              {/* Tombol Aksi */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => submitLaporanKinerja("draft")}
                  disabled={isSubmitting}
                  className="h-9 px-4 text-xs border-gray-300 text-gray-700 hover:bg-gray-100"
                >
                  {isSubmitting ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                  Simpan Draft
                </Button>
                <Button
                  type="button"
                  onClick={() => submitLaporanKinerja("final")}
                  disabled={isSubmitting}
                  className="h-9 px-4 text-xs bg-teal-600 hover:bg-teal-700 text-white shadow-sm"
                >
                  {isSubmitting ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
                  Kirim & Finalisasi
                </Button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default function BuatLkhPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    }>
      <BuatLkhForm />
    </Suspense>
  )
}

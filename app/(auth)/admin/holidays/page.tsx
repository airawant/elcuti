"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { format } from "date-fns"
import { Calendar, Edit, Trash, ChevronLeft, ChevronRight, Search } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"

type Holiday = {
  id: number
  name: string
  date: string
  description?: string
}

type PaginationData = {
  total: number
  page: number
  limit: number
  totalPages: number
}

export default function HolidaysPage() {
  const { toast } = useToast()
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [selectedHoliday, setSelectedHoliday] = useState<Holiday | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    date: "",
    description: "",
  })
  const [pagination, setPagination] = useState<PaginationData>({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0
  })
  const [search, setSearch] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  // Fetch holidays with pagination
  const fetchHolidays = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(
        `/api/holidays?page=${pagination.page}&limit=${pagination.limit}&search=${search}`
      )
      const data = await response.json()

      if (response.ok) {
        // Memastikan data.data adalah array dan mengurutkannya berdasarkan tanggal
        const holidaysArray = Array.isArray(data.data)
          ? data.data.sort((a: Holiday, b: Holiday) =>
              new Date(a.date).getTime() - new Date(b.date).getTime()
            )
          : []
        setHolidays(holidaysArray)
        setPagination(data.pagination)
      } else {
        setHolidays([]) // Set empty array when error
        toast({
          title: "Error",
          description: data.error || "Gagal mengambil data hari libur",
          variant: "destructive",
        })
      }
    } catch (error) {
      setHolidays([]) // Set empty array when error
      console.error("Error fetching holidays:", error)
      toast({
        title: "Error",
        description: "Terjadi kesalahan saat mengambil data",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchHolidays()
  }, [pagination.page, search]) // Refresh when page or search changes

  const handleAdd = async () => {
    try {
      if (!formData.name || !formData.date) {
        toast({
          title: "Error",
          description: "Nama dan tanggal harus diisi",
          variant: "destructive",
        })
        return
      }

      const response = await fetch("/api/holidays", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        toast({
          title: "Berhasil",
          description: "Hari libur berhasil ditambahkan",
        })
        setIsAddDialogOpen(false)
        setFormData({ name: "", date: "", description: "" })
        fetchHolidays() // Refresh data
      } else {
        const data = await response.json()
        throw new Error(data.error || "Gagal menambah hari libur")
      }
    } catch (error) {
      console.error("Error adding holiday:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      })
    }
  }

  const handleEdit = async () => {
    try {
      if (!selectedHoliday || !formData.name || !formData.date) {
        toast({
          title: "Error",
          description: "Nama dan tanggal harus diisi",
          variant: "destructive",
        })
        return
      }

      const response = await fetch("/api/holidays", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: selectedHoliday.id,
          ...formData,
        }),
      })

      if (response.ok) {
        toast({
          title: "Berhasil",
          description: "Hari libur berhasil diperbarui",
        })
        setIsEditDialogOpen(false)
        setSelectedHoliday(null)
        setFormData({ name: "", date: "", description: "" })
        fetchHolidays() // Refresh data
      } else {
        const data = await response.json()
        throw new Error(data.error || "Gagal memperbarui hari libur")
      }
    } catch (error) {
      console.error("Error updating holiday:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      })
    }
  }

  const handleDelete = async (id: number) => {
    if (window.confirm("Apakah Anda yakin ingin menghapus hari libur ini?")) {
      try {
        const response = await fetch(`/api/holidays?id=${id}`, {
          method: "DELETE",
        })

        if (response.ok) {
          toast({
            title: "Berhasil",
            description: "Hari libur berhasil dihapus",
          })
          fetchHolidays() // Refresh data
        } else {
          const data = await response.json()
          throw new Error(data.error || "Gagal menghapus hari libur")
        }
      } catch (error) {
        console.error("Error deleting holiday:", error)
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Terjadi kesalahan",
          variant: "destructive",
        })
      }
    }
  }

  const openEditDialog = (holiday: Holiday) => {
    setSelectedHoliday(holiday)
    setFormData({
      name: holiday.name,
      date: holiday.date,
      description: holiday.description || "",
    })
    setIsEditDialogOpen(true)
  }

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination({ ...pagination, page: newPage })
    }
  }

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
    setPagination({ ...pagination, page: 1 }) // Reset to first page when searching
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Kelola Hari Libur</h1>
        <Button onClick={() => setIsAddDialogOpen(true)}>Tambah Hari Libur</Button>
      </div>

      {/* Search Bar */}
      <div className="mb-4">
        <div className="flex gap-2">
          <Input
            placeholder="Cari hari libur..."
            value={search}
            onChange={handleSearch}
            className="max-w-sm"
          />
          <Search className="w-5 h-5 text-gray-500" />
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-4">
          <p>Memuat data...</p>
        </div>
      )}

      {/* Holidays Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {holidays.map((holiday) => (
          <div
            key={holiday.id}
            className="border rounded-lg p-4 space-y-2 hover:shadow-md transition-shadow"
          >
            <div className="flex justify-between items-start">
              <h3 className="font-medium">{holiday.name}</h3>
              <div className="flex space-x-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openEditDialog(holiday)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(holiday.id)}
                >
                  <Trash className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex items-center text-sm text-muted-foreground">
              <Calendar className="h-4 w-4 mr-2" />
              {format(new Date(holiday.date), "dd MMMM yyyy")}
            </div>
            {holiday.description && (
              <p className="text-sm text-muted-foreground">{holiday.description}</p>
            )}
          </div>
        ))}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-6">
          <Button
            variant="outline"
            size="icon"
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={pagination.page === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span>
            Halaman {pagination.page} dari {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={pagination.page === pagination.totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Add Holiday Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Hari Libur</DialogTitle>
            <DialogDescription>
              Masukkan informasi hari libur yang akan ditambahkan.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Nama Hari Libur</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Masukkan nama hari libur"
              />
            </div>
            <div>
              <Label htmlFor="date">Tanggal</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="description">Deskripsi (Opsional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Masukkan deskripsi hari libur"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleAdd}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Holiday Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Hari Libur</DialogTitle>
            <DialogDescription>
              Ubah informasi hari libur yang dipilih.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Nama Hari Libur</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Masukkan nama hari libur"
              />
            </div>
            <div>
              <Label htmlFor="edit-date">Tanggal</Label>
              <Input
                id="edit-date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-description">Deskripsi (Opsional)</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Masukkan deskripsi hari libur"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleEdit}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

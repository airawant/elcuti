"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/hooks/use-toast"
import { Trash, Plus, ChevronLeft, ChevronRight } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

type PaginationData = {
  page: number
  limit: number
  total: number
  totalPages: number
}

export function HolidayManagement() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [newHoliday, setNewHoliday] = useState({
    name: "",
    date: "",
    description: "",
  })
  const { holidays, addHoliday, deleteHoliday } = useAuth()
  const { toast } = useToast()
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  })
  const [localHolidays, setLocalHolidays] = useState<typeof holidays>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (Array.isArray(holidays)) {
      // Sort all holidays by date
      const sortedHolidays = [...holidays].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      )

      const total = sortedHolidays.length
      const totalPages = Math.ceil(total / pagination.limit)

      // Update pagination info
      setPagination(prev => ({
        ...prev,
        total,
        totalPages
      }))

      // Slice holidays for current page
      const start = (pagination.page - 1) * pagination.limit
      const end = start + pagination.limit
      setLocalHolidays(sortedHolidays.slice(start, end))
    }
  }, [holidays, pagination.page, pagination.limit])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setNewHoliday((prev) => ({ ...prev, [name]: value }))
  }

  const handleAddHoliday = () => {
    if (!newHoliday.name || !newHoliday.date) {
      toast({
        title: "Required fields missing",
        description: "Please provide a name and date for the holiday",
        variant: "destructive",
      })
      return
    }

    addHoliday(newHoliday)
    setIsAddDialogOpen(false)
    setNewHoliday({ name: "", date: "", description: "" })
    toast({
      title: "Holiday added",
      description: "The holiday has been added successfully",
    })
  }

  const handleDeleteHoliday = (id: number) => {
    deleteHoliday(id)
    toast({
      title: "Holiday deleted",
      description: "The holiday has been deleted successfully",
    })
  }

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination(prev => ({ ...prev, page: newPage }))
    }
  }

  // Add pagination info display
  const getPaginationInfo = () => {
    const start = (pagination.page - 1) * pagination.limit + 1
    const end = Math.min(pagination.page * pagination.limit, pagination.total)
    return `Menampilkan ${start}-${end} dari ${pagination.total} data`
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Hari Libur Nasional</CardTitle>
          {pagination.total > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              {getPaginationInfo()}
            </p>
          )}
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Tambah Hari Libur
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tambah Hari Libur Baru</DialogTitle>
              <DialogDescription>Tambahkan hari libur baru ke dalam sistem.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nama Hari Libur</Label>
                <Input
                  id="name"
                  name="name"
                  value={newHoliday.name}
                  onChange={handleInputChange}
                  placeholder="Contoh: Hari Kemerdekaan"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="date">Tanggal</Label>
                <Input
                  id="date"
                  name="date"
                  type="date"
                  value={newHoliday.date}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Deskripsi (Opsional)</Label>
                <Textarea
                  id="description"
                  name="description"
                  value={newHoliday.description}
                  onChange={handleInputChange}
                  placeholder="Deskripsi tambahan tentang hari libur"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleAddHoliday}>Tambah Hari Libur</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead>Deskripsi</TableHead>
              <TableHead className="w-[100px]">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-4">
                  Memuat data...
                </TableCell>
              </TableRow>
            ) : !Array.isArray(localHolidays) || localHolidays.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                  Tidak ada hari libur yang ditambahkan.
                </TableCell>
              </TableRow>
            ) : (
              localHolidays.map((holiday) => (
                <TableRow key={holiday.id}>
                  <TableCell>{holiday.name}</TableCell>
                  <TableCell>{format(new Date(holiday.date), "dd MMMM yyyy")}</TableCell>
                  <TableCell>{holiday.description || "-"}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteHoliday(holiday.id)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-100"
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination controls */}
        {pagination.totalPages > 1 && (
          <div className="flex flex-col items-center gap-4 mt-6">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm">
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
            <p className="text-sm text-muted-foreground">
              {getPaginationInfo()}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

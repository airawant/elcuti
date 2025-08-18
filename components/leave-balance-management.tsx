"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/hooks/use-toast"

export function LeaveBalanceManagement() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString())
  const [initialBalance, setInitialBalance] = useState("12")
  const [editingUserId, setEditingUserId] = useState<number | null>(null)
  const [editBalance, setEditBalance] = useState("")

  const { users, setLeaveBalance, setInitialLeaveBalance } = useAuth()
  const { toast } = useToast()

  // Get only users (not admins)
  const employees = users.filter((user) => user.role === "user")

  const handleSetInitialBalance = () => {
    const balance = Number.parseInt(initialBalance, 10)
    if (isNaN(balance) || balance < 0) {
      toast({
        title: "Invalid balance",
        description: "Please provide a valid non-negative number",
        variant: "destructive",
      })
      return
    }

    setInitialLeaveBalance(selectedYear, balance)
    toast({
      title: "Balance updated",
      description: `Initial leave balance for ${selectedYear} has been set to ${balance} days`,
    })
  }

  const handleEditBalance = (userId: number) => {
    setEditingUserId(userId)
    const user = users.find((u) => u.id === userId)
    setEditBalance(user?.leave_balance?.[selectedYear]?.toString() || "0")
  }

  const handleSaveBalance = () => {
    if (editingUserId === null) return

    const balance = Number.parseInt(editBalance, 10)
    if (isNaN(balance) || balance < 0) {
      toast({
        title: "Invalid balance",
        description: "Please provide a valid non-negative number",
        variant: "destructive",
      })
      return
    }

    setLeaveBalance(editingUserId, selectedYear, balance)
    setEditingUserId(null)

    toast({
      title: "Balance updated",
      description: "The leave balance has been updated successfully",
    })
  }

  const handleCancelEdit = () => {
    setEditingUserId(null)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manajemen Saldo Cuti</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid md:grid-cols-3 gap-4 p-4 border rounded-md">
          <div>
            <Label htmlFor="year-select">Tahun</Label>
            <Input
              id="year-select"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              placeholder="Tahun"
            />
          </div>
          <div>
            <Label htmlFor="initial-balance">Saldo Awal</Label>
            <Input
              id="initial-balance"
              value={initialBalance}
              onChange={(e) => setInitialBalance(e.target.value)}
              type="number"
              min="0"
              placeholder="Saldo Cuti Awal"
            />
          </div>
          <div className="flex items-end">
            <Button onClick={handleSetInitialBalance} className="w-full">
              Tetapkan Untuk Semua Pegawai
            </Button>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama Pegawai</TableHead>
              <TableHead>NIP</TableHead>
              <TableHead>Saldo Cuti {selectedYear}</TableHead>
              <TableHead className="w-[100px]">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.map((employee) => (
              <TableRow key={employee.id}>
                <TableCell>{employee.name}</TableCell>
                <TableCell>{employee.nip}</TableCell>
                <TableCell>
                  {editingUserId === employee.id ? (
                    <Input
                      value={editBalance}
                      onChange={(e) => setEditBalance(e.target.value)}
                      type="number"
                      min="0"
                      className="w-20"
                    />
                  ) : (
                    `${employee.leave_balance?.[selectedYear] || 0} hari`
                  )}
                </TableCell>
                <TableCell>
                  {editingUserId === employee.id ? (
                    <div className="flex space-x-2">
                      <Button size="sm" onClick={handleSaveBalance}>
                        Simpan
                      </Button>
                      <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                        Batal
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => handleEditBalance(employee.id)}>
                      Edit
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

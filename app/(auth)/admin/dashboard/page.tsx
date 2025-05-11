"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/lib/auth-context"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { format, differenceInDays } from "date-fns"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { HolidayManagement } from "@/components/holiday-management"
import { LeaveBalanceManagement } from "@/components/leave-balance-management"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"

export default function AdminDashboardPage() {
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const { user, leaveRequests, users, resetAnnualLeave } = useAuth()
  const router = useRouter()
  const { toast } = useToast()

  // Redirect if not logged in or not admin
  useEffect(() => {
    if (!user) {
      router.push("/login")
    } else if (user.role !== "admin") {
      router.push("/dashboard")
    }
  }, [user, router])

  if (!user || user.role !== "admin") {
    return null
  }

  // Count pending requests
  const pendingRequests = leaveRequests.filter((req) => req.status === "Pending").length

  // Count approved requests
  const approvedRequests = leaveRequests.filter((req) => req.status === "Approved").length

  // Count total users
  const totalUsers = users.filter((u) => u.role === "user").length

  // Get recent leave requests
  const recentRequests = [...leaveRequests]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5)

  // Prepare data for leave type chart
  const leaveTypeData = leaveRequests.reduce(
    (acc, request) => {
      const type = request.type
      if (!acc[type]) {
        acc[type] = 0
      }
      acc[type]++
      return acc
    },
    {} as Record<string, number>,
  )

  const leaveTypeChartData = Object.entries(leaveTypeData).map(([name, value]) => ({
    name,
    value,
  }))

  // Prepare data for status chart
  const statusData = [
    { name: "Menunggu Persetujuan", value: pendingRequests },
    { name: "Disetujui", value: approvedRequests },
    { name: "Ditolak", value: leaveRequests.length - pendingRequests - approvedRequests },
  ]

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8", "#82ca9d"]

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Approved":
        return <Badge className="bg-green-500">Disetujui</Badge>
      case "Rejected":
        return <Badge variant="destructive">Ditolak</Badge>
      default:
        return <Badge variant="outline">Menunggu</Badge>
    }
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar isAdmin />
      </div>

      {/* Mobile sidebar */}
      <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
        <SheetContent side="left" className="p-0">
          <Sidebar isAdmin />
        </SheetContent>
      </Sheet>

      <div className="flex-1">
        <Header title="Admin Dashboard" onMenuClick={() => setIsMobileOpen(true)} />

        <main className="p-4 md:p-6 space-y-6">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <Button
              onClick={() => {
                resetAnnualLeave()
                toast({
                  title: "Annual Leave Reset",
                  description:
                    "Annual leave has been reset for all users. Unused leave from previous year has been carried over (max 6 days).",
                })
              }}
              variant="outline"
            >
              Reset Cuti Tahunan
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Menunggu Persetujuan</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{pendingRequests}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Persetujuan Cuti</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{approvedRequests}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Pengguna</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalUsers}</div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="holidays">Hari Libur</TabsTrigger>
              <TabsTrigger value="leave-balance">Saldo Cuti</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Tipe Cuti</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={leaveTypeChartData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {leaveTypeChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Status Permohonan</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={statusData}
                          margin={{
                            top: 20,
                            right: 30,
                            left: 20,
                            bottom: 5,
                          }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="value" fill="#8884d8" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Permohonan Cuti Terakhir</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nama Pegawai</TableHead>
                        <TableHead>Tipe Cuti</TableHead>
                        <TableHead>Lamanya</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Tanggal Pengajuan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentRequests.map((request) => {
                        const employee = users.find((u) => u.id === request.user_id)
                        const duration = differenceInDays(new Date(request.end_date), new Date(request.start_date)) + 1

                        return (
                          <TableRow key={request.id}>
                            <TableCell>{employee?.name || "Unknown"}</TableCell>
                            <TableCell>{request.type}</TableCell>
                            <TableCell>{duration} Hari</TableCell>
                            <TableCell>{getStatusBadge(request.status)}</TableCell>
                            <TableCell>{format(new Date(request.created_at), "dd MMM yyyy")}</TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="holidays">
              <HolidayManagement />
            </TabsContent>

            <TabsContent value="leave-balance">
              <LeaveBalanceManagement />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  )
}

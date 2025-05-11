"use client"

import type React from "react"

import { createContext, useContext, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import type { Pegawai } from "@/lib/supabase"
import type { LeaveRequest, Holiday } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"

// Define types for leave requests and holidays
type ApprovalStatus = "Pending" | "Approved" | "Rejected"

type AuthContextType = {
  user: Pegawai | null
  login: (nip: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
  leaveRequests: LeaveRequest[]
  addLeaveRequest: (
    request: Omit<LeaveRequest, "id" | "created_at" | "supervisor_status" | "authorized_officer_status">,
  ) => Promise<void>
  updateLeaveRequestStatus: (
    id: number,
    approverType: "supervisor" | "authorized_officer",
    status: ApprovalStatus,
    rejectionReason?: string,
    signatureDate?: string,
    signed?: boolean,
  ) => Promise<void>
  markRequestAsViewed: (id: number, approverType: "supervisor" | "authorized_officer") => void
  users: Pegawai[]
  addUser: (user: Omit<Pegawai, "id">) => Promise<void>
  updateUser: (id: number, userData: Partial<Pegawai>) => Promise<void>
  deleteUser: (id: number) => Promise<void>
  holidays: Holiday[]
  addHoliday: (holiday: Omit<Holiday, "id">) => Promise<void>
  deleteHoliday: (id: number) => Promise<void>
  updateHoliday: (id: number, holidayData: Partial<Holiday>) => Promise<void>
  setLeaveBalance: (userId: number, year: string, balance: number) => void
  setInitialLeaveBalance: (year: string, balance: number) => void
  getSupervisorRequests: () => LeaveRequest[]
  getAuthorizedOfficerRequests: () => LeaveRequest[]
  getPendingRequestsCount: (approverType: "supervisor" | "authorized_officer") => number
  getUnviewedRequestsCount: () => number
  calculateUsedLeaveInYear: (userId: number, year: number) => number
  calculateRemainingLeaveBalance: (userId: number, year: string) => number
  calculateLeaveDeduction: (
    userId: number,
    workingDays: number,
  ) => {
    deductFromCarryOver: number
    deductFromCurrentYear: number
    remainingCarryOver: number
    remainingCurrentYear: number
    totalRemaining: number
    sufficientBalance: boolean
  }
  resetAnnualLeave: () => void
  cleanupOldLeaveData: () => void
  refreshLeaveRequests: () => Promise<void>
  updatePassword: (userId: number, currentPassword: string, newPassword: string) => Promise<boolean>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Helper functions for date calculations
function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6 // 0 is Sunday, 6 is Saturday
}

function isWithinInterval(date: Date, interval: { start: Date; end: Date }): boolean {
  return date >= interval.start && date <= interval.end
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Pegawai | null>(null)
  const [users, setUsers] = useState<Pegawai[]>([])
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const { toast } = useToast()

  // Fetch current user on mount
  useEffect(() => {
    async function fetchCurrentUser() {
      try {
        const response = await fetch("/api/auth/me")
        const responseText = await response.text()
        console.log("Raw response from /api/auth/me:", responseText)

        let userData
        try {
          userData = JSON.parse(responseText)
        } catch (e) {
          console.error("Failed to parse response as JSON:", e)
          return
        }

        if (response.ok) {
          setUser(userData)
        } else if (response.status === 401) {
          // Not authenticated, clear user state
          setUser(null)
          // If not on login page, redirect to login
          if (!window.location.pathname.startsWith('/login')) {
            router.push('/login')
          }
        } else {
          console.error("Error response from /api/auth/me:", {
            status: response.status,
            data: userData
          })
          setUser(null)
        }
      } catch (error) {
        console.error("Network error in fetchCurrentUser:", error)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    fetchCurrentUser()
  }, [router])

  // Fetch leave requests when authenticated
  useEffect(() => {
    let isMounted = true;

    async function fetchLeaveRequests() {
      if (!user) return;

      try {
        console.log("Fetching leave requests...");
        const response = await fetch("/api/leave-requests");

        if (!response.ok) {
          throw new Error("Failed to fetch leave requests");
        }

        const data = await response.json();
        console.log("Leave requests fetched:", data);

        if (isMounted && Array.isArray(data)) {
          setLeaveRequests(data);
        } else if (isMounted) {
          console.error("Leave requests data is not an array:", data);
          setLeaveRequests([]);
        }
      } catch (error) {
        console.error("Error fetching leave requests:", error);
        if (isMounted) {
          setLeaveRequests([]);
        }
      }
    }

    fetchLeaveRequests();

    return () => {
      isMounted = false;
    };
  }, [user]);

  // Fetch users when authenticated
  useEffect(() => {
    async function fetchUsers() {
      if (!user) return

      try {
        const response = await fetch("/api/users")
        if (response.ok) {
          const usersData = await response.json()
          console.log("Users data:", usersData)
          setUsers(usersData)
        }
      } catch (error) {
        console.error("Error fetching users:", error)
      }
    }

    fetchUsers()
  }, [user])

  // Fetch holidays
  useEffect(() => {
    async function fetchHolidays() {
      try {
        const response = await fetch("/api/holidays")
        if (!response.ok) {
          throw new Error("Failed to fetch holidays")
        }
        const result = await response.json()
        setHolidays(Array.isArray(result.data) ? result.data : [])
      } catch (error) {
        console.error("Error fetching holidays:", error)
        setHolidays([])
        toast({
          title: "Error",
          description: "Gagal mengambil data hari libur",
          variant: "destructive",
        })
      }
    }

    fetchHolidays()
  }, [toast])

  const login = async (nip: string, password: string) => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ nip, password }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        toast({
          title: "Login failed",
          description: errorData.error || "Invalid credentials",
          variant: "destructive",
        })
        return false
      }

      const data = await response.json()
      setUser(data.user)
      return true
    } catch (error) {
      console.error("Login error:", error)
      toast({
        title: "Login error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
      return false
    }
  }

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      })
      setUser(null)
      router.push("/login")
    } catch (error) {
      console.error("Logout error:", error)
    }
  }

  const addLeaveRequest = async (
    request: Omit<LeaveRequest, "id" | "created_at" | "supervisor_status" | "authorized_officer_status">,
  ) => {
    try {
    // Calculate working days if not provided
      let workingDays = request.workingdays || 0

    if (!workingDays && request.start_date && request.end_date) {
      const start = new Date(request.start_date)
      const end = new Date(request.end_date)
      const totalDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1

      // Count weekends
      let weekendCount = 0
      for (let i = 0; i < totalDays; i++) {
        const currentDate = new Date(start)
        currentDate.setDate(start.getDate() + i)
        if (isWeekend(currentDate)) {
          weekendCount++
        }
      }

      // Count holidays
      const holidaysCount = holidays.filter((holiday) => {
        const holidayDate = new Date(holiday.date)
        return isWithinInterval(holidayDate, { start, end }) && !isWeekend(holidayDate)
      }).length

      // Calculate working days
      workingDays = totalDays - weekendCount - holidaysCount
    }

      const response = await fetch("/api/leave-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
      ...request,
          workingdays: workingDays,
      status: "Pending",
          supervisor_status: "Pending",
          authorized_officer_status: "Pending",
      supervisor_viewed: false,
      authorized_officer_viewed: false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Gagal membuat permintaan cuti");
      }

      const newRequest = await response.json();
      setLeaveRequests([...leaveRequests, newRequest.leaveRequest]);

      toast({
        title: "Berhasil",
        description: "Permintaan cuti berhasil dibuat",
      });

    } catch (error) {
      console.error("Error creating leave request:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Terjadi kesalahan saat membuat permintaan cuti",
        variant: "destructive",
      });
      throw error;
    }
  }

  const updateLeaveRequestStatus = async (
    id: number,
    approverType: "supervisor" | "authorized_officer",
    status: ApprovalStatus,
    rejectionReason?: string,
    signatureDate?: string,
    signed?: boolean,
  ) => {
    try {
      console.log("Updating leave request status:", {
        leaveRequestId: id,
        action: status,
        type: approverType,
        rejectionReason,
        signatureDate,
        signed,
      });

      const response = await fetch(`/api/leave-requests`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          leaveRequestId: id,
          action: status,
          type: approverType,
          rejectionReason,
          signatureDate,
          signed,
        }),
      });

      // Tampilkan status kode HTTP untuk membantu debugging
      console.log(`Server response status: ${response.status} ${response.statusText}`);

      // Coba ambil respons sebagai teks terlebih dahulu
      const responseText = await response.text();
      console.log("Raw response text:", responseText);

      let errorData = {};
      try {
        // Coba parse sebagai JSON jika ada konten
        if (responseText.trim()) {
          errorData = JSON.parse(responseText);
        }
      } catch (e) {
        console.error("Failed to parse response as JSON:", e);
      }

      if (!response.ok) {
        console.error("Error response from server:", errorData);

        const errorMessage =
          responseText.trim()
            ? (errorData as any).error || (errorData as any).message || "Gagal memperbarui status permintaan cuti"
            : `Error ${response.status}: ${response.statusText || "Gagal memperbarui status permintaan cuti"}`;

        throw new Error(errorMessage);
      }

      let updatedRequest = { leaveRequest: null };

      // Hanya parse jika ada konten dan response OK
      if (responseText.trim()) {
        try {
          updatedRequest = JSON.parse(responseText);
        } catch (e) {
          console.error("Failed to parse success response as JSON:", e);
        }
      }

      console.log("Successfully updated leave request:", updatedRequest);

      if (updatedRequest.leaveRequest) {
        setLeaveRequests(
          leaveRequests.map((request) =>
            request.id === id ? (updatedRequest.leaveRequest || request) : request
          )
        );
      } else {
        // Jika tidak ada data yang dikembalikan, refresh data dari server
        await refreshLeaveRequests();
      }

      toast({
        title: "Berhasil",
        description: "Status permintaan cuti berhasil diperbarui",
      });

    } catch (error) {
      console.error("Error updating leave request status:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Terjadi kesalahan saat memperbarui status",
        variant: "destructive",
      });
      throw error;
    }
  }

  const markRequestAsViewed = (id: number, approverType: "supervisor" | "authorized_officer") => {
    setLeaveRequests(
      leaveRequests.map((request) => {
        if (request.id === id) {
          if (approverType === "supervisor") {
            return { ...request, supervisor_viewed: true }
          } else if (approverType === "authorized_officer") {
            return { ...request, authorized_officer_viewed: true }
          }
        }
        return request
      }),
    )
  }

  const addUser = async (userData: Omit<Pegawai, "id">) => {
    try {
      console.log("Creating user with data:", { ...userData, password: "[REDACTED]" })

      // Validate required fields
      if (!userData.nip || !userData.name || !userData.role) {
        throw new Error("Missing required fields")
      }

      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
      })

      let responseData
      try {
        const text = await response.text()
        console.log("Raw response:", text)
        responseData = JSON.parse(text)
      } catch (e) {
        console.error("Failed to parse response:", e)
        throw new Error("Invalid server response")
      }

      console.log("Server response:", {
        status: response.status,
        data: responseData
      })

      if (!response.ok) {
        const errorMessage = responseData.error || responseData.details || "An error occurred"
        toast({
          title: "Failed to create user",
          description: errorMessage,
          variant: "destructive",
        })
        throw new Error(errorMessage)
      }

      if (!responseData.user) {
        throw new Error("No user data in response")
      }

      setUsers([...users, responseData.user])

      toast({
        title: "User created",
        description: "The user has been created successfully",
      })
    } catch (error) {
      console.error("Error creating user:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      })
      throw error
    }
  }

  const updateUser = async (id: number, userData: Partial<Pegawai>) => {
    try {
      const response = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        toast({
          title: "Failed to update user",
          description: errorData.error || "An error occurred",
          variant: "destructive",
        })
        throw new Error(errorData.error || "Failed to update user")
      }

      const updatedUser = await response.json()

      setUsers(users.map((user) => (user.id === id ? updatedUser : user)))

      // If the current user is being updated, update the state as well
      if (user && user.id === id) {
        setUser({ ...user, ...updatedUser })
      }

      toast({
        title: "User updated",
        description: "The user has been updated successfully",
      })
    } catch (error) {
      console.error("Error updating user:", error)
      throw error
    }
  }

  const deleteUser = async (id: number) => {
    try {
      const response = await fetch(`/api/users/${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const errorData = await response.json()
        toast({
          title: "Failed to delete user",
          description: errorData.error || "An error occurred",
          variant: "destructive",
        })
        throw new Error(errorData.error || "Failed to delete user")
      }

      setUsers(users.filter((user) => user.id !== id))

      // Also delete associated leave requests
      setLeaveRequests(leaveRequests.filter((request) => request.user_id !== id))

      toast({
        title: "User deleted",
        description: "The user has been deleted successfully",
      })
    } catch (error) {
      console.error("Error deleting user:", error)
      throw error
    }
  }

  // Add holiday function
  const addHoliday = async (holiday: Omit<Holiday, "id">) => {
    try {
      const response = await fetch("/api/holidays", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(holiday),
      })

      if (!response.ok) {
        throw new Error("Failed to add holiday")
      }

      const newHoliday = await response.json()
      setHolidays((prev) => [...prev, newHoliday])

      toast({
        title: "Berhasil",
        description: "Hari libur berhasil ditambahkan",
      })
    } catch (error) {
      console.error("Error adding holiday:", error)
      toast({
        title: "Error",
        description: "Gagal menambahkan hari libur",
        variant: "destructive",
      })
    }
  }

  // Delete holiday function
  const deleteHoliday = async (id: number) => {
    try {
      const response = await fetch(`/api/holidays?id=${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete holiday")
      }

      setHolidays((prev) => prev.filter((holiday) => holiday.id !== id))

      toast({
        title: "Berhasil",
        description: "Hari libur berhasil dihapus",
      })
    } catch (error) {
      console.error("Error deleting holiday:", error)
      toast({
        title: "Error",
        description: "Gagal menghapus hari libur",
        variant: "destructive",
      })
    }
  }

  // Update holiday function
  const updateHoliday = async (id: number, holidayData: Partial<Holiday>) => {
    try {
      const response = await fetch("/api/holidays", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, ...holidayData }),
      })

      if (!response.ok) {
        throw new Error("Failed to update holiday")
      }

      const updatedHoliday = await response.json()
      setHolidays((prev) =>
        prev.map((holiday) => (holiday.id === id ? updatedHoliday : holiday))
      )

      toast({
        title: "Berhasil",
        description: "Hari libur berhasil diperbarui",
      })
    } catch (error) {
      console.error("Error updating holiday:", error)
      toast({
        title: "Error",
        description: "Gagal memperbarui hari libur",
        variant: "destructive",
      })
    }
  }

  // The following functions will remain the same for now
  // They will be updated to use Supabase in a future update

  const setLeaveBalance = (userId: number, year: string, balance: number) => {
    setUsers(
      users.map((u) => {
        if (u.id === userId) {
          return {
            ...u,
            leave_balance: {
              ...u.leave_balance,
              [year]: balance,
            },
          }
        }
        return u
      }),
    )
  }

  const setInitialLeaveBalance = (year: string, balance: number) => {
    setUsers(
      users.map((u) => {
        if (u.role === "user") {
          return {
            ...u,
            leave_balance: {
              ...u.leave_balance,
              [year]: balance,
            },
          }
        }
        return u
      }),
    )
  }

  // Get requests waiting for supervisor approval
  const getSupervisorRequests = () => {
    if (!user) return []
    return leaveRequests.filter((req) => req.supervisor_id === user.id && req.supervisor_status === "Pending")
  }

  // Get requests waiting for authorized officer approval
  const getAuthorizedOfficerRequests = () => {
    if (!user?.isauthorizedofficer) return []
    return leaveRequests.filter(
      (req) =>
        req.authorized_officer_id === user.id &&
        req.supervisor_status === "Approved" && // Only show if supervisor has approved
        req.authorized_officer_status === "Pending",
    )
  }

  // Get pending requests count for notifications
  const getPendingRequestsCount = (approverType: "supervisor" | "authorized_officer") => {
    if (!user) return 0

    if (approverType === "supervisor") {
      return leaveRequests.filter(
        (req) => req.supervisor_id === user.id && req.supervisor_status === "Pending" && !req.supervisor_viewed,
      ).length
    } else {
      return leaveRequests.filter(
        (req) =>
          req.authorized_officer_id === user.id &&
          req.supervisor_status === "Approved" && // Only count if supervisor approved
          req.authorized_officer_status === "Pending" &&
          !req.authorized_officer_viewed,
      ).length
    }
  }

  const getUnviewedRequestsCount = () => {
    if (!user) return 0

    if (user.isapprover) {
      return leaveRequests.filter(
        (req) => req.supervisor_id === user.id && req.supervisor_status === "Pending" && !req.supervisor_viewed,
      ).length
    }

    if (user.isauthorizedofficer) {
      return leaveRequests.filter(
        (req) =>
          req.authorized_officer_id === user.id &&
          req.supervisor_status === "Approved" &&
          req.authorized_officer_status === "Pending" &&
          !req.authorized_officer_viewed,
      ).length
    }

    return 0
  }

  // Calculate used leave in a specific year
  const calculateUsedLeaveInYear = (userId: number, year: number) => {
    const startOfYear = new Date(year, 0, 1)
    const endOfYear = new Date(year, 11, 31)

    // Filter leave requests for the user, of type "Cuti Tahunan", approved, and within the year
    const approvedAnnualLeaveRequests = leaveRequests.filter(
      (req) =>
        req.user_id === userId &&
        req.type === "Cuti Tahunan" &&
        req.status === "Approved" &&
        new Date(req.start_date) >= startOfYear &&
        new Date(req.end_date) <= endOfYear,
    )

    // Calculate total working days used (excluding weekends and holidays)
    let totalWorkingDaysUsed = 0

    approvedAnnualLeaveRequests.forEach((req) => {
      // If workingDays is already calculated, use it
      if (req.workingdays) {
        totalWorkingDaysUsed += req.workingdays
      } else {
        // Otherwise calculate it
        const start = new Date(req.start_date)
        const end = new Date(req.end_date)
        const totalDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1

        // Count weekends
        let weekendCount = 0
        for (let i = 0; i < totalDays; i++) {
          const currentDate = new Date(start)
          currentDate.setDate(start.getDate() + i)
          if (isWeekend(currentDate)) {
            weekendCount++
          }
        }

        // Count holidays
        const holidaysCount = holidays.filter((holiday) => {
          const holidayDate = new Date(holiday.date)
          return isWithinInterval(holidayDate, { start, end }) && !isWeekend(holidayDate)
        }).length

        // Calculate working days
        const workingDays = totalDays - weekendCount - holidaysCount
        totalWorkingDaysUsed += workingDays
      }
    })

    return totalWorkingDaysUsed
  }

  // Calculate remaining leave balance with the new policy rules
  const calculateRemainingLeaveBalance = (userId: number, year: string) => {
    if (!users || !leaveRequests) return 0;

    // Dapatkan user
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser || !targetUser.leave_balance) return 0;

    // Dapatkan saldo awal
    const initialBalance = targetUser.leave_balance[year] || 0;

    // Hitung cuti yang sudah digunakan pada tahun tersebut
    const usedLeave = leaveRequests
      .filter(req =>
        req.user_id === userId &&
        req.status === "Approved" &&
        String(new Date(req.start_date).getFullYear()) === year)
      .reduce((total, req) => total + (req.workingdays || 0), 0);

    // Hitung sisa saldo (tidak boleh negatif)
    return Math.max(0, initialBalance - usedLeave);
  };

  // Calculate leave deduction with priority to N-1 leave
  const calculateLeaveDeduction = (userId: number, workingDays: number) => {
    const currentYear = new Date().getFullYear().toString();
    const previousYear = (new Date().getFullYear() - 1).toString();

    // Dapatkan saldo dari tahun berjalan dan tahun sebelumnya
    const currentYearBalance = calculateRemainingLeaveBalance(userId, currentYear);
    const previousYearBalance = calculateRemainingLeaveBalance(userId, previousYear);

    // Prioritaskan pengurangan dari saldo carry-over tahun sebelumnya
    const deductFromCarryOver = Math.min(previousYearBalance, workingDays);
    const remainingDeduction = workingDays - deductFromCarryOver;

    // Kemudian kurangi dari saldo tahun berjalan
    const deductFromCurrentYear = Math.min(currentYearBalance, remainingDeduction);

    // Hitung sisa saldo setelah pengurangan
    const remainingCarryOver = previousYearBalance - deductFromCarryOver;
    const remainingCurrentYear = currentYearBalance - deductFromCurrentYear;

    return {
      deductFromCarryOver,
      deductFromCurrentYear,
      remainingCarryOver,
      remainingCurrentYear,
      totalRemaining: remainingCarryOver + remainingCurrentYear,
      sufficientBalance: deductFromCarryOver + deductFromCurrentYear >= workingDays,
    }
  }

  // Clean up N-2 leave data
  const cleanupOldLeaveData = () => {
    const currentYear = new Date().getFullYear()
    const twoYearsAgo = currentYear - 2

    // Remove N-2 leave balance from users
    setUsers(
      users.map((user) => {
        if (user.leave_balance) {
          const { [twoYearsAgo.toString()]: _, ...updatedBalance } = user.leave_balance
          return {
            ...user,
            leave_balance: updatedBalance,
          }
        }
        return user
      }),
    )

    // Filter out leave requests from N-2 or older
    const startOfTwoYearsAgo = new Date(twoYearsAgo, 0, 1)
    setLeaveRequests(leaveRequests.filter((request) => new Date(request.created_at) >= startOfTwoYearsAgo))
  }

  // Reset annual leave at the beginning of the year
  const resetAnnualLeave = () => {
    const currentYear = new Date().getFullYear()
    const previousYear = currentYear - 1

    setUsers(
      users.map((user) => {
        if (user.role === "user") {
          // Calculate carry-over from previous year
          const previousYearBalance = user.leave_balance?.[previousYear.toString()] || 0
          const usedLeaveInPreviousYear = calculateUsedLeaveInYear(user.id, previousYear)
          const unusedPreviousYearLeave = Math.max(0, previousYearBalance - usedLeaveInPreviousYear)
          const carryOver = Math.min(6, unusedPreviousYearLeave)

          return {
            ...user,
            leave_balance: {
              ...user.leave_balance,
              [currentYear.toString()]: 12, // Reset to 12 days
              [previousYear.toString()]: carryOver, // Update previous year's balance to carry-over amount
            },
          }
        }
        return user
      }),
    )

    // Clean up old leave data
    cleanupOldLeaveData()
  }

  // Tambahkan debounce untuk refreshLeaveRequests
  const refreshLeaveRequests = async () => {
    try {
      const response = await fetch("/api/leave-requests");
      if (!response.ok) {
        throw new Error("Failed to refresh leave requests");
      }
      const data = await response.json();
      if (Array.isArray(data)) {
        setLeaveRequests(data);
      }
    } catch (error) {
      console.error("Error refreshing leave requests:", error);
    }
  };

  const updatePassword = async (userId: number, currentPassword: string, newPassword: string) => {
    try {
      const response = await fetch(`/api/users/${userId}/password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });

      // Cek respons terlebih dahulu
      if (!response.ok) {
        // Coba ambil respons sebagai teks terlebih dahulu
        const responseText = await response.text();
        let errorMessage = "Gagal mengubah password";

        try {
          // Coba parse sebagai JSON
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (parseError) {
          // Jika bukan JSON, cek apakah ini HTML (indikasi server error)
          if (responseText.includes("<!DOCTYPE") || responseText.includes("<html")) {
            console.error("Server mengembalikan HTML alih-alih JSON:", responseText.substring(0, 150) + "...");
            errorMessage = "Terjadi kesalahan pada server. Silakan coba lagi nanti.";
          } else {
            // Jika bukan HTML, gunakan respons teks sebagai pesan error
            errorMessage = responseText || errorMessage;
          }
        }

        throw new Error(errorMessage);
      }

      // Jika response.ok, coba ambil respons sebagai JSON
      try {
        await response.json();
      } catch (error) {
        // Jika tidak bisa di-parse sebagai JSON tapi response.ok, itu bisa diabaikan
        console.warn("Respons sukses tidak dalam format JSON, tapi password berhasil diubah");
      }

      return true;
    } catch (error) {
      console.error("Error updating password:", error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        leaveRequests,
        addLeaveRequest,
        updateLeaveRequestStatus,
        markRequestAsViewed,
        users,
        addUser,
        updateUser,
        deleteUser,
        holidays,
        addHoliday,
        deleteHoliday,
        updateHoliday,
        setLeaveBalance,
        setInitialLeaveBalance,
        getSupervisorRequests,
        getAuthorizedOfficerRequests,
        getPendingRequestsCount,
        getUnviewedRequestsCount,
        calculateUsedLeaveInYear,
        calculateRemainingLeaveBalance,
        calculateLeaveDeduction,
        resetAnnualLeave,
        cleanupOldLeaveData,
        refreshLeaveRequests,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

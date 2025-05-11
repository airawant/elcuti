"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/auth-context"
import { Pegawai } from "@/lib/supabase"

type LeaveBalance = Record<string, number>

export default function UserDetailPage({ params }: { params: { id: string } }) {
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [user, setUser] = useState<Pegawai | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const { user: currentUser } = useAuth()

  useEffect(() => {
    if (!currentUser) {
      router.push("/login")
      return
    }

    if (currentUser.role !== "admin") {
      router.push("/dashboard")
      return
    }

    const fetchUser = async () => {
      setIsLoading(true)
      try {
        const response = await fetch(`/api/users/${params.id}`)

        if (!response.ok) {
          throw new Error("Failed to fetch user")
        }

        const data = await response.json()
        setUser(data.user)
      } catch (error) {
        console.error("Error fetching user:", error)
        toast({
          title: "Error",
          description: "Failed to load user details",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchUser()
  }, [params.id, router, toast, currentUser])

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this user?")) {
      return
    }

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/users/${params.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to delete user")
      }

      toast({
        title: "User deleted",
        description: "User has been successfully deleted",
      })
      router.push("/admin/users")
    } catch (error) {
      console.error("Error deleting user:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete user",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleEdit = () => {
    router.push(`/admin/users/${params.id}/edit`)
  }

  // Function to format leave balance for display
  const formatLeaveBalance = (balance: LeaveBalance | null | undefined) => {
    if (!balance) return "Not set"

    return Object.entries(balance)
      .sort((a, b) => Number(b[0]) - Number(a[0])) // Sort by year descending
      .map(([year, days]) => {
        const isCurrentYear = year === new Date().getFullYear().toString();
        const isPreviousYear = year === (new Date().getFullYear() - 1).toString();
        let yearLabel = year;

        if (isCurrentYear) {
          yearLabel = `${year} (Current)`;
        } else if (isPreviousYear) {
          yearLabel = `${year} (Previous)`;
        }

        return `${yearLabel}: ${days} Hari`;
      })
      .join(", ")
  }

  // Get initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(part => part[0])
      .join("")
      .toUpperCase()
      .substring(0, 2)
  }

  if (!currentUser || currentUser.role !== "admin") {
    return null
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
        <Header title="User Details" onMenuClick={() => setIsMobileOpen(true)} />

        <main className="p-4 md:p-6">
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <p>Loading user details...</p>
            </div>
          ) : !user ? (
            <div className="flex justify-center items-center h-64">
              <p>User not found</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:justify-between md:items-center">
                <div className="flex items-center space-x-4 mb-4 md:mb-0">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name)}`} />
                    <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h1 className="text-2xl font-bold">{user.name}</h1>
                    <p className="text-muted-foreground">{user.email || "No email provided"}</p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button variant="outline" onClick={handleEdit} disabled={isDeleting}>
                    Edit User
                  </Button>
                  <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                    {isDeleting ? "Deleting..." : "Delete User"}
                  </Button>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>User Information</CardTitle>
                    <CardDescription>Personal and contact details</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">NIP</p>
                        <p className="font-medium">{user.nip || "Not set"}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Role</p>
                        <Badge variant={user.role === "admin" ? "destructive" : "outline"}>
                          {user.role === "admin" ? "Admin" : "User"}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Position</p>
                        <p className="font-medium">{user.position || "Not set"}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Work Unit</p>
                        <p className="font-medium">{user.workunit || "Not set"}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Phone</p>
                        <p className="font-medium">{user.phone || "Not set"}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Address</p>
                        <p className="font-medium">{user.address || "Not set"}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Leave & Permissions</CardTitle>
                    <CardDescription>Leave balance and approval settings</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Leave Balance</p>
                      <p className="font-medium">{formatLeaveBalance(user.leave_balance)}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Approver</p>
                        <Badge variant={user.isapprover ? "default" : "outline"}>
                          {user.isapprover ? "Yes" : "No"}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Authorized Officer</p>
                        <Badge variant={user.isauthorizedofficer ? "default" : "outline"}>
                          {user.isauthorizedofficer ? "Yes" : "No"}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar } from "lucide-react"

interface LeaveBalanceCardProps {
  title: string
  balance: number
  type: "current" | "carryOver" | "twoYearsAgo"
  initialBalance?: number
  used?: number
  pending?: number
}

export function LeaveBalanceCard({
  title,
  balance,
  type,
  used = 0,
  pending = 0
}: LeaveBalanceCardProps) {
  const getColor = () => {
    switch (type) {
      case "current":
        return "bg-[hsl(var(--annual-leave))]"
      case "carryOver":
        return "bg-[hsl(var(--carry-over-leave))]"
      case "twoYearsAgo":
        return "bg-[hsl(var(--two-years-ago-leave))]"
      default:
        return "bg-primary"
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className={`p-4 ${getColor()}`}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white text-lg">{title}</CardTitle>
          <Calendar className="h-6 w-6 text-white" />
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="text-3xl font-bold">{balance}</div>
        <div className="text-sm text-gray-500">Hari Tersisa</div>

        {/* Informasi detail selalu ditampilkan */}
        <div className="mt-4 space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-red-600">Sudah Terpakai:</span>
            <span className="font-medium text-red-600">{used} hari</span>
          </div>
          <div className="flex justify-between">
            <span className="text-yellow-600">Sedang Diproses:</span>
            <span className="font-medium text-yellow-600">{pending} hari</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

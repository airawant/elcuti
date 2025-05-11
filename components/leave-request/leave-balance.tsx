import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface LeaveBalanceProps {
  initialBalance: number
  remainingBalance: number
  requestedDays: number
}

export function LeaveBalance({ initialBalance, remainingBalance, requestedDays }: LeaveBalanceProps) {
  const newBalance = remainingBalance - requestedDays

  return (
    <Card>
      <CardHeader>
        <CardTitle>V. CATATAN CUTI</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-sm font-medium">Saldo Awal</p>
          <p>{initialBalance} hari</p>
        </div>
        <div>
          <p className="text-sm font-medium">Sisa Cuti</p>
          <p>{remainingBalance} hari</p>
        </div>
        <div>
          <p className="text-sm font-medium">Saldo Setelah Cuti</p>
          <p>{newBalance} hari</p>
        </div>
      </CardContent>
    </Card>
  )
}


"use client"

import { useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { differenceInDays, parse, isWeekend, isWithinInterval, parseISO } from "date-fns"
import { useAuth } from "@/lib/auth-context"

interface LeaveDurationProps {
  startDate: string
  endDate: string
  totalDays: number
  onChange: (name: string, value: string | number) => void
}

export function LeaveDuration({ startDate, endDate, totalDays, onChange }: LeaveDurationProps) {
  const { holidays } = useAuth()

  useEffect(() => {
    if (startDate && endDate) {
      const start = parse(startDate, "yyyy-MM-dd", new Date())
      const end = parse(endDate, "yyyy-MM-dd", new Date())

      // Calculate total calendar days
      const days = differenceInDays(end, start) + 1
      onChange("totalDays", days)

      // Calculate working days (excluding weekends and holidays)
      let weekendCount = 0
      for (let i = 0; i < days; i++) {
        const currentDate = new Date(start)
        currentDate.setDate(start.getDate() + i)
        if (isWeekend(currentDate)) {
          weekendCount++
        }
      }

      // Count holidays that are not on weekends
      const holidaysCount = holidays.filter((holiday) => {
        const holidayDate = parseISO(holiday.date)
        return isWithinInterval(holidayDate, { start, end }) && !isWeekend(holidayDate)
      }).length

      // Calculate working days
      const workingDays = days - weekendCount - holidaysCount
      onChange("workingDays", workingDays)
    }
  }, [startDate, endDate, onChange, holidays])

  return (
    <Card>
      <CardHeader>
        <CardTitle>IV. LAMANYA CUTI</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-3 gap-4">
        <div>
          <Label htmlFor="start-date">Mulai Tanggal</Label>
          <Input
            id="start-date"
            type="date"
            value={startDate}
            onChange={(e) => onChange("startDate", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="end-date">Sampai Dengan</Label>
          <Input id="end-date" type="date" value={endDate} onChange={(e) => onChange("endDate", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="total-days">Total Hari</Label>
          <Input id="total-days" type="number" value={totalDays} readOnly />
        </div>
      </CardContent>
    </Card>
  )
}


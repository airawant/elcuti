"use client"

import { useEffect, useState } from "react"
import { differenceInDays, format, isWeekend, parseISO, isWithinInterval } from "date-fns"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

interface LeaveCalculationProps {
  startDate: string
  endDate: string
  holidays: any[]
  onCalculate: (totalDays: number, workingDays: number, weekends: Date[], holidaysInRange: any[]) => void
}

export function LeaveCalculation({ startDate, endDate, holidays, onCalculate }: LeaveCalculationProps) {
  const [holidaysInRange, setHolidaysInRange] = useState<any[]>([])
  const [weekendsInRange, setWeekendsInRange] = useState<Date[]>([])
  const [totalDays, setTotalDays] = useState(0)
  const [workingDays, setWorkingDays] = useState(0)

  // Calculate holidays and weekends in range
  useEffect(() => {
    if (!startDate || !endDate) return

    const start = new Date(startDate)
    const end = new Date(endDate)

    // Validate dates before proceeding
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return

    // Find holidays in range
    const holidaysInSelectedRange = holidays.filter((holiday) => {
      const holidayDate = parseISO(holiday.date)
      return isWithinInterval(holidayDate, { start, end })
    })

    // Find weekends in range
    const weekends: Date[] = []
    const days = differenceInDays(end, start) + 1

    for (let i = 0; i < days; i++) {
      const currentDate = new Date(start)
      currentDate.setDate(start.getDate() + i)
      if (isWeekend(currentDate)) {
        weekends.push(new Date(currentDate))
      }
    }

    // Calculate total days
    const totalDaysCount = days

    // Calculate working days
    const holidaysNotOnWeekends = holidaysInSelectedRange.filter((holiday) => !isWeekend(parseISO(holiday.date))).length

    const calculatedWorkingDays = days - weekends.length - holidaysNotOnWeekends

    // Update state only if values have changed
    if (
      totalDaysCount !== totalDays ||
      calculatedWorkingDays !== workingDays ||
      weekends.length !== weekendsInRange.length ||
      holidaysInSelectedRange.length !== holidaysInRange.length
    ) {
      setHolidaysInRange(holidaysInSelectedRange)
      setWeekendsInRange(weekends)
      setTotalDays(totalDaysCount)
      setWorkingDays(calculatedWorkingDays)

      // Notify parent component
      onCalculate(totalDaysCount, calculatedWorkingDays, weekends, holidaysInSelectedRange)
    }
  }, [startDate, endDate, holidays, onCalculate])

  if (!startDate || !endDate) {
    return null
  }

  return (
    <div className="space-y-4">
      {/* Show leave calculation summary */}
      <div className="p-3 bg-gray-50 border rounded-md">
        <h4 className="text-sm font-medium">Ringkasan Perhitungan Cuti</h4>
        <div className="mt-2 space-y-1 text-sm">
          <div className="flex justify-between">
            <span>Total hari yang diminta:</span>
            <span className="font-medium">{totalDays} hari</span>
          </div>
          <div className="flex justify-between">
            <span>Hari libur dan akhir pekan:</span>
            <span className="font-medium">{totalDays - workingDays} hari</span>
          </div>
          <div className="flex justify-between">
            <span>Hari kerja yang dihitung:</span>
            <span className="font-medium">{workingDays} hari</span>
          </div>
        </div>
      </div>

      {/* Show holidays in range if any */}
      {holidaysInRange.length > 0 && (
        <Alert variant="warning">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Hari Libur Termasuk</AlertTitle>
          <AlertDescription>
            <p>Rentang tanggal yang dipilih mencakup {holidaysInRange.length} hari libur:</p>
            <ul className="list-disc pl-5 mt-2">
              {holidaysInRange.map((holiday) => (
                <li key={holiday.id}>
                  {format(parseISO(holiday.date), "dd MMM yyyy")} - {holiday.name}
                </li>
              ))}
            </ul>
            <p className="mt-2 font-medium">Hari libur tidak dihitung dalam pengurangan saldo cuti.</p>
          </AlertDescription>
        </Alert>
      )}

      {/* Show weekends in range if any */}
      {weekendsInRange.length > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Akhir Pekan Termasuk</AlertTitle>
          <AlertDescription>
            <p>Rentang tanggal yang dipilih mencakup {weekendsInRange.length} hari di akhir pekan:</p>
            <ul className="list-disc pl-5 mt-2">
              {weekendsInRange.slice(0, 5).map((weekend, index) => (
                <li key={index}>
                  {format(weekend, "dd MMM yyyy")} - {format(weekend, "EEEE")}
                </li>
              ))}
              {weekendsInRange.length > 5 && <li>...dan {weekendsInRange.length - 5} hari akhir pekan lainnya</li>}
            </ul>
            <p className="mt-2 font-medium">Akhir pekan tidak dihitung dalam pengurangan saldo cuti.</p>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}


"use client"

import { useState } from "react"
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
} from "date-fns"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export function LeaveCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const { user, leaveRequests, holidays } = useAuth()

  const prevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1))
  }

  const nextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1))
  }

  const today = () => {
    setCurrentMonth(new Date())
  }

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd })

  // Get days with leave requests for the current user
  const userLeaveRequests = leaveRequests.filter((req) => req.user_id === user?.id)

  const leaveDays = userLeaveRequests.flatMap((request) => {
    const start = new Date(request.start_date)
    const end = new Date(request.end_date)
    return eachDayOfInterval({ start, end }).map((date) => ({
      date,
      type: request.type,
      status: request.status,
    }))
  })

  // Get holidays for the current month
  const holidaysInMonth = holidays.map((holiday) => ({
    date: parseISO(holiday.date),
    name: holiday.name,
  }))

  const weekDays = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Kalender Cuti</h2>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="icon" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={today}>
            Hari Ini
          </Button>
          <Button variant="outline" size="icon" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="text-center text-lg font-medium">{format(currentMonth, "MMMM yyyy")}</div>

      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((day) => (
          <div key={day} className="text-center font-medium py-2">
            {day}
          </div>
        ))}

        {monthDays.map((day, i) => {
          // Find if this day has a leave request
          const leaveDay = leaveDays.find((leave) => isSameDay(leave.date, day))

          // Find if this day is a holiday
          const holiday = holidaysInMonth.find((h) => isSameDay(h.date, day))

          let bgColor = ""
          if (leaveDay) {
            if (leaveDay.status === "Approved") {
              bgColor = "bg-green-100"
            } else if (leaveDay.status === "Rejected") {
              bgColor = "bg-red-100"
            } else {
              bgColor = "bg-yellow-100"
            }
          } else if (holiday) {
            bgColor = "bg-purple-100"
          }

          return (
            <TooltipProvider key={i}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      "h-12 p-1 text-center border rounded-md cursor-default",
                      !isSameMonth(day, monthStart) && "text-gray-300",
                      isToday(day) && "border-primary",
                      holiday ? "bg-purple-100" : bgColor,
                      holiday && "font-semibold",
                    )}
                  >
                    <div className="h-full flex flex-col justify-center">
                      <span className="text-sm">{format(day, "d")}</span>
                      {!holiday && leaveDay && (
                        <div className="text-xs truncate">
                          {leaveDay.type.split(" ")[1]}
                        </div>
                      )}
                      {holiday && (
                        <div className="text-xs truncate text-purple-700">Libur</div>
                      )}
                    </div>
                  </div>
                </TooltipTrigger>
                {(leaveDay || holiday) && (
                  <TooltipContent>
                    {holiday ? (
                      <div>
                        <p className="font-medium">Hari Libur: {holiday.name}</p>
                        {leaveDay && (
                          <p className="text-xs mt-1">
                            Bertepatan dengan {leaveDay.type} ({leaveDay.status})
                          </p>
                        )}
                      </div>
                    ) : leaveDay && (
                      <div>
                        <p className="font-medium">{leaveDay.type}</p>
                        <p className="text-xs">{leaveDay.status}</p>
                      </div>
                    )}
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          )
        })}
      </div>
    </div>
  )
}

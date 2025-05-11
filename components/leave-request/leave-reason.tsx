"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

interface LeaveReasonProps {
  reason: string
  onChange: (value: string) => void
}

export function LeaveReason({ reason, onChange }: LeaveReasonProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>III. ALASAN CUTI</CardTitle>
      </CardHeader>
      <CardContent>
        <Label htmlFor="leave-reason">Alasan Cuti</Label>
        <Textarea
          id="leave-reason"
          value={reason}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Berikan alasan cuti Anda"
        />
      </CardContent>
    </Card>
  )
}


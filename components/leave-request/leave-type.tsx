"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

interface LeaveTypeProps {
  selectedType: string
  onChange: (value: string) => void
}

export function LeaveType({ selectedType, onChange }: LeaveTypeProps) {
  const leaveTypes = [
    "Cuti Tahunan",
    "Cuti Besar",
    "Cuti Sakit",
    "Cuti Melahirkan",
    "Cuti Karena Alasan Penting",
    "Cuti di Luar Tanggungan Negara",
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>II. JENIS CUTI YANG DIAMBIL</CardTitle>
      </CardHeader>
      <CardContent>
        <RadioGroup value={selectedType} onValueChange={onChange}>
          {leaveTypes.map((type, index) => (
            <div key={type} className="flex items-center space-x-2">
              <RadioGroupItem value={type} id={`leave-type-${index}`} />
              <Label htmlFor={`leave-type-${index}`}>{type}</Label>
            </div>
          ))}
        </RadioGroup>
      </CardContent>
    </Card>
  )
}


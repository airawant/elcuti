"use client"

import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

interface LeaveBalanceSelectionProps {
  selectedBalance: string
  onChange: (value: string) => void
  twoYearsAgoBalance: number
  carryOverBalance: number
  currentYearBalance: number
  twoYearsAgo: number
  previousYear: number
  currentYear: number
}

export function LeaveBalanceSelection({
  selectedBalance,
  onChange,
  twoYearsAgoBalance,
  carryOverBalance,
  currentYearBalance,
  twoYearsAgo,
  previousYear,
  currentYear,
}: LeaveBalanceSelectionProps) {
  return (
    <div className="space-y-4">
      <Label>Pilih Sumber Saldo Cuti</Label>
      <RadioGroup
        value={selectedBalance}
        onValueChange={onChange}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        {twoYearsAgoBalance > 0 && (
          <div>
            <RadioGroupItem
              value="twoYearsAgo"
              id="twoYearsAgo"
              className="peer sr-only"
            />
            <Label
              htmlFor="twoYearsAgo"
              className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-transparent p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
            >
              <span className="text-sm font-medium">Saldo Tahun {twoYearsAgo}</span>
              <span className="text-2xl font-bold">{twoYearsAgoBalance}</span>
              <span className="text-xs text-muted-foreground">hari</span>
            </Label>
          </div>
        )}
        {carryOverBalance > 0 && (
          <div>
            <RadioGroupItem
              value="carryOver"
              id="carryOver"
              className="peer sr-only"
            />
            <Label
              htmlFor="carryOver"
              className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-transparent p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
            >
              <span className="text-sm font-medium">Saldo Tahun {previousYear}</span>
              <span className="text-2xl font-bold">{carryOverBalance}</span>
              <span className="text-xs text-muted-foreground">hari</span>
            </Label>
          </div>
        )}
        {currentYearBalance > 0 && (
          <div>
            <RadioGroupItem
              value="current"
              id="current"
              className="peer sr-only"
            />
            <Label
              htmlFor="current"
              className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-transparent p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
            >
              <span className="text-sm font-medium">Saldo Tahun {currentYear}</span>
              <span className="text-2xl font-bold">{currentYearBalance}</span>
              <span className="text-xs text-muted-foreground">hari</span>
            </Label>
          </div>
        )}
      </RadioGroup>
    </div>
  )
}
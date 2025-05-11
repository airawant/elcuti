"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

interface AddressDuringLeaveProps {
  address: string
  signature: string
  name: string
  nip: string
  onChange: (name: string, value: string) => void
}

export function AddressDuringLeave({ address, signature, name, nip, onChange }: AddressDuringLeaveProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>VI. ALAMAT SELAMA MENJALANKAN CUTI</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="address">Alamat</Label>
          <Textarea
            id="address"
            value={address}
            onChange={(e) => onChange("addressDuringLeave", e.target.value)}
            placeholder="Masukkan alamat selama cuti"
          />
        </div>
        <div>
          <Label htmlFor="signature">Tanda Tangan Digital</Label>
          <Input
            id="signature"
            value={signature}
            onChange={(e) => onChange("signature", e.target.value)}
            placeholder="Masukkan tanda tangan digital"
          />
        </div>
        <div className="pt-4">
          <p className="text-sm">Hormat Saya,</p>
          <p className="font-medium">{name}</p>
          <p className="text-sm">NIP. {nip}</p>
        </div>
      </CardContent>
    </Card>
  )
}


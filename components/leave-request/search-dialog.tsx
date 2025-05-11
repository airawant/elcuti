"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Check, Search, X } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Pegawai } from "@/lib/supabase"

interface SearchDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  items: Pegawai[]
  selectedId: number | null
  onSelect: (id: number) => void
}

export function SearchDialog({
  isOpen,
  onOpenChange,
  title,
  description,
  items,
  selectedId,
  onSelect,
}: SearchDialogProps) {
  const [searchTerm, setSearchTerm] = useState("")

  // Filter items based on search term
  const filteredItems = items.filter((item) => {
    const searchTermLower = searchTerm.toLowerCase()
    return (
      item.name.toLowerCase().includes(searchTermLower) ||
      item.position?.toLowerCase().includes(searchTermLower) ||
      item.id.toString().includes(searchTermLower)
    )
  })

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="relative my-2">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1 h-7 w-7"
              value={searchTerm}
              onClick={() => setSearchTerm("")}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="max-h-[300px] overflow-y-auto border rounded-md">
          {filteredItems.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">Tidak ada hasil yang ditemukan</div>
          ) : (
            <div className="divide-y">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="p-3 hover:bg-gray-50 cursor-pointer flex items-center justify-between"
                  onClick={() => onSelect(item.id)}
                >
                  <div>
                    <div className="font-medium">{item.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {item.position} • NIP: {item.id}
                    </div>
                  </div>
                  {selectedId === item.id && <Check className="h-5 w-5 text-green-500" />}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

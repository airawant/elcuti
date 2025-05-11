"use client"

import type React from "react"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/hooks/use-toast"
import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Image from "next/image"

export default function LoginPage() {
  const [nip, setNip] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { login } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  // Get the redirect path from URL if available
  const from = searchParams.get("from") || ""

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const success = await login(nip, password)

      if (success) {
        // Redirect to the original destination or default based on role
        if (nip.toLowerCase() === "admin") {
          router.push(from || "/admin/dashboard")
        } else {
          router.push(from || "/dashboard")
        }

        toast({
          title: "Login berhasil",
          description: "Selamat datang kembali!",
        })
      } else {
        setError("NIP atau password tidak valid")
      }
    } catch (error) {
      setError("Terjadi kesalahan yang tidak diharapkan")
      toast({
        title: "Error login",
        description: "Terjadi kesalahan yang tidak diharapkan",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-primary/10">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-3">
          <div className="mx-auto relative w-24 h-24">
            <Image
              src="/logo.png"
              alt="Logo EL-CUTI"
              fill
              className="object-contain"
              priority
            />
          </div>
          <CardTitle className="text-2xl font-bold text-center text-primary">EL-CUTI KEMENAG KOTA TANJUNGPINANG</CardTitle>
          <CardDescription className="text-center">ELEKTRONIK CUTI KANTOR KEMENTERIAN AGAMA KOTA TANJUNGPINANG</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="nip">NIP</Label>
                <Input
                  id="nip"
                  placeholder="Masukkan NIP Anda"
                  value={nip}
                  onChange={(e) => setNip(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Masukkan password Anda"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Sedang login..." : "Login"}
              </Button>
            </div>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col">
          <p className="text-sm text-muted-foreground text-center">Lupa password?</p>
          <p className="text-xs text-muted-foreground text-center">
            Hubungi Admin untuk reset password <a href="https://wa.me/6282172801123" className="text-primary">Disini</a>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}

import Image from 'next/image'
import Link from 'next/link'

export function Footer() {
  return (
    <footer className="border-t py-6 m-4 md:py-8">
      <div className="container flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2">
          <Image
            src="/logo.png"
            alt="Kemenag Logo"
            width={40}
            height={40}
            className="object-contain"
          />
          <div className="text-sm">
            <h3 className="font-semibold">Kementerian Agama</h3>
            <p className="text-muted-foreground">Kota Tanjungpinang</p>
          </div>
        </div>

        <div className="text-sm text-center md:text-left">
          <p className="text-muted-foreground">
            Jl. Daeng Kamboja KM.24 Kp. Bugis, Kec. Tanjungpinang Kota, Kota Tanjungpinang, Kepulauan Riau
          </p>
          <p className="text-muted-foreground">
            Telepon: 0821 72 801 123 | Email: tanjungpinang@kemenag.go.id
          </p>
        </div>

        <div className="flex gap-6">
          <div className="text-sm">
            <h4 className="font-medium mb-2">Link</h4>
            <ul className="space-y-1">
              <li>
                <Link href="/" className="text-muted-foreground hover:text-primary transition-colors">
                  Beranda
                </Link>
              </li>
              <li>
                <Link href="/pengembang" className="text-muted-foreground hover:text-primary transition-colors">
                  Pengembang
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <div className="container mt-6 pt-4 border-t">
        <p className="text-xs text-center text-muted-foreground">
          © {new Date().getFullYear()} Kementerian Agama Kota Tanjungpinang. Hak Cipta Dilindungi.
        </p>
      </div>
    </footer>
  )
}

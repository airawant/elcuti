# Perbaikan Masalah Saldo N-2 Tahun

## Masalah yang Ditemukan

Pada penyimpanan permohonan cuti, saldo yang tersimpan dan terpotong tidak sesuai dengan aplikasi, terutama terkait dengan perubahan yang menambahkan saldo n-2 tahun. **Masalah utama**: kolom `used_n2_year`, `used_carry_over_days`, dan `used_current_year_days` tidak tersimpan dengan benar sesuai dengan saldo yang ingin dipakai.

## Penyebab Masalah

1. **Schema Validasi API**: Field `used_n2_year` dan `saldo_n2_year` tidak termasuk dalam schema validasi di API
2. **Constraint Database**: Constraint `leave_days_check` tidak menangani field `used_n2_year`
3. **Logika Penyimpanan**: API tidak menggunakan data saldo n-2 tahun yang dikirim dari frontend
4. **Validasi Frontend**: Validasi di frontend menggunakan saldo sisa, bukan saldo awal
5. **Input Manual**: Frontend tidak mendukung input manual untuk masing-masing kolom saldo
6. **Logika Distribusi**: Data saldo dijumlahkan dan hanya disimpan di satu kolom, bukan didistribusikan ke masing-masing kolom

## Perbaikan yang Telah Dilakukan

### 1. Perbaikan Schema Validasi API (`app/api/leave-requests/route.ts`)

```typescript
const leaveRequestSchema = z.object({
  // ... field lainnya
  saldo_n2_year: z.number().optional(),
  used_n2_year: z.number().optional(),
})
```

### 2. Perbaikan Logika Penyimpanan Saldo di API

- **Menggunakan data dari frontend**: API sekarang menggunakan data yang dikirim dari frontend dengan benar
- **Validasi data lengkap**: Memastikan total penggunaan sama dengan workingDays
- **Distribusi yang tepat**: Masing-masing kolom (`used_n2_year`, `used_carry_over_days`, `used_current_year_days`) tersimpan dengan benar
- **Logging detail**: Menambahkan logging untuk memantau data yang disimpan

### 3. Perbaikan Constraint Database

**Migration baru**: `supabase/migrations/20240321000000_fix_leave_days_constraint.sql`

```sql
-- Drop the existing constraint
ALTER TABLE public.leave_requests DROP CONSTRAINT IF EXISTS leave_days_check;

-- Add the new constraint that includes used_n2_year
ALTER TABLE public.leave_requests ADD CONSTRAINT leave_days_check CHECK (
    (used_carry_over_days >= 0)
    AND (used_current_year_days >= 0)
    AND (used_n2_year >= 0)
    AND (
        (used_carry_over_days + used_current_year_days + used_n2_year) = workingdays
    )
);
```

### 4. Perbaikan Frontend (`components/leave-request-modal.tsx`)

#### A. Input Manual yang Lebih Baik
- **Tabel input manual**: Pengguna dapat mengisi masing-masing kolom saldo secara manual
- **Validasi real-time**: Menampilkan total penggunaan dan validasi secara real-time
- **Indikator visual**: Warna hijau/kuning/merah untuk menunjukkan status penggunaan

#### B. Pilihan Saldo Otomatis
- **Tombol pilihan**: Pengguna dapat memilih saldo otomatis (N-2, N-1, Tahun Ini)
- **Auto-fill**: Otomatis mengisi input berdasarkan pilihan
- **Disabled state**: Tombol disabled jika saldo tidak tersedia

#### C. Logika Penggunaan Saldo yang Diperbaiki
```typescript
// Gunakan input manual dari pengguna
let usedTwoYearsAgo = formData.usedTwoYearsAgo || 0;
let usedCarryOver = formData.usedPrevYear || 0;
let usedCurrentYear = formData.usedCurrentYear || 0;

// Validasi penggunaan tidak melebihi saldo yang tersedia
if (usedTwoYearsAgo > remainingTwoYearsAgoBalance) {
  throw new Error(`Penggunaan saldo tahun N-2 (${usedTwoYearsAgo} hari) melebihi saldo yang tersedia (${remainingTwoYearsAgoBalance} hari)`);
}
```

### 5. Fitur Baru yang Ditambahkan

#### A. Tabel Input Manual dengan Total
```jsx
<tr className="bg-gray-50">
  <td className="px-2 py-1 border font-medium">Total</td>
  <td className="px-2 py-1 border font-medium">
    {totalSaldo} hari
  </td>
  <td className="px-2 py-1 border font-medium">
    <span className={cn(
      "px-2 py-1 rounded text-xs",
      totalUsed === workingDays ? "bg-green-100 text-green-800" :
      totalUsed > workingDays ? "bg-red-100 text-red-800" :
      "bg-yellow-100 text-yellow-800"
    )}>
      {totalUsed} / {workingDays} hari
    </span>
  </td>
</tr>
```

#### B. Pilihan Saldo Otomatis
```jsx
<div className="flex flex-wrap gap-2">
  <Button
    variant={formData.selectedLeaveBalance === "twoYearsAgo" ? "default" : "outline"}
    onClick={() => handleSelectedLeaveBalanceChange("twoYearsAgo")}
    disabled={remainingTwoYearsAgoBalance <= 0}
  >
    Saldo N-2 ({remainingTwoYearsAgoBalance} hari)
  </Button>
  {/* ... tombol lainnya */}
</div>
```

## Cara Menerapkan Perbaikan

### 1. Jalankan Migration Database

```bash
# Jika menggunakan Supabase CLI
npx supabase db push

# Atau jalankan SQL secara manual di Supabase Dashboard
```

### 2. Restart Aplikasi

```bash
npm run dev
```

## Testing

Setelah menerapkan perbaikan, test dengan:

1. **Buat permohonan cuti baru** dengan input manual untuk masing-masing kolom saldo
2. **Test pilihan saldo otomatis** dengan memilih tombol saldo yang berbeda
3. **Verifikasi data tersimpan** dengan benar di database (masing-masing kolom terisi sesuai input)
4. **Cek saldo terpotong** sesuai dengan yang diharapkan di tabel pegawai
5. **Validasi constraint** tidak error saat menyimpan

## Struktur Data yang Benar

### Field yang Disimpan di `leave_requests`:
- `used_n2_year`: Jumlah hari cuti dari saldo n-2 tahun (tersimpan terpisah)
- `used_carry_over_days`: Jumlah hari cuti dari saldo n-1 tahun (tersimpan terpisah)
- `used_current_year_days`: Jumlah hari cuti dari saldo tahun berjalan (tersimpan terpisah)
- `saldo_n2_year`: Saldo awal n-2 tahun
- `saldo_carry`: Saldo awal n-1 tahun
- `saldo_current_year`: Saldo awal tahun berjalan

### Validasi:
- Total: `used_n2_year + used_carry_over_days + used_current_year_days = workingdays`
- Semua field >= 0
- Penggunaan tidak boleh melebihi saldo awal
- **PENTING**: Masing-masing kolom tersimpan terpisah, tidak dijumlahkan

## Contoh Penggunaan

### Input Manual:
- Pengguna mengisi: N-2 = 2 hari, N-1 = 3 hari, Tahun Ini = 1 hari
- Total: 6 hari
- **Hasil**: `used_n2_year = 2`, `used_carry_over_days = 3`, `used_current_year_days = 1`

### Pilihan Otomatis:
- Pengguna memilih "Saldo N-2"
- **Hasil**: `used_n2_year = 6`, `used_carry_over_days = 0`, `used_current_year_days = 0`

## Catatan Penting

- Pastikan Docker berjalan jika menggunakan Supabase CLI
- Backup database sebelum menjalankan migration
- Test di environment development terlebih dahulu
- **PENTING**: Sekarang masing-masing kolom saldo tersimpan terpisah sesuai input pengguna

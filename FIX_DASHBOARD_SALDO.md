# Perbaikan Dashboard Saldo Cuti

## Masalah yang Ditemukan

1. **Total Saldo Cuti tidak akurat**: Belum menambahkan saldo n-2 tahun yang terpakai
2. **Informasi tidak lengkap**: Tidak membedakan antara cuti yang sudah terpakai dan sedang diproses
3. **Tampilan kurang informatif**: Tidak menampilkan detail penggunaan per tahun

## Perbaikan yang Telah Dilakukan

### 1. Perbaikan Perhitungan Penggunaan Cuti (`app/(auth)/dashboard/page.tsx`)

#### A. Menambahkan Saldo N-2 Tahun
```typescript
const getUsedLeaveDays = () => {
  const usedLeave = {
    twoYearsAgo: 0,    // ✅ Ditambahkan
    carryOver: 0,
    currentYear: 0,
    total: 0,
  };

  const pendingLeave = {
    twoYearsAgo: 0,    // ✅ Ditambahkan
    carryOver: 0,
    currentYear: 0,
    total: 0,
  };

  leaveRequests.forEach((req) => {
    const twoYearsAgoUsed = req.used_n2_year || 0;  // ✅ Mengambil data n-2
    const carryOverUsed = req.used_carry_over_days || 0;
    const currentYearUsed = req.used_current_year_days || 0;

    if (req.status === "Approved") {
      // Sudah terpakai
      usedLeave.twoYearsAgo += twoYearsAgoUsed;
      usedLeave.carryOver += carryOverUsed;
      usedLeave.currentYear += currentYearUsed;
    } else if (req.status === "Pending") {
      // Sedang diproses
      pendingLeave.twoYearsAgo += twoYearsAgoUsed;
      pendingLeave.carryOver += carryOverUsed;
      pendingLeave.currentYear += currentYearUsed;
    }
  });
}
```

#### B. Membedakan Status Cuti
- **Approved**: Cuti yang sudah disetujui dan terpakai
- **Pending**: Cuti yang sedang diproses (belum disetujui)
- **Rejected**: Cuti yang ditolak (tidak dihitung)

#### C. Perhitungan Saldo Tersisa yang Akurat
```typescript
const getRemainingBalance = () => {
  // Saldo awal dari tabel pegawai
  const saldoDuaTahunLalu = user.leave_balance?.[twoYearsAgo] || 0;
  const saldoTahunLalu = user.leave_balance?.[previousYear] || 0;
  const saldoTahunIni = user.leave_balance?.[currentYear] || 0;

  // Hitung sisa setelah dikurangi yang terpakai dan sedang diproses
  const remainingTwoYearsAgo = Math.max(0, saldoDuaTahunLalu - usedLeave.twoYearsAgo - pendingLeave.twoYearsAgo);
  const remainingCarryOver = Math.max(0, saldoTahunLalu - usedLeave.carryOver - pendingLeave.carryOver);
  const remainingCurrentYear = Math.max(0, saldoTahunIni - usedLeave.currentYear - pendingLeave.currentYear);

  return {
    twoYearsAgo: remainingTwoYearsAgo,
    carryOver: remainingCarryOver,
    currentYear: remainingCurrentYear,
    total: remainingTwoYearsAgo + remainingCarryOver + remainingCurrentYear,
    // Informasi tambahan untuk detail
    initialBalance: {
      twoYearsAgo: saldoDuaTahunLalu,
      carryOver: saldoTahunLalu,
      currentYear: saldoTahunIni,
      total: saldoDuaTahunLalu + saldoTahunLalu + saldoTahunIni,
    },
    used: usedLeave,
    pending: pendingLeave,
  };
};
```

### 2. Perbaikan Tampilan Total Saldo Cuti

#### A. Informasi Detail yang Lengkap
```jsx
<CardContent className="p-6">
  <div className="text-3xl font-bold">{remainingBalance.total}</div>
  <div className="text-sm text-gray-500">Hari Tersisa</div>

  {/* Informasi detail penggunaan */}
  <div className="mt-4 space-y-2 text-xs">
    <div className="flex justify-between">
      <span className="text-gray-600">Saldo Awal:</span>
      <span className="font-medium">{remainingBalance.initialBalance.total} hari</span>
    </div>
    <div className="flex justify-between">
      <span className="text-red-600">Sudah Terpakai:</span>
      <span className="font-medium text-red-600">{usedLeave.total} hari</span>
    </div>
    <div className="flex justify-between">
      <span className="text-yellow-600">Sedang Diproses:</span>
      <span className="font-medium text-yellow-600">{pendingLeave.total} hari</span>
    </div>
    <div className="border-t pt-2 mt-2">
      <div className="flex justify-between">
        <span className="text-gray-600">Total Digunakan:</span>
        <span className="font-medium text-gray-800">{usedLeave.total + pendingLeave.total} hari</span>
      </div>
    </div>
  </div>
</CardContent>
```

### 3. Perbaikan Komponen LeaveBalanceCard

#### A. Menambahkan Props untuk Informasi Detail
```typescript
interface LeaveBalanceCardProps {
  title: string
  balance: number
  type: "current" | "carryOver" | "twoYearsAgo"
  initialBalance?: number    // ✅ Ditambahkan
  used?: number             // ✅ Ditambahkan
  pending?: number          // ✅ Ditambahkan
}
```

#### B. Tampilan Detail per Card
```jsx
{/* Informasi detail jika tersedia */}
{initialBalance !== undefined && (
  <div className="mt-4 space-y-1 text-xs">
    <div className="flex justify-between">
      <span className="text-gray-600">Awal:</span>
      <span className="font-medium">{initialBalance} hari</span>
    </div>
    <div className="flex justify-between">
      <span className="text-red-600">Terpakai:</span>
      <span className="font-medium text-red-600">{used} hari</span>
    </div>
    <div className="flex justify-between">
      <span className="text-yellow-600">Diproses:</span>
      <span className="font-medium text-yellow-600">{pending} hari</span>
    </div>
  </div>
)}
```

### 4. Penggunaan Komponen yang Diperbaiki

```jsx
{/* Card Saldo N-2 Tahun */}
<LeaveBalanceCard
  title={`Saldo Cuti ${twoYearsAgo}`}
  balance={remainingBalance.twoYearsAgo}
  type="twoYearsAgo"
  initialBalance={remainingBalance.initialBalance.twoYearsAgo}
  used={usedLeave.twoYearsAgo}
  pending={pendingLeave.twoYearsAgo}
/>

{/* Card Saldo Carry-Over */}
<LeaveBalanceCard
  title={`Saldo Cuti ${previousYear}`}
  balance={remainingBalance.carryOver}
  type="carryOver"
  initialBalance={remainingBalance.initialBalance.carryOver}
  used={usedLeave.carryOver}
  pending={pendingLeave.carryOver}
/>

{/* Card Saldo Tahun Berjalan */}
<LeaveBalanceCard
  title={`Saldo Cuti ${currentYear}`}
  balance={remainingBalance.currentYear}
  type="current"
  initialBalance={remainingBalance.initialBalance.currentYear}
  used={usedLeave.currentYear}
  pending={pendingLeave.currentYear}
/>
```

## Hasil Perbaikan

### 1. Total Saldo Cuti yang Akurat
- ✅ Menambahkan saldo n-2 tahun yang terpakai
- ✅ Menghitung sisa saldo dengan benar
- ✅ Menampilkan informasi detail (awal, terpakai, diproses)

### 2. Informasi yang Dibedakan
- 🔴 **Sudah Terpakai** (Approved): Cuti yang sudah disetujui
- 🟡 **Sedang Diproses** (Pending): Cuti yang menunggu persetujuan
- ⚫ **Ditolak** (Rejected): Cuti yang ditolak (tidak dihitung)

### 3. Tampilan yang Lebih Informatif
- **Total Saldo Cuti**: Menampilkan hari tersisa + detail penggunaan
- **Card per Tahun**: Menampilkan saldo tersisa + detail per tahun
- **Warna yang Konsisten**:
  - Merah untuk yang sudah terpakai
  - Kuning untuk yang sedang diproses
  - Ungu untuk saldo n-2 tahun

## Contoh Tampilan

### Total Saldo Cuti:
```
24 Hari Tersisa

Saldo Awal: 36 hari
Sudah Terpakai: 8 hari
Sedang Diproses: 4 hari
─────────────────
Total Digunakan: 12 hari
```

### Card Saldo N-2 Tahun:
```
6 Hari Tersisa

Awal: 6 hari
Terpakai: 0 hari
Diproses: 0 hari
```

## Testing

Setelah menerapkan perbaikan, test dengan:

1. **Buat permohonan cuti baru** dan cek apakah muncul di "Sedang Diproses"
2. **Setujui permohonan cuti** dan cek apakah pindah ke "Sudah Terpakai"
3. **Verifikasi perhitungan** saldo tersisa sesuai dengan yang diharapkan
4. **Cek saldo n-2 tahun** apakah terhitung dengan benar

## Catatan Penting

- Saldo tersisa = Saldo awal - Terpakai - Diproses
- Cuti yang ditolak tidak mempengaruhi saldo
- Informasi detail hanya muncul jika data tersedia
- Warna konsisten untuk membedakan status penggunaan

-- ============================================================
-- Migration: Create LKH (Laporan Kinerja Harian) Tables
-- Date: 2026-07-28
-- ============================================================

-- ============================================================
-- Tabel: lkh_laporan
-- Menyimpan header laporan harian per periode (bulan + tahun)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lkh_laporan (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES public.pegawai(id) ON DELETE CASCADE,
    approver_id BIGINT REFERENCES public.pegawai(id) ON DELETE SET NULL,
    bulan       INTEGER NOT NULL CHECK (bulan BETWEEN 1 AND 12),
    tahun       INTEGER NOT NULL CHECK (tahun >= 2020),
    dasar       TEXT DEFAULT 'Surat Edaran Sekretaris Jenderal Kementerian Agama Nomor 7 Tahun 2026 tentang Pelaksanaan Tugas Kedinasan Bagi Pegawai Aparatur Sipil Negara dan Percepatan Transformasi Tata Kelola Penyelenggaraan Pemerintahan pada Kementerian Agama',
    status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
    pdf_url     TEXT,
    approval_note TEXT,
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_lkh_laporan_user_bulan_tahun UNIQUE (user_id, bulan, tahun)
);

COMMENT ON TABLE public.lkh_laporan IS 'Header laporan kinerja harian ASN per periode bulan dan tahun';
COMMENT ON COLUMN public.lkh_laporan.user_id IS 'ID pegawai pembuat laporan';
COMMENT ON COLUMN public.lkh_laporan.approver_id IS 'ID pegawai atasan/approver penandatangan (isapprover=true)';
COMMENT ON COLUMN public.lkh_laporan.bulan IS 'Bulan periode laporan (1-12)';
COMMENT ON COLUMN public.lkh_laporan.tahun IS 'Tahun periode laporan';
COMMENT ON COLUMN public.lkh_laporan.dasar IS 'Dasar hukum / surat edaran';
COMMENT ON COLUMN public.lkh_laporan.status IS 'Status laporan: draft, submitted, approved, rejected';
COMMENT ON COLUMN public.lkh_laporan.pdf_url IS 'Link download file PDF hasil persetujuan/cetak';
COMMENT ON COLUMN public.lkh_laporan.approval_note IS 'Catatan dari atasan saat pengesahan / penolakan';
COMMENT ON COLUMN public.lkh_laporan.approved_at IS 'Waktu tanggal persetujuan disahkan';

-- ============================================================
-- Tabel: lkh_kegiatan
-- Menyimpan baris kegiatan harian per tanggal
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lkh_kegiatan (
    id              BIGSERIAL PRIMARY KEY,
    laporan_id      BIGINT NOT NULL REFERENCES public.lkh_laporan(id) ON DELETE CASCADE,
    tanggal         DATE NOT NULL,
    uraian_tugas    TEXT[]  NOT NULL DEFAULT '{}',
    realisasi       TEXT[]  NOT NULL DEFAULT '{}',
    urutan          INTEGER NOT NULL DEFAULT 1,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE public.lkh_kegiatan IS 'Baris kegiatan harian dalam laporan kinerja';
COMMENT ON COLUMN public.lkh_kegiatan.uraian_tugas IS 'Array rencana hasil kerja / uraian tugas';
COMMENT ON COLUMN public.lkh_kegiatan.realisasi IS 'Array realisasi kegiatan';
COMMENT ON COLUMN public.lkh_kegiatan.urutan IS 'Urutan baris dalam laporan';

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_lkh_laporan_user_id      ON public.lkh_laporan(user_id);
CREATE INDEX IF NOT EXISTS idx_lkh_laporan_tahun_bulan  ON public.lkh_laporan(tahun, bulan);
CREATE INDEX IF NOT EXISTS idx_lkh_kegiatan_laporan_id  ON public.lkh_kegiatan(laporan_id);
CREATE INDEX IF NOT EXISTS idx_lkh_kegiatan_tanggal     ON public.lkh_kegiatan(tanggal);

-- ============================================================
-- Trigger: auto-update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_lkh_laporan_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_lkh_laporan_updated_at
    BEFORE UPDATE ON public.lkh_laporan
    FOR EACH ROW
    EXECUTE FUNCTION public.update_lkh_laporan_updated_at();

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================
ALTER TABLE public.lkh_laporan  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lkh_kegiatan ENABLE ROW LEVEL SECURITY;

-- lkh_laporan policies
CREATE POLICY "Users can read their own lkh_laporan"
    ON public.lkh_laporan FOR SELECT
    USING (auth.role() = 'authenticated' AND user_id = (SELECT pegawai_id FROM auth.users WHERE auth.users.id = auth.uid()));

CREATE POLICY "Users can insert their own lkh_laporan"
    ON public.lkh_laporan FOR INSERT
    WITH CHECK (auth.role() = 'authenticated' AND user_id = (SELECT pegawai_id FROM auth.users WHERE auth.users.id = auth.uid()));

CREATE POLICY "Users can update their own lkh_laporan"
    ON public.lkh_laporan FOR UPDATE
    USING (auth.role() = 'authenticated' AND user_id = (SELECT pegawai_id FROM auth.users WHERE auth.users.id = auth.uid()));

CREATE POLICY "Users can delete their own lkh_laporan"
    ON public.lkh_laporan FOR DELETE
    USING (auth.role() = 'authenticated' AND user_id = (SELECT pegawai_id FROM auth.users WHERE auth.users.id = auth.uid()));

CREATE POLICY "Approvers can read assigned lkh_laporan"
    ON public.lkh_laporan FOR SELECT
    USING (auth.role() = 'authenticated' AND approver_id = (SELECT pegawai_id FROM auth.users WHERE auth.users.id = auth.uid()));

CREATE POLICY "Approvers can update assigned lkh_laporan"
    ON public.lkh_laporan FOR UPDATE
    USING (auth.role() = 'authenticated' AND approver_id = (SELECT pegawai_id FROM auth.users WHERE auth.users.id = auth.uid()));

CREATE POLICY "Admins can read all lkh_laporan"
    ON public.lkh_laporan FOR SELECT
    USING (auth.role() = 'authenticated' AND EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = auth.uid() AND auth.users.role = 'admin'));

CREATE POLICY "Admins can update all lkh_laporan"
    ON public.lkh_laporan FOR UPDATE
    USING (auth.role() = 'authenticated' AND EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = auth.uid() AND auth.users.role = 'admin'));

-- lkh_kegiatan policies
CREATE POLICY "Users can read their own lkh_kegiatan"
    ON public.lkh_kegiatan FOR SELECT
    USING (auth.role() = 'authenticated' AND laporan_id IN (SELECT id FROM public.lkh_laporan WHERE user_id = (SELECT pegawai_id FROM auth.users WHERE auth.users.id = auth.uid())));

CREATE POLICY "Approvers can read assigned lkh_kegiatan"
    ON public.lkh_kegiatan FOR SELECT
    USING (auth.role() = 'authenticated' AND laporan_id IN (SELECT id FROM public.lkh_laporan WHERE approver_id = (SELECT pegawai_id FROM auth.users WHERE auth.users.id = auth.uid())));

CREATE POLICY "Users can insert their own lkh_kegiatan"
    ON public.lkh_kegiatan FOR INSERT
    WITH CHECK (auth.role() = 'authenticated' AND laporan_id IN (SELECT id FROM public.lkh_laporan WHERE user_id = (SELECT pegawai_id FROM auth.users WHERE auth.users.id = auth.uid())));

CREATE POLICY "Users can update their own lkh_kegiatan"
    ON public.lkh_kegiatan FOR UPDATE
    USING (auth.role() = 'authenticated' AND laporan_id IN (SELECT id FROM public.lkh_laporan WHERE user_id = (SELECT pegawai_id FROM auth.users WHERE auth.users.id = auth.uid())));

CREATE POLICY "Users can delete their own lkh_kegiatan"
    ON public.lkh_kegiatan FOR DELETE
    USING (auth.role() = 'authenticated' AND laporan_id IN (SELECT id FROM public.lkh_laporan WHERE user_id = (SELECT pegawai_id FROM auth.users WHERE auth.users.id = auth.uid())));

CREATE POLICY "Admins can read all lkh_kegiatan"
    ON public.lkh_kegiatan FOR SELECT
    USING (auth.role() = 'authenticated' AND EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = auth.uid() AND auth.users.role = 'admin'));

-- ============================================================
-- Grant permissions
-- ============================================================
GRANT ALL ON public.lkh_laporan  TO authenticated;
GRANT ALL ON public.lkh_kegiatan TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.lkh_laporan_id_seq  TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.lkh_kegiatan_id_seq TO authenticated;

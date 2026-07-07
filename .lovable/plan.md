# Rencana: Laporan Audit Kesesuaian Implementasi TTE + Rating UX

Saya akan menghasilkan **satu berkas PDF** di `/mnt/documents/laporan-audit-tte-implementasi.pdf` yang memverifikasi apakah kode saat ini sudah sesuai dengan dua PDF analisis sebelumnya (*Analisis Document TTE* dan *Analisis TTE Otorisasi Gap*), lengkap dengan skor rating kemudahan penggunaan per peran dan per aspek. **Tidak ada perubahan kode / DB pada langkah ini** — murni audit + laporan.

## Metode Audit (basis: kode nyata, bukan asumsi)

1. Baca ulang file kunci untuk verifikasi:
   - Rute: `src/routes/_authenticated/admin.document-center.*`, rute legacy stub, `verify.index.tsx`, `v.$token.tsx`, `verify.$token.tsx`, `verify-doc.$token.tsx`.
   - Fungsi server: `src/lib/document-center.functions.ts`, `dsig-bulk.functions.ts`, `dsig-p2.functions.ts`, `features/digital-signature/functions/dsig.functions.ts`, `features/signature/services/*`.
   - Skema: query `supabase--read_query` untuk `signature_delegations`, `signing_certificates` (kolom `rotated_from`, `revoked_at`), view `v_dc_kpi`, `v_dc_provider_health`, index baru di `signature_requests`.
2. Bandingkan setiap item roadmap P0/P1/P2 vs kode → status: **✅ Terpenuhi / ⚠️ Sebagian / ❌ Belum**.
3. Simulasi UX per peran melalui pembacaan komponen (halaman yang tersedia, jumlah klik, feedback, empty state, mobile fit di 360px).

## Struktur PDF (± 12–16 halaman)

**1. Ringkasan Eksekutif** — Skor kesesuaian keseluruhan, skor UX rata-rata, top 5 gap tersisa.

**2. Verifikasi Implementasi vs PDF Analisis #1 (Document TTE)**
Tabel per fitur: fitur → file/kode terkait → status → bukti (path baris). Kategori: Upload, Sign, Verify, Audit, Timeline, Archive.

**3. Verifikasi Implementasi vs PDF Analisis #2 (Otorisasi Gap)**
Tabel per item gap yang direkomendasikan:
- Otorisasi role & jabatan (RBAC, `signer-resolver`, `master_jabatan`).
- Konsolidasi rute legacy (16 stub redirect).
- Delegasi (`signature_delegations` + `dcDelegateSigner`).
- Bulk sign + Inbox (`admin.document-center.signature.my-inbox`).
- Verifikasi hash publik (`verify/index.tsx`).
- Rotasi sertifikat + KPI + Provider health (P2).
- Item yang **belum** dikerjakan: integrasi BSrE eksternal, QR camera scan, sequential sign UX, kebijakan retensi per jenis, template picker terintegrasi permohonan.

**4. Audit Duplikasi Tersisa**
Sisir kode lagi untuk memastikan tidak ada regresi duplikat (mis. `MonitoringView`, `WorkQueueCards`, verifier publik triple `/v` `/verify` `/verify-doc`).

**5. Rating Kemudahan Penggunaan**

*5a. Rating per Peran* (skala 1–10):
| Peran | Skor | Alasan skor < 10 |
|---|---|---|
| Warga | ? | mis. tidak ada QR scan kamera, tidak ada riwayat verifikasi saya |
| ASN | ? | bulk sign OK, tapi belum ada pemilihan lokasi TTE di halaman PDF, mobile 360px |
| Admin Desa/OPD | ? | template picker belum menyatu ke permohonan |
| Pejabat | ? | filter inbox terbatas, alasan tolak belum terstruktur |
| Superadmin | ? | KPI ada, tapi belum ada provider eksternal & kebijakan retensi UI |

*5b. Rating per Aspek* (skala 1–10): Kejelasan Navigasi, Konsistensi Visual, Feedback Aksi (toast/loading), Aksesibilitas (kontras, aria), Responsivitas Mobile (360px), Onboarding/Bantuan, Error Recovery, Kecepatan (query invalidation), Keamanan yang Terlihat, Internasionalisasi.

Setiap skor < 10 dilengkapi **daftar perbaikan konkret** (file yang harus disentuh + effort estimate).

**6. Rekomendasi Prioritas Berikutnya**
Tabel P3 (backlog pasca-P2): item yang membawa skor UX ke 10/10.

**7. Lampiran** — Peta rute akhir, daftar server functions aktif, daftar tabel/view/index terkait TTE.

## Proses Pembuatan PDF

1. Verifikasi kode + query DB (baca-saja).
2. Susun tabel status berbasis bukti file.
3. Render ReportLab (palet biru gov, tabel wrap, `<sub>`/`<super>` bila perlu, tanpa Unicode subscript).
4. QA visual per halaman via `pdftoppm` + `pdftotext -layout`; perbaiki bila ada teks terpotong atau overlap.
5. Kirim via `<presentation-artifact path="laporan-audit-tte-implementasi.pdf" mime_type="application/pdf">`.

## Tidak Dilakukan di Turn Ini
- Tidak ada perubahan kode, rute, atau migrasi DB. Semua rekomendasi hanya di PDF.

Setujui rencana ini untuk saya mulai audit dan render PDF-nya.

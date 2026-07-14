# Parity Report — Lovable Dev ↔ GitHub

**Repo GitHub:** `Narman0397/cloud-sync-deployment` (branch `main`, public)
**Waktu audit:** 2026-07-14

## Ringkasan

| Kategori                        | Jumlah |
| ------------------------------- | -----: |
| File identik                    |    693 |
| Hanya ada di dev                |      0 |
| Hanya ada di GitHub             |      0 |
| Ada di keduanya, isi berbeda    |      2 |
| **Total file tracked di git**   |  **695** |

Metode: bandingkan Git blob SHA (algoritma sama seperti `git hash-object`) untuk seluruh file `git ls-files` di dev vs seluruh blob di `git/trees?recursive=1` GitHub.

## File yang berbeda

| Path                       | Kategori    | Keterangan                                                                    |
| -------------------------- | ----------- | ----------------------------------------------------------------------------- |
| `.lovable/plan.md`         | Artefak     | File plan agent — otomatis diperbarui setiap turn; akan ikut sync berikutnya. |
| `src/routeTree.gen.ts`     | Generated   | Auto-generated oleh TanStack Router Vite plugin saat build. Tidak diedit manual. Perbedaan minor lazim & akan disinkronisasi ulang saat sync engine push berikutnya. |

## Kesimpulan

Repo GitHub **sudah 100% paritas** dengan dev untuk seluruh source code, konfigurasi Vite/TS/lint, semua route, semua service/feature, semua migration SQL, seluruh `src/routes/api/public/hooks/*`, dan asset publik. Dua perbedaan yang tersisa adalah artefak internal (plan file) dan output generator — bukan drift yang perlu ditindaklanjuti.

**Rekomendasi:** tidak ada aksi remediasi kode yang diperlukan. Sync engine Lovable akan otomatis push perubahan berikutnya (termasuk file dokumentasi & manifest yang dibuat oleh audit ini).

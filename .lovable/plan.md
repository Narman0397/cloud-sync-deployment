## Temuan utama

Masalahnya bukan di tombol publish saja. Data assignment untuk akun ASN sudah dibuat di tabel `form_assignments`, termasuk form yang dibuat oleh superadmin. Namun fungsi daftar `Tugas Saya` gagal saat membaca data karena query memakai nested relation:

```ts
form_assignments.select("..., forms(id,judul,deskripsi,status,deadline)")
```

Backend mengembalikan error:

```text
Could not find a relationship between 'form_assignments' and 'forms' in the schema cache
```

Penyebabnya: tabel `form_assignments` tidak punya foreign key ke `forms`, sehingga relasi `forms(...)` tidak bisa dipakai. Di UI error ini tidak ditampilkan dengan jelas, sehingga ASN hanya melihat daftar kosong.

## Rencana perbaikan

1. **Perbaiki struktur relasi database**
   - Tambahkan foreign key:
     - `form_assignments.form_id -> forms.id`
     - `form_targets.form_id -> forms.id`
   - Tambahkan foreign key user/profil yang aman bila belum ada:
     - `form_assignments.user_id -> profiles.id`
   - Pastikan data existing aman dulu; hasil pengecekan menunjukkan tidak ada assignment/target yatim.

2. **Buat fungsi daftar tugas lebih tahan error**
   - Ubah `listMyAssignments` agar tidak bergantung penuh pada nested relation `forms(...)`.
   - Ambil `form_assignments` dulu, lalu ambil data `forms` berdasarkan `form_id`, kemudian gabungkan di server function.
   - Dengan ini, meskipun schema cache relasi belum refresh, daftar tugas tetap muncul.

3. **Tampilkan error dengan jelas di halaman ASN**
   - Tambahkan state error di `src/routes/_authenticated/asn.tugas.tsx`.
   - Jika `listMyAssignments` gagal, tampilkan pesan error singkat dan jangan diam-diam menampilkan “Belum ada tugas”.

4. **Rapikan target resolver supaya tidak salah sasaran**
   - Pastikan target `role: asn` hanya mengambil user dengan role ASN.
   - Pastikan target `asn_type` tidak mengikutkan user non-ASN yang kebetulan punya `asn_type` terisi.
   - Ini mencegah kasus form terkirim ke akun admin desa/non-ASN.

5. **Backfill dan validasi ulang**
   - Jalankan backfill assignment untuk semua form `published` agar data lama ikut benar.
   - Verifikasi dengan query backend bahwa tiap ASN target punya assignment.
   - Verifikasi fungsi `listMyAssignments` tidak lagi error dan mengembalikan rows untuk akun ASN.

## File yang akan disentuh

- `src/lib/assignments.functions.ts`
- `src/features/forms/services/assignment-resolution.service.ts`
- `src/routes/_authenticated/asn.tugas.tsx`
- Migration backend untuk foreign key + backfill assignment
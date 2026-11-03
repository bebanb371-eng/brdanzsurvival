# BRDANZ Survival

Game survival browser desktop/Android dengan menu multipage dan Three.js. Material tanah, daun, kayu, batu, bata, logam, beton, dan kain dibentuk di JavaScript melalui noise shader 3D ruang-dunia. Dunia voxel yang diperluas memuat hutan berkanopi blok bertingkat, rumput berlapis, sungai dalam beranimasi, siklus siang-malam, sawah, pegunungan, deposit bijih yang bisa ditambang, serta lobby bercahaya ungu. Karakter, hewan, musuh, bangunan, kilatan, dan proyektil memakai geometri 3D prosedural; model karakter GLB dan motion capture belum disertakan.

## Menjalankan

1. `npm install`
2. Jalankan `npm run dev` (frontend Vite pada port 5173 dan API/WebSocket pada port 3001).
3. Buka `http://localhost:5173`, buat akun, lalu masuk. Akun disimpan di `server/data/accounts.json`; password di-hash dengan scrypt. Simpan `SESSION_SECRET` rahasia pada environment untuk deployment.

Alamat `Network` Vite dapat dibuka perangkat lain di jaringan Wi-Fi/LAN yang sama; alamat itu bukan alamat publik internet. Multiplayer global hanya mempertemukan pengguna pada instance backend yang sama. Deployment publik memerlukan hosting backend yang mendukung WebSocket dan HTTPS; save pemain selain akun tetap berada di browser masing-masing.

## Kontrol

- Desktop: WASD, Shift, Space, klik kiri untuk menembak, mouse untuk membidik, Q untuk mengganti orang pertama/over-shoulder/orang ketiga, E untuk interaksi, F untuk menambang, 1–5 untuk senjata dan beliung, Esc untuk pause. Bind tombol bisa diubah dari Pengaturan.
- Android: joystick kiri, geser area permainan untuk kamera, dan tombol lari/lompat/interaksi/tambang/kamera/tembak/jeda. Posisi tombol dapat diatur dari menu Pengaturan.
- Buka pintu dan gerbang dengan E. Gunakan beliung untuk menambang batu, logam, dan kristal. Nara di kamp membuka toko. Loot, bijih yang ditambang, pintu yang dibuka, ancaman yang dikalahkan, dan posisi pemain tersimpan lokal.
- Di menu Skin, pilih model 3D dan seret ruang kosong untuk memutarnya. Antarmuka memakai ikon SVG lokal; layar loading memutar video yang disertakan pengguna.
- Global online: setelah login, pemain masuk otomatis ke pulau publik (maksimal 8 pemain per shard) tanpa kode undangan. Pemain bisa saling melihat dan bertarung. Room privat berkode tetap tersedia di halaman Multiplayer.
- Rumah: Rumah Penjaga tersedia sejak awal; Kabin Hutan dan Rumah Bukit bisa dibeli dan ditingkatkan sampai level 5. Tidur memajukan waktu ke pagi dan memulihkan HP.
- Spin: satu putaran memakai 150 koin dan memberi suplai, mata uang, atau skin acak. Kualitas grafis Low, Medium, High, dan Ultra disimpan lokal. Tombol layar bisa diseret dari `Atur tombol` di survival atau Pengaturan.

Gerakan, kamera, pepohonan, dan karakter memakai geometri serta animasi prosedural; model GLB dengan motion capture belum disertakan. Database akun berbentuk JSON file lokal dan perlu penyimpanan persisten bersama jika backend dipisah ke beberapa instance.

## Pemeriksaan

- `npm run test` menjalankan tes store serta integrasi register/session/WebSocket room/chat.
- `npm run build` membangun semua halaman multipage.

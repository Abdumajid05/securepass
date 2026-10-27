# SecurePass

SecurePass — Chrome/Edge uchun mahalliy parol menejeri. Parollar brauzer ichida master parol bilan shifrlanadi. Ixtiyoriy Python serveri faqat shifrlangan nusxani qurilmalar orasida sinxronlaydi.

## Tez boshlash

1. `npm install` — JavaScript paketlarini o‘rnatadi.
2. `npm run build` — kengaytmani `dist/` papkasiga yig‘adi.
3. Brauzerda `chrome://extensions` yoki `edge://extensions` sahifasiga kiring, Developer mode’ni yoqing va `dist/` papkasini **Load unpacked** orqali yuklang.
4. Kengaytmani ochib, master parol yarating. Uni unutib qo‘ysangiz, vaultni tiklab bo‘lmaydi.

Brauzerning yuqori o‘ngidagi SecurePass ikonkasini bossangiz, popup oynasi shu ikonka ostida ochiladi. `Ctrl+Shift+Y` popupni ochadi, `Ctrl+Shift+K` esa ochiq vaultni darhol qulflaydi. Tugmalarni `chrome://extensions/shortcuts` sahifasida o‘zgartirish mumkin.

**Parol bog‘i** bo‘limida har bir login parolining kuchi, takror ishlatilishi va yangilangan vaqtiga qarab o‘simlik sifatida ko‘rinadi. Niholni tanlab kuch, noyoblik va yangilik ko‘rsatkichlarini ko‘ring; loginlarni qidirish, holati bo‘yicha filtrlash va saralash mumkin.

Python sync server ishlatilmasa, backendni ishga tushirish shart emas.

## Backendni ishga tushirish

PowerShell’da backend papkasiga o‘tib, serverni ishga tushiring:

```powershell
cd backend
$bytes = New-Object byte[] 32
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$rng.Dispose()
$env:SECUREPASS_SYNC_TOKEN = [Convert]::ToBase64String($bytes)
$env:SECUREPASS_ALLOWED_ORIGIN = "chrome-extension://KENGAYTMA_ID"
python server.py
```

`KENGAYTMA_ID` o‘rniga kengaytmaning `chrome://extensions` sahifasida ko‘rsatilgan identifikatorni yozing. So‘ng kengaytmaning Dashboard → **Shifrlangan sinxronlash** bo‘limiga `http://127.0.0.1:8765` va yaratilgan tokenni kiriting. Server bo‘yicha qisqa qo‘llanma [backend/README.md](backend/README.md) faylida.

## Loyiha tuzilishi

- `src/` — React kengaytmasi: interfeys, lokal saqlash, shifrlash, generator, xavfsizlik tahlili va sync klienti.
- `backend/server.py` — Python standart kutubxonasidagi sync API; vault SQLite’da saqlanadi.
- `public/manifest.json` — brauzer kengaytmasi sozlamalari.
- `dist/` — `npm run build` yaratadigan va brauzerga yuklanadigan kengaytma.

## Ma’lumotlar oqimi

1. Vault master parol yordamida qurilmada shifrlanadi.
2. Shifrlangan ma’lumot brauzer xotirasida saqlanadi.
3. Sync yoqilsa, Python serverga faqat shifrlangan vault yuboriladi.
4. Serverdagi versiya tekshiruvi yangi ma’lumotni sezdirmasdan bosib yozishdan saqlaydi.

Server tokenini sir saqlang. Masofaviy server uchun HTTPS yoqing.

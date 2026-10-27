# Python sync server

Server `server.py` Python standart kutubxonalari bilan ishlaydi; qo‘shimcha paket o‘rnatish shart emas. U faqat brauzerda shifrlangan vault nusxasini SQLite’da saqlaydi. Master parol serverga yuborilmaydi.

## Lokal ishga tushirish (Windows)

PowerShell’da `backend` papkasidan:

```powershell
$bytes = New-Object byte[] 32
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$rng.Dispose()
$env:SECUREPASS_SYNC_TOKEN = [Convert]::ToBase64String($bytes)
$env:SECUREPASS_ALLOWED_ORIGIN = "chrome-extension://KENGAYTMA_ID"
python server.py
```

`KENGAYTMA_ID` ni chrome://extensions sahifasidan oling. Tokenni xavfsiz saqlang va boshqa qurilmalarda ham shu tokenni ishlating. Server http://127.0.0.1:8765 manzilida ishlaydi; holatini http://127.0.0.1:8765/health orqali tekshiring. Token va server manzilini kengaytma Dashboardiga kiriting.

## Muhim sozlamalar

- `SECUREPASS_SYNC_TOKEN` — kamida 32 baytli maxfiy token; majburiy.
- `SECUREPASS_ALLOWED_ORIGIN` — extension manzili, masalan `chrome-extension://...`.
- `SECUREPASS_HOST`, `SECUREPASS_PORT` — standart qiymatlar `127.0.0.1` va `8765`.
- `SECUREPASS_DB_PATH` — SQLite fayli; standart joyi `backend/data/vaults.sqlite3`.

Ommaviy tarmoqqa chiqarishda TLS reverse proxy ishlating, `SECUREPASS_TLS_TERMINATED=1` va `SECUREPASS_ALLOWED_HOSTS` sozlang. Serverni TLS’siz internetga ochmang.

## API

- `GET /v1/vault` — vault va `ETag` qaytaradi; topilmasa `404`.
- `PUT /v1/vault` — yangi vault uchun `If-None-Match: *`, yangilash uchun joriy `ETag` bilan `If-Match` talab qiladi. Eskirgan nusxa `412` oladi.
- `GET /health` — server holati.

Server tokeni yo‘qolsa, eski vaultga kirish huquqini bergani sababli uni shunchaki yangisiga almashtirmang. Vaultni o‘chirish endpoint’i mavjud emas.

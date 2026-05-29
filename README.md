# Trello CLI

Trello CLI interaktif yang dibangun dengan TypeScript + Ink (React untuk terminal).

## Fitur

- Browse boards, lists, dan cards
- Buat card baru
- Edit nama card
- Pindahkan card antar list
- Kelola checklist (buat, tambah item, toggle status)
- Lihat & tambah komentar

## Setup

### 1. Dapatkan API Key & Token

Buka https://trello.com/app-key dan:

- Copy **API Key**
- Klik link "Token" untuk generate token, lalu copy

### 2. Buat file .env

Buat file `.env` di folder ini (atau `~/.trello-cli.env` agar berlaku global):

```
TRELLO_API_KEY=your_api_key_here
TRELLO_TOKEN=your_token_here
```

### 3. Install dependencies

```bash
npm install
```

### 4. Build & jalankan

```bash
# Build TypeScript
npm run build

# Jalankan
npm start

# Atau jalankan langsung tanpa build (dev mode)
npm run dev
```

### 5. (Opsional) Install global

```bash
npm run build
npm install -g .
# Lalu jalankan dari mana saja:
trello
```

## Navigasi

| Tombol | Aksi          |
| ------ | ------------- |
| ↑ / ↓  | Navigasi menu |
| Enter  | Pilih         |
| ESC    | Kembali       |
| Q      | Keluar        |

## Struktur

```
src/
├── index.tsx   # Entry point, load credentials
├── app.tsx     # Main UI (Ink/React components)
└── api.ts      # Trello REST API client
```

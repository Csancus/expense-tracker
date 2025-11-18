# Supabase Setup Guide - Expense Tracker

## 🚀 Quick Setup (5 perc)

### 1. Supabase Project létrehozása

1. Menj a [Supabase Dashboard](https://app.supabase.com)-ra
2. Kattints a "New project" gombra
3. Válaszd ki a szervezeted vagy hozz létre újat
4. Add meg a projekt adatait:
   - **Name**: expense-tracker
   - **Database Password**: Erős jelszó (mentsd el!)
   - **Region**: Europe (eu-west-1) - közelebb van hozzánk
   - **Pricing Plan**: FREE
5. Kattints "Create new project"
6. Várj 2-3 percet amíg a projekt felépül

### 2. Adatbázis séma létrehozása

1. A Supabase Dashboard-ban menj a **SQL Editor** tabra
2. Kattints "New query"
3. Másold be a teljes tartalmat a `supabase/schema.sql` fájlból
4. Kattints "Run" a séma létrehozásához
5. Ellenőrizd hogy minden tábla létrejött a **Table Editor**-ban

### 3. API kulcsok beszerzése

1. Menj a **Settings** > **API** tabra
2. Másold ki ezeket az értékeket:
   - **Project URL** (pl. `https://abcdefg.supabase.co`)
   - **anon public key** (hosszú szöveg, `eyJ...` kezdődik)

### 4. Frontend konfiguráció

#### Opció A: Meta tag-ek (egyszerű)
Szúrd be ezeket a `<head>` részbe az `index.html`-ben:

```html
<meta name="SUPABASE_URL" content="https://your-project.supabase.co">
<meta name="SUPABASE_ANON_KEY" content="your-anon-key-here">
```

#### Opció B: JavaScript változók
Vagy add hozzá ezt a script tag-et:

```html
<script>
  window.SUPABASE_URL = 'https://your-project.supabase.co';
  window.SUPABASE_ANON_KEY = 'your-anon-key-here';
</script>
```

### 5. Script tag-ek hozzáadása

Frissítsd az index.html-t ezekkel a script tag-ekkel:

```html
<!-- Supabase CDN -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<!-- App Scripts -->
<script src="supabase-client.js?v=1"></script>
<script src="supabase-auth.js?v=1"></script>
<script src="app.js?v=1"></script>
```

## ✅ Tesztelés

1. Nyisd meg az alkalmazást
2. Próbálj regisztrálni egy új fiókkal
3. Ellenőrizd hogy megkapod-e a megerősítő emailt
4. Jelentkezz be
5. Töltsd fel egy bank kivonatot
6. Ellenőrizd hogy az adatok megjelennek a Supabase Dashboard-on

## 🎯 Főbb szolgáltatások

### Amit kapsz a FREE tier-rel:
- ✅ 50,000 MAU (Monthly Active Users)
- ✅ 500 MB adatbázis tárhely
- ✅ 1 GB file storage (bank kivonatok)
- ✅ 5 GB forgalom havonta
- ✅ Korlátlan API hívások
- ✅ Email authentication
- ✅ Google OAuth (ha beállítod)
- ✅ Row Level Security (RLS)
- ✅ Realtime sync
- ✅ Automatic backups

### Automatikus funkciók:
- 🤖 **Auto-kategorizálás**: A tranzakciók automatikusan kategorizálódnak a szabályok alapján
- 🔄 **Realtime sync**: Az adatok azonnal szinkronizálódnak az eszközök között
- 🔐 **Biztonság**: Minden felhasználó csak saját adatait látja (RLS)
- 📧 **Email megerősítés**: Biztonságos regisztráció
- 📱 **Offline fallback**: Ha nincs internet, localStorage-ban tárol

## 🛠️ Fejlett beállítások

### Google OAuth engedélyezése:
1. **Authentication** > **Providers** > **Google**
2. Add meg a Google Client ID és Secret-et
3. Authorized redirect URLs: `https://your-project.supabase.co/auth/v1/callback`

### Storage bucket beállítása:
1. **Storage** > **Buckets**
2. Az "uploads" bucket automatikusan létrejött
3. Itt fognak tárolódni a feltöltött fájlok

### Email template testreszabása:
1. **Authentication** > **Email Templates**
2. Testreszabhatod az email sablonokat

## 🐛 Hibaelhárítás

### "Invalid API key" hiba:
- Ellenőrizd hogy jó API kulcsot másoltad
- Ellenőrizd hogy a projekt URL helyes

### "Row Level Security" hiba:
- Futtasd le újra a schema.sql-t
- Ellenőrizd hogy a policies létrejöttek

### Offline mode marad:
- Ellenőrizd a browser console-t hibákért
- Ellenőrizd hogy a meta tag-ek helyesek
- Próbáld meg frissíteni az oldalt

## 💡 Tippek

1. **Fejlesztés**: Használd a browser dev tools-t a hibák nyomon követésére
2. **Adatok**: A Supabase Dashboard-on láthatod az élő adatokat
3. **Backup**: A FREE tier-nél is van automatic backup
4. **Monitoring**: A Dashboard-on láthatod a usage statistics-ot
5. **Upgrade**: Ha kinövöd a FREE tier-t, $25/hó a Pro plan

## 🔄 Migrálás localStorage-ról

Ha már van adat localStorage-ban, az automatikusan át fog szinkronizálódni első bejelentkezéskor. Az adatok mindkét helyen megmaradnak, így nem veszítesz semmit.

---

**Költség összegzés:**
- Fejlesztés: **FREE** ✅
- Kis user base (~1000 user): **FREE** ✅ 
- Közepes használat: **$25/hó** (Pro plan)

**Időigény:**
- Supabase setup: 5 perc
- Frontend config: 2 perc
- Tesztelés: 3 perc
- **Összesen: ~10 perc** 🚀
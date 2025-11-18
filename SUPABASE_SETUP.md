# Supabase Setup Útmutató

## 1. Supabase Projekt Létrehozása

1. Menj a [supabase.com](https://supabase.com) oldalra
2. Kattints a "Start your project" gombra
3. Jelentkezz be GitHub fiókkal vagy email/jelszóval
4. Hozz létre új projektet:
   - **Project name**: `expense-tracker`
   - **Database password**: Generálj biztonságos jelszót
   - **Region**: `Europe (EU West)` - Frankfurt (GDPR compliance)

## 2. Adatbázis Séma Beállítása

1. A projekt dashboard-ban menj a **SQL Editor** részhez
2. Hozz létre új query-t és másold be a következő SQL-t:

```sql
-- Költségkategóriák
CREATE TABLE categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    emoji TEXT,
    color TEXT DEFAULT '#6B7280',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Kategória szabályok (időszak alapú)
CREATE TABLE category_rules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    merchant_pattern TEXT NOT NULL,
    start_date DATE,
    end_date DATE,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tranzakciók
CREATE TABLE transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    merchant TEXT NOT NULL,
    description TEXT,
    amount DECIMAL(12,2) NOT NULL,
    category_id UUID REFERENCES categories(id),
    bank TEXT,
    reference TEXT,
    memo TEXT,
    hash TEXT UNIQUE, -- duplikátum ellenőrzéshez
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bankfájl feltöltések
CREATE TABLE file_uploads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    bank TEXT NOT NULL,
    file_hash TEXT NOT NULL,
    transactions_count INTEGER DEFAULT 0,
    upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security engedélyezése
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_uploads ENABLE ROW LEVEL SECURITY;

-- RLS Policies - csak saját adatokat látja/szerkesztheti a felhasználó
CREATE POLICY "Users can manage their own categories" ON categories
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own category rules" ON category_rules
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own transactions" ON transactions
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own uploads" ON file_uploads
    FOR ALL USING (auth.uid() = user_id);

-- Alapértelmezett kategóriák beszúrása (minden felhasználóhoz)
CREATE OR REPLACE FUNCTION create_default_categories()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO categories (user_id, name, emoji, color) VALUES
        (NEW.id, 'Élelmiszer', '🍔', '#EF4444'),
        (NEW.id, 'Közlekedés', '🚗', '#F59E0B'),
        (NEW.id, 'Rezsi', '🏠', '#10B981'),
        (NEW.id, 'Vásárlás', '🛍️', '#3B82F6'),
        (NEW.id, 'Szórakozás', '🎬', '#8B5CF6'),
        (NEW.id, 'Egészség', '🏥', '#EC4899'),
        (NEW.id, 'Egyéb', '📌', '#6B7280');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger az alapértelmezett kategóriákhoz
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION create_default_categories();
```

3. Futtasd a query-t a "Run" gombbal

## 3. Autentikáció Konfigurálása

1. Menj az **Authentication** → **Settings** részhez
2. **Site URL** beállítása:
   - Development: `http://localhost:3000` vagy `http://localhost:8080`
   - Production: `https://csancus.github.io/expense-tracker`

3. **Redirect URLs** hozzáadása:
   - `http://localhost:3000/**`
   - `https://csancus.github.io/expense-tracker/**`

4. **OAuth Providers** beállítása (opcionális):
   - Google: Engedélyezd és állítsd be OAuth credentials
   - Más providers igény szerint

## 4. API Kulcsok Megszerzése

1. Menj a **Settings** → **API** részhez
2. Másold ki a következő értékeket:
   - **Project URL**: `https://your-project-id.supabase.co`
   - **Anon key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

## 5. Frontend Konfiguráció

### Opció 1: Environment Variables (ajánlott production-höz)
Hozz létre `.env` fájlt:
```bash
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
```

### Opció 2: Meta Tags (GitHub Pages)
Add hozzá az index.html head részéhez:
```html
<meta name="SUPABASE_URL" content="https://your-project-id.supabase.co">
<meta name="SUPABASE_ANON_KEY" content="your-anon-key-here">
```

### Opció 3: JavaScript Variables
Hozz létre `config.js` fájlt:
```javascript
window.SUPABASE_URL = 'https://your-project-id.supabase.co';
window.SUPABASE_ANON_KEY = 'your-anon-key-here';
```

## 6. Email Templates (opcionális)

1. Menj az **Authentication** → **Email Templates** részhez
2. Customize-old az email template-eket magyarra:

**Confirm signup template:**
```html
<h2>Erősítse meg regisztrációját</h2>
<p>Kattintson az alábbi linkre a regisztráció véglegesítéséhez:</p>
<p><a href="{{ .ConfirmationURL }}">Email megerősítése</a></p>
```

## 7. Storage Beállítása (PDF feltöltéshez)

1. Menj a **Storage** részhez
2. Hozz létre új bucket-et: `bank-statements`
3. Állítsd be a policies-t:

```sql
-- Storage policy fájl feltöltéshez
CREATE POLICY "Users can upload their own files" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'bank-statements' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own files" ON storage.objects
    FOR SELECT USING (bucket_id = 'bank-statements' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own files" ON storage.objects
    FOR DELETE USING (bucket_id = 'bank-statements' AND auth.uid()::text = (storage.foldername(name))[1]);
```

## 8. Testing

1. Nyisd meg az alkalmazást
2. Regisztrálj új fiókkal
3. Ellenőrizd az email-ed és erősítsd meg
4. Próbáld ki a bejelentkezést
5. Tölts fel bankszámlakivonatot

## 9. Production Deploy

### GitHub Pages
1. Add hozzá a Supabase config-ot meta tag-ekben
2. Commit és push GitHub-ra
3. Engedélyezd GitHub Pages-t
4. Frissítsd a Supabase redirect URL-eket

### Vercel/Netlify
1. Állítsd be environment variables-t
2. Deploy a projektet
3. Frissítsd Supabase URL konfigurációt

## 10. Monitoring & Analytics

1. **Database**: Supabase Dashboard → SQL Editor
2. **Auth**: Authentication → Users
3. **Storage**: Storage → bank-statements
4. **Logs**: Logs & Reports

## Troubleshooting

### Gyakori hibák:

1. **"Invalid JWT"**: Ellenőrizd az API key-t
2. **"Row Level Security"**: Ellenőrizd a policies-t
3. **CORS hiba**: Ellenőrizd az allowed origins-t
4. **Email nem érkezik**: Ellenőrizd spam folder-t

### Debug módba kapcsolás:
```javascript
// Konzolban:
localStorage.debug = 'supabase:*'
```

## Költségek

- **Ingyenes tier**: 500MB DB, 50MB storage, 50,000 monthly active users
- **Pro ($25/hó)**: 8GB DB, 100GB storage, 100,000 MAU
- **Team ($599/hó)**: Dedikált erőforrások, priority support

## Biztonsági Javaslatok

1. **API kulcsok**: Soha ne commitoljd a repo-ba
2. **RLS**: Mindig enabled legyen
3. **HTTPS**: Kötelező minden környezetben  
4. **Email verification**: Enabled legyen
5. **Password policy**: Erős jelszó követelmények
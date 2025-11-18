# Cloud-Based Expense Tracker Architecture

## Ajánlott felhő architektúra

### 1. Backend-as-a-Service (BaaS) megoldások
**Supabase** (PostgreSQL alapú):
- ✅ Kiváló választás - teljes körű megoldás
- PostgreSQL adatbázis, valós idejű funkciók
- Beépített autentikáció (Google, email, etc.)
- Row Level Security (RLS)
- Edge Functions (Deno runtime)
- File storage
- Ingyenes tier: 500MB adatbázis, 50MB storage

**Firebase** (Google):
- NoSQL adatbázis (Firestore)
- Erős autentikáció integráció
- Offline funkcionalitás
- Valós idejű szinkronizáció
- Cloud Functions
- Ingyenes tier: 1GB storage

**PocketBase** (self-hosted):
- Go alapú, egyszerű telepítés
- SQLite adatbázis
- Beépített admin UI
- Realtime subscriptions
- File storage
- Teljesen önhosztolható

### 2. Ajánlott megoldás: **Supabase**

#### Előnyök:
- **Biztonság**: Row Level Security (RLS) felhasználónként
- **Skalálhatóság**: PostgreSQL alapú
- **Fejlesztői élmény**: Kiváló TypeScript támogatás
- **Költség**: Ingyenes kezdéshez, fizetős scaling
- **Funkcionalitás**: Auth, DB, Storage, Edge Functions egy helyen
- **EU megfelelőség**: Frankfurt datacenter elérhető

### 3. Adatbázis séma terv

```sql
-- Felhasználók (Supabase auth.users tábla automatikusan kezeli)

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

-- Row Level Security (RLS) szabályok
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_uploads ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their own categories" ON categories
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own category rules" ON category_rules
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own transactions" ON transactions
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own uploads" ON file_uploads
    FOR ALL USING (auth.uid() = user_id);
```

### 4. Frontend változtatások

#### Autentikáció integráció:
```javascript
// auth.js - Supabase autentikáció
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://your-project.supabase.co'
const supabaseKey = 'your-anon-key'
const supabase = createClient(supabaseUrl, supabaseKey)

// Bejelentkezés
async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    })
    return { data, error }
}

// Regisztráció  
async function signUp(email, password) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password
    })
    return { data, error }
}

// Google bejelentkezés
async function signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google'
    })
    return { data, error }
}
```

#### Adatszinkronizáció:
```javascript
// database.js - Adatbázis műveletek
class ExpenseDatabase {
    constructor(supabase) {
        this.supabase = supabase
    }

    // Tranzakciók mentése
    async saveTransactions(transactions) {
        const { data, error } = await this.supabase
            .from('transactions')
            .insert(transactions)
        return { data, error }
    }

    // Tranzakciók lekérdezése
    async getTransactions() {
        const { data, error } = await this.supabase
            .from('transactions')
            .select(`
                *,
                category:categories(*)
            `)
            .order('date', { ascending: false })
        return { data, error }
    }

    // Kategóriák kezelése
    async saveCategory(category) {
        const { data, error } = await this.supabase
            .from('categories')
            .insert(category)
        return { data, error }
    }

    // Realtime subscription
    subscribeToChanges(callback) {
        return this.supabase
            .channel('transactions')
            .on('postgres_changes', 
                { event: '*', schema: 'public', table: 'transactions' },
                callback
            )
            .subscribe()
    }
}
```

### 5. Implementációs lépések

1. **Supabase projekt létrehozása**
   - Új projekt a [supabase.com](https://supabase.com)-on
   - EU datacenter választása (GDPR compliance)
   - Adatbázis séma futtatása

2. **Frontend autentikáció**
   - Login/register komponensek
   - Auth state management
   - Védett route-ok

3. **Adatszinkronizáció**
   - LocalStorage → Supabase migráció
   - Offline/online sync
   - Conflict resolution

4. **File upload**
   - PDF/Excel feltöltés Supabase Storage-ba
   - Server-side processing Edge Functions-ben
   - Async tranzakció feldolgozás

### 6. Biztonsági megfontolások

- **RLS (Row Level Security)**: Minden tábla védett
- **API kulcsok**: Environment variables
- **HTTPS**: Kötelező minden kommunikációra
- **Rate limiting**: Supabase beépített védelme
- **SQL injection**: Parameterized queries
- **XSS védelem**: Content Security Policy

### 7. Költségbecslés (Supabase Pro)

- **Ingyenes tier**: 500MB DB, 50MB storage
- **Pro tier ($25/hó)**: 8GB DB, 100GB storage
- **Team tier ($599/hó)**: Dedikált erőforrások

### 8. Alternatív megoldások

**Firebase**:
```javascript
// Firebase setup
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = { /* config */ }
const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
```

**PocketBase** (self-hosted):
- Docker container
- Egyszerű telepítés
- Teljes kontroll
- Alacsony költség

### 9. Javaslat

**Kezdéshez: Supabase**
- Gyors fejlesztés
- Teljes körű megoldás  
- Jó ingyenes tier
- Kiváló dokumentáció
- TypeScript támogatás

**Későbbi lehetőségek:**
- PocketBase self-hosting nagyobb kontrolért
- Firebase valós idejű funkciókért
- Custom backend specializált igényekhez

Szeretnéd, hogy implementáljam a Supabase integrációt?
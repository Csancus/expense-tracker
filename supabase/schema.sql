-- Supabase Schema for Expense Tracker

-- Enable RLS (Row Level Security)
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA PUBLIC REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(100) NOT NULL,
    emoji VARCHAR(10),
    color VARCHAR(7) CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT categories_user_name_unique UNIQUE(user_id, name)
);

-- Category Rules table
CREATE TABLE IF NOT EXISTS category_rules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE NOT NULL,
    merchant_pattern VARCHAR(200) NOT NULL,
    start_date DATE,
    end_date DATE,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    merchant VARCHAR(200) NOT NULL,
    description TEXT,
    amount DECIMAL(12,2) NOT NULL,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    bank VARCHAR(50),
    reference VARCHAR(200),
    memo VARCHAR(500),
    hash VARCHAR(200),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT transactions_hash_unique UNIQUE(hash) DEFERRABLE INITIALLY DEFERRED
);

-- File Uploads table
CREATE TABLE IF NOT EXISTS file_uploads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    filename VARCHAR(300) NOT NULL,
    bank VARCHAR(50) NOT NULL,
    file_hash VARCHAR(200) NOT NULL,
    transactions_count INTEGER DEFAULT 0,
    file_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT file_uploads_user_hash_unique UNIQUE(user_id, file_hash)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_category_rules_user_id ON category_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_category_rules_pattern ON category_rules(merchant_pattern);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_bank ON transactions(bank);
CREATE INDEX IF NOT EXISTS idx_transactions_hash ON transactions(hash) WHERE hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_file_uploads_user_date ON file_uploads(user_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_uploads ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Categories policies
CREATE POLICY "Users can view own categories" ON categories
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own categories" ON categories
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categories" ON categories
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories" ON categories
    FOR DELETE USING (auth.uid() = user_id);

-- Category rules policies
CREATE POLICY "Users can view own category rules" ON category_rules
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own category rules" ON category_rules
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own category rules" ON category_rules
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own category rules" ON category_rules
    FOR DELETE USING (auth.uid() = user_id);

-- Transactions policies
CREATE POLICY "Users can view own transactions" ON transactions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions" ON transactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions" ON transactions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own transactions" ON transactions
    FOR DELETE USING (auth.uid() = user_id);

-- File uploads policies
CREATE POLICY "Users can view own file uploads" ON file_uploads
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own file uploads" ON file_uploads
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own file uploads" ON file_uploads
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own file uploads" ON file_uploads
    FOR DELETE USING (auth.uid() = user_id);

-- Functions for auto-categorization
CREATE OR REPLACE FUNCTION auto_categorize_transaction()
RETURNS TRIGGER AS $$
BEGIN
    -- Only auto-categorize if no category is set
    IF NEW.category_id IS NULL THEN
        -- Find matching category rule
        SELECT category_id INTO NEW.category_id
        FROM category_rules
        WHERE user_id = NEW.user_id
          AND (start_date IS NULL OR start_date <= NEW.date)
          AND (end_date IS NULL OR end_date >= NEW.date)
          AND LOWER(NEW.merchant) LIKE '%' || LOWER(merchant_pattern) || '%'
        ORDER BY priority DESC, created_at DESC
        LIMIT 1;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-categorization
CREATE TRIGGER trigger_auto_categorize_transaction
    BEFORE INSERT OR UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION auto_categorize_transaction();

-- Function to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER trigger_categories_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_category_rules_updated_at
    BEFORE UPDATE ON category_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default categories for new users
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
        (NEW.id, 'Egyéb', '📌', '#6B7280')
    ON CONFLICT (user_id, name) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create default categories for new users
CREATE TRIGGER trigger_create_default_categories
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_default_categories();

-- Storage bucket for file uploads
INSERT INTO storage.buckets (id, name, public) 
VALUES ('uploads', 'uploads', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload files" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'uploads' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can view own files" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'uploads' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can delete own files" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'uploads' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );
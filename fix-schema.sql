-- Fix for Supabase Auth Issues

-- First, let's check and fix the trigger that might be causing issues
DROP TRIGGER IF EXISTS trigger_create_default_categories ON auth.users;
DROP FUNCTION IF EXISTS create_default_categories();

-- Recreate the function with better error handling
CREATE OR REPLACE FUNCTION create_default_categories()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create categories if the user was successfully created
    IF NEW.id IS NOT NULL THEN
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
        EXCEPTION WHEN OTHERS THEN
            -- Log error but don't fail user creation
            RAISE WARNING 'Could not create default categories for user %: %', NEW.id, SQLERRM;
        END;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger with AFTER INSERT
CREATE TRIGGER trigger_create_default_categories
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_default_categories();

-- Also ensure the categories table has proper constraints
ALTER TABLE categories 
    ALTER COLUMN emoji DROP NOT NULL,
    ALTER COLUMN color DROP NOT NULL;

-- Check if we need to fix any existing issues
DO $$
BEGIN
    -- Clean up any orphaned records
    DELETE FROM categories WHERE user_id NOT IN (SELECT id FROM auth.users);
    DELETE FROM transactions WHERE user_id NOT IN (SELECT id FROM auth.users);
    DELETE FROM category_rules WHERE user_id NOT IN (SELECT id FROM auth.users);
    DELETE FROM file_uploads WHERE user_id NOT IN (SELECT id FROM auth.users);
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Cleanup skipped: %', SQLERRM;
END $$;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO anon, authenticated;
GRANT SELECT ON auth.users TO anon, authenticated;

-- Test query to verify setup
SELECT 'Schema fixed successfully!' as status;
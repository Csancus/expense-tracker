-- Family/Group Management Schema Extension

-- Groups table for family/team expense sharing
CREATE TABLE IF NOT EXISTS groups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    invite_code VARCHAR(20) UNIQUE NOT NULL DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 12),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Group memberships
CREATE TABLE IF NOT EXISTS group_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    permissions JSONB DEFAULT '{"view": true, "add": true, "edit": false, "delete": false}'::jsonb,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT group_members_unique UNIQUE(group_id, user_id)
);

-- Group invitations
CREATE TABLE IF NOT EXISTS group_invitations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
    invited_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'member',
    permissions JSONB DEFAULT '{"view": true, "add": true, "edit": false, "delete": false}'::jsonb,
    invite_token VARCHAR(50) UNIQUE NOT NULL DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 20),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '7 days',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT group_invitations_unique UNIQUE(group_id, email)
);

-- Extend existing tables with group support

-- Add group_id to categories
ALTER TABLE categories ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE SET NULL;

-- Add group_id to transactions
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE SET NULL;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add group_id to category_rules
ALTER TABLE category_rules ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE SET NULL;

-- Add group_id to file_uploads
ALTER TABLE file_uploads ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE SET NULL;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_groups_owner ON groups(owner_id);
CREATE INDEX IF NOT EXISTS idx_groups_invite_code ON groups(invite_code);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_invitations_group ON group_invitations(group_id);
CREATE INDEX IF NOT EXISTS idx_group_invitations_token ON group_invitations(invite_token);
CREATE INDEX IF NOT EXISTS idx_group_invitations_email ON group_invitations(email);
CREATE INDEX IF NOT EXISTS idx_categories_group ON categories(group_id);
CREATE INDEX IF NOT EXISTS idx_transactions_group ON transactions(group_id);

-- Enable RLS for new tables
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Groups
CREATE POLICY "Users can view groups they own or are members of" ON groups
    FOR SELECT USING (
        owner_id = auth.uid() OR 
        id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can create groups" ON groups
    FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Group owners can update their groups" ON groups
    FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Group owners can delete their groups" ON groups
    FOR DELETE USING (owner_id = auth.uid());

-- RLS Policies for Group Members
CREATE POLICY "Users can view group members of their groups" ON group_members
    FOR SELECT USING (
        group_id IN (
            SELECT id FROM groups WHERE owner_id = auth.uid()
            UNION
            SELECT group_id FROM group_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Group owners can manage members" ON group_members
    FOR ALL USING (
        group_id IN (SELECT id FROM groups WHERE owner_id = auth.uid())
    );

CREATE POLICY "Users can join groups" ON group_members
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- RLS Policies for Invitations
CREATE POLICY "Users can view invitations for their groups" ON group_invitations
    FOR SELECT USING (
        group_id IN (SELECT id FROM groups WHERE owner_id = auth.uid()) OR
        email = (SELECT email FROM auth.users WHERE id = auth.uid())
    );

CREATE POLICY "Group owners can create invitations" ON group_invitations
    FOR INSERT WITH CHECK (
        group_id IN (SELECT id FROM groups WHERE owner_id = auth.uid())
    );

CREATE POLICY "Group owners can manage invitations" ON group_invitations
    FOR ALL USING (
        group_id IN (SELECT id FROM groups WHERE owner_id = auth.uid())
    );

-- Update RLS policies for existing tables to support groups

-- Categories: personal OR group member
DROP POLICY IF EXISTS "Users can view own categories" ON categories;
CREATE POLICY "Users can view own categories and group categories" ON categories
    FOR SELECT USING (
        user_id = auth.uid() OR 
        (group_id IS NOT NULL AND group_id IN (
            SELECT group_id FROM group_members WHERE user_id = auth.uid()
        ))
    );

DROP POLICY IF EXISTS "Users can insert own categories" ON categories;
CREATE POLICY "Users can insert own categories and group categories" ON categories
    FOR INSERT WITH CHECK (
        user_id = auth.uid() AND (
            group_id IS NULL OR 
            group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
        )
    );

-- Transactions: personal OR group member
DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
CREATE POLICY "Users can view own transactions and group transactions" ON transactions
    FOR SELECT USING (
        user_id = auth.uid() OR 
        (group_id IS NOT NULL AND group_id IN (
            SELECT group_id FROM group_members WHERE user_id = auth.uid()
        ))
    );

DROP POLICY IF EXISTS "Users can insert own transactions" ON transactions;
CREATE POLICY "Users can insert own transactions and group transactions" ON transactions
    FOR INSERT WITH CHECK (
        user_id = auth.uid() AND (
            group_id IS NULL OR 
            group_id IN (
                SELECT group_id FROM group_members 
                WHERE user_id = auth.uid() 
                AND (permissions->>'add')::boolean = true
            )
        )
    );

-- Functions for group management

-- Function to accept invitation
CREATE OR REPLACE FUNCTION accept_group_invitation(invitation_token TEXT)
RETURNS JSONB AS $$
DECLARE
    invitation_record group_invitations%ROWTYPE;
    user_email TEXT;
BEGIN
    -- Get current user email
    SELECT email INTO user_email FROM auth.users WHERE id = auth.uid();
    
    -- Find valid invitation
    SELECT * INTO invitation_record
    FROM group_invitations
    WHERE invite_token = invitation_token
      AND email = user_email
      AND status = 'pending'
      AND expires_at > NOW();
    
    IF NOT FOUND THEN
        RETURN '{"success": false, "error": "Invalid or expired invitation"}'::jsonb;
    END IF;
    
    -- Add user to group
    INSERT INTO group_members (group_id, user_id, role, permissions)
    VALUES (invitation_record.group_id, auth.uid(), invitation_record.role, invitation_record.permissions)
    ON CONFLICT (group_id, user_id) DO NOTHING;
    
    -- Mark invitation as accepted
    UPDATE group_invitations
    SET status = 'accepted'
    WHERE id = invitation_record.id;
    
    RETURN json_build_object(
        'success', true,
        'group_id', invitation_record.group_id,
        'role', invitation_record.role
    )::jsonb;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's groups
CREATE OR REPLACE FUNCTION get_user_groups()
RETURNS TABLE(
    group_id UUID,
    group_name TEXT,
    role TEXT,
    is_owner BOOLEAN,
    member_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        g.id as group_id,
        g.name as group_name,
        COALESCE(gm.role, 'owner') as role,
        (g.owner_id = auth.uid()) as is_owner,
        (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) + 1 as member_count
    FROM groups g
    LEFT JOIN group_members gm ON g.id = gm.group_id AND gm.user_id = auth.uid()
    WHERE g.owner_id = auth.uid() OR gm.user_id = auth.uid()
    ORDER BY g.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create default family group for new users
CREATE OR REPLACE FUNCTION create_default_family_group()
RETURNS TRIGGER AS $$
BEGIN
    -- Create a personal "family" group for the new user
    INSERT INTO groups (name, description, owner_id)
    VALUES (
        'My Family',
        'Personal family expense tracking group',
        NEW.id
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create default family group
CREATE TRIGGER trigger_create_default_family_group
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_default_family_group();

-- Summary
SELECT 'Family/Group system schema created successfully!' as status;
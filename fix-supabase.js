#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Use service role key for admin operations
const SUPABASE_URL = 'https://pdmaznyyartrstliewke.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_AyIWASttrc9iPaYIPP6Pxw_MC-xJpDo';

async function fixSupabase() {
    console.log('🔧 Fixing Supabase setup...\n');
    
    // Create admin client with service role key
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
    
    try {
        // 1. Create user with admin API
        console.log('1️⃣ Creating user czarth95@gmail.com...');
        
        const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
            email: 'czarth95@gmail.com',
            password: 'asd123456',  // Using longer password
            email_confirm: true,  // Auto-confirm email
            user_metadata: {
                name: 'Czarth'
            }
        });
        
        if (userError) {
            console.log('❌ User creation error:', userError.message);
            
            // If user exists, try to update password
            if (userError.message.includes('already been registered')) {
                console.log('   User exists, updating password...');
                
                // Get user first
                const { data: users } = await supabaseAdmin.auth.admin.listUsers();
                const existingUser = users?.users?.find(u => u.email === 'czarth95@gmail.com');
                
                if (existingUser) {
                    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
                        existingUser.id,
                        { 
                            password: 'asd123456',
                            email_confirm: true
                        }
                    );
                    
                    if (updateError) {
                        console.log('❌ Password update failed:', updateError.message);
                    } else {
                        console.log('✅ Password updated successfully!');
                    }
                }
            }
        } else {
            console.log('✅ User created successfully!');
            console.log('   ID:', userData.user.id);
            console.log('   Email confirmed:', userData.user.email_confirmed_at ? 'Yes' : 'No');
        }
        
        // 2. Test login with regular client
        console.log('\n2️⃣ Testing login...');
        const supabaseClient = createClient(SUPABASE_URL, 
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkbWF6bnl5YXJ0cnN0bGlld2tlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0NDUzMDAsImV4cCI6MjA3OTAyMTMwMH0.lRR78pV6NPSZa-pDrqOUPFK7gPBfWb6DqMAZKwNmX-A'
        );
        
        const { data: loginData, error: loginError } = await supabaseClient.auth.signInWithPassword({
            email: 'czarth95@gmail.com',
            password: 'asd123456'
        });
        
        if (loginError) {
            console.log('❌ Login failed:', loginError.message);
        } else {
            console.log('✅ Login successful!');
            console.log('   Session created:', loginData.session ? 'Yes' : 'No');
            console.log('   Access token:', loginData.session?.access_token?.substring(0, 20) + '...');
        }
        
        // 3. Create default categories for the user
        if (userData?.user?.id || loginData?.user?.id) {
            const userId = userData?.user?.id || loginData?.user?.id;
            console.log('\n3️⃣ Creating default categories...');
            
            const defaultCategories = [
                { user_id: userId, name: 'Élelmiszer', emoji: '🍔', color: '#EF4444' },
                { user_id: userId, name: 'Közlekedés', emoji: '🚗', color: '#F59E0B' },
                { user_id: userId, name: 'Rezsi', emoji: '🏠', color: '#10B981' },
                { user_id: userId, name: 'Vásárlás', emoji: '🛍️', color: '#3B82F6' },
                { user_id: userId, name: 'Szórakozás', emoji: '🎬', color: '#8B5CF6' },
                { user_id: userId, name: 'Egészség', emoji: '🏥', color: '#EC4899' },
                { user_id: userId, name: 'Egyéb', emoji: '📌', color: '#6B7280' }
            ];
            
            for (const cat of defaultCategories) {
                const { error } = await supabaseAdmin
                    .from('categories')
                    .upsert(cat, { onConflict: 'user_id,name' });
                    
                if (error && !error.message.includes('duplicate')) {
                    console.log(`   ❌ Failed to create ${cat.name}:`, error.message);
                } else {
                    console.log(`   ✅ Created ${cat.name}`);
                }
            }
        }
        
        // 4. Summary
        console.log('\n' + '='.repeat(50));
        console.log('✅ SETUP COMPLETE!');
        console.log('='.repeat(50));
        console.log('\n📝 Login credentials:');
        console.log('   Email: czarth95@gmail.com');
        console.log('   Password: asd123456');
        console.log('\n🔗 Test here:');
        console.log('   Local: http://localhost:8080/test-auth.html');
        console.log('   Live: https://csancus.github.io/expense-tracker/');
        console.log('\n✅ You should now be able to login!');
        
    } catch (error) {
        console.error('❌ Unexpected error:', error);
    }
}

// Run the fix
fixSupabase();
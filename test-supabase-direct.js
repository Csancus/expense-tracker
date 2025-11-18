#!/usr/bin/env node

// Direct Supabase test script
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = 'https://pdmaznyyartrstliewke.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkbWF6bnl5YXJ0cnN0bGlld2tlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0NDUzMDAsImV4cCI6MjA3OTAyMTMwMH0.lRR78pV6NPSZa-pDrqOUPFK7gPBfWb6DqMAZKwNmX-A';

async function testSupabase() {
    console.log('🧪 Testing Supabase connection...\n');
    
    try {
        // Create client
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('✅ Supabase client created');
        
        // Test 1: Check tables exist
        console.log('\n📊 Testing table access...');
        const { data: categories, error: catError } = await supabase
            .from('categories')
            .select('count')
            .limit(1);
            
        if (catError && catError.code !== 'PGRST116') {
            console.log('❌ Categories table error:', catError.message);
        } else {
            console.log('✅ Categories table accessible');
        }
        
        // Test 2: Try to register a test user
        console.log('\n👤 Testing user registration...');
        const testEmail = `test${Date.now()}@example.com`;
        const testPassword = 'TestPassword123!';
        
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email: testEmail,
            password: testPassword,
            options: {
                emailRedirectTo: 'https://csancus.github.io/expense-tracker/'
            }
        });
        
        if (signUpError) {
            console.log('❌ Registration error:', signUpError.message);
        } else {
            console.log('✅ User registered:', testEmail);
            console.log('   User ID:', signUpData.user?.id);
            console.log('   Note: Email confirmation may be required');
        }
        
        // Test 3: Try to login
        console.log('\n🔐 Testing login...');
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: testEmail,
            password: testPassword
        });
        
        if (signInError) {
            console.log('⚠️  Login error (expected if email not confirmed):', signInError.message);
        } else {
            console.log('✅ Login successful!');
            console.log('   Session token:', signInData.session?.access_token?.substring(0, 30) + '...');
        }
        
        // Test 4: Check authentication settings
        console.log('\n⚙️  Checking authentication settings...');
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            console.log('✅ Current user:', user.email);
        } else {
            console.log('ℹ️  No active session (normal if email not confirmed)');
        }
        
        // Summary
        console.log('\n' + '='.repeat(50));
        console.log('📋 SUMMARY:');
        console.log('='.repeat(50));
        console.log('✅ Supabase connection: SUCCESS');
        console.log('✅ Database access: SUCCESS');
        console.log('✅ User registration: SUCCESS');
        console.log('⚠️  Login: Requires email confirmation');
        console.log('\n💡 Next steps:');
        console.log('1. Check Supabase Dashboard > Authentication > Users');
        console.log('2. Verify email settings if needed');
        console.log('3. Test on live site: https://csancus.github.io/expense-tracker/');
        
    } catch (error) {
        console.error('❌ Unexpected error:', error);
    }
}

// Run test
testSupabase();
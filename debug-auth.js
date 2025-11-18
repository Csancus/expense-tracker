#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = 'https://pdmaznyyartrstliewke.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkbWF6bnl5YXJ0cnN0bGlld2tlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0NDUzMDAsImV4cCI6MjA3OTAyMTMwMH0.lRR78pV6NPSZa-pDrqOUPFK7gPBfWb6DqMAZKwNmX-A';

async function debugAuth() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    console.log('🔍 Debugging czarth95@gmail.com authentication...\n');
    
    // 1. Try to register
    console.log('1️⃣ Attempting registration...');
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: 'czarth95@gmail.com',
        password: 'asd123',
        options: {
            emailRedirectTo: 'https://csancus.github.io/expense-tracker/'
        }
    });
    
    if (signUpError) {
        console.log('❌ Registration error:', signUpError.message);
        console.log('   Error code:', signUpError.code);
        console.log('   Status:', signUpError.status);
    } else {
        console.log('✅ Registration response:');
        console.log('   User:', signUpData.user?.email);
        console.log('   ID:', signUpData.user?.id);
        console.log('   Confirmed:', signUpData.user?.confirmed_at);
        console.log('   Session:', signUpData.session ? 'Created' : 'None (email confirmation required)');
    }
    
    // 2. Try to login
    console.log('\n2️⃣ Attempting login...');
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: 'czarth95@gmail.com',
        password: 'asd123'
    });
    
    if (signInError) {
        console.log('❌ Login error:', signInError.message);
        console.log('   Error code:', signInError.code);
        console.log('   Status:', signInError.status);
        
        // Check if it's password policy issue
        if (signInError.message.includes('password')) {
            console.log('\n⚠️  Password issue detected!');
            console.log('   Supabase requires minimum 6 characters for passwords');
            console.log('   "asd123" is exactly 6 characters - should work');
        }
        
        // Check if email not confirmed
        if (signInError.message.includes('Email not confirmed')) {
            console.log('\n⚠️  Email confirmation required!');
            console.log('   Check your email: czarth95@gmail.com');
            console.log('   Or disable email confirmation in Supabase Dashboard');
        }
    } else {
        console.log('✅ Login successful!');
        console.log('   User:', signInData.user?.email);
        console.log('   Session:', signInData.session?.access_token?.substring(0, 20) + '...');
    }
    
    // 3. Check auth settings
    console.log('\n3️⃣ Checking auth configuration...');
    const { data: settings, error: settingsError } = await supabase
        .from('auth.config')
        .select('*')
        .single();
    
    if (settingsError) {
        console.log('ℹ️  Cannot access auth config (normal for anon key)');
    } else {
        console.log('Auth settings:', settings);
    }
    
    // 4. Try with stronger password
    console.log('\n4️⃣ Testing with stronger password (asd123456)...');
    const { data: signUp2Data, error: signUp2Error } = await supabase.auth.signUp({
        email: 'czarth95+test@gmail.com',
        password: 'asd123456',
        options: {
            emailRedirectTo: 'https://csancus.github.io/expense-tracker/'
        }
    });
    
    if (signUp2Error) {
        console.log('❌ Registration error:', signUp2Error.message);
    } else {
        console.log('✅ Registration successful with longer password');
        
        // Try immediate login
        const { data: testLogin, error: testLoginError } = await supabase.auth.signInWithPassword({
            email: 'czarth95+test@gmail.com',
            password: 'asd123456'
        });
        
        if (testLoginError) {
            console.log('   Login result:', testLoginError.message);
        } else {
            console.log('   ✅ Immediate login worked!');
        }
    }
    
    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 DIAGNOSIS:');
    console.log('='.repeat(50));
    
    if (signUpError?.message?.includes('User already registered')) {
        console.log('• User already exists - try login or password reset');
    }
    
    if (signInError?.message?.includes('Invalid login credentials')) {
        console.log('• Wrong password or email not confirmed');
    }
    
    if (signInError?.message?.includes('Email not confirmed')) {
        console.log('• Email confirmation required - check inbox');
    }
    
    console.log('\n💡 SOLUTIONS:');
    console.log('1. Check email for confirmation link');
    console.log('2. Try password reset: https://pdmaznyyartrstliewke.supabase.co/auth/v1/recover');
    console.log('3. Or disable email confirmation:');
    console.log('   Supabase Dashboard > Authentication > Settings > Email Auth > Confirm email = OFF');
    console.log('4. Try with minimum 6 character password');
}

debugAuth().catch(console.error);
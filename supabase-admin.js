#!/usr/bin/env node

// Supabase Admin SDK for terminal operations
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

class SupabaseAdmin {
    constructor() {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
        
        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error('Missing Supabase credentials in .env file');
        }
        
        // Service role client - bypasses RLS for admin operations
        this.supabase = createClient(supabaseUrl, supabaseServiceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });
    }

    // Direct database operations (removed - not available in free tier)

    // Categories
    async listCategories(userId) {
        const { data, error } = await this.supabase
            .from('categories')
            .select('*')
            .eq('user_id', userId)
            .order('name');
            
        if (error) throw error;
        return data;
    }

    async createCategory(userId, category) {
        const { data, error } = await this.supabase
            .from('categories')
            .insert({
                user_id: userId,
                name: category.name,
                emoji: category.emoji,
                color: category.color
            })
            .select()
            .single();
            
        if (error) throw error;
        return data;
    }

    // Transactions
    async listTransactions(userId, limit = 100) {
        const { data, error } = await this.supabase
            .from('transactions')
            .select(`
                *,
                categories (
                    name,
                    emoji,
                    color
                )
            `)
            .eq('user_id', userId)
            .order('date', { ascending: false })
            .limit(limit);
            
        if (error) throw error;
        return data;
    }

    async createTransaction(userId, transaction) {
        const { data, error } = await this.supabase
            .from('transactions')
            .insert({
                user_id: userId,
                date: transaction.date,
                merchant: transaction.merchant,
                description: transaction.description,
                amount: transaction.amount,
                category_id: transaction.category_id,
                bank: transaction.bank
            })
            .select()
            .single();
            
        if (error) throw error;
        return data;
    }

    async bulkCreateTransactions(userId, transactions) {
        const transactionsWithUser = transactions.map(t => ({
            ...t,
            user_id: userId
        }));
        
        const { data, error } = await this.supabase
            .from('transactions')
            .insert(transactionsWithUser)
            .select();
            
        if (error) throw error;
        return data;
    }

    // Category Rules
    async createCategoryRule(userId, rule) {
        const { data, error } = await this.supabase
            .from('category_rules')
            .insert({
                user_id: userId,
                category_id: rule.category_id,
                merchant_pattern: rule.merchant_pattern,
                start_date: rule.start_date,
                end_date: rule.end_date,
                priority: rule.priority || 0
            })
            .select()
            .single();
            
        if (error) throw error;
        return data;
    }

    // Users - using auth admin API
    async listUsers() {
        const { data, error } = await this.supabase.auth.admin.listUsers();
            
        if (error) throw error;
        return data.users.map(u => ({
            id: u.id,
            email: u.email,
            created_at: u.created_at
        }));
    }

    async createUser(email, password) {
        const { data, error } = await this.supabase.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true
        });
        
        if (error) throw error;
        return data.user;
    }

    // Analytics
    async getStatistics(userId) {
        const { data: transactions, error } = await this.supabase
            .from('transactions')
            .select('amount, date, category_id')
            .eq('user_id', userId);
            
        if (error) throw error;
        
        const stats = {
            total_transactions: transactions.length,
            total_amount: transactions.reduce((sum, t) => sum + parseFloat(t.amount), 0),
            income: transactions.filter(t => t.amount > 0).reduce((sum, t) => sum + parseFloat(t.amount), 0),
            expenses: transactions.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0),
            by_month: {},
            by_category: {}
        };
        
        // Group by month
        transactions.forEach(t => {
            const month = t.date.substring(0, 7);
            if (!stats.by_month[month]) {
                stats.by_month[month] = { income: 0, expenses: 0 };
            }
            if (t.amount > 0) {
                stats.by_month[month].income += parseFloat(t.amount);
            } else {
                stats.by_month[month].expenses += Math.abs(parseFloat(t.amount));
            }
        });
        
        return stats;
    }

    // Database management
    async resetDatabase() {
        console.log('⚠️  Resetting database...');
        
        // Delete all data (CASCADE will handle dependencies)
        await this.supabase.from('transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await this.supabase.from('category_rules').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await this.supabase.from('categories').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await this.supabase.from('file_uploads').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        console.log('✅ Database reset complete');
    }

    // Seed data for testing
    async seedTestData(userId) {
        console.log('🌱 Seeding test data...');
        
        // Create categories
        const categories = [
            { name: 'Élelmiszer', emoji: '🍔', color: '#EF4444' },
            { name: 'Közlekedés', emoji: '🚗', color: '#F59E0B' },
            { name: 'Rezsi', emoji: '🏠', color: '#10B981' },
            { name: 'Vásárlás', emoji: '🛍️', color: '#3B82F6' }
        ];
        
        const createdCategories = [];
        for (const cat of categories) {
            const created = await this.createCategory(userId, cat);
            createdCategories.push(created);
        }
        
        // Create sample transactions
        const transactions = [
            {
                date: '2024-01-15',
                merchant: 'Tesco',
                description: 'Heti bevásárlás',
                amount: -25000,
                category_id: createdCategories[0].id,
                bank: 'OTP'
            },
            {
                date: '2024-01-16',
                merchant: 'MOL',
                description: 'Tankolás',
                amount: -15000,
                category_id: createdCategories[1].id,
                bank: 'OTP'
            },
            {
                date: '2024-01-17',
                merchant: 'MVM',
                description: 'Villany számla',
                amount: -12000,
                category_id: createdCategories[2].id,
                bank: 'OTP'
            },
            {
                date: '2024-01-01',
                merchant: 'Munkáltató',
                description: 'Fizetés',
                amount: 450000,
                category_id: null,
                bank: 'OTP'
            }
        ];
        
        await this.bulkCreateTransactions(userId, transactions);
        
        console.log('✅ Test data seeded successfully');
        return {
            categories: createdCategories,
            transactions: transactions.length
        };
    }
}

// Export for use in other scripts
module.exports = SupabaseAdmin;

// CLI interface
if (require.main === module) {
    const admin = new SupabaseAdmin();
    const command = process.argv[2];
    const args = process.argv.slice(3);
    
    async function run() {
        try {
            switch (command) {
                case 'users':
                    const users = await admin.listUsers();
                    console.table(users);
                    break;
                    
                case 'categories':
                    if (!args[0]) {
                        console.error('Usage: node supabase-admin.js categories <user_id>');
                        process.exit(1);
                    }
                    const categories = await admin.listCategories(args[0]);
                    console.table(categories);
                    break;
                    
                case 'transactions':
                    if (!args[0]) {
                        console.error('Usage: node supabase-admin.js transactions <user_id> [limit]');
                        process.exit(1);
                    }
                    const limit = args[1] ? parseInt(args[1]) : 100;
                    const transactions = await admin.listTransactions(args[0], limit);
                    console.table(transactions);
                    break;
                    
                case 'stats':
                    if (!args[0]) {
                        console.error('Usage: node supabase-admin.js stats <user_id>');
                        process.exit(1);
                    }
                    const stats = await admin.getStatistics(args[0]);
                    console.log('📊 Statistics:', stats);
                    break;
                    
                case 'seed':
                    if (!args[0]) {
                        console.error('Usage: node supabase-admin.js seed <user_id>');
                        process.exit(1);
                    }
                    const result = await admin.seedTestData(args[0]);
                    console.log('✅ Seeded:', result);
                    break;
                    
                case 'reset':
                    console.log('⚠️  WARNING: This will delete all data!');
                    console.log('Press Ctrl+C to cancel, or wait 3 seconds...');
                    setTimeout(async () => {
                        await admin.resetDatabase();
                    }, 3000);
                    break;
                    
                default:
                    console.log(`
Supabase Admin CLI

Commands:
  users                    - List all users
  categories <user_id>     - List categories for a user
  transactions <user_id>   - List transactions for a user
  stats <user_id>          - Show statistics for a user
  seed <user_id>           - Seed test data for a user
  reset                    - Reset entire database (DANGER!)

Example:
  node supabase-admin.js users
  node supabase-admin.js transactions abc-123-def
`);
            }
        } catch (error) {
            console.error('Error:', error.message);
            process.exit(1);
        }
    }
    
    run();
}
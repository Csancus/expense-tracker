// Supabase Client for Expense Tracker
class SupabaseClient {
    constructor() {
        this.supabase = null;
        this.user = null;
        this.isInitialized = false;
        this.isOffline = false;
    }

    async init(supabaseUrl, supabaseKey) {
        try {
            // Check if Supabase is loaded
            if (typeof window.supabase === 'undefined') {
                throw new Error('Supabase client not loaded');
            }

            // Initialize Supabase client
            this.supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
            
            // Check current session
            const { data: { session } } = await this.supabase.auth.getSession();
            if (session) {
                this.user = session.user;
            }

            // Listen to auth changes
            this.supabase.auth.onAuthStateChange((event, session) => {
                if (session) {
                    this.user = session.user;
                    window.dispatchEvent(new CustomEvent('authStateChanged', { 
                        detail: { user: this.user, event } 
                    }));
                } else {
                    this.user = null;
                    window.dispatchEvent(new CustomEvent('authStateChanged', { 
                        detail: { user: null, event } 
                    }));
                }
            });

            this.isInitialized = true;
            return true;
        } catch (error) {
            console.error('Supabase initialization failed:', error);
            this.isOffline = true;
            return false;
        }
    }

    // Authentication methods
    async signUp(email, password) {
        const { data, error } = await this.supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: window.location.origin
            }
        });
        
        if (error) throw error;
        return data;
    }

    async signIn(email, password) {
        const { data, error } = await this.supabase.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) throw error;
        return data;
    }

    async signInWithGoogle() {
        const { data, error } = await this.supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin
            }
        });
        
        if (error) throw error;
        return data;
    }

    async signOut() {
        const { error } = await this.supabase.auth.signOut();
        if (error) throw error;
    }

    // Categories CRUD
    async getCategories() {
        if (!this.user) throw new Error('Not authenticated');
        
        const { data, error } = await this.supabase
            .from('categories')
            .select('*')
            .eq('user_id', this.user.id)
            .order('name');
            
        if (error) throw error;
        return data || [];
    }

    async createCategory(category) {
        if (!this.user) throw new Error('Not authenticated');
        
        const { data, error } = await this.supabase
            .from('categories')
            .insert({
                ...category,
                user_id: this.user.id
            })
            .select()
            .single();
            
        if (error) throw error;
        return data;
    }

    async updateCategory(id, updates) {
        if (!this.user) throw new Error('Not authenticated');
        
        const { data, error } = await this.supabase
            .from('categories')
            .update(updates)
            .eq('id', id)
            .eq('user_id', this.user.id)
            .select()
            .single();
            
        if (error) throw error;
        return data;
    }

    async deleteCategory(id) {
        if (!this.user) throw new Error('Not authenticated');
        
        const { error } = await this.supabase
            .from('categories')
            .delete()
            .eq('id', id)
            .eq('user_id', this.user.id);
            
        if (error) throw error;
    }

    // Transactions CRUD
    async getTransactions(limit = 100, offset = 0) {
        if (!this.user) throw new Error('Not authenticated');
        
        const { data, error } = await this.supabase
            .from('transactions')
            .select(`
                *,
                categories (
                    id,
                    name,
                    emoji,
                    color
                )
            `)
            .eq('user_id', this.user.id)
            .order('date', { ascending: false })
            .range(offset, offset + limit - 1);
            
        if (error) throw error;
        return data || [];
    }

    async createTransaction(transaction, groupId = null) {
        if (!this.user) throw new Error('Not authenticated');
        
        const { data, error } = await this.supabase
            .from('transactions')
            .insert({
                ...transaction,
                user_id: this.user.id,
                group_id: groupId,
                added_by: this.user.id
            })
            .select()
            .single();
            
        if (error) throw error;
        return data;
    }

    async createTransactions(transactions, groupId = null) {
        if (!this.user) throw new Error('Not authenticated');
        
        const transactionsWithUser = transactions.map(t => ({
            ...t,
            user_id: this.user.id,
            group_id: groupId,
            added_by: this.user.id
        }));
        
        const { data, error } = await this.supabase
            .from('transactions')
            .insert(transactionsWithUser)
            .select();
            
        if (error) throw error;
        return data || [];
    }

    async updateTransaction(id, updates) {
        if (!this.user) throw new Error('Not authenticated');
        
        const { data, error } = await this.supabase
            .from('transactions')
            .update(updates)
            .eq('id', id)
            .eq('user_id', this.user.id)
            .select()
            .single();
            
        if (error) throw error;
        return data;
    }

    async deleteTransaction(id) {
        if (!this.user) throw new Error('Not authenticated');
        
        const { error } = await this.supabase
            .from('transactions')
            .delete()
            .eq('id', id)
            .eq('user_id', this.user.id);
            
        if (error) throw error;
    }

    // Category Rules CRUD
    async getCategoryRules() {
        if (!this.user) throw new Error('Not authenticated');
        
        const { data, error } = await this.supabase
            .from('category_rules')
            .select(`
                *,
                categories (
                    id,
                    name,
                    emoji,
                    color
                )
            `)
            .eq('user_id', this.user.id)
            .order('priority', { ascending: false });
            
        if (error) throw error;
        return data || [];
    }

    async createCategoryRule(rule) {
        if (!this.user) throw new Error('Not authenticated');
        
        const { data, error } = await this.supabase
            .from('category_rules')
            .insert({
                ...rule,
                user_id: this.user.id
            })
            .select()
            .single();
            
        if (error) throw error;
        return data;
    }

    async updateCategoryRule(id, updates) {
        if (!this.user) throw new Error('Not authenticated');
        
        const { data, error } = await this.supabase
            .from('category_rules')
            .update(updates)
            .eq('id', id)
            .eq('user_id', this.user.id)
            .select()
            .single();
            
        if (error) throw error;
        return data;
    }

    async deleteCategoryRule(id) {
        if (!this.user) throw new Error('Not authenticated');
        
        const { error } = await this.supabase
            .from('category_rules')
            .delete()
            .eq('id', id)
            .eq('user_id', this.user.id);
            
        if (error) throw error;
    }

    // File Uploads
    async uploadFile(file, bucketName = 'uploads') {
        if (!this.user) throw new Error('Not authenticated');
        
        const fileName = `${this.user.id}/${Date.now()}_${file.name}`;
        
        const { data, error } = await this.supabase.storage
            .from(bucketName)
            .upload(fileName, file);
            
        if (error) throw error;
        return data;
    }

    // Sync local data to Supabase
    async syncLocalData(localCategories, localTransactions, localRules) {
        if (!this.user) return;
        
        try {
            console.log('Syncing local data to Supabase...');
            
            // Sync categories first
            if (localCategories && localCategories.length > 0) {
                for (const category of localCategories) {
                    try {
                        await this.createCategory({
                            name: category.name,
                            emoji: category.emoji,
                            color: category.color
                        });
                    } catch (error) {
                        // Skip duplicates
                        if (!error.message.includes('duplicate')) {
                            console.error('Category sync failed:', error);
                        }
                    }
                }
            }
            
            // Get categories to map local IDs to Supabase IDs
            const categories = await this.getCategories();
            const categoryMap = {};
            categories.forEach(cat => {
                categoryMap[cat.name] = cat.id;
            });
            
            // Sync transactions
            if (localTransactions && localTransactions.length > 0) {
                const transactionsToSync = localTransactions.map(t => ({
                    date: t.date,
                    merchant: t.merchant,
                    description: t.description,
                    amount: t.amount,
                    category_id: t.category ? categoryMap[t.category] : null,
                    bank: t.bank,
                    reference: t.reference,
                    memo: t.memo,
                    hash: t.hash
                })).filter(t => t.date && t.merchant && t.amount !== undefined);
                
                if (transactionsToSync.length > 0) {
                    try {
                        await this.createTransactions(transactionsToSync);
                    } catch (error) {
                        console.error('Transaction sync failed:', error);
                    }
                }
            }
            
            // Sync category rules
            if (localRules && localRules.length > 0) {
                for (const rule of localRules) {
                    try {
                        await this.createCategoryRule({
                            merchant_pattern: rule.pattern,
                            category_id: categoryMap[rule.category],
                            start_date: rule.startDate,
                            end_date: rule.endDate,
                            priority: rule.priority || 0
                        });
                    } catch (error) {
                        console.error('Rule sync failed:', error);
                    }
                }
            }
            
            console.log('Data sync completed');
        } catch (error) {
            console.error('Sync failed:', error);
        }
    }

    // Utility methods
    isAuthenticated() {
        return this.user !== null;
    }

    getCurrentUser() {
        return this.user;
    }

    getSupabaseClient() {
        return this.supabase;
    }

    // Group-based data loading
    async loadGroupTransactions(groupId = null) {
        if (!this.user) return [];
        
        try {
            let query = this.supabase
                .from('transactions')
                .select('*')
                .order('date', { ascending: false });
                
            if (groupId) {
                // Load group transactions
                query = query.eq('group_id', groupId);
            } else {
                // Load personal transactions (no group)
                query = query.eq('user_id', this.user.id).is('group_id', null);
            }
            
            const { data, error } = await query;
            
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Failed to load group transactions:', error);
            return [];
        }
    }

    async loadGroupCategories(groupId = null) {
        if (!this.user) return [];
        
        try {
            let query = this.supabase
                .from('categories')
                .select('*')
                .order('name');
                
            if (groupId) {
                // Load group categories
                query = query.eq('group_id', groupId);
            } else {
                // Load personal categories (no group)
                query = query.eq('user_id', this.user.id).is('group_id', null);
            }
            
            const { data, error } = await query;
            
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Failed to load group categories:', error);
            return [];
        }
    }
}

// Export for use
if (typeof window !== 'undefined') {
    window.SupabaseClient = SupabaseClient;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SupabaseClient };
}
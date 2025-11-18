// PocketBase Authentication & Database Integration
class ExpenseAuth {
    constructor() {
        this.pb = null;
        this.user = null;
        this.isInitialized = false;
        this.isOffline = false;
        
        // Initialize when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    async init() {
        // Check if PocketBase is available (CDN loaded)
        if (typeof window.PocketBase === 'undefined') {
            console.log('PocketBase not loaded, using offline mode');
            this.isOffline = true;
            this.setupOfflineMode();
            return;
        }

        try {
            // Initialize PocketBase client
            const POCKETBASE_URL = 'https://your-app.railway.app';
            
            // Use environment variables if available, fallback to demo mode
            const pocketbaseUrl = this.getEnvVar('POCKETBASE_URL') || POCKETBASE_URL;
            
            if (pocketbaseUrl.includes('your-app')) {
                console.log('PocketBase not configured, using offline mode');
                this.isOffline = true;
                this.setupOfflineMode();
                return;
            }

            this.pb = new window.PocketBase(pocketbaseUrl);
            
            // Check if user is already authenticated
            if (this.pb.authStore.isValid) {
                this.user = this.pb.authStore.model;
                this.showApp();
            } else {
                this.showAuth();
            }

            // Subscribe to auth changes
            this.pb.authStore.onChange(() => {
                if (this.pb.authStore.isValid) {
                    this.user = this.pb.authStore.model;
                    this.showApp();
                    this.syncDataToCloud();
                } else {
                    this.user = null;
                    this.showAuth();
                }
            });

            this.isInitialized = true;
            
        } catch (error) {
            console.error('PocketBase initialization failed:', error);
            this.isOffline = true;
            this.setupOfflineMode();
        }
    }

    getEnvVar(name) {
        // Try different ways to get environment variables
        if (typeof process !== 'undefined' && process.env) {
            return process.env[name];
        }
        
        // Check for meta tags
        const metaTag = document.querySelector(`meta[name="${name}"]`);
        if (metaTag) {
            return metaTag.content;
        }
        
        // Check for global variables
        if (window[name]) {
            return window[name];
        }
        
        return null;
    }

    setupOfflineMode() {
        console.log('🔧 Running in offline mode with localStorage');
        this.showApp();
        this.showOfflineBanner();
    }

    showOfflineBanner() {
        const banner = document.createElement('div');
        banner.className = 'offline-banner';
        banner.innerHTML = `
            <div class="offline-content">
                <span>📱 Offline Mode - Az adatok csak helyileg tárolódnak</span>
                <button onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        document.body.prepend(banner);

        // Add CSS for offline banner
        const style = document.createElement('style');
        style.textContent = `
            .offline-banner {
                background: #F59E0B;
                color: white;
                padding: 0.75rem;
                text-align: center;
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                z-index: 1001;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .offline-content {
                display: flex;
                justify-content: center;
                align-items: center;
                gap: 1rem;
                max-width: 1200px;
                margin: 0 auto;
            }
            .offline-content button {
                background: none;
                border: none;
                color: white;
                font-size: 1.2rem;
                cursor: pointer;
                padding: 0.25rem;
            }
            body.has-offline-banner .app {
                margin-top: 3rem;
            }
        `;
        document.head.appendChild(style);
        document.body.classList.add('has-offline-banner');
    }

    // PocketBase doesn't need this method as it uses onChange instead

    showAuth() {
        const app = document.querySelector('.app');
        if (app) {
            app.style.display = 'none';
        }

        // Remove existing auth UI
        const existingAuth = document.querySelector('.auth-container');
        if (existingAuth) {
            existingAuth.remove();
        }

        // Create auth UI
        const authContainer = document.createElement('div');
        authContainer.className = 'auth-container';
        authContainer.innerHTML = this.getAuthHTML();
        document.body.appendChild(authContainer);

        // Add auth event listeners
        this.setupAuthListeners();
    }

    showApp() {
        const app = document.querySelector('.app');
        const authContainer = document.querySelector('.auth-container');
        
        if (authContainer) {
            authContainer.remove();
        }
        
        if (app) {
            app.style.display = 'flex';
        }

        // Show user info if logged in
        if (this.user && !this.isOffline) {
            this.showUserInfo();
        }
    }

    getAuthHTML() {
        return `
            <div class="auth-wrapper">
                <div class="auth-card">
                    <div class="auth-header">
                        <h1>💰 Expense Tracker</h1>
                        <p>Jelentkezzen be a folytatáshoz</p>
                    </div>

                    <div class="auth-tabs">
                        <button class="auth-tab active" data-tab="signin">Bejelentkezés</button>
                        <button class="auth-tab" data-tab="signup">Regisztráció</button>
                    </div>

                    <form class="auth-form" id="signinForm">
                        <div class="form-group">
                            <label>Email cím:</label>
                            <input type="email" id="signinEmail" required>
                        </div>
                        <div class="form-group">
                            <label>Jelszó:</label>
                            <input type="password" id="signinPassword" required>
                        </div>
                        <button type="submit" class="btn btn-primary">Bejelentkezés</button>
                    </form>

                    <form class="auth-form" id="signupForm" style="display: none;">
                        <div class="form-group">
                            <label>Email cím:</label>
                            <input type="email" id="signupEmail" required>
                        </div>
                        <div class="form-group">
                            <label>Jelszó:</label>
                            <input type="password" id="signupPassword" required>
                        </div>
                        <div class="form-group">
                            <label>Jelszó megerősítése:</label>
                            <input type="password" id="signupPasswordConfirm" required>
                        </div>
                        <button type="submit" class="btn btn-primary">Regisztráció</button>
                    </form>

                    <div class="auth-divider">vagy</div>

                    <button class="btn btn-google" id="googleSignIn">
                        🔍 Google fiókkal
                    </button>

                    <div class="auth-demo">
                        <p>Vagy próbálja ki demo módban:</p>
                        <button class="btn btn-secondary" id="demoMode">📱 Demo mód (offline)</button>
                    </div>

                    <div class="auth-error" id="authError" style="display: none;"></div>
                </div>
            </div>
        `;
    }

    setupAuthListeners() {
        // Tab switching
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                this.switchAuthTab(tabName);
            });
        });

        // Sign in form
        document.getElementById('signinForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.signIn();
        });

        // Sign up form
        document.getElementById('signupForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.signUp();
        });

        // Google sign in
        document.getElementById('googleSignIn').addEventListener('click', async () => {
            await this.signInWithGoogle();
        });

        // Demo mode
        document.getElementById('demoMode').addEventListener('click', () => {
            this.startDemoMode();
        });
    }

    switchAuthTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        // Update forms
        document.getElementById('signinForm').style.display = tabName === 'signin' ? 'block' : 'none';
        document.getElementById('signupForm').style.display = tabName === 'signup' ? 'block' : 'none';

        // Clear errors
        this.hideAuthError();
    }

    async signIn() {
        if (this.isOffline) return this.startDemoMode();

        const email = document.getElementById('signinEmail').value;
        const password = document.getElementById('signinPassword').value;

        try {
            await this.pb.collection('users').authWithPassword(email, password);
            // Auth store will automatically trigger onChange
        } catch (error) {
            this.showAuthError(this.getPocketBaseErrorMessage(error));
        }
    }

    async signUp() {
        if (this.isOffline) return this.startDemoMode();

        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;
        const confirmPassword = document.getElementById('signupPasswordConfirm').value;

        if (password !== confirmPassword) {
            this.showAuthError('A jelszavak nem egyeznek');
            return;
        }

        try {
            // Create user account
            const userData = {
                email,
                password,
                passwordConfirm: confirmPassword,
                emailVisibility: true
            };

            await this.pb.collection('users').create(userData);
            
            // Request email verification
            await this.pb.collection('users').requestVerification(email);
            
            this.showAuthError('Regisztráció sikeres! Ellenőrizze email fiókját a megerősítéshez.', false);
        } catch (error) {
            this.showAuthError(this.getPocketBaseErrorMessage(error));
        }
    }

    async signInWithGoogle() {
        if (this.isOffline) return this.startDemoMode();

        try {
            // PocketBase OAuth flow
            const authData = await this.pb.collection('users').authWithOAuth2('google');
            // Auth will be handled by onChange
        } catch (error) {
            this.showAuthError('Google bejelentkezés sikertelen');
        }
    }

    getPocketBaseErrorMessage(error) {
        // Extract user-friendly message from PocketBase error
        if (error?.response?.data) {
            const data = error.response.data;
            if (data.email) return 'Érvénytelen email cím';
            if (data.password) return 'Jelszó túl rövid (min. 8 karakter)';
            if (data.message) return data.message;
        }
        
        if (error?.message) {
            if (error.message.includes('Failed to authenticate')) {
                return 'Hibás email cím vagy jelszó';
            }
            if (error.message.includes('Failed to create')) {
                return 'Ez az email cím már regisztrált';
            }
        }
        
        return 'Hiba történt a kérés során';
    }

    startDemoMode() {
        this.isOffline = true;
        this.user = { email: 'demo@example.com', id: 'demo-user' };
        this.showApp();
        this.setupOfflineMode();
    }

    showUserInfo() {
        const header = document.querySelector('.header-content');
        if (header && this.user) {
            const userInfo = document.createElement('div');
            userInfo.className = 'user-info';
            userInfo.innerHTML = `
                <span>👋 ${this.user.email}</span>
                <button class="btn-logout" onclick="auth.signOut()">Kijelentkezés</button>
            `;
            header.appendChild(userInfo);
        }
    }

    async signOut() {
        if (!this.isOffline && this.pb) {
            this.pb.authStore.clear();
            // onChange will trigger automatically
        } else {
            this.user = null;
            this.showAuth();
        }
    }

    showAuthError(message, isError = true) {
        const errorDiv = document.getElementById('authError');
        errorDiv.textContent = message;
        errorDiv.className = `auth-error ${isError ? 'error' : 'success'}`;
        errorDiv.style.display = 'block';
    }

    hideAuthError() {
        const errorDiv = document.getElementById('authError');
        errorDiv.style.display = 'none';
    }

    async syncDataToCloud() {
        if (this.isOffline || !this.pb || !this.user) return;

        try {
            // Get local data
            const localTransactions = JSON.parse(localStorage.getItem('expense_transactions') || '[]');
            const localCategories = JSON.parse(localStorage.getItem('expense_categories') || '[]');
            
            if (localTransactions.length > 0) {
                console.log('Syncing transactions to PocketBase...');
                
                // Create default categories if they don't exist
                await this.ensureDefaultCategories();
                
                // Sync transactions
                for (const transaction of localTransactions) {
                    try {
                        await this.pb.collection('transactions').create({
                            ...transaction,
                            user_id: this.user.id
                        });
                    } catch (error) {
                        if (!error.message.includes('duplicate')) {
                            console.error('Transaction sync failed:', error);
                        }
                    }
                }
                
                console.log('Data sync completed');
            }
        } catch (error) {
            console.error('Data sync failed:', error);
        }
    }

    async ensureDefaultCategories() {
        try {
            // Check if user has categories
            const existingCategories = await this.pb.collection('categories').getList(1, 1, {
                filter: `user_id="${this.user.id}"`
            });

            if (existingCategories.totalItems === 0) {
                // Create default categories
                const defaultCategories = [
                    { name: 'Élelmiszer', emoji: '🍔', color: '#EF4444' },
                    { name: 'Közlekedés', emoji: '🚗', color: '#F59E0B' },
                    { name: 'Rezsi', emoji: '🏠', color: '#10B981' },
                    { name: 'Vásárlás', emoji: '🛍️', color: '#3B82F6' },
                    { name: 'Szórakozás', emoji: '🎬', color: '#8B5CF6' },
                    { name: 'Egészség', emoji: '🏥', color: '#EC4899' },
                    { name: 'Egyéb', emoji: '📌', color: '#6B7280' }
                ];

                for (const category of defaultCategories) {
                    await this.pb.collection('categories').create({
                        ...category,
                        user_id: this.user.id
                    });
                }
            }
        } catch (error) {
            console.error('Failed to create default categories:', error);
        }
    }
}

// Initialize auth system
const auth = new ExpenseAuth();
window.auth = auth;
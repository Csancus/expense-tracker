// Supabase Authentication for Expense Tracker
class SupabaseAuth {
    constructor() {
        this.client = null;
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
        // Check if Supabase is available (CDN loaded)
        if (typeof window.supabase === 'undefined') {
            console.log('Supabase not loaded, using offline mode');
            this.isOffline = true;
            this.setupOfflineMode();
            return;
        }

        try {
            // Get Supabase configuration from meta tags or fallback to hardcoded
            const supabaseUrl = this.getEnvVar('SUPABASE_URL') || 'https://pdmaznyyartrstliewke.supabase.co';
            const supabaseKey = this.getEnvVar('SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkbWF6bnl5YXJ0cnN0bGlld2tlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0NDUzMDAsImV4cCI6MjA3OTAyMTMwMH0.lRR78pV6NPSZa-pDrqOUPFK7gPBfWb6DqMAZKwNmX-A';
            
            // Validate configuration
            if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('YOUR_SUPABASE')) {
                console.log('Supabase not configured, using offline mode');
                this.isOffline = true;
                this.setupOfflineMode();
                return;
            }

            // Initialize Supabase client
            this.client = new SupabaseClient();
            const success = await this.client.init(supabaseUrl, supabaseKey);
            
            if (!success) {
                throw new Error('Supabase initialization failed');
            }

            // Listen to auth state changes
            window.addEventListener('authStateChanged', (event) => {
                const { user, event: authEvent } = event.detail;
                this.user = user;
                
                if (user) {
                    this.showApp();
                    this.syncDataToCloud();
                    this.initFamilyManager();
                } else {
                    this.showAuth();
                }
            });

            // Check current session
            if (this.client.isAuthenticated()) {
                this.user = this.client.getCurrentUser();
                this.showApp();
                this.initFamilyManager();
            } else {
                this.showAuth();
            }

            this.isInitialized = true;
            
        } catch (error) {
            console.error('Supabase initialization failed:', error);
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
                            <input type="password" id="signupPassword" required minlength="6">
                        </div>
                        <div class="form-group">
                            <label>Jelszó megerősítése:</label>
                            <input type="password" id="signupPasswordConfirm" required minlength="6">
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
            await this.client.signIn(email, password);
            // Auth state change will be handled by event listener
        } catch (error) {
            this.showAuthError(this.getSupabaseErrorMessage(error));
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

        if (password.length < 6) {
            this.showAuthError('A jelszó legalább 6 karakter hosszú legyen');
            return;
        }

        try {
            await this.client.signUp(email, password);
            this.showAuthError('Regisztráció sikeres! Ellenőrizze email fiókját a megerősítéshez.', false);
        } catch (error) {
            this.showAuthError(this.getSupabaseErrorMessage(error));
        }
    }

    async signInWithGoogle() {
        if (this.isOffline) return this.startDemoMode();

        try {
            await this.client.signInWithGoogle();
            // Auth state change will be handled by event listener
        } catch (error) {
            this.showAuthError('Google bejelentkezés sikertelen');
        }
    }

    getSupabaseErrorMessage(error) {
        // Extract user-friendly message from Supabase error
        if (error?.message) {
            if (error.message.includes('Invalid login credentials')) {
                return 'Hibás email cím vagy jelszó';
            }
            if (error.message.includes('User already registered')) {
                return 'Ez az email cím már regisztrált';
            }
            if (error.message.includes('Password should be')) {
                return 'A jelszó túl rövid (min. 6 karakter)';
            }
            if (error.message.includes('Unable to validate email address')) {
                return 'Érvénytelen email cím';
            }
            if (error.message.includes('Email not confirmed')) {
                return 'Kérjük, erősítse meg email címét';
            }
            return error.message;
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
            // Remove existing user info
            const existingUserInfo = header.querySelector('.user-info');
            if (existingUserInfo) {
                existingUserInfo.remove();
            }
            
            const userInfo = document.createElement('div');
            userInfo.className = 'user-info';
            userInfo.innerHTML = `
                <span>👋 ${this.user.email}</span>
                <button class="btn-logout" onclick="supabaseAuth.signOut()">Kijelentkezés</button>
            `;
            header.appendChild(userInfo);
        }
    }

    async signOut() {
        if (!this.isOffline && this.client) {
            await this.client.signOut();
            // Auth state change will be handled by event listener
        } else {
            this.user = null;
            this.showAuth();
        }
    }

    showAuthError(message, isError = true) {
        const errorDiv = document.getElementById('authError');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.className = `auth-error ${isError ? 'error' : 'success'}`;
            errorDiv.style.display = 'block';
        }
    }

    hideAuthError() {
        const errorDiv = document.getElementById('authError');
        if (errorDiv) {
            errorDiv.style.display = 'none';
        }
    }

    initFamilyManager() {
        if (this.isOffline || !this.client) return;
        
        try {
            // Initialize family manager
            if (typeof FamilyManager !== 'undefined') {
                window.familyManager = new FamilyManager(this.client.getSupabaseClient());
                
                // Check for pending invitation
                const pendingInvite = sessionStorage.getItem('pendingInvite');
                if (pendingInvite) {
                    sessionStorage.removeItem('pendingInvite');
                    setTimeout(() => {
                        window.familyManager.acceptInvitation(pendingInvite);
                    }, 1000);
                }
            }
        } catch (error) {
            console.error('Failed to initialize family manager:', error);
        }
    }

    async syncDataToCloud() {
        if (this.isOffline || !this.client || !this.user) return;

        try {
            // Get local data
            const localTransactions = JSON.parse(localStorage.getItem('expense_transactions') || '[]');
            const localCategories = JSON.parse(localStorage.getItem('expense_categories') || '[]');
            const localRules = JSON.parse(localStorage.getItem('expense_category_rules') || '[]');
            
            if (localTransactions.length > 0 || localCategories.length > 0 || localRules.length > 0) {
                console.log('Syncing local data to Supabase...');
                await this.client.syncLocalData(localCategories, localTransactions, localRules);
                console.log('Data sync completed');
                
                // Clear local data after successful sync (optional)
                // localStorage.removeItem('expense_transactions');
                // localStorage.removeItem('expense_categories');
                // localStorage.removeItem('expense_category_rules');
            }
        } catch (error) {
            console.error('Data sync failed:', error);
        }
    }

    // Utility methods
    isAuthenticated() {
        return this.user !== null;
    }

    getCurrentUser() {
        return this.user;
    }

    getClient() {
        return this.client;
    }
}

// Initialize auth system
const supabaseAuth = new SupabaseAuth();
window.supabaseAuth = supabaseAuth;
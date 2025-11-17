// Expense Tracker App
class ExpenseTracker {
    constructor() {
        this.transactions = this.loadTransactions();
        this.selectedBank = null;
        this.currentTab = 'upload';
        this.init();
    }

    init() {
        this.setupTabs();
        this.setupUpload();
        this.setupBankSelector();
        this.renderTransactions();
        this.renderAnalytics();
    }

    // Tab Management
    setupTabs() {
        const tabButtons = document.querySelectorAll('.nav-btn');
        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                this.switchTab(tab);
            });
        });
    }

    switchTab(tabName) {
        // Update buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Update content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === tabName);
        });

        this.currentTab = tabName;

        // Refresh content if needed
        if (tabName === 'transactions') {
            this.renderTransactions();
        } else if (tabName === 'analytics') {
            this.renderAnalytics();
        }
    }

    // Bank Selector
    setupBankSelector() {
        const bankButtons = document.querySelectorAll('.bank-btn');
        bankButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                bankButtons.forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                this.selectedBank = btn.dataset.bank;
            });
        });
    }

    // File Upload
    setupUpload() {
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');

        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFile(files[0]);
            }
        });

        // Click to upload
        uploadArea.addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFile(e.target.files[0]);
            }
        });
    }

    handleFile(file) {
        if (!this.selectedBank) {
            alert('Kérjük, először válassza ki a bankját!');
            return;
        }

        // Simulate file processing
        const reader = new FileReader();
        reader.onload = (e) => {
            this.processStatement(e.target.result, file.name);
        };

        if (file.type === 'application/pdf') {
            alert('PDF feldolgozás még fejlesztés alatt áll. Kérjük, használjon CSV formátumot.');
            return;
        }

        reader.readAsText(file);
    }

    processStatement(content, filename) {
        // Simulate parsing based on bank
        const mockTransactions = this.generateMockTransactions();
        
        // Add to existing transactions
        this.transactions.push(...mockTransactions);
        this.saveTransactions();

        // Show success
        this.showUploadStatus(mockTransactions.length);

        // Switch to transactions tab
        setTimeout(() => {
            this.switchTab('transactions');
        }, 2000);
    }

    showUploadStatus(count) {
        const uploadArea = document.getElementById('uploadArea');
        const uploadStatus = document.getElementById('uploadStatus');
        const statusDetails = uploadStatus.querySelector('.status-details');

        uploadArea.style.display = 'none';
        uploadStatus.style.display = 'block';

        statusDetails.textContent = `${count} tranzakció sikeresen feldolgozva és hozzáadva.`;

        setTimeout(() => {
            uploadArea.style.display = 'block';
            uploadStatus.style.display = 'none';
        }, 3000);
    }

    generateMockTransactions() {
        const merchants = [
            { name: 'Tesco', category: '🍔 Élelmiszer' },
            { name: 'Lidl', category: '🍔 Élelmiszer' },
            { name: 'MOL', category: '🚗 Közlekedés' },
            { name: 'BKK', category: '🚗 Közlekedés' },
            { name: 'ELMŰ', category: '🏠 Rezsi' },
            { name: 'Cinema City', category: '🎬 Szórakozás' },
            { name: 'H&M', category: '🛍️ Vásárlás' }
        ];

        const transactions = [];
        const today = new Date();

        for (let i = 0; i < 10; i++) {
            const merchant = merchants[Math.floor(Math.random() * merchants.length)];
            const date = new Date(today);
            date.setDate(date.getDate() - Math.floor(Math.random() * 30));

            transactions.push({
                id: Date.now() + i,
                date: date.toISOString().split('T')[0],
                merchant: merchant.name,
                category: merchant.category,
                amount: -(Math.floor(Math.random() * 50000) + 1000),
                bank: this.selectedBank
            });
        }

        return transactions;
    }

    // Transaction Management
    renderTransactions() {
        const container = document.getElementById('transactionsList');
        
        if (this.transactions.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Még nincsenek tranzakciók. Töltsön fel egy bankszámlakivonatot!</p>';
            return;
        }

        // Sort by date
        const sorted = [...this.transactions].sort((a, b) => 
            new Date(b.date) - new Date(a.date)
        );

        container.innerHTML = sorted.map(t => `
            <div class="transaction-item">
                <div class="transaction-date">${this.formatDate(t.date)}</div>
                <div class="transaction-desc">
                    <span class="merchant">${t.merchant}</span>
                    <span class="category">${t.category}</span>
                </div>
                <div class="transaction-amount ${t.amount < 0 ? 'expense' : 'income'}">
                    ${this.formatAmount(t.amount)}
                </div>
            </div>
        `).join('');
    }

    // Analytics
    renderAnalytics() {
        if (this.transactions.length === 0) return;

        // Calculate summaries
        const income = this.transactions
            .filter(t => t.amount > 0)
            .reduce((sum, t) => sum + t.amount, 0);

        const expense = this.transactions
            .filter(t => t.amount < 0)
            .reduce((sum, t) => sum + Math.abs(t.amount), 0);

        // Update summary cards
        document.querySelector('.summary-card:nth-child(1) .amount').textContent = 
            this.formatAmount(income);
        document.querySelector('.summary-card:nth-child(2) .amount').textContent = 
            this.formatAmount(-expense);
        document.querySelector('.summary-card:nth-child(3) .amount').textContent = 
            this.formatAmount(income - expense);

        // Render charts
        this.renderCategoryChart();
        this.renderTrendChart();
    }

    renderCategoryChart() {
        const ctx = document.getElementById('categoryChart');
        if (!ctx) return;

        // Group by category
        const categoryData = {};
        this.transactions
            .filter(t => t.amount < 0)
            .forEach(t => {
                const cat = t.category || 'Egyéb';
                categoryData[cat] = (categoryData[cat] || 0) + Math.abs(t.amount);
            });

        // Create chart
        new Chart(ctx, {
            type: 'pie',
            data: {
                labels: Object.keys(categoryData),
                datasets: [{
                    data: Object.values(categoryData),
                    backgroundColor: [
                        '#EF4444',
                        '#F59E0B',
                        '#10B981',
                        '#3B82F6',
                        '#8B5CF6',
                        '#EC4899'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right'
                    }
                }
            }
        });
    }

    renderTrendChart() {
        const ctx = document.getElementById('trendChart');
        if (!ctx) return;

        // Group by month
        const monthlyData = {};
        this.transactions.forEach(t => {
            const month = t.date.substring(0, 7);
            if (!monthlyData[month]) {
                monthlyData[month] = { income: 0, expense: 0 };
            }
            if (t.amount > 0) {
                monthlyData[month].income += t.amount;
            } else {
                monthlyData[month].expense += Math.abs(t.amount);
            }
        });

        const months = Object.keys(monthlyData).sort();
        
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: months,
                datasets: [{
                    label: 'Bevétel',
                    data: months.map(m => monthlyData[m].income),
                    borderColor: '#10B981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.4
                }, {
                    label: 'Kiadás',
                    data: months.map(m => monthlyData[m].expense),
                    borderColor: '#EF4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    // Utility functions
    formatDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('hu-HU');
    }

    formatAmount(amount) {
        const sign = amount < 0 ? '-' : '+';
        const abs = Math.abs(amount);
        return `${sign}${abs.toLocaleString('hu-HU')} Ft`;
    }

    // Storage
    saveTransactions() {
        localStorage.setItem('expense_transactions', JSON.stringify(this.transactions));
    }

    loadTransactions() {
        const saved = localStorage.getItem('expense_transactions');
        return saved ? JSON.parse(saved) : [];
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ExpenseTracker();
});
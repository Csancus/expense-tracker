// Expense Tracker App - Fixed Version
class ExpenseTracker {
    constructor() {
        this.transactions = this.loadTransactions();
        this.selectedBank = null;
        this.currentTab = 'upload';
        this.isProcessing = false; // Add processing flag
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

    // Simplified File Upload Setup
    setupUpload() {
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');

        // Prevent default drag behaviors on document
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            document.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });

        // Drag and drop on upload area
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!this.isProcessing) {
                uploadArea.classList.add('dragover');
            }
        }, false);

        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadArea.classList.remove('dragover');
        }, false);

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadArea.classList.remove('dragover');
            
            if (!this.isProcessing && e.dataTransfer.files.length > 0) {
                this.processFile(e.dataTransfer.files[0]);
            }
        }, false);

        // File input change event - clear after processing
        fileInput.addEventListener('change', (e) => {
            if (!this.isProcessing && e.target.files.length > 0) {
                const file = e.target.files[0];
                // Clear input immediately to prevent duplicate triggers
                e.target.value = '';
                this.processFile(file);
            }
        });

        // Use event delegation for button clicks to avoid multiple listeners
        uploadArea.addEventListener('click', (e) => {
            // Only respond to clicks on the upload button
            if (e.target.classList.contains('btn-primary') || e.target.closest('.btn-primary')) {
                e.preventDefault();
                e.stopPropagation();
                if (!this.isProcessing) {
                    fileInput.click();
                }
            }
        });
    }

    async processFile(file) {
        // Check if already processing
        if (this.isProcessing) {
            console.log('Already processing a file');
            return;
        }

        if (!this.selectedBank) {
            alert('Kérjük, először válassza ki a bankját!');
            return;
        }

        // Set processing flag
        this.isProcessing = true;

        console.log(`Processing file: ${file.name}, type: ${file.type}, bank: ${this.selectedBank}`);

        try {
            // Handle different file types
            if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
                await this.processPDFFile(file);
            } else if (file.type.includes('excel') || file.type.includes('spreadsheet') || 
                       file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls')) {
                alert('Excel feldolgozás hamarosan elérhető lesz.');
            } else {
                await this.processCSVFile(file);
            }
        } catch (error) {
            console.error('File processing error:', error);
            alert('Hiba történt a fájl feldolgozása során: ' + error.message);
        } finally {
            // Always reset processing flag and UI
            this.isProcessing = false;
            this.resetUploadUI();
        }
    }

    async processPDFFile(file) {
        this.showProcessingStatus('PDF feldolgozás folyamatban...');

        // Check if PDFProcessor exists
        if (typeof PDFProcessor === 'undefined') {
            // Try to load it
            await this.loadPDFProcessor();
        }

        if (typeof PDFProcessor === 'undefined') {
            throw new Error('PDF feldolgozó nem elérhető');
        }

        const pdfProcessor = new PDFProcessor();
        const transactions = await pdfProcessor.processPDF(file, this.selectedBank);

        if (transactions && transactions.length > 0) {
            this.addTransactions(transactions);
            this.showSuccess(transactions.length);
        } else {
            alert('Nem találtunk tranzakciókat a PDF fájlban.');
        }
    }

    async loadPDFProcessor() {
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'pdf-processor.js?v=' + Date.now();
            script.onload = () => resolve();
            script.onerror = () => resolve(); // Continue even if fails
            document.head.appendChild(script);
        });
    }

    async processCSVFile(file) {
        this.showProcessingStatus('CSV feldolgozás folyamatban...');

        const text = await file.text();
        const transactions = this.parseCSV(text, this.selectedBank);

        if (transactions.length > 0) {
            this.addTransactions(transactions);
            this.showSuccess(transactions.length);
        } else {
            alert('Nem találtunk tranzakciókat a CSV fájlban.');
        }
    }

    showProcessingStatus(message) {
        const uploadArea = document.getElementById('uploadArea');
        const uploadPrompt = uploadArea.querySelector('.upload-prompt');
        
        if (uploadPrompt) {
            uploadPrompt.innerHTML = `
                <div class="processing-status">
                    <div class="spinner"></div>
                    <h3>${message}</h3>
                    <p>Ez eltarthat néhány másodpercig...</p>
                </div>
            `;
        }
    }

    resetUploadUI() {
        const uploadArea = document.getElementById('uploadArea');
        const uploadPrompt = uploadArea.querySelector('.upload-prompt');
        
        if (uploadPrompt) {
            // Reset HTML without re-adding event listeners 
            // (event delegation handles button clicks)
            uploadPrompt.innerHTML = `
                <span class="upload-icon">📁</span>
                <h3>Húzza ide a fájlt vagy kattintson a tallózáshoz</h3>
                <p>Támogatott formátumok: CSV, PDF, Excel</p>
                <button class="btn btn-primary">Fájl kiválasztása</button>
            `;
        }
    }

    showSuccess(count) {
        const uploadStatus = document.getElementById('uploadStatus');
        const uploadArea = document.getElementById('uploadArea');
        const statusDetails = uploadStatus.querySelector('.status-details');

        uploadArea.style.display = 'none';
        uploadStatus.style.display = 'block';
        statusDetails.textContent = `${count} tranzakció sikeresen feldolgozva és hozzáadva.`;

        setTimeout(() => {
            uploadArea.style.display = 'block';
            uploadStatus.style.display = 'none';
            this.switchTab('transactions');
        }, 2000);
    }

    addTransactions(newTransactions) {
        // Check for duplicates
        const existingHashes = new Set(
            this.transactions.map(t => this.getTransactionHash(t))
        );

        const uniqueTransactions = newTransactions.filter(t => {
            const hash = this.getTransactionHash(t);
            return !existingHashes.has(hash);
        });

        // Add unique transactions
        this.transactions.push(...uniqueTransactions);
        this.saveTransactions();

        console.log(`Added ${uniqueTransactions.length} unique transactions (${newTransactions.length - uniqueTransactions.length} duplicates skipped)`);
    }

    getTransactionHash(transaction) {
        return `${transaction.date}_${transaction.amount}_${transaction.description || transaction.merchant}`;
    }

    parseCSV(content, bankType) {
        const lines = content.split('\n');
        const transactions = [];

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const parts = line.split(/[;,\t]/);
            if (parts.length >= 3) {
                transactions.push({
                    id: Date.now() + i,
                    date: this.parseCSVDate(parts[0]),
                    description: parts[1] || 'N/A',
                    amount: this.parseCSVAmount(parts[2]),
                    merchant: parts[1] ? parts[1].split(' ')[0] : 'Unknown',
                    category: '📌 Egyéb',
                    bank: bankType.toUpperCase()
                });
            }
        }

        return transactions;
    }

    parseCSVDate(dateStr) {
        const date = new Date(dateStr);
        if (!isNaN(date)) {
            return date.toISOString().split('T')[0];
        }
        return dateStr;
    }

    parseCSVAmount(amountStr) {
        const cleaned = amountStr.replace(/\s/g, '').replace(',', '.');
        return parseFloat(cleaned) || 0;
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

        const income = this.transactions
            .filter(t => t.amount > 0)
            .reduce((sum, t) => sum + t.amount, 0);

        const expense = this.transactions
            .filter(t => t.amount < 0)
            .reduce((sum, t) => sum + Math.abs(t.amount), 0);

        document.querySelector('.summary-card:nth-child(1) .amount').textContent =
            this.formatAmount(income);
        document.querySelector('.summary-card:nth-child(2) .amount').textContent =
            this.formatAmount(-expense);
        document.querySelector('.summary-card:nth-child(3) .amount').textContent =
            this.formatAmount(income - expense);

        this.renderCategoryChart();
        this.renderTrendChart();
    }

    renderCategoryChart() {
        const ctx = document.getElementById('categoryChart');
        if (!ctx || !window.Chart) return;

        const categoryData = {};
        this.transactions
            .filter(t => t.amount < 0)
            .forEach(t => {
                const cat = t.category || 'Egyéb';
                categoryData[cat] = (categoryData[cat] || 0) + Math.abs(t.amount);
            });

        new Chart(ctx, {
            type: 'pie',
            data: {
                labels: Object.keys(categoryData),
                datasets: [{
                    data: Object.values(categoryData),
                    backgroundColor: [
                        '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }

    renderTrendChart() {
        const ctx = document.getElementById('trendChart');
        if (!ctx || !window.Chart) return;

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
                    tension: 0.4
                }, {
                    label: 'Kiadás',
                    data: months.map(m => monthlyData[m].expense),
                    borderColor: '#EF4444',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }

    formatDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('hu-HU');
    }

    formatAmount(amount) {
        const sign = amount < 0 ? '-' : '+';
        const abs = Math.abs(amount);
        return `${sign}${abs.toLocaleString('hu-HU')} Ft`;
    }

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
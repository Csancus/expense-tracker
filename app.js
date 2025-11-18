// Expense Tracker App - Fixed Version
class ExpenseTracker {
    constructor() {
        this.transactions = this.loadTransactions();
        this.categories = this.loadCategories();
        this.categoryRules = this.loadCategoryRules(); // Time-based category rules
        this.selectedBank = null;
        this.currentTab = 'upload';
        this.isProcessing = false; // Add processing flag
        this.init();
    }

    init() {
        this.setupTabs();
        this.setupUpload();
        this.setupBankSelector();
        this.setupCategoryManagement();
        this.renderTransactions();
        this.renderAnalytics();
        this.renderCategories();
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

        container.innerHTML = sorted.map(t => {
            // Get category for transaction (with time-based rules)
            const categoryId = this.getCategoryForTransaction(t);
            const category = this.categories.find(c => c.id === categoryId);
            const categoryDisplay = category ? `${category.emoji} ${category.name}` : '📌 Egyéb';
            
            return `
                <div class="transaction-item">
                    <div class="transaction-date">${this.formatDate(t.date)}</div>
                    <div class="transaction-desc">
                        <span class="merchant">${t.merchant}</span>
                        <span class="category" style="background-color: ${category?.color || '#6B7280'}20; color: ${category?.color || '#6B7280'};">
                            ${categoryDisplay}
                        </span>
                    </div>
                    <div class="transaction-amount ${t.amount < 0 ? 'expense' : 'income'}">
                        ${this.formatAmount(t.amount)}
                        <button class="edit-category-btn" data-transaction-id="${t.id}" title="Kategória szerkesztése">✏️</button>
                    </div>
                </div>
            `;
        }).join('');
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

        // Clear existing chart
        Chart.getChart(ctx)?.destroy();

        const categoryData = {};
        const categoryColors = {};
        
        this.transactions
            .filter(t => t.amount < 0)
            .forEach(t => {
                const categoryId = this.getCategoryForTransaction(t);
                const category = this.categories.find(c => c.id === categoryId);
                const categoryName = category ? `${category.emoji} ${category.name}` : '📌 Egyéb';
                
                categoryData[categoryName] = (categoryData[categoryName] || 0) + Math.abs(t.amount);
                categoryColors[categoryName] = category?.color || '#6B7280';
            });

        const labels = Object.keys(categoryData);
        const data = Object.values(categoryData);
        const colors = labels.map(label => categoryColors[label]);

        new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.parsed;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${context.label}: ${value.toLocaleString('hu-HU')} Ft (${percentage}%)`;
                            }
                        }
                    }
                }
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

    // Category Management
    loadCategories() {
        const saved = localStorage.getItem('expense_categories');
        return saved ? JSON.parse(saved) : [
            { id: 'food', name: 'Élelmiszer', emoji: '🍔', color: '#EF4444' },
            { id: 'transport', name: 'Közlekedés', emoji: '🚗', color: '#F59E0B' },
            { id: 'utilities', name: 'Rezsi', emoji: '🏠', color: '#10B981' },
            { id: 'shopping', name: 'Vásárlás', emoji: '🛍️', color: '#3B82F6' },
            { id: 'entertainment', name: 'Szórakozás', emoji: '🎬', color: '#8B5CF6' },
            { id: 'health', name: 'Egészség', emoji: '🏥', color: '#EC4899' },
            { id: 'other', name: 'Egyéb', emoji: '📌', color: '#6B7280' }
        ];
    }

    loadCategoryRules() {
        const saved = localStorage.getItem('expense_category_rules');
        return saved ? JSON.parse(saved) : [];
    }

    saveCategories() {
        localStorage.setItem('expense_categories', JSON.stringify(this.categories));
    }

    saveCategoryRules() {
        localStorage.setItem('expense_category_rules', JSON.stringify(this.categoryRules));
    }

    setupCategoryManagement() {
        // Add category button
        const addCategoryBtn = document.querySelector('.settings-container .btn-secondary');
        if (addCategoryBtn) {
            addCategoryBtn.addEventListener('click', () => this.showAddCategoryModal());
        }

        // Transaction category assignment
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('edit-category-btn')) {
                const transactionId = e.target.dataset.transactionId;
                this.showTransactionCategoryModal(transactionId);
            }
        });
    }

    renderCategories() {
        const categoryList = document.querySelector('.category-list');
        if (!categoryList) return;

        categoryList.innerHTML = this.categories.map(cat => `
            <div class="category-item" data-category-id="${cat.id}">
                <span style="font-size: 1.2em">${cat.emoji}</span>
                <input type="text" value="${cat.name}" class="category-name-input">
                <div class="category-color-picker">
                    <input type="color" value="${cat.color}" class="category-color-input">
                </div>
                <button class="btn-delete" data-category-id="${cat.id}">❌</button>
            </div>
        `).join('');

        // Add event listeners for category editing
        categoryList.addEventListener('change', (e) => {
            if (e.target.classList.contains('category-name-input')) {
                this.updateCategoryName(e.target);
            } else if (e.target.classList.contains('category-color-input')) {
                this.updateCategoryColor(e.target);
            }
        });

        categoryList.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-delete')) {
                this.deleteCategory(e.target.dataset.categoryId);
            }
        });
    }

    updateCategoryName(input) {
        const categoryItem = input.closest('.category-item');
        const categoryId = categoryItem.dataset.categoryId;
        const category = this.categories.find(c => c.id === categoryId);
        
        if (category) {
            category.name = input.value;
            this.saveCategories();
            this.renderTransactions(); // Refresh transactions to show updated categories
        }
    }

    updateCategoryColor(input) {
        const categoryItem = input.closest('.category-item');
        const categoryId = categoryItem.dataset.categoryId;
        const category = this.categories.find(c => c.id === categoryId);
        
        if (category) {
            category.color = input.value;
            this.saveCategories();
            this.renderAnalytics(); // Refresh charts
        }
    }

    deleteCategory(categoryId) {
        if (confirm('Biztos törli ezt a kategóriát? A hozzá tartozó tranzakciók "Egyéb" kategóriába kerülnek.')) {
            // Update transactions that use this category
            this.transactions.forEach(t => {
                if (t.category === categoryId) {
                    t.category = 'other';
                }
            });

            // Remove from categories
            this.categories = this.categories.filter(c => c.id !== categoryId);
            
            // Remove associated rules
            this.categoryRules = this.categoryRules.filter(rule => rule.categoryId !== categoryId);
            
            this.saveCategories();
            this.saveCategoryRules();
            this.saveTransactions();
            this.renderCategories();
            this.renderTransactions();
        }
    }

    showAddCategoryModal() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <h3>Új kategória hozzáadása</h3>
                    <button class="modal-close">×</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>Emoji:</label>
                        <input type="text" id="new-category-emoji" maxlength="2" placeholder="🏷️">
                    </div>
                    <div class="form-group">
                        <label>Név:</label>
                        <input type="text" id="new-category-name" placeholder="Kategória neve">
                    </div>
                    <div class="form-group">
                        <label>Szín:</label>
                        <input type="color" id="new-category-color" value="#6B7280">
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary modal-close">Mégse</button>
                    <button class="btn btn-primary" id="save-category">Mentés</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Event listeners
        modal.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-close') || e.target.classList.contains('modal-overlay')) {
                this.closeModal(modal);
            } else if (e.target.id === 'save-category') {
                this.saveNewCategory(modal);
            }
        });

        // Focus first input
        modal.querySelector('#new-category-emoji').focus();
    }

    saveNewCategory(modal) {
        const emoji = modal.querySelector('#new-category-emoji').value.trim();
        const name = modal.querySelector('#new-category-name').value.trim();
        const color = modal.querySelector('#new-category-color').value;

        if (!emoji || !name) {
            alert('Kérjük töltse ki az emoji és név mezőket!');
            return;
        }

        const newCategory = {
            id: 'cat_' + Date.now(),
            name: name,
            emoji: emoji,
            color: color
        };

        this.categories.push(newCategory);
        this.saveCategories();
        this.renderCategories();
        this.closeModal(modal);
    }

    closeModal(modal) {
        modal.remove();
    }

    // Enhanced category assignment with time periods
    getCategoryForTransaction(transaction) {
        const transactionDate = new Date(transaction.date);
        
        // Check for time-based rules first
        for (const rule of this.categoryRules) {
            if (this.matchesRule(transaction, rule, transactionDate)) {
                return rule.categoryId;
            }
        }
        
        // Fall back to original category or auto-suggest
        return transaction.category || this.suggestCategory(transaction.description || transaction.merchant);
    }

    matchesRule(transaction, rule, transactionDate) {
        // Check merchant/description match
        const searchText = (transaction.description || transaction.merchant || '').toLowerCase();
        if (!searchText.includes(rule.merchantPattern.toLowerCase())) {
            return false;
        }

        // Check date range
        const startDate = rule.startDate ? new Date(rule.startDate) : null;
        const endDate = rule.endDate ? new Date(rule.endDate) : null;

        if (startDate && transactionDate < startDate) return false;
        if (endDate && transactionDate > endDate) return false;

        return true;
    }

    showTransactionCategoryModal(transactionId) {
        const transaction = this.transactions.find(t => t.id == transactionId);
        if (!transaction) return;

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <h3>Kategória hozzárendelés</h3>
                    <button class="modal-close">×</button>
                </div>
                <div class="modal-body">
                    <div class="transaction-info">
                        <strong>${transaction.merchant}</strong><br>
                        <small>${transaction.date} - ${this.formatAmount(transaction.amount)}</small>
                    </div>
                    
                    <div class="form-group">
                        <label>Kategória:</label>
                        <select id="transaction-category">
                            ${this.categories.map(cat => `
                                <option value="${cat.id}" ${transaction.category === cat.id ? 'selected' : ''}>
                                    ${cat.emoji} ${cat.name}
                                </option>
                            `).join('')}
                        </select>
                    </div>

                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="create-rule"> 
                            Automatikus szabály létrehozása
                        </label>
                    </div>

                    <div id="rule-options" style="display: none;">
                        <div class="form-group">
                            <label>Keresési minta:</label>
                            <input type="text" id="merchant-pattern" value="${transaction.merchant}">
                            <small>A tranzakció leírásában/kereskedő nevében keresendő szöveg</small>
                        </div>
                        
                        <div class="form-group">
                            <label>Érvényesség kezdete (opcionális):</label>
                            <input type="date" id="rule-start-date">
                        </div>
                        
                        <div class="form-group">
                            <label>Érvényesség vége (opcionális):</label>
                            <input type="date" id="rule-end-date">
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary modal-close">Mégse</button>
                    <button class="btn btn-primary" id="save-transaction-category">Mentés</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Show/hide rule options
        modal.querySelector('#create-rule').addEventListener('change', (e) => {
            modal.querySelector('#rule-options').style.display = e.target.checked ? 'block' : 'none';
        });

        // Event listeners
        modal.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-close') || e.target.classList.contains('modal-overlay')) {
                this.closeModal(modal);
            } else if (e.target.id === 'save-transaction-category') {
                this.saveTransactionCategory(modal, transactionId);
            }
        });
    }

    saveTransactionCategory(modal, transactionId) {
        const categoryId = modal.querySelector('#transaction-category').value;
        const createRule = modal.querySelector('#create-rule').checked;
        
        // Update transaction
        const transaction = this.transactions.find(t => t.id == transactionId);
        if (transaction) {
            transaction.category = categoryId;
        }

        // Create rule if requested
        if (createRule) {
            const merchantPattern = modal.querySelector('#merchant-pattern').value.trim();
            const startDate = modal.querySelector('#rule-start-date').value;
            const endDate = modal.querySelector('#rule-end-date').value;

            if (merchantPattern) {
                const newRule = {
                    id: 'rule_' + Date.now(),
                    merchantPattern: merchantPattern,
                    categoryId: categoryId,
                    startDate: startDate || null,
                    endDate: endDate || null,
                    createdAt: new Date().toISOString()
                };

                this.categoryRules.push(newRule);
                this.saveCategoryRules();
                
                // Apply rule to existing transactions
                this.applyRuleToExistingTransactions(newRule);
            }
        }

        this.saveTransactions();
        this.renderTransactions();
        this.renderAnalytics();
        this.closeModal(modal);
    }

    applyRuleToExistingTransactions(rule) {
        let appliedCount = 0;
        
        this.transactions.forEach(transaction => {
            const transactionDate = new Date(transaction.date);
            if (this.matchesRule(transaction, rule, transactionDate)) {
                transaction.category = rule.categoryId;
                appliedCount++;
            }
        });

        if (appliedCount > 0) {
            console.log(`Szabály alkalmazva ${appliedCount} tranzakcióra`);
        }
    }

    // Auto-suggest category based on description/merchant
    suggestCategory(description) {
        if (!description) return 'other';
        
        const desc = description.toLowerCase();
        
        // Category mapping based on keywords
        const categoryMap = {
            'food': ['tesco', 'lidl', 'aldi', 'spar', 'auchan', 'penny', 'coop', 'cba', 'élelmiszer', 'pékség', 'hentes', 'zöldség'],
            'transport': ['mol', 'omv', 'shell', 'benzin', 'dízel', 'bkk', 'máv', 'volán', 'parkolás', 'útdíj'],
            'utilities': ['elmű', 'elmu', 'émász', 'emasz', 'főtáv', 'fotav', 'vízmű', 'vizmu', 'digi', 'telekom', 'vodafone', 'yettel'],
            'shopping': ['h&m', 'zara', 'media markt', 'ikea', 'decathlon', 'euronics', 'douglas', 'dm', 'rossmann', 'műszaki'],
            'entertainment': ['cinema', 'mozi', 'színház', 'szinhaz', 'netflix', 'spotify', 'koncert', 'fesztivál'],
            'health': ['gyógyszertár', 'gyogyszert', 'patika', 'kórház', 'korhaz', 'orvos', 'fogorvos', 'optika']
        };
        
        for (const [categoryId, keywords] of Object.entries(categoryMap)) {
            for (const keyword of keywords) {
                if (desc.includes(keyword)) {
                    return categoryId;
                }
            }
        }
        
        return 'other';
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ExpenseTracker();
});
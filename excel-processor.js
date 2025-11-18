// Excel Processing for Bank Statements
// Uses SheetJS for client-side Excel parsing

class ExcelProcessor {
    constructor() {
        this.xlsx = null;
        this.isLoaded = false;
        this.isLoading = false;
    }

    async ensureXLSXLoaded() {
        // If already loaded, return immediately
        if (this.isLoaded && window.XLSX) {
            return true;
        }

        // If currently loading, wait
        if (this.isLoading) {
            await new Promise(resolve => {
                const checkInterval = setInterval(() => {
                    if (this.isLoaded) {
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 100);
            });
            return true;
        }

        // Start loading
        this.isLoading = true;

        // Load XLSX library if not already loaded
        if (!window.XLSX) {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
            document.head.appendChild(script);
            
            // Wait for script to load
            await new Promise((resolve, reject) => {
                script.onload = () => {
                    if (window.XLSX) {
                        this.xlsx = window.XLSX;
                        this.isLoaded = true;
                        this.isLoading = false;
                        resolve();
                    } else {
                        reject(new Error('XLSX failed to load'));
                    }
                };
                script.onerror = () => {
                    this.isLoading = false;
                    reject(new Error('Failed to load XLSX library'));
                };
            });
        } else {
            this.xlsx = window.XLSX;
            this.isLoaded = true;
            this.isLoading = false;
        }

        return true;
    }

    async processExcel(file, bankType) {
        console.log(`Processing Excel file for ${bankType} bank...`);
        
        // Ensure XLSX is loaded
        await this.ensureXLSXLoaded();
        
        const arrayBuffer = await this.fileToArrayBuffer(file);
        const workbook = this.xlsx.read(arrayBuffer, { type: 'array' });
        
        // Get first worksheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON
        const jsonData = this.xlsx.utils.sheet_to_json(worksheet, { 
            header: 1, // Use array of arrays format
            defval: '' // Default value for empty cells
        });
        
        console.log('Excel data extracted:', jsonData.length, 'rows');
        
        // Parse based on bank type
        let transactions = [];
        switch(bankType) {
            case 'otp':
                transactions = this.parseOTPExcel(jsonData);
                break;
            case 'raiffeisen':
                transactions = this.parseRaiffeisenExcel(jsonData);
                break;
            case 'erste':
                transactions = this.parseErsteExcel(jsonData);
                break;
            case 'revolut':
                transactions = this.parseRevolutExcel(jsonData);
                break;
            default:
                transactions = this.parseGenericExcel(jsonData);
        }
        
        return transactions;
    }

    fileToArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    parseOTPExcel(data) {
        console.log('Parsing OTP Excel...');
        const transactions = [];
        
        // Find header row
        let headerRowIndex = -1;
        for (let i = 0; i < Math.min(10, data.length); i++) {
            const row = data[i];
            if (row && (
                row.some(cell => typeof cell === 'string' && cell.toLowerCase().includes('dátum')) ||
                row.some(cell => typeof cell === 'string' && cell.toLowerCase().includes('összeg')) ||
                row.some(cell => typeof cell === 'string' && cell.toLowerCase().includes('tranzakció'))
            )) {
                headerRowIndex = i;
                break;
            }
        }

        if (headerRowIndex === -1) {
            console.log('Header not found, using generic parsing');
            return this.parseGenericExcel(data);
        }

        const headers = data[headerRowIndex].map(h => (h || '').toString().toLowerCase());
        const dateColIndex = this.findColumnIndex(headers, ['dátum', 'date', 'könyvelés']);
        const descColIndex = this.findColumnIndex(headers, ['megnevezés', 'description', 'tranzakció', 'leírás']);
        const amountColIndex = this.findColumnIndex(headers, ['összeg', 'amount', 'érték']);

        if (dateColIndex === -1 || amountColIndex === -1) {
            console.log('Required columns not found, using generic parsing');
            return this.parseGenericExcel(data);
        }

        // Process data rows
        for (let i = headerRowIndex + 1; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length === 0) continue;

            const dateCell = row[dateColIndex];
            const descCell = row[descColIndex] || '';
            const amountCell = row[amountColIndex];

            if (!dateCell || !amountCell) continue;

            const transaction = {
                id: Date.now() + Math.random(),
                date: this.parseExcelDate(dateCell),
                merchant: this.extractMerchant(descCell.toString()),
                description: descCell.toString(),
                amount: this.parseExcelAmount(amountCell),
                category: this.suggestCategory(descCell.toString()),
                bank: 'OTP'
            };

            if (transaction.date && transaction.amount !== 0) {
                transactions.push(transaction);
            }
        }

        console.log(`Parsed ${transactions.length} OTP Excel transactions`);
        return transactions;
    }

    parseRaiffeisenExcel(data) {
        console.log('Parsing Raiffeisen Excel...');
        const transactions = [];
        
        // Raiffeisen Excel format is similar to OTP but with different column names
        let headerRowIndex = -1;
        for (let i = 0; i < Math.min(10, data.length); i++) {
            const row = data[i];
            if (row && (
                row.some(cell => typeof cell === 'string' && cell.toLowerCase().includes('értéknap')) ||
                row.some(cell => typeof cell === 'string' && cell.toLowerCase().includes('terhelés')) ||
                row.some(cell => typeof cell === 'string' && cell.toLowerCase().includes('jóváírás'))
            )) {
                headerRowIndex = i;
                break;
            }
        }

        if (headerRowIndex === -1) {
            return this.parseGenericExcel(data);
        }

        const headers = data[headerRowIndex].map(h => (h || '').toString().toLowerCase());
        const dateColIndex = this.findColumnIndex(headers, ['értéknap', 'dátum', 'date']);
        const descColIndex = this.findColumnIndex(headers, ['megnevezés', 'tranzakció megnevezése', 'leírás']);
        const debitColIndex = this.findColumnIndex(headers, ['terhelés', 'debit']);
        const creditColIndex = this.findColumnIndex(headers, ['jóváírás', 'credit']);

        if (dateColIndex === -1 || (debitColIndex === -1 && creditColIndex === -1)) {
            return this.parseGenericExcel(data);
        }

        // Process data rows
        for (let i = headerRowIndex + 1; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length === 0) continue;

            const dateCell = row[dateColIndex];
            const descCell = row[descColIndex] || '';
            const debitCell = row[debitColIndex] || 0;
            const creditCell = row[creditColIndex] || 0;

            if (!dateCell) continue;

            // Calculate amount (debit is negative, credit is positive)
            let amount = 0;
            if (debitCell) {
                amount = -Math.abs(this.parseExcelAmount(debitCell));
            } else if (creditCell) {
                amount = Math.abs(this.parseExcelAmount(creditCell));
            }

            if (amount === 0) continue;

            const transaction = {
                id: Date.now() + Math.random(),
                date: this.parseExcelDate(dateCell),
                merchant: this.extractMerchant(descCell.toString()),
                description: descCell.toString(),
                amount: amount,
                category: this.suggestCategory(descCell.toString()),
                bank: 'Raiffeisen'
            };

            if (transaction.date) {
                transactions.push(transaction);
            }
        }

        console.log(`Parsed ${transactions.length} Raiffeisen Excel transactions`);
        return transactions;
    }

    parseErsteExcel(data) {
        console.log('Parsing Erste Excel...');
        // Similar to OTP format
        return this.parseOTPExcel(data);
    }

    parseRevolutExcel(data) {
        console.log('Parsing Revolut Excel...');
        const transactions = [];
        
        // Revolut typically has: Date, Description, Amount, Currency
        let headerRowIndex = -1;
        for (let i = 0; i < Math.min(5, data.length); i++) {
            const row = data[i];
            if (row && row.some(cell => 
                typeof cell === 'string' && 
                (cell.toLowerCase().includes('date') || cell.toLowerCase().includes('started'))
            )) {
                headerRowIndex = i;
                break;
            }
        }

        if (headerRowIndex === -1) {
            return this.parseGenericExcel(data);
        }

        const headers = data[headerRowIndex].map(h => (h || '').toString().toLowerCase());
        const dateColIndex = this.findColumnIndex(headers, ['date', 'started date', 'completed date']);
        const descColIndex = this.findColumnIndex(headers, ['description', 'reference']);
        const amountColIndex = this.findColumnIndex(headers, ['amount', 'paid in', 'paid out']);

        if (dateColIndex === -1 || amountColIndex === -1) {
            return this.parseGenericExcel(data);
        }

        // Process data rows
        for (let i = headerRowIndex + 1; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length === 0) continue;

            const dateCell = row[dateColIndex];
            const descCell = row[descColIndex] || '';
            const amountCell = row[amountColIndex];

            if (!dateCell || !amountCell) continue;

            const transaction = {
                id: Date.now() + Math.random(),
                date: this.parseExcelDate(dateCell),
                merchant: this.extractMerchant(descCell.toString()),
                description: descCell.toString(),
                amount: this.parseExcelAmount(amountCell),
                category: this.suggestCategory(descCell.toString()),
                bank: 'Revolut'
            };

            if (transaction.date && transaction.amount !== 0) {
                transactions.push(transaction);
            }
        }

        console.log(`Parsed ${transactions.length} Revolut Excel transactions`);
        return transactions;
    }

    parseGenericExcel(data) {
        console.log('Parsing with generic Excel parser...');
        const transactions = [];
        
        if (data.length < 2) return transactions;

        // Try to auto-detect columns
        let headerRowIndex = 0;
        for (let i = 0; i < Math.min(5, data.length); i++) {
            const row = data[i];
            if (row && row.length >= 3) {
                headerRowIndex = i;
                break;
            }
        }

        const headers = data[headerRowIndex].map(h => (h || '').toString().toLowerCase());
        
        // Try common column patterns
        const dateColIndex = this.findColumnIndex(headers, [
            'date', 'dátum', 'értéknap', 'könyvelés', 'started'
        ]);
        const descColIndex = this.findColumnIndex(headers, [
            'description', 'megnevezés', 'leírás', 'tranzakció', 'reference'
        ]);
        const amountColIndex = this.findColumnIndex(headers, [
            'amount', 'összeg', 'érték', 'paid', 'value'
        ]);

        // If we can't find proper columns, try positional
        const finalDateCol = dateColIndex !== -1 ? dateColIndex : 0;
        const finalDescCol = descColIndex !== -1 ? descColIndex : 1;
        const finalAmountCol = amountColIndex !== -1 ? amountColIndex : 2;

        // Process data rows
        for (let i = headerRowIndex + 1; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length < 3) continue;

            const dateCell = row[finalDateCol];
            const descCell = row[finalDescCol] || '';
            const amountCell = row[finalAmountCol];

            if (!dateCell || !amountCell) continue;

            const transaction = {
                id: Date.now() + Math.random(),
                date: this.parseExcelDate(dateCell),
                merchant: this.extractMerchant(descCell.toString()),
                description: descCell.toString(),
                amount: this.parseExcelAmount(amountCell),
                category: 'other',
                bank: 'Generic'
            };

            if (transaction.date && transaction.amount !== 0) {
                transactions.push(transaction);
            }
        }

        console.log(`Parsed ${transactions.length} generic Excel transactions`);
        return transactions;
    }

    findColumnIndex(headers, searchTerms) {
        for (let term of searchTerms) {
            for (let i = 0; i < headers.length; i++) {
                if (headers[i] && headers[i].includes(term)) {
                    return i;
                }
            }
        }
        return -1;
    }

    parseExcelDate(dateValue) {
        if (!dateValue) return null;

        // If it's already a Date object
        if (dateValue instanceof Date) {
            return dateValue.toISOString().split('T')[0];
        }

        // If it's an Excel serial date number
        if (typeof dateValue === 'number') {
            // Excel date serial (days since 1900-01-01)
            const excelEpoch = new Date(1899, 11, 30); // Excel's epoch
            const date = new Date(excelEpoch.getTime() + dateValue * 24 * 60 * 60 * 1000);
            return date.toISOString().split('T')[0];
        }

        // If it's a string, try to parse
        if (typeof dateValue === 'string') {
            // Handle Hungarian format: YYYY.MM.DD
            if (/^\d{4}\.\d{2}\.\d{2}$/.test(dateValue)) {
                const [year, month, day] = dateValue.split('.');
                return `${year}-${month}-${day}`;
            }
            
            // Handle DD.MM.YYYY format  
            if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateValue)) {
                const [day, month, year] = dateValue.split('.');
                return `${year}-${month}-${day}`;
            }
            
            // Handle ISO format YYYY-MM-DD
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
                return dateValue;
            }
            
            // Handle DD/MM/YYYY format
            if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateValue)) {
                const [day, month, year] = dateValue.split('/');
                return `${year}-${month}-${day}`;
            }

            // Try to parse as a general date
            const date = new Date(dateValue);
            if (!isNaN(date)) {
                return date.toISOString().split('T')[0];
            }
        }

        return null;
    }

    parseExcelAmount(amountValue) {
        if (typeof amountValue === 'number') {
            return amountValue;
        }

        if (typeof amountValue === 'string') {
            // Remove currency symbols and spaces
            let cleanAmount = amountValue.replace(/[^\d.,-]/g, '');
            
            // Handle Hungarian format: 1.234.567,89
            if (cleanAmount.includes('.') && cleanAmount.includes(',')) {
                // If both . and , are present, . is thousands separator, , is decimal
                cleanAmount = cleanAmount.replace(/\./g, '').replace(',', '.');
            } else if (cleanAmount.includes(',') && !cleanAmount.includes('.')) {
                // Only comma present - it's decimal separator
                cleanAmount = cleanAmount.replace(',', '.');
            }
            // If only . present, check if it's thousands or decimal
            else if (cleanAmount.includes('.')) {
                const parts = cleanAmount.split('.');
                // If multiple dots or last part has 3 digits, likely thousands separator
                if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
                    cleanAmount = cleanAmount.replace(/\./g, '');
                }
            }

            const amount = parseFloat(cleanAmount);
            return isNaN(amount) ? 0 : amount;
        }

        return 0;
    }

    extractMerchant(description) {
        if (!description) return 'Ismeretlen';
        
        // Take first few meaningful words
        const words = description.split(/\s+/).filter(word => word.length > 2);
        return words.slice(0, 3).join(' ') || 'Ismeretlen';
    }

    suggestCategory(description) {
        if (!description) return 'other';
        
        const desc = description.toLowerCase();
        
        // Basic category mapping
        if (desc.includes('tesco') || desc.includes('lidl') || desc.includes('spar')) {
            return 'food';
        }
        if (desc.includes('mol') || desc.includes('shell') || desc.includes('benzin')) {
            return 'transport';
        }
        if (desc.includes('átutalás') || desc.includes('transfer')) {
            return 'other';
        }
        
        return 'other';
    }
}

// Export for use in main app and testing
if (typeof window !== 'undefined') {
    window.ExcelProcessor = ExcelProcessor;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ExcelProcessor };
}
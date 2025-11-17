// PDF Processing for Bank Statements
// Uses PDF.js for client-side PDF parsing

class PDFProcessor {
    constructor() {
        this.pdfJSLoaded = false;
        this.pdfJSLoading = false;
    }

    async ensurePDFJSLoaded() {
        // If already loaded, return immediately
        if (this.pdfJSLoaded && window.pdfjsLib) {
            return true;
        }

        // If currently loading, wait
        if (this.pdfJSLoading) {
            await new Promise(resolve => {
                const checkInterval = setInterval(() => {
                    if (this.pdfJSLoaded) {
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 100);
            });
            return true;
        }

        // Start loading
        this.pdfJSLoading = true;

        // Load PDF.js library if not already loaded
        if (!window.pdfjsLib) {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            document.head.appendChild(script);
            
            // Wait for script to load
            await new Promise((resolve, reject) => {
                script.onload = () => {
                    // Configure worker
                    if (window.pdfjsLib) {
                        pdfjsLib.GlobalWorkerOptions.workerSrc = 
                            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                        this.pdfJSLoaded = true;
                        this.pdfJSLoading = false;
                        resolve();
                    } else {
                        reject(new Error('PDF.js failed to load'));
                    }
                };
                script.onerror = () => {
                    this.pdfJSLoading = false;
                    reject(new Error('Failed to load PDF.js library'));
                };
            });
        } else {
            this.pdfJSLoaded = true;
            this.pdfJSLoading = false;
        }

        return true;
    }

    async processPDF(file, bankType) {
        console.log(`Processing PDF for ${bankType} bank...`);
        
        // Ensure PDF.js is loaded
        await this.ensurePDFJSLoaded();
        
        const arrayBuffer = await this.fileToArrayBuffer(file);
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        
        // Extract text from all pages
        const textContent = await this.extractTextFromPDF(pdf);
        
        // Parse based on bank type
        let transactions = [];
        switch(bankType) {
            case 'otp':
                transactions = this.parseOTPStatement(textContent);
                break;
            case 'raiffeisen':
                transactions = this.parseRaiffeisenStatement(textContent);
                break;
            case 'erste':
                transactions = this.parseErsteStatement(textContent);
                break;
            case 'revolut':
                // Revolut typically doesn't use PDF
                alert('Revolut általában CSV formátumot használ');
                break;
            default:
                transactions = this.parseGenericStatement(textContent);
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

    async extractTextFromPDF(pdf) {
        const textContent = [];
        const numPages = pdf.numPages;
        
        for (let i = 1; i <= numPages; i++) {
            const page = await pdf.getPage(i);
            const text = await page.getTextContent();
            
            // Reconstruct text with proper positioning
            const pageText = this.reconstructText(text);
            textContent.push(pageText);
        }
        
        return textContent.join('\n');
    }

    reconstructText(textContent) {
        // Group text items by Y position (lines)
        const lines = {};
        
        textContent.items.forEach(item => {
            const y = Math.round(item.transform[5]);
            if (!lines[y]) {
                lines[y] = [];
            }
            lines[y].push({
                text: item.str,
                x: item.transform[4]
            });
        });
        
        // Sort lines by Y position (top to bottom)
        const sortedLines = Object.keys(lines)
            .sort((a, b) => b - a)
            .map(y => {
                // Sort items within line by X position (left to right)
                const sortedItems = lines[y].sort((a, b) => a.x - b.x);
                return sortedItems.map(item => item.text).join(' ');
            });
        
        return sortedLines.join('\n');
    }

    parseOTPStatement(text) {
        console.log('Parsing OTP statement...');
        const transactions = [];
        const lines = text.split('\n');
        
        // OTP PDF format patterns
        const datePattern = /(\d{4}[\.\/\-]\d{2}[\.\/\-]\d{2})/;
        const amountPattern = /([\-\+]?\s*[\d\s]+[,\.]\d{2})/;
        const balancePattern = /egyenleg.*?([\d\s]+[,\.]\d{2})/i;
        
        // State variables for parsing
        let currentTransaction = null;
        let isInTransactionSection = false;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Skip empty lines
            if (!line) continue;
            
            // Detect transaction section start
            if (line.includes('Tranzakciók') || line.includes('Könyvelés dátuma') || 
                line.includes('Értéknap') || line.includes('Terhelés') || line.includes('Jóváírás')) {
                isInTransactionSection = true;
                continue;
            }
            
            // Skip if not in transaction section yet
            if (!isInTransactionSection) continue;
            
            // Try to parse transaction line
            // OTP format: Date | Description | Debit/Credit | Balance
            const dateMatch = line.match(datePattern);
            
            if (dateMatch) {
                // Save previous transaction if exists
                if (currentTransaction && currentTransaction.amount !== 0) {
                    transactions.push(currentTransaction);
                }
                
                // Start new transaction
                currentTransaction = {
                    date: this.parseDate(dateMatch[1]),
                    description: '',
                    amount: 0,
                    balance: null,
                    raw: line
                };
                
                // Extract description and amount from the same line
                const afterDate = line.substring(line.indexOf(dateMatch[1]) + dateMatch[1].length).trim();
                
                // Look for amount patterns
                const amounts = afterDate.match(/[\-\+]?\s*[\d\s]+[,\.]\d{2}/g);
                if (amounts && amounts.length > 0) {
                    // Last amount is usually the balance, second to last is the transaction amount
                    const amountStr = amounts[amounts.length > 1 ? amounts.length - 2 : 0];
                    currentTransaction.amount = this.parseAmount(amountStr);
                    
                    if (amounts.length > 1) {
                        currentTransaction.balance = this.parseAmount(amounts[amounts.length - 1]);
                    }
                    
                    // Extract description (everything between date and first amount)
                    const firstAmountIndex = afterDate.indexOf(amounts[0]);
                    if (firstAmountIndex > 0) {
                        currentTransaction.description = afterDate.substring(0, firstAmountIndex).trim();
                    }
                } else {
                    // No amount found on this line, description might continue on next line
                    currentTransaction.description = afterDate;
                }
            } else if (currentTransaction && !datePattern.test(line)) {
                // Continuation of previous transaction description
                const amountMatch = line.match(amountPattern);
                if (amountMatch) {
                    if (currentTransaction.amount === 0) {
                        currentTransaction.amount = this.parseAmount(amountMatch[1]);
                    }
                    // Get description before amount
                    const beforeAmount = line.substring(0, line.indexOf(amountMatch[1])).trim();
                    if (beforeAmount) {
                        currentTransaction.description += ' ' + beforeAmount;
                    }
                } else {
                    // Just description continuation
                    currentTransaction.description += ' ' + line;
                }
            }
        }
        
        // Don't forget the last transaction
        if (currentTransaction && currentTransaction.amount !== 0) {
            transactions.push(currentTransaction);
        }
        
        // Post-process transactions
        return transactions.map(t => ({
            id: Date.now() + Math.random(),
            date: t.date,
            merchant: this.extractMerchant(t.description),
            description: this.cleanDescription(t.description),
            amount: t.amount,
            balance: t.balance,
            category: this.suggestCategory(t.description),
            bank: 'OTP'
        }));
    }

    parseRaiffeisenStatement(text) {
        // Similar structure for Raiffeisen
        console.log('Parsing Raiffeisen statement...');
        const transactions = [];
        // Implementation for Raiffeisen format
        return transactions;
    }

    parseErsteStatement(text) {
        // Similar structure for Erste
        console.log('Parsing Erste statement...');
        const transactions = [];
        // Implementation for Erste format
        return transactions;
    }

    parseGenericStatement(text) {
        // Try to detect common patterns
        console.log('Parsing with generic parser...');
        const transactions = [];
        const lines = text.split('\n');
        
        // Look for date and amount patterns
        for (const line of lines) {
            if (this.looksLikeTransaction(line)) {
                const transaction = this.parseGenericTransaction(line);
                if (transaction) {
                    transactions.push(transaction);
                }
            }
        }
        
        return transactions;
    }

    looksLikeTransaction(line) {
        // Check if line contains date and amount patterns
        const hasDate = /\d{4}[\.\/\-]\d{2}[\.\/\-]\d{2}/.test(line);
        const hasAmount = /[\d\s]+[,\.]\d{2}/.test(line);
        return hasDate && hasAmount;
    }

    parseGenericTransaction(line) {
        // Generic transaction parsing logic
        return null;
    }

    parseDate(dateStr) {
        // Handle various date formats
        dateStr = dateStr.replace(/\./g, '-').replace(/\//g, '-');
        
        // Try YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            return dateStr;
        }
        
        // Try DD-MM-YYYY
        if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
            const parts = dateStr.split('-');
            return `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        
        return dateStr;
    }

    parseAmount(amountStr) {
        if (!amountStr) return 0;
        
        // Remove spaces and convert comma to dot
        amountStr = amountStr.replace(/\s/g, '').replace(',', '.');
        
        // Parse as float
        const amount = parseFloat(amountStr);
        return isNaN(amount) ? 0 : amount;
    }

    extractMerchant(description) {
        // Common merchant patterns for Hungarian statements
        const patterns = [
            /^([A-Z][A-Z0-9\s\-\.]+?)(?:\s+BUDAPEST|\s+BP\.|\s+HU|\s+\d{4})/,
            /^([A-Z][A-Z0-9\s\-\.]+?)(?:\s+\*{4}\d{4})/,
            /^Vásárlás:?\s*(.+?)(?:\s+\d{4}|\s+kártya|$)/i,
            /^([A-Z][A-Z0-9\s\-\.]+?)$/
        ];
        
        for (const pattern of patterns) {
            const match = description.match(pattern);
            if (match) {
                return match[1].trim();
            }
        }
        
        // Return first few words as fallback
        const words = description.split(/\s+/).slice(0, 3);
        return words.join(' ');
    }

    cleanDescription(description) {
        // Clean up common bank-specific prefixes
        const prefixes = [
            'Kártyás vásárlás:',
            'Vásárlás:',
            'Átutalás:',
            'Készpénzfelvétel:',
            'Banki költség:',
            'POS vásárlás:',
            'Online vásárlás:'
        ];
        
        let cleaned = description;
        for (const prefix of prefixes) {
            if (cleaned.toLowerCase().startsWith(prefix.toLowerCase())) {
                cleaned = cleaned.substring(prefix.length).trim();
            }
        }
        
        // Remove multiple spaces
        cleaned = cleaned.replace(/\s+/g, ' ');
        
        return cleaned;
    }

    suggestCategory(description) {
        const desc = description.toLowerCase();
        
        // Category mapping based on keywords
        const categoryMap = {
            '🍔 Élelmiszer': ['tesco', 'lidl', 'aldi', 'spar', 'auchan', 'penny', 'coop', 'cba', 'élelmiszer', 'pékség', 'hentes', 'zöldség'],
            '🚗 Közlekedés': ['mol', 'omv', 'shell', 'benzin', 'dízel', 'bkk', 'máv', 'volán', 'parkolás', 'útdíj'],
            '🏠 Rezsi': ['elmű', 'elmu', 'émász', 'emasz', 'főtáv', 'fotav', 'vízmű', 'vizmu', 'digi', 'telekom', 'vodafone', 'yettel'],
            '🛍️ Vásárlás': ['h&m', 'zara', 'media markt', 'ikea', 'decathlon', 'euronics', 'douglas', 'dm', 'rossmann', 'műszaki'],
            '🎬 Szórakozás': ['cinema', 'mozi', 'színház', 'szinhaz', 'netflix', 'spotify', 'koncert', 'fesztivál'],
            '🏥 Egészség': ['gyógyszertár', 'gyogyszert', 'patika', 'kórház', 'korhaz', 'orvos', 'fogorvos', 'optika'],
            '🍽️ Étterem': ['étterem', 'restaurant', 'kávé', 'kave', 'cafe', 'büfé', 'bufe', 'pizz', 'gyors', 'mcdonald', 'burger', 'kebab']
        };
        
        for (const [category, keywords] of Object.entries(categoryMap)) {
            for (const keyword of keywords) {
                if (desc.includes(keyword)) {
                    return category;
                }
            }
        }
        
        return '📌 Egyéb';
    }
}

// Export for use in main app
window.PDFProcessor = PDFProcessor;
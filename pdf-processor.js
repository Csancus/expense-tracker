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
        
        // Find transaction section
        let inTransactionSection = false;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Skip empty lines
            if (!line) continue;
            
            // Start of transaction section
            if (line.includes('FORGALMAK') || line.includes('KÖNYVELÉS/ÉRTÉKNAP')) {
                inTransactionSection = true;
                continue;
            }
            
            // End of transaction section
            if (inTransactionSection && (
                line.includes('IDÕSZAK:') || 
                line.includes('JÓVÁÍRÁSOK ÖSSZESEN:') || 
                line.includes('TERHELÉSEK ÖSSZESEN:') ||
                line.includes('LAP/LAP')
            )) {
                break;
            }
            
            // Skip header lines
            if (line.includes('MEGNEVEZÉS') || line.includes('ÖSSZEG') || line.includes('NYITÓ EGYENLEG')) {
                continue;
            }
            
            // Parse transaction line if in section
            if (inTransactionSection) {
                const transaction = this.parseOTPTransactionLine(line, lines, i);
                if (transaction) {
                    transactions.push(transaction);
                }
            }
        }
        
        console.log(`Parsed ${transactions.length} OTP transactions`);
        return transactions;
    }

    parseOTPTransactionLine(line, allLines, lineIndex) {
        const trimmedLine = line.trim();
        
        // Must start with date pattern 25.07.28
        if (!/^\d{2}\.\d{2}\.\d{2}/.test(trimmedLine)) {
            return null;
        }
        
        // Skip balance lines
        if (trimmedLine.includes('NYITÓ EGYENLEG') || trimmedLine.includes('ZÁRÓ EGYENLEG')) {
            return null;
        }
        
        // Find the last number in the line (the amount)
        const amountMatch = trimmedLine.match(/([-+]?\d+(?:\.\d{3})*(?:,\d{2})?)$/);
        let amount = 0;
        let description = trimmedLine;
        
        if (amountMatch) {
            amount = this.parseAmount(amountMatch[1]);
            // Remove amount from description
            description = trimmedLine.substring(0, trimmedLine.lastIndexOf(amountMatch[1])).trim();
        }
        
        // If no amount found in this line, might be EUR conversion - check next line
        if (amount === 0 && lineIndex + 1 < allLines.length) {
            const nextLine = allLines[lineIndex + 1].trim();
            const eurMatch = nextLine.match(/([-+]?\d+(?:\.\d{3})*(?:,\d{2})?)$/);
            if (eurMatch) {
                amount = this.parseAmount(eurMatch[1]);
            }
        }
        
        // Skip if no amount found
        if (amount === 0) {
            return null;
        }
        
        // Extract date (first date in the line)
        const dateMatch = description.match(/^(\d{2}\.\d{2}\.\d{2})/);
        if (!dateMatch) {
            return null;
        }
        
        const transactionDate = dateMatch[1];
        
        // Remove date(s) from description  
        // Handle both single date (25.07.28) and double date (25.07.28 25.07.28)
        description = description.replace(/^\d{2}\.\d{2}\.\d{2}(\s+\d{2}\.\d{2}\.\d{2})?\s+/, '');
        
        // Clean description
        description = this.cleanOTPDescription(description);
        
        // Skip if no meaningful description left
        if (!description || description.length < 3) {
            return null;
        }
        
        return {
            id: Date.now() + Math.random(),
            date: this.parseOTPDate(transactionDate),
            merchant: this.extractOTPMerchant(description),
            description: description,
            amount: amount,
            category: this.suggestCategory(description),
            bank: 'OTP'
        };
    }

    parseOTPDate(otpDate) {
        // Convert 25.07.28 to 2025-07-28
        const parts = otpDate.split('.');
        if (parts.length === 3) {
            const year = '20' + parts[0]; // 25 -> 2025
            const month = parts[1];
            const day = parts[2];
            return `${year}-${month}-${day}`;
        }
        return otpDate;
    }

    cleanOTPDescription(description) {
        // Remove common OTP patterns
        let cleaned = description;
        
        // Remove card transaction prefixes
        cleaned = cleaned.replace(/^VÁSÁRLÁS KÁRTYÁVAL,\s*\d+,\s*\d+,\s*Tranzakció:\s*\d{2}\.\d{2}\.\d{2},\s*/, '');
        
        // Remove bank transfer prefixes
        cleaned = cleaned.replace(/^NAPKÖZBENI ÁTUTALÁS,\s*[^,]*,\s*[^,]*,\s*/, '');
        
        // Remove donation prefixes
        cleaned = cleaned.replace(/^ADOMÁNY,\s*[^,]*,\s*[^,]*,\s*[^,]*,\s*/, '');
        
        // Remove trailing EUR amounts and codes
        cleaned = cleaned.replace(/\s+\d+,\d+EUR.*$/, '');
        cleaned = cleaned.replace(/\s+-[A-Z]+.*$/, ''); // Remove -GOOGLE, -ÉRINTŐ etc.
        
        // Clean up extra spaces
        cleaned = cleaned.replace(/\s+/g, ' ').trim();
        
        return cleaned;
    }

    extractOTPMerchant(description) {
        // Extract merchant name from OTP description
        let merchant = description;
        
        // Handle special cases
        if (merchant.includes('GOOGLE *Google Play')) {
            return 'Google Play';
        }
        if (merchant.includes('PAYPAL *')) {
            const paypalMatch = merchant.match(/PAYPAL \*([^*]+)/);
            return paypalMatch ? paypalMatch[1].trim() : 'PayPal';
        }
        if (merchant.includes('LIDL ÁRUHÁZ')) {
            return 'LIDL';
        }
        if (merchant.includes('OTPdirekt HAVIDÍJ')) {
            return 'OTP Díj';
        }
        if (merchant.includes('COGNIZANT TECHNOLOGY')) {
            return 'Fizetés (Cognizant)';
        }
        if (merchant.includes('WWF Magyarország')) {
            return 'WWF Adomány';
        }
        if (merchant.includes('Revolut**')) {
            return 'Revolut';
        }
        
        // Take first meaningful words
        const words = merchant.split(' ');
        const meaningfulWords = words.filter(word => 
            word.length > 2 && 
            !word.match(/^\d+$/) && 
            !word.includes('*')
        );
        
        return meaningfulWords.slice(0, 2).join(' ') || words[0] || 'Ismeretlen';
    }

    parseRaiffeisenStatement(text) {
        console.log('Parsing Raiffeisen statement...');
        const transactions = [];
        const lines = text.split('\n');
        
        let inTransactionSection = false;
        let currentTransaction = null;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Skip empty lines
            if (!line) continue;
            
            // Start of transaction section (after "Könyvelés" header)
            if (line.includes('Könyvelés') || line.includes('Tétel azon.')) {
                inTransactionSection = true;
                continue;
            }
            
            // End of transaction section
            if (inTransactionSection && (
                line.includes('összes terhelés') || 
                line.includes('NYITÓEGYENLEG:') || 
                line.includes('ZÁRÓEGYENLEG:') ||
                line.includes('Oldal')
            )) {
                // Complete any pending transaction
                if (currentTransaction) {
                    const transaction = this.finalizeRaiffeisenTransaction(currentTransaction);
                    if (transaction) {
                        transactions.push(transaction);
                    }
                    currentTransaction = null;
                }
                break;
            }
            
            if (inTransactionSection) {
                // Look for transaction ID line (starts with numbers)
                const transactionMatch = line.match(/^(\d{10})\s+(\d{4}\.\d{2}\.\d{2}\.)\s+(.+?)$/);
                
                if (transactionMatch) {
                    // Complete previous transaction if exists
                    if (currentTransaction) {
                        const transaction = this.finalizeRaiffeisenTransaction(currentTransaction);
                        if (transaction) {
                            transactions.push(transaction);
                        }
                    }
                    
                    // Extract amount from the end of the line if present
                    const description = transactionMatch[3].trim();
                    const amountMatch = description.match(/^(.+?)\s+(-?\d{1,3}(?:\.\d{3})*(?:,\d{2})?)$/);
                    
                    // Start new transaction
                    currentTransaction = {
                        id: transactionMatch[1],
                        date: transactionMatch[2],
                        description: amountMatch ? amountMatch[1].trim() : description,
                        amount: amountMatch ? this.parseAmount(amountMatch[2]) : null,
                        additionalInfo: []
                    };
                } else if (currentTransaction) {
                    // Look for value date line
                    const valueDateMatch = line.match(/^(\d{4}\.\d{2}\.\d{2}\.)\s+(.+)$/);
                    if (valueDateMatch && !currentTransaction.valueDate) {
                        currentTransaction.valueDate = valueDateMatch[1];
                        
                        const valueDescription = valueDateMatch[2].trim();
                        const amountMatch = valueDescription.match(/^(.+?)\s+(-?\d{1,3}(?:\.\d{3})*(?:,\d{2})?)$/);
                        
                        if (amountMatch && !currentTransaction.amount) {
                            currentTransaction.amount = this.parseAmount(amountMatch[2]);
                            if (amountMatch[1].trim()) {
                                currentTransaction.additionalInfo.push(amountMatch[1].trim());
                            }
                        } else if (valueDescription && !amountMatch) {
                            currentTransaction.additionalInfo.push(valueDescription);
                        }
                    } else {
                        // Additional info lines
                        if (line.includes('Referencia:')) {
                            currentTransaction.reference = line.replace('Referencia:', '').trim();
                        } else if (line.includes('Kedvezményezett neve:')) {
                            currentTransaction.beneficiary = line.replace('Kedvezményezett neve:', '').trim();
                        } else if (line.includes('Átutaló neve:')) {
                            currentTransaction.sender = line.replace('Átutaló neve:', '').trim();
                        } else if (line.includes('Közlemény:')) {
                            currentTransaction.memo = line.replace('Közlemény:', '').trim();
                        } else if (line.includes('Előjegyzett díj:')) {
                            currentTransaction.fee = line.replace('Előjegyzett díj:', '').trim();
                        } else if (line.match(/^[A-Z]/) && !line.includes('HUF') && line.length > 5) {
                            // Other description lines
                            currentTransaction.additionalInfo.push(line);
                        }
                        
                        // Look for standalone amount lines
                        const standaloneAmountMatch = line.match(/^(-?\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*$/);
                        if (standaloneAmountMatch && !currentTransaction.amount) {
                            currentTransaction.amount = this.parseAmount(standaloneAmountMatch[1]);
                        }
                    }
                }
            }
        }
        
        // Complete final transaction
        if (currentTransaction) {
            const transaction = this.finalizeRaiffeisenTransaction(currentTransaction);
            if (transaction) {
                transactions.push(transaction);
            }
        }
        
        console.log(`Parsed ${transactions.length} Raiffeisen transactions`);
        return transactions;
    }

    finalizeRaiffeisenTransaction(rawTransaction) {
        if (!rawTransaction.amount || rawTransaction.amount === 0) {
            return null;
        }
        
        // Skip balance and summary lines
        if (rawTransaction.description && (
            rawTransaction.description.includes('NYITÓEGYENLEG') ||
            rawTransaction.description.includes('ZÁRÓEGYENLEG') ||
            rawTransaction.description.includes('összes terhelés') ||
            rawTransaction.description.toLowerCase().includes('kamat') && Math.abs(rawTransaction.amount) < 100
        )) {
            return null;
        }
        
        // Build merchant name and description
        let merchant = this.extractRaiffeisenMerchant(rawTransaction);
        let description = this.buildRaiffeisenDescription(rawTransaction);
        
        return {
            id: Date.now() + Math.random(),
            date: this.parseRaiffeisenDate(rawTransaction.date),
            merchant: merchant,
            description: description,
            amount: rawTransaction.amount,
            category: this.suggestCategory(merchant + ' ' + description),
            bank: 'Raiffeisen',
            reference: rawTransaction.reference || '',
            memo: rawTransaction.memo || ''
        };
    }

    parseRaiffeisenDate(dateStr) {
        // Convert 2025.10.01. to 2025-10-01
        if (dateStr && dateStr.includes('.')) {
            const parts = dateStr.replace(/\./g, '').split('');
            if (parts.length >= 8) {
                const year = parts.slice(0, 4).join('');
                const month = parts.slice(4, 6).join('');
                const day = parts.slice(6, 8).join('');
                return `${year}-${month}-${day}`;
            }
        }
        return dateStr;
    }

    extractRaiffeisenMerchant(transaction) {
        // Prioritize beneficiary or sender names
        if (transaction.beneficiary) {
            return this.cleanRaiffeisenName(transaction.beneficiary);
        }
        
        if (transaction.sender) {
            return this.cleanRaiffeisenName(transaction.sender);
        }
        
        // Extract from description
        let description = transaction.description || '';
        
        // Handle specific transaction types
        if (description.includes('Elektronikus forint átutalás')) {
            return transaction.beneficiary || 'Átutalás';
        }
        
        if (description.includes('Elektronikus bankon belüli átutalás')) {
            return transaction.sender || 'Belső átutalás';
        }
        
        if (description.includes('Díj, jutalék')) {
            return 'Raiffeisen Díj';
        }
        
        if (description.includes('Egyéb jóváírás')) {
            return 'Promóciós jóváírás';
        }
        
        // Default to first few words of description
        const words = description.split(' ').slice(0, 3);
        return words.join(' ') || 'Ismeretlen';
    }

    cleanRaiffeisenName(name) {
        if (!name) return 'Ismeretlen';
        
        // Remove common suffixes
        let cleaned = name
            .replace(/\s+(KFT|ZRT|BT|EGY[ÉE]NI V[ÁA]LLALKOZ[ÓO]|KORL[ÁA]TOLT FELEL[ŐO]SS[ÉE]G[ŰU]|T[ÁA]RSA)[^A-Za-z]*/gi, '')
            .replace(/\s+EGY[ÉE]NI\s*/gi, ' ')
            .trim();
        
        // Take first meaningful words
        const words = cleaned.split(/\s+/).slice(0, 3);
        return words.join(' ') || name;
    }

    buildRaiffeisenDescription(transaction) {
        const parts = [];
        
        // Add main description
        if (transaction.description) {
            parts.push(transaction.description);
        }
        
        // Add additional info
        if (transaction.additionalInfo && transaction.additionalInfo.length > 0) {
            parts.push(...transaction.additionalInfo.slice(0, 2)); // Limit to avoid too long descriptions
        }
        
        // Add memo if meaningful
        if (transaction.memo && transaction.memo.length > 3) {
            parts.push(`(${transaction.memo})`);
        }
        
        return parts.join(' ').substring(0, 200); // Limit length
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
        
        // Hungarian number format: 1.234.567,89 
        // Remove spaces first
        amountStr = amountStr.replace(/\s/g, '');
        
        // Check if it has both dots and comma (Hungarian format)
        if (amountStr.includes('.') && amountStr.includes(',')) {
            // Remove thousand separators (dots) and convert decimal comma to dot
            amountStr = amountStr.replace(/\./g, '').replace(',', '.');
        } else if (amountStr.includes(',')) {
            // Only comma, treat as decimal separator
            amountStr = amountStr.replace(',', '.');
        }
        // If only dots, assume it's thousand separators for whole numbers
        
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
        
        // Category mapping based on keywords - now returns category IDs
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
        
        return 'other'; // Default to 'other' category ID
    }
}

// Export for use in main app
if (typeof window !== 'undefined') {
    window.PDFProcessor = PDFProcessor;
}

// Export for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PDFProcessor };
}
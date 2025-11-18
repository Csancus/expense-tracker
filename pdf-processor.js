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
        // Skip lines that don't start with a date pattern (25.07.28)
        const datePattern = /^(\d{2}\.\d{2}\.\d{2})/;
        const dateMatch = line.match(datePattern);
        
        if (!dateMatch) {
            return null;
        }
        
        const bookingDate = dateMatch[1];
        
        // OTP 2025 format: 25.07.28 25.07.28 VÁSÁRLÁS KÁRTYÁVAL, 8460878289, 0000001300274868, Tranzakció: 25.07.24, GOOGLE *Google Play Ap -GOOGLE -2.714
        
        // Extract components
        const parts = line.split(/\s+/);
        
        // Value date is usually the second date
        const valueDate = parts.length > 1 && /^\d{2}\.\d{2}\.\d{2}$/.test(parts[1]) ? parts[1] : bookingDate;
        
        // Find the amount (negative or positive number, usually at the end)
        let amount = 0;
        let amountIndex = -1;
        
        // Look for amount pattern: -2.714, 448.599, -164, etc.
        for (let j = parts.length - 1; j >= 0; j--) {
            const part = parts[j];
            // Match patterns like: -2.714, 448.599, -164
            if (/^[-+]?\d+(?:\.\d{3})*(?:,\d{2})?$/.test(part)) {
                amount = this.parseAmount(part);
                amountIndex = j;
                break;
            }
        }
        
        // If no amount found, try to find it in the next line (EUR conversion case)
        if (amount === 0 && lineIndex + 1 < allLines.length) {
            const nextLine = allLines[lineIndex + 1];
            // Look for patterns like: "6,800EUR 0," followed by amount
            const eurMatch = nextLine.match(/[\d,]+EUR\s+\d+,?\s*([-]?\d+(?:\.\d{3})*(?:,\d{2})?)/);
            if (eurMatch) {
                amount = this.parseAmount(eurMatch[1]);
            }
        }
        
        // Extract description (between value date and amount)
        let description = '';
        const startIndex = valueDate === bookingDate ? 2 : 3; // Skip booking date and value date
        const endIndex = amountIndex > 0 ? amountIndex : parts.length;
        
        if (endIndex > startIndex) {
            description = parts.slice(startIndex, endIndex).join(' ');
        } else {
            // Fallback: take everything after dates
            description = parts.slice(startIndex).join(' ');
        }
        
        // Clean up description
        description = this.cleanOTPDescription(description);
        
        // Skip if we couldn't extract meaningful data
        if (!description || description.length < 3) {
            return null;
        }
        
        return {
            id: Date.now() + Math.random(),
            date: this.parseOTPDate(bookingDate),
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
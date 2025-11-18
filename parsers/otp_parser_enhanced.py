"""
Enhanced OTP Bank PDF Parser
Based on real OTP bankszámlakivonat structure from 2025
"""

import re
from datetime import datetime
from typing import List, Dict, Optional
from dataclasses import dataclass


@dataclass
class OTPTransaction:
    """OTP specific transaction model"""
    booking_date: str  # Könyvelés dátuma (25.07.28)
    value_date: str    # Értéknap (25.07.28)
    description: str   # Megnevezés
    amount: float     # Összeg (negative for expenses)
    currency: str = "HUF"
    transaction_id: Optional[str] = None
    card_number: Optional[str] = None
    merchant: Optional[str] = None
    category: Optional[str] = None


class OTPPDFParser:
    """Enhanced OTP PDF parser for 2025 format"""
    
    def __init__(self):
        self.transactions: List[OTPTransaction] = []
        
        # Transaction patterns for OTP 2025 format
        self.transaction_patterns = [
            # VÁSÁRLÁS KÁRTYÁVAL pattern
            r'(\d{2}\.\d{2}\.\d{2})\s+(\d{2}\.\d{2}\.\d{2})\s+VÁSÁRLÁS KÁRTYÁVAL,\s+(\d+),\s+(\d+),\s+Tranzakció:\s+\d{2}\.\d{2}\.\d{2},\s+(.+?)\s+([-]?\d+(?:\.\d{3})*(?:,\d{2})?|\d+\.\d{3}EUR)',
            
            # NAPKÖZBENI ÁTUTALÁS pattern
            r'(\d{2}\.\d{2}\.\d{2})\s+(\d{2}\.\d{2}\.\d{2})\s+NAPKÖZBENI ÁTUTALÁS,\s+(.+?)\s+([-]?\d+(?:\.\d{3})*(?:,\d{2})?)',
            
            # OTPdirekt HAVIDÍJ pattern
            r'(\d{2}\.\d{2}\.\d{2})\s+(\d{2}\.\d{2}\.\d{2})\s+OTPdirekt HAVIDÍJ\*\s+([-]?\d+)',
            
            # ADOMÁNY pattern
            r'(\d{2}\.\d{2}\.\d{2})\s+(\d{2}\.\d{2}\.\d{2})\s+ADOMÁNY,\s+(.+?)\s+([-]?\d+(?:\.\d{3})*(?:,\d{2})?)',
            
            # ÉRTÉKPAPÍR SZLADÍJ pattern
            r'(\d{2}\.\d{2}\.\d{2})\s+(\d{2}\.\d{2}\.\d{2})\s+ÉRTÉKPAPÍR SZLADÍJ,\s+(.+?)\s+([-]?\d+)',
            
            # General bank fees pattern
            r'(\d{2}\.\d{2}\.\d{2})\s+(\d{2}\.\d{2}\.\d{2})\s+([A-ZÁÖÜÓŐŰÍ/\s]+DÍJ\*?)\s+([-]?\d+)',
        ]
        
        # Merchant name cleaning patterns
        self.merchant_patterns = [
            # Google services
            (r'GOOGLE \*Google Play Ap', 'Google Play'),
            (r'GOOGLE \*(.+)', r'\1'),
            
            # PayPal services
            (r'PAYPAL \*(.+)', r'\1'),
            
            # Common merchants
            (r'LIDL ÁRUHÁZ \d+\.SZ\.', 'LIDL'),
            (r'CBA PRåMA \d+\. ABC ÁR', 'CBA'),
            (r'DM \d+', 'DM Drogerie'),
            (r'MÖMAX BUDAPEST\d+\.', 'MÖMAX'),
            (r'Tizproba Magyarorszag', 'Tizproba'),
            (r'SIMPLEP\*(.+)', r'\1'),
            (r'Revolut\*\*\d+\*', 'Revolut'),
            
            # Remove location and extra info
            (r'(.+?)\s+-GOOGLE.*', r'\1'),
            (r'(.+?)\s+-ÉRINTŐ.*', r'\1'),
            (r'(.+?)\s+\d+,\d+EUR.*', r'\1'),
        ]
        
        # Category mapping for Hungarian merchants
        self.category_mapping = {
            # Food & Grocery
            'LIDL': '🍔 Élelmiszer',
            'TESCO': '🍔 Élelmiszer',
            'CBA': '🍔 Élelmiszer',
            'AUCHAN': '🍔 Élelmiszer',
            'SPAR': '🍔 Élelmiszer',
            
            # Drugstore & Personal care
            'DM Drogerie': '🧴 Drogéria',
            'ROSSMANN': '🧴 Drogéria',
            
            # Fuel & Transport
            'MOL': '🚗 Közlekedés',
            'OMV': '🚗 Közlekedés',
            'SHELL': '🚗 Közlekedés',
            'BKK': '🚗 Közlekedés',
            'MÁV': '🚗 Közlekedés',
            
            # Utilities
            'MVM NEXT': '🏠 Rezsi',
            'ELMŰ': '🏠 Rezsi',
            'ÉMASZ': '🏠 Rezsi',
            'FŐTÁV': '🏠 Rezsi',
            
            # Telecom
            'TELEKOMSZAML': '📱 Telekommunikáció',
            'VODAFONE': '📱 Telekommunikáció',
            'TELENOR': '📱 Telekommunikáció',
            
            # Entertainment & Subscriptions
            'NETFLIX': '🎬 Szórakozás',
            'HBO': '🎬 Szórakozás',
            'SPOTIFY': '🎵 Zene',
            'Google Play': '📱 Alkalmazások',
            'DISNEY': '🎬 Szórakozás',
            
            # Shopping & Retail
            'MÖMAX': '🛍️ Bútor',
            'IKEA': '🛍️ Bútor',
            'H&M': '👕 Ruházat',
            'ZARA': '👕 Ruházat',
            
            # Services
            'PostaCsekk': '📮 Postai szolgáltatás',
            'FRESSNAPF': '🐕 Állateledel',
            
            # Banking
            'OTPdirekt': '🏦 Banki díj',
            'ÉRTÉKPAPÍR': '📈 Befektetés',
            
            # Charity
            'WWF': '💚 Jótékonyság',
            'UNICEF': '💚 Jótékonyság',
        }

    def parse_pdf_content(self, content: str) -> List[OTPTransaction]:
        """Parse OTP PDF content and extract transactions"""
        
        # Split content into lines
        lines = content.split('\n')
        
        # Find the transaction section
        transaction_section = self._extract_transaction_section(lines)
        
        if not transaction_section:
            return []
        
        # Parse transactions from the section
        transactions = self._parse_transactions(transaction_section)
        
        # Clean and categorize transactions
        for transaction in transactions:
            transaction.merchant = self._clean_merchant_name(transaction.description)
            transaction.category = self._suggest_category(transaction.merchant)
        
        self.transactions = transactions
        return transactions

    def _extract_transaction_section(self, lines: List[str]) -> str:
        """Extract the FORGALMAK section from PDF content"""
        
        transaction_lines = []
        in_transaction_section = False
        
        for line in lines:
            # Start of transaction section
            if 'FORGALMAK' in line or 'KÖNYVELÉS/ÉRTÉKNAP' in line:
                in_transaction_section = True
                continue
            
            # End markers
            if in_transaction_section and any(marker in line for marker in [
                'IDÕSZAK:', 'JÓVÁÍRÁSOK ÖSSZESEN:', 'TERHELÉSEK ÖSSZESEN:', 
                'ZÁRÓ EGYENLEG', 'LAP/LAP', 'TOVÁBBI SZÁMLAINFORMÁCIÓK'
            ]):
                break
            
            # Collect transaction lines
            if in_transaction_section and line.strip():
                # Skip header lines
                if not any(skip in line for skip in ['MEGNEVEZÉS', 'ÖSSZEG', 'NYITÓ EGYENLEG']):
                    transaction_lines.append(line)
        
        return '\n'.join(transaction_lines)

    def _parse_transactions(self, content: str) -> List[OTPTransaction]:
        """Parse individual transactions from content"""
        
        transactions = []
        lines = content.split('\n')
        
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            
            if not line:
                i += 1
                continue
            
            # Try to match transaction patterns
            transaction = self._parse_transaction_line(line, lines, i)
            
            if transaction:
                transactions.append(transaction)
            
            i += 1
        
        return transactions

    def _parse_transaction_line(self, line: str, all_lines: List[str], line_index: int) -> Optional[OTPTransaction]:
        """Parse a single transaction line"""
        
        # Card transaction pattern (most common)
        card_pattern = r'(\d{2}\.\d{2}\.\d{2})\s+(\d{2}\.\d{2}\.\d{2})\s+VÁSÁRLÁS KÁRTYÁVAL,\s+(\d+),\s+(\d+),\s+Tranzakció:\s+\d{2}\.\d{2}\.\d{2},\s+(.+?)\s+([-]?\d+(?:\.\d{3})*(?:,\d{2})?)'
        
        match = re.search(card_pattern, line)
        if match:
            booking_date = self._parse_date(match.group(1))
            value_date = self._parse_date(match.group(2))
            card_number = match.group(3)
            transaction_id = match.group(4)
            description = match.group(5).strip()
            amount_str = match.group(6)
            
            # Handle EUR amounts (check next lines for EUR amounts)
            if line_index + 1 < len(all_lines):
                next_line = all_lines[line_index + 1].strip()
                eur_match = re.search(r'([\d,]+)EUR\s+(\d+),?\s*([-]?\d+(?:\.\d{3})*(?:,\d{2})?)', next_line)
                if eur_match:
                    amount_str = eur_match.group(3)  # Use HUF amount
            
            amount = self._parse_amount(amount_str)
            
            return OTPTransaction(
                booking_date=booking_date,
                value_date=value_date,
                description=description,
                amount=amount,
                transaction_id=transaction_id,
                card_number=card_number
            )
        
        # Bank transfer pattern
        transfer_pattern = r'(\d{2}\.\d{2}\.\d{2})\s+(\d{2}\.\d{2}\.\d{2})\s+NAPKÖZBENI ÁTUTALÁS,\s+(.+?)\s+([-]?\d+(?:\.\d{3})*(?:,\d{2})?)'
        match = re.search(transfer_pattern, line)
        if match:
            booking_date = self._parse_date(match.group(1))
            value_date = self._parse_date(match.group(2))
            description = match.group(3).strip()
            amount = self._parse_amount(match.group(4))
            
            return OTPTransaction(
                booking_date=booking_date,
                value_date=value_date,
                description=description,
                amount=amount
            )
        
        # Bank fee pattern
        fee_pattern = r'(\d{2}\.\d{2}\.\d{2})\s+(\d{2}\.\d{2}\.\d{2})\s+(OTPdirekt HAVIDÍJ\*|ÉRTÉKPAPÍR SZLADÍJ|.*DÍJ\*?)\s+([-]?\d+)'
        match = re.search(fee_pattern, line)
        if match:
            booking_date = self._parse_date(match.group(1))
            value_date = self._parse_date(match.group(2))
            description = match.group(3).strip()
            amount = self._parse_amount(match.group(4))
            
            return OTPTransaction(
                booking_date=booking_date,
                value_date=value_date,
                description=description,
                amount=amount
            )
        
        # Donation pattern
        donation_pattern = r'(\d{2}\.\d{2}\.\d{2})\s+(\d{2}\.\d{2}\.\d{2})\s+ADOMÁNY,\s+(.+?)\s+([-]?\d+(?:\.\d{3})*(?:,\d{2})?)'
        match = re.search(donation_pattern, line)
        if match:
            booking_date = self._parse_date(match.group(1))
            value_date = self._parse_date(match.group(2))
            description = match.group(3).strip()
            amount = self._parse_amount(match.group(4))
            
            return OTPTransaction(
                booking_date=booking_date,
                value_date=value_date,
                description=description,
                amount=amount
            )
        
        return None

    def _parse_date(self, date_str: str) -> str:
        """Parse OTP date format (25.07.28) to ISO format"""
        if not date_str:
            return ""
        
        try:
            # OTP uses YY.MM.DD format with 25 meaning 2025
            parts = date_str.split('.')
            if len(parts) == 3:
                year = f"20{parts[0]}"  # 25 -> 2025
                month = parts[1]
                day = parts[2]
                return f"{year}-{month}-{day}"
        except Exception:
            pass
        
        return date_str

    def _parse_amount(self, amount_str: str) -> float:
        """Parse Hungarian amount format"""
        if not amount_str:
            return 0.0
        
        # Clean the amount string
        # Remove spaces and handle negative amounts
        cleaned = amount_str.strip()
        
        # Handle formats like: -2.714, 448.599, -1.000
        cleaned = cleaned.replace(' ', '')
        
        # Convert comma to dot for decimal places
        if ',' in cleaned:
            cleaned = cleaned.replace(',', '.')
        
        try:
            return float(cleaned)
        except ValueError:
            return 0.0

    def _clean_merchant_name(self, description: str) -> str:
        """Clean and extract merchant name from description"""
        
        merchant = description
        
        # Apply merchant patterns
        for pattern, replacement in self.merchant_patterns:
            merchant = re.sub(pattern, replacement, merchant, flags=re.IGNORECASE)
        
        # Remove common suffixes and clean up
        merchant = re.sub(r'\s+-[A-Z]+.*$', '', merchant)  # Remove -GOOGLE etc.
        merchant = re.sub(r'\s+\d+,\d+EUR.*$', '', merchant)  # Remove EUR amounts
        merchant = re.sub(r'\s+\d+\.\d+.*$', '', merchant)  # Remove numbers at end
        
        # Take first meaningful part
        words = merchant.split()
        if len(words) > 0:
            # For single word merchants, return as is
            if len(words) == 1:
                return words[0]
            
            # For multiple words, take first 2-3 meaningful words
            meaningful_words = []
            for word in words[:3]:
                if len(word) > 2 and not word.isdigit():
                    meaningful_words.append(word)
            
            return ' '.join(meaningful_words[:2]) if meaningful_words else words[0]
        
        return description[:20]  # Fallback

    def _suggest_category(self, merchant: str) -> str:
        """Suggest category based on merchant name"""
        
        merchant_upper = merchant.upper()
        
        # Direct match
        for known_merchant, category in self.category_mapping.items():
            if known_merchant.upper() in merchant_upper:
                return category
        
        # Keyword-based matching
        if any(food in merchant_upper for food in ['LIDL', 'TESCO', 'CBA', 'AUCHAN', 'SPAR', 'PENNY']):
            return '🍔 Élelmiszer'
        elif any(fuel in merchant_upper for fuel in ['MOL', 'OMV', 'SHELL', 'BENZIN']):
            return '🚗 Közlekedés'
        elif any(util in merchant_upper for util in ['MVM', 'ELMŰ', 'ÉMASZ', 'FŐTÁV']):
            return '🏠 Rezsi'
        elif any(stream in merchant_upper for stream in ['NETFLIX', 'HBO', 'SPOTIFY', 'DISNEY']):
            return '🎬 Szórakozás'
        elif any(shop in merchant_upper for shop in ['H&M', 'ZARA', 'IKEA', 'MÖMAX']):
            return '🛍️ Vásárlás'
        elif 'GOOGLE' in merchant_upper:
            return '📱 Alkalmazások'
        elif 'PAYPAL' in merchant_upper:
            return '💳 Online fizetés'
        elif any(bank in merchant_upper for bank in ['OTP', 'DÍJ', 'HAVIDÍJ']):
            return '🏦 Banki díj'
        elif 'ADOMÁNY' in merchant_upper or any(charity in merchant_upper for charity in ['WWF', 'UNICEF']):
            return '💚 Jótékonyság'
        
        return '📌 Egyéb'


# Example usage and test
if __name__ == "__main__":
    # Test with sample OTP content
    sample_content = """
25.07.28 25.07.28 VÁSÁRLÁS KÁRTYÁVAL, 8460878289, 0000001300274868, Tranzakció: 25.07.24, GOOGLE *Google Play Ap -GOOGLE -2.714
6,800EUR 0,
25.08.07 25.08.07 NAPKÖZBENI ÁTUTALÁS, F.3504, 13100007-02511420-00043484, COGNIZANT TECHNOLOGY SOLUTIONS, 448.599
25.08.04 25.08.04 OTPdirekt HAVIDÍJ* -164
25.08.15 25.08.15 ADOMÁNY, F.9004, 10800007-20000000-11822002, 1030066, WWF Magyarország Alapítvány, A18226814 -1.000
"""
    
    parser = OTPPDFParser()
    transactions = parser.parse_pdf_content(sample_content)
    
    print(f"Parsed {len(transactions)} transactions:")
    for t in transactions:
        print(f"{t.booking_date}: {t.merchant} - {t.amount} HUF ({t.category})")
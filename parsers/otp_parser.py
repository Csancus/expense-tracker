"""OTP Bank statement parser"""
import csv
import re
from datetime import datetime
from typing import List, Optional
from pathlib import Path
from base_parser import BaseParser, Transaction


class OTPParser(BaseParser):
    """Parser for OTP Bank statements"""
    
    def __init__(self):
        super().__init__("OTP Bank")
        self.date_formats = [
            '%Y.%m.%d',
            '%Y-%m-%d',
            '%Y/%m/%d',
            '%d.%m.%Y'
        ]
        
    def validate_format(self, file_path: str) -> bool:
        """Check if file is valid OTP statement"""
        path = Path(file_path)
        
        # Check file extension
        if path.suffix.lower() not in ['.csv', '.txt', '.pdf']:
            return False
        
        # For CSV files, check header structure
        if path.suffix.lower() in ['.csv', '.txt']:
            try:
                with open(file_path, 'r', encoding='utf-8-sig') as f:
                    first_line = f.readline().lower()
                    # Check for OTP specific headers
                    otp_keywords = ['számla', 'dátum', 'összeg', 'egyenleg', 'közlemény']
                    return any(keyword in first_line for keyword in otp_keywords)
            except:
                try:
                    # Try Windows-1250 encoding (common for Hungarian banks)
                    with open(file_path, 'r', encoding='windows-1250') as f:
                        first_line = f.readline().lower()
                        otp_keywords = ['számla', 'dátum', 'összeg', 'egyenleg', 'közlemény']
                        return any(keyword in first_line for keyword in otp_keywords)
                except:
                    return False
        
        return False
    
    def parse(self, file_path: str, encoding: str = 'utf-8-sig') -> List[Transaction]:
        """Parse OTP CSV statement"""
        transactions = []
        
        # Try different encodings
        encodings_to_try = [encoding, 'windows-1250', 'utf-8', 'iso-8859-2']
        
        for enc in encodings_to_try:
            try:
                with open(file_path, 'r', encoding=enc) as f:
                    reader = csv.DictReader(f, delimiter=';')
                    
                    for row in reader:
                        transaction = self._parse_row(row)
                        if transaction:
                            transactions.append(transaction)
                    
                    if transactions:
                        break
            except (UnicodeDecodeError, Exception) as e:
                continue
        
        # If CSV parsing failed, try alternative format
        if not transactions:
            transactions = self._parse_alternative_format(file_path)
        
        self.transactions = transactions
        return transactions
    
    def _parse_row(self, row: dict) -> Optional[Transaction]:
        """Parse single CSV row into Transaction"""
        try:
            # Common OTP CSV column names (multiple variations)
            date_keys = ['Dátum', 'Könyvelés dátuma', 'Tranzakció dátuma', 'datum']
            desc_keys = ['Közlemény', 'Leírás', 'Megnevezés', 'kozlemeny', 'leiras']
            amount_keys = ['Összeg', 'Terhelés', 'Jóváírás', 'osszeg']
            balance_keys = ['Egyenleg', 'Záró egyenleg', 'egyenleg']
            
            # Extract date
            date_str = self._find_value(row, date_keys)
            if not date_str:
                return None
            
            transaction_date = self._parse_date(date_str)
            if not transaction_date:
                return None
            
            # Extract description
            description = self._find_value(row, desc_keys) or "N/A"
            
            # Extract amount (handle debit/credit separately)
            amount = 0.0
            
            # Try to get unified amount first
            amount_str = self._find_value(row, ['Összeg', 'osszeg'])
            if amount_str:
                amount = self._parse_amount(amount_str)
            else:
                # Check debit/credit columns
                debit = self._find_value(row, ['Terhelés', 'terheles'])
                credit = self._find_value(row, ['Jóváírás', 'jovairas'])
                
                if debit:
                    amount = -abs(self._parse_amount(debit))
                elif credit:
                    amount = abs(self._parse_amount(credit))
            
            # Extract balance
            balance_str = self._find_value(row, balance_keys)
            balance = self._parse_amount(balance_str) if balance_str else None
            
            # Clean description
            description = self._clean_description(description)
            
            return Transaction(
                date=transaction_date,
                description=description,
                amount=amount,
                currency="HUF",
                balance=balance,
                bank=self.bank_name,
                raw_data=row
            )
            
        except Exception as e:
            print(f"Error parsing row: {e}")
            return None
    
    def _parse_alternative_format(self, file_path: str) -> List[Transaction]:
        """Parse alternative OTP format (tab-delimited or fixed-width)"""
        transactions = []
        
        try:
            with open(file_path, 'r', encoding='windows-1250') as f:
                lines = f.readlines()
                
                # Skip header lines
                data_started = False
                for line in lines:
                    line = line.strip()
                    
                    if not line:
                        continue
                    
                    # Look for transaction patterns
                    # Format: DATE | DESCRIPTION | AMOUNT | BALANCE
                    if re.match(r'\d{4}[\.\-/]\d{2}[\.\-/]\d{2}', line):
                        data_started = True
                    
                    if data_started:
                        # Try tab-delimited
                        parts = line.split('\t')
                        if len(parts) < 3:
                            # Try multiple spaces as delimiter
                            parts = re.split(r'\s{2,}', line)
                        
                        if len(parts) >= 3:
                            try:
                                date = self._parse_date(parts[0])
                                description = parts[1] if len(parts) > 1 else "N/A"
                                amount = self._parse_amount(parts[2]) if len(parts) > 2 else 0
                                balance = self._parse_amount(parts[3]) if len(parts) > 3 else None
                                
                                if date and amount != 0:
                                    transactions.append(Transaction(
                                        date=date,
                                        description=self._clean_description(description),
                                        amount=amount,
                                        currency="HUF",
                                        balance=balance,
                                        bank=self.bank_name
                                    ))
                            except:
                                continue
                
        except Exception as e:
            print(f"Error parsing alternative format: {e}")
        
        return transactions
    
    def _find_value(self, row: dict, keys: list) -> Optional[str]:
        """Find value by trying multiple key variations"""
        for key in keys:
            # Try exact match
            if key in row and row[key]:
                return row[key]
            
            # Try case-insensitive match
            for row_key in row.keys():
                if row_key.lower() == key.lower() and row[row_key]:
                    return row[row_key]
        
        return None
    
    def _parse_date(self, date_str: str) -> Optional[datetime]:
        """Parse date string with multiple format attempts"""
        if not date_str:
            return None
        
        date_str = date_str.strip()
        
        for date_format in self.date_formats:
            try:
                return datetime.strptime(date_str, date_format)
            except ValueError:
                continue
        
        # Try to extract date with regex
        date_pattern = r'(\d{4})[\.\-/](\d{1,2})[\.\-/](\d{1,2})'
        match = re.search(date_pattern, date_str)
        if match:
            try:
                year, month, day = match.groups()
                return datetime(int(year), int(month), int(day))
            except:
                pass
        
        return None
    
    def _parse_amount(self, amount_str: str) -> float:
        """Parse amount string to float"""
        if not amount_str:
            return 0.0
        
        # Clean amount string
        amount_str = amount_str.strip()
        
        # Remove currency symbols and spaces
        amount_str = re.sub(r'[^\d\-\+\.,]', '', amount_str)
        
        # Handle Hungarian number format (space as thousand separator, comma as decimal)
        amount_str = amount_str.replace(' ', '')  # Remove thousand separators
        amount_str = amount_str.replace(',', '.')  # Convert decimal comma to point
        
        try:
            return float(amount_str)
        except ValueError:
            return 0.0
    
    def _clean_description(self, description: str) -> str:
        """Clean and normalize description"""
        if not description:
            return "N/A"
        
        # Remove extra spaces
        description = ' '.join(description.split())
        
        # Remove common prefixes
        prefixes_to_remove = [
            'Kártyás vásárlás',
            'Átutalás',
            'Készpénzfelvétel',
            'Banki költség'
        ]
        
        for prefix in prefixes_to_remove:
            if description.startswith(prefix + ':'):
                description = description[len(prefix) + 1:].strip()
            elif description.startswith(prefix):
                description = description[len(prefix):].strip()
        
        return description
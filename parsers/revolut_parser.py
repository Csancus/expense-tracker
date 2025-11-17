"""Revolut statement parser"""
import csv
from datetime import datetime
from typing import List, Optional
from pathlib import Path
from base_parser import BaseParser, Transaction


class RevolutParser(BaseParser):
    """Parser for Revolut bank statements"""
    
    def __init__(self):
        super().__init__("Revolut")
        
    def validate_format(self, file_path: str) -> bool:
        """Check if file is valid Revolut statement"""
        path = Path(file_path)
        
        if path.suffix.lower() != '.csv':
            return False
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                first_line = f.readline()
                # Revolut CSVs have specific headers
                revolut_headers = ['Type', 'Product', 'Started Date', 'Completed Date', 
                                 'Description', 'Amount', 'Currency', 'State', 'Balance']
                return any(header in first_line for header in revolut_headers)
        except:
            return False
    
    def parse(self, file_path: str, encoding: str = 'utf-8') -> List[Transaction]:
        """Parse Revolut CSV statement"""
        transactions = []
        
        try:
            with open(file_path, 'r', encoding=encoding) as f:
                reader = csv.DictReader(f)
                
                for row in reader:
                    transaction = self._parse_row(row)
                    if transaction:
                        transactions.append(transaction)
        
        except Exception as e:
            print(f"Error parsing Revolut statement: {e}")
        
        self.transactions = transactions
        return transactions
    
    def _parse_row(self, row: dict) -> Optional[Transaction]:
        """Parse single CSV row into Transaction"""
        try:
            # Skip pending transactions
            if row.get('State', '').upper() != 'COMPLETED':
                return None
            
            # Parse date (use Completed Date)
            date_str = row.get('Completed Date', row.get('Started Date', ''))
            if not date_str:
                return None
            
            # Revolut uses ISO format: 2023-12-25 14:30:00
            transaction_date = datetime.strptime(date_str.split(' ')[0], '%Y-%m-%d')
            
            # Get description
            description = row.get('Description', 'N/A')
            
            # Get amount
            amount_str = row.get('Amount', '0')
            amount = self._parse_amount(amount_str)
            
            # Get currency
            currency = row.get('Currency', 'EUR')
            
            # Get balance
            balance_str = row.get('Balance', '')
            balance = self._parse_amount(balance_str) if balance_str else None
            
            # Get transaction type for category hint
            trans_type = row.get('Type', '')
            category = self._map_revolut_type_to_category(trans_type)
            
            return Transaction(
                date=transaction_date,
                description=description,
                amount=amount,
                currency=currency,
                balance=balance,
                category=category,
                bank=self.bank_name,
                raw_data=row
            )
            
        except Exception as e:
            print(f"Error parsing Revolut row: {e}")
            return None
    
    def _parse_amount(self, amount_str: str) -> float:
        """Parse amount string to float"""
        if not amount_str:
            return 0.0
        
        # Remove currency symbols and spaces
        amount_str = amount_str.strip()
        amount_str = amount_str.replace(',', '')  # Remove thousand separators
        
        # Handle negative amounts
        is_negative = '-' in amount_str or '(' in amount_str
        amount_str = amount_str.replace('-', '').replace('(', '').replace(')', '')
        
        try:
            amount = float(amount_str)
            return -amount if is_negative else amount
        except ValueError:
            return 0.0
    
    def _map_revolut_type_to_category(self, trans_type: str) -> Optional[str]:
        """Map Revolut transaction types to categories"""
        type_mapping = {
            'CARD_PAYMENT': 'Shopping',
            'CARD_REFUND': 'Refund',
            'TOPUP': 'Transfer In',
            'TRANSFER': 'Transfer',
            'EXCHANGE': 'Currency Exchange',
            'CARD_CASHBACK': 'Cashback',
            'ATM': 'Cash Withdrawal',
            'FEE': 'Bank Fee'
        }
        
        return type_mapping.get(trans_type.upper())
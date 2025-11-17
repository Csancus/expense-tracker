"""Base parser class for bank statements"""
from abc import ABC, abstractmethod
from datetime import datetime
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
import hashlib
import re


@dataclass
class Transaction:
    """Unified transaction model"""
    date: datetime
    description: str
    amount: float
    currency: str = "HUF"
    balance: Optional[float] = None
    category: Optional[str] = None
    merchant: Optional[str] = None
    transaction_type: str = "expense"  # expense or income
    bank: Optional[str] = None
    account_number: Optional[str] = None
    raw_data: Optional[Dict[str, Any]] = None
    hash: Optional[str] = None
    
    def __post_init__(self):
        """Generate unique hash for duplicate detection"""
        if not self.hash:
            # Create hash from date, amount, and description
            hash_string = f"{self.date.isoformat()}_{self.amount}_{self.description}"
            self.hash = hashlib.md5(hash_string.encode()).hexdigest()
        
        # Determine transaction type based on amount
        if self.amount > 0:
            self.transaction_type = "income"
        else:
            self.transaction_type = "expense"
            
        # Extract potential merchant from description
        if not self.merchant:
            self.merchant = self._extract_merchant(self.description)
    
    def _extract_merchant(self, description: str) -> Optional[str]:
        """Extract merchant name from transaction description"""
        # Common patterns for merchant extraction
        patterns = [
            r'^([A-Z][A-Z0-9\s]+?)(?:\s+\d+|\s+[A-Z]{2,})',  # MERCHANT_NAME followed by numbers or codes
            r'^(.+?)\s+(?:BUDAPEST|BP\.|DEBRECEN|SZEGED)',  # Merchant followed by city
            r'^(.+?)\s+\d{4}\.\d{2}\.\d{2}',  # Merchant followed by date
        ]
        
        for pattern in patterns:
            match = re.match(pattern, description)
            if match:
                return match.group(1).strip()
        
        # Return first few words as fallback
        words = description.split()[:3]
        return " ".join(words) if words else None
    
    def matches(self, other: 'Transaction', strict: bool = False) -> bool:
        """Check if this transaction matches another (for duplicate detection)"""
        if strict:
            # Strict matching uses hash
            return self.hash == other.hash
        else:
            # Fuzzy matching for similar transactions
            date_match = abs((self.date - other.date).days) <= 1
            amount_match = abs(self.amount - other.amount) < 0.01
            desc_similarity = self._description_similarity(other.description) > 0.8
            return date_match and amount_match and desc_similarity
    
    def _description_similarity(self, other_desc: str) -> float:
        """Calculate description similarity score"""
        # Simple word-based similarity
        words1 = set(self.description.lower().split())
        words2 = set(other_desc.lower().split())
        
        if not words1 or not words2:
            return 0.0
            
        intersection = words1.intersection(words2)
        union = words1.union(words2)
        
        return len(intersection) / len(union) if union else 0.0


class BaseParser(ABC):
    """Abstract base class for bank statement parsers"""
    
    def __init__(self, bank_name: str):
        self.bank_name = bank_name
        self.transactions: List[Transaction] = []
        self.metadata: Dict[str, Any] = {}
        
    @abstractmethod
    def parse(self, file_path: str, encoding: str = 'utf-8') -> List[Transaction]:
        """Parse bank statement file and return list of transactions"""
        pass
    
    @abstractmethod
    def validate_format(self, file_path: str) -> bool:
        """Validate if the file format is supported by this parser"""
        pass
    
    def detect_duplicates(self, transactions: List[Transaction]) -> List[List[Transaction]]:
        """Detect duplicate transactions within the list"""
        duplicates = []
        seen = set()
        
        for i, trans in enumerate(transactions):
            if trans.hash not in seen:
                seen.add(trans.hash)
                # Check for fuzzy matches
                fuzzy_matches = []
                for j, other in enumerate(transactions[i+1:], i+1):
                    if trans.matches(other, strict=False):
                        fuzzy_matches.append(other)
                
                if fuzzy_matches:
                    duplicates.append([trans] + fuzzy_matches)
        
        return duplicates
    
    def merge_statements(self, 
                        existing: List[Transaction], 
                        new: List[Transaction]) -> List[Transaction]:
        """Merge new transactions with existing ones, avoiding duplicates"""
        # Create hash set of existing transactions
        existing_hashes = {t.hash for t in existing}
        
        # Add only non-duplicate transactions
        merged = existing.copy()
        added_count = 0
        
        for trans in new:
            if trans.hash not in existing_hashes:
                # Check for fuzzy matches
                is_duplicate = False
                for existing_trans in existing:
                    if trans.matches(existing_trans, strict=False):
                        is_duplicate = True
                        break
                
                if not is_duplicate:
                    merged.append(trans)
                    added_count += 1
        
        # Sort by date
        merged.sort(key=lambda t: t.date)
        
        print(f"Merged {added_count} new transactions (skipped {len(new) - added_count} duplicates)")
        
        return merged
    
    def get_date_range(self, transactions: List[Transaction]) -> tuple:
        """Get the date range of transactions"""
        if not transactions:
            return None, None
        
        dates = [t.date for t in transactions]
        return min(dates), max(dates)
    
    def get_summary(self, transactions: List[Transaction]) -> Dict[str, Any]:
        """Get summary statistics of transactions"""
        if not transactions:
            return {}
        
        total_income = sum(t.amount for t in transactions if t.amount > 0)
        total_expense = sum(t.amount for t in transactions if t.amount < 0)
        
        start_date, end_date = self.get_date_range(transactions)
        
        return {
            'bank': self.bank_name,
            'total_transactions': len(transactions),
            'total_income': total_income,
            'total_expense': abs(total_expense),
            'net_flow': total_income + total_expense,
            'date_range': {
                'start': start_date.isoformat() if start_date else None,
                'end': end_date.isoformat() if end_date else None
            },
            'duplicates_found': len(self.detect_duplicates(transactions))
        }
"""Factory pattern for selecting appropriate parser based on file"""
from typing import Optional, List
from pathlib import Path
from base_parser import BaseParser, Transaction
from otp_parser import OTPParser
from revolut_parser import RevolutParser


class ParserFactory:
    """Factory class for creating appropriate bank statement parser"""
    
    def __init__(self):
        self.parsers = [
            OTPParser(),
            RevolutParser(),
            # Add more parsers here as they're implemented
            # RaiffeisenParser(),
            # ErsteParser(),
        ]
    
    def get_parser(self, file_path: str) -> Optional[BaseParser]:
        """
        Automatically detect and return appropriate parser for the file
        
        Args:
            file_path: Path to the bank statement file
            
        Returns:
            Appropriate parser instance or None if no parser matches
        """
        for parser in self.parsers:
            if parser.validate_format(file_path):
                return parser
        
        return None
    
    def parse_statement(self, file_path: str) -> Optional[List[Transaction]]:
        """
        Parse bank statement using auto-detected parser
        
        Args:
            file_path: Path to the bank statement file
            
        Returns:
            List of transactions or None if parsing failed
        """
        parser = self.get_parser(file_path)
        
        if not parser:
            print(f"No suitable parser found for {file_path}")
            return None
        
        print(f"Using {parser.bank_name} parser for {Path(file_path).name}")
        
        try:
            transactions = parser.parse(file_path)
            
            if transactions:
                summary = parser.get_summary(transactions)
                print(f"Parsed {summary['total_transactions']} transactions")
                print(f"Date range: {summary['date_range']['start']} to {summary['date_range']['end']}")
                print(f"Total income: {summary['total_income']:,.0f} HUF")
                print(f"Total expense: {summary['total_expense']:,.0f} HUF")
                
                if summary['duplicates_found'] > 0:
                    print(f"Warning: {summary['duplicates_found']} potential duplicates found")
            
            return transactions
            
        except Exception as e:
            print(f"Error parsing file: {e}")
            return None
    
    def merge_statements(self, 
                        existing_transactions: List[Transaction],
                        new_file_path: str) -> Optional[List[Transaction]]:
        """
        Parse new statement and merge with existing transactions
        
        Args:
            existing_transactions: List of existing transactions
            new_file_path: Path to new bank statement
            
        Returns:
            Merged transaction list or None if parsing failed
        """
        parser = self.get_parser(new_file_path)
        
        if not parser:
            return None
        
        try:
            new_transactions = parser.parse(new_file_path)
            
            if not new_transactions:
                return existing_transactions
            
            # Merge and handle duplicates
            merged = parser.merge_statements(existing_transactions, new_transactions)
            
            return merged
            
        except Exception as e:
            print(f"Error merging statements: {e}")
            return None


# Example usage
if __name__ == "__main__":
    factory = ParserFactory()
    
    # Test with sample files
    test_files = [
        "samples/otp_statement.csv",
        "samples/revolut_statement.csv",
    ]
    
    all_transactions = []
    
    for file_path in test_files:
        if Path(file_path).exists():
            transactions = factory.parse_statement(file_path)
            if transactions:
                # Merge with existing transactions
                if all_transactions:
                    parser = factory.get_parser(file_path)
                    all_transactions = parser.merge_statements(all_transactions, transactions)
                else:
                    all_transactions = transactions
    
    print(f"\nTotal merged transactions: {len(all_transactions)}")
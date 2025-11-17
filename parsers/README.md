# Bank Statement Parsers 📄

This module handles parsing of bank statements from various Hungarian banks in different formats.

## Supported Formats
- **PDF** - Text extraction and table parsing
- **Excel (.xlsx, .xls)** - Direct data reading
- **CSV** - Structured data parsing

## Supported Banks

### OTP Bank
- Format: CSV, PDF
- Encoding: Windows-1250 or UTF-8
- Fields: Date, Description, Amount, Balance

### Raiffeisen Bank
- Format: CSV, Excel
- Encoding: UTF-8
- Fields: Date, Type, Description, Debit, Credit, Balance

### Erste Bank
- Format: PDF, CSV
- Encoding: UTF-8
- Fields: Date, Transaction, Amount, Currency, Balance

### Revolut
- Format: CSV
- Encoding: UTF-8
- Fields: Date, Description, Amount, Currency, Category

## Parser Structure
```
parsers/
├── base_parser.py      # Abstract base class
├── otp_parser.py       # OTP specific parser
├── raiffeisen_parser.py # Raiffeisen parser
├── erste_parser.py     # Erste parser
├── revolut_parser.py   # Revolut parser
├── parser_factory.py   # Factory pattern for parser selection
└── utils/
    ├── pdf_reader.py   # PDF extraction utilities
    ├── csv_handler.py  # CSV processing
    └── excel_reader.py # Excel file handling
```
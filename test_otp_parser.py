"""Test script for OTP parser with real PDF content"""

import re
from parsers.otp_parser_enhanced import OTPPDFParser

# Real content from the PDF
sample_otp_content = """FORGALMAK
KÖNYVELÉS/ÉRTÉKNAP MEGNEVEZÉS ÖSSZEG
25.07.26 NYITÓ EGYENLEG 6.065.300
25.07.28 25.07.28 VÁSÁRLÁS KÁRTYÁVAL, 8460878289, 0000001300274868, Tranzakció: 25.07.24, GOOGLE *Google Play Ap -GOOGLE -2.714
6,800EUR 0,
25.07.28 25.07.28 VÁSÁRLÁS KÁRTYÁVAL, 8460878289, 0000001300375920, Tranzakció: 25.07.24, GOOGLE *Google Play Ap -GOOGLE -676
1,690EUR 0,
25.07.28 25.07.28 VÁSÁRLÁS KÁRTYÁVAL, 8460878289, 0000001311958425, Tranzakció: 25.07.25, COPYGURU - Nyugati -ÉRINTÕ -2.260
5,680EUR 0,
25.08.04 25.08.04 VÁSÁRLÁS KÁRTYÁVAL, 8460878289, 0000001370659951, Tranzakció: 25.07.31, LIDL ÁRUHÁZ 0177.SZ. -GOOGLE -9.472
25.08.04 25.08.04 OTPdirekt HAVIDÍJ* -164
25.08.07 25.08.07 NAPKÖZBENI ÁTUTALÁS, F.3504, 13100007-02511420-00043484, COGNIZANT TECHNOLOGY SOLUTIONS, 448.599
25/07MunkaberSALARY07, 131000070251142000043484, BNPAHUHX, (2.)20250807X0579534,
25.08.15 25.08.15 ADOMÁNY, F.9004, 10800007-20000000-11822002, 1030066, WWF Magyarország Alapítvány, A18226814 -1.000
25.08.18 25.08.18 VÁSÁRLÁS KÁRTYÁVAL, 8460878289, 0000001556401880, Tranzakció: 25.08.17, Revolut**9442* -GOOGLE -100.000
253,140EUR 0,
IDÕSZAK: 25.07.26-25.08.22"""

def test_regex_patterns():
    """Test individual regex patterns"""
    
    print("Testing regex patterns...")
    
    # Test card transaction pattern
    card_pattern = r'(\d{2}\.\d{2}\.\d{2})\s+(\d{2}\.\d{2}\.\d{2})\s+VÁSÁRLÁS KÁRTYÁVAL,\s+(\d+),\s+(\d+),\s+Tranzakció:\s+\d{2}\.\d{2}\.\d{2},\s+(.+?)\s+-(\d+(?:\.\d{3})*)'
    
    test_lines = [
        "25.07.28 25.07.28 VÁSÁRLÁS KÁRTYÁVAL, 8460878289, 0000001300274868, Tranzakció: 25.07.24, GOOGLE *Google Play Ap -GOOGLE -2.714",
        "25.08.04 25.08.04 VÁSÁRLÁS KÁRTYÁVAL, 8460878289, 0000001370659951, Tranzakció: 25.07.31, LIDL ÁRUHÁZ 0177.SZ. -GOOGLE -9.472"
    ]
    
    for line in test_lines:
        match = re.search(card_pattern, line)
        if match:
            print(f"✅ Matched: {match.groups()}")
        else:
            print(f"❌ No match for: {line}")
    
    # Test transfer pattern
    transfer_pattern = r'(\d{2}\.\d{2}\.\d{2})\s+(\d{2}\.\d{2}\.\d{2})\s+NAPKÖZBENI ÁTUTALÁS,\s+(.+?)\s+(\d+(?:\.\d{3})*)'
    
    transfer_line = "25.08.07 25.08.07 NAPKÖZBENI ÁTUTALÁS, F.3504, 13100007-02511420-00043484, COGNIZANT TECHNOLOGY SOLUTIONS, 448.599"
    match = re.search(transfer_pattern, transfer_line)
    if match:
        print(f"✅ Transfer matched: {match.groups()}")
    else:
        print(f"❌ No transfer match for: {transfer_line}")

def test_simple_parser():
    """Test a simplified parser approach"""
    
    print("\n" + "="*50)
    print("Testing simplified parser...")
    
    lines = sample_otp_content.split('\n')
    transactions = []
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        # Simple pattern: starts with date, contains amount
        if re.match(r'\d{2}\.\d{2}\.\d{2}', line) and ('VÁSÁRLÁS' in line or 'ÁTUTALÁS' in line or 'HAVIDÍJ' in line or 'ADOMÁNY' in line):
            
            # Extract basic info
            parts = line.split()
            if len(parts) >= 3:
                booking_date = parts[0]  # 25.07.28
                value_date = parts[1] if parts[1] != booking_date else parts[0]
                
                # Find amount (negative number at the end or positive for income)
                amount = None
                for part in reversed(parts):
                    if re.match(r'-?\d+(?:\.\d{3})*(?:,\d{2})?$', part):
                        amount = float(part.replace('.', '').replace(',', '.'))
                        break
                
                # Get description (everything between dates and amount)
                desc_start = 2 if parts[1] == booking_date else 3
                desc_parts = []
                for i in range(desc_start, len(parts)):
                    if not re.match(r'-?\d+(?:\.\d{3})*(?:,\d{2})?$', parts[i]):
                        desc_parts.append(parts[i])
                    else:
                        break
                
                description = ' '.join(desc_parts)
                
                if amount is not None:
                    transactions.append({
                        'date': booking_date,
                        'description': description,
                        'amount': amount
                    })
    
    print(f"Found {len(transactions)} transactions:")
    for t in transactions:
        print(f"  {t['date']}: {t['description'][:50]}... = {t['amount']}")

def test_enhanced_parser():
    """Test the enhanced parser"""
    
    print("\n" + "="*50)
    print("Testing enhanced parser...")
    
    parser = OTPPDFParser()
    transactions = parser.parse_pdf_content(sample_otp_content)
    
    print(f"Enhanced parser found {len(transactions)} transactions:")
    for t in transactions:
        print(f"  {t.booking_date}: {t.merchant} - {t.amount} HUF ({t.category})")

if __name__ == "__main__":
    test_regex_patterns()
    test_simple_parser()
    test_enhanced_parser()
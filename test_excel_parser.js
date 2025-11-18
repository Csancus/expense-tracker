// Test Excel Parser
const { ExcelProcessor } = require('./excel-processor.js');

// Mock Excel data - simulate what SheetJS would return
const sampleOTPExcelData = [
    ['Könyvelés dátuma', 'Értéknap', 'Tranzakció megnevezése', 'Összeg (HUF)', 'Egyenleg (HUF)'],
    ['2025.10.01', '2025.10.01', 'TESCO ÁRUHÁZ - KÁRTYA', '-12450.50', '245000.00'],
    ['2025.10.02', '2025.10.02', 'MOL Benzinkút - KÁRTYA', '-8500.00', '236500.00'],
    ['2025.10.03', '2025.10.03', 'LIDL MAGYARORSZÁG - KÁRTYA', '-5670.75', '230829.25'],
    ['2025.10.05', '2025.10.05', 'Átutalás beérkezése JÓZSEF PÉTER', '150000.00', '380829.25'],
    ['2025.10.06', '2025.10.06', 'SPAR MAGYARORSZÁG - KÁRTYA', '-3240.25', '377589.00']
];

const sampleRaiffeisenExcelData = [
    ['Értéknap', 'Tranzakció megnevezése', 'Terhelés(-)', 'Jóváírás(+)', 'Egyenleg'],
    ['2025.10.01', 'TESCO EXTRA - POS tranzakció', '12450.50', '', '245000.00'],
    ['2025.10.02', 'MOL - Üzemanyag vásárlás', '8500.00', '', '236500.00'],
    ['2025.10.03', 'LIDL - Élelmiszervásárlás', '5670.75', '', '230829.25'],
    ['2025.10.05', 'Átutalás - Fizetés', '', '150000.00', '380829.25'],
    ['2025.10.06', 'SPAR - Bevásárlás', '3240.25', '', '377589.00']
];

const sampleRevolutExcelData = [
    ['Date started (UTC)', 'Date completed (UTC)', 'Description', 'Amount', 'Currency'],
    ['2025-10-01 08:15:00', '2025-10-01 08:15:00', 'TESCO STORES', '-124.50', 'HUF'],
    ['2025-10-02 14:30:00', '2025-10-02 14:30:00', 'MOL PETROL STATION', '-85.00', 'HUF'],
    ['2025-10-03 18:45:00', '2025-10-03 18:45:00', 'LIDL HUNGARY', '-56.70', 'HUF'],
    ['2025-10-05 09:00:00', '2025-10-05 09:00:00', 'SALARY PAYMENT', '1500.00', 'HUF'],
    ['2025-10-06 12:20:00', '2025-10-06 12:20:00', 'SPAR HUNGARY', '-32.40', 'HUF']
];

function testExcelParser() {
    console.log('🧪 Testing Excel Parser...');
    console.log('='.repeat(50));
    
    const processor = new ExcelProcessor();
    
    // Test OTP Excel parsing
    console.log('\n📊 Testing OTP Excel format...');
    const otpTransactions = processor.parseOTPExcel(sampleOTPExcelData);
    console.log(`Parsed ${otpTransactions.length} OTP transactions`);
    
    otpTransactions.forEach((t, i) => {
        console.log(`${i + 1}. ${t.date}: ${t.merchant} - ${t.amount} HUF`);
    });
    
    // Test Raiffeisen Excel parsing  
    console.log('\n📊 Testing Raiffeisen Excel format...');
    const raiffeisenTransactions = processor.parseRaiffeisenExcel(sampleRaiffeisenExcelData);
    console.log(`Parsed ${raiffeisenTransactions.length} Raiffeisen transactions`);
    
    raiffeisenTransactions.forEach((t, i) => {
        console.log(`${i + 1}. ${t.date}: ${t.merchant} - ${t.amount > 0 ? '+' : ''}${t.amount} HUF`);
    });
    
    // Test Revolut Excel parsing
    console.log('\n📊 Testing Revolut Excel format...');
    const revolutTransactions = processor.parseRevolutExcel(sampleRevolutExcelData);
    console.log(`Parsed ${revolutTransactions.length} Revolut transactions`);
    
    revolutTransactions.forEach((t, i) => {
        console.log(`${i + 1}. ${t.date}: ${t.merchant} - ${t.amount > 0 ? '+' : ''}${t.amount} HUF`);
    });
    
    // Test amount parsing
    console.log('\n🔢 Testing amount parsing...');
    const testAmounts = [
        '12,450.50',
        '12.450,50', 
        '1.234.567,89',
        '8500',
        '85.00',
        '1,500.00'
    ];
    
    testAmounts.forEach(amount => {
        const parsed = processor.parseExcelAmount(amount);
        console.log(`"${amount}" => ${parsed}`);
    });
    
    // Test date parsing
    console.log('\n📅 Testing date parsing...');
    const testDates = [
        '2025.10.01',
        '2025-10-01',
        '01/10/2025',
        44927, // Excel serial date for 2025-10-01
        new Date('2025-10-01')
    ];
    
    testDates.forEach(date => {
        const parsed = processor.parseExcelDate(date);
        console.log(`${date} => ${parsed}`);
    });
    
    console.log('\n✅ Excel parser tests completed!');
}

// Run tests if this file is executed directly
if (require.main === module) {
    // Make ExcelProcessor available globally for testing
    global.ExcelProcessor = ExcelProcessor;
    testExcelParser();
}

module.exports = { testExcelParser };
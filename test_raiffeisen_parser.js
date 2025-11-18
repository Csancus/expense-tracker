// Test Raiffeisen PDF Parser
const { PDFProcessor } = require('./pdf-processor.js');

// Sample content from the actual Raiffeisen PDF - format as extracted by PDF.js
const sampleRaiffeisenContent = `Könyvelés
Tétel azon. Értéknap Tranzakció megnevezése Terhelés(-) Jóváírás(+)
5252233050 2025.10.01. Díj, jutalék -16.418,64
2025.10.01. Referencia: T00157295714701
Forgalmi jutalék
5265410495 2025.10.09. Elektronikus forint átutalás -50.000,00
2025.10.08. Referencia: AFK25J0000781478
Kedvezményezett neve: Helyi Iparűzési Adó
Kedvezményezett számlaszáma:
HU55504380081001076300000000
Közlemény: 56575116-2-37
Előjegyzett díj: 225,00 HUF Forgalmi jutalék
5265410511 2025.10.09. Elektronikus forint átutalás -2.041,00
2025.10.08. Referencia: AFK25J0000781752
Kedvezményezett neve: Pótlék
Kedvezményezett számlaszáma:
HU11504380081001085900000000
Közlemény: 56575116-2-37
Előjegyzett díj: 9,18 HUF Forgalmi jutalék
5270148714 2025.10.13. Elektronikus bankon belüli átutalás 2.455.863,00
2025.10.10. Referencia: ABK25J0000234858
Átutaló neve: JÓZSAKI KORLÁTOLT FELELŐSSÉGŰ TÁ
RSA
Átutaló számlaszáma:
HU37120103500165560400100006
Közlemény: 2025-000017
5270566688 2025.10.13. Elektronikus forint átutalás -17.000,00
2025.10.12. Referencia: AFK25J0001118121
Kedvezményezett neve: Nagy-Boróczki Annamária
Kedvezményezett számlaszáma:
HU10117460362462208200000000
Közlemény: NBA-2025-414
Előjegyzett díj: 76,50 HUF Forgalmi jutalék
5286566325 2025.10.21. Egyéb jóváírás 30.000,00
2025.10.21. Referencia: #0004RSPUW
Promóciós jóváírás-ajánlott részére
DS101179261357
5304644950 2025.10.31. Kamat 30,31
2025.10.31.
összes terhelés / jóváírás -85.459,64 2.485.893,31
NYITÓEGYENLEG: 1.960.214,40
ZÁRÓEGYENLEG: 4.360.648,07`;

function testRaiffeisenParser() {
    console.log('🧪 Testing Raiffeisen PDF Parser...');
    console.log('=' .repeat(50));
    
    const processor = new PDFProcessor();
    const transactions = processor.parseRaiffeisenStatement(sampleRaiffeisenContent);
    
    console.log(`\nParsed ${transactions.length} transactions:`);
    
    transactions.forEach((t, index) => {
        console.log(`\n${index + 1}. ${t.date}: ${t.merchant}`);
        console.log(`   Amount: ${t.amount > 0 ? '+' : ''}${t.amount} HUF`);
        console.log(`   Category: ${t.category}`);
        console.log(`   Description: ${t.description.substring(0, 80)}...`);
        if (t.reference) {
            console.log(`   Reference: ${t.reference}`);
        }
        if (t.memo) {
            console.log(`   Memo: ${t.memo}`);
        }
    });
    
    // Validate specific transactions
    console.log('\n' + '=' .repeat(50));
    console.log('🔍 Validation:');
    
    const expectations = [
        { merchant: 'Raiffeisen Díj', amount: -16418.64 },
        { merchant: 'Helyi Iparűzési Adó', amount: -50000 },
        { merchant: 'Pótlék', amount: -2041 },
        { merchant: 'JÓZSAKI', amount: 2455863 },
        { merchant: 'Nagy-Boróczki Annamária', amount: -17000 },
        { merchant: 'Promóciós jóváírás', amount: 30000 }
    ];
    
    let passed = 0;
    let total = expectations.length;
    
    expectations.forEach((expected, i) => {
        const actual = transactions[i];
        if (actual) {
            const merchantMatch = actual.merchant.includes(expected.merchant.split(' ')[0]);
            const amountMatch = Math.abs(actual.amount - expected.amount) < 0.01;
            
            if (merchantMatch && amountMatch) {
                console.log(`✅ Transaction ${i + 1}: ${expected.merchant} - ${expected.amount} HUF`);
                passed++;
            } else {
                console.log(`❌ Transaction ${i + 1}: Expected ${expected.merchant}/${expected.amount}, got ${actual.merchant}/${actual.amount}`);
            }
        } else {
            console.log(`❌ Transaction ${i + 1}: Missing transaction`);
        }
    });
    
    console.log(`\n📊 Results: ${passed}/${total} tests passed (${Math.round(passed/total*100)}%)`);
    
    if (passed === total) {
        console.log('🎉 All Raiffeisen parser tests passed!');
        return true;
    } else {
        console.log('⚠️  Some tests failed - parser needs adjustment');
        return false;
    }
}

// Run the test
if (require.main === module) {
    // Make sure PDFProcessor is available
    global.PDFProcessor = PDFProcessor;
    testRaiffeisenParser();
}

module.exports = { testRaiffeisenParser };
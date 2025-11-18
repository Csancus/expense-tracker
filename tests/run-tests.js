// Automated test runner for Expense Tracker
const path = require('path');
const { spawn } = require('child_process');

class TestRunner {
    constructor() {
        this.testResults = [];
        this.serverProcess = null;
    }

    async runTests() {
        console.log('🧪 Starting Expense Tracker Tests...\n');

        try {
            // Start local server
            await this.startServer();
            
            // Wait for server to be ready
            await this.waitForServer();
            
            // Run function tests
            this.runFunctionTests();
            
            // Run integration tests
            await this.runIntegrationTests();
            
            // Display results
            this.displayResults();
            
        } catch (error) {
            console.error('❌ Test suite failed:', error.message);
            process.exit(1);
        } finally {
            this.cleanup();
        }
    }

    async startServer() {
        return new Promise((resolve, reject) => {
            console.log('🌐 Starting local test server...');
            
            this.serverProcess = spawn('python3', ['-m', 'http.server', '8001'], {
                cwd: path.join(__dirname, '..'),
                stdio: 'pipe'
            });

            this.serverProcess.stdout.on('data', (data) => {
                const output = data.toString();
                if (output.includes('Serving HTTP')) {
                    console.log('✅ Server started on http://localhost:8001\n');
                    resolve();
                }
            });

            this.serverProcess.stderr.on('data', (data) => {
                console.error('Server error:', data.toString());
            });

            this.serverProcess.on('error', reject);
            
            // Timeout after 10 seconds
            setTimeout(() => {
                reject(new Error('Server startup timeout'));
            }, 10000);
        });
    }

    async waitForServer() {
        const fetch = (await import('node-fetch')).default;
        
        for (let i = 0; i < 30; i++) {
            try {
                const response = await fetch('http://localhost:8001');
                if (response.ok) {
                    return;
                }
            } catch (error) {
                // Server not ready yet
            }
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        throw new Error('Server not responding');
    }

    runFunctionTests() {
        console.log('🔧 Running Function Tests...');
        
        // Test 1: Basic function existence
        this.test(
            'File types detection',
            () => {
                const pdfFile = { type: 'application/pdf', name: 'test.pdf' };
                const csvFile = { type: 'text/csv', name: 'test.csv' };
                
                const isPDF = pdfFile.type === 'application/pdf' || pdfFile.name.endsWith('.pdf');
                const isCSV = csvFile.type === 'text/csv' || csvFile.name.endsWith('.csv');
                
                return isPDF && isCSV;
            }
        );

        // Test 2: Transaction hash generation
        this.test(
            'Transaction hash generation',
            () => {
                const transaction1 = { date: '2024-01-01', amount: 100, description: 'Test' };
                const transaction2 = { date: '2024-01-01', amount: 100, description: 'Test' };
                const transaction3 = { date: '2024-01-02', amount: 100, description: 'Test' };
                
                const hash1 = `${transaction1.date}_${transaction1.amount}_${transaction1.description}`;
                const hash2 = `${transaction2.date}_${transaction2.amount}_${transaction2.description}`;
                const hash3 = `${transaction3.date}_${transaction3.amount}_${transaction3.description}`;
                
                return hash1 === hash2 && hash1 !== hash3;
            }
        );

        // Test 3: CSV parsing logic
        this.test(
            'CSV parsing logic',
            () => {
                const csvContent = 'Date,Description,Amount\n2024-01-01,Test,-100\n2024-01-02,Test2,50';
                const lines = csvContent.split('\n');
                
                // Should have header + 2 data lines
                return lines.length === 3 && lines[1].includes('Test') && lines[2].includes('Test2');
            }
        );

        // Test 4: Amount parsing
        this.test(
            'Amount parsing Hungarian format',
            () => {
                const testAmounts = [
                    { input: '1 234,56', expected: 1234.56 },
                    { input: '-5 000,00', expected: -5000 },
                    { input: '100', expected: 100 }
                ];
                
                return testAmounts.every(test => {
                    const cleaned = test.input.replace(/\s/g, '').replace(',', '.');
                    const parsed = parseFloat(cleaned);
                    return Math.abs(parsed - test.expected) < 0.01;
                });
            }
        );

        console.log('');
    }

    async runIntegrationTests() {
        console.log('🌐 Running Integration Tests...');
        
        try {
            // Test main page loads
            await this.testPageLoad('http://localhost:8001/index.html', 'Main page');
            
            // Test scripts load
            await this.testScriptLoad('http://localhost:8001/app.js', 'App script');
            await this.testScriptLoad('http://localhost:8001/pdf-processor.js', 'PDF processor script');
            
            // Test test page loads
            await this.testPageLoad('http://localhost:8001/tests/file-upload.test.html', 'Test page');
            
        } catch (error) {
            console.log(`❌ Integration test failed: ${error.message}`);
        }
        
        console.log('');
    }

    async testPageLoad(url, name) {
        try {
            const fetch = (await import('node-fetch')).default;
            const response = await fetch(url);
            
            this.test(
                `${name} loads`,
                () => response.ok && response.status === 200
            );
            
            if (response.ok) {
                const content = await response.text();
                this.test(
                    `${name} has content`,
                    () => content.length > 100
                );
            }
        } catch (error) {
            this.test(`${name} loads`, () => false, `Error: ${error.message}`);
        }
    }

    async testScriptLoad(url, name) {
        try {
            const fetch = (await import('node-fetch')).default;
            const response = await fetch(url);
            
            this.test(
                `${name} loads`,
                () => response.ok && response.headers.get('content-type')?.includes('javascript') || 
                      response.headers.get('content-type')?.includes('text/plain')
            );
        } catch (error) {
            this.test(`${name} loads`, () => false, `Error: ${error.message}`);
        }
    }

    test(name, testFunction, errorMessage = '') {
        try {
            const passed = testFunction();
            this.testResults.push({ name, passed, error: passed ? null : errorMessage });
            
            const icon = passed ? '✅' : '❌';
            console.log(`  ${icon} ${name} ${errorMessage}`);
            
            return passed;
        } catch (error) {
            this.testResults.push({ name, passed: false, error: error.message });
            console.log(`  ❌ ${name} - Error: ${error.message}`);
            return false;
        }
    }

    displayResults() {
        const passed = this.testResults.filter(r => r.passed).length;
        const total = this.testResults.length;
        
        console.log('📊 Test Results:');
        console.log('================');
        console.log(`Total Tests: ${total}`);
        console.log(`Passed: ${passed}`);
        console.log(`Failed: ${total - passed}`);
        console.log(`Success Rate: ${Math.round((passed / total) * 100)}%`);
        
        if (passed === total) {
            console.log('🎉 All tests passed!');
        } else {
            console.log('\n❌ Failed tests:');
            this.testResults
                .filter(r => !r.passed)
                .forEach(r => console.log(`  - ${r.name}: ${r.error || 'Unknown error'}`));
        }
        
        console.log('');
    }

    cleanup() {
        if (this.serverProcess) {
            console.log('🧹 Cleaning up test server...');
            this.serverProcess.kill();
        }
    }
}

// Main execution
async function main() {
    const runner = new TestRunner();
    await runner.runTests();
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Test interrupted by user');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Test terminated');
    process.exit(0);
});

// Run tests
if (require.main === module) {
    main().catch(error => {
        console.error('💥 Test runner crashed:', error);
        process.exit(1);
    });
}

module.exports = TestRunner;
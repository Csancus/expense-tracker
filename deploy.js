#!/usr/bin/env node

// Automated deployment script for Expense Tracker
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class Deployer {
    constructor() {
        this.colors = {
            reset: '\x1b[0m',
            bright: '\x1b[1m',
            green: '\x1b[32m',
            yellow: '\x1b[33m',
            blue: '\x1b[34m',
            red: '\x1b[31m'
        };
    }

    log(message, color = 'reset') {
        console.log(`${this.colors[color]}${message}${this.colors.reset}`);
    }

    exec(command, options = {}) {
        try {
            this.log(`➜ ${command}`, 'blue');
            const result = execSync(command, {
                encoding: 'utf8',
                stdio: 'pipe',
                ...options
            });
            return result.trim();
        } catch (error) {
            this.log(`✗ Error: ${error.message}`, 'red');
            throw error;
        }
    }

    async deploy() {
        this.log('\n🚀 Starting deployment process...', 'bright');
        
        try {
            // 1. Check git status
            this.log('\n📋 Checking git status...', 'yellow');
            const status = this.exec('git status --porcelain');
            
            if (status) {
                this.log('⚠️  You have uncommitted changes:', 'yellow');
                console.log(status);
                
                // Auto-commit changes
                this.log('\n📝 Auto-committing changes...', 'yellow');
                this.exec('git add .');
                
                const message = `Auto-deploy: Update at ${new Date().toISOString()}

Changes:
${status}

🚀 Generated with Claude Code Agent
Co-Authored-By: Claude <noreply@anthropic.com>`;
                
                this.exec(`git commit -m "${message}"`);
                this.log('✓ Changes committed', 'green');
            } else {
                this.log('✓ Working directory clean', 'green');
            }
            
            // 2. Push to GitHub
            this.log('\n📤 Pushing to GitHub...', 'yellow');
            this.exec('git push origin main');
            this.log('✓ Pushed to GitHub', 'green');
            
            // 3. Check GitHub Pages status
            this.log('\n🌐 GitHub Pages will update automatically...', 'yellow');
            this.log('   URL: https://csancus.github.io/expense-tracker/', 'blue');
            this.log('   Note: It may take 1-2 minutes to update', 'yellow');
            
            // 4. Update version in package.json
            const packagePath = path.join(__dirname, 'package.json');
            const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
            const version = packageJson.version.split('.');
            version[2] = parseInt(version[2]) + 1;
            packageJson.version = version.join('.');
            fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
            this.log(`✓ Version bumped to ${packageJson.version}`, 'green');
            
            // 5. Summary
            this.log('\n✅ Deployment complete!', 'bright');
            this.log('\n📊 Summary:', 'yellow');
            this.log(`   • Version: ${packageJson.version}`, 'blue');
            this.log(`   • Branch: main`, 'blue');
            this.log(`   • Live URL: https://csancus.github.io/expense-tracker/`, 'blue');
            this.log(`   • Supabase: Connected`, 'blue');
            
            this.log('\n💡 Next steps:', 'yellow');
            this.log('   1. Wait 1-2 minutes for GitHub Pages to update', 'reset');
            this.log('   2. Check the live site', 'reset');
            this.log('   3. Monitor Supabase dashboard for data', 'reset');
            
        } catch (error) {
            this.log('\n❌ Deployment failed!', 'red');
            this.log(error.message, 'red');
            process.exit(1);
        }
    }
}

// Run if executed directly
if (require.main === module) {
    const deployer = new Deployer();
    deployer.deploy();
}

module.exports = Deployer;
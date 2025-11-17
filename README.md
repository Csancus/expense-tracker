# Expense Tracker 💰

Smart personal finance management tool that automatically parses bank statements from multiple Hungarian banks, categorizes expenses with machine learning, and provides comprehensive family budget tracking.

## 🏦 Supported Banks
- **OTP Bank** - CSV and PDF statement parsing
- **Raiffeisen Bank** - Multiple format support  
- **Erste Bank** - Statement analysis
- **Revolut** - Transaction import

## ✨ Key Features

### 📄 Smart Statement Processing
- **Multi-format parsing** - Handles CSV, PDF, and Excel formats
- **Duplicate detection** - Prevents double-entry when uploading partial and full monthly statements
- **Date range handling** - Works with both partial and complete monthly statements

### 🏷️ Intelligent Categorization  
- **Machine learning** - Automatically learns from your categorization patterns
- **Custom categories** - Create and manage your own expense categories
- **Merchant recognition** - Identifies recurring merchants and auto-categorizes

### 👥 Family Budget Management
- **Multi-person tracking** - Separate tracking for family members
- **Shared expenses** - Handle joint accounts and shared costs
- **Personal vs Family** - Distinguish between individual and household expenses

### 📊 Analytics & Reporting
- **Interactive charts** - Monthly spending trends, category breakdowns
- **Budget planning** - Future financial planning tools
- **Export capabilities** - Generate reports in multiple formats

### 🔒 Security & Privacy
- **Local processing** - All data stays on your device
- **No cloud storage** - Your financial data remains private
- **Encryption** - Sensitive data is encrypted at rest

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- Python 3.9+ (for ML categorization)
- Modern web browser

### Installation
```bash
# Clone the repository
git clone https://github.com/Csancus/expense-tracker.git
cd expense-tracker

# Install dependencies
npm install
pip install -r requirements.txt

# Start development server
npm run dev
```

## 🏗️ Technical Architecture

### Frontend (React + TypeScript)
- **React 18** with TypeScript for type safety
- **Zustand** for state management
- **Chart.js/D3.js** for data visualization
- **React Hook Form** for form handling

### Backend (Node.js + Express)
- **Express.js** API server
- **Prisma ORM** with SQLite database
- **File upload handling** for bank statements
- **PDF/CSV parsing** libraries

### ML Engine (Python)
- **scikit-learn** for expense categorization
- **pandas** for data processing
- **Natural language processing** for merchant matching

## 📁 Project Structure
```
expense-tracker/
├── frontend/           # React TypeScript app
├── backend/            # Node.js Express API
├── ml-engine/          # Python categorization service
├── parsers/            # Bank statement parsers
├── database/           # Database schemas and migrations
├── docs/               # Documentation
└── scripts/            # Build and deployment scripts
```

## 🛣️ Roadmap

### Phase 1: Core Functionality
- [ ] Basic statement parsing (OTP, Raiffeisen)
- [ ] Manual expense categorization
- [ ] Simple duplicate detection
- [ ] Basic reporting dashboard

### Phase 2: Intelligence
- [ ] Machine learning categorization
- [ ] Advanced duplicate detection
- [ ] Merchant recognition
- [ ] Trend analysis

### Phase 3: Advanced Features  
- [ ] Family/multi-user support
- [ ] Budget planning tools
- [ ] Mobile app
- [ ] Bank API integration

## 🤝 Contributing
Contributions are welcome! Please read our contributing guidelines and submit pull requests for any improvements.

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer
This tool is for personal use only. Always verify imported transactions and maintain backup copies of your original bank statements.
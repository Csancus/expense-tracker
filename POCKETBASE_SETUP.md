# PocketBase + Railway Setup Útmutató

## 🚀 Gyors Deploy (5 perc)

### 1. PocketBase Projekt Létrehozása

1. Hozz létre új GitHub repository-t: `expense-tracker-backend`
2. Klónozd le és add hozzá ezeket a fájlokat:

**Dockerfile:**
```dockerfile
FROM alpine:3.18
RUN apk add --no-cache ca-certificates
WORKDIR /app

# Download PocketBase
ADD https://github.com/pocketbase/pocketbase/releases/download/v0.20.0/pocketbase_0.20.0_linux_amd64.zip ./pb.zip
RUN unzip pb.zip && rm pb.zip && chmod +x pocketbase

# Create pb_data directory
RUN mkdir -p pb_data

EXPOSE 8080

CMD ["./pocketbase", "serve", "--http=0.0.0.0:8080"]
```

**pb_schema.json** (PocketBase adatbázis séma):
```json
{
  "collections": [
    {
      "name": "categories",
      "type": "base",
      "system": false,
      "schema": [
        {
          "name": "user_id",
          "type": "relation",
          "required": true,
          "options": {
            "collectionId": "_pb_users_auth_",
            "cascadeDelete": true,
            "minSelect": null,
            "maxSelect": 1,
            "displayFields": ["email"]
          }
        },
        {
          "name": "name",
          "type": "text",
          "required": true,
          "options": {
            "min": null,
            "max": null,
            "pattern": ""
          }
        },
        {
          "name": "emoji",
          "type": "text",
          "required": false,
          "options": {
            "min": null,
            "max": 10,
            "pattern": ""
          }
        },
        {
          "name": "color",
          "type": "text",
          "required": false,
          "options": {
            "min": null,
            "max": 7,
            "pattern": "^#[0-9A-Fa-f]{6}$"
          }
        }
      ],
      "indexes": [
        "CREATE INDEX idx_categories_user_id ON categories (user_id)"
      ],
      "listRule": "@request.auth.id = user_id",
      "viewRule": "@request.auth.id = user_id",
      "createRule": "@request.auth.id = user_id",
      "updateRule": "@request.auth.id = user_id",
      "deleteRule": "@request.auth.id = user_id"
    },
    {
      "name": "category_rules",
      "type": "base",
      "system": false,
      "schema": [
        {
          "name": "user_id",
          "type": "relation",
          "required": true,
          "options": {
            "collectionId": "_pb_users_auth_",
            "cascadeDelete": true,
            "minSelect": null,
            "maxSelect": 1,
            "displayFields": ["email"]
          }
        },
        {
          "name": "category_id",
          "type": "relation",
          "required": true,
          "options": {
            "collectionId": "categories",
            "cascadeDelete": true,
            "minSelect": null,
            "maxSelect": 1,
            "displayFields": ["name"]
          }
        },
        {
          "name": "merchant_pattern",
          "type": "text",
          "required": true,
          "options": {
            "min": 1,
            "max": null,
            "pattern": ""
          }
        },
        {
          "name": "start_date",
          "type": "date",
          "required": false
        },
        {
          "name": "end_date",
          "type": "date",
          "required": false
        },
        {
          "name": "priority",
          "type": "number",
          "required": false,
          "options": {
            "min": 0,
            "max": null
          }
        }
      ],
      "listRule": "@request.auth.id = user_id",
      "viewRule": "@request.auth.id = user_id",
      "createRule": "@request.auth.id = user_id",
      "updateRule": "@request.auth.id = user_id",
      "deleteRule": "@request.auth.id = user_id"
    },
    {
      "name": "transactions",
      "type": "base",
      "system": false,
      "schema": [
        {
          "name": "user_id",
          "type": "relation",
          "required": true,
          "options": {
            "collectionId": "_pb_users_auth_",
            "cascadeDelete": true,
            "minSelect": null,
            "maxSelect": 1,
            "displayFields": ["email"]
          }
        },
        {
          "name": "date",
          "type": "date",
          "required": true
        },
        {
          "name": "merchant",
          "type": "text",
          "required": true,
          "options": {
            "min": 1,
            "max": 200,
            "pattern": ""
          }
        },
        {
          "name": "description",
          "type": "text",
          "required": false,
          "options": {
            "min": null,
            "max": 500,
            "pattern": ""
          }
        },
        {
          "name": "amount",
          "type": "number",
          "required": true,
          "options": {
            "min": null,
            "max": null
          }
        },
        {
          "name": "category_id",
          "type": "relation",
          "required": false,
          "options": {
            "collectionId": "categories",
            "cascadeDelete": false,
            "minSelect": null,
            "maxSelect": 1,
            "displayFields": ["name"]
          }
        },
        {
          "name": "bank",
          "type": "text",
          "required": false,
          "options": {
            "min": null,
            "max": 50,
            "pattern": ""
          }
        },
        {
          "name": "reference",
          "type": "text",
          "required": false,
          "options": {
            "min": null,
            "max": 100,
            "pattern": ""
          }
        },
        {
          "name": "memo",
          "type": "text",
          "required": false,
          "options": {
            "min": null,
            "max": 200,
            "pattern": ""
          }
        },
        {
          "name": "hash",
          "type": "text",
          "required": false,
          "options": {
            "min": null,
            "max": 100,
            "pattern": ""
          }
        }
      ],
      "indexes": [
        "CREATE UNIQUE INDEX idx_transaction_hash ON transactions (hash) WHERE hash != ''",
        "CREATE INDEX idx_transactions_user_date ON transactions (user_id, date DESC)",
        "CREATE INDEX idx_transactions_category ON transactions (category_id)"
      ],
      "listRule": "@request.auth.id = user_id",
      "viewRule": "@request.auth.id = user_id", 
      "createRule": "@request.auth.id = user_id",
      "updateRule": "@request.auth.id = user_id",
      "deleteRule": "@request.auth.id = user_id"
    },
    {
      "name": "file_uploads",
      "type": "base",
      "system": false,
      "schema": [
        {
          "name": "user_id",
          "type": "relation",
          "required": true,
          "options": {
            "collectionId": "_pb_users_auth_",
            "cascadeDelete": true,
            "minSelect": null,
            "maxSelect": 1,
            "displayFields": ["email"]
          }
        },
        {
          "name": "filename",
          "type": "text",
          "required": true,
          "options": {
            "min": 1,
            "max": 255,
            "pattern": ""
          }
        },
        {
          "name": "bank",
          "type": "text",
          "required": true,
          "options": {
            "min": 1,
            "max": 50,
            "pattern": ""
          }
        },
        {
          "name": "file_hash",
          "type": "text",
          "required": true,
          "options": {
            "min": 1,
            "max": 100,
            "pattern": ""
          }
        },
        {
          "name": "transactions_count",
          "type": "number",
          "required": false,
          "options": {
            "min": 0,
            "max": null
          }
        },
        {
          "name": "file",
          "type": "file",
          "required": false,
          "options": {
            "maxSelect": 1,
            "maxSize": 10485760,
            "mimeTypes": ["application/pdf", "text/csv", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
            "thumbs": []
          }
        }
      ],
      "indexes": [
        "CREATE UNIQUE INDEX idx_file_hash ON file_uploads (file_hash)",
        "CREATE INDEX idx_uploads_user_date ON file_uploads (user_id, created DESC)"
      ],
      "listRule": "@request.auth.id = user_id",
      "viewRule": "@request.auth.id = user_id",
      "createRule": "@request.auth.id = user_id",
      "updateRule": "@request.auth.id = user_id",
      "deleteRule": "@request.auth.id = user_id"
    }
  ]
}
```

### 2. Railway Deploy

1. Menj a [railway.app](https://railway.app) oldalra
2. Jelentkezz be GitHub fiókkal
3. Kattints "New Project" → "Deploy from GitHub repo"
4. Válaszd ki az `expense-tracker-backend` repository-t
5. Railway automatikusan felismeri a Dockerfile-t és telepíti

### 3. Domain és Environment

1. Railway project dashboard → Settings → Generate Domain
2. Másold ki a domain-t (pl. `https://expense-tracker-backend-production.up.railway.app`)
3. Teszteld: nyisd meg a domain-t, látnod kell a PocketBase admin UI-t

### 4. PocketBase Konfiguráció

1. Menj a Railway domain-re (pl. `https://your-app.railway.app`)
2. Hozz létre admin fiókot (első belépéskor)
3. Importáld a sémát: Settings → Import collections → töltsd fel a `pb_schema.json`-t

### 5. Frontend Konfiguráció

**Opció 1: Meta tag (GitHub Pages):**
```html
<meta name="POCKETBASE_URL" content="https://your-app.railway.app">
```

**Opció 2: JavaScript config:**
```javascript
window.POCKETBASE_URL = 'https://your-app.railway.app';
```

**Opció 3: Environment variable:**
```bash
POCKETBASE_URL=https://your-app.railway.app
```

### 6. OAuth Beállítás (opcionális)

1. PocketBase Admin → Settings → Auth providers
2. Google OAuth:
   - Client ID és Secret hozzáadása
   - Redirect URL: `https://your-app.railway.app/api/oauth2-redirect`

### 7. Email Konfiguráció

PocketBase Admin → Settings → Mail settings:
- **SMTP host**: smtp.gmail.com
- **Port**: 587
- **Username**: your-email@gmail.com  
- **Password**: app-specific-password
- **From name**: Expense Tracker
- **From address**: your-email@gmail.com

### 8. Backup Stratégia

**Automatikus backup script:**
```bash
#!/bin/bash
# backup.sh
docker exec pocketbase_container ./pocketbase export backup_$(date +%Y%m%d_%H%M%S).zip
```

**Railway cron job:** 
```yaml
# railway.yml
build:
  buildCommand: echo "Building..."
deploy:
  startCommand: ./pocketbase serve --http=0.0.0.0:$PORT
  healthcheckPath: /api/health
  restartPolicyType: on-failure
```

### 9. Költségoptimalizálás

**Railway Pricing:**
- **Starter**: $5/hó - 512MB RAM, 1GB storage
- **Developer**: $10/hó - 1GB RAM, 5GB storage  
- **Team**: $20/hó - 2GB RAM, 10GB storage

**Optimalizáció:**
- SQLite file size monitoring
- Regular cleanup scripts
- Image compression

### 10. Monitorozás

**Railway Dashboard:**
- CPU/Memory usage
- Request logs
- Error monitoring

**PocketBase Admin:**
- Database size
- User analytics  
- Collection statistics

### 11. Scaling & Performance

**Horizontal scaling:**
```yaml
# railway.yml
services:
  pocketbase:
    source: .
    domains:
      - expense-tracker.railway.app
    envs:
      PORT: 8080
```

**Performance tips:**
- Database indexing (már beállítva)
- File upload size limits
- Rate limiting rules

### 12. Security

**Best practices:**
- Admin UI elrejtése production-ben
- CORS beállítás csak trusted domain-ekre
- API rate limiting
- User email verification

**CORS konfiguráció:**
```javascript
// main.go vagy config
{
  "allowedOrigins": [
    "https://csancus.github.io", 
    "http://localhost:3000"
  ]
}
```

### 13. Testing

1. Nyisd meg az app-ot
2. Regisztrálj új felhasználót
3. Jelentkezz be
4. Tölts fel bankszámlakivonatot
5. Ellenőrizd a PocketBase Admin UI-ban az adatokat

## 🎯 Miért Railway + PocketBase?

- **5 perces setup** vs 30 perc mások
- **$5/hó fix költség** vs változó pricing
- **Teljes adatkontroll** SQLite file-ban
- **Egyszerű backup** file copy
- **EU/GDPR compliance** választható datacenter
- **No vendor lock-in** - export SQLite és ready

## 🔧 Troubleshooting

**"Connection refused":**
- Ellenőrizd a Railway domain-t
- PocketBase service fut-e

**"Auth failed":**
- Email verification enabled-e
- CORS settings helyesek-e

**"File upload failed":**
- File size limit (10MB default)
- MIME type restrictions

**Performance issues:**
- Database size (SQLite limit ~1TB)
- Railway resource limits
# Release Notifier

Сервіс для управління підписками на email-сповіщення про нові релізи GitHub-репозиторіїв.

**Production:** https://release-notifier-production-04c1.up.railway.app

---

## Setup

```bash
# Install
npm install

# Configure .env
cp .env.example .env

# Run migrations
npm run db:migrate:dev

# Start dev server
npm run dev
```

---

## API

### POST /api/subscribe

Підписатися на реліз. Відправляє confirmation email з uniqe токеном.

```bash
curl -X POST http://localhost:3000/api/subscribe \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","repo":"golang/go"}'
```

**Response (200):**
```json
{
  "success": true,
  "message": "Confirmation email sent"
}
```

---

### GET /api/confirm/:token

Підтвердити підписку через токен з email.

```bash
curl http://localhost:3000/api/confirm/a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

**Response (200):**
```json
{
  "success": true,
  "message": "Subscription confirmed successfully",
  "repository": "golang/go"
}
```

---

### GET /api/unsubscribe/:token

Відписатися через токен з email.

```bash
curl http://localhost:3000/api/unsubscribe/x1y2z3a4b5c6d7e8f9g0h1i2j3k4l5m6
```

**Response (200):**
```json
{
  "success": true,
  "message": "Unsubscribed successfully",
  "repository": "golang/go"
}
```

---

### GET /api/subscriptions?email=user@example.com

Отримати активні підписки користувача (тільки confirmed).

```bash
curl "http://localhost:3000/api/subscriptions?email=user@example.com"
```

**Response (200):**
```json
[
  {
    "email": "user@example.com",
    "repo": "golang/go",
    "confirmed": true,
    "last_seen_tag": "go1.20"
  },
  {
    "email": "user@example.com",
    "repo": "nodejs/node",
    "confirmed": true,
    "last_seen_tag": "v18.15.0"
  }
]
```

---

### GET /health

Health check.

```bash
curl http://localhost:3000/health
```

**Response (200):**
```json
{
  "status": "ok",
  "timestamp": "2026-04-13T12:34:56.789Z"
}
```
---

## Environment Variables

```env
DATABASE_URL=postgresql://...
GITHUB_API_TOKEN=ghp_...
EMAIL_PASSWORD=YOUR_MAILTRAP_API_TOKEN
EMAIL_FROM=noreply@example.com
```

---

## Testing

```bash
npm test
npm run test:watch
```

---

## License

MIT

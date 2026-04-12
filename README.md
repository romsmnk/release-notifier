# Release Notifier

GitHub Release Notifier - це API сервіс, який дозволяє користувачам підписатися на email-сповіщення про нові релізи GitHub-репозиторіїв.

## Live Demo

**Production URL:** https://release-notifier-production-04c1.up.railway.app/

**Доступні endpoints:**
- `GET /health` - перевірка стану сервісу
- `GET /docs` - Swagger документація
- `POST /api/subscribe` - підписатися на релізи
- `POST /api/unsubscribe` - відписатися від релізів
- `GET /api/subscriptions` - отримати список підписок

**Приклад тестування:**
```bash
# Перевірити здоров'я сервісу
curl https://release-notifier-production-04c1.up.railway.app/health

# Підписатися на релізи
curl -X POST https://release-notifier-production-04c1.up.railway.app/api/subscribe \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","repository":"golang/go"}'

# Отримати підписки
curl "https://release-notifier-production-04c1.up.railway.app/api/subscriptions?email=your@email.com"

# Переглянути Swagger документацію
# Відкрити: https://release-notifier-production-04c1.up.railway.app/docs
```

---

## Про версії

### v1.0

**Реалізовано:**
- REST API з 4 основними endpoints
- PostgreSQL база з Prisma ORM
- Email сповіщення про нові релізи
- GitHub API інтеграція з rate limit handling
- Docker & Docker Compose
- Unit тести (12+ cases)
- Swagger документація
- GitHub Actions CI/CD
- Deployed на Railway

**Структура API (v1):**
```
POST   /api/subscribe      - Підписатися (без підтвердження email)
POST   /api/unsubscribe    - Відписатися (за email + repository)
GET    /api/subscriptions  - Список підписок користувача
GET    /health             - Health check
```

### v2.0 (Планується)

**Зміни для дотримання ТЗ:**
- Додати email confirmation flow:
  - `POST /api/subscribe` → відправляє confirmation email з токеном
  - `GET /api/confirm/{token}` → підтверджує email через посилання
  - `GET /api/unsubscribe/{token}` → відписує через посилання в email
- Оновити БД: додати `confirmToken`, `unsubscribeToken`, `confirmedAt`
- Комбінація двох методів: old endpoints (v1) + new endpoints (v2) для backward compatibility

**Причина затримки:**
Дедлайн завдання - v1 реалізована повністю з усіма 10 основними вимогами ТЗ. Email confirmation потребує додаткового часу для правильної реалізації, тому інтегрується в v2.
---

## Основні можливості

- **REST API** для управління підписками на релізи
- **Автоматичне сканування** нових релізів за розкладом
- **Email-сповіщення** про нові релізи в реальному часі
- **GitHub API інтеграція** з обробкою rate limits
- **PostgreSQL база даних** для зберігання даних
- **Docker & Docker Compose** для легкого розгортання
- **Юніт-тести** для критичної бізнес-логіки
- **Swagger документація** API
- **GitHub Actions CI/CD** pipeline

---

## Вимоги

### Основні вимоги (реалізовано)

1.  **REST API** з Swagger документацією
2.  **Монолітна архітектура** - весь функціонал в одному сервісі
3.  **PostgreSQL база** з міграціями при старті
4.  **Docker & Docker Compose** для оркестрування
5.  **Сканер релізів** з регулярною перевіркою
6.  **GitHub API інтеграція** з валідацією формату `owner/repo`
7.  **Обробка GitHub rate limits** (429 Too Many Requests)
8.  **Fastify framework** - легкий і швидкий
9.  **Юніт-тести** для бізнес-логіки
10. **README з документацією**

### Extra функціонал

- **API Key автентифікація** з headers `x-api-key` (реалізовано)
- **GitHub Actions CI/CD** (реалізовано)

---

## Швидкий старт

### Локальне розробка

#### Передумови
- Node.js >= 22
- npm >= 9
- PostgreSQL >= 15

#### Встановлення

```bash
# Клонувати репозиторій
git clone <repo-url>
cd release-notifier

# Встановити залежності
npm install

# Налаштувати .env
cp .env.example .env

# Заповнити необхідні значення в .env:
# - DATABASE_URL=postgresql://...
# - EMAIL_USER і EMAIL_PASSWORD від Mailtrap
# - GITHUB_API_TOKEN (опціонально)
```

#### Залупуск бази даних

```bash
# Запустити Prisma міграції
npm run db:migrate:dev

# Або скинути базу (лише для розробки)
npm run db:reset
```

#### Запуск сервісу

```bash
# Development з auto-reload
npm run dev

# Production
npm run build
npm start
```

Сервіс буде доступний на `http://localhost:3000`

Swagger документація: `http://localhost:3000/docs`

---

### Docker Compose розгортання

```bash
# Налаштувати .env файл
cp .env.example .env

# Запустити весь стек
docker-compose up -d

# Перевірити логи
docker-compose logs -f app

# Зупинити
docker-compose down
```

---

## API Документація

### 1. Підписатися на релізи

```http
POST /api/subscribe
Content-Type: application/json
x-api-key: your-api-key (optional)

{
  "email": "user@example.com",
  "repository": "golang/go"
}
```

**Відповіді:**
- `201 Created` - успішна підписка
- `400 Bad Request` - некоректний формат репозиторію
- `404 Not Found` - репозиторій не знайдено на GitHub
- `409 Conflict` - користувач вже підписаний

### 2. Відписатися від релізів

```http
POST /api/unsubscribe
Content-Type: application/json
x-api-key: your-api-key (optional)

{
  "email": "user@example.com",
  "repository": "golang/go"
}
```

**Відповіді:**
- `200 OK` - успішне відписування
- `404 Not Found` - підписка не знайдена

### 3. Отримати підписки користувача

```http
GET /api/subscriptions?email=user@example.com
x-api-key: your-api-key (optional)
```

**Відповідь:**
```json
[
  {
    "id": "sub_123",
    "repository": "golang/go",
    "createdAt": "2024-04-09T10:00:00Z"
  }
]
```

### 4. Перевірка здоров'я сервісу

```http
GET /health
```

**Відповідь:**
```json
{
  "status": "ok",
  "timestamp": "2024-04-09T10:00:00Z"
}
```

---

## Архітектура

```
┌─────────────────────────────────────────┐
│           REST API (Fastify)            │
├─────────────────────────────────────────┤
│      /api/subscribe                     │
│      /api/unsubscribe                   │
│      /api/subscriptions                 │
│      /health                            │
├─────────────────────────────────────────┤
│           Services Layer                │
├─────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐     │
│  │ Subscription │  │   Release    │     │
│  │   Service    │  │   Scanner    │     │
│  └──────────────┘  └──────────────┘     │
├─────────────────────────────────────────┤
│           External Services             │
├─────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐     │
│  │  GitHub API  │  │ Email Service│     │
│  │   Client     │  │   (Mailtrap) │     │
│  └──────────────┘  └──────────────┘     │
├─────────────────────────────────────────┤
│            Data Layer                   │
├─────────────────────────────────────────┤
│  ┌──────────────┐                       │
│  │ PostgreSQL   │                       │
│  │   (Prisma)   │                       │
│  └──────────────┘                       │
└─────────────────────────────────────────┘
```

### Компоненти

1. **API Routes** - REST endpoints для управління підписками
2. **Subscription Service** - бізнес-логіка підписок
3. **Release Scanner** - фоновий сервіс для сканування релізів (запускається кожну годину)
4. **GitHub API Client** - інтеграція з GitHub API
5. **Email Service** - надсилання email сповіщень
6. **Database (Prisma)** - ORM для роботи з PostgreSQL
7. **Cache (Redis)** - кешування GitHub API відповідей

---

## Тестування

### Юніт-тести

Тести покривають критичну бізнес-логіку:

```bash
# Запустити всі тести
npm test

# Запустити лише юніт-тести
npm run test:unit

# З покриттям
npm test -- --coverage
```

#### Що тестується

- **SubscriptionService**
  - Валідація формату репозиторію (`owner/repo`)
  - Створення/видалення підписок
  - Обробка дублікатів
  - Пошук підписок користувача

- **GitHubApiClient**
  - Обробка rate limits (429)
  - Валідація наявності репозиторію
  - Отримання релізів

- **EmailService**
  - Надсилання email
  - Форматування повідомлень

---

## Як працює Release Scanner

```
┌─────────────────────────────────────────┐
│   Release Scanner (запускається кожну   │
│         годину за замовчуванням)        │
└─────────────────────────────────────────┘
                   далі
┌─────────────────────────────────────────┐
│  Отримати всі активні підписки з БД     │
│  SELECT * FROM subscriptions            │
│         WHERE isActive = true           │
└─────────────────────────────────────────┘
                   далі
    ┌──────────────────────────────────┐
    │  Для кожної підписки:            │
    │                                  │
    │  1. GitHub API: getLatestReleases│
    │     /repos/{owner}/{repo}/       │
    │          releases                │
    │                                  │
    │  2. Отримати найновіший реліз    │
    │     (не draft, не prerelease)    │
    │                                  │
    │  3. Порівняти з lastSeenTag      │
    │     в БД                         │
    │                                  │
    │  4. Якщо новий реліз:            │
    │     - Надіслати email            │
    │     - Оновити lastSeenTag        │
    │     - Залогувати notification     │
    └──────────────────────────────────┘
                   далі
         ┌──────────────────┐
         │  Цикл завершено  │
         │  Очікувати 1 год │
         └──────────────────┘
```

### Проблеми, які вирішуються

1. **Видулення дублікатів** - `lastSeenTag` забезпечує, що кожна версія сповіщує лише один раз
2. **GitHub API Rate Limiting** - обробляється 429 помилка з retry
3. **Фоновий процес** - не блокує основний API
4. **Масштабованість** - можна легко додати Redis cache

---

## API Key Автентифікація

### Як це працює

1. **Активація:** Встановити `API_KEY_ENABLED=true` у `.env`
2. **Токен:** Встановити `API_KEY_TOKEN=your-secret-key` у `.env`
3. **Передача:** Додати header `x-api-key: your-secret-key` до всіх запитів

### Приклад

```bash
curl -X POST http://localhost:3000/api/subscribe \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-secret-key" \
  -d '{
    "email": "user@example.com",
    "repository": "golang/go"
  }'
```

### Навіщо потрібна

- **Безпека:** Запобігає несанкціонованому доступу
- **Rate limiting:** Можна застосовувати окремі обмеження для різних токенів
- **Аудит:** Отримання логів за яким токеном робилися запити

---

## GitHub Rate Limits

### Проблема

GitHub API має обмеження на кількість запитів:
- **60 запитів/год** без токена
- **5000 запитів/год** з токеном

### Рішення

1. **Перевірка rate limits** перед запитом
2. **Обробка 429 помилки** з exponential backoff
3. **Redis кешування** (30 хвилин) для часто запитуваних репозиторіїв
4. **GitHub API token** - встановити `GITHUB_API_TOKEN` у `.env`

### Код обробки

```typescript
private async handleRateLimitError(error: AxiosError): Promise<never> {
  if (error.response?.status === 429) {
    const retryAfter = error.response.headers['retry-after'] || '60';
    // ... retry logic
  }
}
```

---

## Моніторинг

### Логування

Сервіс використовує **Pino** для структурованого логування:

```javascript
logger.info({ email, repository }, 'User subscribed');
logger.error({ error }, 'Failed to send email');
```

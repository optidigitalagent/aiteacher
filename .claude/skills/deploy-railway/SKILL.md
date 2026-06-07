# Skill: Deploy to Railway

## Цель
Задеплоить backend на Railway без даунтайма и не сломать продакшн.

## Предусловия
- [ ] `npm test` проходит локально
- [ ] Нет `any` типов в изменённых файлах (`tsc --noEmit`)
- [ ] Env переменные в Railway совпадают с `.env.example`
- [ ] DB миграции готовы если изменилась схема

## Шаги

### 1. Проверь готовность кода
```powershell
cd backend
npm run typecheck   # tsc --noEmit
npm test            # все тесты зелёные
```

### 2. Проверь миграции
Если изменились таблицы в PostgreSQL:
```
backend/data/migrations/  ← здесь все миграции
```
- Новая миграция должна быть `0XX_<name>.sql`
- Миграция должна быть обратимой (или иметь rollback план)
- Проверь что migration runner применит её при старте

### 3. Коммит и пуш
```powershell
git add backend/src/...   # только нужные файлы
git commit -m "fix: описание"
git push origin main
```
Railway автоматически деплоит при push в main.

### 4. Мониторинг деплоя
```powershell
railway logs --tail 200
```
Нормальный старт выглядит так:
```
[server] listening on port 4000
[db] migrations applied
[redis] connected
[ws] WebSocket server ready
```

### 5. Smoke test после деплоя
- [ ] Backend отвечает на `GET /health`
- [ ] Kids flow: открыть Kids урок → проверить WS connect
- [ ] Проверить логи на `[kids-v1] session_started`
- [ ] Нет `4402 Payment Required` для Kids сессий
- [ ] TTS работает (слышен голос учителя)

### 6. Rollback если сломалось
```powershell
# В Railway Dashboard → Deployments → предыдущий деплой → Rollback
# Или через CLI:
railway rollback
```

## Критические env переменные (проверить в Railway)
```
ANTHROPIC_API_KEY
ELEVENLABS_API_KEY
ELEVENLABS_VOICE_ID
DEEPGRAM_API_KEY
PINECONE_API_KEY
PINECONE_INDEX
DATABASE_URL
REDIS_URL
JWT_SECRET
PORT=4000
```

---

## Learnings (самообучение)

### Пример записи
**Что пошло не так:** миграция 018_kids_sessions.sql не применилась
потому что migration runner ожидал sequential IDs без пробелов.
**Решение:** переименовать файл и проверить runner логику.

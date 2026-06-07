# Skill: Debug Kids Flow

## Цель
Отладить проблемы специфичные для Kids (дети 6–12 лет) урока.
Kids flow отдельный от Adult flow — не путай их.

## Быстрая диагностика

### Нормальный старт Kids сессии (что должно быть в логах)
```
[kids-start-diag] routing_to_kids_brain_v1
[kids-v1] session_started sessionId=...
[kids-v1] focus_lesson_start received
```

### Красные флаги
```
[payment-guard-hit]           ← Kids попал в adult guard → баг
4402 Payment Required         ← Kids не прошёл через Kids routing
[kids-v1] не появился         ← routing не сработал
```

## Шаги диагностики

### 1. Проверь routing
Файл: `backend/src/ws/lesson-ws.ts`
- Kids routing проверяет `kids_session_id` ДО adult payment guard
- Если Kids попадает в `[payment-guard-hit]` — проблема в порядке проверок

### 2. Проверь kids_sessions в DB
```sql
SELECT * FROM kids_sessions WHERE id = '<sessionId>' LIMIT 1;
```
- Запись должна существовать с правильным `status`
- Если нет записи → проблема в Kids session creation

### 3. Kids Brain V1
Папка: `docs/kids-brain-v1/`
- Отдельный промпт для детей (другой язык, другая педагогика)
- Kids не используют FSM взрослого урока
- Голос Kids: 'nova' (см. `kidsTtsStream()`)

### 4. Kids TTS специфика
В `kidsTtsStream()` → voice = 'nova'
При ошибке TTS → `{ type: 'voice_unavailable', reason }` клиенту
Kids сессия не должна завершаться при TTS ошибке — должна деградировать gracefully

### 5. Проверь child profiles
```sql
SELECT * FROM kids_child_profiles WHERE session_id = '<sessionId>';
```
Kids Brain использует возраст/имя ребёнка из child_profiles.

## Kids-специфичные таблицы
```
kids_sessions           — активные Kids сессии
kids_child_profiles     — профиль ребёнка (имя, возраст)
kids_mastery_records    — прогресс по темам
kids_session_summaries  — итоги сессий
kids_safety_events      — safety события (контентная фильтрация)
```

---

## Learnings (самообучение)

### [2026-06] Kids 4402 — DB error fallthrough в payment guard
**Проблема:** Если DB запрос в payment guard падал с ошибкой,
exception не ловился правильно → Kids сессия получала 4402.
**Решение:** Kids routing происходит ДО adult payment guard.
При дебаге Kids — сначала проверяй порядок проверок в lesson-ws.ts,
не adult guard как изолированную проблему.
**Не делай:** не переписывай adult payment guard при отладке Kids.

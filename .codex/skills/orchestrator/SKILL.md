---
name: "orchestrator"
description: "Select and run the repository review, QA, deploy, prompt, voice, RAG, cost, analytics, or safety pipeline."
---

> Codex adaptation: follow AGENTS.md first. Treat .codex/workflow/ as the
> writable workflow state. Do not modify .claude. Use subagents only when the
> user explicitly requests delegation or parallel agent work; otherwise execute
> this checklist in the current session. External research and external writes
> require authorization from the current request.

## Automation V2 Override

This section supersedes conflicting legacy instructions later in this file.
Select role checklists, execute them sequentially in the current session unless
the user explicitly requests parallel agents, persist results in
`.codex/workflow/`, and continue the autonomous loop. Do not require prompt or
result transfer by the user. Pipeline failures return to the executor's repair
loop; they are not user blockers unless an `AGENTS.md` stop condition applies.

# Agent: Orchestrator

## Роль
Ты главный координатор агентов проекта Mentium AI English Teacher.
Получаешь задачу, выбираешь нужный pipeline, запускаешь субагентов
в правильном порядке, передаёшь результат от одного к другому,
принимаешь итоговое решение.

**Ты не делаешь работу сам** — ты делегируешь и агрегируешь.

---

## Доступные агенты и их роли

| Агент              | Файл                                      | Что возвращает             |
|--------------------|-------------------------------------------|----------------------------|
| `auto-qa-loop`     | `.codex/skills/auto-qa-loop/SKILL.md`    | PASS / FAIL + авто-фикс    |
| `backend-reviewer` | `.codex/skills/backend-reviewer/SKILL.md`| PASS / NEEDS_CHANGES       |
| `lesson-qa`        | `.codex/skills/lesson-qa/SKILL.md`       | PASS / FAIL                |
| `migration-guard`  | `.codex/skills/migration-guard/SKILL.md` | SAFE / UNSAFE              |
| `env-checker`      | `.codex/skills/env-checker/SKILL.md`     | READY / NOT_READY          |
| `prompt-tester`    | `.codex/skills/prompt-tester/SKILL.md`   | PASS / FAIL                |
| `latency-profiler` | `.codex/skills/latency-profiler/SKILL.md`| НОРМА / ПРЕВЫШЕНИЕ         |
| `rag-auditor`      | `.codex/skills/rag-auditor/SKILL.md`     | GOOD / DEGRADED / BROKEN   |
| `completion-analyzer` | `.codex/skills/completion-analyzer/SKILL.md` | Completion Rate + фаза |
| `lesson-critic`    | `.codex/skills/lesson-critic/SKILL.md`   | Quality Score              |
| `api-cost-estimator` | `.codex/skills/api-cost-estimator/SKILL.md` | Расходы + маржа        |
| `kids-safety-monitor` | `.codex/skills/kids-safety-monitor/SKILL.md` | OK / INCIDENT          |

---

## Шаг 1: Определи pipeline по запросу

Прочитай запрос и выбери pipeline из таблицы:

| Ключевые слова в запросе                              | Pipeline              |
|-------------------------------------------------------|-----------------------|
| "задеплой", "деплой", "deploy", "выкатить"            | `DEPLOY`              |
| "проверь код", "code review", "ревью"                  | `CODE_REVIEW`         |
| "сломано", "ошибка", "тесты падают", "не работает"    | `AUTO_FIX`            |
| "промпт", "master-prompt", "педагогика"               | `PROMPT_CHANGE`       |
| "голос медленный", "задержка", "latency", "TTS тормоз"| `VOICE_ISSUE`         |
| "pinecone", "RAG", "чанки", "учебник"                 | `RAG_AUDIT`           |
| "еженедельно", "статистика", "отчёт", "аналитика"     | `WEEKLY_REVIEW`       |
| "расходы", "стоимость", "API cost", "бюджет"          | `COST_CHECK`          |
| "дети", "kids", "безопасность детей"                  | `KIDS_SAFETY`         |

Если запрос не попадает ни в одну категорию — спроси у человека какой pipeline нужен.

---

## Шаг 2: Выполни pipeline

### Pipeline: DEPLOY
**Цель:** безопасно задеплоить на Railway.

```
1. backend-reviewer    → если NEEDS_CHANGES: стоп, уведоми
2. lesson-qa           → если FAIL: стоп, уведоми
3. migration-guard     → (только если есть новые .sql файлы)
                          если UNSAFE: стоп, уведоми
4. env-checker         → если NOT_READY: стоп, уведоми
5. [ДЕПЛОЙ]            → запусти: railway up
6. lesson-qa (повтор)  → пост-деплой проверка
```

Правило: **любой FAIL/UNSAFE/NOT_READY = стоп**, не переходи к следующему шагу.
Сообщи человеку что именно заблокировало деплой.

---

### Pipeline: CODE_REVIEW
**Цель:** проверить свежие изменения.

```
1. backend-reviewer    → найти нарушения правил
2. lesson-qa           → проверить что flow не сломан
```

Параллельный запуск — оба агента независимы, запускай одновременно.
Агрегируй все findings в один список.

---

### Pipeline: AUTO_FIX
**Цель:** найти и автоматически починить проблемы.

```
1. auto-qa-loop        → тест → фикс → верификация (до 3 итераций)
2. backend-reviewer    → проверить что фиксы не нарушили правила
3. lesson-qa           → финальная проверка flow
```

Если `auto-qa-loop` вернул BLOCKED → стоп, уведоми человека, не запускай дальше.

---

### Pipeline: PROMPT_CHANGE
**Цель:** проверить изменения в `docs/master-prompt.md`.

```
1. prompt-tester       → если FAIL: стоп, уведоми
2. lesson-qa           → проверить что FSM не сломан
```

Правило: изменения в промпте без PASS от `prompt-tester` — недопустимы.

---

### Pipeline: VOICE_ISSUE
**Цель:** найти и устранить голосовую задержку.

```
1. latency-profiler    → найти узкое место
2. [если превышение] auto-qa-loop → починить код узкого места
3. latency-profiler    → повторный замер
```

Если после фикса всё ещё > 2.5s → уведоми человека с детальным отчётом.

---

### Pipeline: RAG_AUDIT
**Цель:** проверить качество RAG контекста.

```
1. rag-auditor         → найти проблемы конфига и качества
2. lesson-qa           → проверить что RAG не сломал lesson flow
```

---

### Pipeline: WEEKLY_REVIEW
**Цель:** еженедельный обзор здоровья продукта.

```
1. lesson-critic       → педагогическое качество (Quality Score)
2. completion-analyzer → воронка и Completion Rate
3. api-cost-estimator  → расходы и маржа
4. kids-safety-monitor → инциденты безопасности
```

Все четыре запускай параллельно — они независимы.
Агрегируй в единый дашборд.

---

### Pipeline: COST_CHECK
**Цель:** проверить расходы на API.

```
1. api-cost-estimator  → полный отчёт расходов
```

---

### Pipeline: KIDS_SAFETY
**Цель:** проверить инциденты в детских сессиях.

```
1. kids-safety-monitor → полный отчёт
```

Если найдены HIGH severity события → немедленно уведоми человека
перед финальным отчётом.

---

## Шаг 3: Передача результатов между агентами

При запуске каждого следующего агента передавай ему контекст:

```
КОНТЕКСТ ОТ ПРЕДЫДУЩЕГО АГЕНТА:
  Агент: <name>
  Статус: <PASS/FAIL/etc>
  Ключевые findings: <список>

ТВОЯ ЗАДАЧА: <инструкция из AGENT.md>
```

---

## Шаг 4: Правила остановки

| Условие                                      | Действие                           |
|----------------------------------------------|------------------------------------|
| Любой агент вернул блокирующий статус        | Стоп, уведоми человека             |
| 3+ агентов вернули WARNING                   | Продолжить, но отметить в отчёте   |
| Все агенты PASS                              | Продолжить / завершить pipeline    |
| Агент завис или вернул непонятный результат  | Стоп, запроси ручную проверку      |

**Блокирующие статусы по агентам:**
- `backend-reviewer` → NEEDS_CHANGES (только критические ❌, не советы 💡)
- `lesson-qa` → FAIL
- `migration-guard` → UNSAFE
- `env-checker` → NOT_READY
- `prompt-tester` → FAIL
- `auto-qa-loop` → BLOCKED

**Не блокируют (только предупреждение):**
- `latency-profiler` → ПРЕВЫШЕНИЕ (если < 4s — деплой разрешён с пометкой)
- `rag-auditor` → DEGRADED (BROKEN — блокирует)
- `lesson-critic` → Quality Score < 0.65 (предупреждение, не блокер)
- `api-cost-estimator` → любой результат (только информация)
- `kids-safety-monitor` → LOW/MEDIUM (HIGH — блокирует деплой)

---

## Финальный отчёт оркестратора

```
ORCHESTRATOR REPORT
════════════════════════════════════════
PIPELINE:  <название>
ИТОГ:      ✅ SUCCESS | ⚠️ SUCCESS WITH WARNINGS | ❌ BLOCKED

АГЕНТЫ ЗАПУЩЕНЫ:
  ✅ backend-reviewer  → PASS
  ✅ lesson-qa         → PASS
  ⚠️  latency-profiler → 2.8s (превышение, некритично)
  ✅ env-checker       → READY

[Если BLOCKED:]
❌ ЗАБЛОКИРОВАНО: <агент> → <причина>
   Файл: <path:line>
   Что сделать: <конкретная рекомендация>

[Если warnings:]
⚠️  ПРЕДУПРЕЖДЕНИЯ:
   — <агент>: <что именно>

[Если SUCCESS:]
✅ Все проверки пройдены.
   <следующий шаг — деплой / можно мержить / etc>
```

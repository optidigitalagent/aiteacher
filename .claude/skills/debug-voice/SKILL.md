# Skill: Debug Voice / TTS / STT

## Цель
Найти и устранить проблему с голосом: TTS не играет, STT не распознаёт,
большая задержка, voice_unavailable на клиенте.

## Шаги

### 1. Определи симптом
- [ ] TTS совсем не играет → идёт к шагу 2
- [ ] STT не транскрибирует → идёт к шагу 5
- [ ] Задержка > 2.5s → идёт к шагу 6
- [ ] `voice_unavailable` на клиенте → проверь `speakToClient()` return value

### 2. Проверь ElevenLabs
```bash
# Проверить env
echo $ELEVENLABS_API_KEY
echo $ELEVENLABS_VOICE_ID

# Проверить логи Railway
railway logs --tail 100 | grep -i "elevenlabs\|tts\|voice"
```
Файл: `backend/src/tts/elevenlabs.ts` и `backend/src/tts/tts-client.ts`

### 3. Проверь speakToClient()
Функция должна возвращать `{ ok: boolean, reason?: string }`.
Если `ok: false` → TTS упал но не бросил исключение — проверь:
- HTTP статус от ElevenLabs (429 = rate limit, 401 = key невалидный)
- `console.warn('[kids:voice_degraded]')` в логах

### 4. Kids vs Adult TTS
- Kids flow: `kidsTtsStream()` в `backend/src/ws/lesson-ws.ts`
- Adult flow: `ttsStream()` в том же файле
- Убедись что Kids сессия не попадает в adult path

### 5. Проверь Deepgram STT
```bash
railway logs | grep -i "deepgram\|stt\|transcript"
```
Файл: `backend/src/voice/deepgram.ts`
- Проверь `DEEPGRAM_API_KEY`
- Убедись что аудио чанки доходят: `{ type: "audio_chunk" }` в WS логах

### 6. Диагностика задержки
Latency бюджет (цель < 2.5s):
```
STT finalization:      ~300ms
RAG query:             ~100ms
Claude first token:    ~600ms
TTS first chunk:       ~400ms
Audio playback:        ~80ms
```
Где потеря — смотри timestamps в логах между событиями.

### 7. Проверь WS события на клиенте
```javascript
// В browser console
// Должна быть последовательность:
// teacher_turn_end → audio_chunk (первый) → ... → teacher_turn_end
```

## Формат результата
После отладки — запиши в Learnings раздел ниже что именно сломалось
и как было исправлено, чтобы не искать снова.

---

## Learnings (самообучение)

### [2026-06] voice_unavailable + ok:false без крэша
**Проблема:** `speakToClient()` молча возвращал `{ ok: false }` когда
ElevenLabs возвращал 429 (rate limit в платном плане).
**Решение:** Добавить проверку `result.ok` после `await speakToClient()`
и отправлять `{ type: 'voice_unavailable', reason }` клиенту.
**Где:** `backend/src/ws/lesson-ws.ts` → `kidsTtsStream()` и `ttsStream()`

### [2026-06] Kids сессии получали 4402 Payment Required
**Проблема:** Kids `focus_lesson_start` падал в adult payment guard
из-за того что DB error давал fallthrough вместо Kids routing.
**Решение:** Фикс в payment guard — проверять Kids session ID
до adult plan check. Не трогать adult guard как Kids debugging.
**Где:** `backend/src/ws/lesson-ws.ts` → payment guard middleware

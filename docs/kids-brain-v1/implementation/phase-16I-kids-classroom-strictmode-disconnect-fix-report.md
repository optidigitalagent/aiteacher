# Phase 16I — Kids Classroom StrictMode Disconnect Fix Report

## Files modified

| File | Lines changed |
|------|---------------|
| `frontend/src/pages/KidsClassroomPage.tsx` | WebSocket `useEffect` (stale guard) + error UI fallback copy |

---

## Exact fix

### Stale guard — `KidsClassroomPage.tsx` WebSocket `useEffect`

**Before:**

```tsx
useEffect(() => {
  const token = getStoredToken() ?? undefined
  const ws = createClassroomSocket(
    handleMessage,
    undefined,
    (code) => {
      setKidsState(prev => {
        if (prev !== 'complete') {
          setErrorMsg(`Connection closed (${code}). Please try again.`)
          stopRecording('disconnect')
          return 'error'
        }
        return prev
      })
    },
    token,
    sessionId,
  )
  wsRef.current = ws

  return () => {
    stopAudioPlayback()
    ws.close(1000, 'page_unmount')
    wsRef.current = null
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [sessionId])
```

**After:**

```tsx
useEffect(() => {
  let stale = false                           // ← ADDED

  const token = getStoredToken() ?? undefined
  const ws = createClassroomSocket(
    handleMessage,
    undefined,
    (code) => {
      if (stale) return                       // ← ADDED: ignore stale WS events
      setKidsState(prev => {
        if (prev !== 'complete') {
          void code                           // raw close code suppressed from child UI
          setErrorMsg('One moment, we\'re reconnecting.')  // ← child-safe copy
          stopRecording('disconnect')
          return 'error'
        }
        return prev
      })
    },
    token,
    sessionId,
  )
  wsRef.current = ws

  return () => {
    stale = true                              // ← ADDED: mark before closing
    stopAudioPlayback()
    ws.close(1000, 'page_unmount')
    wsRef.current = null
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [sessionId])
```

### Error UI fallback copy

**Before:**

```tsx
<p className="kc-error-sub">{errorMsg ?? 'Connection problem. Please try again.'}</p>
```

**After:**

```tsx
<p className="kc-error-sub">{errorMsg ?? 'One moment, we\'re reconnecting.'}</p>
```

---

## Stale callback protection

The `stale` boolean is a closure variable local to each effect invocation.

**StrictMode double-mount sequence:**

```
Effect1  →  let stale = false  →  ws1 created (CONNECTING)
Cleanup1 →  stale = true       →  ws1.close(1000, 'page_unmount')
Effect2  →  let stale = false  →  ws2 created (CONNECTING)

[browser yields to network loop]

ws2.onopen fires          → lesson proceeds normally
ws1.onclose fires (1006)  → if (stale) return   ← BLOCKED, state not corrupted
```

**Real unmount sequence:**

```
Cleanup2 →  stale = true  →  ws2.close(1000, 'page_unmount')
ws2.onclose fires         → if (stale) return   ← ignored (component unmounting)
```

Each remount creates a fresh `stale = false` closure so WS2's live events are handled normally.

---

## Child-safe error handling

Raw WebSocket close codes (1006, 1001, etc.) are protocol-level values that are meaningless and alarming to children.

Two changes suppress them from the child-facing UI:

1. `void code` inside the `onclose` callback — the `code` argument is intentionally not interpolated into the error string.
2. Error message changed from `"Connection closed (${code}). Please try again."` to `"One moment, we're reconnecting."`.
3. Fallback copy in the error screen changed from `"Connection problem. Please try again."` to `"One moment, we're reconnecting."`.

Children now see a calm, action-oriented message instead of a protocol error code.

---

## Build results

```
tsc --noEmit   → 0 errors
vite build     → ✓ built in 3.18s
```

Output:
- `dist/index.html`           0.87 kB │ gzip: 0.46 kB
- `dist/assets/index.css`    41.92 kB │ gzip: 7.93 kB
- `dist/assets/index.js`    514.90 kB │ gzip: 143.11 kB

One chunk-size warning (>500 kB) — pre-existing, unrelated to this change.

---

## Verification

**Expected StrictMode behaviour after fix:**

| Event | Before fix | After fix |
|-------|-----------|-----------|
| WS1 onclose (1006) fires after WS2 is live | `kidsState → 'error'`, child sees "Connection closed (1006)" | `if (stale) return` — state unchanged, lesson continues |
| WS2 onopen + lesson_ready | Overwritten by WS1 onclose | Renders normally |
| Real unmount onclose | Would show error briefly | Silently ignored |

---

## Next required phase

**Phase 16J** — End-to-end Kids lesson QA in development mode with `<StrictMode>` active:

- Confirm no "Connection closed" error appears on mount
- Confirm lesson_ready renders the lesson start screen
- Confirm voice turn flow completes a full lesson without error
- Confirm real page navigation (back to `/kids`) cleanly closes WS2 with code 1000

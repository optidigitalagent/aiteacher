# Phase 16I.0 — Kids Classroom Mount/Unmount Audit Report

## Audit scope

Files read:
- `frontend/src/main.tsx`
- `frontend/src/App.tsx`
- `frontend/src/pages/KidsPrototypePage.tsx`
- `frontend/src/pages/KidsClassroomPage.tsx`
- `frontend/src/features/classroom/services/classroomSocket.ts`
- `frontend/src/context/AuthContext.tsx`
- `frontend/src/features/classroom/hooks/useKidsMic.ts`

---

## Root Cause

**React 18 `<StrictMode>` double-mounts `KidsClassroomPage` in development mode.**

The `useEffect` in `KidsClassroomPage` creates a WebSocket and registers an `onClose` callback. StrictMode's mock-unmount fires the effect's cleanup function (`ws.close(1000, 'page_unmount')`) before the browser has yielded to the network event loop. At that point the WebSocket is still in CONNECTING state. Closing a CONNECTING socket aborts the TCP handshake and causes the browser to fire `onclose` with code **1006** (abnormal closure — no close frame was exchanged).

The cleanup runs, the effect runs a second time (StrictMode remount), and WS2 connects successfully and receives `lesson_ready`. **But WS1's stale `onclose` callback fires asynchronously — after WS2 is live — and overwrites component state to `'error'` with the message "Connection closed (1006)"**, because there is no stale-flag guard.

React state setters (`setKidsState`, `setErrorMsg`) are stable references. WS1's closure still points to the live component's setters. The component is not unmounted; it is remounted. The corrupting `setKidsState('error')` call goes through.

---

## Exact file and lines

### `frontend/src/main.tsx` — lines 9–11

```tsx
createRoot(root).render(
  <StrictMode>     ← enables double-mount in development
    <App />
  </StrictMode>,
)
```

StrictMode is the environmental trigger.

---

### `frontend/src/pages/KidsClassroomPage.tsx` — lines 813–841

```tsx
useEffect(() => {
  const token = getStoredToken() ?? undefined
  const ws = createClassroomSocket(         // line 815 — WS1 created (CONNECTING)
    handleMessage,
    undefined,
    (code) => {                             // line 817 — onClose callback
      // ← NO STALE GUARD HERE
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
    ws.close(1000, 'page_unmount')          // line 837 — closes WS1 while CONNECTING
    wsRef.current = null
    // ← NO stale = true HERE
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [sessionId])
```

The bug is the absence of a `stale` guard across lines 817–839.

---

## Execution sequence

```
1.  User navigates to /kids/classroom/84fe...
2.  KidsClassroomPage renders  →  kidsState = 'connecting'

3.  [StrictMode: Effect1]
    createClassroomSocket()  →  ws1 = new WebSocket(url)   [CONNECTING]
    wsRef.current = ws1

4.  [StrictMode: Cleanup1 — runs in same JS task, before browser yields]
    ws1.close(1000, 'page_unmount')
    ws1 is still CONNECTING  →  TCP aborted
    wsRef.current = null

5.  [StrictMode: Effect2]
    createClassroomSocket()  →  ws2 = new WebSocket(url)   [CONNECTING]
    wsRef.current = ws2

    ── browser yields to network event loop ──

6.  ws2.onopen fires
    console: [Classroom WS] connected

7.  Backend: [ws] client connected / [ws:ownership] owner_set
    Backend sends lesson_ready

8.  ws2.onmessage fires
    console: [Classroom IN] lesson_ready
    setKidsState('ready')  →  kidsState = 'ready'

9.  ws1.onclose fires  (code=1006, from the aborted CONNECTING close in step 4)
    console: [Classroom WS] disconnected
    ← stale onClose callback — no guard
    setKidsState(prev='ready')  →  prev ≠ 'complete'
    setErrorMsg('Connection closed (1006). Please try again.')
    stopRecording('disconnect')
    return 'error'   →  kidsState = 'error'

10. UI renders error screen:
    "Oops! Something went wrong. Connection closed (1006)."

11. ws2 remains open in background (orphaned, never visible to user)

12. User clicks "Try again"  →  navigate('/kids')
    KidsClassroomPage real unmount  →  Cleanup runs
    ws2.close(1000, 'page_unmount')
    Backend: [ws] client disconnected code=1000 reason="page_unmount"

13. User clicks "Start Kids Prototype"
    startKidsSession()  →  new session 8286... created
```

---

## Why two sessions are created

Session `84fe...` is not destroyed by the backend — it is orphaned on the frontend. WS2 connects to it successfully, but the user never sees the ready state because WS1's stale `onclose` corrupts the state first. When the user clicks "Try again", navigates to `/kids`, and starts again, `startKidsSession()` makes a fresh POST to `/lesson/kids/start`, creating session `8286...`.

The second session is a user-driven retry, not an automatic reconnect.

---

## Why the backend shows code=1000

The backend log entry `code=1000 reason="page_unmount"` corresponds to **WS2**, not WS1.

WS1 was aborted before TCP completion (CONNECTING state). No WebSocket handshake took place; the backend never saw WS1 at all.

WS2 connected successfully and remained open. When the user clicked "Try again" (real unmount), the cleanup ran `ws2.close(1000, 'page_unmount')` — which produced the backend log entry the team observed.

---

## Why the frontend shows code=1006

Per the WebSocket specification (RFC 6455), closing a socket that is still in the CONNECTING state aborts the connection attempt without exchanging a Close frame. The browser fires `onclose` with status code **1006** (Abnormal Closure). This is the code reported in WS1's `onclose` callback, which then appears in the error message shown to the user.

---

## Secondary issue: `useKidsMic` cleanup (minor)

`useKidsMic` (`frontend/src/features/classroom/hooks/useKidsMic.ts`, lines 100–106) also has a cleanup-on-unmount effect:

```ts
useEffect(() => {
  return () => {
    if (isActiveRef.current) {
      stopRecording('unmount')
    }
  }
}, [stopRecording])
```

StrictMode will also double-run this. If recording is active, `stopRecording` fires, which calls `sendMessage(wsRef.current, { type: 'mic_stop' })`. At that point `wsRef.current` may be `null` (already cleared by the outer cleanup). The `sendMessage` guard (`ws?.readyState === WebSocket.OPEN`) silently swallows this. No crash, but it is a secondary side effect worth noting.

---

## Minimal safe fix

Add a `stale` boolean to the `useEffect` closure in `KidsClassroomPage`. Set it to `true` in the cleanup function. Guard the `onClose` callback with `if (stale) return`.

**File:** `frontend/src/pages/KidsClassroomPage.tsx`
**Lines to change:** 813–841

```tsx
useEffect(() => {
  let stale = false                               // ← ADD

  const token = getStoredToken() ?? undefined
  const ws = createClassroomSocket(
    handleMessage,
    undefined,
    (code) => {
      if (stale) return                           // ← ADD: ignore stale WS events
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
    stale = true                                  // ← ADD: mark before closing
    stopAudioPlayback()
    ws.close(1000, 'page_unmount')
    wsRef.current = null
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [sessionId])
```

**How it fixes the bug:**

- **StrictMode mock-unmount (Cleanup1):** sets `stale = true` → closes WS1. When `ws1.onclose` fires asynchronously with code=1006, the guard returns early. Component state is not corrupted. WS2 connects normally and the lesson proceeds.
- **Real unmount (user navigates away, Cleanup2):** same mechanism — `stale = true` → WS2 is closed. `onclose` would fire but returns early (component is being unmounted, state update not needed).
- **WS2's lifecycle on remount:** the second effect creates a new `stale` closure variable starting at `false`. WS2's `onclose` events are handled normally.

**Change size:** 3 lines added. No other files modified. No backend changes. No routing changes.

---

## Confidence level

**95%**

The symptom (always disconnects after `lesson_ready` in development, error code 1006, backend sees `page_unmount` with 1000) is fully and uniquely explained by StrictMode double-mount + missing stale guard. The `<StrictMode>` wrapper is confirmed in `main.tsx:9`. The missing guard is confirmed by reading the `useEffect` in `KidsClassroomPage.tsx:813–841`.

The 5% residual accounts for the possibility of an additional production-mode disconnect path (network flap, server-side session expiry race, etc.) that is not currently visible because the development-mode bug masks it completely.

---

## Do NOT implement yet

Per Phase 16I.0 rules: audit only. Fix will be implemented in Phase 16I.1.

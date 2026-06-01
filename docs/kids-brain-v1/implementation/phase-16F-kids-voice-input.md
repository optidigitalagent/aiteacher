# Phase 16F — Kids Voice Input

Goal:
Add child-safe voice input to the new Kids classroom UI.

Frontend-first phase.

Do NOT modify curriculum.
Do NOT change WebSocket protocol unless existing protocol already supports mic/audio frames.
Do NOT deploy.

Context:
Phase 16E created:
/kids/classroom/:sessionId

Current Kids UI supports text input/chips.
Next requirement: child can speak answers like "blue", "green", "red".

Audit first:
- existing classroom voice/mic implementation
- existing WS audio frame support
- existing STT/Deepgram path
- whether Kids UI can reuse existing mic pipeline safely

Read:
- frontend/src/pages/KidsClassroomPage.tsx
- frontend/src/pages/ClassroomPage*
- frontend/src/**/mic*
- frontend/src/**/audio*
- frontend/src/**/classroomSocket*
- backend/src/ws/lesson-ws.ts
- backend/src/**/deepgram*
- backend/src/**/stt*
- docs/kids-brain-v1/implementation/phase-16E-kids-ui-shell-report.md

Tasks:

1. Find existing mic pipeline

Identify:
- how adult classroom records mic
- frame format sent to backend
- start/stop events
- sample rate
- permission handling
- iOS audio unlock behavior
- error handling

2. Reuse safely

If existing mic pipeline is reusable:
- extract/reuse hook/component without adult UI
- wire it into KidsClassroomPage
- keep UI child-friendly

If existing pipeline is not reusable:
- create minimal Kids mic hook using existing WS frame format

3. Kids mic UX

Add:
- big mic button
- states:
  - tap to speak
  - listening
  - sending
  - teacher speaking
  - reconnecting
  - mic blocked
- friendly permission message
- no raw browser errors
- fallback to text input if mic unavailable

4. Safety

- Do not auto-record on page load
- require child/parent click
- stop recording when teacher is speaking
- stop recording on disconnect
- stop recording on route leave
- cap recording duration if existing cap exists
- no unauthenticated audio upload

5. Backend compatibility

Do not invent a new protocol unless unavoidable.
Use existing WS audio/STT path.

If backend Kids path does not support audio frames yet:
- stop and report exact gap
- do not fake voice by sending text
- recommend backend Phase 16G

6. Tests/build

Add frontend tests if existing test setup supports it.
At minimum run:

cd frontend
npm run build

cd backend
npx tsc --noEmit

If backend touched:
cd backend
npx vitest run src/ws
npx vitest run src/kids-brain

7. Create report

docs/kids-brain-v1/implementation/phase-16F-kids-voice-input-report.md

Report must include:
- files modified/created
- existing mic pipeline found
- reused vs new implementation
- backend compatibility result
- mic UX states
- safety rules
- build/test results
- remaining risks
- next required phase

Output:
- files modified/created
- mic path used
- backend compatibility
- build results
- next required phase
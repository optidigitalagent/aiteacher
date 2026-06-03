# Phase 16H — Kids Voice Turn UX Synchronization

Goal:
Synchronize the Kids microphone UX with teacher/student turn state so children can only speak when the backend is ready.

Frontend-focused phase.

Do NOT modify curriculum.
Do NOT change WebSocket protocol.
Do NOT deploy.

Context:
Phase 16F added Kids mic UI and PCM capture.
Phase 16G enabled backend STT for Kids Brain using the existing createSTT pipeline.

Current remaining issue:
Voice works, but the Kids UI must prevent turn-taking races:

- child speaks while teacher audio is still playing
- mic enabled before teacher_turn_end
- mic remains enabled during reconnect
- child taps mic while transcript is being processed
- mic stays active after lesson_end
- audio chunks sent while backend is not listening

Required UX:
teacher speaking
→ mic disabled

teacher_turn_end
→ mic enabled

child recording
→ mic active

mic_stop / sending
→ mic disabled

teacher response starts
→ mic disabled

reconnect
→ mic disabled

lesson complete
→ mic disabled

Read:
- frontend/src/pages/KidsClassroomPage.tsx
- frontend/src/features/classroom/hooks/useKidsMic.ts
- frontend/src/features/classroom/api/classroomSocket.ts
- frontend/src/**/voice*
- frontend/src/**/audio*
- backend/src/ws/lesson-ws.ts
- docs/kids-brain-v1/implementation/phase-16F-kids-voice-input-report.md
- docs/kids-brain-v1/implementation/phase-16G-kids-brain-stt-integration-report.md

Tasks:

1. Audit current Kids UI turn state

Find how KidsClassroomPage tracks:
- lesson_ready
- ai_text
- audio_chunk
- teacher_turn_end
- lesson_end
- reconnect/disconnect
- mic state
- sending state

2. Define single mic enabled condition

Mic must be enabled only when all are true:

- socket connected
- lesson started/ready
- not teacher speaking
- teacher_turn_end received for current teacher turn
- not sending transcript
- not reconnecting
- not lesson complete
- no mic permission error
- backend is expected to accept input

3. Implement synchronization

Update KidsClassroomPage/useKidsMic so:

- ai_text or audio_chunk disables mic
- teacher_turn_end enables mic
- send text disables mic until next teacher_turn_end
- mic_start disables text quick chips if needed
- mic_stop enters sending state
- reconnect/disconnect stops mic and disables input
- lesson_end stops mic and disables input
- route leave stops mic

4. Child-friendly UI

Button labels should clearly show:

- “Listen”
- “Your turn”
- “Tap to speak”
- “Listening…”
- “Sending…”
- “Reconnecting…”
- “Lesson complete”

No raw errors.

5. Safety

- never auto-start recording
- stop mic on teacher response
- stop mic on disconnect
- stop mic on page unload/unmount
- fallback to text input remains available when mic blocked
- no unauthenticated audio sending

6. Tests/build

If frontend test setup exists, add component/hook tests for:
- mic disabled during teacher speaking
- mic enabled after teacher_turn_end
- mic disabled during reconnect
- mic stopped on lesson_end
- mic stopped on unmount

At minimum run:

cd frontend
npm run build

If backend untouched:
do not run backend tests unless needed.

7. Create report

docs/kids-brain-v1/implementation/phase-16H-kids-voice-turn-ux-synchronization-report.md

Report must include:
- files modified
- mic enabled condition
- turn states implemented
- safety behavior
- build/test results
- remaining risks
- next required phase

Output:
- files modified
- mic enabled condition
- build results
- next required phase
import type { Message, LessonPhase } from '../../../hooks/useLesson'

// FUTURE: replace with live messages from backend WebSocket
function msg(
  role: Message['role'],
  text: string,
  phase?: LessonPhase,
  id?: string,
): Message {
  return { id: id ?? crypto.randomUUID(), role, text, displayText: text, phase }
}

export const MOCK_MESSAGES: Message[] = [
  msg('teacher',
    "Good morning! Ready for today's lesson? Quick question — can you give me one sentence about something you did last weekend?",
    'DIAGNOSTIC',
    'mock-1',
  ),
  msg('student', 'I go to cinema with my friend.', undefined, 'mock-2'),
  msg('teacher',
    "Nice! And what film did you watch? Also — I noticed you said 'I go'. How would you say that in the past?",
    'DIAGNOSTIC',
    'mock-3',
  ),
  msg('student', 'I went. I went to cinema and watched Avatar.', undefined, 'mock-4'),
  msg('teacher',
    "Perfect — 'went' and 'watched'. You already know something about Past Simple! Let's dig deeper. Today we're going to use a real story to explore it.",
    'CONTEXT_INPUT',
    'mock-5',
  ),
  msg('teacher',
    "In May 1953, Edmund Hillary and Tenzing Norgay climbed Mount Everest. They left their camp at 4 AM. Hillary took photos at the top. The whole world celebrated when they returned safely. What do you notice about the verbs in that story?",
    'RULE_DISCOVERY',
    'mock-6',
  ),
  msg('student', 'They end with -ed? Climbed, returned...', undefined, 'mock-7'),
  msg('teacher',
    "Exactly! Now what about 'took'? The verb is 'take'. Does 'took' follow the -ed rule?",
    'RULE_DISCOVERY',
    'mock-8',
  ),
]

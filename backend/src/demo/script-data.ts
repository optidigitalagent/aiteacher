// Static content packs for demo lesson engine

export interface TopicPack {
  label: string
  warmUpQuestion: string
  warmUpPlaceholder: string
  speakingPrompt: string
  speakingPlaceholder: string
  writingPrompt: string
  writingPlaceholder: string
}

export interface TeacherTone {
  greeting: string
  encouragement: string[]
  correction: string
  transition: string
}

export interface GrammarPack {
  target: string
  explanation: string
  question: string
  options: [string, string, string, string]
  correctIndex: 0 | 1 | 2 | 3
  correctExplanation: string
  wrongExplanation: string
}

export const TOPIC_PACKS: Record<string, TopicPack> = {
  music_social: {
    label: 'music & social life',
    warmUpQuestion: "What's the last song you had stuck in your head? And what kind of music do you usually put on when you want to feel good?",
    warmUpPlaceholder: "e.g. Lately I keep listening to… because it makes me feel…",
    speakingPrompt: "Tell me about a night out or a social event you actually enjoyed — what made it good?",
    speakingPlaceholder: "e.g. Last month I went to… and honestly the best part was…",
    writingPrompt: "Describe your ideal Friday evening from start to finish — where you'd go, who'd be there, what you'd do.",
    writingPlaceholder: "e.g. My perfect Friday would start with… then we'd…",
  },
  games: {
    label: 'gaming',
    warmUpQuestion: "What game are you into right now — and why does it keep pulling you back in?",
    warmUpPlaceholder: "e.g. I've been playing… non-stop because…",
    speakingPrompt: "Tell me about a moment in a game that genuinely impressed you or made you feel something.",
    speakingPlaceholder: "e.g. There was this moment in… where I had to… and it felt…",
    writingPrompt: "If you could design one game mechanic that doesn't exist yet — something no other game does — what would it be?",
    writingPlaceholder: "e.g. My idea would be a game where players can… and the twist is…",
  },
  movies_series: {
    label: 'movies & series',
    warmUpQuestion: "What are you watching right now — and would you actually recommend it to a friend?",
    warmUpPlaceholder: "e.g. I'm watching… and honestly I'd say…",
    speakingPrompt: "Describe a scene or moment from something you watched recently — without major spoilers if you can.",
    speakingPlaceholder: "e.g. There's this scene where the main character… and what makes it work is…",
    writingPrompt: "Pitch me a show or film I should watch this weekend. Convince me in a few sentences — what makes it worth my time?",
    writingPlaceholder: "e.g. You have to watch… because it's… and the thing that makes it different is…",
  },
  travel: {
    label: 'travel',
    warmUpQuestion: "If you could book a flight anywhere tomorrow — no budget, no planning needed — where would you go and why?",
    warmUpPlaceholder: "e.g. I'd go straight to… because I've always wanted to…",
    speakingPrompt: "Tell me about the most memorable place you've ever been — what made it stick in your memory?",
    speakingPlaceholder: "e.g. The place that really stayed with me was… what made it special was…",
    writingPrompt: "Describe your dream trip in detail — where you'd go, how long you'd stay, and what one experience you couldn't miss.",
    writingPlaceholder: "e.g. My dream trip would be to… I'd spend… days and definitely…",
  },
  school_life: {
    label: 'school & studies',
    warmUpQuestion: "What's one subject or topic at school that you actually find interesting — even a little? What is it about it that works for you?",
    warmUpPlaceholder: "e.g. I genuinely enjoy… because…",
    speakingPrompt: "Tell me about a project, assignment, or class moment you're proud of — even something small.",
    speakingPlaceholder: "e.g. I worked on… and what I'm most proud of is…",
    writingPrompt: "If you could redesign one part of your school — lessons, schedule, rules, anything — what would you change and why?",
    writingPlaceholder: "e.g. The first thing I'd change is… because right now…",
  },
  future_career: {
    label: 'future plans',
    warmUpQuestion: "Do you have a rough idea of what you want to do after school — or is it still a big question mark? Either answer is fine.",
    warmUpPlaceholder: "e.g. I've been thinking about… / Honestly I'm not sure yet but…",
    speakingPrompt: "Tell me about a skill you've been trying to build lately — something you're actually working on.",
    speakingPlaceholder: "e.g. I've been trying to get better at… and what I do is…",
    writingPrompt: "Paint a picture of your ideal working life ten years from now — not just the job title, but what a typical day actually looks like.",
    writingPlaceholder: "e.g. Ten years from now I'd love to be… and a typical day would involve…",
  },
}

export const TEACHER_TONES: Record<string, TeacherTone> = {
  friendly_coach: {
    greeting: "Hey! Really glad you're here. I'm Alex — think of this less as a lesson and more as a practice session with someone in your corner.",
    encouragement: [
      "Nice one! That's exactly the kind of thing we build on.",
      "Good — you've got the right instinct there.",
      "That's solid. You're moving in the right direction.",
    ],
    correction: "Good attempt! Here's a small tweak that'll make it sound more natural:",
    transition: "Alright, let's shift gears — something a bit different now.",
  },
  older_friend: {
    greeting: "Hey! I'm Alex. Honestly, just talk to me the way you'd talk to a friend — I happen to know English really well, so I'll gently fix things as we go.",
    encouragement: [
      "Honestly that's pretty good — you've got the feel for it.",
      "Yeah, exactly — that's the right idea.",
      "Nice, keep going. You're more comfortable than you think.",
    ],
    correction: "Almost — here's how a native speaker would actually say that:",
    transition: "Cool, let's switch things up a bit.",
  },
  real_tutor: {
    greeting: "Hello! I'm Alex. We have a focused session ahead — let's use the time well. I'll give you precise feedback on everything.",
    encouragement: [
      "Well done. That's the correct approach.",
      "Good. That shows genuine understanding of the structure.",
      "Accurate. That's exactly what we're looking for.",
    ],
    correction: "Incorrect. The correct form is:",
    transition: "Good. Moving on to the next task.",
  },
  challenge_trainer: {
    greeting: "Hello. I'm Alex. I'm not here to make you comfortable — I'm here to push you past your current level. If it's easy, we're not working hard enough.",
    encouragement: [
      "Good — now let's make it better. More detail.",
      "Correct. Now can you say that with more confidence?",
      "That works. But I know you can go further.",
    ],
    correction: "That's weak. Here's the version that actually sounds strong:",
    transition: "Good. Raising the bar now.",
  },
}

export const GRAMMAR_PACKS: Record<string, GrammarPack> = {
  real_conversation_mission: {
    target: 'Present Perfect',
    explanation: "We use the **Present Perfect** (have/has + past participle) to talk about experiences or things that happened at some point in your life — without saying exactly when.",
    question: 'She _____ to London three times.',
    options: ['went', 'has been', 'goes', 'had been'],
    correctIndex: 1,
    correctExplanation: "Exactly right! \"Has been\" is Present Perfect — perfect for talking about life experiences.",
    wrongExplanation: "The correct answer is **has been** (Present Perfect). We use this when we talk about experiences without specifying exactly when they happened.",
  },
  fix_mistakes: {
    target: 'Articles (a / an / the)',
    explanation: "We use **a** before consonant sounds, **an** before vowel sounds, and **the** when both speaker and listener know which specific thing we mean.",
    question: 'I saw _____ interesting film last night.',
    options: ['a', 'an', 'the', '–'],
    correctIndex: 1,
    correctExplanation: "Perfect! \"An\" is correct because \"interesting\" starts with a vowel sound.",
    wrongExplanation: "The correct answer is **an**. We use \"an\" before any word that starts with a vowel sound — like \"interesting\".",
  },
  listening_check: {
    target: 'Past Simple',
    explanation: "We use the **Past Simple** for actions that are finished and happened at a specific time in the past. Regular verbs add -ed; irregular verbs have their own forms.",
    question: 'They _____ football yesterday afternoon.',
    options: ['played', 'have played', 'play', 'were playing'],
    correctIndex: 0,
    correctExplanation: "Correct! \"Played\" is Past Simple — we use it for completed actions at a specific past time. \"Yesterday\" is the clue.",
    wrongExplanation: "The correct answer is **played** (Past Simple). The word \"yesterday\" signals a completed, specific moment in the past — that always triggers Past Simple.",
  },
  find_level: {
    target: 'First Conditional',
    explanation: "We use the **First Conditional** (If + Present Simple, will + verb) to talk about situations that are real or likely to happen in the future.",
    question: 'If it rains tomorrow, we _____ the picnic.',
    options: ['cancel', 'cancelled', 'will cancel', 'would cancel'],
    correctIndex: 2,
    correctExplanation: "Spot on! First Conditional: If + present simple → will + base verb. This talks about real future possibilities.",
    wrongExplanation: "The correct answer is **will cancel**. First Conditional structure: If + present simple, will + base verb. \"Would\" belongs to the Second Conditional (hypothetical situations).",
  },
}

export const CONFIDENCE_INTROS: Record<string, string> = {
  freezes: "One thing before we start — there are no wrong answers here, only things to learn from. Just give it your best shot.",
  can_try: "Don't worry about being perfect. I'm here to help, not judge. Just give it a go.",
  okay: "Feel free to jump straight in — let's see where you are.",
  test_me: "Good — I'm going to push you a bit today. Let's see what you've really got.",
}

export const MISSION_INTROS: Record<string, string> = {
  real_conversation_mission: "Today we're going to focus on using English naturally — the way you'd actually use it with a real person.",
  fix_mistakes: "Today we're tackling the most common English mistakes — the ones that give people away as non-native. Let's fix them.",
  listening_check: "Today I want to see how well you understand and describe real English. Think of it as a snapshot of where you are.",
  find_level: "Today I want a proper read on your English level — so everything I suggest after this is actually useful for you.",
}

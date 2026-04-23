// Hardcoded content for Focus Student's Book 2 (A2+/B1, Pearson)
// MVP: units 1-8 with grammar targets, topics, vocabulary, example sentences

export interface FocusUnitContent {
  unit:        number
  title:       string
  grammarTarget: string
  lessonTopic: string
  textbookUnit: string  // display string for prompts
  grammarExplanation: string
  exampleSentences:   string[]
  keyVocabulary:      string[]
  exerciseIdeas:      string[]
}

export const FOCUS_2_UNITS: Record<number, FocusUnitContent> = {
  1: {
    unit:        1,
    title:       'Free Time',
    grammarTarget: 'Present Simple and Present Continuous',
    lessonTopic: 'hobbies, sports, and daily routines',
    textbookUnit: 'Focus 2 Unit 1',
    grammarExplanation: `
Present Simple: habits, routines, general truths.
  Form: I/you/we/they + base verb; he/she/it + verb+s/es
  "She plays tennis every weekend." "We don't watch much TV."
Present Continuous: actions happening now or temporary situations.
  Form: am/is/are + verb+ing
  "He is studying for his exam right now." "I'm not feeling well today."
Key contrast: "I play football" (habit) vs "I am playing football" (right now).
State verbs (know, like, want, need, believe) do NOT use continuous form.
`.trim(),
    exampleSentences: [
      'She reads books every evening. (habit)',
      'He is reading a book right now. (now)',
      'They go to the gym three times a week.',
      'We are not playing tennis today because of the rain.',
      'Do you usually watch films at the weekend?',
    ],
    keyVocabulary: ['hobby', 'routine', 'spare time', 'keen on', 'take up', 'give up', 'get fit'],
    exerciseIdeas: [
      'Put the verb in brackets in the correct form: She _____ (study) English every day.',
      'Choose: "I play / I am playing tennis — right now."',
      'Find the mistake: "He is knowing the answer."',
      'Describe your daily routine using at least 4 Present Simple sentences.',
    ],
  },

  2: {
    unit:        2,
    title:       'People and the Past',
    grammarTarget: 'Past Simple (regular and irregular verbs)',
    lessonTopic: 'historical figures, life events, achievements',
    textbookUnit: 'Focus 2 Unit 2',
    grammarExplanation: `
Past Simple: completed actions in the past.
Regular verbs: add -ed.  walk→walked, talk→talked, study→studied (y→ied)
Irregular verbs: change completely.  go→went, come→came, see→saw, have→had, make→made
Negatives: did not (didn't) + base verb.  "She didn't go to school yesterday."
Questions: Did + subject + base verb?  "Did you see the film?"
Time expressions: yesterday, last week, in 2010, ago, when I was young.
`.trim(),
    exampleSentences: [
      'In 1969, astronauts landed on the Moon.',
      'She didn\'t finish her homework last night.',
      'Did you visit your grandparents last weekend?',
      'He went to Paris two years ago and saw the Eiffel Tower.',
      'Marie Curie won two Nobel Prizes in her lifetime.',
    ],
    keyVocabulary: ['achievement', 'discover', 'invent', 'explore', 'overcome', 'succeed', 'courage'],
    exerciseIdeas: [
      'Fill in: In 1903, the Wright Brothers _____ (fly) the first airplane.',
      'Correct the sentence: "She goed to the market yesterday."',
      'Reorder: [she / last / won / year / a competition]',
      'Tell me 4 things you did last weekend using Past Simple.',
    ],
  },

  3: {
    unit:        3,
    title:       'Our World',
    grammarTarget: 'Comparatives and Superlatives',
    lessonTopic: 'geography, countries, natural wonders',
    textbookUnit: 'Focus 2 Unit 3',
    grammarExplanation: `
Comparatives: comparing two things. adjective + -er OR more + adjective + than
  Short adjectives (1-2 syllables): big→bigger, old→older, happy→happier
  Long adjectives (3+ syllables): more beautiful, more interesting, more dangerous
  Irregular: good→better, bad→worse, far→further
Superlatives: comparing within a group. the + adjective + -est OR the most + adjective
  "Everest is the highest mountain in the world."
  "This is the most exciting trip I've ever taken."
  Irregular: good→the best, bad→the worst
`.trim(),
    exampleSentences: [
      'The Amazon is longer than the Nile.',
      'Russia is the largest country in the world.',
      'This summer was hotter than last year.',
      'She speaks English better than her brother.',
      'What is the most dangerous animal on Earth?',
    ],
    keyVocabulary: ['enormous', 'ancient', 'remote', 'border', 'coastline', 'landscape', 'wonder'],
    exerciseIdeas: [
      'Complete: The Pacific Ocean is _____ (deep) than the Atlantic Ocean.',
      'Form the superlative: Tokyo is _____ (big) city I have ever visited.',
      'Correct: "She is more tall than her sister."',
      'Compare two countries or cities you know using 3 sentences.',
    ],
  },

  4: {
    unit:        4,
    title:       'Looking Good',
    grammarTarget: 'Present Perfect (have/has + past participle)',
    lessonTopic: 'fashion, appearance, personal style',
    textbookUnit: 'Focus 2 Unit 4',
    grammarExplanation: `
Present Perfect: connects the past to now. Have/has + past participle.
  Use 1 — experience (ever/never): "Have you ever been to London?"
  Use 2 — recent result: "I've lost my keys." (they're still lost now)
  Use 3 — unfinished time (today/this week): "She has read three books this month."
Regular past participles: work→worked, live→lived, study→studied
Irregular past participles: go→gone, see→seen, be→been, eat→eaten, write→written
KEY CONTRAST: Past Simple = finished time. Present Perfect = connection to now.
  "I saw Tom yesterday." (Past Simple — yesterday is finished)
  "I have seen Tom." (Present Perfect — at some point in my life up to now)
`.trim(),
    exampleSentences: [
      'Have you ever tried sushi?',
      'She has never visited the USA.',
      'I have just finished my homework.',
      'They have lived in Paris for five years.',
      'He hasn\'t eaten anything since this morning.',
    ],
    keyVocabulary: ['trend', 'style', 'outfit', 'designer', 'fashionable', 'unique', 'brand'],
    exerciseIdeas: [
      'Fill in: She _____ (never/try) Indian food before.',
      'Past Simple or Present Perfect? "I _____ (see) that film last Tuesday."',
      'Correct: "I have seen him yesterday."',
      'Tell me 3 things you have done this week using Present Perfect.',
    ],
  },

  5: {
    unit:        5,
    title:       'Food and Health',
    grammarTarget: 'Countable and uncountable nouns, quantifiers (much/many/a lot of/some/any)',
    lessonTopic: 'food, nutrition, healthy eating',
    textbookUnit: 'Focus 2 Unit 5',
    grammarExplanation: `
Countable nouns: can be counted. apple/apples, egg/eggs, sandwich/sandwiches
Uncountable nouns: cannot be counted. water, bread, rice, milk, sugar, advice, information
Quantifiers:
  many + countable plural: "How many eggs do you need?"
  much + uncountable: "How much sugar is in this?"
  a lot of / lots of: with both (affirmative): "There are a lot of apples."
  some: affirmative sentences: "I have some milk."
  any: questions and negatives: "Do you have any eggs? I don't have any milk."
  a few (countable) / a little (uncountable): small amount: "Add a little salt."
`.trim(),
    exampleSentences: [
      'How many calories are in this meal?',
      'There isn\'t much sugar in the recipe.',
      'She drinks a lot of water every day.',
      'We don\'t have any bread left.',
      'Could I have a few more minutes, please?',
    ],
    keyVocabulary: ['nutrition', 'ingredient', 'recipe', 'balanced diet', 'protein', 'fibre', 'calorie'],
    exerciseIdeas: [
      'Choose: "There is much / many / a lot of cheese in the fridge."',
      'Fill in: "How _____ sugar do you take in your coffee?"',
      'Countable or uncountable? List: tomato, rice, biscuit, milk, apple, advice.',
      'Describe what you ate today using quantifiers (some, a few, a lot of).',
    ],
  },

  6: {
    unit:        6,
    title:       'Future Plans',
    grammarTarget: 'Future forms: will, going to, Present Continuous for future',
    lessonTopic: 'plans, predictions, future technology',
    textbookUnit: 'Focus 2 Unit 6',
    grammarExplanation: `
Three future forms — each with a specific use:

will + base verb: predictions (no prior plan), spontaneous decisions, offers/promises
  "I think electric cars will replace petrol cars by 2040."
  "I'll help you with that." (spontaneous decision)

going to + base verb: plans made before the moment of speaking, predictions based on evidence
  "We're going to visit my grandparents this summer." (already planned)
  "Look at those clouds — it's going to rain." (evidence now)

Present Continuous (am/is/are + -ing): fixed arrangements (diary plans), usually with a time/place
  "I'm meeting Sara at 3 PM tomorrow." (appointment made)
  "They're flying to Rome on Friday." (ticket booked)
`.trim(),
    exampleSentences: [
      'Scientists believe we will land on Mars before 2040.',
      'I\'m going to study medicine at university.',
      'Are you doing anything special this weekend?',
      'Look at him — he\'s going to fall!',
      'I\'ll call you back in five minutes.',
    ],
    keyVocabulary: ['prediction', 'ambition', 'career', 'aim', 'achieve', 'opportunity', 'generation'],
    exerciseIdeas: [
      'Will or going to? "I _____ be a doctor — I already applied to medical school."',
      'Correct: "I will meeting my friend tomorrow."',
      'Fill in: Look at that car! It _____ (going to) crash!',
      'Tell me 3 real plans you have for the next week, using the correct future form.',
    ],
  },

  7: {
    unit:        7,
    title:       'Journey and Adventure',
    grammarTarget: 'First Conditional (if + Present Simple, will + base verb)',
    lessonTopic: 'travel, adventure, risks and consequences',
    textbookUnit: 'Focus 2 Unit 7',
    grammarExplanation: `
First Conditional: real/possible situations and their likely results.
  Structure: If + Present Simple, will + base verb
  "If you study hard, you will pass the exam."
  "If it rains tomorrow, we will stay inside."

  The "if" clause can come first or second — both are correct:
  "You will pass if you study hard."

  Other modals instead of "will": can, might, should, may
  "If you visit Tokyo, you might try sushi."
  "If you feel ill, you should see a doctor."

  NEVER use "will" in the "if" clause:
  ✗ "If you will study..."  ✓ "If you study..."
`.trim(),
    exampleSentences: [
      'If the weather is nice tomorrow, we will go to the beach.',
      'You will miss the bus if you don\'t hurry.',
      'If you don\'t eat breakfast, you might feel tired.',
      'What will you do if you fail the test?',
      'If I save enough money, I\'ll travel to Japan.',
    ],
    keyVocabulary: ['destination', 'itinerary', 'adventure', 'risk', 'consequence', 'expedition', 'explore'],
    exerciseIdeas: [
      'Complete: "If she _____ (not study), she _____ (fail) the exam."',
      'Correct: "If you will arrive late, the teacher will be angry."',
      'Make a First Conditional sentence about your own life.',
      'What will you do if it rains this weekend? Answer with 2-3 sentences.',
    ],
  },

  8: {
    unit:        8,
    title:       'Technology Today',
    grammarTarget: 'Modal verbs: should, must, have to, don\'t have to, mustn\'t',
    lessonTopic: 'technology, social media, rules and responsibilities',
    textbookUnit: 'Focus 2 Unit 8',
    grammarExplanation: `
Modal verbs for obligation, advice, and prohibition:

should / shouldn't: advice (not strong obligation)
  "You should get more sleep." "You shouldn't spend all day on your phone."

must / mustn't: strong obligation or prohibition (often a rule or law)
  "You must wear a seatbelt." "You mustn't use your phone while driving."

have to / don't have to: external obligation / no obligation
  "I have to finish this report by Friday." (boss said so)
  "You don't have to come to the meeting." (not required — your choice)

KEY CONTRAST:
  mustn't = forbidden — "You mustn't touch that — it's dangerous."
  don't have to = not necessary — "You don't have to come if you're tired."
`.trim(),
    exampleSentences: [
      'You should back up your data regularly.',
      'Students must not use phones during exams.',
      'You don\'t have to create an account to read the article.',
      'She has to finish the project before Monday.',
      'I think you should apologise to him.',
    ],
    keyVocabulary: ['privacy', 'digital', 'scroll', 'update', 'device', 'screen time', 'artificial intelligence'],
    exerciseIdeas: [
      'Choose: "You _____ (mustn\'t / don\'t have to) pay — it\'s free!"',
      'Fill in: "You _____ (should) drink more water — you look exhausted."',
      'Correct: "You don\'t must touch that — it\'s dangerous."',
      'Write 3 school rules using must, mustn\'t, and have to.',
    ],
  },
}

export function getFocusUnit(unit: number): FocusUnitContent | null {
  return FOCUS_2_UNITS[unit] ?? null
}

export function getFocusUnitsMap(): string {
  return Object.values(FOCUS_2_UNITS)
    .map(u => `Unit ${u.unit}: ${u.title} — ${u.grammarTarget}`)
    .join('\n')
}

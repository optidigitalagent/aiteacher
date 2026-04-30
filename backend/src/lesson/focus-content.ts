// Focus Student's Book 2 (Pearson, A2+/B1) — Units 1-8
// Each unit: grammar, reading passage, vocabulary, collocations, exercises

export interface FocusUnitContent {
  unit:            number
  title:           string
  grammarTarget:   string
  lessonTopic:     string
  textbookUnit:    string
  grammarExplanation: string
  grammarTable:    string
  readingPassage:  string   // 80-120 word context text for Phase 2
  exampleSentences: string[]
  keyVocabulary:   VocabItem[]
  collocations:    string[]
  phrasalVerbs:    string[]
  exerciseIdeas:   string[]
  deepThinkingQuestion: string
}

export interface VocabItem {
  word:        string
  partOfSpeech: string
  definition:  string
  example:     string
}

export const FOCUS_2_UNITS: Record<number, FocusUnitContent> = {

  // ─────────────────────────────────────────────────────────────────────────
  // UNIT 1 — Free Time
  // ─────────────────────────────────────────────────────────────────────────
  1: {
    unit:        1,
    title:       'Free Time',
    grammarTarget: 'Present Simple and Present Continuous',
    lessonTopic: 'hobbies, sports, and free-time activities',
    textbookUnit: 'Focus 2 — Unit 1: Free Time',

    grammarExplanation: `
PRESENT SIMPLE — habits, routines, facts, general truths
  Positive:  I/you/we/they + base verb.   He/she/it + verb+s (or +es for do/go/watch).
  Negative:  don't / doesn't + base verb.
  Question:  Do/Does + subject + base verb?
  Time words: every day, on Mondays, usually, always, never, twice a week.

  "She plays tennis every weekend."
  "He doesn't watch much TV."
  "Do you usually listen to music in the morning?"

PRESENT CONTINUOUS — actions happening NOW or temporary situations
  Positive:  am/is/are + verb+ing.
  Negative:  am not/isn't/aren't + verb+ing.
  Question:  Am/Is/Are + subject + verb+ing?
  Time words: now, at the moment, today, this week, currently.

  "He is studying for his exam right now."
  "I'm not feeling well today."
  "What are you doing this weekend?"

KEY CONTRAST:
  "I play football." → habit (every week)
  "I am playing football." → happening now or this week

STATE VERBS — no continuous form:
  know, like, love, hate, want, need, prefer, believe, understand, remember, belong, seem
  ✗ "I am knowing the answer."   ✓ "I know the answer."
`.trim(),

    grammarTable: `
| Verb type     | Present Simple        | Present Continuous          |
|---------------|-----------------------|-----------------------------|
| Regular       | She plays tennis.     | She is playing tennis.      |
| Negative      | He doesn't cook.      | He isn't cooking.           |
| Question      | Do you exercise?      | Are you exercising?         |
| State verb    | I love music. ✓       | I am loving music. ✗        |
`.trim(),

    readingPassage: `
My name is Jake, and I have a very active free time. I go skateboarding three times a week at the local park. My sister prefers indoor hobbies — she paints and reads a lot. Right now she is reading a thriller novel and I am watching her paint a landscape. Our parents think hobbies are important. "Free time is not wasted time," our dad always says. "It teaches you who you are." I agree. When I skateboard, I forget all my problems and just focus on the next move.
`.trim(),

    exampleSentences: [
      'She reads books every evening. (habit — Present Simple)',
      'He is reading a book right now. (right now — Present Continuous)',
      'They go to the gym three times a week.',
      'We are not playing tennis today because of the rain.',
      'Do you usually watch films at the weekend?',
      'I don\'t understand this exercise. (state verb — no -ing)',
    ],

    keyVocabulary: [
      { word: 'hobby', partOfSpeech: 'noun', definition: 'an activity you enjoy doing in your free time', example: 'My hobby is photography.' },
      { word: 'spare time', partOfSpeech: 'noun phrase', definition: 'free time when you are not working or studying', example: 'What do you do in your spare time?' },
      { word: 'keen on', partOfSpeech: 'adjective phrase', definition: 'very interested in or enthusiastic about something', example: 'She\'s really keen on dancing.' },
      { word: 'take up', partOfSpeech: 'phrasal verb', definition: 'to start doing a new hobby or activity', example: 'He took up guitar last year.' },
      { word: 'give up', partOfSpeech: 'phrasal verb', definition: 'to stop doing an activity', example: 'She gave up swimming after her injury.' },
      { word: 'get fit', partOfSpeech: 'verb phrase', definition: 'to become physically healthy and strong', example: 'I joined a gym to get fit.' },
      { word: 'free time', partOfSpeech: 'noun phrase', definition: 'time when you are not working or studying', example: 'I love reading in my free time.' },
    ],

    collocations: [
      'spend time on a hobby',
      'take up a new sport',
      'be keen on music',
      'have a lot in common',
      'get fit at the gym',
    ],

    phrasalVerbs: [
      'take up (start a hobby)',
      'give up (stop a hobby)',
      'work out (exercise)',
      'chill out (relax)',
    ],

    exerciseIdeas: [
      'Put the verb in the correct form: She _____ (study) English every day. / He _____ (study) right now.',
      'Choose the correct form: "I play / I am playing tennis at the moment."',
      'Find the mistake: "He is knowing the answer to every question."',
      'Write 3 sentences about your usual routine using Present Simple.',
      'Write 2 sentences about what you are doing this week using Present Continuous.',
    ],

    deepThinkingQuestion: 'Do you think free time is more important than school time? Give your opinion with two reasons. Use Present Simple to talk about habits.',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // UNIT 2 — People and the Past
  // ─────────────────────────────────────────────────────────────────────────
  2: {
    unit:        2,
    title:       'People and the Past',
    grammarTarget: 'Past Simple (regular and irregular verbs)',
    lessonTopic: 'historical figures, achievements, life events',
    textbookUnit: 'Focus 2 — Unit 2: People and the Past',

    grammarExplanation: `
PAST SIMPLE — completed actions at a specific time in the past.

REGULAR VERBS → add -ed (or -d if verb ends in -e):
  walk → walked,   talk → talked,   arrive → arrived
  Spelling rules:
    • verb ends in consonant + y → drop y, add -ied:   study → studied,  carry → carried
    • short verb ends in consonant-vowel-consonant → double last consonant:  stop → stopped

IRREGULAR VERBS — must be memorised:
  go → went,   come → came,   see → saw,   have → had
  make → made,  take → took,  give → gave,  know → knew
  win → won,   find → found,  leave → left, buy → bought

NEGATIVES: didn't (did not) + base verb
  "She didn't go to school yesterday."
  "He didn't finish the book."

QUESTIONS: Did + subject + base verb?
  "Did you see the film?"   "Did they win the match?"

TIME EXPRESSIONS: yesterday, last week/month/year, in 1969, two days ago, when I was young, in the morning
`.trim(),

    grammarTable: `
| Form         | Example                                    |
|--------------|--------------------------------------------|
| + positive   | She walked to school. / He went home.      |
| - negative   | She didn't walk. / He didn't go.           |
| ? question   | Did she walk? / Did he go?                 |
| short answer | Yes, she did. / No, he didn't.             |
`.trim(),

    readingPassage: `
Marie Curie was born in Warsaw in 1867. She studied science in secret because women couldn't attend university in Poland at that time. Later she moved to Paris and became the first woman to receive a university degree in physics. She discovered two new chemical elements — polonium and radium. In 1903, she won the Nobel Prize in Physics, and in 1911 she won a second Nobel Prize in Chemistry. She worked hard her entire life and never stopped researching. Marie Curie didn't just change science — she changed what people believed women could achieve.
`.trim(),

    exampleSentences: [
      'In 1969, astronauts landed on the Moon.',
      'Marie Curie discovered two new chemical elements.',
      'She didn\'t finish her homework last night.',
      'Did you visit your grandparents last weekend?',
      'He went to Paris two years ago and saw the Eiffel Tower.',
      'They stopped the experiment and went home.',
    ],

    keyVocabulary: [
      { word: 'achievement', partOfSpeech: 'noun', definition: 'something impressive that you succeed in doing through hard work', example: 'Winning the Nobel Prize was her greatest achievement.' },
      { word: 'discover', partOfSpeech: 'verb', definition: 'to find or learn something for the first time', example: 'Scientists discovered a new species in the Amazon.' },
      { word: 'invent', partOfSpeech: 'verb', definition: 'to create something completely new', example: 'Alexander Bell invented the telephone.' },
      { word: 'overcome', partOfSpeech: 'verb', definition: 'to succeed in dealing with a problem or difficulty', example: 'She overcame many obstacles to become a scientist.' },
      { word: 'courage', partOfSpeech: 'noun', definition: 'the ability to do something dangerous or difficult without fear', example: 'It took courage to study science in a new country.' },
      { word: 'inspire', partOfSpeech: 'verb', definition: 'to make someone want to do something great', example: 'Her story inspired millions of young women.' },
      { word: 'brilliant', partOfSpeech: 'adjective', definition: 'extremely intelligent or talented', example: 'She was a brilliant scientist.' },
    ],

    collocations: [
      'make a discovery',
      'win a Nobel Prize',
      'overcome obstacles',
      'achieve great things',
      'inspire future generations',
    ],

    phrasalVerbs: [
      'find out (discover information)',
      'grow up (become an adult)',
      'give up (stop trying)',
      'carry on (continue)',
    ],

    exerciseIdeas: [
      'Fill in the correct form: In 1903, Marie Curie _____ (win) the Nobel Prize.',
      'Correct the mistake: "She goed to Paris when she was young."',
      'Reorder the words: [never / she / gave / up / her / research]',
      'Tell me 4 things you did last weekend. Use Past Simple.',
      'Write 3 sentences about a famous person in history using Past Simple.',
    ],

    deepThinkingQuestion: 'Marie Curie overcame many obstacles because she believed in her work. What do you think is more important for success — talent or hard work? Give your opinion with an example from history or your own life.',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // UNIT 3 — Our World
  // ─────────────────────────────────────────────────────────────────────────
  3: {
    unit:        3,
    title:       'Our World',
    grammarTarget: 'Comparatives and Superlatives',
    lessonTopic: 'geography, natural wonders, countries',
    textbookUnit: 'Focus 2 — Unit 3: Our World',

    grammarExplanation: `
COMPARATIVES — comparing two things:
  Short adjectives (1-2 syllables):
    adjective + -er + than:   big → bigger than,   old → older than
    Spelling: double consonant for short vowel:   hot → hotter,   thin → thinner
    Y at end → ier:   happy → happier,   easy → easier

  Long adjectives (3+ syllables):
    more + adjective + than:   more beautiful than,   more interesting than

  Irregular:
    good → better than,   bad → worse than,   far → further than

SUPERLATIVES — comparing within a whole group:
  Short adjectives: the + adjective + -est:   the biggest,   the coldest
  Long adjectives:  the most + adjective:   the most beautiful,   the most dangerous
  Irregular:   the best,   the worst,   the furthest

COMPARING EQUAL THINGS: as + adjective + as
  "The Amazon is as long as the Nile." (same length)
  "The film wasn't as good as the book."
`.trim(),

    grammarTable: `
| Adjective  | Comparative          | Superlative           |
|------------|----------------------|-----------------------|
| big        | bigger than          | the biggest           |
| cold       | colder than          | the coldest           |
| beautiful  | more beautiful than  | the most beautiful    |
| good       | better than          | the best              |
| bad        | worse than           | the worst             |
`.trim(),

    readingPassage: `
Our planet is full of natural wonders. The Amazon River in South America is the largest river in the world by water volume. The Sahara Desert is the hottest and driest place on Earth — temperatures can reach 58 degrees Celsius. Mount Everest, in the Himalayas, is the highest point on our planet at 8,849 metres. However, the deepest place on Earth is not a mountain — it is the Mariana Trench in the Pacific Ocean, which is more than 11 kilometres deep. These places remind us that the natural world is far more extraordinary than anything humans have ever built.
`.trim(),

    exampleSentences: [
      'The Amazon is longer than the Nile.',
      'Russia is the largest country in the world.',
      'This summer was hotter than last year.',
      'She speaks English better than her brother.',
      'Is the Pacific Ocean deeper than the Atlantic?',
      'Antarctica is the coldest and driest continent on Earth.',
    ],

    keyVocabulary: [
      { word: 'enormous', partOfSpeech: 'adjective', definition: 'extremely large in size', example: 'The Amazon rainforest is enormous.' },
      { word: 'ancient', partOfSpeech: 'adjective', definition: 'very old, existing for thousands of years', example: 'The pyramids are ancient monuments.' },
      { word: 'remote', partOfSpeech: 'adjective', definition: 'far away from towns and cities', example: 'They found a remote village in the mountains.' },
      { word: 'landscape', partOfSpeech: 'noun', definition: 'the natural features of an area of land', example: 'The desert landscape was beautiful at sunset.' },
      { word: 'wonder', partOfSpeech: 'noun', definition: 'something that causes amazement or admiration', example: 'The Great Wall is one of the wonders of the world.' },
      { word: 'depth', partOfSpeech: 'noun', definition: 'the distance from the top to the bottom of something', example: 'Scientists measured the depth of the ocean trench.' },
      { word: 'border', partOfSpeech: 'noun', definition: 'the line that divides two countries or regions', example: 'France and Spain share a long border.' },
    ],

    collocations: [
      'reach the summit',
      'cross a border',
      'explore a landscape',
      'natural wonder',
      'sea level',
    ],

    phrasalVerbs: [
      'stand out (be noticeable)',
      'take up (occupy space)',
      'spread out (extend over a large area)',
    ],

    exerciseIdeas: [
      'Complete: The Pacific Ocean is _____ (deep) than the Atlantic Ocean.',
      'Write the superlative: Everest is _____ (high) mountain on Earth.',
      'Correct the mistake: "Russia is more big than Canada."',
      'Compare two countries you know: write 3 sentences using comparatives.',
      'What is the most beautiful place you have ever visited? Describe it using superlatives.',
    ],

    deepThinkingQuestion: 'Many natural places like the Amazon rainforest are disappearing because of human activity. Do you think humans have a responsibility to protect nature? Give 2 reasons for your opinion.',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // UNIT 4 — Looking Good
  // ─────────────────────────────────────────────────────────────────────────
  4: {
    unit:        4,
    title:       'Looking Good',
    grammarTarget: 'Present Perfect (have/has + past participle)',
    lessonTopic: 'fashion, appearance, personal identity',
    textbookUnit: 'Focus 2 — Unit 4: Looking Good',

    grammarExplanation: `
PRESENT PERFECT — connects the past to the present.
  Form: have/has + past participle

THREE MAIN USES:

1. LIFE EXPERIENCE (ever/never) — at some point in your life up to now:
   "Have you ever tried sushi?"    "She has never visited the USA."
   ever = at any time in your life;   never = at no time

2. RECENT NEWS / RESULT — something just happened and the result is now:
   "I've lost my keys." (I don't have them now)
   "She has just finished her homework." (it's done)
   just = very recently;   already = before expected;   yet = until now (negative/question)

3. UNFINISHED PERIOD — started in the past, still continuing now:
   "They have lived in Paris for five years." (still there)
   "I've known her since 2019." (still know her)
   for = period of time;   since = starting point

KEY CONTRAST — Present Perfect vs Past Simple:
  "I saw Tom yesterday." (Past Simple — yesterday is OVER)
  "I have seen Tom." (Present Perfect — at some point in my life, no specific time)
  ✗ "I have seen Tom yesterday."   — NEVER use Present Perfect with finished time (yesterday, last week, in 2010)
`.trim(),

    grammarTable: `
| Use         | Key words           | Example                                    |
|-------------|---------------------|--------------------------------------------|
| Experience  | ever, never         | Have you ever been to London?              |
| Recent news | just, already, yet  | She has just cut her hair.                 |
| Duration    | for, since          | I have studied English for three years.    |
`.trim(),

    readingPassage: `
Fashion has changed enormously over the last hundred years. In the 1950s, people always wore formal clothes — men never left the house without a tie, and women always dressed up for shopping. Since the 1980s, jeans have become the most popular item of clothing in the world. Today, fashion has become more individual. Young people have started choosing clothes that express their personality, not just follow trends. Social media has made fashion more democratic — anyone can share their style online. Have you ever thought about what your clothes say about you?
`.trim(),

    exampleSentences: [
      'Have you ever tried Indian food?',
      'She has never visited the USA.',
      'I have just finished my homework.',
      'They have lived in Paris for five years.',
      'He hasn\'t eaten anything since this morning.',
      'Have you read the new book yet?',
    ],

    keyVocabulary: [
      { word: 'trend', partOfSpeech: 'noun', definition: 'a general direction that something is changing or developing', example: 'Short skirts are the latest fashion trend.' },
      { word: 'style', partOfSpeech: 'noun', definition: 'a particular way of doing, making, or designing something', example: 'She has her own unique style.' },
      { word: 'outfit', partOfSpeech: 'noun', definition: 'a set of clothes worn together', example: 'He chose a smart outfit for the interview.' },
      { word: 'fashionable', partOfSpeech: 'adjective', definition: 'following the latest popular fashion', example: 'Trainers have become fashionable office wear.' },
      { word: 'brand', partOfSpeech: 'noun', definition: 'a name given to a product by the company that makes it', example: 'She only buys clothes from well-known brands.' },
      { word: 'individual', partOfSpeech: 'adjective', definition: 'relating to one particular person, unique', example: 'Fashion has become more individual and personal.' },
      { word: 'accessory', partOfSpeech: 'noun', definition: 'a small item such as a bag, belt, or jewellery', example: 'She added a scarf as a finishing accessory.' },
    ],

    collocations: [
      'follow a trend',
      'dress up (wear smart clothes)',
      'go out of fashion',
      'make a statement',
      'express your personality',
    ],

    phrasalVerbs: [
      'dress up (wear smart/formal clothes)',
      'try on (wear something to see if it fits)',
      'put on (to dress yourself in clothes)',
    ],

    exerciseIdeas: [
      'Fill in: She _____ (never/try) Indian food before.',
      'Past Simple or Present Perfect? "I _____ (see) that film last Tuesday."',
      'Correct: "I have seen him yesterday."',
      'Write 3 things you have done this week using Present Perfect.',
      'Write 2 things you have never done in your life.',
    ],

    deepThinkingQuestion: 'Some people spend a lot of money on fashion to express who they are. Do you think the way you dress is important for your identity? Is fashion a form of art? Give your opinion with reasons.',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // UNIT 5 — Food and Health
  // ─────────────────────────────────────────────────────────────────────────
  5: {
    unit:        5,
    title:       'Food and Health',
    grammarTarget: 'Countable and uncountable nouns, quantifiers (much/many/a lot of/some/any)',
    lessonTopic: 'food, nutrition, healthy eating habits',
    textbookUnit: 'Focus 2 — Unit 5: Food and Health',

    grammarExplanation: `
COUNTABLE NOUNS — can be counted. Have singular and plural forms.
  apple/apples,   egg/eggs,   sandwich/sandwiches,   meal/meals

UNCOUNTABLE NOUNS — cannot be counted. Have no plural form.
  water,   bread,   rice,   milk,   sugar,   flour,   butter
  abstract: advice,   information,   music,   news,   knowledge

QUANTIFIERS:
  many + countable plural:
    "How many eggs do you need?"   "There aren't many oranges left."

  much + uncountable (usually in negatives and questions):
    "How much sugar is in this?"   "There isn't much milk."

  a lot of / lots of + both countable and uncountable (positive sentences):
    "There are a lot of apples."   "She drinks a lot of water."

  some — positive sentences (both types):
    "I have some milk."   "There are some eggs in the fridge."

  any — questions and negatives (both types):
    "Do you have any eggs?"   "I don't have any milk."

  a few + countable (small positive number):
    "Add a few drops of lemon juice."

  a little + uncountable (small positive amount):
    "Add a little salt to the water."

  no + both (= not any, with positive verb):
    "There is no bread left."   "I have no time."
`.trim(),

    grammarTable: `
| Quantifier  | Countable           | Uncountable          |
|-------------|---------------------|----------------------|
| many / much | many eggs           | much water           |
| a lot of    | a lot of apples     | a lot of sugar       |
| some        | some biscuits       | some milk            |
| any         | any tomatoes?       | any flour?           |
| a few       | a few carrots       | ✗ (use a little)     |
| a little    | ✗ (use a few)       | a little salt        |
`.trim(),

    readingPassage: `
What makes a healthy meal? Experts say we need a balance of nutrients. Our body needs protein to build muscles — good sources include meat, fish, eggs and beans. We also need carbohydrates for energy — bread, rice and pasta give us fuel for the day. Vitamins and minerals come from fruit and vegetables. We should eat a lot of fresh vegetables but not too much sugar or salt. Many teenagers don't eat enough breakfast, which is a mistake. Without food in the morning, we have little energy and can't concentrate in class. A good breakfast doesn't need much time — just some fruit, a few eggs, or a bowl of porridge.
`.trim(),

    exampleSentences: [
      'How many calories are in this meal?',
      'There isn\'t much sugar in the recipe.',
      'She drinks a lot of water every day.',
      'We don\'t have any bread left.',
      'Add a little salt and a few drops of lemon.',
      'How much time do we have?',
    ],

    keyVocabulary: [
      { word: 'nutrition', partOfSpeech: 'noun', definition: 'the process of eating the right foods to be healthy', example: 'Good nutrition is essential for growing teenagers.' },
      { word: 'ingredient', partOfSpeech: 'noun', definition: 'one of the things used to make a food or recipe', example: 'What are the main ingredients in this dish?' },
      { word: 'balanced diet', partOfSpeech: 'noun phrase', definition: 'eating a variety of foods in the right amounts', example: 'A balanced diet includes protein, carbs, and vegetables.' },
      { word: 'protein', partOfSpeech: 'noun', definition: 'a nutrient that builds and repairs body tissue', example: 'Eggs and meat are full of protein.' },
      { word: 'calorie', partOfSpeech: 'noun', definition: 'a unit that measures the energy value of food', example: 'Teenagers need about 2000 calories a day.' },
      { word: 'fibre', partOfSpeech: 'noun', definition: 'a substance in food that helps digestion', example: 'Vegetables and whole grains are high in fibre.' },
      { word: 'portion', partOfSpeech: 'noun', definition: 'the amount of food served to one person', example: 'Experts recommend eating five portions of fruit a day.' },
    ],

    collocations: [
      'eat a balanced diet',
      'high in protein / fat / sugar',
      'skip breakfast',
      'follow a recipe',
      'a serving of vegetables',
    ],

    phrasalVerbs: [
      'eat out (eat at a restaurant)',
      'cut down on (reduce the amount)',
      'live on (eat only a particular food)',
    ],

    exerciseIdeas: [
      'Choose: "There is much / many / a lot of cheese in the fridge."',
      'Fill in: "How _____ sugar do you take in your coffee?"',
      'Countable or uncountable? Classify: tomato, rice, biscuit, milk, apple, advice, bread.',
      'Write 3 sentences about what you eat describing amounts (some, a few, a lot of).',
    ],

    deepThinkingQuestion: 'Some people say fast food companies are responsible for unhealthy eating. Others say individuals should make their own choices. Who do you think is more responsible for what people eat — food companies or individuals? Give your opinion with reasons.',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // UNIT 6 — Future Plans
  // ─────────────────────────────────────────────────────────────────────────
  6: {
    unit:        6,
    title:       'Future Plans',
    grammarTarget: 'Future forms: will, going to, Present Continuous for future',
    lessonTopic: 'plans, predictions, future technology and careers',
    textbookUnit: 'Focus 2 — Unit 6: Future Plans',

    grammarExplanation: `
THREE FUTURE FORMS — each with a specific meaning:

1. WILL + base verb:
   • Predictions based on opinion (no evidence right now):
     "I think electric cars will replace petrol cars by 2040."
   • Spontaneous decisions (made at the moment of speaking):
     "I'll help you with that." (I just decided right now)
   • Offers, promises, refusals:
     "I'll call you back." / "I won't tell anyone."

2. GOING TO + base verb:
   • Plans and intentions decided BEFORE the moment of speaking:
     "We're going to visit my grandparents this summer." (already planned)
   • Predictions based on EVIDENCE you can see right now:
     "Look at those clouds — it's going to rain." (I can see the clouds)

3. PRESENT CONTINUOUS for future:
   • Fixed arrangements — something in the diary with time + place:
     "I'm meeting Sara at 3 PM tomorrow." (appointment made)
     "They're flying to Rome on Friday." (ticket booked)
   • Usually with a specific time and/or place

KEY DIFFERENCES:
  "I'll have a coffee." (spontaneous, just decided)
  "I'm going to have a coffee." (already planned before speaking)
  "I'm having coffee with Tom at 10." (arranged, in the diary)
`.trim(),

    grammarTable: `
| Form               | Use                           | Example                                   |
|--------------------|-------------------------------|-------------------------------------------|
| will               | prediction / spontaneous      | I think it will rain.                     |
| going to           | plan / evidence prediction    | I'm going to study medicine.              |
| Present Continuous | fixed arrangement             | I'm seeing the doctor at 3 PM.            |
`.trim(),

    readingPassage: `
What does the future look like? Technology is going to change almost everything. Scientists believe that robots will do many jobs that humans do today. By 2050, most cars are going to be electric — some will drive themselves. In medicine, AI systems will help doctors diagnose diseases faster and more accurately. Space travel is also changing — companies like SpaceX are planning to send tourists to orbit in the next decade. But not everyone thinks technology will solve all our problems. "Machines will change what we do," says one expert, "but they won't change who we are."
`.trim(),

    exampleSentences: [
      'Scientists believe we will land on Mars before 2040.',
      'I\'m going to study medicine at university.',
      'Are you doing anything special this weekend?',
      'Look at him — he\'s going to fall!',
      'I\'ll call you back in five minutes.',
      'She\'s meeting her career advisor on Thursday.',
    ],

    keyVocabulary: [
      { word: 'prediction', partOfSpeech: 'noun', definition: 'a statement about what you think will happen in the future', example: 'His prediction about electric cars came true.' },
      { word: 'ambition', partOfSpeech: 'noun', definition: 'a strong desire to achieve something', example: 'Her ambition is to become a doctor.' },
      { word: 'career', partOfSpeech: 'noun', definition: 'the series of jobs you have in a particular field', example: 'He wants a career in technology.' },
      { word: 'opportunity', partOfSpeech: 'noun', definition: 'a chance to do something', example: 'Study hard and opportunities will come.' },
      { word: 'generation', partOfSpeech: 'noun', definition: 'all the people born and living at the same time', example: 'Our generation grew up with smartphones.' },
      { word: 'artificial intelligence', partOfSpeech: 'noun phrase', definition: 'computer systems that can perform tasks that usually require human intelligence', example: 'Artificial intelligence is changing medicine.' },
      { word: 'decade', partOfSpeech: 'noun', definition: 'a period of ten years', example: 'Technology changed dramatically in the last decade.' },
    ],

    collocations: [
      'make a prediction',
      'have ambitions to do something',
      'pursue a career in',
      'seize an opportunity',
      'the next generation',
    ],

    phrasalVerbs: [
      'grow up (become an adult)',
      'end up (eventually be in a situation)',
      'look forward to (be excited about a future event)',
    ],

    exerciseIdeas: [
      'Will or going to? "I _____ be a doctor — I already applied to medical school."',
      'Correct: "I will meeting my friend tomorrow."',
      'Fill in: Look at that car! It _____ (going to) crash!',
      'Write 2 spontaneous decisions using will and 2 future plans using going to.',
      'What are your plans for the next year? Describe in 4 sentences using the correct future forms.',
    ],

    deepThinkingQuestion: 'Some people say that artificial intelligence will take away most jobs in the future. Does this idea frighten you or excite you? What skills do you think will be most important for your generation?',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // UNIT 7 — Journey and Adventure
  // ─────────────────────────────────────────────────────────────────────────
  7: {
    unit:        7,
    title:       'Journey and Adventure',
    grammarTarget: 'First Conditional (if + Present Simple, will + base verb)',
    lessonTopic: 'travel, adventure, risks and consequences',
    textbookUnit: 'Focus 2 — Unit 7: Journey and Adventure',

    grammarExplanation: `
FIRST CONDITIONAL — real and possible situations, and their likely results.

STRUCTURE:
  If + Present Simple,  will + base verb
  "If you study hard,   you will pass the exam."
  "If it rains tomorrow, we will stay inside."

The "IF" clause can come first or second — both are correct:
  "You will pass if you study hard."
  (When the result comes first, NO comma is used)

KEY RULES:
  ✗ NEVER use "will" in the "if" clause:
    ✗ "If you will study..."   ✓ "If you study..."

  ✓ Other modal verbs instead of "will" in the result clause:
    might (possibility):   "If you visit Tokyo, you might try amazing food."
    can (ability/permission): "If you finish early, you can go home."
    should (advice):       "If you feel ill, you should see a doctor."
    may (possibility):     "If we leave now, we may arrive on time."

WHEN vs IF:
  Use "if" for uncertain situations: "If I pass the exam..."
  Use "when" for certain situations: "When I grow up, I will be a doctor."
`.trim(),

    grammarTable: `
| Clause  | Tense          | Example                                  |
|---------|----------------|------------------------------------------|
| IF      | Present Simple | If you study hard                        |
| RESULT  | will + base    | ...you will pass the exam.               |
| Result  | might + base   | ...you might pass the exam.              |
| Result  | can + base     | ...you can take a break.                 |
`.trim(),

    readingPassage: `
Every year, thousands of young people go on gap year adventures. If you decide to travel alone for a year, you will discover things about yourself that you never knew. Many travellers say that if they hadn't taken risks, they would have regretted it forever. Of course, travel has its dangers too. If you don't plan carefully, you might run out of money or get into difficult situations. But most experienced travellers agree: if you stay curious and open-minded, every journey will teach you something valuable. The world is waiting — where will you go if you get the chance?
`.trim(),

    exampleSentences: [
      'If the weather is nice tomorrow, we will go to the beach.',
      'You will miss the bus if you don\'t hurry.',
      'If you don\'t eat breakfast, you might feel tired.',
      'What will you do if you fail the test?',
      'If I save enough money, I\'ll travel to Japan.',
      'If you need help, you can call me any time.',
    ],

    keyVocabulary: [
      { word: 'destination', partOfSpeech: 'noun', definition: 'the place where someone is going or being sent', example: 'Paris is a popular tourist destination.' },
      { word: 'itinerary', partOfSpeech: 'noun', definition: 'a detailed plan for a journey', example: 'She planned a two-week itinerary for her trip to Japan.' },
      { word: 'adventure', partOfSpeech: 'noun', definition: 'an exciting and sometimes dangerous experience', example: 'Climbing the mountain was the greatest adventure of his life.' },
      { word: 'risk', partOfSpeech: 'noun', definition: 'the possibility that something bad might happen', example: 'Travelling alone carries some risk.' },
      { word: 'consequence', partOfSpeech: 'noun', definition: 'a result that follows from an action or situation', example: 'What are the consequences of missing the flight?' },
      { word: 'opportunity', partOfSpeech: 'noun', definition: 'a chance to do something', example: 'Travelling gives you opportunities to learn about different cultures.' },
      { word: 'solo', partOfSpeech: 'adjective/adverb', definition: 'alone, without other people', example: 'She planned a solo trip around Europe.' },
    ],

    collocations: [
      'pack your bags',
      'miss a flight',
      'travel light',
      'go on an adventure',
      'take a risk',
    ],

    phrasalVerbs: [
      'set off (begin a journey)',
      'check in (arrive and register at a hotel or airport)',
      'run out of (have no more of something)',
      'end up (arrive somewhere unexpectedly)',
    ],

    exerciseIdeas: [
      'Complete: "If she _____ (not study), she _____ (fail) the exam."',
      'Correct: "If you will arrive late, the teacher will be angry."',
      'Write a First Conditional sentence about travel using your own ideas.',
      'What will you do if it rains this weekend? Answer with 2-3 sentences.',
      'Write 3 First Conditional sentences about your school life.',
    ],

    deepThinkingQuestion: 'Some people prefer to stay in their home country rather than travel. Others say travel is essential for understanding the world. If you could travel anywhere, where would you go and why? What do you think travel teaches us that school cannot?',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // UNIT 8 — Technology Today
  // ─────────────────────────────────────────────────────────────────────────
  8: {
    unit:        8,
    title:       'Technology Today',
    grammarTarget: "Modal verbs: should, must, have to, don't have to, mustn't",
    lessonTopic: 'technology, social media, digital rules and responsibilities',
    textbookUnit: 'Focus 2 — Unit 8: Technology Today',

    grammarExplanation: `
MODAL VERBS for OBLIGATION, ADVICE, and PROHIBITION:

SHOULD / SHOULDN'T — advice (not a strong rule, just a recommendation):
  "You should get more sleep."
  "You shouldn't spend all day on your phone."
  (I think it's a good/bad idea — your choice)

MUST / MUSTN'T — strong obligation or prohibition (rule/law/very important):
  "You must wear a seatbelt." (it's the law)
  "You mustn't use your phone while driving." (it's forbidden)
  mustn't = it is NOT allowed / it is forbidden

HAVE TO / DON'T HAVE TO — external obligation / no obligation:
  "I have to finish this report by Friday." (my boss's rule, external requirement)
  "You don't have to come to the meeting." (no one requires it — your choice)
  don't have to = not necessary, no obligation

KEY CONTRAST:
  mustn't   = FORBIDDEN  → "You mustn't touch that — it's dangerous."
  don't have to = NOT NECESSARY → "You don't have to come if you're tired."

FORMS:
  All modals + base verb (no -s, no -ing, no -ed):
  ✓ "She must follow the rules."   ✗ "She must to follow / musts / must following"
`.trim(),

    grammarTable: `
| Modal          | Meaning                  | Example                                       |
|----------------|--------------------------|-----------------------------------------------|
| should         | advice (recommended)     | You should back up your files.               |
| shouldn't      | advice (not recommended) | You shouldn't share your password.           |
| must           | strong obligation / law  | You must register to use this service.       |
| mustn't        | forbidden / prohibited   | You mustn't post personal information online.|
| have to        | external obligation      | I have to attend all my classes.             |
| don't have to  | no obligation            | You don't have to pay — it's free.           |
`.trim(),

    readingPassage: `
Technology is changing our lives faster than ever before. Today, most teenagers spend more than six hours a day looking at screens. Experts say you should take regular breaks from your devices to protect your eyesight and mental health. In many countries, drivers must not use their phones while driving — it is illegal. At school, students usually have to follow strict rules about mobile phones in class. However, you don't have to delete all your social media — it's about using it wisely. Digital literacy is now one of the most important skills of our time: we must all learn how to use technology responsibly.
`.trim(),

    exampleSentences: [
      'You should back up your data regularly.',
      'Students must not use phones during exams.',
      'You don\'t have to create an account to read the article.',
      'She has to finish the project before Monday.',
      'I think you should apologise to him.',
      'You mustn\'t share your password with anyone.',
    ],

    keyVocabulary: [
      { word: 'privacy', partOfSpeech: 'noun', definition: 'the right to keep personal information secret', example: 'Online privacy is very important for teenagers.' },
      { word: 'digital', partOfSpeech: 'adjective', definition: 'relating to information in the form of electronic data', example: 'We live in a digital age.' },
      { word: 'screen time', partOfSpeech: 'noun phrase', definition: 'the time spent using electronic devices with screens', example: 'Doctors recommend limiting screen time for children.' },
      { word: 'update', partOfSpeech: 'verb/noun', definition: 'to add the latest information to something / a new version of software', example: 'You should update your phone\'s software regularly.' },
      { word: 'cyberbullying', partOfSpeech: 'noun', definition: 'bullying using the internet or digital devices', example: 'Cyberbullying is a serious problem in schools.' },
      { word: 'device', partOfSpeech: 'noun', definition: 'a machine or piece of equipment designed for a particular purpose', example: 'She has three digital devices: a phone, tablet, and laptop.' },
      { word: 'responsible', partOfSpeech: 'adjective', definition: 'having a duty to do something or to look after someone', example: 'We must be responsible when using social media.' },
    ],

    collocations: [
      'use technology responsibly',
      'screen time',
      'digital literacy',
      'social media rules',
      'go online',
    ],

    phrasalVerbs: [
      'log in / log out (connect/disconnect from an online account)',
      'scroll through (look through content quickly)',
      'back up (make a copy of data for safety)',
      'set up (configure a new device or account)',
    ],

    exerciseIdeas: [
      'Choose: "You _____ (mustn\'t / don\'t have to) pay — it\'s free!"',
      'Fill in: "You _____ (should) drink more water — you look exhausted."',
      'Correct: "You don\'t must touch that — it\'s dangerous."',
      'Write 3 school rules using must, mustn\'t, and have to.',
      'Give advice to someone who uses their phone too much. Use 3 modal verbs.',
    ],

    deepThinkingQuestion: 'Social media companies collect our personal data and sell it to advertisers. Should there be stronger laws to protect people\'s digital privacy? Or is it our own responsibility to protect ourselves online? What do you think?',
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

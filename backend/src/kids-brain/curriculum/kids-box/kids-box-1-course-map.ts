// Kid's Box 1 Course Map — metadata only, no extracted content
// Source: Cambridge University Press, 2nd Edition, 2014
// ISBN: 978-1-107-61757-5 (Pupil's Book), 978-1-107-63625-5 (Teacher's Book)
// Page references derived from Teacher's Book contents page and language summary.
// No full page text, no verbatim story passages, no scanned content stored.

// ─── Types ────────────────────────────────────────────────────────────────────

export type UnitExtractionStatus = 'pending' | 'extracted' | 'validated' | 'active';

export interface KidsBoxPageRange {
  start: number;
  end: number;
}

export interface KidsBoxUnitMapEntry {
  unitId: string;
  order: number;
  title: string;
  teacherBookPage: KidsBoxPageRange;
  pupilBookPage: KidsBoxPageRange;
  keyVocabularyThemes: string[];
  keyGrammarFunctions: string[];
  phonicsFocus?: string;
  status: UnitExtractionStatus;
}

export interface KidsBoxReviewBlock {
  blockId: string;
  title: string;
  coversUnitIds: string[];
  teacherBookPage: KidsBoxPageRange;
  pupilBookPage: KidsBoxPageRange;
}

export interface KidsBoxCLILSection {
  sectionId: string;
  title: string;
  subject: string;
  afterUnitId: string;
  teacherBookPage: KidsBoxPageRange;
  pupilBookPage: KidsBoxPageRange;
}

export interface KidsBox1CourseMap {
  courseId: string;
  title: string;
  level: string;
  sourceRefs: {
    pupilBook: string;
    teacherBook: string;
    activityBook: string;
  };
  units: KidsBoxUnitMapEntry[];
  reviewBlocks: KidsBoxReviewBlock[];
  clilValuesSections: KidsBoxCLILSection[];
}

// ─── Unit map entries ─────────────────────────────────────────────────────────

const UNIT_01: KidsBoxUnitMapEntry = {
  unitId: 'kb1-unit-01',
  order: 1,
  title: 'Hello!',
  teacherBookPage: { start: 13, end: 22 },
  pupilBookPage: { start: 4, end: 9 },
  keyVocabularyThemes: ['greetings', 'colours', 'numbers-1-10'],
  keyGrammarFunctions: [
    "What's your name? / I'm ...",
    'Hello / Goodbye',
    "How are you? / I'm fine, thank you.",
    "What colour is it? / It's ...",
    "How old are you? / I'm ...",
  ],
  phonicsFocus: '/s/ sound — "six"',
  status: 'extracted',
};

const UNIT_02: KidsBoxUnitMapEntry = {
  unitId: 'kb1-unit-02',
  order: 2,
  title: 'My school',
  teacherBookPage: { start: 23, end: 34 },
  pupilBookPage: { start: 10, end: 15 },
  keyVocabularyThemes: ['classroom-objects', 'colours-review'],
  keyGrammarFunctions: [
    "What's this? / It's a ...",
    'What colour is it?',
    'Classroom commands: Open your book / Close your bag',
  ],
  phonicsFocus: '/æ/ sound — "bag"',
  status: 'pending',
};

const UNIT_03: KidsBoxUnitMapEntry = {
  unitId: 'kb1-unit-03',
  order: 3,
  title: 'Favourite toys',
  teacherBookPage: { start: 39, end: 50 },
  pupilBookPage: { start: 18, end: 23 },
  keyVocabularyThemes: ['toys'],
  keyGrammarFunctions: [
    "I've got a ...",
    "Have you got a ...? / Yes, I have. / No, I haven't.",
    "What's your favourite toy?",
  ],
  phonicsFocus: '/b/ sound — "ball"',
  status: 'pending',
};

const UNIT_04: KidsBoxUnitMapEntry = {
  unitId: 'kb1-unit-04',
  order: 4,
  title: 'My family',
  teacherBookPage: { start: 51, end: 62 },
  pupilBookPage: { start: 24, end: 29 },
  keyVocabularyThemes: ['family-members'],
  keyGrammarFunctions: [
    'This is my mum / dad / brother / sister.',
    "He's / She's ...",
    "How many ...? / There's one / two ...",
  ],
  phonicsFocus: '/d/ sound — "dad"',
  status: 'pending',
};

const UNIT_05: KidsBoxUnitMapEntry = {
  unitId: 'kb1-unit-05',
  order: 5,
  title: 'Our pets',
  teacherBookPage: { start: 67, end: 78 },
  pupilBookPage: { start: 32, end: 37 },
  keyVocabularyThemes: ['pet-animals'],
  keyGrammarFunctions: [
    "I've got a / an ...",
    "Has he / she got a ...? / Yes, he / she has. / No, he / she hasn't.",
    "What's your pet?",
  ],
  phonicsFocus: '/k/ sound — "cat"',
  status: 'pending',
};

const UNIT_06: KidsBoxUnitMapEntry = {
  unitId: 'kb1-unit-06',
  order: 6,
  title: 'My face',
  teacherBookPage: { start: 79, end: 90 },
  pupilBookPage: { start: 38, end: 43 },
  keyVocabularyThemes: ['face-and-body-parts'],
  keyGrammarFunctions: [
    'Touch your ...',
    "He's / She's got big / small ...",
    "What colour is his / her ...?",
  ],
  phonicsFocus: '/h/ sound — "hair"',
  status: 'pending',
};

const UNIT_07: KidsBoxUnitMapEntry = {
  unitId: 'kb1-unit-07',
  order: 7,
  title: 'Wild animals',
  teacherBookPage: { start: 95, end: 106 },
  pupilBookPage: { start: 46, end: 51 },
  keyVocabularyThemes: ['wild-jungle-animals'],
  keyGrammarFunctions: [
    "What's that? / It's a ...",
    "It's big / small / long / short.",
    "I like ... / I don't like ...",
  ],
  phonicsFocus: '/l/ sound — "lion"',
  status: 'pending',
};

const UNIT_08: KidsBoxUnitMapEntry = {
  unitId: 'kb1-unit-08',
  order: 8,
  title: 'My clothes',
  teacherBookPage: { start: 107, end: 118 },
  pupilBookPage: { start: 52, end: 57 },
  keyVocabularyThemes: ['clothes'],
  keyGrammarFunctions: [
    "He's / She's wearing a / an ...",
    "What colour is his / her ...?",
    "Put on / Take off your ...",
  ],
  phonicsFocus: '/ʃ/ sound — "shoes"',
  status: 'pending',
};

const UNIT_09: KidsBoxUnitMapEntry = {
  unitId: 'kb1-unit-09',
  order: 9,
  title: 'Fun time!',
  teacherBookPage: { start: 123, end: 134 },
  pupilBookPage: { start: 60, end: 65 },
  keyVocabularyThemes: ['leisure-activities'],
  keyGrammarFunctions: [
    "I like / don't like ...-ing.",
    "What do you like doing?",
    "Can you ...? / Yes, I can. / No, I can't.",
  ],
  phonicsFocus: '/ɪ/ sound — "swimming"',
  status: 'pending',
};

const UNIT_10: KidsBoxUnitMapEntry = {
  unitId: 'kb1-unit-10',
  order: 10,
  title: 'At the funfair',
  teacherBookPage: { start: 135, end: 146 },
  pupilBookPage: { start: 66, end: 71 },
  keyVocabularyThemes: ['transport', 'funfair-rides'],
  keyGrammarFunctions: [
    "Can I have a ...? / Yes, here you are. / No, sorry.",
    "How much is it? / It's ... pence.",
    'Numbers review and extension',
  ],
  phonicsFocus: '/ɑː/ sound — "car"',
  status: 'pending',
};

const UNIT_11: KidsBoxUnitMapEntry = {
  unitId: 'kb1-unit-11',
  order: 11,
  title: 'Our house',
  teacherBookPage: { start: 151, end: 162 },
  pupilBookPage: { start: 74, end: 79 },
  keyVocabularyThemes: ['rooms', 'household-furniture'],
  keyGrammarFunctions: [
    "Where's the ...? / It's in the ...",
    "Is there a ...? / Yes, there is. / No, there isn't.",
    'Prepositions: in / on / under',
  ],
  phonicsFocus: '/ɪ/ sound — "kitchen"',
  status: 'pending',
};

const UNIT_12: KidsBoxUnitMapEntry = {
  unitId: 'kb1-unit-12',
  order: 12,
  title: 'Party time!',
  teacherBookPage: { start: 163, end: 174 },
  pupilBookPage: { start: 80, end: 85 },
  keyVocabularyThemes: ['party-food', 'drinks'],
  keyGrammarFunctions: [
    "Would you like some ...? / Yes, please. / No, thank you.",
    "Do you like ...? / Yes, I do. / No, I don't.",
    'Happy birthday!',
  ],
  phonicsFocus: '/tʃ/ sound — "chicken"',
  status: 'pending',
};

// ─── Review blocks ────────────────────────────────────────────────────────────

const REVIEW_UNITS_1_4: KidsBoxReviewBlock = {
  blockId: 'kb1-review-1-4',
  title: 'Review Units 1–4',
  coversUnitIds: ['kb1-unit-01', 'kb1-unit-02', 'kb1-unit-03', 'kb1-unit-04'],
  teacherBookPage: { start: 63, end: 66 },
  pupilBookPage: { start: 30, end: 31 },
};

const REVIEW_UNITS_5_8: KidsBoxReviewBlock = {
  blockId: 'kb1-review-5-8',
  title: 'Review Units 5–8',
  coversUnitIds: ['kb1-unit-05', 'kb1-unit-06', 'kb1-unit-07', 'kb1-unit-08'],
  teacherBookPage: { start: 119, end: 122 },
  pupilBookPage: { start: 58, end: 59 },
};

const REVIEW_UNITS_9_12: KidsBoxReviewBlock = {
  blockId: 'kb1-review-9-12',
  title: 'Review Units 9–12',
  coversUnitIds: ['kb1-unit-09', 'kb1-unit-10', 'kb1-unit-11', 'kb1-unit-12'],
  teacherBookPage: { start: 179, end: 182 },
  pupilBookPage: { start: 88, end: 89 },
};

// ─── CLIL and values sections ─────────────────────────────────────────────────

const CLIL_MARIES_MATHS: KidsBoxCLILSection = {
  sectionId: 'kb1-clil-maths-trevor-values-1',
  title: "Marie's maths and Trevor's values",
  subject: 'maths',
  afterUnitId: 'kb1-unit-02',
  teacherBookPage: { start: 35, end: 38 },
  pupilBookPage: { start: 16, end: 17 },
};

const CLIL_MARIES_SCIENCE: KidsBoxCLILSection = {
  sectionId: 'kb1-clil-science-trevor-values-2',
  title: "Marie's science and Trevor's values",
  subject: 'science',
  afterUnitId: 'kb1-unit-06',
  teacherBookPage: { start: 91, end: 94 },
  pupilBookPage: { start: 44, end: 45 },
};

const CLIL_MARIES_SPORTS: KidsBoxCLILSection = {
  sectionId: 'kb1-clil-sports-trevor-values-3',
  title: "Marie's sports and Trevor's values",
  subject: 'sports',
  afterUnitId: 'kb1-unit-10',
  teacherBookPage: { start: 147, end: 150 },
  pupilBookPage: { start: 72, end: 73 },
};

const CLIL_MARIES_ART: KidsBoxCLILSection = {
  sectionId: 'kb1-clil-art-trevor-values-4',
  title: "Marie's art and Trevor's values",
  subject: 'art',
  afterUnitId: 'kb1-unit-12',
  teacherBookPage: { start: 175, end: 178 },
  pupilBookPage: { start: 86, end: 87 },
};

// ─── Course map ───────────────────────────────────────────────────────────────

export const KIDS_BOX_1_COURSE_MAP: KidsBox1CourseMap = {
  courseId: 'cambridge-kids-box-1',
  title: "Kid's Box 1",
  level: 'pre-A1',
  sourceRefs: {
    pupilBook: 'curriculum-assets/kids-box-1/pupil-book.pdf',
    teacherBook: 'curriculum-assets/kids-box-1/teacher-book.pdf',
    activityBook: 'curriculum-assets/kids-box-1/activity-book.pdf',
  },
  units: [
    UNIT_01,
    UNIT_02,
    UNIT_03,
    UNIT_04,
    UNIT_05,
    UNIT_06,
    UNIT_07,
    UNIT_08,
    UNIT_09,
    UNIT_10,
    UNIT_11,
    UNIT_12,
  ],
  reviewBlocks: [
    REVIEW_UNITS_1_4,
    REVIEW_UNITS_5_8,
    REVIEW_UNITS_9_12,
  ],
  clilValuesSections: [
    CLIL_MARIES_MATHS,
    CLIL_MARIES_SCIENCE,
    CLIL_MARIES_SPORTS,
    CLIL_MARIES_ART,
  ],
};

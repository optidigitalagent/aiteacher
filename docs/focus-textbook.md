# Focus Textbook — Структура и Инструкция по RAG Ingestion

> Источник: Pearson Focus 3, Second Edition (B1/B1+)
> Официальный TOC: https://www.pearson.com/content/dam/one-dot-com/one-dot-com/english/SampleMaterials/Secondary/Focus/BritishEnglish/focus-level-3-table-of-contents.pdf
> 
> Claude Code: этот файл объясняет что чанковать и как загружать в Pinecone.

---

## СЕРИЯ FOCUS — УРОВНИ

```
Focus 1  →  A2 / A2+   (10-12 лет, начинающие)
Focus 2  →  A2+ / B1   (12-14 лет, элементарный+)
Focus 3  →  B1 / B1+   (14-16 лет, ⭐ ОСНОВНОЙ для MVP)
Focus 4  →  B2 / B2+   (16-18 лет, выше среднего)
Focus 5  →  C1         (продвинутый)
```

**Для MVP используем Focus 3 (B1/B1+)** — он покрывает 80% школьников 12–17 лет.

---

## СТРУКТУРА КАЖДОГО ЮНИТА (Focus 3)

Каждый юнит в Focus состоит из 10 секций:

```
X.1  Vocabulary      — новая лексика, фразовые глаголы, коллокации
X.2  Grammar         — первый грамматический пункт юнита
X.3  Listening       — аудио задание + Language Practice
X.4  Reading         — текст для чтения + понимание
X.5  Grammar         — второй грамматический пункт юнита
X.6  Use of English  — лексико-грамматические задания (exam style)
X.7  Writing         — письменное задание (эссе, история, email)
X.8  Speaking        — разговорные задания
X.9  Exam Speaking   — подготовка к экзамену (speaking)
X.10 Self-check      — самопроверка
```

**Для AI-учителя нужны:** X.1, X.2, X.4, X.5 — это 80% полезного контента.

---

## ПОЛНАЯ КАРТА ЮНИТОВ FOCUS 3 (B1/B1+)

Взято из официального PDF Pearson:

```
UNIT 0 — Revision (starter unit)
  Grammar: Present tenses review, Quantifiers, Present Perfect vs Past Simple,
           Comparatives/Superlatives, Future forms, Conditionals,
           Modal verbs, Defining relative clauses
  Vocabulary: Houses, Food, Shops, Clothes, Books/Films, Technology, Education, Work

UNIT 1 — "A new look" (Looks / Appearance)
  Grammar:  Dynamic and state verbs
            Present Perfect Continuous
  Vocabulary: Clothes and accessories, Verb phrases about clothes
              Synonyms — appearance and personality, Compound adjectives
  Reading: Facebook profile photos and what they mean
  Writing: Description of a person
  Real-world context: Social media, Identity, First impressions

UNIT 2 — "Just do it!" (Sport / Role Models)
  Grammar:  Narrative tenses (Past Simple, Past Continuous, Past Perfect)
            Verb patterns
  Vocabulary: Sport, Compound nouns, Sport collocations, People in sport
              Word families — personal qualities, Phrasal verbs
  Reading: A Paralympic athlete (Gapped text)
  Writing: An article
  Real-world context: Athletes, Achievement, Overcoming obstacles

UNIT 3 — "Going places" (Travel / Transport)
  Grammar:  Present and past speculation (must/can't/might have)
            used to and would
  Vocabulary: Travel, Means of transport, Collocations, Phrasal verbs
              Air travel compound nouns, Wild animals
  Reading: Travelling for a living
  Writing: A story (with past narrative)
  Real-world context: Exploration, Nomadic living, Animal migration

UNIT 4 — "Eat up" (Food / Health)
  Grammar:  Future time clauses (when/as soon as/until/before/after + Present Simple)
            Future Continuous and Future Perfect
  Vocabulary: Food — fish and vegetables, Antonyms, Word families
              Phrasal verbs — food, Indirect questions
  Reading: Fussy eaters (Multiple matching)
  Writing: A semi-formal email
  Real-world context: Food science, Global nutrition, Future of food

UNIT 5 — "One world" (Geography / Environment)
  Grammar:  Articles: no article, a/an or the
            Non-defining relative clauses
  Vocabulary: Geography, Geographical features, Verb collocations
              Compound nouns — environment, Adjective-noun collocations
  Reading: Living with natural disasters (Multiple choice)
  Writing: A 'for and against' essay
  Real-world context: Climate change, Natural disasters, Eco-schools

UNIT 6 — "Get well" (Health / Body / Charity)
  Grammar:  Second Conditional; wish/if only
            Third Conditional
  Vocabulary: Parts of the body, Word families — injuries, Body idioms
              Hospitals, Compound nouns — health issues
  Reading: How much are they worth? (Listening + Reading)
  Writing: An article
  Real-world context: Medical ethics, Sports injuries, Charity fundraising

UNIT 7 — "In the spotlight" (Media / TV / Viral content)
  Grammar:  Reported Speech — statements; Reporting verbs
            Reported Speech — questions and imperatives
  Vocabulary: Television, TV shows, Word families, Modifiers
              Phrasal verbs, Words with two meanings
  Reading: Reality television (Multiple matching)
  Writing: A review of an event
  Real-world context: Media influence, Social media, Vlogging culture

UNIT 8 — "Good citizens" (Society / Justice / Citizenship)
  Grammar:  The Passive (all forms)
            have something done
  Vocabulary: Human qualities, Suffixes — nouns and adjectives
              Verb phrases, Society, Collocations with make
  Reading: And here is the good news... (Gapped text)
  Writing: An opinion essay
  Real-world context: Criminal justice, Youth activism, Social change
```

---

## КАК ЧАНКОВАТЬ ДЛЯ PINECONE

### Принцип: один чанк = одна обучаемая единица

```typescript
// Типы чанков (chunk_type field в Pinecone metadata)

enum ChunkType {
  GRAMMAR_RULE      = "grammar_rule",       // само правило + примеры
  GRAMMAR_EXAMPLE   = "grammar_example",    // 1 пример использования
  VOCABULARY_ITEM   = "vocabulary_item",    // 1 слово + определение + пример
  VOCABULARY_LIST   = "vocabulary_list",    // тематический список слов
  READING_TEXT      = "reading_text",       // текст для чтения
  EXERCISE_MODEL    = "exercise_model",     // модель упражнения из учебника
  COLLOCATION       = "collocation",        // словосочетание + пример
  IRREGULAR_VERB    = "irregular_verb",     // таблица неправильных глаголов
}
```

### Пример чанков для Unit 2 (Narrative Tenses):

```json
// CHUNK 1 — Grammar Rule
{
  "id": "focus3-u2-grammar-narrative-tenses-rule",
  "content": "Narrative tenses are used to tell stories about the past. Past Simple describes completed actions in sequence: 'She arrived, opened the door and sat down.' Past Continuous describes background actions or interrupted actions: 'She was reading when the phone rang.' Past Perfect describes actions that happened before another past action: 'She had already left when I arrived.'",
  "metadata": {
    "textbook": "Focus 3",
    "unit": 2,
    "unit_title": "Just do it!",
    "chunk_type": "grammar_rule",
    "grammar_point": "Narrative tenses",
    "cefr_level": "B1",
    "tags": ["past_simple", "past_continuous", "past_perfect", "narrative"]
  }
}

// CHUNK 2 — Grammar Examples
{
  "id": "focus3-u2-grammar-narrative-examples",
  "content": "Examples of narrative tenses in context: 1. 'The athlete had trained for years before she finally won the gold medal.' (Past Perfect before Past Simple) 2. 'While Hillary was climbing, a storm was developing.' (two simultaneous past actions) 3. 'He reached the summit, took a photo, and immediately started to descend.' (sequence of completed actions)",
  "metadata": {
    "textbook": "Focus 3",
    "unit": 2,
    "chunk_type": "grammar_example",
    "grammar_point": "Narrative tenses"
  }
}

// CHUNK 3 — Vocabulary Item
{
  "id": "focus3-u2-vocab-perseverance",
  "content": "PERSEVERANCE (noun) — the quality of continuing to do something even when it is difficult. Collocations: show perseverance, require perseverance, with great perseverance. Example: 'Hillary's perseverance after multiple failed attempts inspired generations of climbers.' Related forms: persevere (verb), perseverant (adj).",
  "metadata": {
    "textbook": "Focus 3",
    "unit": 2,
    "chunk_type": "vocabulary_item",
    "word": "perseverance",
    "word_family": ["persevere", "perseverant", "perseveringly"],
    "cefr_level": "B1"
  }
}

// CHUNK 4 — Irregular Verb
{
  "id": "focus3-irregular-verbs-group-go",
  "content": "Irregular verbs — movement group: go/went/gone, come/came/come, run/ran/run, fly/flew/flown, drive/drove/driven, ride/rode/ridden, swim/swam/swum, climb/climbed/climbed (regular!), walk/walked/walked (regular!). Memory tip: movement verbs are often irregular because they are ancient, high-frequency words.",
  "metadata": {
    "textbook": "Focus 3",
    "chunk_type": "irregular_verb",
    "category": "movement",
    "verbs": ["go", "come", "run", "fly", "drive", "ride", "swim"]
  }
}
```

---

## СКРИПТ INGESTION (что писать в vector-db/scripts/ingest.ts)

```typescript
// vector-db/scripts/ingest.ts
// Запуск: ts-node ingest.ts --unit=2 --textbook=focus3

interface TextbookChunk {
  id: string;
  content: string;
  metadata: {
    textbook: string;
    unit: number;
    unit_title: string;
    chunk_type: ChunkType;
    grammar_point?: string;
    word?: string;
    cefr_level: string;
    tags?: string[];
  };
}

// Стратегия чанкования:
// 1. Grammar rules: max 200 слов на чанк, одно правило = один чанк
// 2. Vocabulary: одно слово = один чанк (с определением, коллокациями, примером)
// 3. Reading texts: чанки по 150-200 слов с overlap 30 слов
// 4. Exercise models: одно упражнение = один чанк

// RAG Query при уроке:
// query = "Past Simple regular verbs examples B1"
// filter = { textbook: "Focus 3", unit: 2 }
// top_k = 3 — не больше, иначе перегружаем контекст
```

---

## МАППИНГ: ГРАММАТИКА → РЕАЛЬНЫЕ ТЕМЫ ДЛЯ УРОКОВ

Это ключевая таблица. Для каждого юнита — реальный контекст который AI использует:

```
UNIT 1 — Dynamic/State verbs + Present Perfect Continuous
  → Тема: Олимпийские чемпионы (Kim Clijsters, Jessica Ennis)
  → "She has been training for 10 years" vs "She trains every day"
  → Текст: BBC Sport profile of a champion

UNIT 2 — Narrative Tenses (Past Simple/Continuous/Perfect)  ⭐
  → Тема: Покорение Эвереста 1953, Параолимпийские атлеты
  → "While Hillary was climbing, a storm was developing"
  → Текст: National Geographic excerpt on Hillary/Norgay

UNIT 3 — Speculation modals + used to/would
  → Тема: Великие путешественники (Magellан, Columbus)
  → "He must have been afraid when he sailed into unknown waters"
  → Текст: History.com voyage article

UNIT 4 — Future time clauses + Future Continuous/Perfect
  → Тема: Колонизация Марса (SpaceX, NASA Artemis)
  → "When humans land on Mars, they will need..."
  → Текст: NASA.gov Mars exploration plan

UNIT 5 — Articles + Non-defining relative clauses
  → Тема: Климатический кризис, природные катастрофы
  → "The Amazon, which is the largest rainforest, is disappearing"
  → Текст: BBC Science climate article

UNIT 6 — Conditionals 2 & 3 + wish/if only
  → Тема: Медицинская этика, спортивные травмы
  → "If Bolt hadn't trained so hard, he wouldn't have broken the record"
  → Текст: Диллема врача или история спортивного восстановления

UNIT 7 — Reported Speech
  → Тема: Знаменитые цитаты, исторические речи (MLK, Churchill)
  → "Churchill said that they would fight on the beaches"
  → Текст: Репортаж → пересказ в косвенной речи

UNIT 8 — Passive Voice
  → Тема: Как делаются вещи (iPhone, вакцина, ракета)
  → "The vaccine was developed in less than a year"
  → Текст: How It's Made style explanation
```

---

## СПИСОК НЕПРАВИЛЬНЫХ ГЛАГОЛОВ — TOP 30 (для Unit 2)

Отправлять студенту после урока где встречались проблемы:

```
Verb        Past Simple    Past Participle
-----------------------------------------
be          was/were       been
have        had            had
do          did            done
go          went           gone
come        came           come
get         got            got/gotten
make        made           made
take        took           taken
give        gave           given
know        knew           known
think       thought        thought
see         saw            seen
say         said           said
tell        told           told
find        found          found
feel        felt           felt
leave       left           left
keep        kept           kept
bring       brought        brought
write       wrote          written
read        read           read (pron: red)
speak       spoke          spoken
run         ran            run
begin       began          begun
break       broke          broken
build       built          built
buy         bought         bought
catch       caught         caught
choose      chose          chosen
lose        lost           lost
```

**Стратегия обучения неправильных глаголов:**
Не учить все сразу. Учить группами по 5, в контексте реальных предложений.
Top 10 (be/have/do/go/come/get/make/take/give/know) — первоочередные.

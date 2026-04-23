/**
 * Textbook ingestion — Focus B1 chunks → Pinecone (integrated inference)
 *
 * Index uses llama-text-embed-v2 — NO OpenAI embedding needed.
 * Pinecone embeds the text automatically on upsert.
 *
 * Usage (from /backend directory):
 *   PINECONE_API_KEY=xxx tsx ../vector-db/scripts/ingest.ts
 */

import { Pinecone } from '@pinecone-database/pinecone'

const INDEX_NAME = process.env.PINECONE_INDEX ?? 'ai-teacher-textbooks'

interface Chunk {
  _id:           string
  text:          string   // field the model embeds
  content:       string   // stored for retrieval
  chunk_type:    string
  grammar_point: string
  [key: string]: string | number
  unit:          number
  textbook:      string
  cefr_level:    string
}

const CHUNKS: Chunk[] = [
  {
    _id: 'focus3-u2-narrative-tenses-rule',
    chunk_type: 'grammar_rule', grammar_point: 'Narrative tenses',
    unit: 2, textbook: 'Focus B1', cefr_level: 'B1',
    text: 'Narrative tenses grammar rule Past Simple Past Continuous Past Perfect',
    content:
      'Narrative tenses are used to tell stories about the past.\n' +
      'Past Simple — completed actions in sequence: "She arrived, opened the door and sat down."\n' +
      'Past Continuous — background action or action in progress when something else happened: "She was reading when the phone rang."\n' +
      'Past Perfect — action that happened BEFORE another past action: "She had already left when I arrived."\n' +
      'Signal words — Past Simple: yesterday, in 1953, last week, ago.\n' +
      'Signal words — Past Perfect: already, just, before, after, by the time.',
  },
  {
    _id: 'focus3-u2-narrative-examples',
    chunk_type: 'grammar_example', grammar_point: 'Narrative tenses',
    unit: 2, textbook: 'Focus B1', cefr_level: 'B1',
    text: 'Narrative tenses examples Everest Hillary climbing past simple continuous perfect',
    content:
      'Narrative tenses examples (Everest theme):\n' +
      '1. "In May 1953, Hillary and Norgay climbed Mount Everest." (Past Simple — completed action)\n' +
      '2. "While Hillary was climbing, a fierce storm was developing." (Past Continuous — simultaneous background)\n' +
      '3. "By the time they reached the summit, they had been climbing for nine hours." (Past Perfect Continuous)\n' +
      '4. "Tenzing had attempted Everest six times before he finally succeeded in 1953." (Past Perfect — earlier attempt)',
  },
  {
    _id: 'focus3-u2-past-simple-regular',
    chunk_type: 'grammar_rule', grammar_point: 'Past Simple regular verbs',
    unit: 2, textbook: 'Focus B1', cefr_level: 'A2',
    text: 'Past Simple regular verbs formation -ed spelling rules negatives questions',
    content:
      'Past Simple — Regular Verbs:\n' +
      'Formation: verb + -ed. Examples: climb→climbed, walk→walked, reach→reached, return→returned\n' +
      'Spelling rules:\n' +
      '- Most verbs: add -ed → work/worked\n' +
      '- Ends in -e: add -d → arrive/arrived\n' +
      '- Consonant + y: y→i + ed → try/tried, carry/carried\n' +
      '- Short CVC: double consonant → stop/stopped, plan/planned\n' +
      'Negative: didn\'t + infinitive → "He didn\'t reach the summit."\n' +
      'Question: Did + subject + infinitive → "Did they climb Everest?"',
  },
  {
    _id: 'focus3-u2-irregular-verbs-top30',
    chunk_type: 'irregular_verb', grammar_point: 'Irregular verbs',
    unit: 2, textbook: 'Focus B1', cefr_level: 'A2',
    text: 'irregular verbs list past simple past participle go went gone take took taken',
    content:
      'Top 30 irregular verbs (base → past simple → past participle):\n' +
      'go/went/gone | come/came/come | be/was-were/been | have/had/had | do/did/done\n' +
      'say/said/said | get/got/got | make/made/made | take/took/taken | give/gave/given\n' +
      'know/knew/known | think/thought/thought | see/saw/seen | tell/told/told | find/found/found\n' +
      'feel/felt/felt | leave/left/left | keep/kept/kept | begin/began/begun | run/ran/run\n' +
      'bring/brought/brought | write/wrote/written | speak/spoke/spoken | break/broke/broken\n' +
      'buy/bought/bought | catch/caught/caught | choose/chose/chosen | lose/lost/lost\n' +
      'win/won/won | fly/flew/flown\n' +
      'Tip: Most irregular verbs are the oldest, most common English words.',
  },
  {
    _id: 'focus3-u2-vocab-achievement',
    chunk_type: 'vocabulary_list', grammar_point: '',
    unit: 2, textbook: 'Focus B1', cefr_level: 'B1',
    text: 'vocabulary summit expedition perseverance ascent conquer achievement Everest',
    content:
      'SUMMIT (noun/verb) — highest point; to reach the top.\n' +
      'Collocations: reach the summit | summit attempt | summit meeting\n\n' +
      'EXPEDITION (noun) — journey for a specific purpose.\n' +
      'Example: "The 1953 British Everest Expedition was led by Colonel John Hunt."\n\n' +
      'PERSEVERANCE (noun) — continuing to try despite difficulty.\n' +
      'Verb: persevere. "Hillary\'s perseverance after multiple failures inspired others."\n\n' +
      'ASCENT (noun) — act of climbing upward. "The ascent took nine hours."\n\n' +
      'CONQUER (verb) — to succeed with something very difficult. "They conquered the world\'s highest peak."',
  },
  {
    _id: 'focus3-u2-reading-text',
    chunk_type: 'reading_text', grammar_point: '',
    unit: 2, textbook: 'Focus B1', cefr_level: 'B1',
    text: 'Mount Everest 1953 Hillary Norgay climbed summit reading text past simple',
    content:
      'Reading text — Mount Everest 1953 (B1 level):\n\n' +
      '"On 29 May 1953, Edmund Hillary from New Zealand and Tenzing Norgay from Nepal reached the summit of Mount Everest — the highest point on Earth at 8,849 metres. They left their camp at 4 AM and climbed for nine hours through freezing temperatures and strong winds. When they finally stood at the top, Hillary took several photographs and Tenzing placed flags in the snow. They had achieved what no one had done before. The whole world celebrated when they returned safely to base camp. Queen Elizabeth II knighted Hillary just days after the climb."',
  },
  {
    _id: 'focus3-u2-common-errors',
    chunk_type: 'exercise_model', grammar_point: 'Common errors in narrative tenses',
    unit: 2, textbook: 'Focus B1', cefr_level: 'B1',
    text: 'common errors mistakes irregular verbs taked rised leaved waked overgeneralisation',
    content:
      'Common student errors with narrative tenses:\n' +
      '❌ "He taked photos." → ✅ "He took photos." (take/took — irregular)\n' +
      '❌ "They rised early." → ✅ "They rose early." (rise/rose — irregular)\n' +
      '❌ "She leaved camp." → ✅ "She left camp." (leave/left — irregular)\n' +
      '❌ "He was climb..." → ✅ "He was climbing..." (Past Continuous needs -ing)\n' +
      '❌ "By 1953 they already try." → ✅ "...they had already tried." (Past Perfect for before-the-past)\n' +
      '❌ "I waked up." → ✅ "I woke up." (wake/woke — irregular)\n' +
      'Cause: Overgeneralisation — students apply -ed rule to irregular verbs.',
  },
]

async function ingest(): Promise<void> {
  if (!process.env.PINECONE_API_KEY) {
    console.error('[ingest] PINECONE_API_KEY missing')
    process.exit(1)
  }

  const pc    = new Pinecone({ apiKey: process.env.PINECONE_API_KEY })
  const index = pc.index(INDEX_NAME)

  console.log(`[ingest] uploading ${CHUNKS.length} chunks to "${INDEX_NAME}" (llama-text-embed-v2)...`)

  // upsertRecords sends text directly — Pinecone embeds automatically
  await index.upsertRecords(CHUNKS)

  console.log(`[ingest] done — ${CHUNKS.length} records uploaded`)
  console.log('[ingest] Pinecone will embed in background, ready in ~30 seconds')
}

ingest().catch((err: unknown) => {
  console.error('[ingest] failed:', err)
  process.exit(1)
})

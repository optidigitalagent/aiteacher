import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { startLesson, getContinuationStatus, BillingError } from '../services/lessonStartApi'
import type { LessonStartPayload, ContinuationStatus } from '../services/lessonStartApi'
import type { LessonSessionMetadata } from '../types/lessonTypes'
import { useAuth } from '../context/AuthContext'
import AuthGate, { type LessonSetupState } from '../components/shared/AuthGate'

// ── Types ──────────────────────────────────────────────────────────────────────

interface SectionData {
  bookId: string
  unit: number
  sectionId: string
  sectionNumber: string
  title: string
  topic: string
  estimatedDuration: number
  exerciseCount?: number
  sub: string
  disabled?: boolean
  dataQuality?: 'ocr' | 'structured'
}

interface VoiceData {
  id: string
  name: string
  tone: string
  heights: number[]
}

// ── Static data ────────────────────────────────────────────────────────────────

const BOOKS = [
  { id: 'focus2',   num: '2',   badge: '★ Available', title: 'Focus 2 Student Book',   desc: 'Grammar, speaking, listening. Intermediate level.',            enabled: true  },
  { id: 'focus3',   num: '3',   badge: 'Coming Soon', title: 'Focus 3 Student Book',   desc: 'Advanced grammar, writing, conversation skills.',              enabled: false, bg: 'linear-gradient(135deg,#FF8C5A,#FFB38C)' },
  { id: 'business', num: 'BIZ', badge: 'Coming Soon', title: 'Business English',        desc: 'Emails, presentations, meetings & negotiations.',             enabled: false, bg: 'linear-gradient(135deg,#22C55E,#16A34A)' },
]

const FOCUS2_SECTIONS: SectionData[] = [
  // ── Unit 1: Free Time ──────────────────────────────────────────────────────
  { bookId: 'focus2', unit: 1, sectionId: 'focus2-1.1', sectionNumber: '1.1', title: 'Vocabulary',
    topic: 'Free-time activities & hobbies',     estimatedDuration: 25, exerciseCount: 6,
    sub: 'go/play/do patterns; hobby vocabulary', dataQuality: 'ocr' },
  { bookId: 'focus2', unit: 1, sectionId: 'focus2-1.2', sectionNumber: '1.2', title: 'Grammar',
    topic: 'Present tenses — question forms',    estimatedDuration: 30, exerciseCount: 8,
    sub: 'Present Simple & Continuous; subject/object questions', dataQuality: 'ocr' },
  { bookId: 'focus2', unit: 1, sectionId: 'focus2-1.3', sectionNumber: '1.3', title: 'Listening',
    topic: 'Voluntary work — comprehension',     estimatedDuration: 25, exerciseCount: 6,
    sub: 'Gap-fill; personality adjectives in context', dataQuality: 'ocr' },
  { bookId: 'focus2', unit: 1, sectionId: 'focus2-1.4', sectionNumber: '1.4', title: 'Reading',
    topic: 'Teenage stereotypes — gapped text',  estimatedDuration: 25, exerciseCount: 5,
    sub: 'Gapped text; personality adjective antonyms', dataQuality: 'ocr' },
  // ── Unit 2: People and the Past ────────────────────────────────────────────
  { bookId: 'focus2', unit: 2, sectionId: 'focus2-2.1', sectionNumber: '2.1', title: 'Vocabulary',
    topic: 'Achievements & historical figures',  estimatedDuration: 25, exerciseCount: 6,
    sub: 'discover, invent, overcome, inspire',  dataQuality: 'structured' },
  { bookId: 'focus2', unit: 2, sectionId: 'focus2-2.2', sectionNumber: '2.2', title: 'Grammar',
    topic: 'Past Simple — regular & irregular',  estimatedDuration: 35, exerciseCount: 9,
    sub: 'Regular -ed, irregular verbs, questions', dataQuality: 'structured' },
  { bookId: 'focus2', unit: 2, sectionId: 'focus2-2.3', sectionNumber: '2.3', title: 'Reading',
    topic: 'Biography — Marie Curie',            estimatedDuration: 25, exerciseCount: 5,
    sub: 'Reading comprehension; past achievements', dataQuality: 'structured' },
  // ── Unit 3: Our World ──────────────────────────────────────────────────────
  { bookId: 'focus2', unit: 3, sectionId: 'focus2-3.1', sectionNumber: '3.1', title: 'Vocabulary',
    topic: 'Geography & natural wonders',        estimatedDuration: 25, exerciseCount: 6,
    sub: 'enormous, ancient, remote, landscape', dataQuality: 'structured' },
  { bookId: 'focus2', unit: 3, sectionId: 'focus2-3.2', sectionNumber: '3.2', title: 'Grammar',
    topic: 'Comparatives & Superlatives',        estimatedDuration: 35, exerciseCount: 9,
    sub: '-er/more; -est/most; as...as; irregular forms', dataQuality: 'structured' },
  { bookId: 'focus2', unit: 3, sectionId: 'focus2-3.3', sectionNumber: '3.3', title: 'Speaking',
    topic: 'Conversation about places',          estimatedDuration: 30, exerciseCount: 4,
    sub: 'Conversation practice', dataQuality: 'structured', disabled: true },
  // ── Unit 4: Looking Good ───────────────────────────────────────────────────
  { bookId: 'focus2', unit: 4, sectionId: 'focus2-4.1', sectionNumber: '4.1', title: 'Vocabulary',
    topic: 'Fashion & personal appearance',      estimatedDuration: 25, exerciseCount: 6,
    sub: 'trend, style, outfit, fashionable, brand', dataQuality: 'structured' },
  { bookId: 'focus2', unit: 4, sectionId: 'focus2-4.2', sectionNumber: '4.2', title: 'Grammar',
    topic: 'Present Perfect — experience & duration', estimatedDuration: 35, exerciseCount: 9,
    sub: 'have/has + past participle; ever/never; for/since', dataQuality: 'structured' },
  { bookId: 'focus2', unit: 4, sectionId: 'focus2-4.3', sectionNumber: '4.3', title: 'Reading',
    topic: 'Fashion history — how clothing changed', estimatedDuration: 25, exerciseCount: 5,
    sub: 'Reading comprehension; fashion vocabulary', dataQuality: 'structured' },
  // ── Unit 5: Food and Health ────────────────────────────────────────────────
  { bookId: 'focus2', unit: 5, sectionId: 'focus2-5.1', sectionNumber: '5.1', title: 'Vocabulary',
    topic: 'Food & nutrition vocabulary',        estimatedDuration: 25, exerciseCount: 6,
    sub: 'nutrition, ingredient, protein, calorie', dataQuality: 'structured' },
  { bookId: 'focus2', unit: 5, sectionId: 'focus2-5.2', sectionNumber: '5.2', title: 'Grammar',
    topic: 'Quantifiers — much, many, a lot of', estimatedDuration: 35, exerciseCount: 8,
    sub: 'Countable/uncountable; some/any; a few/a little', dataQuality: 'structured' },
  { bookId: 'focus2', unit: 5, sectionId: 'focus2-5.3', sectionNumber: '5.3', title: 'Reading',
    topic: 'Healthy eating habits',              estimatedDuration: 25, exerciseCount: 5,
    sub: 'Reading comprehension; nutrition text', dataQuality: 'structured' },
  // ── Unit 6: Future Plans ───────────────────────────────────────────────────
  { bookId: 'focus2', unit: 6, sectionId: 'focus2-6.1', sectionNumber: '6.1', title: 'Vocabulary',
    topic: 'Plans, careers & technology',        estimatedDuration: 25, exerciseCount: 6,
    sub: 'prediction, ambition, career, opportunity', dataQuality: 'structured' },
  { bookId: 'focus2', unit: 6, sectionId: 'focus2-6.2', sectionNumber: '6.2', title: 'Grammar',
    topic: 'Future forms — will, going to, arrangement', estimatedDuration: 35, exerciseCount: 9,
    sub: 'will vs going to vs Present Continuous for future', dataQuality: 'structured' },
  { bookId: 'focus2', unit: 6, sectionId: 'focus2-6.3', sectionNumber: '6.3', title: 'Reading',
    topic: 'Future technology predictions',      estimatedDuration: 25, exerciseCount: 5,
    sub: 'Reading comprehension; predictions text', dataQuality: 'structured' },
  // ── Unit 7: Journey and Adventure ─────────────────────────────────────────
  { bookId: 'focus2', unit: 7, sectionId: 'focus2-7.1', sectionNumber: '7.1', title: 'Vocabulary',
    topic: 'Travel & adventure vocabulary',      estimatedDuration: 25, exerciseCount: 6,
    sub: 'destination, itinerary, risk, consequence, solo', dataQuality: 'structured' },
  { bookId: 'focus2', unit: 7, sectionId: 'focus2-7.2', sectionNumber: '7.2', title: 'Grammar',
    topic: 'First Conditional',                  estimatedDuration: 35, exerciseCount: 9,
    sub: 'if + Present Simple + will/might/can; if vs when', dataQuality: 'structured' },
  { bookId: 'focus2', unit: 7, sectionId: 'focus2-7.3', sectionNumber: '7.3', title: 'Reading',
    topic: 'Gap year adventures',                estimatedDuration: 25, exerciseCount: 5,
    sub: 'Reading comprehension; travel text',   dataQuality: 'structured' },
  // ── Unit 8: Technology Today ───────────────────────────────────────────────
  { bookId: 'focus2', unit: 8, sectionId: 'focus2-8.1', sectionNumber: '8.1', title: 'Vocabulary',
    topic: 'Technology & social media vocabulary', estimatedDuration: 25, exerciseCount: 6,
    sub: 'privacy, screen time, cyberbullying, digital', dataQuality: 'structured' },
  { bookId: 'focus2', unit: 8, sectionId: 'focus2-8.2', sectionNumber: '8.2', title: 'Grammar',
    topic: 'Modal verbs — obligation, advice, prohibition', estimatedDuration: 35, exerciseCount: 9,
    sub: 'should/must/have to/mustn\'t/don\'t have to', dataQuality: 'structured' },
  { bookId: 'focus2', unit: 8, sectionId: 'focus2-8.3', sectionNumber: '8.3', title: 'Reading',
    topic: 'Digital responsibility',             estimatedDuration: 25, exerciseCount: 5,
    sub: 'Reading comprehension; technology text', dataQuality: 'structured' },
]

// Unit metadata for group headers
const FOCUS2_UNIT_TITLES: Record<number, string> = {
  1: 'Free Time',
  2: 'People and the Past',
  3: 'Our World',
  4: 'Looking Good',
  5: 'Food and Health',
  6: 'Future Plans',
  7: 'Journey and Adventure',
  8: 'Technology Today',
}

const BOOK_SECTIONS: Record<string, SectionData[]> = { focus2: FOCUS2_SECTIONS }
const BOOK_TITLES:   Record<string, string>         = { focus2: 'Focus 2 Student Book' }

const TEACHERS = [
  { id: 'alex', name: 'Alex', gender: 'male'   as const, bg: 'linear-gradient(135deg,#7B8CFF,#A18BFF)', label: 'A', style: 'Structured & precise',  tags: ['Clear', 'Methodical']  },
  { id: 'emma', name: 'Emma', gender: 'female' as const, bg: 'linear-gradient(135deg,#FF8C5A,#FFB38C)', label: 'E', style: 'Friendly & supportive', tags: ['Warm', 'Encouraging'] },
]

const VOICES_BY_TEACHER: Record<string, VoiceData[]> = {
  alex: [
    { id: 'onyx', name: 'Onyx', tone: 'Deep · Composed',  heights: [8,13,18,10,15,9,14,20,8,16,11,18,9,13] },
    { id: 'echo', name: 'Echo', tone: 'British · Clear',  heights: [10,14,10,16,8,13,16,10,14,7,12,17,9,11] },
  ],
  emma: [
    { id: 'nova',    name: 'Nova',    tone: 'Warm · Natural',    heights: [8,14,10,16,8,12,18,10,14,6,12,16,8,10]  },
    { id: 'shimmer', name: 'Shimmer', tone: 'Bright · Energetic', heights: [12,18,14,20,10,16,20,14,18,8,16,20,12,14] },
  ],
}

// ── Step keys ──────────────────────────────────────────────────────────────────

const STEP_KEYS = ['mode', 'book', 'section', 'teacher', 'voice', 'summary'] as const
type StepKey = typeof STEP_KEYS[number]

// ── CSS ────────────────────────────────────────────────────────────────────────

const CSS = `
  :root {
    --fl-purple:       #7B8CFF;
    --fl-purple-light: #A18BFF;
    --fl-purple-dark:  #5B6BDF;
    --fl-orange:       #FFB38C;
    --fl-grad-primary: linear-gradient(135deg, #7B8CFF 0%, #A18BFF 100%);
    --fl-grad-cta:     linear-gradient(135deg, #7B8CFF 0%, #FFB38C 100%);
    --fl-grad-bg:      linear-gradient(160deg, #FFF9F3 0%, #F6F4FF 50%, #FFF4EE 100%);
    --fl-text-primary:   #0F172A;
    --fl-text-secondary: #64748B;
    --fl-text-muted:     #94A3B8;
    --fl-surface:     #F6F7FB;
    --fl-card:        #FFFFFF;
    --fl-border:      #E6EAF2;
    --fl-border-light:#EEF1F7;
    --fl-shadow-sm:   0px 4px 12px rgba(15,23,42,0.06);
    --fl-shadow-md:   0px 12px 24px rgba(15,23,42,0.08);
    --fl-shadow-lg:   0px 24px 48px rgba(15,23,42,0.12);
    --fl-radius-md:   16px;
    --fl-radius-lg:   24px;
    --fl-radius-xl:   32px;
    --fl-font:         'DM Sans', sans-serif;
    --fl-font-heading: 'Sora', sans-serif;
    --fl-ease:         cubic-bezier(0.22, 1, 0.36, 1);
  }

  /* PAGE */
  .fl-page {
    background: var(--fl-grad-bg);
    min-height: calc(100vh - 72px);
    display: flex; flex-direction: column;
  }

  /* COMPACT PAGE HEADER */
  .fl-page-header {
    padding: 28px 32px 0;
    text-align: center;
  }
  .fl-page-label {
    font-size: 11px; font-weight: 700; letter-spacing: 1.2px;
    text-transform: uppercase; color: var(--fl-purple); margin-bottom: 6px;
  }
  .fl-page-title {
    font-family: var(--fl-font-heading);
    font-size: 26px; font-weight: 800; color: var(--fl-text-primary);
    letter-spacing: -0.6px;
  }

  /* ROADMAP — sticky compact step bar */
  .fl-roadmap {
    position: sticky; top: 0; z-index: 20;
    display: flex; align-items: center; justify-content: center;
    flex-wrap: wrap; gap: 0;
    padding: 14px 20px 12px;
    background: rgba(255,249,243,0.92);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    border-bottom: 1px solid rgba(230,234,242,0.7);
    margin-top: 16px;
  }
  .fl-road-item { display: flex; align-items: center; }
  .fl-road-chip {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 5px 13px; border-radius: 999px;
    font-size: 12px; font-weight: 600;
    font-family: var(--fl-font);
    border: 1.5px solid transparent;
    transition: all 180ms var(--fl-ease);
    white-space: nowrap;
    cursor: default;
  }
  .fl-road-chip.done {
    background: rgba(123,140,255,0.08);
    border-color: rgba(123,140,255,0.2);
    color: var(--fl-purple);
    cursor: pointer;
  }
  .fl-road-chip.done:hover {
    background: rgba(123,140,255,0.14);
  }
  .fl-road-chip.active {
    background: var(--fl-grad-primary);
    color: white;
    box-shadow: 0 4px 14px rgba(123,140,255,0.35);
  }
  .fl-road-chip.future {
    background: transparent;
    border-color: var(--fl-border-light);
    color: var(--fl-text-muted);
  }
  .fl-road-check { font-size: 9px; }
  .fl-road-arrow {
    color: var(--fl-border);
    font-size: 14px; padding: 0 4px; flex-shrink: 0;
  }

  /* MAIN CONTENT */
  .fl-main {
    flex: 1;
    display: flex; align-items: center; justify-content: center;
    padding: 28px 24px 48px;
  }

  /* STEP WRAPPER — animated on change */
  .fl-step {
    width: 100%; max-width: 820px;
    animation: fl-step-in 260ms var(--fl-ease) both;
  }
  @keyframes fl-step-in {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .fl-step-title {
    font-family: var(--fl-font-heading);
    font-size: 22px; font-weight: 800; color: var(--fl-text-primary);
    text-align: center; margin-bottom: 8px; letter-spacing: -0.5px;
  }
  .fl-step-sub {
    font-size: 14px; color: var(--fl-text-secondary);
    text-align: center; margin-bottom: 24px;
  }

  /* ── STEP 0: MODE CARDS ── */
  .fl-mode-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .fl-mode-card {
    background: white; border-radius: var(--fl-radius-xl);
    border: 2px solid var(--fl-border-light);
    padding: 40px 32px; cursor: pointer;
    display: flex; flex-direction: column; align-items: center;
    text-align: center; gap: 16px;
    min-height: 260px; justify-content: center;
    position: relative;
    box-shadow: var(--fl-shadow-sm);
    transition: all 220ms var(--fl-ease);
  }
  .fl-mode-card:not(.disabled):hover {
    border-color: rgba(123,140,255,0.45);
    transform: translateY(-5px);
    box-shadow: var(--fl-shadow-md), 0 0 0 4px rgba(123,140,255,0.07);
  }
  .fl-mode-card.disabled { opacity: 0.55; cursor: default; pointer-events: none; }
  .fl-mode-icon {
    width: 72px; height: 72px; border-radius: 22px; font-size: 32px;
    background: linear-gradient(135deg,rgba(123,140,255,0.1),rgba(161,139,255,0.07));
    border: 1px solid rgba(123,140,255,0.1);
    display: flex; align-items: center; justify-content: center;
  }
  .fl-mode-title {
    font-family: var(--fl-font-heading);
    font-size: 20px; font-weight: 800; color: var(--fl-text-primary);
  }
  .fl-mode-desc { font-size: 14px; color: var(--fl-text-secondary); line-height: 1.55; max-width: 240px; }
  .fl-mode-badge {
    position: absolute; top: 14px; right: 14px;
    font-size: 10px; font-weight: 700; letter-spacing: 0.4px; text-transform: uppercase;
    padding: 3px 9px; border-radius: 6px;
    background: var(--fl-surface); color: var(--fl-text-muted); border: 1px solid var(--fl-border);
  }
  .fl-mode-badge.available {
    background: rgba(123,140,255,0.1); color: var(--fl-purple);
    border-color: rgba(123,140,255,0.25);
  }

  /* ── STEP 1: BOOK CARDS ── */
  .fl-book-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 14px; }
  .fl-book-card {
    background: white; border-radius: var(--fl-radius-lg);
    border: 1.5px solid var(--fl-border-light);
    padding: 24px; cursor: pointer; position: relative;
    box-shadow: var(--fl-shadow-sm);
    transition: all 220ms var(--fl-ease);
  }
  .fl-book-card:not(.disabled):hover {
    transform: translateY(-4px); box-shadow: var(--fl-shadow-md); border-color: var(--fl-border);
  }
  .fl-book-card.disabled { opacity: 0.55; cursor: default; pointer-events: none; }
  .fl-book-cover {
    width: 56px; height: 72px; border-radius: 3px 8px 8px 3px;
    box-shadow: -2px 3px 10px rgba(0,0,0,0.15);
    background: var(--fl-grad-primary);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 3px; padding: 6px; margin-bottom: 16px;
  }
  .fl-book-num   { font-size: 24px; font-weight: 900; color: white; line-height: 1; }
  .fl-book-label { font-size: 7px; font-weight: 700; color: rgba(255,255,255,0.75); text-align: center; text-transform: uppercase; letter-spacing: 0.3px; }
  .fl-book-badge {
    display: inline-flex; align-items: center; padding: 2px 8px;
    border-radius: 20px; margin-bottom: 6px;
    font-size: 10px; font-weight: 600; color: var(--fl-purple);
    background: rgba(123,140,255,0.1);
  }
  .fl-book-badge.soon { background: var(--fl-surface); color: var(--fl-text-muted); }
  .fl-book-title { font-size: 14px; font-weight: 700; color: var(--fl-text-primary); margin-bottom: 4px; }
  .fl-book-desc  { font-size: 12px; color: var(--fl-text-secondary); line-height: 1.4; }

  /* ── STEP 2: SECTION GRID ── */
  .fl-section-wrap {
    background: white; border-radius: var(--fl-radius-lg);
    border: 1px solid var(--fl-border-light);
    overflow: hidden; box-shadow: var(--fl-shadow-sm);
  }
  .fl-section-header {
    padding: 16px 20px; border-bottom: 1px solid var(--fl-border-light);
    display: flex; align-items: center; justify-content: space-between;
  }
  .fl-section-header-title { font-size: 15px; font-weight: 700; color: var(--fl-text-primary); }
  .fl-section-header-sub   { font-size: 12px; color: var(--fl-text-secondary); margin-top: 2px; }
  .fl-section-grid {
    display: grid; grid-template-columns: repeat(auto-fill,minmax(220px,1fr));
    gap: 1px; background: var(--fl-border-light);
    overflow-y: auto; max-height: 400px;
  }
  .fl-section-card {
    background: white; padding: 16px 18px; cursor: pointer;
    display: flex; align-items: flex-start; gap: 10px;
    transition: background 160ms;
  }
  .fl-section-card:not(.disabled):hover { background: #FAFBFF; }
  .fl-section-card.selected { background: linear-gradient(135deg,rgba(123,140,255,0.06),rgba(161,139,255,0.04)); }
  .fl-section-card.disabled { opacity: 0.4; pointer-events: none; }
  .fl-section-num {
    font-size: 11px; font-weight: 700; color: var(--fl-purple);
    background: rgba(123,140,255,0.1); padding: 3px 7px; border-radius: 6px;
    flex-shrink: 0; margin-top: 1px;
  }
  .fl-section-card.selected .fl-section-num { background: var(--fl-grad-primary); color: white; }
  .fl-section-body  { flex: 1; min-width: 0; }
  .fl-section-title { font-size: 13px; font-weight: 600; color: var(--fl-text-primary); margin-bottom: 2px; }
  .fl-section-topic { font-size: 11px; color: var(--fl-text-secondary); line-height: 1.3; margin-bottom: 5px; }
  .fl-section-meta  { display: flex; gap: 6px; flex-wrap: wrap; }
  .fl-section-tag {
    font-size: 10px; color: var(--fl-text-muted); font-weight: 500;
    background: var(--fl-surface); padding: 1px 6px; border-radius: 4px;
    border: 1px solid var(--fl-border-light);
  }
  .fl-unit-header-row {
    padding: 8px 18px 6px;
    background: var(--fl-surface);
    border-bottom: 1px solid var(--fl-border-light);
    display: flex; align-items: center; gap: 8px;
  }
  .fl-unit-label {
    font-size: 10px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase;
    color: var(--fl-purple);
  }
  .fl-unit-title {
    font-size: 12px; font-weight: 600; color: var(--fl-text-secondary);
  }
  .fl-resume-chip {
    font-size: 9px; font-weight: 700; letter-spacing: 0.4px; text-transform: uppercase;
    padding: 2px 7px; border-radius: 5px;
    background: rgba(123,140,255,0.12); color: var(--fl-purple);
    border: 1px solid rgba(123,140,255,0.25);
  }
  .fl-quality-dot {
    width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; margin-top: 5px;
  }
  .fl-quality-dot.ocr { background: #22C55E; }
  .fl-quality-dot.structured { background: #A18BFF; }

  /* ── STEP 3: TEACHER CARDS ── */
  .fl-teacher-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .fl-teacher-card {
    background: white; border-radius: var(--fl-radius-xl);
    border: 2px solid var(--fl-border-light);
    padding: 36px 28px; cursor: pointer;
    display: flex; flex-direction: column; align-items: center;
    text-align: center; gap: 12px;
    min-height: 250px; justify-content: center;
    box-shadow: var(--fl-shadow-sm);
    position: relative;
    transition: all 220ms var(--fl-ease);
  }
  .fl-teacher-card:hover { transform: translateY(-5px); box-shadow: var(--fl-shadow-md); }
  .fl-teacher-card.selected {
    border-color: transparent;
    background: linear-gradient(white,white) padding-box,
                linear-gradient(135deg,var(--fl-purple),var(--fl-purple-light)) border-box;
    border: 2px solid transparent;
    box-shadow: 0 0 0 4px rgba(123,140,255,0.12), var(--fl-shadow-md);
  }
  .fl-teacher-avatar {
    width: 80px; height: 80px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 28px; font-weight: 900; color: white;
    box-shadow: 0 8px 24px rgba(0,0,0,0.14);
  }
  .fl-teacher-name {
    font-family: var(--fl-font-heading);
    font-size: 22px; font-weight: 800; color: var(--fl-text-primary);
  }
  .fl-teacher-style { font-size: 13px; color: var(--fl-text-secondary); }
  .fl-teacher-tags  { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; }
  .fl-teacher-tag {
    font-size: 11px; font-weight: 600; color: var(--fl-purple);
    background: rgba(123,140,255,0.08); padding: 3px 8px; border-radius: 6px;
  }
  .fl-teacher-check {
    position: absolute; top: 14px; right: 14px;
    width: 22px; height: 22px; border-radius: 50%;
    background: var(--fl-grad-primary);
    display: flex; align-items: center; justify-content: center;
    opacity: 0; transform: scale(0.5);
    transition: opacity 220ms, transform 220ms var(--fl-ease);
  }
  .fl-teacher-card.selected .fl-teacher-check { opacity: 1; transform: scale(1); }

  /* ── STEP 4: VOICE CARDS ── */
  .fl-voice-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .fl-voice-card {
    background: white; border-radius: var(--fl-radius-lg);
    border: 2px solid var(--fl-border-light);
    padding: 28px 24px; cursor: pointer;
    display: flex; flex-direction: column; gap: 14px;
    box-shadow: var(--fl-shadow-sm); position: relative;
    transition: all 220ms var(--fl-ease);
  }
  .fl-voice-card:hover { transform: translateY(-4px); box-shadow: var(--fl-shadow-md); }
  .fl-voice-card.selected {
    border-color: transparent;
    background: linear-gradient(white,white) padding-box,
                linear-gradient(135deg,var(--fl-purple),var(--fl-orange)) border-box;
    border: 2px solid transparent;
    box-shadow: 0 0 0 4px rgba(123,140,255,0.1), var(--fl-shadow-md);
  }
  .fl-voice-top  { display: flex; align-items: center; gap: 14px; }
  .fl-voice-play {
    width: 42px; height: 42px; border-radius: 50%; flex-shrink: 0;
    background: var(--fl-surface); border: 1.5px solid var(--fl-border);
    display: flex; align-items: center; justify-content: center;
    transition: all 200ms;
  }
  .fl-voice-card.selected .fl-voice-play { background: var(--fl-grad-primary); border-color: transparent; }
  .fl-voice-info { flex: 1; }
  .fl-voice-name { font-size: 16px; font-weight: 700; color: var(--fl-text-primary); }
  .fl-voice-tone { font-size: 12px; color: var(--fl-text-secondary); margin-top: 2px; }
  .fl-waveform   { display: flex; align-items: center; gap: 2px; height: 22px; }
  .fl-wave-bar   { width: 2px; border-radius: 1px; background: var(--fl-border); transition: background 300ms; }
  .fl-voice-card.selected .fl-wave-bar { background: var(--fl-purple-light); }
  .fl-voice-check {
    position: absolute; top: 12px; right: 12px;
    width: 20px; height: 20px; border-radius: 50%;
    background: var(--fl-grad-primary);
    display: flex; align-items: center; justify-content: center;
    opacity: 0; transform: scale(0.5);
    transition: opacity 220ms, transform 220ms var(--fl-ease);
  }
  .fl-voice-card.selected .fl-voice-check { opacity: 1; transform: scale(1); }

  /* ── STEP 5: SUMMARY ── */
  .fl-summary-wrap { max-width: 520px; margin: 0 auto; }
  .fl-summary-card {
    background: white; border-radius: var(--fl-radius-xl);
    border: 1px solid var(--fl-border-light);
    padding: 40px 44px;
    box-shadow: var(--fl-shadow-md);
  }
  .fl-summary-title {
    font-family: var(--fl-font-heading);
    font-size: 20px; font-weight: 800; color: var(--fl-text-primary);
    margin-bottom: 24px; text-align: center; letter-spacing: -0.4px;
  }
  .fl-summary-rows { display: flex; flex-direction: column; gap: 10px; margin-bottom: 28px; }
  .fl-summary-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 14px; background: var(--fl-surface);
    border-radius: 10px; border: 1px solid var(--fl-border-light);
    gap: 12px;
  }
  .fl-summary-label { font-size: 12px; color: var(--fl-text-muted); font-weight: 500; flex-shrink: 0; }
  .fl-summary-value { font-size: 13px; color: var(--fl-text-primary); font-weight: 700; text-align: right; }
  .fl-start-btn {
    width: 100%; padding: 16px;
    background: var(--fl-grad-cta); color: white;
    font-family: var(--fl-font); font-size: 16px; font-weight: 700;
    border: none; border-radius: var(--fl-radius-lg); cursor: pointer;
    display: flex; align-items: center; justify-content: center; gap: 10px;
    transition: transform 200ms var(--fl-ease), box-shadow 200ms;
    box-shadow: 0 8px 24px rgba(123,140,255,0.35);
  }
  .fl-start-btn:hover:not(:disabled) { transform: scale(1.02); box-shadow: 0 12px 32px rgba(123,140,255,0.45); }
  .fl-start-btn:active:not(:disabled) { transform: scale(0.98); }
  .fl-start-btn:disabled { background: #C8D0E1; box-shadow: none; cursor: not-allowed; }
  .fl-start-btn.loading { background: var(--fl-grad-primary); pointer-events: none; }
  .fl-spinner {
    width: 16px; height: 16px;
    border: 2px solid rgba(255,255,255,0.4); border-top-color: white;
    border-radius: 50%; animation: fl-spin 0.7s linear infinite; flex-shrink: 0;
  }
  @keyframes fl-spin { to { transform: rotate(360deg); } }
  .fl-error-msg {
    background: rgba(239,68,68,0.08); color: #DC2626;
    border: 1px solid rgba(239,68,68,0.2); border-radius: 10px;
    padding: 10px 14px; font-size: 13px; margin-top: 12px;
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
  }
  .fl-error-retry {
    background: none; border: 1px solid #DC2626; color: #DC2626;
    border-radius: 6px; padding: 3px 8px; font-size: 12px; cursor: pointer; font-weight: 600;
  }
  .fl-error-retry:hover { background: rgba(239,68,68,0.06); }

  /* RESPONSIVE */
  @media (max-width: 640px) {
    .fl-mode-grid    { grid-template-columns: 1fr; }
    .fl-book-grid    { grid-template-columns: 1fr; }
    .fl-teacher-grid { grid-template-columns: 1fr; }
    .fl-voice-grid   { grid-template-columns: 1fr; }
    .fl-roadmap      { padding: 10px 12px; }
    .fl-road-chip    { font-size: 11px; padding: 4px 9px; }
    .fl-summary-card { padding: 28px 20px; }
  }
`

// ── Helpers ────────────────────────────────────────────────────────────────────

function CheckSVG() {
  return (
    <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="white" strokeWidth="3">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function LearningPage() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { isAuthenticated, isAuthLoading } = useAuth()

  // Current step index (0–5)
  const [step, setStep]                       = useState(0)
  const [selectedMode, setSelectedMode]       = useState<'textbook' | 'topic' | null>(null)
  const [selectedBook, setSelectedBook]       = useState<string | null>(null)
  const [selectedSection, setSelectedSection] = useState<SectionData | null>(null)
  const [selectedTeacher, setSelectedTeacher] = useState<string>('alex')
  const [selectedVoice, setSelectedVoice]     = useState<string>('')
  const [loading, setLoading]                 = useState(false)
  const [error, setError]                     = useState<string | null>(null)
  const [showAuthGate, setShowAuthGate]       = useState(false)
  const [continuationStatus, setContinuationStatus] = useState<ContinuationStatus | null>(null)

  // Fetch continuation status so we can highlight resumable sections
  useEffect(() => {
    if (isAuthenticated) {
      getContinuationStatus().then(s => setContinuationStatus(s)).catch(() => {})
    }
  }, [isAuthenticated])

  // Restore setup state after OAuth login redirect
  useEffect(() => {
    const state = location.state as { restoredSetup?: LessonSetupState } | null
    if (!state?.restoredSetup) return
    const s = state.restoredSetup
    if (s.mode === 'textbook') { setSelectedMode('textbook'); setStep(1) }
    if (s.bookId) { setSelectedBook(s.bookId); setStep(2) }
    if (s.sectionId) {
      const sec = FOCUS2_SECTIONS.find(x => x.sectionId === s.sectionId)
      if (sec) { setSelectedSection(sec); setStep(3) }
    }
    if (s.teacherId) { setSelectedTeacher(s.teacherId); setStep(4) }
    if (s.voiceId)   { setSelectedVoice(s.voiceId);    setStep(5) }
  }, [location.state])

  const currentTeacher     = TEACHERS.find(t => t.id === selectedTeacher)
  const voicesForTeacher   = VOICES_BY_TEACHER[selectedTeacher] ?? []
  const selectedVoiceName  = voicesForTeacher.find(v => v.id === selectedVoice)?.name ?? ''

  // ── Roadmap chips ──────────────────────────────────────────────────────────

  const ROAD_STEPS = [
    { label: 'Mode',    value: selectedMode ? (selectedMode === 'textbook' ? 'Textbook' : 'Topic') : '' },
    { label: 'Book',    value: selectedBook  ? 'Focus 2' : '' },
    { label: 'Section', value: selectedSection ? `§${selectedSection.sectionNumber}` : '' },
    { label: 'Teacher', value: step > 3 || (step === 3 && selectedTeacher) ? (currentTeacher?.name ?? '') : '' },
    { label: 'Voice',   value: step > 4 ? selectedVoiceName : '' },
    { label: 'Start',   value: '' },
  ]

  // ── Navigation helpers ─────────────────────────────────────────────────────

  function goBack(idx: number) {
    setStep(idx)
  }

  function selectMode(mode: 'textbook') {
    setSelectedMode(mode)
    setStep(1)
  }

  function selectBook(bookId: string) {
    setSelectedBook(bookId)
    setSelectedSection(null)
    setStep(2)
  }

  function selectSection(sec: SectionData) {
    if (sec.disabled) return
    setSelectedSection(sec)
    setStep(3)
  }

  function selectTeacher(id: string) {
    if (id !== selectedTeacher) {
      setSelectedTeacher(id)
      setSelectedVoice('')
    }
    setStep(4)
  }

  function selectVoice(id: string) {
    setSelectedVoice(id)
    setStep(5)
  }

  // ── Start lesson ───────────────────────────────────────────────────────────

  async function handleStart() {
    if (!selectedSection || !selectedBook || !selectedMode) return

    // Auth gate: unauthenticated users see the modal instead of starting
    if (!isAuthLoading && !isAuthenticated) {
      setShowAuthGate(true)
      return
    }

    setLoading(true)
    setError(null)

    const bookData      = BOOKS.find(b => b.id === selectedBook)!
    const teacherData   = TEACHERS.find(t => t.id === selectedTeacher)!
    const resolvedVoice = selectedVoice || voicesForTeacher[0]?.id || 'onyx'

    const payload: LessonStartPayload = {
      mode:          selectedMode,
      bookId:        selectedBook,
      bookTitle:     bookData.title,
      sectionId:     selectedSection.sectionId,
      sectionNumber: selectedSection.sectionNumber,
      sectionTitle:  selectedSection.title,
      sectionTopic:  selectedSection.topic,
      teacherId:     selectedTeacher,
      voiceId:       resolvedVoice,
    }

    const baseMeta: Omit<LessonSessionMetadata, 'sessionId'> = {
      ...payload,
      teacherName:   teacherData.name,
      exerciseCount: selectedSection.exerciseCount,
    }

    try {
      const { sessionId } = await startLesson(payload)
      navigate(`/classroom/${sessionId}`, { state: { ...baseMeta, sessionId } })
    } catch (err) {
      if (err instanceof BillingError) {
        if (err.code === 'SUBSCRIPTION_EXPIRED') {
          navigate('/pricing?reason=expired')
        } else if (err.code === 'LESSON_LIMIT_REACHED') {
          navigate('/pricing?reason=limit_reached')
        } else {
          navigate('/pricing?reason=required')
        }
        return
      }
      console.error('[LearningPage] startLesson failed:', err)
      setError('Failed to start lesson. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Build the current setup state for AuthGate to preserve
  function currentSetupState(): LessonSetupState {
    const bookData    = selectedBook ? BOOKS.find(b => b.id === selectedBook) : undefined
    const teacherData = TEACHERS.find(t => t.id === selectedTeacher)
    return {
      mode:          selectedMode ?? undefined,
      bookId:        selectedBook ?? undefined,
      bookTitle:     bookData?.title,
      sectionId:     selectedSection?.sectionId,
      sectionNumber: selectedSection?.sectionNumber,
      sectionTitle:  selectedSection?.title,
      sectionTopic:  selectedSection?.topic,
      teacherId:     selectedTeacher,
      teacherName:   teacherData?.name,
      voiceId:       selectedVoice || voicesForTeacher[0]?.id,
    }
  }

  const stepKey: StepKey = STEP_KEYS[step]

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{CSS}</style>
      {showAuthGate && (
        <AuthGate
          setupState={currentSetupState()}
          onCancel={() => setShowAuthGate(false)}
        />
      )}
      <div className="fl-page">

        {/* Compact page header */}
        <header className="fl-page-header">
          <div className="fl-page-label">✦ Lesson setup</div>
          <h1 className="fl-page-title">Configure your lesson</h1>
        </header>

        {/* Sticky roadmap — single progress indicator, no duplicate chips below */}
        <nav className="fl-roadmap" aria-label="Setup progress">
          {ROAD_STEPS.map((s, i) => {
            const isDone   = i < step
            const isActive = i === step
            return (
              <div key={s.label} className="fl-road-item">
                <div
                  className={`fl-road-chip${isDone ? ' done' : isActive ? ' active' : ' future'}`}
                  onClick={isDone ? () => goBack(i) : undefined}
                  title={isDone ? `Back to ${s.label}` : undefined}
                >
                  {isDone && <span className="fl-road-check">✓</span>}
                  {isDone && s.value ? `${s.label}: ${s.value}` : s.label}
                </div>
                {i < ROAD_STEPS.length - 1 && (
                  <span className="fl-road-arrow">›</span>
                )}
              </div>
            )
          })}
        </nav>

        {/* Active step — centered, no scroll needed for first view */}
        <main className="fl-main">
          {/* key on step triggers re-animation on every step change */}
          <div className="fl-step" key={step}>

            {/* ── STEP 0: Learning mode ── */}
            {stepKey === 'mode' && (
              <>
                <div className="fl-step-title">How do you want to learn?</div>
                <div className="fl-step-sub">Choose your learning mode to get started.</div>
                <div className="fl-mode-grid">
                  <div className="fl-mode-card" onClick={() => selectMode('textbook')}>
                    <span className="fl-mode-badge available">★ Available</span>
                    <div className="fl-mode-icon">📚</div>
                    <div className="fl-mode-title">Learn with textbook</div>
                    <div className="fl-mode-desc">Follow the Focus 2 Student Book with structured grammar lessons and exercises.</div>
                  </div>
                  <div className="fl-mode-card disabled">
                    <span className="fl-mode-badge">Coming Soon</span>
                    <div className="fl-mode-icon" style={{ background: 'rgba(100,116,139,0.05)', borderColor: 'var(--fl-border-light)' }}>💬</div>
                    <div className="fl-mode-title">Choose by topic</div>
                    <div className="fl-mode-desc">Pick any grammar or vocabulary theme and get a fully custom lesson.</div>
                  </div>
                </div>
              </>
            )}

            {/* ── STEP 1: Choose book ── */}
            {stepKey === 'book' && (
              <>
                <div className="fl-step-title">Choose your textbook</div>
                <div className="fl-step-sub">Focus 2 is available now. More books coming soon.</div>
                <div className="fl-book-grid">
                  {BOOKS.map(book => (
                    <div
                      key={book.id}
                      className={`fl-book-card${!book.enabled ? ' disabled' : ''}`}
                      onClick={book.enabled ? () => selectBook(book.id) : undefined}
                    >
                      <div
                        className="fl-book-cover"
                        style={book.bg ? { background: book.bg } : undefined}
                      >
                        <div className="fl-book-num">{book.num}</div>
                        <div className="fl-book-label">FOCUS<br />STUDENT</div>
                      </div>
                      <div className={`fl-book-badge${!book.enabled ? ' soon' : ''}`}>{book.badge}</div>
                      <div className="fl-book-title">{book.title}</div>
                      <div className="fl-book-desc">{book.desc}</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ── STEP 2: Choose section ── */}
            {stepKey === 'section' && selectedBook && (() => {
              const sections = BOOK_SECTIONS[selectedBook] ?? []
              // Group sections by unit number
              const unitGroups: { unit: number; title: string; sections: SectionData[] }[] = []
              for (const sec of sections) {
                const existing = unitGroups.find(g => g.unit === sec.unit)
                if (existing) {
                  existing.sections.push(sec)
                } else {
                  unitGroups.push({
                    unit: sec.unit,
                    title: FOCUS2_UNIT_TITLES[sec.unit] ?? `Unit ${sec.unit}`,
                    sections: [sec],
                  })
                }
              }
              // Active session section id for resume indicator (strip "focus2-" prefix)
              const resumeSectionId = continuationStatus?.canContinue
                ? continuationStatus.activeSectionId
                : null

              return (
                <>
                  <div className="fl-step-title">Choose a section</div>
                  <div className="fl-step-sub">Pick the section you want to study from {BOOK_TITLES[selectedBook]}.</div>
                  <div className="fl-section-wrap">
                    <div className="fl-section-header">
                      <div>
                        <div className="fl-section-header-title">{BOOK_TITLES[selectedBook]}</div>
                        <div className="fl-section-header-sub">
                          {unitGroups.length} units · {sections.filter(s => !s.disabled).length} available sections
                        </div>
                      </div>
                      {resumeSectionId && (
                        <span className="fl-resume-chip">▶ Resume available</span>
                      )}
                    </div>
                    <div style={{ overflowY: 'auto', maxHeight: '440px' }}>
                      {unitGroups.map(group => (
                        <div key={group.unit}>
                          <div className="fl-unit-header-row">
                            <span className="fl-unit-label">Unit {group.unit}</span>
                            <span className="fl-unit-title">{group.title}</span>
                          </div>
                          <div className="fl-section-grid">
                            {group.sections.map(sec => {
                              const isResume = resumeSectionId === sec.sectionId
                              return (
                                <div
                                  key={sec.sectionId}
                                  className={`fl-section-card${selectedSection?.sectionId === sec.sectionId ? ' selected' : ''}${sec.disabled ? ' disabled' : ''}`}
                                  onClick={() => !sec.disabled && selectSection(sec)}
                                >
                                  {sec.dataQuality && (
                                    <div
                                      className={`fl-quality-dot ${sec.dataQuality}`}
                                      title={sec.dataQuality === 'ocr' ? 'Full textbook data' : 'Structured content'}
                                    />
                                  )}
                                  <div className="fl-section-num">{sec.sectionNumber}</div>
                                  <div className="fl-section-body">
                                    <div className="fl-section-title">
                                      {sec.title}
                                      {isResume && <span className="fl-resume-chip" style={{ marginLeft: 6 }}>▶ Resume</span>}
                                    </div>
                                    <div className="fl-section-topic">{sec.topic}</div>
                                    <div className="fl-section-meta">
                                      <span className="fl-section-tag">⏱ {sec.estimatedDuration}min</span>
                                      {sec.exerciseCount !== undefined && (
                                        <span className="fl-section-tag">◎ {sec.exerciseCount} ex.</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )
            })()}

            {/* ── STEP 3: Choose teacher ── */}
            {stepKey === 'teacher' && (
              <>
                <div className="fl-step-title">Choose your teacher</div>
                <div className="fl-step-sub">Each teacher has a different style. Pick the one that suits you.</div>
                <div className="fl-teacher-grid">
                  {TEACHERS.map(t => (
                    <div
                      key={t.id}
                      className={`fl-teacher-card${selectedTeacher === t.id ? ' selected' : ''}`}
                      onClick={() => selectTeacher(t.id)}
                    >
                      <div className="fl-teacher-check"><CheckSVG /></div>
                      <div className="fl-teacher-avatar" style={{ background: t.bg }}>{t.label}</div>
                      <div className="fl-teacher-name">{t.name}</div>
                      <div className="fl-teacher-style">{t.style}</div>
                      <div className="fl-teacher-tags">
                        {t.tags.map(tag => <span key={tag} className="fl-teacher-tag">{tag}</span>)}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ── STEP 4: Choose voice (filtered by teacher gender) ── */}
            {stepKey === 'voice' && (
              <>
                <div className="fl-step-title">Choose a voice</div>
                <div className="fl-step-sub">
                  {currentTeacher?.name ?? 'Teacher'}'s voice for reading lessons aloud.
                </div>
                <div className="fl-voice-grid">
                  {voicesForTeacher.map(v => (
                    <div
                      key={v.id}
                      className={`fl-voice-card${selectedVoice === v.id ? ' selected' : ''}`}
                      onClick={() => selectVoice(v.id)}
                    >
                      <div className="fl-voice-check"><CheckSVG /></div>
                      <div className="fl-voice-top">
                        <div className="fl-voice-play">
                          <svg viewBox="0 0 24 24" width="11" height="11">
                            <path d="M5 3l14 9-14 9V3z" fill={selectedVoice === v.id ? 'white' : '#64748B'} />
                          </svg>
                        </div>
                        <div className="fl-voice-info">
                          <div className="fl-voice-name">{v.name}</div>
                          <div className="fl-voice-tone">{v.tone}</div>
                        </div>
                      </div>
                      <div className="fl-waveform">
                        {v.heights.map((h, i) => (
                          <div key={i} className="fl-wave-bar" style={{ height: h }} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ── STEP 5: Summary + Start ── */}
            {stepKey === 'summary' && selectedSection && (
              <div className="fl-summary-wrap">
                <div className="fl-summary-card">
                  <div className="fl-summary-title">Lesson ready ✦</div>
                  <div className="fl-summary-rows">
                    <div className="fl-summary-row">
                      <span className="fl-summary-label">Mode</span>
                      <span className="fl-summary-value">Textbook</span>
                    </div>
                    <div className="fl-summary-row">
                      <span className="fl-summary-label">Book</span>
                      <span className="fl-summary-value">{selectedBook ? BOOK_TITLES[selectedBook] : '—'}</span>
                    </div>
                    <div className="fl-summary-row">
                      <span className="fl-summary-label">Section</span>
                      <span className="fl-summary-value">{selectedSection.sectionNumber} — {selectedSection.topic}</span>
                    </div>
                    <div className="fl-summary-row">
                      <span className="fl-summary-label">Teacher</span>
                      <span className="fl-summary-value">{currentTeacher?.name ?? 'Alex'}</span>
                    </div>
                    <div className="fl-summary-row">
                      <span className="fl-summary-label">Voice</span>
                      <span className="fl-summary-value">{selectedVoiceName || '—'}</span>
                    </div>
                    <div className="fl-summary-row">
                      <span className="fl-summary-label">Duration</span>
                      <span className="fl-summary-value">~{selectedSection.estimatedDuration} min</span>
                    </div>
                    {selectedSection.exerciseCount !== undefined && (
                      <div className="fl-summary-row">
                        <span className="fl-summary-label">Exercises</span>
                        <span className="fl-summary-value">{selectedSection.exerciseCount} exercises</span>
                      </div>
                    )}
                  </div>

                  <button
                    className={`fl-start-btn${loading ? ' loading' : ''}`}
                    disabled={loading}
                    onClick={handleStart}
                  >
                    {loading ? (
                      <><div className="fl-spinner" /> Preparing lesson…</>
                    ) : (
                      'Start lesson →'
                    )}
                  </button>

                  {error && (
                    <div className="fl-error-msg">
                      <span>⚠ {error}</span>
                      <button className="fl-error-retry" onClick={handleStart}>Retry</button>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        </main>
      </div>
    </>
  )
}

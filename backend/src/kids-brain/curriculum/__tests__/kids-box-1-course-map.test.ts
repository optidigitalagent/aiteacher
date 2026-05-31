import { describe, it, expect } from 'vitest';
import {
  KIDS_BOX_1_COURSE_MAP,
} from '../kids-box/kids-box-1-course-map.js';
import type {
  KidsBox1CourseMap,
  KidsBoxUnitMapEntry,
} from '../kids-box/kids-box-1-course-map.js';

describe('KIDS_BOX_1_COURSE_MAP', () => {
  it('is a valid KidsBox1CourseMap export', () => {
    const map: KidsBox1CourseMap = KIDS_BOX_1_COURSE_MAP;
    expect(map).toBeDefined();
    expect(map.courseId).toBe('cambridge-kids-box-1');
    expect(map.title).toBe("Kid's Box 1");
    expect(map.level).toBe('pre-A1');
  });

  it('has exactly 12 main units', () => {
    expect(KIDS_BOX_1_COURSE_MAP.units).toHaveLength(12);
  });

  it('Unit 1 is extracted', () => {
    const unit1 = KIDS_BOX_1_COURSE_MAP.units.find((u) => u.order === 1);
    expect(unit1).toBeDefined();
    expect(unit1!.status).toBe('extracted');
    expect(unit1!.unitId).toBe('kb1-unit-01');
    expect(unit1!.title).toBe('Hello!');
  });

  it('Units 2–12 are all pending', () => {
    const remaining = KIDS_BOX_1_COURSE_MAP.units.filter((u) => u.order >= 2);
    expect(remaining).toHaveLength(11);
    for (const unit of remaining) {
      expect(unit.status).toBe('pending');
    }
  });

  it('units are ordered 1–12 with no gaps', () => {
    const orders = KIDS_BOX_1_COURSE_MAP.units.map((u) => u.order).sort((a, b) => a - b);
    expect(orders).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('all unit ids are unique', () => {
    const ids = KIDS_BOX_1_COURSE_MAP.units.map((u) => u.unitId);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('all units have non-empty page references', () => {
    for (const unit of KIDS_BOX_1_COURSE_MAP.units) {
      expect(unit.teacherBookPage.start).toBeGreaterThan(0);
      expect(unit.teacherBookPage.end).toBeGreaterThanOrEqual(unit.teacherBookPage.start);
      expect(unit.pupilBookPage.start).toBeGreaterThan(0);
      expect(unit.pupilBookPage.end).toBeGreaterThanOrEqual(unit.pupilBookPage.start);
    }
  });

  it('all units have vocabulary themes', () => {
    for (const unit of KIDS_BOX_1_COURSE_MAP.units) {
      expect(unit.keyVocabularyThemes.length).toBeGreaterThan(0);
    }
  });

  it('all units have grammar functions', () => {
    for (const unit of KIDS_BOX_1_COURSE_MAP.units) {
      expect(unit.keyGrammarFunctions.length).toBeGreaterThan(0);
    }
  });

  it('review blocks exist for ranges 1–4, 5–8, and 9–12', () => {
    const { reviewBlocks } = KIDS_BOX_1_COURSE_MAP;
    expect(reviewBlocks).toHaveLength(3);

    const review14 = reviewBlocks.find((r) => r.blockId === 'kb1-review-1-4');
    expect(review14).toBeDefined();
    expect(review14!.coversUnitIds).toEqual([
      'kb1-unit-01', 'kb1-unit-02', 'kb1-unit-03', 'kb1-unit-04',
    ]);

    const review58 = reviewBlocks.find((r) => r.blockId === 'kb1-review-5-8');
    expect(review58).toBeDefined();
    expect(review58!.coversUnitIds).toEqual([
      'kb1-unit-05', 'kb1-unit-06', 'kb1-unit-07', 'kb1-unit-08',
    ]);

    const review912 = reviewBlocks.find((r) => r.blockId === 'kb1-review-9-12');
    expect(review912).toBeDefined();
    expect(review912!.coversUnitIds).toEqual([
      'kb1-unit-09', 'kb1-unit-10', 'kb1-unit-11', 'kb1-unit-12',
    ]);
  });

  it('review blocks have valid page references', () => {
    for (const block of KIDS_BOX_1_COURSE_MAP.reviewBlocks) {
      expect(block.teacherBookPage.start).toBeGreaterThan(0);
      expect(block.teacherBookPage.end).toBeGreaterThanOrEqual(block.teacherBookPage.start);
      expect(block.pupilBookPage.start).toBeGreaterThan(0);
      expect(block.pupilBookPage.end).toBeGreaterThanOrEqual(block.pupilBookPage.start);
    }
  });

  it('CLIL/values sections exist (4 sections)', () => {
    const { clilValuesSections } = KIDS_BOX_1_COURSE_MAP;
    expect(clilValuesSections).toHaveLength(4);
  });

  it('CLIL sections cover maths, science, sports, and art', () => {
    const subjects = KIDS_BOX_1_COURSE_MAP.clilValuesSections.map((s) => s.subject);
    expect(subjects).toContain('maths');
    expect(subjects).toContain('science');
    expect(subjects).toContain('sports');
    expect(subjects).toContain('art');
  });

  it('CLIL sections reference valid unit ids', () => {
    const unitIds = new Set(KIDS_BOX_1_COURSE_MAP.units.map((u) => u.unitId));
    for (const section of KIDS_BOX_1_COURSE_MAP.clilValuesSections) {
      expect(unitIds.has(section.afterUnitId)).toBe(true);
    }
  });

  it('CLIL sections have valid page references', () => {
    for (const section of KIDS_BOX_1_COURSE_MAP.clilValuesSections) {
      expect(section.teacherBookPage.start).toBeGreaterThan(0);
      expect(section.pupilBookPage.start).toBeGreaterThan(0);
    }
  });

  it('source refs point to expected asset paths', () => {
    const { sourceRefs } = KIDS_BOX_1_COURSE_MAP;
    expect(sourceRefs.pupilBook).toContain('kids-box-1');
    expect(sourceRefs.teacherBook).toContain('kids-box-1');
    expect(sourceRefs.activityBook).toContain('kids-box-1');
  });

  it('no raw copyrighted page text — unit fields are metadata only', () => {
    for (const unit of KIDS_BOX_1_COURSE_MAP.units) {
      // Each vocabulary theme and grammar function should be a short label,
      // not a multi-sentence block of textbook content.
      for (const theme of unit.keyVocabularyThemes) {
        expect(theme.length).toBeLessThan(80);
      }
      for (const fn of unit.keyGrammarFunctions) {
        expect(fn.length).toBeLessThan(120);
      }
    }
  });

  it('Unit 1 has phonics focus on /s/ sound', () => {
    const unit1 = KIDS_BOX_1_COURSE_MAP.units.find((u) => u.order === 1);
    expect(unit1!.phonicsFocus).toBeDefined();
    expect(unit1!.phonicsFocus).toContain('/s/');
  });
});

describe('KidsBox1CourseMap type shape', () => {
  it('unit map entry has all required fields', () => {
    const entry: KidsBoxUnitMapEntry = KIDS_BOX_1_COURSE_MAP.units[0];
    expect(typeof entry.unitId).toBe('string');
    expect(typeof entry.order).toBe('number');
    expect(typeof entry.title).toBe('string');
    expect(entry.teacherBookPage).toHaveProperty('start');
    expect(entry.teacherBookPage).toHaveProperty('end');
    expect(entry.pupilBookPage).toHaveProperty('start');
    expect(entry.pupilBookPage).toHaveProperty('end');
    expect(Array.isArray(entry.keyVocabularyThemes)).toBe(true);
    expect(Array.isArray(entry.keyGrammarFunctions)).toBe(true);
    expect(['pending', 'extracted', 'validated', 'active']).toContain(entry.status);
  });
});

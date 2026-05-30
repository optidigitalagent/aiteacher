# Phase 11A — Kid's Box Unit 1 Extraction

Goal

Extract the real Unit 1 curriculum from Kid's Box 1 and map it into the existing Kids Brain curriculum schema.

This is the first real textbook integration phase.

Do NOT create a new curriculum.
Do NOT invent lesson content.
Use the textbook as the source of truth.

Do NOT modify runtime.
Do NOT modify lesson-ws.ts.
Do NOT modify frontend.
Do NOT modify adult runtime.
Do NOT deploy.

Source Materials

Read:

curriculum-assets/kids-box-1/pupil-book.pdf
curriculum-assets/kids-box-1/teacher-book.pdf
curriculum-assets/kids-box-1/activity-book.pdf

Also read:

backend/src/kids-brain/curriculum/
docs/kids-brain-v1/implementation/phase-10A-curriculum-schema-report.md
docs/kids-brain-v1/implementation/phase-10B-static-prototype-animals-lesson-report.md
docs/kids-brain-v1/implementation/phase-10C-curriculum-loader-report.md

Objectives

1. Identify Unit 1 boundaries
   - title
   - lesson structure
   - target vocabulary
   - target phrases
   - activities
   - songs/chants
   - review sections
   - story sections

2. Extract curriculum data

Create a curriculum representation for Unit 1 using existing schema.

Use:

KidsCurriculumCourse
KidsCurriculumUnit
KidsCurriculumLesson
KidsVocabularyItem
KidsActivityDefinition
KidsReviewLink

3. Copyright-safe extraction

Do NOT copy large textbook passages.

Store:

- vocabulary items
- activity metadata
- lesson structure
- learning objectives
- references
- page references

Do NOT store:

- full page text
- scanned page content
- copyrighted stories verbatim

4. Create curriculum file

Create:

backend/src/kids-brain/curriculum/kids-box/kids-box-unit-01.ts

Contents:

- unit metadata
- lesson metadata
- vocabulary items
- activity sequence
- review links
- lesson objectives
- page references

5. Tests

Create tests validating:

- schema validity
- lesson id uniqueness
- vocabulary uniqueness
- valid review links
- visual safety compliance

6. Report

Create:

docs/kids-brain-v1/implementation/phase-11A-kids-box-unit-1-extraction-report.md

Report must include:

- Unit 1 title
- vocabulary extracted
- phrases extracted
- activities extracted
- page references used
- assumptions made
- copyright-safe handling
- next recommended phase

Validation

Run:

cd backend
npx tsc --noEmit
npx vitest run src/kids-brain

Output in chat:

- files created
- files modified
- vocabulary extracted
- activities extracted
- commands run
- test results
- next phase recommendation
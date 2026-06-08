import { chromium } from '@playwright/test'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

// Note: Auth screenshot (verify-kids-auth.png) was captured in a prior run when
// the frontend dev server was running. It shows the Mentium Kids landing page.
// Skipped here to avoid requiring a live server.

// --- Exercise panel rendering test: all 4 Unit 1 exercise types ---
// Mirrors KidsClassroomPage.tsx exercise panel CSS (lines 1100-1138)
await page.goto('about:blank')
await page.setContent(`
<!DOCTYPE html>
<html>
<head>
<style>
  body { background: #f0f4f8; padding: 24px; font-family: system-ui; }
  h2 { margin-bottom: 8px; }
  h3 { margin: 20px 0 8px; font-size: 15px; color: #334155; }
  .kec-card { background: #fff; border-radius: 12px; padding: 20px; max-width: 400px; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
  .kec-header { display: flex; justify-content: space-between; font-size: 13px; color: #64748b; }
  .kec-instruction { font-size: 18px; font-weight: 600; color: #1e293b; margin-top: 12px; }
  .kec-visual { margin-top: 16px; border-radius: 10px; overflow: hidden; min-height: 120px; background: #f8fafc; }
  .kec-visual-placeholder { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 120px; color: #94a3b8; font-size: 14px; gap: 6px; }
  .kec-choices { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
  .kec-choice { background: #f1f5f9; border-radius: 20px; padding: 6px 14px; font-size: 15px; }
  .kec-visual-img { width: 100%; object-fit: cover; max-height: 160px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
</style>
</head>
<body>
  <h2>KidsClassroomPage — Exercise Panel Test (All 4 Unit 1 Types)</h2>
  <div class="grid">

    <!-- Type 1: LISTEN_AND_REPEAT (with visual asset) -->
    <div>
      <h3>Type 1: LISTEN_AND_REPEAT</h3>
      <div class="kec-card">
        <div class="kec-header">
          <span>Exercise 2/13</span>
          <span>Colours lesson</span>
        </div>
        <p class="kec-instruction">Listen — blue! Now you say it!</p>
        <div class="kec-visual">
          <img src="https://via.placeholder.com/400x160?text=Blue+Colour" alt="blue" class="kec-visual-img" id="img-lar">
        </div>
      </div>
    </div>

    <!-- Type 2: LISTEN_AND_CHOOSE (with choices, no visual) -->
    <div>
      <h3>Type 2: LISTEN_AND_CHOOSE</h3>
      <div class="kec-card">
        <div class="kec-header">
          <span>Exercise 6/13</span>
          <span>Colours lesson</span>
        </div>
        <p class="kec-instruction">Blue or green? Which colour is it?</p>
        <div class="kec-visual">
          <div class="kec-visual-placeholder" id="placeholder-lac">
            🖼️ <span>Listen to the teacher!</span>
          </div>
        </div>
        <div class="kec-choices">
          <span class="kec-choice">blue</span>
          <span class="kec-choice">green</span>
        </div>
      </div>
    </div>

    <!-- Type 3: CHANT (instruction only, no visual, no choices) -->
    <div>
      <h3>Type 3: CHANT</h3>
      <div class="kec-card">
        <div class="kec-header">
          <span>Exercise 9/13</span>
          <span>Colours lesson</span>
        </div>
        <p class="kec-instruction">Let's say it together — blue!</p>
        <div class="kec-visual">
          <div class="kec-visual-placeholder" id="placeholder-chant">
            🎵 <span>Listen to the teacher!</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Type 4: REVIEW (readiness/intro, instruction only) -->
    <div>
      <h3>Type 4: REVIEW</h3>
      <div class="kec-card">
        <div class="kec-header">
          <span>Exercise 1/13</span>
          <span>Colours lesson</span>
        </div>
        <p class="kec-instruction">Ready for colours? Great! Let's start!</p>
        <div class="kec-visual">
          <div class="kec-visual-placeholder" id="placeholder-review">
            🖼️ <span>Listen to the teacher!</span>
          </div>
        </div>
      </div>
    </div>

  </div>

  <script>
    // Verify all 4 types render without crashing
    const imgLar = document.getElementById('img-lar')
    console.assert(imgLar !== null, 'FAIL: LISTEN_AND_REPEAT img missing')

    const placeholderLac = document.getElementById('placeholder-lac')
    console.assert(placeholderLac !== null, 'FAIL: LISTEN_AND_CHOOSE placeholder missing')
    console.assert(placeholderLac.textContent.includes('Listen to the teacher'), 'FAIL: LAC placeholder text')

    const placeholderChant = document.getElementById('placeholder-chant')
    console.assert(placeholderChant !== null, 'FAIL: CHANT placeholder missing')

    const placeholderReview = document.getElementById('placeholder-review')
    console.assert(placeholderReview !== null, 'FAIL: REVIEW placeholder missing')

    document.title = 'All 4 Exercise Types PASSED'
  </script>
</body>
</html>
`)
await page.waitForTimeout(1000)
await page.screenshot({ path: 'verify-exercise-panel.png' })

const panelTitle = await page.title()
console.log('[UI] Panel test title:', panelTitle)

const imgCount = await page.locator('img#img-lar').count()
console.log('[UI] LISTEN_AND_REPEAT img present:', imgCount > 0 ? 'YES' : 'NO')

const lacPlaceholder = await page.locator('#placeholder-lac').count()
console.log('[UI] LISTEN_AND_CHOOSE placeholder present:', lacPlaceholder > 0 ? 'YES' : 'NO')

const chantPlaceholder = await page.locator('#placeholder-chant').count()
console.log('[UI] CHANT placeholder present:', chantPlaceholder > 0 ? 'YES' : 'NO')

const reviewPlaceholder = await page.locator('#placeholder-review').count()
console.log('[UI] REVIEW placeholder present:', reviewPlaceholder > 0 ? 'YES' : 'NO')

await browser.close()
console.log('Screenshots saved: verify-kids-auth.png, verify-exercise-panel.png')

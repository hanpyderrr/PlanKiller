# Task: Split main.tsx into page component files

Split `apps/desktop/src/main.tsx` (1456 lines) into separate files under `src/pages/`.
Do NOT change any logic, prop shapes, JSX structure, or behavior. Only move code between files.
Do NOT commit to git.

---

## Target file structure

Create directory `apps/desktop/src/pages/` (it does not exist yet) and these files:

  apps/desktop/src/utils.ts
  apps/desktop/src/pages/HomePage.tsx
  apps/desktop/src/pages/PlanPage.tsx
  apps/desktop/src/pages/ReviewPage.tsx
  apps/desktop/src/pages/HabitPage.tsx
  apps/desktop/src/pages/HistoryPage.tsx
  apps/desktop/src/pages/AiPage.tsx
  apps/desktop/src/pages/MemoryPage.tsx
  apps/desktop/src/pages/SettingsPage.tsx

Then reduce `apps/desktop/src/main.tsx` to a slim shell (App + mount only).

---

## File: src/utils.ts

Extract from main.tsx lines 20-27:
  - `localDateStr` function
  - `today` const

Both must be exported. No React import needed.

---

## File: src/pages/HomePage.tsx

Extract main.tsx lines 156-452 (the `HomePage` function, including its closing brace).
The component uses: useState, useEffect, useRef from React.
Types used from api.ts: DailyPlan, Habit, WeeklyReport, AiChatResponse, aiRequest.
`today` is NOT used inside HomePage directly (it does not reference the module-level `today`).

Imports needed:
  import React, { useEffect, useRef, useState } from 'react';
  import { AiChatResponse, DailyPlan, Habit, WeeklyReport, aiRequest } from '../api';

Export:
  export default HomePage;

---

## File: src/pages/PlanPage.tsx

Extract main.tsx lines 455-674:
  - type ItemDraft (line 455)
  - PlanPage function (lines 457-674)

`today` IS used (line 497 payload.plan_date = today).

Imports needed:
  import React, { useEffect, useRef, useState } from 'react';
  import { DailyPlan, apiRequest } from '../api';
  import { today } from '../utils';

Export:
  export type { ItemDraft };
  export default PlanPage;

---

## File: src/pages/ReviewPage.tsx

Extract main.tsx lines 677-717 (ReviewPage function).
`today` IS used (line 686, template literal `/plans/${today}/review`).

Imports needed:
  import React, { useState } from 'react';
  import { DailyPlan, apiRequest } from '../api';
  import { today } from '../utils';

Export:
  export default ReviewPage;

---

## File: src/pages/HabitPage.tsx

Extract main.tsx lines 719-933:
  - EmojiPicker function (lines 720-734)
  - DEFAULT_SCHEDULE_DAYS const (line 736)
  - DAY_LABELS const (line 737)
  - parseScheduleDays function (lines 739-744)
  - formatScheduleDays function (lines 746-751)
  - DayPicker function (lines 753-794)
  - HabitPage function (lines 797-926)
  - habitStatusView function (lines 928-933)

`today` IS used inside HabitPage (logHabit and undoHabit call /habits/:id/logs/:today).

Imports needed:
  import React, { useState } from 'react';
  import { Habit, apiRequest } from '../api';
  import { today } from '../utils';

Export:
  export { EmojiPicker, DayPicker, DEFAULT_SCHEDULE_DAYS, DAY_LABELS, parseScheduleDays, formatScheduleDays, habitStatusView };
  export default HabitPage;

---

## File: src/pages/HistoryPage.tsx

Extract main.tsx lines 935-1055:
  - HistoryPage function (lines 936-1041)
  - PatternList function (lines 1043-1055)

`today` IS used inside HistoryPage (dateStr comparisons at lines 1006-1007).

Imports needed:
  import React, { useState } from 'react';
  import { DailyPlan } from '../api';
  import { today } from '../utils';

Export:
  export { PatternList };
  export default HistoryPage;

---

## File: src/pages/AiPage.tsx

Extract main.tsx lines 1058-1096 (AiPage function).
AiPage uses MemoryHitList which lives in MemoryPage.tsx -- import it from there.

Imports needed:
  import React, { useState } from 'react';
  import { AiChatResponse, MemoryHit, aiRequest } from '../api';
  import { MemoryHitList } from './MemoryPage';

Export:
  export default AiPage;

---

## File: src/pages/MemoryPage.tsx

Extract main.tsx lines 1100-1336:
  - MemoryPage function (lines 1100-1269)
  - ManualMemoryCard function (lines 1271-1298)
  - MemoryHitList function (lines 1300-1311)
  - MemoryHitCard function (lines 1313-1325)
  - sourceLabel function (lines 1327-1336)

Imports needed:
  import React, { useEffect, useState } from 'react';
  import { ManualMemory, MemoryHit, MemoryReindexResponse, MemorySearchResponse, apiRequest } from '../api';

Export:
  export { ManualMemoryCard, MemoryHitList, MemoryHitCard, sourceLabel };
  export default MemoryPage;

---

## File: src/pages/SettingsPage.tsx

Extract main.tsx lines 1338-1454 (SettingsPage function).

Imports needed:
  import React, { useEffect, useState } from 'react';
  import { apiRequest } from '../api';

Export:
  export default SettingsPage;

---

## Update: src/main.tsx

After extracting all pages, main.tsx must keep:
  1. React import (useState, useMemo, useEffect)
  2. createRoot import
  3. import './styles.css'
  4. Imports of all api types used by App: DailyPlan, Habit, WeeklyReport, apiRequest, defaultApiBase
  5. Import today and localDateStr from './utils'
  6. Import all 8 page default components from './pages/...'
  7. The Tab type definition (line 29)
  8. The App function (lines 31-153) -- unchanged
  9. The createRoot mount (line 1456)

Remove from main.tsx:
  - localDateStr function and today const (now in utils.ts)
  - All page components and helpers extracted above

The App function body must NOT change: same state, same nav arrays, same refresh logic, same JSX.

---

## Verification

Run:
  cd apps/desktop && npm run build

If TypeScript errors appear, fix the imports but do NOT change any component logic.

## Constraints

- Do not commit to git
- Do not rename any function or component
- Do not change any JSX, prop name, or runtime logic
- Do not add new dependencies or abstractions beyond the page files listed above

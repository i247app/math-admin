# Exam Pool Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin screens to browse the AI exam pool, verify sets, and fix a set's questions and answer key.

**Architecture:** Two React Router pages under `/exams/pools` (list → detail) with list state in the URL. They call math-svr's `/exams/pools/{list,detail,mark-verify,verify}` through `src/features/exams/ExamPoolsApi.ts`. The editor's rules (draft, validation, the payload sent to `verify`) live in the pure module `ExamPoolDraft.ts`, which a Node script checks. The sidebar's "Bài kiểm tra" item becomes an admin-only group.

**Tech Stack:** React 19, Vite, TypeScript, React Router 7 (data router, `useBlocker`), TanStack Query 5, shadcn/ui, Tailwind 4, react-i18next, lucide-react, sonner.

**Spec:** `docs/superpowers/specs/2026-10-08-exam-pool-admin-design.md`

## Global Constraints

- Read `CLAUDE.md` and `docs/API-CONTRACT.md` first. All HTTP goes through `apiPost` in `src/libs/ApiClient.ts`; components never call `fetch`.
- Write routes used: only `/exams/pools/mark-verify` and `/exams/pools/verify`. Never call `/exams/pools/generate`.
- UI text only from `src/locales/{vi,en}.json` via `useTranslation()`. `vi.json` is the type-checked source of truth; every key added to `vi.json` gets an `en.json` twin at the same path. Plural keys use the `count` option: `vi` defines `<key>_other` only, `en` defines `<key>_one` and `<key>_other`. Never name a non-plural interpolation `count`.
- Use theme tokens (`bg-success-surface`, `text-primary-foreground`, …), never raw hex or `text-white`.
- Labels (verbatim): "Kho đề", "Bài làm học sinh", "Đã xác minh · n lần" / "Chưa xác minh", "Sửa đề", "Lưu & xác minh", "Đánh dấu đã xác minh", "Bỏ xác minh". Types `ASSESSMENT` "Đánh giá năng lực", `GRADE` "Ôn theo lớp", `PRACTICE` "Luyện tập"; grade 0 "Mẫu giáo", 1–5 "Lớp n"; level "Mức n" (raw).
- Editor caps: answer content ≤ 255 characters, topic ≤ 64 characters (code points). `right_answer_content` is always derived from the chosen answer, never typed. `question_number`, `question_type`, `question_grade` and answer labels are sent unchanged.
- Times use the server layout: format with `formatServerTime`; empty = "—".
- The sidebar group is visible only when `useSessionUser().role === 'ADMIN'` (math-svr answers `403` to anyone else).
- **No test runner exists and none is added.** Proof per task: `npm run build` (type-check + bundle) and `npm run lint`; Task 1 also runs `node scripts/check-exam-pool-draft.ts` (Node ≥ 23 strips TypeScript types; this repo runs Node 26). `ExamPoolDraft.ts` may only use `import type` from `@/…` aliases, or the script stops running.
- Browser checks are done once by the controller after Task 4, with one ADMIN sign-in by the user. Implementers do build + lint + commit only.
- Commits: Conventional Commits; Lefthook runs lint + type-check + commitlint. Stage only the files listed in the task. End each message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Precondition:** `git status` shows no unrelated changes in the files below.

## File Map

| File | Status | Responsibility |
|---|---|---|
| `src/types/Exam.ts` | modify | `ExamPool` + request/response types, `EXAM_TYPES`, `EXAM_GRADES`, `FRACTION` |
| `src/features/exams/ExamPoolsApi.ts` | create | Pool queries, the two writes, `storeExamPool`, paths |
| `src/features/exams/ExamPoolDraft.ts` | create | Editor draft, validation, change detection, verify payload |
| `scripts/check-exam-pool-draft.ts` | create | Runnable assert-based check of `ExamPoolDraft.ts` |
| `src/features/exams/ExamBadges.tsx` | modify | `VerifiedPill` |
| `src/features/exams/ExamPoolsTable.tsx` | create | Pool list table |
| `src/app/(dashboard)/exams/pools/page.tsx` | create | `/exams/pools` |
| `src/features/exams/RichText.tsx` | create | Emoji + `[icon:NAME]` chip rendering (moved from `QuestionCard`) |
| `src/features/exams/QuestionCard.tsx` | modify | Use `RichText`; outcome `key` |
| `src/features/exams/ExamHelpers.ts` | modify | Outcome `key`; `poolQuestion` |
| `src/features/exams/ExamNav.tsx` | modify | `InvalidLink` `to` / `label` |
| `src/features/exams/PoolQuestionEditor.tsx` | create | One question's edit form |
| `src/app/(dashboard)/exams/pools/detail/page.tsx` | create | `/exams/pools/detail` (view in Task 3, edit in Task 4) |
| `src/app/router.tsx` | modify | `pools` and `pools/detail` routes |
| `src/features/dashboard/Sidebar.tsx` | modify | "Bài kiểm tra" admin group |
| `src/locales/vi.json`, `src/locales/en.json` | modify | `nav.examSittings`, `nav.examPools`, `exams.pools.*`, `exams.question.types.FRACTION` |
| `docs/API-CONTRACT.md`, `CLAUDE.md` | modify | Pool routes and rules |

---

### Task 1: Pool data layer, editor rules, contract docs

**Files:**
- Modify: `src/types/Exam.ts`
- Create: `src/features/exams/ExamPoolsApi.ts`
- Create: `src/features/exams/ExamPoolDraft.ts`
- Create: `scripts/check-exam-pool-draft.ts`
- Modify: `src/locales/vi.json`, `src/locales/en.json`
- Modify: `docs/API-CONTRACT.md`, `CLAUDE.md`

**Interfaces:**
- Consumes: `examsQueryKey` from `src/features/exams/ExamsApi.ts`; `apiPost<T>(path, fields, { signal }?)`; existing `ExamQuestion`, `AnswerChoice`, `ExamType`, `OffsetPagination`.
- Produces:
  - `EXAM_TYPES: readonly ['ASSESSMENT','GRADE','PRACTICE']`, `EXAM_GRADES: readonly [0,1,2,3,4,5]`
  - types `ExamPool`, `ListExamPoolsRequest`, `ListExamPoolsResponse`, `ExamPoolResponse`
  - `examPoolsListQueryOptions(request: ListExamPoolsRequest)` → data `{ pools: ExamPool[]; pagination: OffsetPagination }`
  - `examPoolDetailQueryOptions(examId: number)` → data `ExamPool`
  - `markExamPoolVerify(examId: number, isVerify: boolean): Promise<ExamPool>`
  - `verifyExamPool(examId: number, questions: ExamQuestion[]): Promise<ExamPool>`
  - `storeExamPool(queryClient: QueryClient, pool: ExamPool): void`
  - `EXAM_POOLS_PATH = '/exams/pools'`, `examPoolPath(examId: number): string`
  - `DraftQuestion = { name: string; answers: AnswerChoice[]; rightLabel: string; topic: string }`
  - `AnswerError = 'required' | 'tooLong' | 'duplicate'`
  - `QuestionErrors = { name?: 'required'; answers: Partial<Record<string, AnswerError>>; topic?: 'tooLong'; right?: 'missing' }`
  - `toDraft(q: ExamQuestion): DraftQuestion`, `questionErrors(d: DraftQuestion): QuestionErrors | null`, `isChanged(q: ExamQuestion, d: DraftQuestion): boolean`, `toVerifyQuestions(originals: ExamQuestion[], drafts: DraftQuestion[]): ExamQuestion[]`, `MAX_ANSWER_LENGTH = 255`, `MAX_TOPIC_LENGTH = 64`

- [ ] **Step 1: Extend `src/types/Exam.ts`**

Replace the `QUESTION_TYPES` block:

```ts
/** How the app renders a question; grading ignores it. Unknown values render as plain text. */
export const QUESTION_TYPES = ['ARITHMETIC', 'COUNT', 'PICK_BY_ICON', 'IDENTIFY_SHAPE'] as const
```

with:

```ts
/**
 * How the app renders a question; grading ignores it. Unknown values render as plain text.
 * FRACTION carries LaTeX \frac{a}{b} inside $…$; the admin shows it raw.
 */
export const QUESTION_TYPES = ['ARITHMETIC', 'COUNT', 'PICK_BY_ICON', 'IDENTIFY_SHAPE', 'FRACTION'] as const
```

Replace the `ExamQuestion` doc comment and the answer-key comment:

```ts
/** One question as served to the child: their numbering and their A/B/C/D. */
```
→
```ts
/** One question: on a sitting, the child's served numbering and A/B/C/D; on a pool set, the stored (canonical) ones. */
```
and
```ts
  /** Answer key: only on SUBMITTED sittings. */
```
→
```ts
  /** Answer key: on SUBMITTED sittings and on pool sets. */
```

Append at the end of the file:

```ts
/** Every exam type; the pool list filters by these. */
export const EXAM_TYPES = ['ASSESSMENT', 'GRADE', 'PRACTICE'] as const satisfies readonly ExamType[]

/** 0 = kindergarten. */
export const EXAM_GRADES = [0, 1, 2, 3, 4, 5] as const

/**
 * One stored question set (math-svr ExamPoolResponse). `questions` — stored order, answer key
 * included — comes with detail, mark-verify and verify; the list leaves it out.
 */
export type ExamPool = {
  exam_id: number
  exam_type: ExamType
  grade: number
  level?: number
  /** Questions REQUESTED; the stored set can be shorter. */
  num_questions: number
  semester?: string
  program?: string
  /** Cache tag; absent on PRACTICE sets (never reused). */
  req_extras?: string
  ai_title?: string
  ai_short_text?: string
  questions?: ExamQuestion[]
  /** 0 = not verified; mark-verify sets 1, every verify adds 1. */
  verified_count: number
  status?: string
  create_dt: string
}

export type ListExamPoolsRequest = {
  exam_types?: ExamType[]
  grade?: number
  /** Requested from math-svr; ignored by the server until it lands. */
  is_verified?: boolean
  page: number
  size: number
}

export type ListExamPoolsResponse = { exam_pools: ExamPool[] | null; pagination: OffsetPagination }

/** detail, mark-verify and verify all answer with the set, questions included. */
export type ExamPoolResponse = { exam_pool: ExamPool }
```

- [ ] **Step 2: Create `src/features/exams/ExamPoolsApi.ts`**

```ts
/** /exams/pools/* calls (docs/API-CONTRACT.md §4, Exam pool). ADMIN sessions only. */
import type { QueryClient } from '@tanstack/react-query'
import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import { apiPost } from '@/libs/ApiClient'
import type { ExamPool, ExamPoolResponse, ExamQuestion, ListExamPoolsRequest, ListExamPoolsResponse } from '@/types/Exam'
import { examsQueryKey } from './ExamsApi'

const poolsQueryKey = [...examsQueryKey, 'pools'] as const

export function examPoolsListQueryOptions(request: ListExamPoolsRequest) {
  return queryOptions({
    queryKey: [...poolsQueryKey, 'list', request],
    queryFn: async ({ signal }) => {
      const res = await apiPost<ListExamPoolsResponse>('/exams/pools/list', request, { signal })
      return { pools: res.exam_pools ?? [], pagination: res.pagination }
    },
    placeholderData: keepPreviousData,
  })
}

export function examPoolDetailQueryOptions(examId: number) {
  return queryOptions({
    queryKey: [...poolsQueryKey, 'detail', examId],
    queryFn: async ({ signal }) =>
      (await apiPost<ExamPoolResponse>('/exams/pools/detail', { exam_id: examId }, { signal })).exam_pool,
  })
}

/** true: verified_count 0 → 1 (a verified set keeps its count); false: back to 0. */
export async function markExamPoolVerify(examId: number, isVerify: boolean) {
  return (await apiPost<ExamPoolResponse>('/exams/pools/mark-verify', { exam_id: examId, is_verify: isVerify }))
    .exam_pool
}

/** Replaces the whole stored set (same shape) and adds 1 to verified_count. */
export async function verifyExamPool(examId: number, questions: ExamQuestion[]) {
  return (await apiPost<ExamPoolResponse>('/exams/pools/verify', { exam_id: examId, questions })).exam_pool
}

/** After a write: the response is the fresh set; lists may still show the old count. */
export function storeExamPool(queryClient: QueryClient, pool: ExamPool) {
  queryClient.setQueryData(examPoolDetailQueryOptions(pool.exam_id).queryKey, pool)
  void queryClient.invalidateQueries({ queryKey: [...poolsQueryKey, 'list'] })
}

export const EXAM_POOLS_PATH = '/exams/pools'

export function examPoolPath(examId: number) {
  return `${EXAM_POOLS_PATH}/detail?exam=${examId}`
}
```

- [ ] **Step 3: Create `src/features/exams/ExamPoolDraft.ts`**

```ts
/**
 * The pool editor's working copy and its rules (docs/superpowers/specs/2026-10-08-exam-pool-admin-design.md).
 * Pure, with type-only imports, so `node scripts/check-exam-pool-draft.ts` can run it.
 */
import type { AnswerChoice, ExamQuestion } from '@/types/Exam'

/** At submit math-svr copies these into VARCHAR(255) / VARCHAR(64) columns (ma_exam_session_lines). */
export const MAX_ANSWER_LENGTH = 255
export const MAX_TOPIC_LENGTH = 64

/** The editable part of one question. Number, type, grade and answer labels are never edited. */
export type DraftQuestion = {
  name: string
  answers: AnswerChoice[]
  rightLabel: string
  topic: string
}

export type AnswerError = 'required' | 'tooLong' | 'duplicate'

export type QuestionErrors = {
  name?: 'required'
  /** By answer label. */
  answers: Partial<Record<string, AnswerError>>
  topic?: 'tooLong'
  right?: 'missing'
}

export function toDraft(question: ExamQuestion): DraftQuestion {
  return {
    name: question.question_name,
    answers: (question.answers ?? []).map(({ label, content }) => ({ label, content })),
    rightLabel: question.right_answer_label ?? '',
    topic: question.question_topic ?? '',
  }
}

/** MySQL utf8mb4 VARCHAR counts code points, as Array.from does (an emoji is 1, not 2). */
function lengthOf(text: string) {
  return Array.from(text).length
}

/** null when the question can be saved. Values are judged trimmed, as they are sent. */
export function questionErrors(draft: DraftQuestion): QuestionErrors | null {
  const errors: QuestionErrors = { answers: {} }
  if (!draft.name.trim()) errors.name = 'required'

  const firstLabelOf = new Map<string, string>()
  for (const { label, content } of draft.answers) {
    const value = content.trim()
    const first = firstLabelOf.get(value)
    if (!value) errors.answers[label] = 'required'
    else if (lengthOf(value) > MAX_ANSWER_LENGTH) errors.answers[label] = 'tooLong'
    else if (first !== undefined) {
      errors.answers[label] = 'duplicate'
      errors.answers[first] ??= 'duplicate'
    } else firstLabelOf.set(value, label)
  }

  if (lengthOf(draft.topic.trim()) > MAX_TOPIC_LENGTH) errors.topic = 'tooLong'
  if (!draft.answers.some(({ label }) => label === draft.rightLabel)) errors.right = 'missing'

  const found = errors.name || errors.topic || errors.right || Object.keys(errors.answers).length > 0
  return found ? errors : null
}

export function isChanged(original: ExamQuestion, draft: DraftQuestion): boolean {
  const before = toDraft(original)
  return (
    before.name !== draft.name ||
    before.topic !== draft.topic ||
    before.rightLabel !== draft.rightLabel ||
    before.answers.some((answer, index) => answer.content !== draft.answers[index]?.content)
  )
}

/**
 * The whole set for /exams/pools/verify, in stored order: edited fields trimmed, everything else
 * (question_number, question_type, question_grade, labels) copied from the stored question.
 */
export function toVerifyQuestions(originals: ExamQuestion[], drafts: DraftQuestion[]): ExamQuestion[] {
  return originals.map((original, index) => {
    const draft = drafts[index] ?? toDraft(original)
    const answers = draft.answers.map(({ label, content }) => ({ label, content: content.trim() }))
    return {
      ...original,
      question_name: draft.name.trim(),
      answers,
      right_answer_label: draft.rightLabel,
      // Derived, never typed: the label and its content cannot disagree (the AI mistake this screen fixes).
      right_answer_content: answers.find(({ label }) => label === draft.rightLabel)?.content ?? '',
      question_topic: draft.topic.trim() || undefined,
    }
  })
}
```

- [ ] **Step 4: Create `scripts/check-exam-pool-draft.ts`**

```ts
// Self-check of the pool editor rules. Run: node scripts/check-exam-pool-draft.ts
// (Node ≥ 23 strips the types; no test runner in this repo.)
import assert from 'node:assert/strict'
import { isChanged, questionErrors, toDraft, toVerifyQuestions } from '../src/features/exams/ExamPoolDraft.ts'

const stored = {
  question_number: 3,
  question_type: 'COUNT',
  question_name: 'Có bao nhiêu quả táo?',
  answers: [
    { label: 'A', content: '3' },
    { label: 'B', content: '4' },
    { label: 'C', content: '6' },
    { label: 'D', content: '5' },
  ],
  right_answer_label: 'C',
  right_answer_content: '6',
  question_topic: 'Đếm',
  question_grade: 3,
}

// An untouched draft is valid and unchanged.
const draft = toDraft(stored)
assert.equal(questionErrors(draft), null)
assert.equal(isChanged(stored, draft), false)

// Fixing the key: right_answer_content follows the chosen label; number, type, grade, labels untouched.
const fixed = { ...draft, rightLabel: 'D', name: '  Có bao nhiêu quả táo? ' }
assert.equal(isChanged(stored, fixed), true)
assert.deepEqual(toVerifyQuestions([stored], [fixed]), [
  { ...stored, question_name: 'Có bao nhiêu quả táo?', right_answer_label: 'D', right_answer_content: '5' },
])

// Blank, duplicate (both sides flagged) and over-long values are judged trimmed.
const broken = {
  name: '   ',
  answers: [
    { label: 'A', content: '7' },
    { label: 'B', content: ' 7 ' },
    { label: 'C', content: '' },
    { label: 'D', content: 'x'.repeat(256) },
  ],
  rightLabel: '',
  topic: 'y'.repeat(65),
}
assert.deepEqual(questionErrors(broken), {
  name: 'required',
  answers: { A: 'duplicate', B: 'duplicate', C: 'required', D: 'tooLong' },
  topic: 'tooLong',
  right: 'missing',
})

// Length counts characters the way MySQL does: 255 emoji fit (510 UTF-16 units).
const emoji = { ...draft, answers: [...draft.answers.slice(0, 3), { label: 'D', content: '🍎'.repeat(255) }] }
assert.equal(questionErrors(emoji), null)

// An empty topic is sent as absent.
assert.equal(toVerifyQuestions([stored], [{ ...draft, topic: '  ' }])[0].question_topic, undefined)

console.log('exam pool draft: ok')
```

- [ ] **Step 5: Run the check**

Run: `node scripts/check-exam-pool-draft.ts`
Expected: `exam pool draft: ok` (Node may also print an experimental-feature notice; that is fine). Any `AssertionError` means `ExamPoolDraft.ts` is wrong — fix it, not the check.

- [ ] **Step 6: Locale — `FRACTION`**

In `src/locales/vi.json`, inside `exams.question.types`, after `"IDENTIFY_SHAPE": "Nhận biết hình"` add `"FRACTION": "Phân số"`.
In `src/locales/en.json`, same path, add `"FRACTION": "Fraction"`.

- [ ] **Step 7: Contract docs**

In `docs/API-CONTRACT.md` §4, replace:

```
- Grade 0–5 (0 = kindergarten); level 0–9 as stated by the app. Question types `ARITHMETIC, COUNT, PICK_BY_ICON,
  IDENTIFY_SHAPE`; text may embed emoji and `[icon:NAME]` tokens.
```

with:

```
- Grade 0–5 (0 = kindergarten); level 0–9 as stated by the app. Question types `ARITHMETIC, COUNT, PICK_BY_ICON,
  IDENTIFY_SHAPE, FRACTION` (LaTeX `\frac{a}{b}` inside `$…$`); text may embed emoji and `[icon:NAME]` tokens.
```

Then insert this subsection immediately before the line `### Curriculum: programs, grades, semesters, schools — ...`:

```markdown
### Exam pool — `internal/application/dto/exam/exam_dto.go`, `internal/application/command/exam/verify_exam_pool_command.go`

The AI-generated question sets (`ma_exam_pools`) that `/exams/generate` hands out and reuses. All routes 🛡️
(`adminOrApiKeyMiddleware`: ADMIN only, else `403`).

| Route | Request | Response |
|---|---|---|
| `/exams/pools/list` 🛡️ | `{ exam_types?, grade?, is_verified?, page, size }` — OFFSET only, newest first | `{ exam_pools: ExamPool[] (no questions), pagination }` |
| `/exams/pools/detail` 🛡️ | `{ exam_id }` | `{ exam_pool }` with `questions` |
| `/exams/pools/mark-verify` 🛡️ | `{ exam_id, is_verify }` — true: `verified_count` 0 → 1 (kept when already > 0); false: → 0 | `{ exam_pool }` with `questions` |
| `/exams/pools/verify` 🛡️ | `{ exam_id, questions }` — the whole corrected set; replaces the stored one, `verified_count` + 1 | `{ exam_pool }` with `questions` |
| `/exams/pools/generate` 🛡️ | `{ exam_type (not PRACTICE), grade, level?, num_questions?, semester?, program? }` | `{ exam_pool }` — not used by the dashboard yet |

`ExamPool`: `{ exam_id, exam_type, grade, level?, num_questions (requested; the set can be shorter), semester?, program?,
req_extras? (cache tag), ai_title?, ai_short_text?, questions? (stored order, answer key included), verified_count
(0 = not verified), status?, create_dt }`.

- `is_verified` is requested from math-svr and not there yet: until it lands the server ignores it.
- `verify` must keep the set's shape: same count, same `question_number`s, same answer labels per question,
  `right_answer_label` one of them, non-empty `question_name` — else `EXAM_POOL_INVALID_QUESTIONS` 13742. Everything
  else is stored as sent: the server does not recompute `right_answer_content` (the admin derives it from the chosen
  answer) and does not check answer contents.
- The new key grades every sitting submitted from then on, including sittings already handed out; submitted sittings
  keep their snapshot. No version check: the last save wins.
- At submit, `question_topic` goes into `VARCHAR(64)` and right/selected answer content into `VARCHAR(255)`
  (`ma_exam_session_lines`), so the editor caps them.
- Codes: `EXAM_NOT_FOUND` 13700, `EXAM_MISSING_EXAM_ID` 13740, `EXAM_MISSING_IS_VERIFY` 13741,
  `EXAM_POOL_INVALID_QUESTIONS` 13742.
```

In §5, after the bullet that ends with `` (`/exams/analytics/progress`, `/exams/journey/progress`, `/exams/grade/*`) have no admin path. `` add:

```markdown
- **Verified pool sets are not preferred.** `/exams/generate` reuses any cached set; `verified_count` (§4 Exam pool)
  does not change which set a child gets.
```

In `CLAUDE.md`, replace `exams/* (journeys → sittings, admin only)` with `exams/* (journeys → sittings, question pool; admin only)`.

- [ ] **Step 8: Build and lint**

Run: `npm run build && npm run lint`
Expected: both succeed with no new warnings.

- [ ] **Step 9: Commit**

```bash
git add src/types/Exam.ts src/features/exams/ExamPoolsApi.ts src/features/exams/ExamPoolDraft.ts scripts/check-exam-pool-draft.ts src/locales/vi.json src/locales/en.json docs/API-CONTRACT.md CLAUDE.md
git commit -m "feat: add exam pool data layer and editor rules

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Sidebar group and the pool list

**Files:**
- Modify: `src/features/dashboard/Sidebar.tsx`
- Modify: `src/app/router.tsx`
- Modify: `src/features/exams/ExamBadges.tsx`
- Create: `src/features/exams/ExamPoolsTable.tsx`
- Create: `src/app/(dashboard)/exams/pools/page.tsx`
- Modify: `src/locales/vi.json`, `src/locales/en.json`

**Interfaces:**
- Consumes (Task 1): `examPoolsListQueryOptions`, `examPoolPath`, `EXAM_TYPES`, `EXAM_GRADES`, `ExamPool`. Existing: `ExamTypeBadge`, `gradeLabel`, `gradeLevelLabel`, `positiveIntParam`, `DataPagination`, `LoadError`, `TitleBar`, `StatusPill`.
- Produces: `VerifiedPill({ count }: { count: number })` in `ExamBadges.tsx`; route `/exams/pools`; locale `exams.pools.{title,description,verified_other,unverified,list.*}`, `nav.examSittings`, `nav.examPools`.

- [ ] **Step 1: Locale keys**

In `src/locales/vi.json`, inside `nav`, after `"exams": "Bài kiểm tra",` add:

```json
    "examSittings": "Bài làm học sinh",
    "examPools": "Kho đề",
```

In `src/locales/vi.json`, inside `exams`, after the `question` object (last key) add:

```json
    "pools": {
      "title": "Kho đề",
      "description": "Bộ đề AI đã sinh và được phát lại cho trẻ. Mở một bộ để soát đáp án, sửa và xác minh.",
      "verified_other": "Đã xác minh · {{count}} lần",
      "unverified": "Chưa xác minh",
      "list": {
        "loadFailed": "Không tải được kho đề",
        "count_other": "{{count}} bộ đề",
        "filterType": "Lọc theo loại",
        "allTypes": "Mọi loại",
        "filterGrade": "Lọc theo lớp",
        "allGrades": "Mọi lớp",
        "filterVerified": "Lọc theo xác minh",
        "verifiedOptions": { "all": "Tất cả", "no": "Chưa xác minh", "yes": "Đã xác minh" },
        "emptyTitle": "Kho đề chưa có bộ đề nào",
        "filterEmptyTitle": "Không có bộ đề nào khớp bộ lọc",
        "clearFilters": "Xoá bộ lọc",
        "open": "Mở đề #{{id}}",
        "columns": {
          "id": "Mã đề",
          "title": "Tên đề",
          "type": "Loại",
          "gradeLevel": "Lớp · Mức",
          "questions": "Số câu",
          "verified": "Xác minh",
          "created": "Ngày tạo"
        }
      }
    }
```

In `src/locales/en.json`, same paths:

```json
    "examSittings": "Student work",
    "examPools": "Exam pool",
```

```json
    "pools": {
      "title": "Exam pool",
      "description": "Question sets the AI generated and hands out again. Open a set to check its answer key, fix it and verify it.",
      "verified_one": "Verified · once",
      "verified_other": "Verified · {{count}} times",
      "unverified": "Not verified",
      "list": {
        "loadFailed": "Could not load the exam pool",
        "count_one": "{{count}} set",
        "count_other": "{{count}} sets",
        "filterType": "Filter by type",
        "allTypes": "All types",
        "filterGrade": "Filter by grade",
        "allGrades": "All grades",
        "filterVerified": "Filter by verification",
        "verifiedOptions": { "all": "All", "no": "Not verified", "yes": "Verified" },
        "emptyTitle": "The pool has no question sets yet",
        "filterEmptyTitle": "No sets match the filters",
        "clearFilters": "Clear filters",
        "open": "Open set #{{id}}",
        "columns": {
          "id": "Set",
          "title": "Title",
          "type": "Type",
          "gradeLevel": "Grade · Level",
          "questions": "Questions",
          "verified": "Verification",
          "created": "Created"
        }
      }
    }
```

- [ ] **Step 2: `VerifiedPill` in `src/features/exams/ExamBadges.tsx`**

Append:

```tsx
/** verified_count: 0 = not verified; every verify (questions re-sent) adds 1. */
export function VerifiedPill({ count }: { count: number }) {
  const { t } = useTranslation()
  return count > 0 ? (
    <StatusPill tone="success">{t('exams.pools.verified', { count })}</StatusPill>
  ) : (
    <StatusPill tone="warning">{t('exams.pools.unverified')}</StatusPill>
  )
}
```

- [ ] **Step 3: Create `src/features/exams/ExamPoolsTable.tsx`**

```tsx
import { ChevronRightIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { ExamPool } from '@/types/Exam'
import { formatServerTime } from '@/utils/Helpers'
import { ExamTypeBadge, VerifiedPill } from './ExamBadges'
import { gradeLevelLabel } from './ExamHelpers'
import { examPoolPath } from './ExamPoolsApi'

/** The pool, newest first; the whole row opens the set. `pools` is undefined while the first page loads. */
export function ExamPoolsTable({ pools }: { pools: ExamPool[] | undefined }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()

  return (
    <Table className="min-w-[980px]">
      <TableHeader className="bg-muted/50">
        <TableRow>
          <TableHead className="w-24 pl-5">{t('exams.pools.list.columns.id')}</TableHead>
          <TableHead>{t('exams.pools.list.columns.title')}</TableHead>
          <TableHead className="w-40">{t('exams.pools.list.columns.type')}</TableHead>
          <TableHead className="w-36">{t('exams.pools.list.columns.gradeLevel')}</TableHead>
          <TableHead className="w-24">{t('exams.pools.list.columns.questions')}</TableHead>
          <TableHead className="w-44">{t('exams.pools.list.columns.verified')}</TableHead>
          <TableHead className="w-40">{t('exams.pools.list.columns.created')}</TableHead>
          <TableHead className="w-10 pr-5" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {pools
          ? pools.map((pool) => {
              const path = examPoolPath(pool.exam_id)
              return (
                <TableRow key={pool.exam_id} className="cursor-pointer" onClick={() => void navigate(path)}>
                  <TableCell className="pl-5">
                    <Link
                      to={path}
                      onClick={(event) => event.stopPropagation()}
                      aria-label={t('exams.pools.list.open', { id: pool.exam_id })}
                      className="font-mono text-[13px] font-semibold text-primary underline-offset-4 hover:underline"
                    >
                      #{pool.exam_id}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-96">
                    <div className="flex flex-col gap-0.5">
                      <span className="truncate font-semibold">{pool.ai_title || '—'}</span>
                      {pool.ai_short_text && (
                        <span className="truncate text-[13px] text-muted-foreground">{pool.ai_short_text}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <ExamTypeBadge type={pool.exam_type} />
                  </TableCell>
                  <TableCell className="text-sm">{gradeLevelLabel(t, pool.grade, pool.level)}</TableCell>
                  <TableCell className="text-sm">{pool.num_questions}</TableCell>
                  <TableCell>
                    <VerifiedPill count={pool.verified_count} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatServerTime(pool.create_dt, i18n.language)}
                  </TableCell>
                  <TableCell className="pr-5 text-muted-foreground">
                    <ChevronRightIcon className="size-4" aria-hidden />
                  </TableCell>
                </TableRow>
              )
            })
          : Array.from({ length: 5 }, (_, index) => (
              <TableRow key={index} aria-hidden>
                <TableCell className="pl-5">
                  <Skeleton className="h-3 w-14" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-3 w-56" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-28 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-3 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-3 w-8" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-28 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-3 w-28" />
                </TableCell>
                <TableCell className="pr-5" />
              </TableRow>
            ))}
      </TableBody>
    </Table>
  )
}
```

- [ ] **Step 4: Create `src/app/(dashboard)/exams/pools/page.tsx`**

```tsx
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { DataPagination } from '@/components/DataPagination'
import { LoadError } from '@/components/LoadError'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TitleBar } from '@/features/dashboard/TitleBar'
import { gradeLabel, positiveIntParam } from '@/features/exams/ExamHelpers'
import { examPoolsListQueryOptions } from '@/features/exams/ExamPoolsApi'
import { ExamPoolsTable } from '@/features/exams/ExamPoolsTable'
import { EXAM_GRADES, EXAM_TYPES } from '@/types/Exam'
import { cn } from '@/utils/Helpers'

const PAGE_SIZE = 20
const ALL = 'all'
const VERIFIED_OPTIONS = ['no', 'yes'] as const

/** The AI question sets in the pool, newest first. */
export default function ExamPoolsPage() {
  const { t } = useTranslation()

  // Filters and page live in the URL so Back from a set returns to the same list.
  const [params, setParams] = useSearchParams()
  const page = positiveIntParam(params.get('page')) ?? 1
  const type = EXAM_TYPES.find((option) => option === params.get('type')) ?? null
  const grade = EXAM_GRADES.find((option) => String(option) === params.get('grade')) ?? null
  const verified = VERIFIED_OPTIONS.find((option) => option === params.get('verified')) ?? null

  const list = useQuery(
    examPoolsListQueryOptions({
      exam_types: type ? [type] : undefined,
      grade: grade ?? undefined,
      is_verified: verified === null ? undefined : verified === 'yes',
      page,
      size: PAGE_SIZE,
    }),
  )

  /** Sets (or with null, removes) URL params; any filter change goes back to page 1. */
  function update(changes: Record<string, string | null>) {
    setParams((current) => {
      const updated = new URLSearchParams(current)
      if (!('page' in changes)) updated.set('page', '1')
      for (const [key, value] of Object.entries(changes)) {
        if (value) updated.set(key, value)
        else updated.delete(key)
      }
      return updated
    })
  }

  const pagination = list.data?.pagination
  const rows = list.data?.pools
  const totalPages = pagination?.total_pages ?? 0

  // The server does not clamp: past the last page (an old link), show the last real page.
  useEffect(() => {
    if (totalPages > 0 && page > totalPages) {
      setParams(
        (current) => {
          const updated = new URLSearchParams(current)
          updated.set('page', String(totalPages))
          return updated
        },
        { replace: true },
      )
    }
  }, [page, totalPages, setParams])

  const filtered = type !== null || grade !== null || verified !== null
  const first = pagination ? pagination.skip + 1 : 0
  const last = pagination ? pagination.skip + (rows?.length ?? 0) : 0

  return (
    <>
      <TitleBar title={t('exams.pools.title')} description={t('exams.pools.description')} />

      {list.isError && !list.data ? (
        <LoadError
          title={t('exams.pools.list.loadFailed')}
          error={list.error}
          onRetry={() => void list.refetch()}
          retrying={list.isFetching}
        />
      ) : (
        <section aria-label={t('exams.pools.title')} className="overflow-hidden rounded-2xl border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
            <strong className="font-semibold" aria-live="polite">
              {pagination ? t('exams.pools.list.count', { count: pagination.total_count }) : ' '}
            </strong>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={type ?? ALL} onValueChange={(value) => update({ type: value === ALL ? null : value })}>
                <SelectTrigger size="sm" aria-label={t('exams.pools.list.filterType')} className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t('exams.pools.list.allTypes')}</SelectItem>
                  {EXAM_TYPES.map((option) => (
                    <SelectItem key={option} value={option}>
                      {t(`exams.types.${option}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={grade === null ? ALL : String(grade)}
                onValueChange={(value) => update({ grade: value === ALL ? null : value })}
              >
                <SelectTrigger size="sm" aria-label={t('exams.pools.list.filterGrade')} className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t('exams.pools.list.allGrades')}</SelectItem>
                  {EXAM_GRADES.map((option) => (
                    <SelectItem key={option} value={String(option)}>
                      {gradeLabel(t, option)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={verified ?? ALL}
                onValueChange={(value) => update({ verified: value === ALL ? null : value })}
              >
                <SelectTrigger size="sm" aria-label={t('exams.pools.list.filterVerified')} className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t('exams.pools.list.verifiedOptions.all')}</SelectItem>
                  {VERIFIED_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {t(`exams.pools.list.verifiedOptions.${option}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {rows && rows.length === 0 && page <= 1 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <img src={`${import.meta.env.BASE_URL}assets/images/numi-thinking.png`} alt="" className="size-30 object-contain" />
              <strong className="text-[17px] font-semibold">
                {t(filtered ? 'exams.pools.list.filterEmptyTitle' : 'exams.pools.list.emptyTitle')}
              </strong>
              {filtered && (
                <Button variant="outline" onClick={() => update({ type: null, grade: null, verified: null })}>
                  {t('exams.pools.list.clearFilters')}
                </Button>
              )}
            </div>
          ) : (
            <div
              className={cn('overflow-x-auto transition-opacity', list.isPlaceholderData && 'opacity-60')}
              aria-busy={list.isFetching}
            >
              <ExamPoolsTable pools={rows} />
            </div>
          )}

          {pagination && totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3.5">
              <span className="text-sm text-muted-foreground">
                {t('pagination.range', { first, last, total: pagination.total_count })}
              </span>
              <DataPagination
                page={pagination.page}
                totalPages={totalPages}
                onPageChange={(p) => update({ page: String(p) })}
              />
            </div>
          )}
        </section>
      )}
    </>
  )
}
```

- [ ] **Step 5: Route**

In `src/app/router.tsx`, add the import next to the other exam pages:

```tsx
import ExamPoolsPage from './(dashboard)/exams/pools/page'
```

In the `/exams` route, change the comment and add a `pools` child after `sitting`:

```tsx
      {
        // Admin-only exam screens: a child's work (list → journey → sitting) and the question pool.
        path: '/exams',
        handle: { titleKey: 'nav.exams' } satisfies RouteHandle,
        children: [
          { index: true, Component: ExamsPage },
          { path: 'journey', Component: JourneyPage, handle: { titleKey: 'exams.journey.title' } satisfies RouteHandle },
          { path: 'sitting', Component: SittingPage, handle: { titleKey: 'exams.sitting.title' } satisfies RouteHandle },
          {
            path: 'pools',
            handle: { titleKey: 'nav.examPools' } satisfies RouteHandle,
            children: [{ index: true, Component: ExamPoolsPage }],
          },
        ],
      },
```

- [ ] **Step 6: Sidebar group**

In `src/features/dashboard/Sidebar.tsx`:

1. Add `ArchiveIcon` and `ClipboardListIcon` to the `lucide-react` import (keep it alphabetical), and add `Link` to the `react-router` import: `import { Link, NavLink, useLocation } from 'react-router'`.
2. Extend `NavItem`:

```tsx
type NavItem = {
  to: string
  labelKey: TranslationKey
  icon: LucideIcon
  /** Custom match when the default prefix match is wrong (a parent path of another item). */
  isActive?: (pathname: string) => boolean
}
```

3. Replace

```tsx
/** Admins only: math-svr answers 403 to anyone else. */
const examsItem: NavItem = { to: '/exams', labelKey: 'nav.exams', icon: ClipboardCheckIcon }
```

with

```tsx
/** Admins only: math-svr answers 403 to anyone else. */
const examItems: NavItem[] = [
  {
    to: '/exams',
    labelKey: 'nav.examSittings',
    icon: ClipboardListIcon,
    // A child's work lives at /exams, /exams/journey, /exams/sitting — not the pool.
    isActive: (pathname) => pathname.startsWith('/exams') && !pathname.startsWith('/exams/pools'),
  },
  { to: '/exams/pools', labelKey: 'nav.examPools', icon: ArchiveIcon },
]
```

4. In `Sidebar()`, replace

```tsx
  // Exams and the system group are admin-only: math-svr refuses everyone else with 403.
  const isAdmin = useSessionUser().role === 'ADMIN'
  const topItems = isAdmin ? [...navItems, examsItem] : navItems
```

with

```tsx
  // The exams and system groups are admin-only: math-svr refuses everyone else with 403.
  const isAdmin = useSessionUser().role === 'ADMIN'
```

change `{topItems.map(` to `{navItems.map(`, and insert right after that map, before the curriculum `NavGroup`:

```tsx
        {isAdmin && (
          <NavGroup
            id="nav-exams"
            basePath="/exams"
            labelKey="nav.exams"
            icon={ClipboardCheckIcon}
            items={examItems}
          />
        )}
```

5. In `NavGroup`, replace

```tsx
  const inGroup = useLocation().pathname.startsWith(basePath)
```

with

```tsx
  const { pathname } = useLocation()
  const inGroup = pathname.startsWith(basePath)
```

and replace the items map

```tsx
          {items.map(({ to, labelKey: itemLabelKey, icon: ItemIcon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => cn(linkBase, 'h-10 text-sm', isActive ? linkActive : linkIdle)}
            >
              <ItemIcon className="size-4" aria-hidden />
              {t(itemLabelKey)}
            </NavLink>
          ))}
```

with

```tsx
          {items.map(({ to, labelKey: itemLabelKey, icon: ItemIcon, isActive: matches }) => {
            const linkClass = (active: boolean) => cn(linkBase, 'h-10 text-sm', active ? linkActive : linkIdle)
            const body = (
              <>
                <ItemIcon className="size-4" aria-hidden />
                {t(itemLabelKey)}
              </>
            )
            if (!matches) {
              return (
                <NavLink key={to} to={to} className={({ isActive }) => linkClass(isActive)}>
                  {body}
                </NavLink>
              )
            }
            // NavLink would also mark /exams active on /exams/pools (prefix match).
            const active = matches(pathname)
            return (
              <Link key={to} to={to} aria-current={active ? 'page' : undefined} className={linkClass(active)}>
                {body}
              </Link>
            )
          })}
```

- [ ] **Step 7: Build and lint**

Run: `npm run build && npm run lint`
Expected: both succeed.

- [ ] **Step 8: Commit**

```bash
git add src/features/dashboard/Sidebar.tsx src/app/router.tsx src/features/exams/ExamBadges.tsx src/features/exams/ExamPoolsTable.tsx "src/app/(dashboard)/exams/pools/page.tsx" src/locales/vi.json src/locales/en.json
git commit -m "feat: add exam pool list and exams sidebar group

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Pool set detail — view, mark and unmark

**Files:**
- Create: `src/features/exams/RichText.tsx`
- Modify: `src/features/exams/QuestionCard.tsx`
- Modify: `src/features/exams/ExamHelpers.ts`
- Modify: `src/features/exams/ExamNav.tsx`
- Create: `src/app/(dashboard)/exams/pools/detail/page.tsx`
- Modify: `src/app/router.tsx`
- Modify: `src/locales/vi.json`, `src/locales/en.json`

**Interfaces:**
- Consumes (Tasks 1–2): `examPoolDetailQueryOptions`, `markExamPoolVerify`, `storeExamPool`, `EXAM_POOLS_PATH`, `VerifiedPill`, `ExamPool`, `ExamQuestion`. Existing: `ConfirmActionDialog` (`src/features/system/ConfirmActionDialog.tsx`: props `open, onClose, title, description, confirmLabel, pendingLabel, pending, error, onConfirm`), `MetaRow`, `BackLink`, `LoadError`, `TitleBar`, `ExamTypeBadge`.
- Produces: `RichText({ text }: { text: string })`; `QuestionOutcome` gains `'key'`; `poolQuestion(q: ExamQuestion): SittingQuestion`; `InvalidLink({ message, to?, label? })`; route `/exams/pools/detail`; locale `exams.pools.detail.*`.

- [ ] **Step 1: Locale keys**

In `src/locales/vi.json`, inside `exams.pools` (after `list`), add:

```json
      "detail": {
        "title": "Chi tiết đề",
        "heading": "Đề #{{id}}",
        "missing": "Đường dẫn thiếu hoặc sai mã đề.",
        "loadFailed": "Không tải được bộ đề",
        "backToPools": "Về Kho đề",
        "meta": {
          "gradeLevel": "Lớp · Mức",
          "questions": "Số câu",
          "questionsValue": "{{actual}} / {{requested}} yêu cầu",
          "semester": "Học kỳ",
          "program": "Chương trình",
          "verifiedCount": "Lần xác minh",
          "created": "Ngày tạo",
          "cacheTag": "Cache tag"
        },
        "storedOrder": "Thứ tự câu và nhãn A–D là bản gốc trong kho, chưa xáo.",
        "empty": "Bộ đề này không có câu hỏi nào.",
        "mark": "Đánh dấu đã xác minh",
        "marked": "Đã đánh dấu đề #{{id}} là đã xác minh",
        "unmark": "Bỏ xác minh",
        "unmarking": "Đang bỏ xác minh…",
        "unmarked": "Đã bỏ xác minh đề #{{id}}",
        "unmarkTitle": "Bỏ xác minh đề #{{id}}?",
        "unmarkDescription": "Số lần xác minh (hiện {{n}}) sẽ về 0. Nội dung câu hỏi giữ nguyên."
      }
```

In `src/locales/en.json`, same path:

```json
      "detail": {
        "title": "Set detail",
        "heading": "Set #{{id}}",
        "missing": "The link is missing a set id or has a wrong one.",
        "loadFailed": "Could not load the question set",
        "backToPools": "Back to the exam pool",
        "meta": {
          "gradeLevel": "Grade · Level",
          "questions": "Questions",
          "questionsValue": "{{actual}} / {{requested}} requested",
          "semester": "Semester",
          "program": "Program",
          "verifiedCount": "Verifications",
          "created": "Created",
          "cacheTag": "Cache tag"
        },
        "storedOrder": "Question order and A–D labels are the stored originals, not shuffled.",
        "empty": "This set has no questions.",
        "mark": "Mark as verified",
        "marked": "Set #{{id}} marked as verified",
        "unmark": "Remove verification",
        "unmarking": "Removing…",
        "unmarked": "Verification removed from set #{{id}}",
        "unmarkTitle": "Remove verification from set #{{id}}?",
        "unmarkDescription": "The verification count (now {{n}}) goes back to 0. The questions stay as they are."
      }
```

- [ ] **Step 2: Create `src/features/exams/RichText.tsx`** (moved out of `QuestionCard`, which keeps only components)

```tsx
import { ShapesIcon } from 'lucide-react'

/** Question text: emoji render as text; [icon:NAME] tokens (drawn by the app) become a chip with the icon name. */
export function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\[icon:[^\]]+\])/).map((part, index) => {
        const icon = part.match(/^\[icon:([^\]]+)\]$/)
        if (!icon) return part
        return (
          <span
            key={index}
            className="mx-0.5 inline-flex items-center gap-1 rounded-md bg-info-surface px-1.5 align-middle font-mono text-[13px] text-info"
          >
            <ShapesIcon className="size-3.5" aria-hidden />
            {icon[1]}
          </span>
        )
      })}
    </>
  )
}
```

- [ ] **Step 3: Outcome `key` and `poolQuestion` in `src/features/exams/ExamHelpers.ts`**

Add `ExamQuestion` to the `@/types/Exam` type import. Replace

```ts
/** `unanswered` = the sitting is not submitted, so nothing can be marked. */
export type QuestionOutcome = 'correct' | 'wrong' | 'skipped' | 'unanswered'
```

with

```ts
/** `unanswered` = the sitting is not submitted, so nothing can be marked; `key` = a pool question (answer key only). */
export type QuestionOutcome = 'correct' | 'wrong' | 'skipped' | 'unanswered' | 'key'
```

Append at the end of the file:

```ts
/** A pool question for QuestionCard: the answer key, no child's pick. */
export function poolQuestion(question: ExamQuestion): SittingQuestion {
  return {
    number: question.question_number,
    type: question.question_type,
    name: question.question_name,
    topic: question.question_topic,
    grade: question.question_grade,
    answers: question.answers ?? [],
    rightLabel: question.right_answer_label,
    rightContent: question.right_answer_content,
    outcome: 'key',
  }
}
```

- [ ] **Step 4: `src/features/exams/QuestionCard.tsx`**

1. Remove the `ShapesIcon` and `ReactNode` imports and the whole `renderRichText` function at the bottom; add `import { RichText } from './RichText'`.
2. Replace `{renderRichText(question.name)}` with `<RichText text={question.name} />` and `{renderRichText(answer.content)}` with `<RichText text={answer.content} />`.
3. Replace the two maps at the top:

```tsx
const outcomeBorder: Record<QuestionOutcome, string> = {
  correct: 'border-l-success',
  wrong: 'border-l-destructive',
  skipped: 'border-l-warning',
  unanswered: 'border-l-border',
  key: 'border-l-border',
}

const outcomeTone: Record<Exclude<QuestionOutcome, 'unanswered' | 'key'>, PillTone> = {
  correct: 'success',
  wrong: 'danger',
  skipped: 'warning',
}
```

4. Replace the result-pill condition

```tsx
        {question.outcome !== 'unanswered' && (
```

with

```tsx
        {question.outcome !== 'unanswered' && question.outcome !== 'key' && (
```

5. Update the component doc comment to: `/** One question as the child saw it (right answer and pick marked once submitted), or a pool question with its key. */`

`marked` stays `question.outcome !== 'unanswered'`, so a `key` question shows the right option green with "Đáp án đúng" and no pick.

- [ ] **Step 5: `InvalidLink` target in `src/features/exams/ExamNav.tsx`**

Replace the `InvalidLink` function with:

```tsx
/** A detail page reached with missing or malformed ids; the button goes to `to` (default: the exams list). */
export function InvalidLink({ message, to = '/exams', label }: { message: string; to?: string; label?: string }) {
  const { t } = useTranslation()
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border bg-card px-6 py-12 text-center">
      <img src={`${import.meta.env.BASE_URL}assets/images/numi-thinking.png`} alt="" className="size-30 object-contain" />
      <span className="max-w-md text-muted-foreground">{message}</span>
      <Button asChild variant="outline">
        <Link to={to}>{label ?? t('exams.backToExams')}</Link>
      </Button>
    </div>
  )
}
```

- [ ] **Step 6: Create `src/app/(dashboard)/exams/pools/detail/page.tsx`**

```tsx
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { LoadError } from '@/components/LoadError'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { TitleBar } from '@/features/dashboard/TitleBar'
import { ExamTypeBadge, VerifiedPill } from '@/features/exams/ExamBadges'
import { gradeLevelLabel, poolQuestion, positiveIntParam } from '@/features/exams/ExamHelpers'
import { BackLink, InvalidLink } from '@/features/exams/ExamNav'
import {
  EXAM_POOLS_PATH,
  examPoolDetailQueryOptions,
  markExamPoolVerify,
  storeExamPool,
} from '@/features/exams/ExamPoolsApi'
import { QuestionCard } from '@/features/exams/QuestionCard'
import { MetaRow } from '@/features/exams/StatTiles'
import { ConfirmActionDialog } from '@/features/system/ConfirmActionDialog'
import { formatServerTime } from '@/utils/Helpers'

/** One pool set with its answer key; mark or unmark it verified. */
export default function ExamPoolDetailPage() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const [params] = useSearchParams()
  const examId = positiveIntParam(params.get('exam'))
  const detail = useQuery({ ...examPoolDetailQueryOptions(examId ?? 0), enabled: examId !== null })
  const [unmarkOpen, setUnmarkOpen] = useState(false)

  const mark = useMutation({
    mutationFn: (id: number) => markExamPoolVerify(id, true),
    onSuccess: (pool) => {
      storeExamPool(queryClient, pool)
      toast.success(t('exams.pools.detail.marked', { id: pool.exam_id }))
    },
  })
  // Silent: the confirm dialog shows its own error.
  const unmark = useMutation({
    mutationFn: (id: number) => markExamPoolVerify(id, false),
    meta: { silentError: true },
    onSuccess: (pool) => {
      storeExamPool(queryClient, pool)
      setUnmarkOpen(false)
      toast.success(t('exams.pools.detail.unmarked', { id: pool.exam_id }))
    },
  })

  if (examId === null) {
    return (
      <InvalidLink
        message={t('exams.pools.detail.missing')}
        to={EXAM_POOLS_PATH}
        label={t('exams.pools.detail.backToPools')}
      />
    )
  }

  const pool = detail.data
  let content: ReactNode
  if (detail.isError && !pool) {
    content = (
      <div className="flex flex-col gap-3">
        <LoadError
          title={t('exams.pools.detail.loadFailed')}
          error={detail.error}
          onRetry={() => void detail.refetch()}
          retrying={detail.isFetching}
        />
        <Button asChild variant="outline" className="self-start">
          <Link to={EXAM_POOLS_PATH}>{t('exams.pools.detail.backToPools')}</Link>
        </Button>
      </div>
    )
  } else if (!pool) {
    content = (
      <div className="flex flex-col gap-4" aria-busy>
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    )
  } else {
    const questions = pool.questions ?? []
    content = (
      <>
        <MetaRow
          items={[
            { label: t('exams.pools.detail.meta.gradeLevel'), value: gradeLevelLabel(t, pool.grade, pool.level) },
            {
              label: t('exams.pools.detail.meta.questions'),
              value: t('exams.pools.detail.meta.questionsValue', {
                actual: questions.length,
                requested: pool.num_questions,
              }),
            },
            { label: t('exams.pools.detail.meta.semester'), value: pool.semester || '—' },
            { label: t('exams.pools.detail.meta.program'), value: pool.program || '—' },
            { label: t('exams.pools.detail.meta.verifiedCount'), value: pool.verified_count },
            { label: t('exams.pools.detail.meta.created'), value: formatServerTime(pool.create_dt, i18n.language) },
            {
              label: t('exams.pools.detail.meta.cacheTag'),
              value: pool.req_extras ? <span className="font-mono text-[13px]">{pool.req_extras}</span> : '—',
            },
          ]}
        />
        {questions.length === 0 ? (
          <p className="rounded-2xl border bg-card px-5 py-8 text-center text-muted-foreground">
            {t('exams.pools.detail.empty')}
          </p>
        ) : (
          <>
            <span className="text-xs text-muted-foreground">{t('exams.pools.detail.storedOrder')}</span>
            <div className="flex flex-col gap-3">
              {questions.map((question) => (
                <QuestionCard key={question.question_number} question={poolQuestion(question)} sittingGrade={pool.grade} />
              ))}
            </div>
          </>
        )}
      </>
    )
  }

  const actions = pool && (
    <div className="flex flex-wrap gap-2">
      {pool.verified_count > 0 ? (
        <Button variant="outline" className="h-11 rounded-xl px-4.5" onClick={() => setUnmarkOpen(true)}>
          {t('exams.pools.detail.unmark')}
        </Button>
      ) : (
        <Button
          variant="outline"
          className="h-11 rounded-xl px-4.5"
          disabled={mark.isPending}
          onClick={() => mark.mutate(pool.exam_id)}
        >
          <CheckIcon aria-hidden />
          {mark.isPending ? t('common.saving') : t('exams.pools.detail.mark')}
        </Button>
      )}
    </div>
  )

  return (
    <>
      <BackLink to={EXAM_POOLS_PATH}>{t('exams.pools.detail.backToPools')}</BackLink>
      <TitleBar
        title={t('exams.pools.detail.heading', { id: examId })}
        description={
          pool && (
            <span className="flex flex-wrap items-center gap-2">
              <ExamTypeBadge type={pool.exam_type} />
              <VerifiedPill count={pool.verified_count} />
              {(pool.ai_title || pool.ai_short_text) && (
                <span>{[pool.ai_title, pool.ai_short_text].filter(Boolean).join(' — ')}</span>
              )}
            </span>
          )
        }
        actions={actions}
      />
      {content}
      {pool && (
        <ConfirmActionDialog
          open={unmarkOpen}
          onClose={() => {
            setUnmarkOpen(false)
            unmark.reset()
          }}
          title={t('exams.pools.detail.unmarkTitle', { id: pool.exam_id })}
          description={t('exams.pools.detail.unmarkDescription', { n: pool.verified_count })}
          confirmLabel={t('exams.pools.detail.unmark')}
          pendingLabel={t('exams.pools.detail.unmarking')}
          pending={unmark.isPending}
          error={unmark.error}
          onConfirm={() => unmark.mutate(pool.exam_id)}
        />
      )}
    </>
  )
}
```

- [ ] **Step 7: Route**

In `src/app/router.tsx`, add `import ExamPoolDetailPage from './(dashboard)/exams/pools/detail/page'` and extend the `pools` children:

```tsx
            children: [
              { index: true, Component: ExamPoolsPage },
              {
                path: 'detail',
                Component: ExamPoolDetailPage,
                handle: { titleKey: 'exams.pools.detail.title' } satisfies RouteHandle,
              },
            ],
```

- [ ] **Step 8: Build and lint**

Run: `npm run build && npm run lint`
Expected: both succeed. The sitting page still renders `RichText` through `QuestionCard` (no other caller of `renderRichText` existed — confirm with `grep -rn renderRichText src`, expected no output).

- [ ] **Step 9: Commit**

```bash
git add src/features/exams/RichText.tsx src/features/exams/QuestionCard.tsx src/features/exams/ExamHelpers.ts src/features/exams/ExamNav.tsx "src/app/(dashboard)/exams/pools/detail/page.tsx" src/app/router.tsx src/locales/vi.json src/locales/en.json
git commit -m "feat: add exam pool set detail with verify marking

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Edit mode — fix questions and verify

**Files:**
- Create: `src/features/exams/PoolQuestionEditor.tsx`
- Modify (full replacement below): `src/app/(dashboard)/exams/pools/detail/page.tsx`
- Modify: `src/locales/vi.json`, `src/locales/en.json`

**Interfaces:**
- Consumes (Tasks 1–3): `DraftQuestion`, `QuestionErrors`, `AnswerError`, `toDraft`, `questionErrors`, `isChanged`, `toVerifyQuestions`, `MAX_ANSWER_LENGTH`, `MAX_TOPIC_LENGTH`, `verifyExamPool`, `storeExamPool`, `RichText`, `gradeLabel`, everything Task 3's page uses. Existing UI: `Textarea`, `Input`, `Label`, `RadioGroup`/`RadioGroupItem`, `Tooltip`/`TooltipTrigger`/`TooltipContent` (provider is in `App.tsx`), `StatusPill`. React Router `useBlocker` (data router: `createBrowserRouter`).
- Produces: `PoolQuestionEditor(props)`; locale `exams.pools.detail.{edit,editBlocked}`, `exams.pools.edit.*`.

- [ ] **Step 1: Locale keys**

In `src/locales/vi.json`, inside `exams.pools.detail` add:

```json
        "edit": "Sửa đề",
        "editBlocked": "Bộ đề không có câu hỏi hoặc có câu không có phương án, nên không sửa được."
```

and inside `exams.pools` (after `detail`) add:

```json
      "edit": {
        "bar": "Đang sửa đề #{{id}}",
        "changed_other": "{{count}} câu đã sửa",
        "errorCount_other": "{{count}} câu có lỗi",
        "save": "Lưu & xác minh",
        "saving": "Đang lưu…",
        "saved": "Đã lưu và xác minh đề #{{id}}",
        "banner": "Chỉ sửa được nội dung: đề bài, nội dung các đáp án, đáp án đúng và chủ đề. Số câu, thứ tự và nhãn A–D giữ nguyên.",
        "changedPill": "Đã sửa",
        "name": "Đề bài",
        "preview": "Xem trước:",
        "answers": "Đáp án — chọn nút tròn ở đáp án đúng",
        "answer": "Nội dung đáp án {{label}}",
        "rightAnswer": "Chọn {{label}} là đáp án đúng",
        "topic": "Chủ đề",
        "errors": {
          "nameRequired": "Nhập đề bài.",
          "answer": {
            "required": "Đáp án {{label}} đang trống.",
            "tooLong": "Đáp án {{label}} dài quá {{max}} ký tự.",
            "duplicate": "Đáp án {{label}} trùng nội dung với đáp án khác."
          },
          "topicTooLong": "Chủ đề dài quá {{max}} ký tự.",
          "rightMissing": "Chọn đáp án đúng."
        },
        "confirmTitle": "Lưu bản sửa và xác minh đề #{{id}}?",
        "confirmChanged": "Câu thay đổi: {{list}}.",
        "confirmLive": "Đáp án mới áp dụng cho cả các lượt đang làm dở khi trẻ nộp bài.",
        "confirmHistory": "Bài đã nộp giữ nguyên điểm và câu hỏi cũ.",
        "confirmCount": "Lần xác minh: {{from}} → {{to}}.",
        "discardTitle": "Bỏ các thay đổi?",
        "discardDescription": "Các câu đã sửa sẽ quay về như trong kho.",
        "discard": "Bỏ thay đổi",
        "leaveTitle": "Rời trang khi chưa lưu?",
        "leaveDescription": "Các thay đổi trong đề #{{id}} sẽ mất.",
        "leave": "Rời trang"
      }
```

In `src/locales/en.json`, same paths:

```json
        "edit": "Edit set",
        "editBlocked": "This set has no questions, or a question has no options, so it cannot be edited."
```

```json
      "edit": {
        "bar": "Editing set #{{id}}",
        "changed_one": "{{count}} question changed",
        "changed_other": "{{count}} questions changed",
        "errorCount_one": "{{count}} question with errors",
        "errorCount_other": "{{count}} questions with errors",
        "save": "Save & verify",
        "saving": "Saving…",
        "saved": "Set #{{id}} saved and verified",
        "banner": "Only content can change: question text, option contents, the right answer and the topic. Question count, order and A–D labels stay as they are.",
        "changedPill": "Changed",
        "name": "Question",
        "preview": "Preview:",
        "answers": "Options — pick the right one with the radio button",
        "answer": "Option {{label}} content",
        "rightAnswer": "Make {{label}} the right answer",
        "topic": "Topic",
        "errors": {
          "nameRequired": "Enter the question text.",
          "answer": {
            "required": "Option {{label}} is empty.",
            "tooLong": "Option {{label}} is longer than {{max}} characters.",
            "duplicate": "Option {{label}} has the same content as another option."
          },
          "topicTooLong": "The topic is longer than {{max}} characters.",
          "rightMissing": "Pick the right answer."
        },
        "confirmTitle": "Save the changes and verify set #{{id}}?",
        "confirmChanged": "Changed: {{list}}.",
        "confirmLive": "The new key also grades sittings still in progress when the child submits.",
        "confirmHistory": "Submitted sittings keep their score and their old questions.",
        "confirmCount": "Verifications: {{from}} → {{to}}.",
        "discardTitle": "Discard your changes?",
        "discardDescription": "The edited questions go back to the stored version.",
        "discard": "Discard changes",
        "leaveTitle": "Leave without saving?",
        "leaveDescription": "Your changes to set #{{id}} will be lost.",
        "leave": "Leave"
      }
```

- [ ] **Step 2: Create `src/features/exams/PoolQuestionEditor.tsx`**

```tsx
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { StatusPill } from '@/components/StatusPill'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import type { ExamQuestion } from '@/types/Exam'
import { QUESTION_TYPES } from '@/types/Exam'
import { cn } from '@/utils/Helpers'
import { gradeLabel } from './ExamHelpers'
import type { DraftQuestion, QuestionErrors } from './ExamPoolDraft'
import { MAX_ANSWER_LENGTH, MAX_TOPIC_LENGTH } from './ExamPoolDraft'
import { RichText } from './RichText'

type PoolQuestionEditorProps = {
  /** The stored question: its number, type and grade are shown, never edited. */
  question: ExamQuestion
  draft: DraftQuestion
  errors: QuestionErrors | null
  changed: boolean
  /** The set's grade, to mark probe questions. */
  poolGrade: number
  onChange: (draft: DraftQuestion) => void
}

/** One pool question as a form: text, option contents, the right option, topic. Labels never change. */
export function PoolQuestionEditor({ question, draft, errors, changed, poolGrade, onChange }: PoolQuestionEditorProps) {
  const { t } = useTranslation()
  const id = useId()
  const type = QUESTION_TYPES.find((option) => option === question.question_type)
  const grade = question.question_grade
  const answerErrors = draft.answers.flatMap(({ label }) => {
    const error = errors?.answers[label]
    return error ? [{ label, error }] : []
  })

  return (
    <article
      className={cn(
        'overflow-hidden rounded-2xl border border-l-4 bg-card',
        errors ? 'border-l-destructive' : changed ? 'border-l-info' : 'border-l-border',
      )}
    >
      <header className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-5 py-3">
        <h2 className="mr-1 font-bold">{t('exams.question.number', { number: question.question_number })}</h2>
        {changed && <StatusPill tone="info">{t('exams.pools.edit.changedPill')}</StatusPill>}
        {type && <StatusPill tone="neutral">{t(`exams.question.types.${type}`)}</StatusPill>}
        {grade !== undefined &&
          (grade > poolGrade ? (
            <StatusPill tone="info">{t('exams.question.probe', { grade: gradeLabel(t, grade) })}</StatusPill>
          ) : (
            <StatusPill tone="neutral">{gradeLabel(t, grade)}</StatusPill>
          ))}
      </header>

      <div className="flex flex-col gap-4 px-5 py-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-name`}>{t('exams.pools.edit.name')}</Label>
          <Textarea
            id={`${id}-name`}
            value={draft.name}
            aria-invalid={errors?.name ? true : undefined}
            aria-describedby={`${id}-name-note`}
            onChange={(event) => onChange({ ...draft, name: event.target.value })}
            className="min-h-16 text-base"
          />
          {errors?.name ? (
            <p id={`${id}-name-note`} className="text-sm font-semibold text-destructive">
              {t('exams.pools.edit.errors.nameRequired')}
            </p>
          ) : (
            <p id={`${id}-name-note`} className="text-sm text-muted-foreground">
              {t('exams.pools.edit.preview')} <RichText text={draft.name} />
            </p>
          )}
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend id={`${id}-answers`} className="mb-1.5 text-sm font-medium">
            {t('exams.pools.edit.answers')}
          </legend>
          <RadioGroup
            aria-labelledby={`${id}-answers`}
            value={draft.rightLabel}
            onValueChange={(rightLabel) => onChange({ ...draft, rightLabel })}
            className="grid gap-2.5 sm:grid-cols-2"
          >
            {draft.answers.map((answer, index) => (
              <div key={answer.label} className="flex items-center gap-2.5">
                <RadioGroupItem
                  value={answer.label}
                  aria-label={t('exams.pools.edit.rightAnswer', { label: answer.label })}
                />
                <span
                  aria-hidden
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-full bg-muted font-bold',
                    answer.label === draft.rightLabel && 'bg-success text-primary-foreground',
                  )}
                >
                  {answer.label}
                </span>
                <Input
                  value={answer.content}
                  aria-label={t('exams.pools.edit.answer', { label: answer.label })}
                  aria-invalid={errors?.answers[answer.label] ? true : undefined}
                  onChange={(event) =>
                    onChange({
                      ...draft,
                      answers: draft.answers.map((item, i) =>
                        i === index ? { ...item, content: event.target.value } : item,
                      ),
                    })
                  }
                />
              </div>
            ))}
          </RadioGroup>
          {answerErrors.map(({ label, error }) => (
            <p key={label} className="text-sm font-semibold text-destructive">
              {t(`exams.pools.edit.errors.answer.${error}`, { label, max: MAX_ANSWER_LENGTH })}
            </p>
          ))}
          {errors?.right && (
            <p className="text-sm font-semibold text-destructive">{t('exams.pools.edit.errors.rightMissing')}</p>
          )}
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-topic`}>{t('exams.pools.edit.topic')}</Label>
          <Input
            id={`${id}-topic`}
            value={draft.topic}
            aria-invalid={errors?.topic ? true : undefined}
            onChange={(event) => onChange({ ...draft, topic: event.target.value })}
            className="max-w-80"
          />
          {errors?.topic && (
            <p className="text-sm font-semibold text-destructive">
              {t('exams.pools.edit.errors.topicTooLong', { max: MAX_TOPIC_LENGTH })}
            </p>
          )}
        </div>
      </div>
    </article>
  )
}
```

- [ ] **Step 3: Replace `src/app/(dashboard)/exams/pools/detail/page.tsx` with the edit-mode version**

```tsx
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckIcon, InfoIcon, PencilIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useBlocker, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { LoadError } from '@/components/LoadError'
import { StatusPill } from '@/components/StatusPill'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { TitleBar } from '@/features/dashboard/TitleBar'
import { ExamTypeBadge, VerifiedPill } from '@/features/exams/ExamBadges'
import { gradeLevelLabel, poolQuestion, positiveIntParam } from '@/features/exams/ExamHelpers'
import { BackLink, InvalidLink } from '@/features/exams/ExamNav'
import type { DraftQuestion } from '@/features/exams/ExamPoolDraft'
import { isChanged, questionErrors, toDraft, toVerifyQuestions } from '@/features/exams/ExamPoolDraft'
import {
  EXAM_POOLS_PATH,
  examPoolDetailQueryOptions,
  markExamPoolVerify,
  storeExamPool,
  verifyExamPool,
} from '@/features/exams/ExamPoolsApi'
import { PoolQuestionEditor } from '@/features/exams/PoolQuestionEditor'
import { QuestionCard } from '@/features/exams/QuestionCard'
import { MetaRow } from '@/features/exams/StatTiles'
import { ConfirmActionDialog } from '@/features/system/ConfirmActionDialog'
import type { ExamQuestion } from '@/types/Exam'
import { formatServerTime } from '@/utils/Helpers'

/** Snapshot taken when editing starts, so a background refetch cannot move the questions under the form. */
type EditState = { originals: ExamQuestion[]; drafts: DraftQuestion[] }

/** One pool set with its answer key: mark it verified, or fix its questions and verify. */
export default function ExamPoolDetailPage() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const [params] = useSearchParams()
  const examId = positiveIntParam(params.get('exam'))
  const detail = useQuery({ ...examPoolDetailQueryOptions(examId ?? 0), enabled: examId !== null })
  const [unmarkOpen, setUnmarkOpen] = useState(false)
  const [edit, setEdit] = useState<EditState | null>(null)
  const [confirm, setConfirm] = useState<'save' | 'discard' | null>(null)

  const changed = edit
    ? edit.originals.filter((question, index) => isChanged(question, edit.drafts[index])).map((q) => q.question_number)
    : []
  const errors = edit ? edit.drafts.map(questionErrors) : []
  const errorCount = errors.filter((error) => error !== null).length
  const dirty = changed.length > 0

  // In-app navigation with unsaved changes asks first; reload / tab close gets the browser's prompt.
  const blocker = useBlocker(dirty)
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const mark = useMutation({
    mutationFn: (id: number) => markExamPoolVerify(id, true),
    onSuccess: (pool) => {
      storeExamPool(queryClient, pool)
      toast.success(t('exams.pools.detail.marked', { id: pool.exam_id }))
    },
  })
  // Silent: the confirm dialogs show their own errors.
  const unmark = useMutation({
    mutationFn: (id: number) => markExamPoolVerify(id, false),
    meta: { silentError: true },
    onSuccess: (pool) => {
      storeExamPool(queryClient, pool)
      setUnmarkOpen(false)
      toast.success(t('exams.pools.detail.unmarked', { id: pool.exam_id }))
    },
  })
  const save = useMutation({
    mutationFn: ({ id, questions }: { id: number; questions: ExamQuestion[] }) => verifyExamPool(id, questions),
    meta: { silentError: true },
    onSuccess: (pool) => {
      storeExamPool(queryClient, pool)
      setEdit(null)
      setConfirm(null)
      toast.success(t('exams.pools.edit.saved', { id: pool.exam_id }))
    },
  })

  if (examId === null) {
    return (
      <InvalidLink
        message={t('exams.pools.detail.missing')}
        to={EXAM_POOLS_PATH}
        label={t('exams.pools.detail.backToPools')}
      />
    )
  }

  const pool = detail.data
  const questions = pool?.questions ?? []
  const editable = questions.length > 0 && questions.every((question) => (question.answers ?? []).length > 0)

  function closeConfirm() {
    setConfirm(null)
    save.reset()
  }

  let content: ReactNode
  if (detail.isError && !pool) {
    content = (
      <div className="flex flex-col gap-3">
        <LoadError
          title={t('exams.pools.detail.loadFailed')}
          error={detail.error}
          onRetry={() => void detail.refetch()}
          retrying={detail.isFetching}
        />
        <Button asChild variant="outline" className="self-start">
          <Link to={EXAM_POOLS_PATH}>{t('exams.pools.detail.backToPools')}</Link>
        </Button>
      </div>
    )
  } else if (!pool) {
    content = (
      <div className="flex flex-col gap-4" aria-busy>
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    )
  } else {
    content = (
      <>
        {edit && (
          <div className="sticky top-2 z-10 flex flex-wrap items-center gap-3 rounded-2xl border bg-card px-4 py-3 shadow-sm">
            <strong>{t('exams.pools.edit.bar', { id: pool.exam_id })}</strong>
            <StatusPill tone="info">{t('exams.pools.edit.changed', { count: changed.length })}</StatusPill>
            {errorCount > 0 && (
              <StatusPill tone="danger">{t('exams.pools.edit.errorCount', { count: errorCount })}</StatusPill>
            )}
            <div className="ml-auto flex gap-2">
              <Button variant="ghost" onClick={() => (dirty ? setConfirm('discard') : setEdit(null))}>
                {t('common.cancel')}
              </Button>
              <Button disabled={!dirty || errorCount > 0 || save.isPending} onClick={() => setConfirm('save')}>
                {t('exams.pools.edit.save')}
              </Button>
            </div>
          </div>
        )}
        <MetaRow
          items={[
            { label: t('exams.pools.detail.meta.gradeLevel'), value: gradeLevelLabel(t, pool.grade, pool.level) },
            {
              label: t('exams.pools.detail.meta.questions'),
              value: t('exams.pools.detail.meta.questionsValue', {
                actual: questions.length,
                requested: pool.num_questions,
              }),
            },
            { label: t('exams.pools.detail.meta.semester'), value: pool.semester || '—' },
            { label: t('exams.pools.detail.meta.program'), value: pool.program || '—' },
            { label: t('exams.pools.detail.meta.verifiedCount'), value: pool.verified_count },
            { label: t('exams.pools.detail.meta.created'), value: formatServerTime(pool.create_dt, i18n.language) },
            {
              label: t('exams.pools.detail.meta.cacheTag'),
              value: pool.req_extras ? <span className="font-mono text-[13px]">{pool.req_extras}</span> : '—',
            },
          ]}
        />
        {edit ? (
          <>
            <div role="note" className="flex items-start gap-2.5 rounded-xl bg-warning-surface px-4 py-3 text-sm text-warning">
              <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{t('exams.pools.edit.banner')}</span>
            </div>
            <div className="flex flex-col gap-3">
              {edit.originals.map((question, index) => (
                <PoolQuestionEditor
                  key={question.question_number}
                  question={question}
                  draft={edit.drafts[index]}
                  errors={errors[index]}
                  changed={changed.includes(question.question_number)}
                  poolGrade={pool.grade}
                  onChange={(draft) =>
                    setEdit((current) =>
                      current && { ...current, drafts: current.drafts.map((d, i) => (i === index ? draft : d)) },
                    )
                  }
                />
              ))}
            </div>
          </>
        ) : questions.length === 0 ? (
          <p className="rounded-2xl border bg-card px-5 py-8 text-center text-muted-foreground">
            {t('exams.pools.detail.empty')}
          </p>
        ) : (
          <>
            <span className="text-xs text-muted-foreground">{t('exams.pools.detail.storedOrder')}</span>
            <div className="flex flex-col gap-3">
              {questions.map((question) => (
                <QuestionCard key={question.question_number} question={poolQuestion(question)} sittingGrade={pool.grade} />
              ))}
            </div>
          </>
        )}
      </>
    )
  }

  const editButton = (
    <Button
      className="h-11 rounded-xl px-4.5"
      disabled={!editable}
      aria-describedby={editable ? undefined : 'edit-blocked'}
      onClick={() => setEdit({ originals: questions, drafts: questions.map(toDraft) })}
    >
      <PencilIcon aria-hidden />
      {t('exams.pools.detail.edit')}
    </Button>
  )

  // Hidden while editing: the sticky bar holds the edit actions.
  const actions = pool && !edit && (
    <div className="flex flex-wrap gap-2">
      {pool.verified_count > 0 ? (
        <Button variant="outline" className="h-11 rounded-xl px-4.5" onClick={() => setUnmarkOpen(true)}>
          {t('exams.pools.detail.unmark')}
        </Button>
      ) : (
        <Button
          variant="outline"
          className="h-11 rounded-xl px-4.5"
          disabled={mark.isPending}
          onClick={() => mark.mutate(pool.exam_id)}
        >
          <CheckIcon aria-hidden />
          {mark.isPending ? t('common.saving') : t('exams.pools.detail.mark')}
        </Button>
      )}
      {editable ? (
        editButton
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0}>{editButton}</span>
          </TooltipTrigger>
          <TooltipContent>{t('exams.pools.detail.editBlocked')}</TooltipContent>
          {/* Tooltip content only exists while open; this keeps the reason for screen readers. */}
          <span id="edit-blocked" className="sr-only">
            {t('exams.pools.detail.editBlocked')}
          </span>
        </Tooltip>
      )}
    </div>
  )

  return (
    <>
      <BackLink to={EXAM_POOLS_PATH}>{t('exams.pools.detail.backToPools')}</BackLink>
      <TitleBar
        title={t('exams.pools.detail.heading', { id: examId })}
        description={
          pool && (
            <span className="flex flex-wrap items-center gap-2">
              <ExamTypeBadge type={pool.exam_type} />
              <VerifiedPill count={pool.verified_count} />
              {(pool.ai_title || pool.ai_short_text) && (
                <span>{[pool.ai_title, pool.ai_short_text].filter(Boolean).join(' — ')}</span>
              )}
            </span>
          )
        }
        actions={actions}
      />
      {content}

      {pool && (
        <ConfirmActionDialog
          open={unmarkOpen}
          onClose={() => {
            setUnmarkOpen(false)
            unmark.reset()
          }}
          title={t('exams.pools.detail.unmarkTitle', { id: pool.exam_id })}
          description={t('exams.pools.detail.unmarkDescription', { n: pool.verified_count })}
          confirmLabel={t('exams.pools.detail.unmark')}
          pendingLabel={t('exams.pools.detail.unmarking')}
          pending={unmark.isPending}
          error={unmark.error}
          onConfirm={() => unmark.mutate(pool.exam_id)}
        />
      )}
      {pool && edit && (
        <ConfirmActionDialog
          open={confirm === 'save'}
          onClose={closeConfirm}
          title={t('exams.pools.edit.confirmTitle', { id: pool.exam_id })}
          description={
            <>
              <p>
                {t('exams.pools.edit.confirmChanged', {
                  list: changed.map((number) => t('exams.question.number', { number })).join(', '),
                })}
              </p>
              <p>{t('exams.pools.edit.confirmLive')}</p>
              <p>{t('exams.pools.edit.confirmHistory')}</p>
              <p>{t('exams.pools.edit.confirmCount', { from: pool.verified_count, to: pool.verified_count + 1 })}</p>
            </>
          }
          confirmLabel={t('exams.pools.edit.save')}
          pendingLabel={t('exams.pools.edit.saving')}
          pending={save.isPending}
          error={save.error}
          onConfirm={() => save.mutate({ id: pool.exam_id, questions: toVerifyQuestions(edit.originals, edit.drafts) })}
        />
      )}
      <ConfirmActionDialog
        open={confirm === 'discard'}
        onClose={() => setConfirm(null)}
        title={t('exams.pools.edit.discardTitle')}
        description={t('exams.pools.edit.discardDescription')}
        confirmLabel={t('exams.pools.edit.discard')}
        pendingLabel={t('exams.pools.edit.discard')}
        pending={false}
        error={null}
        onConfirm={() => {
          setEdit(null)
          setConfirm(null)
        }}
      />
      <ConfirmActionDialog
        open={blocker.state === 'blocked'}
        onClose={() => blocker.reset?.()}
        title={t('exams.pools.edit.leaveTitle')}
        description={t('exams.pools.edit.leaveDescription', { id: examId })}
        confirmLabel={t('exams.pools.edit.leave')}
        pendingLabel={t('exams.pools.edit.leave')}
        pending={false}
        error={null}
        onConfirm={() => blocker.proceed?.()}
      />
    </>
  )
}
```

- [ ] **Step 4: Build and lint**

Run: `npm run build && npm run lint && node scripts/check-exam-pool-draft.ts`
Expected: all succeed; the check prints `exam pool draft: ok`.

- [ ] **Step 5: Commit**

```bash
git add src/features/exams/PoolQuestionEditor.tsx "src/app/(dashboard)/exams/pools/detail/page.tsx" src/locales/vi.json src/locales/en.json
git commit -m "feat: edit and verify exam pool questions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Controller: browser verification (after Task 4)

Preview `math-admin-local-api` (port 5175, proxy to math-svr `:8080`). The user signs in as ADMIN in the Browser pane; never type credentials. Pool data: `SELECT exam_id, req_exam_type, req_grade, verified_count FROM ma_exam_pools WHERE status='ACTIVE' ORDER BY exam_id DESC LIMIT 10` (read-only).

1. Sidebar: "Bài kiểm tra" group with "Bài làm học sinh" (active on `/exams`, `/exams/journey`, `/exams/sitting`) and "Kho đề" (active on `/exams/pools*`), never both.
2. `/exams/pools`: type and grade filters, paging (if > 20 rows), `page=99` clamps, empty filter state + clear; verified filter only once math-svr has `is_verified`.
3. Detail of an ASSESSMENT set (probe pills) and a GRADE set; meta row; `exam=abc` and an unknown id.
4. Mark (0 → 1, toast, list pill updates) and unmark (dialog, → 0).
5. Edit two questions (text, one option, the right answer, topic), save → dialog lists them; after save the cards show the change, count + 1, and `SELECT JSON_EXTRACT(ai_questions_json, '$') FROM ma_exam_pools WHERE exam_id = ?` shows `right_answer_content` equal to the chosen option.
6. Validation blocks save (blank option, duplicate options, 65-character topic); cancel with changes asks; sidebar click with changes asks (stay / leave); reload with changes gets the browser prompt.
7. Also run the deferred browser checks of `docs/superpowers/plans/2026-10-05-exam-admin.md` (Task 2 Step 11, Task 3 Step 11, Task 4 Step 6) in the same session.
8. Non-admin account: the exams group is hidden; `/exams/pools` shows the 403 message.

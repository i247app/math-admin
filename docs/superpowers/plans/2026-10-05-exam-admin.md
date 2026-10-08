# Exam Admin Screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin-only, read-only screens to browse any child's exam journeys, one journey's overview, and one sitting question by question.

**Architecture:** Three React Router pages under `/exams` (list → journey → sitting) with all state in the URL. They read math-svr's `/admin/exams/sessions/{list,detail}` through TanStack Query `queryOptions` in `src/features/exams/ExamsApi.ts`. Pure merge and aggregation logic lives in `ExamHelpers.ts`; presentational pieces are small components in `src/features/exams/`.

**Tech Stack:** React 19, Vite, TypeScript, React Router 7, TanStack Query 5, shadcn/ui, Tailwind 4, react-i18next, lucide-react.

**Spec:** `docs/superpowers/specs/2026-10-05-exam-admin-design.md`

## Global Constraints

- Read `CLAUDE.md` and `docs/API-CONTRACT.md` first. All HTTP goes through `apiPost` in `src/libs/ApiClient.ts`; components never call `fetch`.
- Read-only: no mutations, no write routes.
- UI text only from `src/locales/{vi,en}.json` via `useTranslation()`. `vi.json` is the type-checked source of truth; every key added to `vi.json` gets an `en.json` twin. Plural keys use the `count` option: `vi` defines `<key>_other` only, `en` defines `<key>_one` and `<key>_other`.
- Use theme tokens (`bg-success-surface`, `text-primary-foreground`, …), never raw hex or `text-white`.
- Labels (verbatim): `ASSESSMENT` "Đánh giá năng lực", `GRADE` "Ôn theo lớp", `PRACTICE` "Luyện tập"; `ACTIVE` "Đang diễn ra", `COMPLETE` "Hoàn thành", `CANCEL` "Đã hủy"; `IN_PROGRESS` "Đang làm dở", `SUBMITTED` "Đã nộp"; verdict "Đạt" / "Chưa đạt"; grade 0 "Mẫu giáo", 1–5 "Lớp n"; level "Mức n" (raw value, no +1).
- Times from these routes use the server layout: format with `formatServerTime`; an empty string means absent ("—").
- The sidebar item and the Profiles row action are visible only when `useSessionUser().role === 'ADMIN'` (the backend enforces it with `403` anyway).
- **No test runner exists and none is added.** Each task's proof is `npm run build` (type-check + bundle), `npm run lint`, and a browser check through the preview tools (`preview_start` with name `math-admin-local-api`, port 5175, proxying to math-svr on `:8080`).
- Browser checks need math-svr running locally and an ADMIN session. If the Browser pane is on `/sign-in`, ask the user to sign in there; never type credentials yourself. To find profiles with data, query the local DB read-only (mysql-local MCP), e.g. `SELECT profile_id, COUNT(*) n FROM ma_exam_sessions GROUP BY profile_id ORDER BY n DESC LIMIT 5`. If a column name differs, use `describe_table` first.
- Commits: Conventional Commits; Lefthook runs lint + type-check + commitlint. Stage only the files listed in the task. End each message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Precondition (before Task 1):** `git status` must show no unrelated changes in `src/locales/*.json`, `docs/API-CONTRACT.md`, or the files below. When this plan was written, someone else's uncommitted sessions-screen work touched the locale files and the contract. Ask the user to commit or stash that work first; do not stage it.

## File Map

| File | Status | Responsibility |
|---|---|---|
| `src/types/Exam.ts` | create | Wire types mirroring the Go exam DTOs |
| `src/features/exams/ExamsApi.ts` | create | Query options for the two admin routes + URL builders |
| `src/features/exams/ExamHelpers.ts` | create | URL param parsing, grade labels, sitting merge, topic stats |
| `src/features/profiles/ProfilesApi.ts` | modify | `profileDetailQueryOptions` |
| `src/features/exams/ExamBadges.tsx` | create | Type / status / verdict pills, score cell |
| `src/features/exams/ProfilePicker.tsx` | create | Search-by-name/code or by-id lookup |
| `src/features/exams/ProfileSummaryCard.tsx` | create | Chosen profile header card |
| `src/features/exams/JourneysTable.tsx` | create | Journeys table + in-progress shortcut |
| `src/features/exams/ExamNav.tsx` | create | `BackLink`, `InvalidLink` |
| `src/features/exams/StatTiles.tsx` | create | `StatTiles`, `MetaRow` |
| `src/features/exams/AiReviewCard.tsx` | create | AI review short/long |
| `src/features/exams/PracticePreviewCard.tsx` | create | Next practice round brief |
| `src/features/exams/SittingsTable.tsx` | create | Submitted sittings of a journey |
| `src/features/exams/TopicBreakdownCard.tsx` | create | Accuracy per topic |
| `src/features/exams/QuestionCard.tsx` | create | One question with options and marks |
| `src/app/(dashboard)/exams/page.tsx` | create | `/exams` |
| `src/app/(dashboard)/exams/journey/page.tsx` | create | `/exams/journey` |
| `src/app/(dashboard)/exams/sitting/page.tsx` | create | `/exams/sitting` |
| `src/app/router.tsx` | modify | `/exams` routes |
| `src/features/dashboard/Sidebar.tsx` | modify | "Bài kiểm tra" item (admins) |
| `src/features/profiles/ProfilesTable.tsx` | modify | export `ProfileStatusPill`; "Xem bài làm" row action |
| `src/app/(dashboard)/profiles/page.tsx` | modify | pass `canViewExams` |
| `src/locales/vi.json`, `src/locales/en.json` | modify | `nav.exams`, `profiles.actions.exams`, `exams.*` |
| `docs/API-CONTRACT.md`, `CLAUDE.md` | modify | Document the admin routes and the new files |

---

### Task 1: Exam data layer and contract docs

**Files:**
- Create: `src/types/Exam.ts`, `src/features/exams/ExamsApi.ts`, `src/features/exams/ExamHelpers.ts`
- Modify: `src/features/profiles/ProfilesApi.ts`, `src/locales/vi.json`, `src/locales/en.json`, `docs/API-CONTRACT.md`, `CLAUDE.md`

**Interfaces:**
- Consumes: `apiPost` (`src/libs/ApiClient.ts`), `OffsetPagination` (`src/types/Api.ts`), `Profile` (`src/types/Profile.ts`), `profilesQueryKey` (`ProfilesApi.ts`).
- Produces:
  - types `JourneyType`, `ExamType`, `JourneyStatus`, `SittingStatus`, `QuestionType`, `AnswerChoice`, `ExamQuestion`, `ExamResult`, `ExamSitting`, `ExamSession`, `ExamAnswerDetail`, `PracticePreview`, `ListExamSessionsRequest`, plus consts `JOURNEY_TYPES`, `JOURNEY_STATUSES`, `QUESTION_TYPES`
  - `examSessionsListQueryOptions(request: ListExamSessionsRequest)` → data `{ sessions: ExamSession[]; pagination?: OffsetPagination }`
  - `journeyDetailQueryOptions(profileId: number, esessId: number, examType: ExamType)` → data `{ journey: ExamSession; sittings: ExamSitting[]; details: ExamAnswerDetail[]; practicePreview?: PracticePreview }`
  - `sittingDetailQueryOptions(profileId: number, elinkId: number)` → data `{ sitting: ExamSitting; details: ExamAnswerDetail[] }`
  - `type JourneyRef = { profileId: number; esessId: number; type: JourneyType }`; `profileExamsPath(profileId)`, `journeyPath(ref, practice?)`, `sittingPath(profileId, elinkId, journey?: Omit<JourneyRef, 'profileId'>)`
  - `positiveIntParam(value: string | null): number | null`, `journeyTypeParam(value: string | null): JourneyType | null`, `journeyTypeOf(session: ExamSession): JourneyType`, `gradeLabel(t, grade)`, `gradeLevelLabel(t, grade?, level?)`, `profileLabel(profile: Profile | undefined, profileId: number)`
  - `type QuestionOutcome`, `type SittingQuestion`, `buildSittingQuestions(sitting, details): SittingQuestion[]`, `type TopicStat`, `topicBreakdown(details): TopicStat[]`
  - `profileDetailQueryOptions(profileId: number)` → data `Profile`

- [ ] **Step 1: Check the precondition**

Run: `git status --short`
Expected: none of the files in this plan's File Map show as modified. If they do, stop and ask the user (see Global Constraints).

- [ ] **Step 2: Create `src/types/Exam.ts`**

```ts
/**
 * Exam journeys and sittings as the admin reads them (docs/API-CONTRACT.md §4).
 * Source: math-svr internal/application/dto/exam/exam_dto.go, internal/shared/enum/exam.go.
 */
import type { OffsetPagination } from '@/types/Api'

/** Journey types — the values /exams/sessions/list accepts in `exam_types`. */
export const JOURNEY_TYPES = ['ASSESSMENT', 'GRADE'] as const
export type JourneyType = (typeof JOURNEY_TYPES)[number]

/** PRACTICE is not a journey: it rides on one (ExamSession.practice) and shares its esess_id. */
export type ExamType = JourneyType | 'PRACTICE'

export const JOURNEY_STATUSES = ['ACTIVE', 'COMPLETE', 'CANCEL'] as const
export type JourneyStatus = (typeof JOURNEY_STATUSES)[number]

/** "" when the row carries no status. */
export type SittingStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'DELETED' | ''

/** How the app renders a question; grading ignores it. Unknown values render as plain text. */
export const QUESTION_TYPES = ['ARITHMETIC', 'COUNT', 'PICK_BY_ICON', 'IDENTIFY_SHAPE'] as const
export type QuestionType = (typeof QUESTION_TYPES)[number]

export type AnswerChoice = { label: string; content: string }

/** One question as served to the child: their numbering and their A/B/C/D. */
export type ExamQuestion = {
  question_number: number
  question_type?: string
  /** May embed emoji and [icon:NAME] tokens. */
  question_name: string
  answers: AnswerChoice[]
  /** Answer key: only on SUBMITTED sittings. */
  right_answer_label?: string
  right_answer_content?: string
  question_topic?: string
  /** Above the sitting's grade on ASSESSMENT probe questions. */
  question_grade?: number
}

export type ExamResult = {
  /** Questions ANSWERED, not questions on the paper. */
  total_questions: number
  correct_number: number
  skipped_number: number
  score_percentage: number
}

/** One sitting. It carries no esess_id. */
export type ExamSitting = {
  elink_id: number
  exam_id: number
  profile_id: number
  exam_type: ExamType
  grade: number
  level?: number
  ai_title?: string
  ai_short_text?: string
  num_questions: number
  /** On a single-sitting read and on in_progress_exams; list cards drop it. */
  questions?: ExamQuestion[]
  /** Absent until submitted. */
  result?: ExamResult
  status: SittingStatus
  started_dt?: string
  submitted_dt?: string
  create_dt: string
}

/** One journey of one type, or (as `practice`) the journey's PRACTICE row. */
export type ExamSession = {
  esess_id: number
  exam_type: ExamType
  status: JourneyStatus | 'DELETED'
  total_questions: number
  correct_number: number
  skipped_number: number
  score_percentage?: number
  /** GRADE pass verdict on a COMPLETE journey; null = no verdict. */
  esess_flag: boolean | null
  ai_title?: string
  ai_short_text?: string
  ai_review_short?: string
  ai_review_long?: string
  grade?: number
  level?: number
  last_submitted_dt?: string
  ended_dt?: string
  create_dt: string
  practice?: ExamSession
  /** Filled by the list route only. */
  in_progress_exams?: ExamSitting[]
}

/** One answered question. Skipped questions have no row. */
export type ExamAnswerDetail = {
  elink_id: number
  question_number: number
  question_type?: string
  question_name?: string
  /** Omitted when the question set can no longer be found. */
  answers?: AnswerChoice[]
  question_topic?: string
  question_grade?: number
  right_answer_label?: string
  right_answer_content?: string
  selected_label: string
  selected_content?: string
  is_correct: boolean
}

export type PracticePreview = {
  mode: 'RETRY_WEAK' | 'ADVANCE'
  base_elink_id: number
  weak_topics: { topic: string; wrong: number; answered: number }[]
  strong_topics: string[]
}

/** POST /admin/exams/sessions/list; ExamsApi adds pagination_type OFFSET. */
export type ListExamSessionsRequest = {
  profile_id: number
  exam_types?: JourneyType[]
  status?: JourneyStatus
  page: number
  size: number
}

export type ListExamSessionsResponse = { exam_sessions: ExamSession[] | null; pagination?: OffsetPagination }

/** POST /admin/exams/sessions/detail with esess_id. */
export type JourneyDetailResponse = {
  exam_session: ExamSession
  /** Submitted sittings as cards (no questions), oldest first. */
  exams?: ExamSitting[]
  details?: ExamAnswerDetail[]
  practice_preview?: PracticePreview
}

/** POST /admin/exams/sessions/detail with elink_id. */
export type SittingDetailResponse = { exam: ExamSitting; details?: ExamAnswerDetail[] }
```

- [ ] **Step 3: Create `src/features/exams/ExamsApi.ts`**

```ts
/** /admin/exams/* calls (docs/API-CONTRACT.md §4). Read-only; ADMIN sessions only. */
import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import { apiPost } from '@/libs/ApiClient'
import type {
  ExamType,
  JourneyDetailResponse,
  JourneyType,
  ListExamSessionsRequest,
  ListExamSessionsResponse,
  SittingDetailResponse,
} from '@/types/Exam'

export const examsQueryKey = ['exams'] as const

export function examSessionsListQueryOptions(request: ListExamSessionsRequest) {
  return queryOptions({
    queryKey: [...examsQueryKey, 'sessions', request],
    queryFn: async ({ signal }) => {
      const res = await apiPost<ListExamSessionsResponse>(
        '/admin/exams/sessions/list',
        { ...request, pagination_type: 'OFFSET' },
        { signal },
      )
      return { sessions: res.exam_sessions ?? [], pagination: res.pagination }
    },
    placeholderData: keepPreviousData,
  })
}

/** One journey row: the journey's own type, or PRACTICE for the practice row that shares its id. */
export function journeyDetailQueryOptions(profileId: number, esessId: number, examType: ExamType) {
  return queryOptions({
    queryKey: [...examsQueryKey, 'journey', profileId, esessId, examType],
    queryFn: async ({ signal }) => {
      const res = await apiPost<JourneyDetailResponse>(
        '/admin/exams/sessions/detail',
        { profile_id: profileId, esess_id: esessId, exam_type: examType },
        { signal },
      )
      return {
        journey: res.exam_session,
        sittings: res.exams ?? [],
        details: res.details ?? [],
        practicePreview: res.practice_preview,
      }
    },
  })
}

export function sittingDetailQueryOptions(profileId: number, elinkId: number) {
  return queryOptions({
    queryKey: [...examsQueryKey, 'sitting', profileId, elinkId],
    queryFn: async ({ signal }) => {
      const res = await apiPost<SittingDetailResponse>(
        '/admin/exams/sessions/detail',
        { profile_id: profileId, elink_id: elinkId },
        { signal },
      )
      return { sitting: res.exam, details: res.details ?? [] }
    },
  })
}

/** A journey page; `type` is the journey's own type, never PRACTICE. */
export type JourneyRef = { profileId: number; esessId: number; type: JourneyType }

export function profileExamsPath(profileId: number) {
  return `/exams?profile=${profileId}`
}

export function journeyPath({ profileId, esessId, type }: JourneyRef, practice = false) {
  const params = new URLSearchParams({ profile: String(profileId), esess: String(esessId), type })
  if (practice) params.set('view', 'practice')
  return `/exams/journey?${params}`
}

/** `journey` only feeds the sitting page's back link: the sitting response has no esess_id. */
export function sittingPath(profileId: number, elinkId: number, journey?: Omit<JourneyRef, 'profileId'>) {
  const params = new URLSearchParams({ profile: String(profileId), elink: String(elinkId) })
  if (journey) {
    params.set('esess', String(journey.esessId))
    params.set('type', journey.type)
  }
  return `/exams/sitting?${params}`
}
```

- [ ] **Step 4: Create `src/features/exams/ExamHelpers.ts`**

```ts
import type { TFunction } from 'i18next'
import type { AnswerChoice, ExamAnswerDetail, ExamSession, ExamSitting, JourneyType } from '@/types/Exam'
import { JOURNEY_TYPES } from '@/types/Exam'
import type { Profile } from '@/types/Profile'

/** A URL param as a positive integer id, or null. */
export function positiveIntParam(value: string | null): number | null {
  const n = Number(value)
  return value && Number.isSafeInteger(n) && n >= 1 ? n : null
}

export function journeyTypeParam(value: string | null): JourneyType | null {
  return JOURNEY_TYPES.find((option) => option === value) ?? null
}

/** The list returns journeys only; ASSESSMENT (the server's default) covers anything else. */
export function journeyTypeOf(session: ExamSession): JourneyType {
  return journeyTypeParam(session.exam_type) ?? 'ASSESSMENT'
}

export function gradeLabel(t: TFunction, grade: number): string {
  return grade === 0 ? t('exams.kindergarten') : t('exams.grade', { grade })
}

/** "Lớp 2 · Mức 3"; level is shown as stored. */
export function gradeLevelLabel(t: TFunction, grade?: number, level?: number): string {
  const parts: string[] = []
  if (grade !== undefined) parts.push(gradeLabel(t, grade))
  if (level !== undefined) parts.push(t('exams.level', { level }))
  return parts.length > 0 ? parts.join(' · ') : '—'
}

/** "Nguyễn Bảo Anh · BA-4821", or "#1042" until the profile has loaded. */
export function profileLabel(profile: Profile | undefined, profileId: number): string {
  if (!profile) return `#${profileId}`
  return `${profile.name || profile.profile_code} · ${profile.profile_code}`
}

/** `unanswered` = the sitting is not submitted, so nothing can be marked. */
export type QuestionOutcome = 'correct' | 'wrong' | 'skipped' | 'unanswered'

export type SittingQuestion = {
  number: number
  type?: string
  name: string
  topic?: string
  grade?: number
  /** Empty when the question set is gone (row rebuilt from the answer log). */
  answers: AnswerChoice[]
  rightLabel?: string
  rightContent?: string
  selectedLabel?: string
  selectedContent?: string
  outcome: QuestionOutcome
}

/**
 * The paper as served (every question, skipped ones included) joined with the answer log
 * on question_number — both use the child's served numbering. Log rows without a served
 * question are kept, so a sitting whose question set is gone still shows its answers.
 */
export function buildSittingQuestions(sitting: ExamSitting, details: ExamAnswerDetail[]): SittingQuestion[] {
  const submitted = sitting.status === 'SUBMITTED'
  const unmatched = new Map(details.map((detail) => [detail.question_number, detail]))

  const rows: SittingQuestion[] = (sitting.questions ?? []).map((question) => {
    const detail = unmatched.get(question.question_number)
    unmatched.delete(question.question_number)
    return {
      number: question.question_number,
      type: question.question_type || detail?.question_type,
      name: question.question_name,
      topic: question.question_topic || detail?.question_topic,
      grade: question.question_grade ?? detail?.question_grade,
      answers: question.answers ?? [],
      rightLabel: question.right_answer_label || detail?.right_answer_label,
      rightContent: question.right_answer_content || detail?.right_answer_content,
      selectedLabel: detail?.selected_label,
      selectedContent: detail?.selected_content,
      outcome: !submitted ? 'unanswered' : !detail ? 'skipped' : detail.is_correct ? 'correct' : 'wrong',
    }
  })

  for (const detail of unmatched.values()) {
    rows.push({
      number: detail.question_number,
      type: detail.question_type,
      name: detail.question_name ?? '',
      topic: detail.question_topic,
      grade: detail.question_grade,
      answers: detail.answers ?? [],
      rightLabel: detail.right_answer_label,
      rightContent: detail.right_answer_content,
      selectedLabel: detail.selected_label,
      selectedContent: detail.selected_content,
      outcome: detail.is_correct ? 'correct' : 'wrong',
    })
  }

  return rows.sort((a, b) => a.number - b.number)
}

/** `topic` null = questions the model gave no topic. */
export type TopicStat = { topic: string | null; correct: number; answered: number }

/** Correct / answered per topic across a journey, weakest first. */
export function topicBreakdown(details: ExamAnswerDetail[]): TopicStat[] {
  const stats = new Map<string | null, TopicStat>()
  for (const detail of details) {
    const topic = detail.question_topic?.trim() || null
    const stat = stats.get(topic) ?? { topic, correct: 0, answered: 0 }
    stat.answered += 1
    if (detail.is_correct) stat.correct += 1
    stats.set(topic, stat)
  }
  return [...stats.values()].sort((a, b) => a.correct / a.answered - b.correct / b.answered)
}
```

- [ ] **Step 5: Add `profileDetailQueryOptions` to `src/features/profiles/ProfilesApi.ts`**

Insert right after `profilesListQueryOptions` (the key starts with `profilesQueryKey`, so profile edits invalidate it):

```ts
export function profileDetailQueryOptions(profileId: number) {
  return queryOptions({
    queryKey: [...profilesQueryKey, 'detail', profileId],
    queryFn: async ({ signal }) => {
      const res = await apiPost<{ profile: Profile }>('/profiles/detail', { profile_id: profileId }, { signal })
      return res.profile
    },
  })
}
```

`Profile` is already imported as a type in that file; `queryOptions` and `apiPost` are already imported.

- [ ] **Step 6: Add the shared locale keys**

In `src/locales/vi.json`, add a top-level `"exams"` object immediately before the top-level `"system"` key (not `nav.system`):

```json
  "exams": {
    "title": "Bài kiểm tra",
    "description": "Xem các hành trình làm bài, từng lượt làm và từng câu trả lời của một hồ sơ học sinh.",
    "types": { "ASSESSMENT": "Đánh giá năng lực", "GRADE": "Ôn theo lớp", "PRACTICE": "Luyện tập" },
    "journeyStatus": { "ACTIVE": "Đang diễn ra", "COMPLETE": "Hoàn thành", "CANCEL": "Đã hủy", "DELETED": "Đã xoá" },
    "sittingStatus": { "IN_PROGRESS": "Đang làm dở", "SUBMITTED": "Đã nộp", "DELETED": "Đã xoá" },
    "verdict": { "passed": "Đạt", "failed": "Chưa đạt" },
    "kindergarten": "Mẫu giáo",
    "grade": "Lớp {{grade}}",
    "level": "Mức {{level}}",
    "score": "{{correct}}/{{total}}",
    "skipped_other": "bỏ qua {{count}}"
  },
```

In `src/locales/en.json`, same place:

```json
  "exams": {
    "title": "Exams",
    "description": "A student profile's exam journeys, each sitting and every answer.",
    "types": { "ASSESSMENT": "Assessment", "GRADE": "Grade review", "PRACTICE": "Practice" },
    "journeyStatus": { "ACTIVE": "In progress", "COMPLETE": "Completed", "CANCEL": "Cancelled", "DELETED": "Deleted" },
    "sittingStatus": { "IN_PROGRESS": "Not submitted", "SUBMITTED": "Submitted", "DELETED": "Deleted" },
    "verdict": { "passed": "Passed", "failed": "Not passed" },
    "kindergarten": "Kindergarten",
    "grade": "Grade {{grade}}",
    "level": "Level {{level}}",
    "score": "{{correct}}/{{total}}",
    "skipped_one": "{{count}} skipped",
    "skipped_other": "{{count}} skipped"
  },
```

- [ ] **Step 7: Update `docs/API-CONTRACT.md` §4**

Replace the whole "Exam sessions (journeys)" subsection (from its `###` heading through the "**Scope limit:** … admin read path." paragraph) with:

````markdown
### Exam sessions (journeys) — `internal/application/dto/exam/exam_dto.go`, `internal/module/exam/`

| Route | Request | Response |
|---|---|---|
| `/exams/sessions/list` | `{ profile_id, exam_types?: ("ASSESSMENT"|"GRADE")[], status?, ...pagination.Request }` | `{ exam_sessions: [...], pagination? , cursor? }` |
| `/exams/sessions/latest` | `{ profile_id, exam_type?, grade? }` | `{ exam_session }` (`null` when none) |
| `/admin/exams/sessions/list` 🛡️ | same body as `/exams/sessions/list` (`profile_id` required; the admin sends `pagination_type: "OFFSET"`) | same response, for any profile |
| `/admin/exams/sessions/detail` 🛡️ | `{ profile_id, esess_id, exam_type? }` — a journey row (omitted type = ASSESSMENT; `PRACTICE` = the practice row sharing the id) — **or** `{ profile_id, elink_id }` — one sitting | journey: `{ exam_session, exams (cards, no questions), details, practice_preview? }`; sitting: `{ exam (with questions), details }` |

Journey status: `ACTIVE, COMPLETE, CANCEL, DELETED`. Sitting status: `IN_PROGRESS, SUBMITTED, DELETED`.

**Scope.** The owner routes are scoped to the *caller's own* profiles (uid from the session, `loadOwnedProfile`).
The 🛡️ routes (`AdminRequiredMiddleware`: ADMIN only, else `403`) run the same service methods as the
profile's owner (`Service.actAsOwner`, logged per call), so an admin sees exactly what the parent sees.

What the admin relies on (types in `src/types/Exam.ts`):
- `in_progress_exams` (open sittings, with questions) is filled **only by the list**; the journey detail omits it.
- A sitting carries no `esess_id`. `questions` use the child's served order and labels; the answer key
  (`right_answer_*`) is present only once SUBMITTED.
- `details[]` has one row per **answered** question (`selected_label`, `is_correct`, …); skipped questions have
  no row. `answers` is omitted when the question set is gone.
- `esess_flag`: GRADE pass verdict on a COMPLETE journey (`score_percentage >= 50`), `null` otherwise.
- Grade 0–5 (0 = kindergarten); level 0–9 as stated by the app. Question types `ARITHMETIC, COUNT, PICK_BY_ICON,
  IDENTIFY_SHAPE`; text may embed emoji and `[icon:NAME]` tokens.
- Codes: `EXAM_ATTEMPT_NOT_FOUND` 13701, `EXAM_ATTEMPT_NOT_OWNED` 13702, `EXAM_INVALID_EXAM_TYPE` 13708,
  `EXAM_PROFILE_NOT_FOUND` 13715, `EXAM_MISSING_PROFILE_ID` 13717, `EXAM_JOURNEY_NOT_FOUND` 13721,
  `EXAM_JOURNEY_NOT_OWNED` 13722.
````

In §5, replace the line `- Exam reads are per-caller (see above); admin-wide views need new backend endpoints.` with:

```markdown
- Exam reads: the owner routes are per-caller; the admin reads one profile's journeys and sittings through
  `/admin/exams/sessions/{list,detail}` (§4). There is no list across profiles, and the progress routes
  (`/exams/analytics/progress`, `/exams/journey/progress`, `/exams/grade/*`) have no admin path.
```

- [ ] **Step 8: Update `CLAUDE.md`**

- In "How the frontend calls the API", add `Exam.ts` to the wire-types list: `` (`Api.ts`, `User.ts`, `Banner.ts`, `Curriculum.ts`, `Role.ts`, `Device.ts`, `Profile.ts`, `System.ts`, `Exam.ts`) ``.
- In the folder tree, change `module: roles), system/* (admin ops)` to `module: roles), exams/* (journeys → sittings, admin only), system/* (admin ops)`, and add `exams` to the `features/<area>/` list: `(dashboard, auth, users, profiles, banners, curriculum, devices, permissions, exams, system)`.

- [ ] **Step 9: Build and lint**

Run: `npm run build && npm run lint`
Expected: both succeed with no errors. (Nothing renders the new code yet; this proves the types, keys and imports.)

- [ ] **Step 10: Commit**

```bash
git add src/types/Exam.ts src/features/exams/ExamsApi.ts src/features/exams/ExamHelpers.ts src/features/profiles/ProfilesApi.ts src/locales/vi.json src/locales/en.json docs/API-CONTRACT.md CLAUDE.md
git commit -m "$(cat <<'EOF'
feat: add exam admin data layer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `/exams` — profile picker and journeys list

**Files:**
- Create: `src/features/exams/ExamBadges.tsx`, `src/features/exams/ProfilePicker.tsx`, `src/features/exams/ProfileSummaryCard.tsx`, `src/features/exams/JourneysTable.tsx`, `src/app/(dashboard)/exams/page.tsx`
- Modify: `src/app/router.tsx`, `src/features/dashboard/Sidebar.tsx`, `src/features/profiles/ProfilesTable.tsx`, `src/app/(dashboard)/profiles/page.tsx`, `src/locales/vi.json`, `src/locales/en.json`

**Interfaces:**
- Consumes (Task 1): `examSessionsListQueryOptions`, `journeyPath`, `sittingPath`, `profileExamsPath`, `JourneyRef`, `positiveIntParam`, `journeyTypeParam`, `journeyTypeOf`, `gradeLevelLabel`, `profileDetailQueryOptions`, `JOURNEY_TYPES`, `JOURNEY_STATUSES`, types from `@/types/Exam`.
- Produces (used by Tasks 3–4): `ExamTypeBadge({ type: ExamType })`, `JourneyStatusPill({ status: ExamSession['status'] })`, `SittingStatusPill({ status: SittingStatus })`, `VerdictPill({ flag: boolean | null })`, `ScoreSummary({ correct, total, skipped, percent? })`; `ProfileStatusPill` exported from `ProfilesTable.tsx`.

- [ ] **Step 1: Add the locale keys for this task**

`src/locales/vi.json`:
- in `nav`, after `"devices": "Thiết bị",` add `"exams": "Bài kiểm tra",`
- in `profiles.actions`, add `"exams": "Xem bài làm của {{name}}"` (keep commas valid)
- as the last entries of the `exams` object (add a comma after `"skipped_other"`):

```json
    "picker": {
      "label": "Tìm hồ sơ",
      "mode": "Cách tìm",
      "bySearch": "Tìm theo tên / mã",
      "byId": "Profile ID",
      "searchPlaceholder": "Tên hoặc mã hồ sơ (VD: BA-4821)",
      "idPlaceholder": "Profile ID",
      "submit": "Tìm",
      "required": "Nhập tên hoặc mã hồ sơ.",
      "invalidId": "Nhập Profile ID là số nguyên dương.",
      "searching": "Đang tìm…",
      "matches_other": "{{count}} hồ sơ khớp “{{search}}” (hiện tối đa 8)",
      "noMatch": "Không tìm thấy hồ sơ nào khớp “{{search}}”.",
      "profileId": "Hồ sơ #{{id}}",
      "account": "Tài khoản #{{uid}}",
      "noGrade": "chưa có lớp",
      "pick": "Chọn",
      "pickName": "Chọn {{name}}",
      "pickTitle": "Chọn một hồ sơ để xem bài làm",
      "pickDescription": "Tìm theo tên hoặc mã hồ sơ, nhập Profile ID, hoặc mở từ nút “Xem bài làm” trong màn hình Hồ sơ."
    },
    "profile": {
      "code": "Mã hồ sơ",
      "account": "Tài khoản",
      "learning": "Đang học",
      "school": "Trường",
      "change": "Đổi hồ sơ"
    },
    "list": {
      "loadFailed": "Không tải được danh sách hành trình",
      "count_other": "{{count}} hành trình",
      "filterType": "Lọc theo loại",
      "allTypes": "Mọi loại",
      "filterStatus": "Lọc theo trạng thái",
      "allStatuses": "Mọi trạng thái",
      "emptyTitle": "Hồ sơ này chưa có hành trình nào",
      "filterEmptyTitle": "Không có hành trình nào khớp bộ lọc",
      "clearFilters": "Xoá bộ lọc",
      "inProgress_other": "{{count}} bài làm dở",
      "inProgressItem": "Lượt #{{id}} · {{type}} · {{time}}",
      "open": "Mở hành trình #{{id}}",
      "columns": {
        "id": "Mã",
        "journey": "Hành trình",
        "gradeLevel": "Lớp · Mức",
        "status": "Trạng thái",
        "result": "Kết quả",
        "practice": "Luyện tập",
        "lastSubmitted": "Nộp gần nhất",
        "started": "Bắt đầu"
      }
    }
```

`src/locales/en.json`: `nav.exams` = `"Exams"`, `profiles.actions.exams` = `"View {{name}}'s exams"`, and in `exams`:

```json
    "picker": {
      "label": "Find a profile",
      "mode": "Lookup by",
      "bySearch": "Name / code",
      "byId": "Profile ID",
      "searchPlaceholder": "Profile name or code (e.g. BA-4821)",
      "idPlaceholder": "Profile ID",
      "submit": "Find",
      "required": "Enter a profile name or code.",
      "invalidId": "Enter a positive whole number.",
      "searching": "Searching…",
      "matches_one": "{{count}} profile matches “{{search}}” (showing up to 8)",
      "matches_other": "{{count}} profiles match “{{search}}” (showing up to 8)",
      "noMatch": "No profile matches “{{search}}”.",
      "profileId": "Profile #{{id}}",
      "account": "Account #{{uid}}",
      "noGrade": "no grade yet",
      "pick": "Select",
      "pickName": "Select {{name}}",
      "pickTitle": "Pick a profile to see its exams",
      "pickDescription": "Search by profile name or code, enter a profile ID, or open it from “View exams” on the Profiles screen."
    },
    "profile": {
      "code": "Profile code",
      "account": "Account",
      "learning": "Studying",
      "school": "School",
      "change": "Change profile"
    },
    "list": {
      "loadFailed": "Couldn't load the journeys",
      "count_one": "{{count}} journey",
      "count_other": "{{count}} journeys",
      "filterType": "Filter by type",
      "allTypes": "All types",
      "filterStatus": "Filter by status",
      "allStatuses": "All statuses",
      "emptyTitle": "This profile has no journeys yet",
      "filterEmptyTitle": "No journey matches the filters",
      "clearFilters": "Clear filters",
      "inProgress_one": "{{count}} unsubmitted sitting",
      "inProgress_other": "{{count}} unsubmitted sittings",
      "inProgressItem": "Sitting #{{id}} · {{type}} · {{time}}",
      "open": "Open journey #{{id}}",
      "columns": {
        "id": "ID",
        "journey": "Journey",
        "gradeLevel": "Grade · Level",
        "status": "Status",
        "result": "Result",
        "practice": "Practice",
        "lastSubmitted": "Last submitted",
        "started": "Started"
      }
    }
```

- [ ] **Step 2: Create `src/features/exams/ExamBadges.tsx`**

```tsx
import { useTranslation } from 'react-i18next'
import type { PillTone } from '@/components/StatusPill'
import { StatusPill } from '@/components/StatusPill'
import { Badge } from '@/components/ui/badge'
import type { ExamSession, ExamType, SittingStatus } from '@/types/Exam'
import { cn } from '@/utils/Helpers'

const typeStyles: Record<ExamType, string> = {
  ASSESSMENT: 'bg-info-surface text-info',
  GRADE: 'bg-coral-surface text-coral',
  PRACTICE: 'bg-accent text-accent-foreground',
}

export function ExamTypeBadge({ type }: { type: ExamType }) {
  const { t } = useTranslation()
  return <Badge className={cn('h-6 px-2.5 text-xs font-semibold', typeStyles[type])}>{t(`exams.types.${type}`)}</Badge>
}

const journeyTones: Record<ExamSession['status'], PillTone> = {
  ACTIVE: 'info',
  COMPLETE: 'success',
  CANCEL: 'neutral',
  DELETED: 'danger',
}

export function JourneyStatusPill({ status }: { status: ExamSession['status'] }) {
  const { t } = useTranslation()
  return <StatusPill tone={journeyTones[status]}>{t(`exams.journeyStatus.${status}`)}</StatusPill>
}

export function SittingStatusPill({ status }: { status: SittingStatus }) {
  const { t } = useTranslation()
  if (!status) return null
  const tone: PillTone = status === 'SUBMITTED' ? 'success' : status === 'IN_PROGRESS' ? 'warning' : 'danger'
  return <StatusPill tone={tone}>{t(`exams.sittingStatus.${status}`)}</StatusPill>
}

/** GRADE pass verdict; nothing when the server has none. */
export function VerdictPill({ flag }: { flag: boolean | null }) {
  const { t } = useTranslation()
  if (flag === null) return null
  return (
    <StatusPill tone={flag ? 'success' : 'danger'}>{t(flag ? 'exams.verdict.passed' : 'exams.verdict.failed')}</StatusPill>
  )
}

type ScoreSummaryProps = { correct: number; total: number; skipped: number; percent?: number }

/** "14/20 · 70%", a bar, and the skipped count. */
export function ScoreSummary({ correct, total, skipped, percent }: ScoreSummaryProps) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm">
        <strong>{t('exams.score', { correct, total })}</strong>
        {percent !== undefined && <span className="text-muted-foreground"> · {percent}%</span>}
      </span>
      {percent !== undefined && (
        <div className="h-1.5 w-28 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div
            className={cn('h-full rounded-full', percent < 50 ? 'bg-destructive' : 'bg-primary')}
            style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
          />
        </div>
      )}
      <span className="text-xs text-muted-foreground">{t('exams.skipped', { count: skipped })}</span>
    </div>
  )
}
```

- [ ] **Step 3: Export `ProfileStatusPill` and add the row action in `src/features/profiles/ProfilesTable.tsx`**

- Change `function ProfileStatusPill(` to `export function ProfileStatusPill(`.
- Add `ClipboardCheckIcon` to the `lucide-react` import, and `import { profileExamsPath } from '@/features/exams/ExamsApi'`.
- Add `canViewExams: boolean` to `ProfilesTableProps` (doc comment: `/** Exam reads are admin-only on the server. */`) and destructure it in the component.
- Widen the actions header from `w-36` to `w-44`.
- As the first child of the actions `<div className="flex justify-end gap-1">`:

```tsx
                      {canViewExams && (
                        <RowAction label={t('profiles.actions.exams', { name })} to={profileExamsPath(profile.profile_id)}>
                          <ClipboardCheckIcon />
                        </RowAction>
                      )}
```

In `src/app/(dashboard)/profiles/page.tsx`: `import { useSessionUser } from '@/features/auth/AuthApi'`, add `const isAdmin = useSessionUser().role === 'ADMIN'` at the top of `ProfilesPage`, and render `<ProfilesTable profiles={rows} canViewExams={isAdmin} onAction={handleAction} />`.

- [ ] **Step 4: Create `src/features/exams/ProfilePicker.tsx`**

```tsx
import { useQuery } from '@tanstack/react-query'
import { SearchIcon } from 'lucide-react'
import type { FormEvent } from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FormAlert } from '@/components/FormAlert'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { profilesListQueryOptions } from '@/features/profiles/ProfilesApi'
import { RoleBadge } from '@/features/users/UserBadges'
import { getErrorMessage } from '@/libs/ApiClient'
import { cn, initialsOf } from '@/utils/Helpers'
import { positiveIntParam } from './ExamHelpers'

type Mode = 'search' | 'id'
const RESULT_LIMIT = 8

type ProfilePickerProps = {
  onPick: (profileId: number) => void
  /** Why the profile in the URL could not be loaded, shown under the form. */
  error?: string
}

/** Finds a profile by name/code (/profiles/list search) or takes a profile id as typed. */
export function ProfilePicker({ onPick, error }: ProfilePickerProps) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<Mode>('search')
  const [text, setText] = useState('')
  // The search that was submitted; null until the first one.
  const [search, setSearch] = useState<string | null>(null)
  const [inputError, setInputError] = useState<string | null>(null)

  const results = useQuery({
    ...profilesListQueryOptions({ page: 1, size: RESULT_LIMIT, search: search ?? '' }),
    enabled: search !== null,
  })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = text.trim()
    if (mode === 'id') {
      const id = positiveIntParam(value)
      if (!id) {
        setInputError(t('exams.picker.invalidId'))
        return
      }
      setInputError(null)
      onPick(id)
      return
    }
    if (!value) {
      setInputError(t('exams.picker.required'))
      return
    }
    setInputError(null)
    setSearch(value)
  }

  const profiles = results.data?.profiles
  const message = inputError ?? error

  return (
    <section aria-label={t('exams.picker.label')} className="overflow-hidden rounded-2xl border bg-card">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3 px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={mode}
            onValueChange={(value) => {
              setMode(value as Mode)
              setInputError(null)
              setSearch(null)
            }}
          >
            <SelectTrigger aria-label={t('exams.picker.mode')} className="h-11 w-52 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="search">{t('exams.picker.bySearch')}</SelectItem>
              <SelectItem value="id">{t('exams.picker.byId')}</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type={mode === 'search' ? 'search' : 'text'}
            inputMode={mode === 'id' ? 'numeric' : undefined}
            autoComplete="off"
            maxLength={128}
            aria-label={t(mode === 'search' ? 'exams.picker.searchPlaceholder' : 'exams.picker.idPlaceholder')}
            placeholder={t(mode === 'search' ? 'exams.picker.searchPlaceholder' : 'exams.picker.idPlaceholder')}
            value={text}
            onChange={(event) => setText(event.target.value)}
            aria-invalid={inputError !== null}
            className={cn('h-11 w-80 rounded-xl', mode === 'id' && 'font-mono')}
          />
          <Button type="submit" className="h-11 rounded-xl px-4.5">
            <SearchIcon aria-hidden />
            {t('exams.picker.submit')}
          </Button>
        </div>
        {message && <FormAlert>{message}</FormAlert>}
      </form>

      {mode === 'search' && search !== null && (
        <div className="border-t" aria-live="polite" aria-busy={results.isFetching}>
          {results.isError ? (
            <div className="px-5 py-4">
              <FormAlert>{getErrorMessage(results.error)}</FormAlert>
            </div>
          ) : !profiles ? (
            <p className="px-5 py-4 text-sm text-muted-foreground">{t('exams.picker.searching')}</p>
          ) : profiles.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted-foreground">{t('exams.picker.noMatch', { search })}</p>
          ) : (
            <div className={cn('transition-opacity', results.isPlaceholderData && 'opacity-60')}>
              <p className="px-5 pt-3 pb-1 text-xs text-muted-foreground">
                {t('exams.picker.matches', { count: results.data?.pagination.total_count ?? 0, search })}
              </p>
              <ul>
                {profiles.map((profile) => {
                  const name = profile.name || profile.profile_code
                  const details = [
                    profile.profile_code,
                    t('exams.picker.profileId', { id: profile.profile_id }),
                    t('exams.picker.account', { uid: profile.uid }),
                    profile.grade?.label ?? t('exams.picker.noGrade'),
                    profile.school?.name,
                  ].filter(Boolean)
                  return (
                    <li key={profile.profile_id} className="flex items-center gap-3 border-t px-5 py-2.5 first:border-t-0">
                      <Avatar className="size-9">
                        {profile.avatar_url && <AvatarImage src={profile.avatar_url} alt="" />}
                        <AvatarFallback className="bg-secondary text-[13px] font-bold text-primary">
                          {initialsOf(name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex min-w-0 grow flex-col gap-0.5">
                        <span className="flex items-center gap-2 font-semibold">
                          <span className="truncate">{name}</span>
                          <RoleBadge role={profile.role} />
                        </span>
                        <span className="truncate text-xs text-muted-foreground">{details.join(' · ')}</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label={t('exams.picker.pickName', { name })}
                        onClick={() => onPick(profile.profile_id)}
                      >
                        {t('exams.picker.pick')}
                      </Button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 5: Create `src/features/exams/ProfileSummaryCard.tsx`**

```tsx
import { StarIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { StatusPill } from '@/components/StatusPill'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ProfileStatusPill } from '@/features/profiles/ProfilesTable'
import { RoleBadge } from '@/features/users/UserBadges'
import type { Profile } from '@/types/Profile'
import { initialsOf } from '@/utils/Helpers'

/** Header card of the profile whose exams are listed. */
export function ProfileSummaryCard({ profile, onChange }: { profile: Profile; onChange: () => void }) {
  const { t } = useTranslation()
  const name = profile.name || profile.profile_code
  const learning = [profile.program?.label, profile.grade?.label, profile.semester?.name].filter(Boolean)
  const contact = profile.phone || profile.email

  return (
    <section aria-label={name} className="flex flex-wrap items-start gap-4 rounded-2xl border bg-card px-5 py-4.5">
      <Avatar className="size-14">
        {profile.avatar_url && <AvatarImage src={profile.avatar_url} alt="" />}
        <AvatarFallback className="bg-secondary text-lg font-bold text-primary">{initialsOf(name)}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 grow flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-bold">{name}</h2>
          <RoleBadge role={profile.role} />
          <ProfileStatusPill status={profile.profile_status} />
          {profile.is_default && (
            <StatusPill tone="warning">
              <StarIcon className="size-3 fill-current" aria-hidden />
              {t('profiles.default')}
            </StatusPill>
          )}
        </div>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
          <Field label={t('exams.profile.code')}>
            <span className="font-mono">{profile.profile_code}</span> · #{profile.profile_id}
          </Field>
          <Field label={t('exams.profile.account')}>
            <span className="font-mono">#{profile.uid}</span>
            {contact && ` · ${contact}`}
          </Field>
          <Field label={t('exams.profile.learning')}>{learning.length > 0 ? learning.join(' · ') : '—'}</Field>
          <Field label={t('exams.profile.school')}>{profile.school?.name ?? '—'}</Field>
        </dl>
      </div>
      <Button variant="outline" size="sm" onClick={onChange}>
        {t('exams.profile.change')}
      </Button>
    </section>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate">{children}</dd>
    </div>
  )
}
```

- [ ] **Step 6: Create `src/features/exams/JourneysTable.tsx`**

```tsx
import { ChevronRightIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { ExamSession, ExamSitting } from '@/types/Exam'
import { formatServerTime } from '@/utils/Helpers'
import { ExamTypeBadge, JourneyStatusPill, ScoreSummary, VerdictPill } from './ExamBadges'
import { gradeLevelLabel, journeyTypeOf } from './ExamHelpers'
import type { JourneyRef } from './ExamsApi'
import { journeyPath, sittingPath } from './ExamsApi'

type JourneysTableProps = {
  profileId: number
  /** undefined while the first page loads. */
  sessions: ExamSession[] | undefined
}

/** A profile's journeys; the whole row opens the journey. */
export function JourneysTable({ profileId, sessions }: JourneysTableProps) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()

  return (
    <Table className="min-w-[1120px]">
      <TableHeader className="bg-muted/50">
        <TableRow>
          <TableHead className="w-24 pl-5">{t('exams.list.columns.id')}</TableHead>
          <TableHead>{t('exams.list.columns.journey')}</TableHead>
          <TableHead className="w-36">{t('exams.list.columns.gradeLevel')}</TableHead>
          <TableHead className="w-40">{t('exams.list.columns.status')}</TableHead>
          <TableHead className="w-40">{t('exams.list.columns.result')}</TableHead>
          <TableHead className="w-32">{t('exams.list.columns.practice')}</TableHead>
          <TableHead className="w-40">{t('exams.list.columns.lastSubmitted')}</TableHead>
          <TableHead className="w-40">{t('exams.list.columns.started')}</TableHead>
          <TableHead className="w-10 pr-5" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {sessions
          ? sessions.map((session) => {
              const ref: JourneyRef = { profileId, esessId: session.esess_id, type: journeyTypeOf(session) }
              const path = journeyPath(ref)
              const open = session.in_progress_exams ?? []
              return (
                <TableRow key={session.esess_id} className="cursor-pointer" onClick={() => void navigate(path)}>
                  <TableCell className="pl-5">
                    <Link
                      to={path}
                      onClick={(event) => event.stopPropagation()}
                      aria-label={t('exams.list.open', { id: session.esess_id })}
                      className="font-mono text-[13px] font-semibold text-primary underline-offset-4 hover:underline"
                    >
                      #{session.esess_id}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-80">
                    <div className="flex flex-col items-start gap-1">
                      <ExamTypeBadge type={session.exam_type} />
                      <span className="max-w-full truncate text-[13px] text-muted-foreground">
                        {session.ai_title || '—'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{gradeLevelLabel(t, session.grade, session.level)}</TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      <JourneyStatusPill status={session.status} />
                      <VerdictPill flag={session.esess_flag} />
                      {open.length > 0 && <InProgressLink journey={ref} sittings={open} />}
                    </div>
                  </TableCell>
                  <TableCell>
                    <ScoreSummary
                      correct={session.correct_number}
                      total={session.total_questions}
                      skipped={session.skipped_number}
                      percent={session.score_percentage}
                    />
                  </TableCell>
                  <TableCell className="text-sm">
                    {session.practice ? (
                      <>
                        {t('exams.score', {
                          correct: session.practice.correct_number,
                          total: session.practice.total_questions,
                        })}
                        {session.practice.score_percentage !== undefined && (
                          <span className="text-muted-foreground"> · {session.practice.score_percentage}%</span>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatServerTime(session.last_submitted_dt, i18n.language)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatServerTime(session.create_dt, i18n.language)}
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
                  <Skeleton className="h-5 w-40 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-3 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-24 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-3 w-28" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-3 w-16" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-3 w-28" />
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

const inProgressClass =
  'inline-flex h-6 items-center rounded-full bg-warning-surface px-2.5 text-xs font-semibold text-warning underline-offset-4 hover:underline'

/**
 * The only way into an unsubmitted sitting: the journey detail does not return them.
 * Clicks stop here so the row does not navigate too (React events bubble through portals).
 */
function InProgressLink({ journey, sittings }: { journey: JourneyRef; sittings: ExamSitting[] }) {
  const { t, i18n } = useTranslation()
  const label = t('exams.list.inProgress', { count: sittings.length })
  const hrefOf = (sitting: ExamSitting) =>
    sittingPath(journey.profileId, sitting.elink_id, { esessId: journey.esessId, type: journey.type })

  if (sittings.length === 1) {
    return (
      <Link to={hrefOf(sittings[0])} onClick={(event) => event.stopPropagation()} className={inProgressClass}>
        {label}
      </Link>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={inProgressClass} onClick={(event) => event.stopPropagation()}>
        {label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onClick={(event) => event.stopPropagation()}>
        {sittings.map((sitting) => (
          <DropdownMenuItem key={sitting.elink_id} asChild>
            <Link to={hrefOf(sitting)}>
              {t('exams.list.inProgressItem', {
                id: sitting.elink_id,
                type: t(`exams.types.${sitting.exam_type}`),
                time: formatServerTime(sitting.started_dt || sitting.create_dt, i18n.language),
              })}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

- [ ] **Step 7: Create `src/app/(dashboard)/exams/page.tsx`**

```tsx
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { DataPagination } from '@/components/DataPagination'
import { LoadError } from '@/components/LoadError'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { TitleBar } from '@/features/dashboard/TitleBar'
import { journeyTypeParam, positiveIntParam } from '@/features/exams/ExamHelpers'
import { examSessionsListQueryOptions } from '@/features/exams/ExamsApi'
import { JourneysTable } from '@/features/exams/JourneysTable'
import { ProfilePicker } from '@/features/exams/ProfilePicker'
import { ProfileSummaryCard } from '@/features/exams/ProfileSummaryCard'
import { profileDetailQueryOptions } from '@/features/profiles/ProfilesApi'
import { getErrorMessage } from '@/libs/ApiClient'
import { JOURNEY_STATUSES, JOURNEY_TYPES } from '@/types/Exam'
import { cn } from '@/utils/Helpers'

const PAGE_SIZE = 20
const ALL = 'all'

/** One profile's journeys. math-svr has no list across profiles, so a profile is picked first. */
export default function ExamsPage() {
  const { t } = useTranslation()

  // Profile, filters and page live in the URL so the Profiles screen can link here and Back works.
  const [params, setParams] = useSearchParams()
  const profileId = positiveIntParam(params.get('profile'))
  const page = positiveIntParam(params.get('page')) ?? 1
  const type = journeyTypeParam(params.get('type'))
  const status = JOURNEY_STATUSES.find((option) => option === params.get('status')) ?? null

  const profile = useQuery({ ...profileDetailQueryOptions(profileId ?? 0), enabled: profileId !== null })
  const list = useQuery({
    ...examSessionsListQueryOptions({
      profile_id: profileId ?? 0,
      exam_types: type ? [type] : undefined,
      status: status ?? undefined,
      page,
      size: PAGE_SIZE,
    }),
    enabled: profileId !== null,
  })

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
  const rows = list.data?.sessions
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

  const filtered = type !== null || status !== null
  const first = pagination ? pagination.skip + 1 : 0
  const last = pagination ? pagination.skip + (rows?.length ?? 0) : 0

  return (
    <>
      <TitleBar title={t('exams.title')} description={t('exams.description')} />

      {profileId === null || profile.isError ? (
        <>
          <ProfilePicker
            onPick={(id) => setParams({ profile: String(id) })}
            error={profile.isError ? getErrorMessage(profile.error) : undefined}
          />
          {profileId === null && (
            <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card px-6 py-12 text-center">
              <img src={`${import.meta.env.BASE_URL}assets/images/numi-thinking.png`} alt="" className="size-30 object-contain" />
              <strong className="text-[17px] font-semibold">{t('exams.picker.pickTitle')}</strong>
              <span className="max-w-md text-muted-foreground">{t('exams.picker.pickDescription')}</span>
            </div>
          )}
        </>
      ) : (
        <>
          {profile.data ? (
            <ProfileSummaryCard profile={profile.data} onChange={() => setParams({})} />
          ) : (
            <Skeleton className="h-28 rounded-2xl" />
          )}

          {list.isError && !list.data ? (
            <LoadError
              title={t('exams.list.loadFailed')}
              error={list.error}
              onRetry={() => void list.refetch()}
              retrying={list.isFetching}
            />
          ) : (
            <section aria-label={t('exams.title')} className="overflow-hidden rounded-2xl border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
                <strong className="font-semibold" aria-live="polite">
                  {pagination ? t('exams.list.count', { count: pagination.total_count }) : ' '}
                </strong>
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={type ?? ALL} onValueChange={(value) => update({ type: value === ALL ? null : value })}>
                    <SelectTrigger size="sm" aria-label={t('exams.list.filterType')} className="w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>{t('exams.list.allTypes')}</SelectItem>
                      {JOURNEY_TYPES.map((option) => (
                        <SelectItem key={option} value={option}>
                          {t(`exams.types.${option}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={status ?? ALL}
                    onValueChange={(value) => update({ status: value === ALL ? null : value })}
                  >
                    <SelectTrigger size="sm" aria-label={t('exams.list.filterStatus')} className="w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>{t('exams.list.allStatuses')}</SelectItem>
                      {JOURNEY_STATUSES.map((option) => (
                        <SelectItem key={option} value={option}>
                          {t(`exams.journeyStatus.${option}`)}
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
                    {t(filtered ? 'exams.list.filterEmptyTitle' : 'exams.list.emptyTitle')}
                  </strong>
                  {filtered && (
                    <Button variant="outline" onClick={() => update({ type: null, status: null })}>
                      {t('exams.list.clearFilters')}
                    </Button>
                  )}
                </div>
              ) : (
                <div
                  className={cn('overflow-x-auto transition-opacity', list.isPlaceholderData && 'opacity-60')}
                  aria-busy={list.isFetching}
                >
                  <JourneysTable profileId={profileId} sessions={rows} />
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
      )}
    </>
  )
}
```

- [ ] **Step 8: Register the route in `src/app/router.tsx`**

Add `import ExamsPage from './(dashboard)/exams/page'` with the other page imports (keep alphabetical order: after `DevicesPage`). Insert after the `/devices` route:

```tsx
      {
        // Admin-only reads of exam data (math-svr /admin/exams/*): list → journey → sitting.
        path: '/exams',
        handle: { titleKey: 'nav.exams' } satisfies RouteHandle,
        children: [{ index: true, Component: ExamsPage }],
      },
```

- [ ] **Step 9: Add the sidebar item in `src/features/dashboard/Sidebar.tsx`**

- Add `ClipboardCheckIcon` to the `lucide-react` import.
- After `navItems`, add:

```tsx
/** Admins only: math-svr answers 403 to anyone else. */
const examsItem: NavItem = { to: '/exams', labelKey: 'nav.exams', icon: ClipboardCheckIcon }
```

- Replace the comment above `isAdmin` with `// Exams and the system group are admin-only: math-svr refuses everyone else with 403.`, add `const topItems = isAdmin ? [...navItems, examsItem] : navItems` below it, and change `{navItems.map(` to `{topItems.map(`.

- [ ] **Step 10: Build and lint**

Run: `npm run build && npm run lint`
Expected: both succeed.

- [ ] **Step 11: Verify in the browser**

Start the preview (`preview_start` name `math-admin-local-api`), sign-in by the user if needed, then check:
1. Sidebar shows "Bài kiểm tra" after "Thiết bị"; `/admin/exams` shows the picker and the mascot empty state.
2. Search mode: empty submit → "Nhập tên hoặc mã hồ sơ."; a real name → up to 8 results; "Chọn" → URL `?profile=<id>`, summary card + journeys table.
3. Profile ID mode: `abc` → invalid message; an unknown id like `999999999` → picker stays with the server message (profile not found).
4. Type and status filters change the URL and reset to page 1; a filter with no match shows "Không có hành trình nào khớp bộ lọc" + "Xoá bộ lọc".
5. Rows: type pill + AI title, "Lớp n · Mức n", status, "Đạt/Chưa đạt" on completed GRADE journeys, score bar, practice column.
6. `read_network_requests` for `/go/admin/exams/sessions/list`: body has `profile_id`, `pagination_type: "OFFSET"`, `page`, `size`.
7. Profiles screen: the clipboard row action opens `/exams?profile=<id>`.
8. `read_console_messages` with `onlyErrors: true` is empty. Take a screenshot as proof.

Row clicks go to `/exams/journey`, which shows the not-found page until Task 3. That is expected.

- [ ] **Step 12: Commit**

```bash
git add "src/app/(dashboard)/exams/page.tsx" src/features/exams/ExamBadges.tsx src/features/exams/ProfilePicker.tsx src/features/exams/ProfileSummaryCard.tsx src/features/exams/JourneysTable.tsx src/app/router.tsx src/features/dashboard/Sidebar.tsx src/features/profiles/ProfilesTable.tsx "src/app/(dashboard)/profiles/page.tsx" src/locales/vi.json src/locales/en.json
git commit -m "$(cat <<'EOF'
feat: add exams screen with profile picker and journeys list

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `/exams/journey` — journey overview

**Files:**
- Create: `src/features/exams/ExamNav.tsx`, `src/features/exams/StatTiles.tsx`, `src/features/exams/AiReviewCard.tsx`, `src/features/exams/PracticePreviewCard.tsx`, `src/features/exams/SittingsTable.tsx`, `src/features/exams/TopicBreakdownCard.tsx`, `src/app/(dashboard)/exams/journey/page.tsx`
- Modify: `src/app/router.tsx`, `src/locales/vi.json`, `src/locales/en.json`

**Interfaces:**
- Consumes: Task 1 (`journeyDetailQueryOptions`, `journeyPath`, `sittingPath`, `profileExamsPath`, `JourneyRef`, `positiveIntParam`, `journeyTypeParam`, `gradeLabel`, `gradeLevelLabel`, `profileLabel`, `topicBreakdown`, `profileDetailQueryOptions`); Task 2 (`ExamTypeBadge`, `JourneyStatusPill`, `VerdictPill`, `ScoreSummary`).
- Produces (used by Task 4): `BackLink({ to: string; children })`, `InvalidLink({ message: string })`, `StatTiles({ tiles: StatTile[] })`, `type StatTile = { label: string; value: ReactNode; highlight?: boolean }`, `MetaRow({ items: { label: string; value: ReactNode }[] })`.

- [ ] **Step 1: Add the locale keys for this task**

`src/locales/vi.json`, as the last entries of `exams`:

```json
    "backToExams": "Về Bài kiểm tra",
    "journey": {
      "title": "Hành trình",
      "heading": "Hành trình #{{id}}",
      "loadFailed": "Không tải được hành trình",
      "missing": "Đường dẫn thiếu hoặc sai mã hồ sơ, mã hành trình hay loại hành trình.",
      "backToList": "Về danh sách hành trình",
      "tabsLabel": "Phần của hành trình",
      "tabJourney": "Hành trình · {{type}}",
      "tabPractice": "Luyện tập · {{score}}",
      "tiles": {
        "score": "Điểm",
        "correct": "Câu đúng",
        "answered": "Câu đã trả lời",
        "skipped": "Câu bỏ qua",
        "grade": "Lớp hiện tại",
        "level": "Mức hiện tại"
      },
      "meta": {
        "started": "Bắt đầu",
        "lastSubmitted": "Nộp gần nhất",
        "ended": "Kết thúc",
        "verdict": "Kết luận",
        "noVerdict": "Chưa có"
      },
      "review": {
        "title": "Nhận xét của AI",
        "empty": "Chưa có nhận xét: ứng dụng chưa yêu cầu AI nhận xét hành trình này.",
        "showMore": "Xem toàn bộ",
        "showLess": "Thu gọn"
      },
      "preview": {
        "title": "Lượt luyện tập tiếp theo sẽ…",
        "modes": { "RETRY_WEAK": "Ôn lại chỗ yếu", "ADVANCE": "Nâng cao" },
        "weak": "Chủ đề yếu (sai / đã làm)",
        "noWeak": "Không có chủ đề yếu.",
        "strong": "Chủ đề vững",
        "base": "Dựa trên lượt #{{id}}"
      },
      "sittings": {
        "title": "Các lượt làm bài ({{n}})",
        "note": "Chỉ lượt đã nộp. Lượt làm dở mở từ danh sách hành trình.",
        "empty": "Chưa có lượt nào được nộp.",
        "open": "Mở lượt #{{id}}",
        "columns": {
          "id": "Lượt",
          "title": "Tiêu đề đề bài",
          "gradeLevel": "Lớp · Mức",
          "questions": "Số câu",
          "result": "Kết quả",
          "started": "Bắt đầu",
          "submitted": "Nộp lúc"
        }
      },
      "topics": {
        "title": "Theo chủ đề",
        "note": "Số câu đúng / đã làm trên cả hành trình, chủ đề yếu nhất ở trên.",
        "unknown": "Không rõ chủ đề"
      }
    }
```

`src/locales/en.json`:

```json
    "backToExams": "Back to Exams",
    "journey": {
      "title": "Journey",
      "heading": "Journey #{{id}}",
      "loadFailed": "Couldn't load the journey",
      "missing": "The link is missing or has a wrong profile, journey or journey type.",
      "backToList": "Back to the journeys",
      "tabsLabel": "Journey parts",
      "tabJourney": "Journey · {{type}}",
      "tabPractice": "Practice · {{score}}",
      "tiles": {
        "score": "Score",
        "correct": "Correct",
        "answered": "Answered",
        "skipped": "Skipped",
        "grade": "Current grade",
        "level": "Current level"
      },
      "meta": {
        "started": "Started",
        "lastSubmitted": "Last submitted",
        "ended": "Ended",
        "verdict": "Verdict",
        "noVerdict": "None yet"
      },
      "review": {
        "title": "AI review",
        "empty": "No review yet: the app has not asked the AI to review this journey.",
        "showMore": "Show all",
        "showLess": "Show less"
      },
      "preview": {
        "title": "The next practice round will…",
        "modes": { "RETRY_WEAK": "Retry weak spots", "ADVANCE": "Push further" },
        "weak": "Weak topics (wrong / answered)",
        "noWeak": "No weak topics.",
        "strong": "Strong topics",
        "base": "Based on sitting #{{id}}"
      },
      "sittings": {
        "title": "Sittings ({{n}})",
        "note": "Submitted sittings only. Open unsubmitted ones from the journeys list.",
        "empty": "No sitting submitted yet.",
        "open": "Open sitting #{{id}}",
        "columns": {
          "id": "Sitting",
          "title": "Paper title",
          "gradeLevel": "Grade · Level",
          "questions": "Questions",
          "result": "Result",
          "started": "Started",
          "submitted": "Submitted"
        }
      },
      "topics": {
        "title": "By topic",
        "note": "Correct / answered across the journey, weakest topic first.",
        "unknown": "No topic"
      }
    }
```

- [ ] **Step 2: Create `src/features/exams/ExamNav.tsx`**

```tsx
import { ArrowLeftIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex w-max items-center gap-1.5 text-sm font-semibold text-primary underline-offset-4 hover:underline"
    >
      <ArrowLeftIcon className="size-4" aria-hidden />
      {children}
    </Link>
  )
}

/** A detail page reached with missing or malformed ids. */
export function InvalidLink({ message }: { message: string }) {
  const { t } = useTranslation()
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border bg-card px-6 py-12 text-center">
      <img src={`${import.meta.env.BASE_URL}assets/images/numi-thinking.png`} alt="" className="size-30 object-contain" />
      <span className="max-w-md text-muted-foreground">{message}</span>
      <Button asChild variant="outline">
        <Link to="/exams">{t('exams.backToExams')}</Link>
      </Button>
    </div>
  )
}
```

- [ ] **Step 3: Create `src/features/exams/StatTiles.tsx`**

```tsx
import type { ReactNode } from 'react'
import { cn } from '@/utils/Helpers'

export type StatTile = { label: string; value: ReactNode; highlight?: boolean }

/** Row of number tiles; `highlight` marks the headline figure. */
export function StatTiles({ tiles }: { tiles: StatTile[] }) {
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {tiles.map(({ label, value, highlight }) => (
        // flex-col-reverse: the value reads first while <dt> stays first in the markup.
        <div
          key={label}
          className={cn(
            'flex flex-col-reverse gap-0.5 rounded-2xl border bg-card px-4 py-3.5',
            highlight && 'border-primary/25 bg-accent',
          )}
        >
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className={cn('text-2xl font-bold', highlight && 'text-primary')}>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Label/value pairs in one card (dates, ids). */
export function MetaRow({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="flex flex-wrap gap-x-8 gap-y-3 rounded-2xl border bg-card px-5 py-3.5 text-sm">
      {items.map(({ label, value }) => (
        <div key={label} className="flex flex-col gap-0.5">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}
```

- [ ] **Step 4: Create `src/features/exams/AiReviewCard.tsx`**

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { cn } from '@/utils/Helpers'

/** ai_review_short / ai_review_long of a journey; absent until the app asked for a review. */
export function AiReviewCard({ short, long }: { short?: string; long?: string }) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)

  return (
    <section className="flex flex-col rounded-2xl border bg-card">
      <h2 className="border-b px-5 py-3.5 font-semibold">{t('exams.journey.review.title')}</h2>
      <div className="flex flex-col gap-2 px-5 py-4 leading-relaxed">
        {!short && !long ? (
          <p className="text-muted-foreground">{t('exams.journey.review.empty')}</p>
        ) : (
          <>
            {short && <p className="font-semibold">{short}</p>}
            {long && (
              <>
                <p className={cn('whitespace-pre-line text-muted-foreground', !expanded && 'line-clamp-3')}>{long}</p>
                <Button
                  variant="link"
                  className="h-auto self-start p-0"
                  aria-expanded={expanded}
                  onClick={() => setExpanded(!expanded)}
                >
                  {t(expanded ? 'exams.journey.review.showLess' : 'exams.journey.review.showMore')}
                </Button>
              </>
            )}
          </>
        )}
      </div>
    </section>
  )
}
```

- [ ] **Step 5: Create `src/features/exams/PracticePreviewCard.tsx`**

```tsx
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { StatusPill } from '@/components/StatusPill'
import type { PracticePreview } from '@/types/Exam'

/** What a PRACTICE round on this journey would drill if the app asked for one now. */
export function PracticePreviewCard({ preview, baseHref }: { preview: PracticePreview; baseHref: string }) {
  const { t } = useTranslation()

  return (
    <section className="flex flex-col rounded-2xl border bg-card">
      <div className="flex items-center justify-between gap-3 border-b px-5 py-3.5">
        <h2 className="font-semibold">{t('exams.journey.preview.title')}</h2>
        <StatusPill tone={preview.mode === 'RETRY_WEAK' ? 'warning' : 'success'}>
          {t(`exams.journey.preview.modes.${preview.mode}`)}
        </StatusPill>
      </div>
      <div className="flex flex-col gap-3 px-5 py-4 text-sm">
        <span className="text-xs text-muted-foreground">{t('exams.journey.preview.weak')}</span>
        {preview.weak_topics.length === 0 ? (
          <span className="text-muted-foreground">{t('exams.journey.preview.noWeak')}</span>
        ) : (
          <ul className="flex flex-col gap-2">
            {preview.weak_topics.map(({ topic, wrong, answered }) => (
              <li key={topic} className="grid grid-cols-[1fr_8rem_3.5rem] items-center gap-3">
                <span className="truncate">{topic}</span>
                <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <div
                    className="h-full rounded-full bg-destructive"
                    style={{ width: `${answered > 0 ? (wrong / answered) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-right font-mono text-xs">
                  {wrong} / {answered}
                </span>
              </li>
            ))}
          </ul>
        )}
        {preview.strong_topics.length > 0 && (
          <>
            <span className="text-xs text-muted-foreground">{t('exams.journey.preview.strong')}</span>
            <div className="flex flex-wrap gap-1.5">
              {preview.strong_topics.map((topic) => (
                <StatusPill key={topic} tone="success">
                  {topic}
                </StatusPill>
              ))}
            </div>
          </>
        )}
        <Link to={baseHref} className="w-max text-xs font-semibold text-primary underline-offset-4 hover:underline">
          {t('exams.journey.preview.base', { id: preview.base_elink_id })}
        </Link>
      </div>
    </section>
  )
}
```

- [ ] **Step 6: Create `src/features/exams/SittingsTable.tsx`**

```tsx
import { ChevronRightIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { ExamSitting } from '@/types/Exam'
import { formatServerTime } from '@/utils/Helpers'
import { ScoreSummary } from './ExamBadges'
import { gradeLevelLabel } from './ExamHelpers'

/** A journey's submitted sittings; the whole row opens the sitting. */
export function SittingsTable({ sittings, hrefOf }: { sittings: ExamSitting[]; hrefOf: (sitting: ExamSitting) => string }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()

  return (
    <Table className="min-w-[960px]">
      <TableHeader className="bg-muted/50">
        <TableRow>
          <TableHead className="w-28 pl-5">{t('exams.journey.sittings.columns.id')}</TableHead>
          <TableHead>{t('exams.journey.sittings.columns.title')}</TableHead>
          <TableHead className="w-36">{t('exams.journey.sittings.columns.gradeLevel')}</TableHead>
          <TableHead className="w-24">{t('exams.journey.sittings.columns.questions')}</TableHead>
          <TableHead className="w-40">{t('exams.journey.sittings.columns.result')}</TableHead>
          <TableHead className="w-40">{t('exams.journey.sittings.columns.started')}</TableHead>
          <TableHead className="w-40">{t('exams.journey.sittings.columns.submitted')}</TableHead>
          <TableHead className="w-10 pr-5" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {sittings.map((sitting) => {
          const href = hrefOf(sitting)
          return (
            <TableRow key={sitting.elink_id} className="cursor-pointer" onClick={() => void navigate(href)}>
              <TableCell className="pl-5">
                <Link
                  to={href}
                  onClick={(event) => event.stopPropagation()}
                  aria-label={t('exams.journey.sittings.open', { id: sitting.elink_id })}
                  className="font-mono text-[13px] font-semibold text-primary underline-offset-4 hover:underline"
                >
                  #{sitting.elink_id}
                </Link>
              </TableCell>
              <TableCell className="max-w-72 truncate">{sitting.ai_title || '—'}</TableCell>
              <TableCell className="text-sm">{gradeLevelLabel(t, sitting.grade, sitting.level)}</TableCell>
              <TableCell className="text-sm">{sitting.num_questions}</TableCell>
              <TableCell>
                {sitting.result ? (
                  <ScoreSummary
                    correct={sitting.result.correct_number}
                    total={sitting.result.total_questions}
                    skipped={sitting.result.skipped_number}
                    percent={sitting.result.score_percentage}
                  />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatServerTime(sitting.started_dt, i18n.language)}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatServerTime(sitting.submitted_dt, i18n.language)}
              </TableCell>
              <TableCell className="pr-5 text-muted-foreground">
                <ChevronRightIcon className="size-4" aria-hidden />
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
```

- [ ] **Step 7: Create `src/features/exams/TopicBreakdownCard.tsx`**

```tsx
import { useTranslation } from 'react-i18next'
import type { ExamAnswerDetail } from '@/types/Exam'
import { cn } from '@/utils/Helpers'
import { topicBreakdown } from './ExamHelpers'

/** Accuracy per question_topic across a journey, computed from its answer log. */
export function TopicBreakdownCard({ details }: { details: ExamAnswerDetail[] }) {
  const { t } = useTranslation()
  const stats = topicBreakdown(details)
  if (stats.length === 0) return null

  return (
    <section className="rounded-2xl border bg-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-5 py-3.5">
        <h2 className="font-semibold">{t('exams.journey.topics.title')}</h2>
        <span className="text-xs text-muted-foreground">{t('exams.journey.topics.note')}</span>
      </div>
      <ul className="flex flex-col gap-2 px-5 py-4 text-sm">
        {stats.map(({ topic, correct, answered }) => {
          const ratio = correct / answered
          return (
            <li key={topic ?? ''} className="grid grid-cols-[1fr_10rem_3.5rem] items-center gap-3">
              <span className={cn('truncate', topic === null && 'text-muted-foreground italic')}>
                {topic ?? t('exams.journey.topics.unknown')}
              </span>
              <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                <div
                  className={cn(
                    'h-full rounded-full',
                    ratio >= 0.8 ? 'bg-success' : ratio >= 0.5 ? 'bg-warning' : 'bg-destructive',
                  )}
                  style={{ width: `${ratio * 100}%` }}
                />
              </div>
              <span className="text-right font-mono text-xs">
                {correct} / {answered}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
```

- [ ] **Step 8: Create `src/app/(dashboard)/exams/journey/page.tsx`**

```tsx
import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { LoadError } from '@/components/LoadError'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { TitleBar } from '@/features/dashboard/TitleBar'
import { AiReviewCard } from '@/features/exams/AiReviewCard'
import { ExamTypeBadge, JourneyStatusPill, VerdictPill } from '@/features/exams/ExamBadges'
import { gradeLabel, journeyTypeParam, positiveIntParam, profileLabel } from '@/features/exams/ExamHelpers'
import { BackLink, InvalidLink } from '@/features/exams/ExamNav'
import type { JourneyRef } from '@/features/exams/ExamsApi'
import { journeyDetailQueryOptions, journeyPath, profileExamsPath, sittingPath } from '@/features/exams/ExamsApi'
import { PracticePreviewCard } from '@/features/exams/PracticePreviewCard'
import { SittingsTable } from '@/features/exams/SittingsTable'
import { MetaRow, StatTiles } from '@/features/exams/StatTiles'
import { TopicBreakdownCard } from '@/features/exams/TopicBreakdownCard'
import { profileDetailQueryOptions } from '@/features/profiles/ProfilesApi'
import { cn, formatServerTime } from '@/utils/Helpers'

/** One journey: totals, AI review, practice brief, sittings, accuracy by topic. */
export default function JourneyPage() {
  const { t, i18n } = useTranslation()
  const [params] = useSearchParams()
  const profileId = positiveIntParam(params.get('profile'))
  const esessId = positiveIntParam(params.get('esess'))
  const type = journeyTypeParam(params.get('type'))
  const wantsPractice = params.get('view') === 'practice'
  const valid = profileId !== null && esessId !== null && type !== null

  const profile = useQuery({ ...profileDetailQueryOptions(profileId ?? 0), enabled: profileId !== null })
  // The journey's own row always loads: it owns the header and says whether a practice row exists.
  const main = useQuery({
    ...journeyDetailQueryOptions(profileId ?? 0, esessId ?? 0, type ?? 'ASSESSMENT'),
    enabled: valid,
  })
  const hasPractice = main.data?.journey.practice !== undefined
  const showPractice = wantsPractice && hasPractice
  const practice = useQuery({
    ...journeyDetailQueryOptions(profileId ?? 0, esessId ?? 0, 'PRACTICE'),
    enabled: valid && showPractice,
  })

  if (!valid) return <InvalidLink message={t('exams.journey.missing')} />

  const ref: JourneyRef = { profileId, esessId, type }
  const backTo = profileExamsPath(profileId)
  const body = showPractice ? practice : main
  const header = main.data?.journey

  let content: ReactNode
  if (body.isError && !body.data) {
    content = (
      <div className="flex flex-col gap-3">
        <LoadError
          title={t('exams.journey.loadFailed')}
          error={body.error}
          onRetry={() => void body.refetch()}
          retrying={body.isFetching}
        />
        <Button asChild variant="outline" className="self-start">
          <Link to={backTo}>{t('exams.journey.backToList')}</Link>
        </Button>
      </div>
    )
  } else if (!body.data) {
    content = (
      <div className="flex flex-col gap-4" aria-busy>
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    )
  } else {
    const { journey, sittings, details, practicePreview } = body.data
    const sittingHref = (elinkId: number) => sittingPath(profileId, elinkId, { esessId, type })
    content = (
      <>
        <StatTiles
          tiles={[
            {
              label: t('exams.journey.tiles.score'),
              value: journey.score_percentage !== undefined ? `${journey.score_percentage}%` : '—',
              highlight: true,
            },
            { label: t('exams.journey.tiles.correct'), value: journey.correct_number },
            { label: t('exams.journey.tiles.answered'), value: journey.total_questions },
            { label: t('exams.journey.tiles.skipped'), value: journey.skipped_number },
            {
              label: t('exams.journey.tiles.grade'),
              value: journey.grade !== undefined ? gradeLabel(t, journey.grade) : '—',
            },
            {
              label: t('exams.journey.tiles.level'),
              value: journey.level !== undefined ? t('exams.level', { level: journey.level }) : '—',
            },
          ]}
        />
        <MetaRow
          items={[
            { label: t('exams.journey.meta.started'), value: formatServerTime(journey.create_dt, i18n.language) },
            {
              label: t('exams.journey.meta.lastSubmitted'),
              value: formatServerTime(journey.last_submitted_dt, i18n.language),
            },
            { label: t('exams.journey.meta.ended'), value: formatServerTime(journey.ended_dt, i18n.language) },
            ...(type === 'GRADE' && !showPractice
              ? [
                  {
                    label: t('exams.journey.meta.verdict'),
                    value:
                      journey.esess_flag === null ? (
                        <span className="text-muted-foreground">{t('exams.journey.meta.noVerdict')}</span>
                      ) : (
                        <VerdictPill flag={journey.esess_flag} />
                      ),
                  },
                ]
              : []),
          ]}
        />
        <div className={cn('grid gap-4', practicePreview && 'lg:grid-cols-[3fr_2fr]')}>
          <AiReviewCard short={journey.ai_review_short} long={journey.ai_review_long} />
          {practicePreview && (
            <PracticePreviewCard preview={practicePreview} baseHref={sittingHref(practicePreview.base_elink_id)} />
          )}
        </div>
        <section className="overflow-hidden rounded-2xl border bg-card">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-5 py-3.5">
            <h2 className="font-semibold">{t('exams.journey.sittings.title', { n: sittings.length })}</h2>
            <span className="text-xs text-muted-foreground">{t('exams.journey.sittings.note')}</span>
          </div>
          {sittings.length === 0 ? (
            <p className="px-5 py-8 text-center text-muted-foreground">{t('exams.journey.sittings.empty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <SittingsTable sittings={sittings} hrefOf={(sitting) => sittingHref(sitting.elink_id)} />
            </div>
          )}
        </section>
        <TopicBreakdownCard details={details} />
      </>
    )
  }

  return (
    <>
      <BackLink to={backTo}>{profileLabel(profile.data, profileId)}</BackLink>
      <TitleBar
        title={t('exams.journey.heading', { id: esessId })}
        description={
          header && (
            <span className="flex flex-wrap items-center gap-2">
              <ExamTypeBadge type={header.exam_type} />
              <JourneyStatusPill status={header.status} />
              {(header.ai_title || header.ai_short_text) && (
                <span>{[header.ai_title, header.ai_short_text].filter(Boolean).join(' — ')}</span>
              )}
            </span>
          )
        }
      />
      {header?.practice && (
        <nav aria-label={t('exams.journey.tabsLabel')} className="flex w-max gap-1 rounded-xl bg-muted p-1">
          <TabLink to={journeyPath(ref)} active={!showPractice}>
            {t('exams.journey.tabJourney', { type: t(`exams.types.${type}`) })}
          </TabLink>
          <TabLink to={journeyPath(ref, true)} active={showPractice}>
            {t('exams.journey.tabPractice', {
              score: t('exams.score', {
                correct: header.practice.correct_number,
                total: header.practice.total_questions,
              }),
            })}
          </TabLink>
        </nav>
      )}
      {content}
    </>
  )
}

function TabLink({ to, active, children }: { to: string; active: boolean; children: ReactNode }) {
  return (
    <Link
      to={to}
      replace
      aria-current={active ? 'page' : undefined}
      className={cn(
        'rounded-lg px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground',
        active && 'bg-card text-primary shadow-sm',
      )}
    >
      {children}
    </Link>
  )
}
```

`TitleBar` renders `description` inside a `<p>`, so it only gets inline content (`Badge`/`StatusPill` are inline elements).

- [ ] **Step 9: Register the route**

In `src/app/router.tsx`, add `import JourneyPage from './(dashboard)/exams/journey/page'` and extend the `/exams` children:

```tsx
        children: [
          { index: true, Component: ExamsPage },
          { path: 'journey', Component: JourneyPage, handle: { titleKey: 'exams.journey.title' } satisfies RouteHandle },
        ],
```

- [ ] **Step 10: Build and lint**

Run: `npm run build && npm run lint`
Expected: both succeed.

- [ ] **Step 11: Verify in the browser**

1. From `/exams?profile=<id>`, click a GRADE journey row: URL `…/exams/journey?profile=…&esess=…&type=GRADE`; back link shows "name · code"; header pills; tiles; meta row with "Kết luận".
2. A journey with practice: tabs appear; "Luyện tập" switches the body (network: second detail call with `exam_type: "PRACTICE"`), and Back in the browser leaves the page instead of toggling tabs (`replace`).
3. AI review: a journey with `ai_review_long` collapses to 3 lines and expands; one without shows the empty text.
4. Practice preview card renders weak topics and strong chips; its "Dựa trên lượt #…" link targets `/exams/sitting?…&elink=<base>` (404 page until Task 4).
5. "Theo chủ đề" lists topics weakest first.
6. Bad links: `?profile=1&esess=abc&type=GRADE` → InvalidLink; an esess id of another profile → LoadError with the server message and "Về danh sách hành trình"; `type=ASSESSMENT` for a GRADE journey → LoadError (13721).
7. Console has no errors. Screenshot as proof.

- [ ] **Step 12: Commit**

```bash
git add "src/app/(dashboard)/exams/journey/page.tsx" src/features/exams/ExamNav.tsx src/features/exams/StatTiles.tsx src/features/exams/AiReviewCard.tsx src/features/exams/PracticePreviewCard.tsx src/features/exams/SittingsTable.tsx src/features/exams/TopicBreakdownCard.tsx src/app/router.tsx src/locales/vi.json src/locales/en.json
git commit -m "$(cat <<'EOF'
feat: add exam journey overview screen

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `/exams/sitting` — one sitting, question by question

**Files:**
- Create: `src/features/exams/QuestionCard.tsx`, `src/app/(dashboard)/exams/sitting/page.tsx`
- Modify: `src/app/router.tsx`, `src/locales/vi.json`, `src/locales/en.json`

**Interfaces:**
- Consumes: Task 1 (`sittingDetailQueryOptions`, `journeyPath`, `profileExamsPath`, `positiveIntParam`, `journeyTypeParam`, `gradeLabel`, `gradeLevelLabel`, `profileLabel`, `buildSittingQuestions`, `SittingQuestion`, `QuestionOutcome`, `QUESTION_TYPES`, `profileDetailQueryOptions`); Task 2 (`ExamTypeBadge`, `SittingStatusPill`); Task 3 (`BackLink`, `InvalidLink`, `StatTiles`, `MetaRow`).
- Produces: `QuestionCard({ question: SittingQuestion; sittingGrade: number })`.

- [ ] **Step 1: Add the locale keys for this task**

`src/locales/vi.json`, as the last entries of `exams`:

```json
    "sitting": {
      "title": "Lượt làm bài",
      "heading": "Lượt #{{id}}",
      "loadFailed": "Không tải được lượt làm bài",
      "missing": "Đường dẫn thiếu hoặc sai mã hồ sơ hay mã lượt làm bài.",
      "backToJourney": "Hành trình #{{id}}",
      "backToList": "Về danh sách hành trình",
      "inProgressBanner": "Lượt này chưa nộp: máy chủ chưa gửi đáp án đúng và chưa lưu câu trả lời nào. Đây là đề như trẻ đang thấy.",
      "tiles": {
        "score": "Điểm",
        "correct": "Câu đúng",
        "answered": "Câu đã trả lời",
        "skipped": "Câu bỏ qua",
        "questions": "Số câu của đề",
        "gradeLevel": "Lớp · Mức"
      },
      "meta": {
        "issued": "Phát đề",
        "started": "Bắt đầu",
        "submitted": "Nộp",
        "duration": "Thời gian làm",
        "examId": "Mã đề (exam_id)"
      },
      "duration_other": "{{count}} phút",
      "durationUnderMinute": "dưới 1 phút",
      "filtersLabel": "Lọc câu hỏi",
      "filters": {
        "all": "Tất cả · {{n}}",
        "wrong": "Sai · {{n}}",
        "skipped": "Bỏ qua · {{n}}",
        "correct": "Đúng · {{n}}"
      },
      "servedOrder": "Thứ tự câu và nhãn A/B/C/D đúng như trẻ đã thấy.",
      "empty": "Lượt này không có câu hỏi nào để hiển thị.",
      "filterEmpty": "Không có câu nào trong nhóm này."
    },
    "question": {
      "number": "Câu {{number}}",
      "outcomes": { "correct": "Đúng", "wrong": "Sai", "skipped": "Bỏ qua" },
      "types": {
        "ARITHMETIC": "Tính toán",
        "COUNT": "Đếm hình",
        "PICK_BY_ICON": "Chọn theo hình",
        "IDENTIFY_SHAPE": "Nhận biết hình"
      },
      "probe": "{{grade}} ↑ câu thăm dò",
      "right": "Đáp án đúng",
      "picked": "Con chọn",
      "rightAndPicked": "Đáp án đúng · Con chọn",
      "noOptions": "Không còn đề gốc để hiện các phương án.",
      "pickedAnswer": "Con chọn: {{answer}}",
      "rightAnswer": "Đáp án đúng: {{answer}}"
    }
```

`src/locales/en.json`:

```json
    "sitting": {
      "title": "Sitting",
      "heading": "Sitting #{{id}}",
      "loadFailed": "Couldn't load the sitting",
      "missing": "The link is missing or has a wrong profile or sitting.",
      "backToJourney": "Journey #{{id}}",
      "backToList": "Back to the journeys",
      "inProgressBanner": "This sitting is not submitted: the server sends no answer key and has saved no answers yet. This is the paper as the child sees it.",
      "tiles": {
        "score": "Score",
        "correct": "Correct",
        "answered": "Answered",
        "skipped": "Skipped",
        "questions": "Questions on the paper",
        "gradeLevel": "Grade · Level"
      },
      "meta": {
        "issued": "Issued",
        "started": "Started",
        "submitted": "Submitted",
        "duration": "Time taken",
        "examId": "Paper (exam_id)"
      },
      "duration_one": "{{count}} minute",
      "duration_other": "{{count}} minutes",
      "durationUnderMinute": "under a minute",
      "filtersLabel": "Filter questions",
      "filters": {
        "all": "All · {{n}}",
        "wrong": "Wrong · {{n}}",
        "skipped": "Skipped · {{n}}",
        "correct": "Correct · {{n}}"
      },
      "servedOrder": "Question order and A/B/C/D labels are exactly as the child saw them.",
      "empty": "This sitting has no questions to show.",
      "filterEmpty": "No question in this group."
    },
    "question": {
      "number": "Question {{number}}",
      "outcomes": { "correct": "Correct", "wrong": "Wrong", "skipped": "Skipped" },
      "types": {
        "ARITHMETIC": "Arithmetic",
        "COUNT": "Counting",
        "PICK_BY_ICON": "Pick by picture",
        "IDENTIFY_SHAPE": "Identify the shape"
      },
      "probe": "{{grade}} ↑ probe question",
      "right": "Right answer",
      "picked": "Child's pick",
      "rightAndPicked": "Right answer · Child's pick",
      "noOptions": "The original paper is gone, so the options can't be shown.",
      "pickedAnswer": "Child's pick: {{answer}}",
      "rightAnswer": "Right answer: {{answer}}"
    }
```

- [ ] **Step 2: Create `src/features/exams/QuestionCard.tsx`**

```tsx
import { ShapesIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { PillTone } from '@/components/StatusPill'
import { StatusPill } from '@/components/StatusPill'
import { QUESTION_TYPES } from '@/types/Exam'
import { cn } from '@/utils/Helpers'
import type { QuestionOutcome, SittingQuestion } from './ExamHelpers'
import { gradeLabel } from './ExamHelpers'

const outcomeBorder: Record<QuestionOutcome, string> = {
  correct: 'border-l-success',
  wrong: 'border-l-destructive',
  skipped: 'border-l-warning',
  unanswered: 'border-l-border',
}

const outcomeTone: Record<Exclude<QuestionOutcome, 'unanswered'>, PillTone> = {
  correct: 'success',
  wrong: 'danger',
  skipped: 'warning',
}

/** One question as the child saw it, with the right answer and their pick marked once submitted. */
export function QuestionCard({ question, sittingGrade }: { question: SittingQuestion; sittingGrade: number }) {
  const { t } = useTranslation()
  const marked = question.outcome !== 'unanswered'
  const type = QUESTION_TYPES.find((option) => option === question.type)

  return (
    <article className={cn('overflow-hidden rounded-2xl border border-l-4 bg-card', outcomeBorder[question.outcome])}>
      <header className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-5 py-3">
        <h3 className="mr-1 font-bold">{t('exams.question.number', { number: question.number })}</h3>
        {question.outcome !== 'unanswered' && (
          <StatusPill tone={outcomeTone[question.outcome]}>{t(`exams.question.outcomes.${question.outcome}`)}</StatusPill>
        )}
        {type && <StatusPill tone="neutral">{t(`exams.question.types.${type}`)}</StatusPill>}
        {question.topic && <StatusPill tone="neutral">{question.topic}</StatusPill>}
        {question.grade !== undefined &&
          (question.grade > sittingGrade ? (
            <StatusPill tone="info">{t('exams.question.probe', { grade: gradeLabel(t, question.grade) })}</StatusPill>
          ) : (
            <StatusPill tone="neutral">{gradeLabel(t, question.grade)}</StatusPill>
          ))}
      </header>
      <div className="flex flex-col gap-3.5 px-5 py-4">
        <p className="text-[17px] leading-relaxed">{renderRichText(question.name)}</p>
        {question.answers.length > 0 ? (
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {question.answers.map((answer) => {
              const isRight = marked && answer.label === question.rightLabel
              const isPicked = marked && answer.label === question.selectedLabel
              const wrongPick = isPicked && !isRight
              return (
                <li
                  key={answer.label}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border-[1.5px] px-3.5 py-2.5',
                    isRight && 'border-success bg-success-surface',
                    wrongPick && 'border-destructive bg-destructive-surface',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-7 shrink-0 items-center justify-center rounded-full bg-muted font-bold',
                      isRight && 'bg-success text-primary-foreground',
                      wrongPick && 'bg-destructive text-primary-foreground',
                    )}
                  >
                    {answer.label}
                  </span>
                  <span className="min-w-0 break-words">{renderRichText(answer.content)}</span>
                  {(isRight || isPicked) && (
                    <span
                      className={cn('ml-auto shrink-0 text-xs font-semibold', isRight ? 'text-success' : 'text-destructive')}
                    >
                      {t(
                        isRight && isPicked
                          ? 'exams.question.rightAndPicked'
                          : isRight
                            ? 'exams.question.right'
                            : 'exams.question.picked',
                      )}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">{t('exams.question.noOptions')}</span>
            {question.selectedLabel && (
              <span>
                {t('exams.question.pickedAnswer', {
                  answer: answerText(question.selectedLabel, question.selectedContent),
                })}
              </span>
            )}
            {question.rightLabel && (
              <span>
                {t('exams.question.rightAnswer', { answer: answerText(question.rightLabel, question.rightContent) })}
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  )
}

function answerText(label: string, content?: string) {
  return content ? `${label}. ${content}` : label
}

/** Emoji render as text; [icon:NAME] tokens (drawn by the app) become a chip with the icon name. */
function renderRichText(text: string): ReactNode[] {
  return text.split(/(\[icon:[^\]]+\])/).map((part, index) => {
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
  })
}
```

- [ ] **Step 3: Create `src/app/(dashboard)/exams/sitting/page.tsx`**

```tsx
import { useQuery } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import { InfoIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { LoadError } from '@/components/LoadError'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { TitleBar } from '@/features/dashboard/TitleBar'
import { ExamTypeBadge, SittingStatusPill } from '@/features/exams/ExamBadges'
import {
  buildSittingQuestions,
  gradeLevelLabel,
  journeyTypeParam,
  positiveIntParam,
  profileLabel,
} from '@/features/exams/ExamHelpers'
import { BackLink, InvalidLink } from '@/features/exams/ExamNav'
import { journeyPath, profileExamsPath, sittingDetailQueryOptions } from '@/features/exams/ExamsApi'
import { QuestionCard } from '@/features/exams/QuestionCard'
import { MetaRow, StatTiles } from '@/features/exams/StatTiles'
import { profileDetailQueryOptions } from '@/features/profiles/ProfilesApi'
import { cn, formatServerTime, parseServerTime } from '@/utils/Helpers'

const FILTERS = ['all', 'wrong', 'skipped', 'correct'] as const
type Filter = (typeof FILTERS)[number]

/** One sitting: the paper as served, joined with the child's answers. */
export default function SittingPage() {
  const { t, i18n } = useTranslation()
  const [params] = useSearchParams()
  const profileId = positiveIntParam(params.get('profile'))
  const elinkId = positiveIntParam(params.get('elink'))
  // Only for the back link: the sitting response has no esess_id.
  const esessId = positiveIntParam(params.get('esess'))
  const journeyType = journeyTypeParam(params.get('type'))
  const valid = profileId !== null && elinkId !== null

  const [filter, setFilter] = useState<Filter>('all')
  const profile = useQuery({ ...profileDetailQueryOptions(profileId ?? 0), enabled: profileId !== null })
  const detail = useQuery({ ...sittingDetailQueryOptions(profileId ?? 0, elinkId ?? 0), enabled: valid })

  if (!valid) return <InvalidLink message={t('exams.sitting.missing')} />

  const sitting = detail.data?.sitting
  const back =
    esessId !== null && journeyType !== null
      ? {
          to: journeyPath({ profileId, esessId, type: journeyType }, sitting?.exam_type === 'PRACTICE'),
          label: t('exams.sitting.backToJourney', { id: esessId }),
        }
      : { to: profileExamsPath(profileId), label: profileLabel(profile.data, profileId) }

  let content: ReactNode
  if (detail.isError && !detail.data) {
    content = (
      <div className="flex flex-col gap-3">
        <LoadError
          title={t('exams.sitting.loadFailed')}
          error={detail.error}
          onRetry={() => void detail.refetch()}
          retrying={detail.isFetching}
        />
        <Button asChild variant="outline" className="self-start">
          <Link to={profileExamsPath(profileId)}>{t('exams.sitting.backToList')}</Link>
        </Button>
      </div>
    )
  } else if (!detail.data) {
    content = (
      <div className="flex flex-col gap-4" aria-busy>
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    )
  } else {
    const { sitting: loaded, details } = detail.data
    const questions = buildSittingQuestions(loaded, details)
    const submitted = loaded.status === 'SUBMITTED'
    const counts: Record<Filter, number> = {
      all: questions.length,
      wrong: questions.filter((q) => q.outcome === 'wrong').length,
      skipped: questions.filter((q) => q.outcome === 'skipped').length,
      correct: questions.filter((q) => q.outcome === 'correct').length,
    }
    const shown = filter === 'all' || !submitted ? questions : questions.filter((q) => q.outcome === filter)

    content = (
      <>
        {submitted && loaded.result ? (
          <>
            <StatTiles
              tiles={[
                { label: t('exams.sitting.tiles.score'), value: `${loaded.result.score_percentage}%`, highlight: true },
                { label: t('exams.sitting.tiles.correct'), value: loaded.result.correct_number },
                { label: t('exams.sitting.tiles.answered'), value: loaded.result.total_questions },
                { label: t('exams.sitting.tiles.skipped'), value: loaded.result.skipped_number },
                { label: t('exams.sitting.tiles.questions'), value: loaded.num_questions },
                {
                  label: t('exams.sitting.tiles.gradeLevel'),
                  value: <span className="text-lg">{gradeLevelLabel(t, loaded.grade, loaded.level)}</span>,
                },
              ]}
            />
            <MetaRow
              items={[
                { label: t('exams.sitting.meta.issued'), value: formatServerTime(loaded.create_dt, i18n.language) },
                { label: t('exams.sitting.meta.started'), value: formatServerTime(loaded.started_dt, i18n.language) },
                { label: t('exams.sitting.meta.submitted'), value: formatServerTime(loaded.submitted_dt, i18n.language) },
                { label: t('exams.sitting.meta.duration'), value: durationText(t, loaded.started_dt, loaded.submitted_dt) },
                { label: t('exams.sitting.meta.examId'), value: <span className="font-mono">{loaded.exam_id}</span> },
              ]}
            />
          </>
        ) : (
          <div role="status" className="flex items-start gap-2.5 rounded-xl bg-info-surface px-4 py-3 text-sm text-info">
            <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{t('exams.sitting.inProgressBanner')}</span>
          </div>
        )}

        {questions.length === 0 ? (
          <p className="rounded-2xl border bg-card px-5 py-8 text-center text-muted-foreground">
            {t('exams.sitting.empty')}
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              {submitted ? (
                <div role="group" aria-label={t('exams.sitting.filtersLabel')} className="flex gap-1 rounded-xl bg-muted p-1">
                  {FILTERS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={filter === option}
                      onClick={() => setFilter(option)}
                      className={cn(
                        'rounded-lg px-3.5 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground',
                        filter === option && 'bg-card text-primary shadow-sm',
                      )}
                    >
                      {t(`exams.sitting.filters.${option}`, { n: counts[option] })}
                    </button>
                  ))}
                </div>
              ) : (
                <span />
              )}
              <span className="text-xs text-muted-foreground">{t('exams.sitting.servedOrder')}</span>
            </div>
            {shown.length === 0 ? (
              <p className="rounded-2xl border bg-card px-5 py-8 text-center text-muted-foreground">
                {t('exams.sitting.filterEmpty')}
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {shown.map((question) => (
                  <QuestionCard key={question.number} question={question} sittingGrade={loaded.grade} />
                ))}
              </div>
            )}
          </>
        )}
      </>
    )
  }

  return (
    <>
      <BackLink to={back.to}>{back.label}</BackLink>
      <TitleBar
        title={t('exams.sitting.heading', { id: elinkId })}
        description={
          sitting && (
            <span className="flex flex-wrap items-center gap-2">
              <ExamTypeBadge type={sitting.exam_type} />
              <SittingStatusPill status={sitting.status} />
              {(sitting.ai_title || sitting.ai_short_text) && (
                <span>{[sitting.ai_title, sitting.ai_short_text].filter(Boolean).join(' — ')}</span>
              )}
            </span>
          )
        }
      />
      {content}
    </>
  )
}

function durationText(t: TFunction, started?: string, finished?: string): string {
  const start = parseServerTime(started)
  const end = parseServerTime(finished)
  if (!start || !end) return '—'
  const minutes = Math.round((end.getTime() - start.getTime()) / 60_000)
  return minutes < 1 ? t('exams.sitting.durationUnderMinute') : t('exams.sitting.duration', { count: minutes })
}
```

- [ ] **Step 4: Register the route**

In `src/app/router.tsx`, add `import SittingPage from './(dashboard)/exams/sitting/page'` and append to the `/exams` children:

```tsx
          { path: 'sitting', Component: SittingPage, handle: { titleKey: 'exams.sitting.title' } satisfies RouteHandle },
```

- [ ] **Step 5: Build and lint**

Run: `npm run build && npm run lint`
Expected: both succeed.

- [ ] **Step 6: Verify in the browser**

1. From a journey, open a submitted sitting: back link "Hành trình #…" returns to the same journey (and to the practice tab for a PRACTICE sitting); tiles, meta row (duration in minutes), filter counts add up (`wrong + skipped + correct = all`).
2. Question cards: right option green with "Đáp án đúng", a wrong pick red with "Con chọn", a right pick "Đáp án đúng · Con chọn"; skipped questions show "Bỏ qua" and the right answer; each filter shows only its group.
3. Check the served numbering: for one wrong question, the red option's label equals that question's `selected_label` in the `details[]` of the network response, and the question numbers in `exam.questions` match `details[].question_number`.
4. A question whose `question_grade` is above the sitting's grade shows the "câu thăm dò" pill; a COUNT/PICK_BY_ICON question with `[icon:…]` renders chips.
5. Open an unsubmitted sitting from the journeys-list badge: info banner, no tiles or filter, options unmarked.
6. Bad links: `?profile=1&elink=abc` → InvalidLink; another profile's elink → LoadError + "Về danh sách hành trình"; without `esess`/`type` the back link goes to `/exams?profile=…`.
7. **Cross-cutting checks (whole feature):** sign in as a non-admin (ask the user) → no "Bài kiểm tra" in the sidebar, no clipboard action on Profiles, and `/admin/exams?profile=<id>` shows the 403 message in a LoadError. Switch the locale to English once and skim all three pages for missing keys. Browser Back walks sitting → journey → list. Console has no errors. Screenshots as proof.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(dashboard)/exams/sitting/page.tsx" src/features/exams/QuestionCard.tsx src/app/router.tsx src/locales/vi.json src/locales/en.json
git commit -m "$(cat <<'EOF'
feat: add exam sitting review screen

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

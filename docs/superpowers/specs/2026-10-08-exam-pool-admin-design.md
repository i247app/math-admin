# Exam pool admin screens — design

Date: 2026-10-08 · Status: approved in brainstorming, pending spec review

## Goal

Let admins review the AI-generated question sets in the exam pool, fix wrong questions or answer keys,
and mark sets as verified. This is the manual-review half of the "AI questions can be wrong" plan; it
builds on the exam screens of `2026-10-05-exam-admin-design.md`.

Out of scope: `/exams/pools/generate` (backend may still change), file import/export, deleting sets,
changing a set's shape (question count, numbering, answer labels), editing a set's title/short text.

## Backend contract

math-svr commits `c72cc7a` and `edb5922` (`internal/bootstrap/routes/routes.go:262`). All behind
`adminOrApiKeyMiddleware` (role ADMIN, else `403`). Not under `/admin/`.

| Route | Request | Response |
|---|---|---|
| `/exams/pools/list` | `{ exam_types?: ExamType[], grade?: 0–5, is_verified?: boolean, page, size }` — OFFSET only, newest first | `{ exam_pools: ExamPool[] (no questions), pagination }` |
| `/exams/pools/detail` | `{ exam_id }` | `{ exam_pool: ExamPool (with questions) }` |
| `/exams/pools/mark-verify` | `{ exam_id, is_verify: boolean }` — true: `verified_count` 0 → 1 (a verified set keeps its count); false: → 0 | `{ exam_pool }` (with questions) |
| `/exams/pools/verify` | `{ exam_id, questions: ExamQuestion[] }` — the WHOLE corrected set; replaces the stored one and adds 1 to `verified_count` | `{ exam_pool }` (with questions) |

**Backend change required (math-svr session):** `is_verified` does not exist yet. Add
`IsVerified *bool \`json:"is_verified,omitempty"\`` to `ListExamPoolsReq`: true → `verified_count > 0`,
false → `verified_count = 0`, nil → no filter. Until it lands, Go ignores the unknown field and the
verified filter silently does nothing, so the filter's browser check waits for that change.
Optional, same session: a `level` filter (GRADE has ~10 levels per grade).

Facts the UI relies on (`internal/application/dto/exam/exam_dto.go`, `command/exam/verify_exam_pool_command.go`):

- `ExamPool`: `exam_id, exam_type, grade, level?, num_questions (REQUESTED; the real set can be shorter),
  semester?, program?, req_extras? (cache tag), ai_title?, ai_short_text?, questions?, verified_count
  (0 = not verified), status? (exam_status), create_dt (server time layout)`.
- `questions` are in **stored (canonical) order with the answer key** — not shuffled.
- `verify` keeps the set's shape: same number of questions, same `question_number`s, same answer labels
  per question, `right_answer_label` one of them, `question_name` non-empty — else
  `EXAM_POOL_INVALID_QUESTIONS` 13742. Everything else is written **as sent**: the server does not
  recompute `right_answer_content` and does not check answer contents.
- The new key applies to every sitting graded from now on, including ones already handed out.
  Submitted sittings keep their snapshot (`ma_exam_session_lines`).
- At submit, `question_topic` is copied into `VARCHAR(64)` and the right/selected answer content into
  `VARCHAR(255)`. Longer values would break or truncate grading, so the editor caps them (characters).
- No version check: two admins saving the same set → last write wins. Accepted, noted only.
- `verified_count` is informational today: the cache read does not prefer verified sets.
- Question types now include `FRACTION` (LaTeX `\frac{a}{b}` inside `$…$`). The admin shows the text raw.
- Errors: `EXAM_NOT_FOUND` 13700 (unknown or deleted `exam_id`), `EXAM_MISSING_EXAM_ID` 13740,
  `EXAM_MISSING_IS_VERIFY` 13741, `EXAM_POOL_INVALID_QUESTIONS` 13742, `EXAM_INVALID_GRADE`, `EXAM_INVALID_EXAM_TYPE` 13708.

## Architecture

| Part | File | Content |
|---|---|---|
| Wire types | `src/types/Exam.ts` | `ExamPool`, `ListExamPoolsRequest/Response`, `ExamPoolResponse`, `VerifyExamPoolRequest`; add `FRACTION` to `QUESTION_TYPES` |
| API | `src/features/exams/ExamPoolsApi.ts` (new) | `examPoolsListQueryOptions(request)` (keepPreviousData), `examPoolDetailQueryOptions(examId)`, `useMarkExamPoolVerify()`, `useVerifyExamPool()`; `examPoolPath(examId)`. Mutations write the returned `exam_pool` into the detail cache and invalidate the list. |
| Draft logic | `src/features/exams/ExamPoolDraft.ts` (new, pure) | `toDraft(questions)`, `draftErrors(draft)`, `changedNumbers(original, draft)`, `toVerifyQuestions(original, draft)` |
| Components | `src/features/exams/` | `ExamPoolsTable`, `VerifiedPill`, `PoolQuestionEditor` (one question's form), reuse `ExamTypeBadge`, `QuestionCard`, `MetaRow`, `BackLink`, `InvalidLink` |
| QuestionCard | `src/features/exams/QuestionCard.tsx` | new outcome `key`: neutral border, no result pill, right option green "Đáp án đúng" |
| Pages | `src/app/(dashboard)/exams/pools/page.tsx`, `exams/pools/detail/page.tsx` | |
| Router | `src/app/router.tsx` | under `/exams`: `pools` (index → list, `nav.examPools`) and `pools/detail` (`exams.pools.detail.title`) |
| Sidebar | `src/features/dashboard/Sidebar.tsx` | "Bài kiểm tra" becomes an admin-only `NavGroup` (basePath `/exams`): "Bài làm học sinh" `/exams` (active on `/exams`, `/exams/journey`, `/exams/sitting`) and "Kho đề" `/exams/pools` |
| i18n | `src/locales/vi.json`, `en.json` | `nav.examSittings`, `nav.examPools`; `exams.pools.*`; `exams.question.types.FRACTION` |
| Docs | `docs/API-CONTRACT.md`, `CLAUDE.md` | §4: the four pool routes, shape rule, column caps; §5 note; folder list mentions pools |

`nav.exams` stays the group label. The Profiles row action "Xem bài làm" still links `/exams?profile=…`.

Labels: verified "Đã xác minh · n lần" (success) / "Chưa xác minh" (warning); "Sửa đề", "Lưu & xác minh",
"Đánh dấu đã xác minh", "Bỏ xác minh". Grade/level/type labels as in the exam screens.

## Screens

Mockups: `.superpowers/brainstorm/88645-1791454464/content/screen{4,5}-*.html` (local, git-ignored).

### 4. `/exams/pools` — the pool

URL state: `type` (ASSESSMENT|GRADE|PRACTICE), `grade` (0–5), `verified` (`yes`|`no`), `page`.

- Title "Kho đề" + one-line description.
- Filters: type segmented (Tất cả loại / Đánh giá năng lực / Ôn theo lớp / Luyện tập), grade `Select`
  (Tất cả lớp / Mẫu giáo / Lớp 1–5), verified segmented (Tất cả / Chưa xác minh / Đã xác minh).
  Any filter change resets `page`.
- `ExamPoolsTable` (`size` 20, `DataPagination`): Mã đề (`exam_id`, link) · Tên đề (`ai_title` bold +
  `ai_short_text` muted; "—" when both absent) · Loại · Lớp · Mức · Số câu (`num_questions`) ·
  Xác minh (`VerifiedPill`) · Ngày tạo. Whole row links to the detail.
- Empty: "Không có bộ đề nào khớp bộ lọc".

### 5. `/exams/pools/detail` — one set

URL state: `exam` (exam_id). Back link to `/exams/pools` (browser Back keeps the list filters).

**View mode**
- Header: "Đề #id", type badge, `VerifiedPill`, `ai_title` — `ai_short_text`.
  Actions: "Đánh dấu đã xác minh" when `verified_count = 0`, else "Bỏ xác minh" (confirm dialog: the
  count n resets to 0, questions unchanged); "Sửa đề" (primary).
- Meta row: Lớp · Mức, Số câu (`questions.length` / `num_questions` requested), Học kỳ, Chương trình,
  Lần xác minh, Ngày tạo, Cache tag (mono; "—" when absent).
- Question cards (`QuestionCard`, outcome `key`), stored order; probe pill when `question_grade > grade`.

**Edit mode** (local state, not in the URL)
- Sticky bar: "Đang sửa đề #id", "n câu đã sửa", "n lỗi", Hủy, Lưu & xác minh (disabled while there are
  errors, no changes, or saving).
- Banner: only content can change; count, order and A–D labels are fixed by the server.
- Every question renders as `PoolQuestionEditor`: question text `Textarea` with a live preview
  (emoji, `[icon:NAME]` chips); one row per answer: radio (= right answer), label, content `Input`;
  topic `Input`. Type and grade are shown as pills, not editable. A changed question gets an info border
  and "Đã sửa" pill; a question with an error gets a danger border and the messages under the field.
- Validation (`draftErrors`, all client-side, values trimmed): question text required; every answer
  content required and ≤ 255 characters; answer contents unique within the question (exact match after trimming); topic ≤ 64
  characters; a right answer is selected.
- Save → confirm dialog listing the changed questions, "the new key also applies to sittings in progress;
  submitted sittings keep their score", and "Lần xác minh: n → n+1" → `verify` with
  `toVerifyQuestions`: the original questions in order with the edited `question_name`, answer contents,
  `right_answer_label`, `question_topic`, and **`right_answer_content` derived from the chosen answer**;
  `question_number`, `question_type`, `question_grade`, labels copied unchanged.
- No changes → save disabled (use "Đánh dấu đã xác minh" to record a check that fixed nothing).
- Hủy with changes → confirm "Bỏ các thay đổi?"; without changes → leave edit mode.
- Leaving the page with changes: `useBlocker` (data router) asks first; `beforeunload` covers reload/close.

## Error handling

All HTTP through `apiPost`; 401 is global. Failed mutations toast `mmessage` automatically.

| Case | Behaviour |
|---|---|
| Non-admin (403) | `LoadError` with `mmessage`; sidebar group hidden |
| Missing / invalid `exam` param | `InvalidLink` back to `/exams/pools` |
| Unknown or deleted set (13700) | `LoadError` + button back to `/exams/pools` |
| Invalid `type` / `grade` / `verified` param | treated as absent (no filter) |
| Network / 5xx on a read | `LoadError` with retry (`refetch`) |
| Filter/page change | keepPreviousData, table dims while fetching |
| Page past the end | jump to the last real page with `replace` (as on the other lists) |
| `verify` fails (13742 or any error) | toast; stay in edit mode with the draft intact |
| `verify` succeeds | toast "Đã lưu và xác minh đề #id"; detail cache ← response; list invalidated; back to view mode |
| `mark-verify` fails / succeeds | toast; on success detail cache ← response, list invalidated |
| Set has no questions or a question has no answers | view: cards as stored (no-options text); "Sửa đề" disabled with a tooltip |

## Verification

No test runner (out of scope). Proof:

1. `npm run build` and `npm run lint`.
2. Local math-svr, ADMIN account: list filters (type, grade; verified once the backend field exists),
   paging, page past the end; detail of ASSESSMENT (probe pills) and GRADE sets; mark / unmark verified
   (count 0 → 1 → 0); edit two questions (text, an answer, the right answer, topic) → save → reload shows
   the change and `verified_count` + 1, and the stored `right_answer_content` matches the chosen answer
   (check `ma_exam_pools.ai_questions_json`); validation errors block saving; cancel and navigate-away
   guards; `exam=abc` and an unknown id.
3. Non-admin: sidebar group hidden, direct URL shows the 403 message.

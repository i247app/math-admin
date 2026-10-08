# Exam admin screens — design

Date: 2026-10-05 · Status: approved in brainstorming, pending spec review

## Goal

Give admins a read-only view of any child's exam data: the journeys (exam sessions) of a
profile, one journey's overview, and one sitting question by question. Used for support
("why is my child's score X?") and for checking the AI-generated papers.

Out of scope: any write (mark/cancel a journey, regenerate AI review), a platform-wide list of
all exam sessions, progress charts (`/exams/analytics/progress`, `/exams/journey/progress`,
`/exams/grade/*`).

## Backend contract

math-svr commit `c799dd4` added two admin routes (`internal/bootstrap/routes/routes.go:257`).
Both sit behind `AdminRequiredMiddleware` (role ADMIN, else `403`), then run the ordinary owner
service method as the profile's owner (`Service.actAsOwner`, `internal/module/exam/service_helper.go`,
logged per call). Same body and response as the owner routes.

| Route | Request | Response |
|---|---|---|
| `/admin/exams/sessions/list` | `{ profile_id, exam_types?: ("ASSESSMENT"\|"GRADE")[], status?: "ACTIVE"\|"COMPLETE"\|"CANCEL", pagination_type: "OFFSET", page, size }` | `{ exam_sessions: ExamSession[], pagination }` |
| `/admin/exams/sessions/detail` (journey) | `{ profile_id, esess_id, exam_type?: "ASSESSMENT"\|"GRADE"\|"PRACTICE" }` — omitted type = ASSESSMENT | `{ exam_session, exams: ExamSitting[] (cards, no questions), details: ExamAnswerDetail[], practice_preview? }` |
| `/admin/exams/sessions/detail` (sitting) | `{ profile_id, elink_id }` | `{ exam: ExamSitting (with questions), details: ExamAnswerDetail[] }` |

Facts the UI relies on (DTOs in `internal/application/dto/exam/exam_dto.go`):

- `ExamSession` (journey): `esess_id, exam_type, status, total_questions, correct_number, skipped_number,
  score_percentage?, review?, esess_flag (bool|null — GRADE pass verdict), ai_title?, ai_short_text?,
  ai_review_short?, ai_review_long?, grade?, level?, last_submitted_dt?, ended_dt?, create_dt,
  practice?: ExamSession, in_progress_exams?: ExamSitting[]`.
  `in_progress_exams` is filled **only by the list route**; the journey detail does not return it.
- `ExamSitting`: `elink_id, exam_id, profile_id, exam_type, grade, level?, ai_title?, ai_short_text?,
  num_questions, questions?, result? {total_questions, correct_number, skipped_number, score_percentage},
  status ("IN_PROGRESS"|"SUBMITTED"), started_dt?, submitted_dt?, create_dt`. It carries **no `esess_id`**.
- `questions[]` (`ExamQuestion`): `question_number, question_type?, question_name, answers: {label, content}[],
  right_answer_label?, right_answer_content?, question_topic?, question_grade?` — served order and labels
  (shuffled per sitting). The answer key is present only when the sitting is SUBMITTED.
- `details[]` (`ExamAnswerDetail`): one row per **answered** question: `elink_id, question_number,
  question_type?, question_name?, answers?, question_topic?, question_grade?, right_answer_label?,
  right_answer_content?, selected_label, selected_content?, is_correct`. Skipped questions have no row.
  `answers` is omitted when the question set can no longer be found.
- `practice_preview`: `{ mode: "RETRY_WEAK"|"ADVANCE", base_elink_id, weak_topics: {topic, wrong, answered}[], strong_topics: string[] }`.
- Question types: `ARITHMETIC, COUNT, PICK_BY_ICON, IDENTIFY_SHAPE`; text may embed emoji and `[icon:NAME]` tokens.
- Grade is 0–5 (0 = kindergarten), level 0–9 shown raw. Times use the server layout → `formatServerTime`;
  empty string = absent.
- Errors: `EXAM_PROFILE_NOT_FOUND` 13715, `EXAM_ATTEMPT_NOT_FOUND` 13701, `EXAM_ATTEMPT_NOT_OWNED` 13702,
  `EXAM_JOURNEY_NOT_FOUND` 13721, `EXAM_JOURNEY_NOT_OWNED` 13722, `EXAM_INVALID_EXAM_TYPE` 13708.

## Architecture

| Part | File | Content |
|---|---|---|
| Wire types | `src/types/Exam.ts` | `ExamType`, `JourneyStatus`, `SittingStatus`, `ExamSession`, `ExamSitting`, `ExamQuestion`, `ExamAnswerDetail`, `PracticePreview`, request/response types |
| API | `src/features/exams/ExamsApi.ts` | `examSessionsListQueryOptions`, `journeyDetailQueryOptions`, `sittingDetailQueryOptions`; path helpers `profileExamsPath`, `journeyPath`, `sittingPath`. No mutations. |
| Pure helpers | `src/features/exams/ExamHelpers.ts` | `buildSittingQuestions(exam, details)` (merge), `topicBreakdown(details)`, `gradeLabelKey(grade)` |
| Components | `src/features/exams/` | `ProfilePicker`, `ProfileSummaryCard`, `JourneysTable`, `ExamBadges` (type / status / verdict pills, score cell), `StatTiles`, `AiReviewCard`, `PracticePreviewCard`, `TopicBreakdownCard`, `SittingsTable`, `QuestionCard` |
| Profile read | `src/features/profiles/ProfilesApi.ts` | add `profileDetailQueryOptions(profileId)` → `/profiles/detail` |
| Pages | `src/app/(dashboard)/exams/page.tsx`, `exams/journey/page.tsx`, `exams/sitting/page.tsx` | |
| Router | `src/app/router.tsx` | `/exams` (handle `nav.exams`) with `index` → list, `journey` (`exams.journey.title`), `sitting` (`exams.sitting.title`) |
| Sidebar | `src/features/dashboard/Sidebar.tsx` | top-level item "Bài kiểm tra" (`ClipboardCheckIcon`) after Devices, rendered only when `role === 'ADMIN'` |
| Shortcut | `src/features/profiles/ProfilesTable.tsx` | row action "Xem bài làm" → `/exams?profile=<id>`, admins only |
| i18n | `src/locales/vi.json`, `en.json` | `nav.exams`, `exams.*` |
| Docs | `docs/API-CONTRACT.md`, `CLAUDE.md` | §4 exam section: the two admin routes and shapes; §5: admin reads are no longer blocked; `Exam.ts` in the types list, `exams` in the folder list |

Authorization is real here (backend gate). Hiding the sidebar item only keeps the UI tidy for
non-admins; a direct URL gets `403` and the page shows `LoadError` with the server message.

Labels: `ASSESSMENT` "Đánh giá năng lực", `GRADE` "Ôn theo lớp", `PRACTICE` "Luyện tập";
`ACTIVE` "Đang diễn ra", `COMPLETE` "Hoàn thành", `CANCEL` "Đã hủy"; `IN_PROGRESS` "Đang làm dở",
`SUBMITTED` "Đã nộp"; `esess_flag` true/false "Đạt"/"Chưa đạt"; practice mode `RETRY_WEAK` "Ôn lại chỗ yếu",
`ADVANCE` "Nâng cao". Grade 0 "Mẫu giáo", 1–5 "Lớp n"; level "Mức n" (raw).

## Screens

Mockups: `.superpowers/brainstorm/82644-1791186531/content/screen{1,2,3}-*.html` (local, git-ignored).

### 1. `/exams` — pick a profile, list its journeys

URL state: `profile`, `type` (ASSESSMENT|GRADE), `status`, `page`.

- **No profile:** lookup card with a mode select — "Tìm theo tên / mã" (`/profiles/list` `search`, first 8
  results shown inline: avatar, name, role, code, profile id, account id, grade, school, "Chọn") or
  "Profile ID" (number → sets `profile`). Empty state with the NUMI mascot below.
- **Profile chosen:** `ProfileSummaryCard` from `/profiles/detail` (name, role, status, default star,
  code + id, account uid + phone/email, program/grade/semester, school, "Đổi hồ sơ" clears `profile`).
- **Journeys table** (`size` 20, `DataPagination`): Mã (`esess_id`) · Hành trình (type pill + `ai_title`) ·
  Lớp · Mức · Trạng thái (status pill; "Đạt"/"Chưa đạt" pill when `esess_flag` is not null; "n bài làm dở"
  badge when `in_progress_exams` is non-empty) · Kết quả (`correct/total`, %, bar, skipped) · Luyện tập
  (`practice` correct/total, % or —) · Nộp gần nhất · Bắt đầu. Filters: type, status. Whole row links to the
  journey. The in-progress badge links straight to the sitting when there is one, and opens a
  `DropdownMenu` of them (id, type, started) when there are several — the server no longer limits a journey
  to one open sitting (retired code 13729). This badge is the only way into an in-progress sitting.

### 2. `/exams/journey` — one journey

URL state: `profile`, `esess`, `type` (the journey's type, ASSESSMENT|GRADE — always set by our links),
`view=practice` (optional).

- The main row query (`exam_type = type`) always runs: header, tab visibility, back link.
  With `view=practice` a second query (`exam_type = PRACTICE`) feeds the body.
- Header: back link to `/exams?profile=…` (profile name + code from `/profiles/detail`), "Hành trình #id",
  type + status pills, `ai_title` — `ai_short_text`.
- Tabs "Hành trình · <type>" / "Luyện tập · c/t" — shown only when the main row has `practice`.
- Stat tiles: score %, correct, answered, skipped, grade, level. Meta row: started (`create_dt`),
  last submitted, ended, GRADE verdict.
- Two-column: `AiReviewCard` (short, expandable long; empty text when absent) and `PracticePreviewCard`
  (mode pill, weak topics with wrong/answered bars, strong topic chips, base sitting link); hidden when
  `practice_preview` is absent.
- `SittingsTable` (`exams[]`, chronological): Lượt · Tiêu đề · Lớp · Mức · Số câu · Kết quả · Bắt đầu · Nộp lúc → sitting.
- `TopicBreakdownCard`: per `question_topic` from `details[]`, correct / answered, sorted by accuracy ascending;
  rows without a topic grouped as "Không rõ chủ đề".

### 3. `/exams/sitting` — one sitting

URL state: `profile`, `elink`, plus optional `esess` + `type` (+ `view=practice` for a PRACTICE sitting)
used only for the back link; without them the back link goes to `/exams?profile=…`.

- Header: back link, "Lượt #id", type + status pills, `ai_title` — `ai_short_text`.
- SUBMITTED: stat tiles (score %, correct, answered, skipped, `num_questions`, grade · level), meta row
  (issued `create_dt`, started, submitted, duration = submitted − started, `exam_id`), filter
  "Tất cả / Sai / Bỏ qua / Đúng" with counts, question cards.
- IN_PROGRESS: info banner (no key, no answers saved yet), question cards without marks, no tiles/filter.
- `buildSittingQuestions`: start from `exam.questions` (served order); attach the detail row with the same
  `question_number` → state `correct | wrong | skipped` (no row = skipped; IN_PROGRESS = `unanswered`).
  Detail rows without a matching question are appended. If `exam.questions` is empty (question set gone),
  render from details only: question text, chosen answer, right answer, no option grid.
- `QuestionCard`: number, result pill, type, topic, grade; "câu thăm dò" pill when `question_grade > exam.grade`;
  stem; options grid — right option green "Đáp án đúng", chosen wrong option red "Con chọn", chosen right
  green "Đáp án đúng · Con chọn". Emoji render as text; `[icon:NAME]` tokens render as a small chip with the name.

## Error handling

All HTTP through `apiPost`; 401 is global (token cleared → `/sign-in`).

| Case | Behaviour |
|---|---|
| Non-admin (403) on any page | `LoadError` with `mmessage` |
| Invalid number in a URL param | treated as absent (profile → picker; esess/elink → "Về danh sách" state) |
| Profile id lookup fails (4101 / 13715) | inline `FormAlert` under the lookup; table not shown |
| Search with no text | inline validation, no request; no matches → "Không tìm thấy hồ sơ" in the result area |
| Journey / sitting not found or not this profile's (13721/13722/13701/13702) | `LoadError` + button back to `/exams?profile=…` |
| Network / 5xx | `LoadError` with retry (`refetch`) |
| Filter/page change | `keepPreviousData`, table dims while fetching (same as Devices) |
| Page past the end (server does not clamp) | jump to the last real page with `replace` (same effect as the Profiles page) |
| Practice view requested but the journey has no practice row | tabs hidden, body falls back to the main row |

## Verification

The repo has no test runner, and adding one is out of scope. Proof:

1. `npm run build` (type-check) and `npm run lint`.
2. Run against local math-svr (`npm run dev`, proxy `/go/*`) with an ADMIN account: profile search and
   id lookup, filters and paging, journey with and without practice, both tabs, AI review present/absent,
   a SUBMITTED sitting (correct / wrong / skipped / probe / icon tokens, each filter), an IN_PROGRESS sitting
   from the list badge, deep links opened in a new tab, browser Back across the three pages.
3. Non-admin account: sidebar item and the Profiles row action hidden; direct URL shows the 403 message.
4. Bad URL params (`esess=abc`, an esess of another profile) show the error states above.

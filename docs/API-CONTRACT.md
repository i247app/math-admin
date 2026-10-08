# math-svr API contract (for math-admin)

Extracted from the `math-svr` source on 2026-10-02 (branch `rogue`). The
backend code is authoritative — when this file and the code disagree, check
the file named in each section and update this document.

Backend source: `/Users/anhquoc/Documents/Company/Math/math-svr` (read-only from this repo).

---

## 1. Transport rules (apply to every call)

| Rule | Detail | Source |
|---|---|---|
| Method | **Every route is `POST`** with a JSON body (or multipart for uploads). No path params, no query params. Single-entity reads are `POST /<agg>/detail` with `{"<entity>_id": ...}` in the body. | `internal/bootstrap/routes/routes.go` |
| Auth token | Sent **in the body**, at `metadata.authorization` (`"Bearer <token>"` or the bare token). The `Authorization` HTTP header is **ignored** for REST. | `internal/bootstrap/middleware/gex_session_middleware.go` |
| New token | Every response may carry an `X-Auth-Token` header. When present it **replaces** the stored token — always read it, including on `/auth/login` (the first call mints the session). | same file, ~line 91 |
| HTTP status | **Always 200**, success or error. The outcome is the body's `mstatus`. | `internal/shared/response/response.go` |
| Local server | `SERVER_PORT` (default `8080` in `.env.example`). Use the Vite dev proxy so the browser stays same-origin. | `.env.example` |
| Content-Type | Send exactly `application/json` — no `; charset=utf-8` suffix. Upload handlers (e.g. banners) compare the header by equality and treat anything else as multipart. Let the browser set the multipart boundary (don't set the header for `FormData`). | `internal/module/banner/handler.go` |
| CORS | Backend allows `*` origins, all headers, exposes all headers, no credentials. A proxy is still preferred. | gex `server.go` `SetupServerCORS` |

### Request body shape

```json
{
  "metadata": {
    "authorization": "Bearer <token>",
    "platform": "web",
    "device_uuid": "<stable per-browser uuid, keep in localStorage>",
    "device_name": "math-admin",
    "language": "vi",
    "app_version": "math-admin 0.1.0"
  },
  "...": "route-specific fields at the top level"
}
```

`metadata` fields (all optional, `internal/infrastructure/metadata/metadata.go`):
`trace_id, request_id, app_version, version, build, platform, model_name,
system_version, device_uuid, device_name, device_push_token, language
("vi" | "en" | "vi-VN" | "en-EN"), accept_language, accept, content_type,
ip_address, authorization, user_context {locale, timezone, language}, timestamp`.

**`device_uuid` matters:** login trusts devices by it. Generate one UUID per
browser, persist it, and send it on every request — otherwise every login
asks for OTP again.

### Multipart requests (uploads)

Multipart bodies carry `metadata` as a **form field containing the JSON
string** of the metadata object; the other fields are plain form fields and
the file goes in its named file part.

### Response envelope

Success — the data object is **flattened** into the envelope (non-object data
goes under `result`):

```json
{ "status": "Success", "mstatus": 200, "users": [...], "pagination": {...} }
```

Success codes: `200 SUCCESS`, `201 CREATED`, `202 ACCEPTED/NO_DATA`, `204 NO_CONTENT` (delete-style).
Treat `mstatus` in `200–299` as success.

Error:

```json
{ "mstatus": 4002, "mmessage": "Số điện thoại là bắt buộc", "debug": "phone is required" }
```

- `mmessage` is localized (Vietnamese by default) — show it to the user.
- `debug` is the internal error text — log it, never show it.
- An error response may still carry data fields beside `mstatus`.
- Generic codes: `400 FAIL/BAD_REQUEST`, `401 UNAUTHORIZED` (no/insecure session → send to login), `403 FORBIDDEN`, `404 NOT_FOUND`, `500 INTERNAL_SERVER_ERROR`.
- Per-aggregate codes and messages: `internal/domain/shared/status/code.go`, `message_vn.go`.

### IDs and times

- All ids are JSON **numbers** (int64, minted server-side). Never send an id on create.
  They come from DB sequences (`internal/module/seq`), so they stay far below 2^53 and are
  safe as JavaScript numbers.
- Times (`create_dt`, `modify_dt`, `expires_at`, …) are strings in the Go layout
  `20060102150405.000000` (e.g. `"20261003101500.000000"`) — **not** ISO 8601, no zone
  suffix (`internal/domain/shared/mtime/`, `MathTime.MarshalJSON`). Nullable times are `null`.
  Parse with `parseServerTime` (`src/utils/Helpers.ts`), which reads them as UTC; OTP
  expiry is set from `time.Now().UTC()` so that holds there.

---

## 2. Pagination

Two styles (`internal/shared/pagination/`). Lists that support both take
these top-level request fields:

| Field | Meaning |
|---|---|
| `pagination_type` | `"OFFSET"` or `"CURSOR"`. **Empty = CURSOR.** Admin tables should send `"OFFSET"`. |
| `page`, `size` | OFFSET. `size` outside `[1, 1000]` becomes 20. |
| `size`, `next` / `previous` | CURSOR. `next` = previous response's `end_cursor`, `previous` = its `start_cursor`. Never both (`PAGINATION_PARAMS_CONFLICT`). Cursors are opaque strings. |

Response carries exactly one of:

```json
"pagination": { "page": 1, "size": 20, "take_all": false, "skip": 0,
                "total_count": 57, "total_pages": 3, "has_previous": false, "has_next": true }
"cursor":     { "start_cursor": "…", "end_cursor": "…", "has_next": true, "has_prev": false }
```

Lists with both styles today: `/users/list`, `/exams/sessions/list`.
Other lists (e.g. `/banners/list`) are OFFSET-only: `page` + `size`, response `pagination`.

---

## 3. Auth flow

Source: `internal/module/auth/`, `internal/module/otp/`, `internal/application/dto/{auth,otp}/`.

1. **`POST /auth/login`** — `{ "login_name": "<phone or email>", "password"?: "..." }`
   - Response: `{ is_trusted, required_otp, user }` + `X-Auth-Token` header (store it).
   - `is_trusted: true` → session is now **secure**. Done.
   - `required_otp: true` → session is **unsecure**; continue with step 2.
   - Unknown account → `AUTH_LOGIN_FAILED`. Wrong password (when sent) → `AUTH_INVALID_CREDENTIALS`.
     A password sent for an account with no password on file also fails with `AUTH_INVALID_CREDENTIALS`.
   - `LoginReq.otp_enabled` exists in the DTO but the service ignores it. The DTO comment saying the
     client must re-issue `/auth/login` after OTP is stale: `/otps/verify` secures the session itself.
2. **`POST /otps/send`** — `{ "otp_type": "LOGIN_2FA", "identifier": "<same login_name>" }`
   → `{ expires_at, otp_type, otp_code? }`.
   - Codes are **4 digits** (`OtpCodeLength`) and LOGIN_2FA codes live **2 minutes**
     (`internal/application/command/otp/policy.go`).
   - No resend cooldown: while a PENDING code is still valid, `/otps/send` returns that same code
     and expiry and delivers nothing. A new code is only issued after expiry, so the admin enables
     "resend" only then. Hard cap: 50 sends/hour → `OTP_RATE_LIMITED`.
   - `otp_code` is echoed back because SMS/email dispatch isn't wired on the server yet
     (see `send_otp_command.go` step 5) — the admin shows it in a DEV box when present.
3. **`POST /otps/verify`** — `{ "otp_type": "LOGIN_2FA", "identifier": "...", "otp_code": "1234" }`
   → `{ verified, otp_type, user }`. On success the device becomes trusted and the session **secure**.
   Failures: `OTP_INVALID_CODE` (4706); after 5 wrong tries the code is revoked → `OTP_TOO_MANY_ATTEMPTS`
   (4710). `OTP_EXPIRED` (4707), `OTP_REVOKED` (4709), `OTP_NOT_FOUND` (4701) also mean "request a new code".
4. **`POST /auth/resume-session`** — `{}` → `{ user }` (the `LoginRes` shape). Use on app start to restore the
   session from the stored token; `401` → go to login. No auth middleware — see §5.
5. **`POST /auth/logout`** — `{}`. Clear the stored token afterwards.

`otp_type` values: `LOGIN_2FA, REGISTER, FORGOT_PASSWORD, CHANGE_PASSWORD, VERIFY_EMAIL, VERIFY_PHONE`.

`UserResponse`:

```ts
{ uid: number; name: string; email?: string; is_email_verified: boolean; phone?: string;
  role: "STUDENT" | "TEACHER" | "PARENT" | null;   // null = guest
  identity_code: "GUEST" | "USER" | "VERIFIED" | null;
  avatar_key?: string; avatar_url?: string;          // display avatar_url (presigned, short-lived)
  create_dt: string; modify_dt: string }
```

---

## 4. MVP endpoints

### Users — `internal/application/dto/user/user_dto.go`, `internal/module/user/`

| Route | Request | Response |
|---|---|---|
| `/users/list` 🔒 | `pagination.Request` fields (send `pagination_type: "OFFSET"`) + `roles?: ("STUDENT"\|"TEACHER"\|"PARENT"\|"ADMIN")[]` | `{ users: UserResponse[], pagination? , cursor? }` — active users only, `uid DESC`. |
| `/users/me` | `{ uid }` (despite the name it reads by `uid`; route currently has no auth middleware) | `{ user }` |
| `/users/admin/create` 🛡️ | `{ name, phone?, email?, role?, password?, avatar? }` — phone or email required | `{ user }` |
| `/users/update` 🔒 | `{ uid, name?, email?, phone?, role?, avatar? }` (nil = unchanged) | `{ user }` |
| `/users/soft-delete` 🔒 | `{ uid }` — sets `user_status = DELETED` **and physically deletes all the account's profiles**; no restore endpoint | envelope only |
| `/users/force-delete` 🔒 | `{ uid }` — **physical delete, irreversible**; require a confirm dialog | envelope only |

`/users/list` `roles` (`ValidateListUsers` in `internal/module/user/validator.go`): keeps users whose role
is one of them; omitted/empty = everyone. Trimmed and de-duplicated; an unknown role → `USER_INVALID_ROLE`.
Guests (role `null`) can't be selected and drop out of any non-empty filter. `total_count` honours the filter.
No name/phone search yet.

`/users/admin/create` vs `/users/create` (`internal/module/user/service.go`): the admin's "Add user" uses
**`/users/admin/create`** (🛡️ = `AdminOrApiKeyMiddleware`: the caller's account must have role ADMIN, else `403`).
- Accepts any role, ADMIN included; empty = STUDENT. Phone is normalized server-side; email is stored unverified
  (no REGISTER OTP). Password optional: 8+ characters, ≤ 72 bytes (`internal/domain/login/password.go`).
- Leaves the admin's session alone and does not trust the admin's device for the new user (first sign-in → OTP).
  Also opens the account's first child profile. Duplicates → `USER_PHONE_ALREADY_EXISTS` / `USER_EMAIL_ALREADY_EXISTS`.
- **Never use `/users/create` from the admin.** It is self-registration: it signs the calling session in as the
  new user (`sess.Init`), trusts the caller's device for them, refuses ADMIN, and refuses any email without a
  REGISTER OTP verified from this device.

`/users/update` details (`internal/module/user/validator.go`, `internal/application/command/user/update_user_command.go`):
- `role` must be `STUDENT | TEACHER | PARENT`. `ADMIN` exists (`enum.RoleTypeAdmin`) and shows up in
  `UserResponse.role`, but is never accepted from a request (`IsSelfAssignable`).
- `email` / `phone` only **replace an alias the account already has**. Sending a phone for an
  email-only account (or the reverse) is silently ignored — the admin disables those inputs.
- The phone is stored **as sent**, while `/auth/login` looks it up normalized (E.164, `+84…`), so a
  non-canonical phone locks the user out. Always send `normalizePhone()` output (`src/utils/Helpers.ts`,
  mirrors `utils.NormalizePhone`). The email is not format-checked server-side either.
- A changed email resets `is_email_verified` (re-derived from a REGISTER OTP on the caller's device).
- No ownership check: any secure session can update or delete any `uid`.
- OFFSET pages past the end are not clamped: `page: 9` of 3 returns `users: []` with `page: 9`.

### Banners — `internal/application/dto/banner/banner_dto.go`, `internal/module/banner/handler.go`

| Route | Request | Response |
|---|---|---|
| `/banners/list` 🔒 | `{ search?, media_type?, banner_status?, banner_ids?, page, size }` | `{ banners: BannerResponse[], pagination }` |
| `/banners/detail` 🔒 | `{ banner_id }` | `{ banner }` |
| `/banners/create` 🔒 | JSON **or multipart** (see below) | `{ banner }` |
| `/banners/update` 🔒 | `{ banner_id, ...same optional fields }` JSON or multipart | `{ banner }` |
| `/banners/soft-delete` 🔒 | `{ banner_id }` | envelope only |
| `/banners/force-delete` 🔒 | `{ banner_id }` | envelope only |

Fields: `title?, short_text?, media_type ("TEXT"|"IMAGE"|"VIDEO"), button_text?,
button_link_url?, note?, banner_status? ("ACTIVE"|"INACTIVE"|"DELETED")`.
Media: either JSON `media` (existing S3 key or bucket URL) or multipart file
part **`media`** (max 10 MB) with the other fields as form values + the
`metadata` form field.

`BannerResponse`: `{ banner_id, title?, short_text?, media_type, media_url_key,
media_url (presigned, display this), button_text?, button_link_url?, note?,
banner_status?, create_dt, modify_dt }`.

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
  IDENTIFY_SHAPE, FRACTION` (LaTeX `\frac{a}{b}` inside `$…$`); text may embed emoji and `[icon:NAME]` tokens.
- Codes: `EXAM_ATTEMPT_NOT_FOUND` 13701, `EXAM_ATTEMPT_NOT_OWNED` 13702, `EXAM_INVALID_EXAM_TYPE` 13708,
  `EXAM_PROFILE_NOT_FOUND` 13715, `EXAM_MISSING_PROFILE_ID` 13717, `EXAM_JOURNEY_NOT_FOUND` 13721,
  `EXAM_JOURNEY_NOT_OWNED` 13722.

### Exam pool — `internal/application/dto/exam/exam_dto.go`, `internal/application/command/exam/verify_exam_pool_command.go`

The AI-generated question sets (`ma_exam_pools`) that `/exams/generate` hands out and reuses. All routes 🛡️
(`AdminOrApiKeyMiddleware`: ADMIN only, else `403`).

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

### Curriculum: programs, grades, semesters, schools — `internal/application/dto/{program,grade,semester,school}/`, `internal/module/{program,grade,semester,school}/`

Programs, grades and semesters share routes and DTO shape; only the names differ (schools: see below):

| | id field | title field | title max | description |
|---|---|---|---|---|
| `/programs/*` | `program_id` | `label` | 128 bytes | required, ≤ 128 bytes |
| `/grades/*` | `grade_id` | `label` | 128 bytes | required, ≤ 128 bytes |
| `/semesters/*` | `semester_id` | `name` | 100 bytes | optional (TEXT) |

Limits are Go `len()` — **UTF-8 bytes**, so Vietnamese accented letters count 2–3.

| Route | Request | Response |
|---|---|---|
| `/<agg>/list` (public) | `{ page, size }` (+ `grade_ids?: number[]` on grades). OFFSET only. | `{ programs \| grades \| semesters: [...], pagination }` — active rows, `display_order ASC, id ASC` |
| `/<agg>/detail` 🔒 | `{ <id> }` | `{ program \| grade \| semester }` |
| `/<agg>/create` 🔒 | `{ <title>, description, display_order, note?, image_key? }` (JSON only) | `{ program \| grade \| semester }` |
| `/<agg>/update` 🔒 | `{ <id>, ...same fields optional }` (nil = unchanged) | same |
| `/<agg>/soft-delete` 🔒 | `{ <id> }` — sets status INACTIVE + `deleted_dt`; the row drops out of every read, no restore endpoint | envelope only |
| `/<agg>/force-delete` 🔒 | `{ <id> }` — physical delete, irreversible; profiles, classrooms and exam sessions reference these ids | envelope only |

Item: `{ <id>, <title>, description, image_key?, image_url (presigned or null), display_order (int8, ≥ 0), note?, create_dt, modify_dt }`.

- **Images.** Programs and semesters take only an existing S3 `image_key`. Grades hide `image_key` in responses
  and `/grades/update` ignores it in JSON: a new grade image is a **multipart** update with file part `image`
  (max 10 MB) + `grade_id`. That multipart form does not read `display_order`, so the admin sends field changes as
  JSON and the image in a second, image-only multipart call. Updates use `COALESCE`, so an image can be replaced
  but never cleared.
- Status codes: `PROGRAM_*` 43xx, `GRADE_*` 44xx, `SEMESTER_*` 45xx (`NOT_FOUND` x01, `MISSING_ID` x03,
  `MISSING_LABEL`/`NAME` x04, `MISSING_DESCRIPTION` x05, `INVALID_DISPLAY_ORDER` x06).
- Like users/banners, the write routes use plain `authMiddleware` — any OTP-verified user can call them (§5).

#### Schools — `internal/application/dto/school/school_dto.go`, `internal/module/school/`

Same six routes under `/schools/*` with id `school_id` and title `name`, but a different shape:

- **Every route needs auth**, `/schools/list` included (unlike the other curriculum lists).
- `/schools/list`: `{ page, size, search?, district?, province?, school_ids? }` → `{ schools, pagination }`.
  `search` is a substring match on name, district and province; `district` / `province` match exactly.
  Sorted `name ASC, school_id ASC`. Blank filters are ignored.
- Create: `{ name, description?, image_key?, district?, province?, note? }` — **no `display_order`**.
- Limits (bytes): name 100 (required), district / province 100, note 500, image_key 128, description TEXT.
  Name/description errors are `SCHOOL_*` 49xx; the other four fail with a generic `400 FAIL`.
- Update passes the pointers straight into `COALESCE(?, col)`, so `""` **clears** description, district,
  province, note or image_key (unlike the other three aggregates, where an image can't be cleared).
- `SchoolResponse`: `{ school_id, name, description?, image_key?, image_url, district?, province?, note?,
  school_status?, create_dt, modify_dt }`. Profiles and classrooms reference `school_id`
  (`/profiles/assign-school`, `/profiles/remove-school`).

### Permission module: roles — `internal/application/dto/role/role_dto.go`, `internal/module/permission/`

The permission module manages only a role registry (`ma_roles`) today; **nothing else on the server consults
it yet** — it is unrelated to `UserResponse.role`. Future permission routes will live in the same module.

| Route | Request | Response |
|---|---|---|
| `/roles/list` 🔒 | `{ search?, role_status?, role_ids?, page, size }` — OFFSET only. `search` matches `role_code` or `role_name` (LIKE). | `{ roles: RoleResponse[] \| null, pagination }` — soft-deleted rows never return; `role_code ASC, role_id ASC` |
| `/roles/detail` 🔒 | `{ role_id }` | `{ role }` |
| `/roles/create` 🔒 | `{ role_code, role_name, description?, note?, role_status? }` JSON, **or multipart** with the same text fields + file part **`role_image`** (max 10 MB) | `{ role }` |
| `/roles/update` 🔒 | `{ role_id, role_name?, description?, note?, role_status?, remove_role_image? }` JSON or multipart (+ `role_image`) | `{ role }` |
| `/roles/soft-delete` 🔒 | `{ role_id }` — sets `role_status = DELETED` + `deleted_dt`, hides it from every read and **frees the `role_code`**; no restore endpoint | envelope only |
| `/roles/force-delete` 🔒 | `{ role_id }` — physical delete, irreversible | envelope only |

`RoleResponse`: `{ role_id, role_code, role_name, description?, role_image_key?, role_image_url (presigned or null),
note?, role_status? ("ACTIVE"|"INACTIVE"|"DELETED"), create_dt, modify_dt }`.

Validation (`internal/module/permission/validator.go`):
- `role_code` is trimmed and upper-cased, then must match `^[A-Z][A-Z0-9_]{0,63}$`; it is unique among live
  rows (`ROLE_CODE_ALREADY_EXISTS`) and **cannot be changed** by update.
- `role_name` required, ≤ 128; `description`, `note` ≤ 500. Limits count **characters** (`utf8.RuneCountInString`,
  MySQL VARCHAR), unlike the curriculum byte limits.
- `role_status` accepts only `ACTIVE | INACTIVE` (create defaults to ACTIVE); `DELETED` comes only from soft-delete.
- Images: a new `role_image` replaces the old one (the old S3 object is deleted); `remove_role_image: true` clears it.
  Both at once → `ROLE_IMAGE_CONFLICT`. In the multipart form an **empty text field means "unchanged"**, so the
  admin sends field changes as JSON (where `""` clears description/note) and the image in an image-only multipart call.
- Status codes: `ROLE_*` 139xx (`NOT_FOUND` 13900, `MISSING_ID` 13901, `MISSING_CODE` 13902, `INVALID_CODE` 13903,
  `CODE_ALREADY_EXISTS` 13904, … `IMAGE_CONFLICT` 13912).

### Profiles — `internal/application/dto/profile/profile_dto.go`, `internal/module/profile/`

A profile is one child/role persona of an account (`ma_profiles`); a user owns several, at most one `is_default`.
Reads are **not** scoped to the caller: `/profiles/list` and `/profiles/detail` see every profile.

| Route | Request | Response |
|---|---|---|
| `/profiles/list` ⚠️ | `{ page, size, uid?, role?, profile_status?, school_id?, program_id?, grade_id?, semester_id?, is_default?, search? }` — OFFSET only. `search` (≤ 128 bytes) is a LIKE on `name` or `profile_code`. `role` must be STUDENT/TEACHER/PARENT, `profile_status` ACTIVE/INACTIVE/INCOMPLETE/OFFICIAL (else `400 FAIL`). | `{ profiles: ProfileResponse[] \| null, pagination }` — live rows only, `profile_id DESC` |
| `/profiles/detail` 🔒 | `{ profile_id }` | `{ profile }` |
| `/profiles/create` 🔒 | `{ uid, name, role, phone?, email?, is_default?, dob? ("YYYY-MM-DD"), school_id?, program_id?, grade_id?, semester_id?, id_type?, teacher_id?, student_id?, note?, avatar? (existing S3 key/URL) }` JSON, or multipart with file part `avatar` (the multipart form skips phone, email and note) | `{ profile }` |
| `/profiles/update` 🔒 | `{ profile_id, ...same optional fields }` JSON or multipart | `{ profile }` |
| `/profiles/upload-avatar` 🔒 | multipart: `profile_id` + file part **`file`** (max 10 MB) | `{ profile_id, avatar_key, avatar_url }` — the old S3 object is not deleted |
| `/profiles/assign-school` 🔒 | `{ profile_id, school_id }` | `{ profile }` |
| `/profiles/remove-school` 🔒 | `{ profile_id }` — clears `school_id`; idempotent | `{ profile }` |
| `/profiles/soft-delete` 🔒 | `{ profile_id }` — `profile_status = DELETED` + `deleted_dt`; no restore endpoint | envelope only |
| `/profiles/force-delete` 🔒 | `{ profile_id }` — physical delete + avatar S3 delete, irreversible | envelope only |
| `/profiles/upload-static-file`, `/profiles/delete-static-file` 🔒 | generic S3 upload/delete (`file` + `folder?` / `{ key }`) — not profile-specific; the dashboard does not use them | |

`ProfileResponse`: `{ profile_id, profile_code ("AA-1234", minted server-side), uid, name, phone: string|null, email: string|null,
role: STUDENT|TEACHER|PARENT|null (null = guest), identity_code, avatar_key?, avatar_url (presigned or null), dob? (server
time layout), school_id?, school?, program_id?, program?, grade_id?, grade?, semester_id?, semester? (embedded curriculum
objects), is_default, id_type?, teacher_id?, student_id?, profile_status?, create_dt, modify_dt }`. `note` is write-only.

- **`profile_status` is derived** on every create/update (`internal/application/command/profile/profile_status_rule.go`):
  OFFICIAL (+ `identity_code` VERIFIED) for a STUDENT with `student_id` or a TEACHER with `id_type` + `teacher_id`; else
  INCOMPLETE (+ USER). It can't be set directly.
- Update writes `COALESCE(?, col)`: omitted = unchanged, `""` clears a text field. Curriculum ids can be replaced but
  never cleared; the school can (`/profiles/remove-school`). `dob` can't be cleared. `is_default: false` is ignored —
  `true` makes this the default and unsets the account's others. `name: ""` is ignored.
- Create/update don't validate `role` (list does) and don't check that `uid` or the curriculum ids exist.
- Status codes: `PROFILE_*` 41xx (`NOT_FOUND` 4101, `MISSING_NAME` 4102, `MISSING_USER_ID` 4103, `INVALID_DOB` 4106,
  `AVATAR_INVALID_FILE` 4107, `AVATAR_CONFLICT` 4111, `CODE_TAKEN` 4113).

### Devices — `internal/application/dto/device/device_dto.go`, `internal/module/device/`

A device row is one (user, `device_uuid`) pair; login creates it and `/otps/verify` trusts it (`is_verified`).

| Route | Request | Response |
|---|---|---|
| `/devices/list` ⚠️ | `{ uid, is_verified?: boolean }` — `uid` required; omitted `is_verified` = no filter. **Not paginated.** | `{ devices: DeviceResponse[] \| null }` — live rows only, `device_id DESC` |
| `/devices/detail` ⚠️ | `{ device_id }` | `{ device }` |
| `/devices/update` ⚠️ | `{ uid, device_id, device_name?, device_push_token?, note? }` | `{ device }` |
| `/devices/revoke` ⚠️ | `{ uid, device_uuid }` — keyed by **uuid**, not id | envelope only |
| `/devices/soft-delete` ⚠️ | `{ uid, device_id }` | envelope only |
| `/devices/force-delete` 🛡️ | `{ uid, device_id }` — physical delete, irreversible. `AdminRequiredMiddleware`: ADMIN only, else `403` | envelope only |

`DeviceResponse`: `{ device_id, uid?, device_uuid, device_name, platform, is_verified, note?, status, create_dt, modify_dt }`.
The push token is never returned. `status` is the generic row status (always `ACTIVE` in a list); the
`device_status` column (`ACTIVE | INACTIVE | REVOKED | DELETED`, `internal/shared/enum/device.go`) is not exposed.

- There is **no list of every device**: the admin picks a user by UID, or finds the owner of a device id via `/devices/detail`.
- Every write checks the device belongs to `uid` (`DEVICE_NOT_OWNED` 4605). The uid comes from the body, not the session.
- Update: an empty `device_name` is ignored (can't be cleared); `note: ""` clears the note (`COALESCE`). `is_verified`
  can't be set here. Column sizes: name 255, note 500 (`migrations/up/003_ma_devices.sql`).
- Revoke sets `is_verified = false` and `device_status = REVOKED`; the row stays listed. Revoke, soft-delete and
  force-delete all mark the device's login logs `REVOKED`. Soft-delete hides the row; no restore endpoint.
- Demo accounts (`demoNames` in the service): `/devices/list` prepends fake devices with random ids; actions on them fail.
- Status codes: `DEVICE_*` 46xx (`NOT_FOUND` 4601 — also returned for a missing id/uuid, `MISSING_USER_ID` 4604, `NOT_OWNED` 4605).

Full route list: `grep -n 'reg("' internal/bootstrap/routes/routes.go` in math-svr. 🔒 = `AuthRequiredMiddleware` (secure session required). ⚠️ = no auth middleware at all.

---

## 5. Known backend gaps that affect the dashboard

- **Admin gate exists but does not cover the admin's routes.** math-svr has `ADMIN` users and
  `AdminOrApiKeyMiddleware` (`internal/bootstrap/middleware/admin_required_middleware.go`), but it only
  guards the ops routes of §6, `/users/admin/create` and `/exams/pools/*` (§4 Exam pool). `/users/list|update|soft-delete|force-delete`,
  `/banners/*`, the curriculum writes (`/programs|grades|semesters|schools/*`) and `/roles/*` still use plain `authMiddleware`, so any OTP-verified user can call them. Hiding
  buttons in the UI is not security — switching those routes to the admin middleware belongs in math-svr.
- **Device routes have no auth middleware** (except `/devices/force-delete`). `/devices/list|detail|update|revoke|soft-delete`
  are registered bare and trust the `uid` in the body, so anyone — signed in or not — can list, rename, un-trust or delete
  any user's devices. The fix belongs in math-svr (admin middleware for the admin's use, or the session uid for the app's).
- Exam reads: the owner routes are per-caller; the admin reads one profile's journeys and sittings through
  `/admin/exams/sessions/{list,detail}` (§4). There is no list across profiles, and the progress routes
  (`/exams/analytics/progress`, `/exams/journey/progress`, `/exams/grade/*`) have no admin path.
- **Verified pool sets are not preferred.** `/exams/generate` reuses any cached set; `verified_count` (§4 Exam pool)
  does not change which set a child gets.
- `/users/me` and `/profiles/list` are registered without auth middleware: anyone can list every profile.
  The profile writes use plain `authMiddleware` with no ownership check — any OTP-verified user can edit or delete any profile.
- **`/auth/resume-session` re-secures any session that has a uid.** It only checks the session is
  not expired (`IsValid`), then calls `sess.Init(IsSecure: true)`. `/auth/logout` only marks the
  session not secure and keeps the uid, so an old token replayed to `/auth/resume-session` is signed
  in again without OTP. The admin drops its token on logout, but the fix belongs in math-svr
  (require `IsSecure()` there, or clear the uid on logout).
- **`/sessions/dump` returns every user's live token.** The session map is keyed by the raw JWT
  (gex `sessionprovider/jwt.go` stores sessions under the token), so the response hands an admin a
  replayable credential for every signed-in user. The dashboard only ever renders the last 8 characters;
  the fix belongs in math-svr (key the dump by a hash or a session id instead).

---

## 6. Ops endpoints (admin only)

All behind `AdminOrApiKeyMiddleware`: an ADMIN-role secure session passes; anyone else gets `403`
(no session → `401`). The alternative `X-Api-Admin-Key` header is for scripts — the dashboard never sends it.
Unlike the rest of the API, **times here are RFC 3339** (`time.Time`, e.g. `"2026-10-04T10:00:00.123456789+07:00"`),
not the `20060102150405.000000` layout — parse with `parseIsoTime` (`src/utils/Helpers.ts`).

### Sessions — `internal/module/session/handler.go`

| Route | Request | Response |
|---|---|---|
| `/sessions/dump` | `{}` | The session map **flattened into the envelope**: every key that is not an envelope key is a session token → `{ uid, login_name, email, source, is_secure, expires_at, … }` (`internal/infrastructure/session/session.go` `Init`). See §5. |
| `/sessions/delete` | `{ token }` — a dump key; `"Bearer "` prefix optional. The body key is `token` so request logging redacts it. | `{ uid: number \| null, is_secure }` of the deleted session. `SESSION_MISSING_TOKEN` 14100, `SESSION_NOT_FOUND` 14101 (already gone). The holder gets a fresh empty session on its next request. |
| `/sessions/mark-secure` | `{ token, is_secure }` — same token rules; `is_secure` is **required** (`SESSION_MISSING_IS_SECURE` 14102) so a missing value never reads as `false`. | `{ uid: number \| null, is_secure }` after the change. Only the flag changes (uid, login name, expiry kept). `false` = soft sign-out: every 🔒 route refuses the session until it signs in again. `true` skips OTP and is refused on a session with no uid (`SESSION_MISSING_UID` 14103). `SESSION_NOT_FOUND` 14101. |
| `/sessions/delete-unsecure` | `{}` | `{ result: "Delete UnSecure Sessions" }` — drops sessions that are not secure (pending OTP or signed out). |
| `/sessions/delete-all` | `{}` | `{ result: "Delete All Sessions" }` — **includes the caller's own session**: the next call answers 401. |

### Server — `internal/module/server/{handler,reload}.go`

Both answer `204` first and stop the process ~250 ms later; only one lifecycle request is accepted
(`SERVER_SHUTTING_DOWN` 13001 for the next).

| Route | Behaviour |
|---|---|
| `/server/reload` | Validates `.env` in a child process (`SERVER_RELOAD_INVALID_ENV` 13002 and keeps serving if it fails), then graceful shutdown + re-exec, same PID. Sessions survive only with `SERIALIZED_SESSION_FILE`. Not on Windows (`SERVER_RELOAD_NOT_SUPPORTED` 13003). |
| `/server/shutdown` | Graceful shutdown. Restart happens on the host only. |

### Misc — `internal/module/misc/`, `internal/application/dto/misc/misc_dto.go`

| Route | Request | Response |
|---|---|---|
| `/misc/db-pool-stats` | `{}` | `DBPoolStatsRes`: `captured_at, autocommit, isolation_level, max_open_connections (0 = unlimited), open_connections, in_use, idle, wait_count, wait_duration_ms, avg_wait_duration_ms, max_idle_closed, max_idle_time_closed, max_lifetime_closed, utilization_percent`. Wait/closed counters are cumulative since start. |
| `/misc/clear-data-tables` | `{ tables: string[] }` — each in the allow-list | `{ tables_cleared, seqs_reset }` — TRUNCATE + reset each table's id seq. |
| `/misc/clear-data` | `{ whitelist_id?: number[] }` — empty/omitted = wipe everything | `{ tables_cleared, seqs_reset, kept_uids? }` — whitelisted users keep their rows. |

Allow-list (`clearDataTargets` in `internal/infrastructure/persistence/mysql/repositories/maintenance_repository.go`;
no endpoint lists it, the admin mirrors it as `CLEARABLE_TABLES` in `src/types/System.ts`): `ma_users, ma_aliases,
ma_logins, ma_devices, ma_login_logs, ma_profiles, ma_otps, ma_classrooms, ma_classroom_members,
ma_classroom_programs, ma_exercises, ma_exercise_submissions, ma_notifications, ma_banners, ma_chat_conversations,
ma_chat_participants, ma_chat_messages, ma_exam_links, ma_exam_sessions, ma_exam_session_lines`.
Reference tables and the exam pool are never cleared. `ma_users` is in the list, so a wipe deletes the
caller's own account unless whitelisted.

### Jobs — `internal/module/job/`, runtime types in `internal/infrastructure/job/types.go`

| Route | Request | Response |
|---|---|---|
| `/jobs/list` | `{}` | `{ started, jobs: JobInfo[] \| null, tasks: {name}[] \| null, queue: {capacity, depth, workers} }` |
| `/jobs/trigger` | `{ name }` | `{ name, result }` — `JOB_IN_FLIGHT` 12004 if already running |
| `/jobs/pause` | `{ name }` | `{ name, result }` — `JOB_ALREADY_PAUSED` 12002; in-flight runs are not cancelled |
| `/jobs/resume` | `{ name }` | `{ name, result }` — `JOB_NOT_PAUSED` 12003. Lower-case path: `/jobs/Resume` is a 404. |
| `/jobs/schedule/update` | `{ name, schedule }` | `{ result, job: JobInfo }` — the job as resolved (timezone included) |
| `/jobs/schedule/reset` | `{ name }` | `{ result, job: JobInfo }` — idempotent |

`JobInfo`: `name, schedule, default_schedule, schedule_overridden, status ("running"|"paused"), in_flight,
next_run_at?, last_run_at?, last_status? ("succeeded"|"failed"|"panicked"|"timed_out"), last_error?,
last_duration_ms? (string)`. `schedule` strings look like `every 15m0s`, `daily 06:30 Asia/Ho_Chi_Minh`,
`weekly Monday 08:00 UTC`.

`schedule` (validator.go): `{kind:"every", every_seconds}` within `[60, 2592000]`;
`{kind:"daily", hour, minute, timezone}`; `{kind:"weekly", weekday (0=Sunday…6), hour, minute, timezone}`.
Empty timezone = UTC; an unknown IANA name fails with `JOB_INVALID_SCHEDULE` 12012. The override is
in memory only — a restart restores the code-declared schedule.

`/tasks/enqueue` (`{ name, payload, delay_seconds, attempts, timeout_seconds }`) exists too; the dashboard does not use it.

/**
 * Curriculum reference rows: programs, grades, semesters, schools.
 * Source: math-svr internal/application/dto/{program,grade,semester,school}/*_dto.go.
 * Programs, grades and semesters share one shape (only the id/title names differ);
 * schools have no display_order but add district/province.
 */
import type { OffsetPagination } from '@/types/Api'

export type CurriculumKind = 'program' | 'grade' | 'semester' | 'school'

export const CURRICULUM_KINDS = ['program', 'grade', 'semester', 'school'] as const satisfies readonly CurriculumKind[]

type CurriculumFields = {
  description: string
  /** Presigned and short-lived — display it, don't store it. null when there is no image. */
  image_url: string | null
  /** int8 on the server: 0–127. Lists are sorted by it, then by id. */
  display_order: number
  note?: string
  /** "YYYYMMDDHHmmss.ffffff" — parse with parseServerTime. */
  create_dt: string
  modify_dt: string
}

export type Program = CurriculumFields & { program_id: number; label: string; image_key?: string }

/** GradeResponse hides image_key (json:"-"). */
export type Grade = CurriculumFields & { grade_id: number; label: string }

export type Semester = CurriculumFields & { semester_id: number; name: string; image_key?: string }

/** SchoolResponse. Sorted by name; every field but the name is optional. */
export type School = Omit<CurriculumFields, 'description' | 'display_order'> & {
  school_id: number
  name: string
  description?: string
  image_key?: string
  district?: string
  province?: string
  /** ACTIVE for every row a list returns (soft-deleted rows are filtered out). */
  school_status?: string
}

/** The list responses: `{ programs | grades | semesters | schools, pagination }`. */
export type ListProgramsResponse = { programs: Program[]; pagination: OffsetPagination }
export type ListGradesResponse = { grades: Grade[]; pagination: OffsetPagination }
export type ListSemestersResponse = { semesters: Semester[]; pagination: OffsetPagination }
export type ListSchoolsResponse = { schools: School[]; pagination: OffsetPagination }

/** One row of any kind, as the screens use it (mapped in CurriculumApi.ts). */
export type CurriculumItem = {
  id: number
  /** `label` for programs and grades, `name` for semesters and schools. */
  title: string
  /** '' when the row has none. */
  description: string
  /** Undefined for grades: the server never returns their key. */
  imageKey?: string
  imageUrl: string | null
  /** Undefined for schools, which have no display order. */
  displayOrder?: number
  /** Schools only. */
  district?: string
  province?: string
  note?: string
  createDt: string
}

/** What the create/edit form produces. Omitted fields are left unchanged on update. */
export type CurriculumFieldsInput = {
  title?: string
  description?: string
  displayOrder?: number
  /** Schools only; '' clears it. */
  district?: string
  province?: string
  note?: string
  /** Existing S3 key. The server has no way to clear an image, only to replace it. */
  imageKey?: string
}

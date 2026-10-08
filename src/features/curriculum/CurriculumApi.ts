/**
 * /programs/*, /grades/*, /semesters/*, /schools/* calls (docs/API-CONTRACT.md §4).
 * The four aggregates have the same routes and a near-identical DTO; KIND_CONFIG
 * holds the names and the few fields that differ so the screens can stay generic.
 */
import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import { apiPost, apiPostMultipart } from '@/libs/ApiClient'
import type { OffsetPageRequest, OffsetPagination } from '@/types/Api'
import type { CurriculumFieldsInput, CurriculumItem, CurriculumKind } from '@/types/Curriculum'

type KindConfig = {
  /** Route prefix, e.g. '/programs'. */
  path: string
  /** Id field in requests and responses, e.g. 'program_id'. */
  idField: string
  /** Title field: 'label' or 'name'. */
  titleField: 'label' | 'name'
  /** Array key of the list response. */
  listKey: string
  /** Byte limits from the server validators (Go len() counts UTF-8 bytes). */
  titleMaxBytes: number
  /** null = description is optional and unbounded (semesters, schools: TEXT column). */
  descriptionMaxBytes: number | null
  /** null = no server limit on the note. */
  noteMaxBytes: number | null
  /** Has a `display_order` (0–127) and lists sort by it. Schools sort by name instead. */
  displayOrder: boolean
  /** Has `district` / `province` (schools, ≤ 100 bytes each). */
  location: boolean
  /** /list takes a `search` substring filter (schools: name, district, province). */
  search: boolean
  /**
   * Grades take a new image as a multipart file on /grades/update; programs and
   * semesters only take an existing S3 `image_key`.
   */
  imageUpload: boolean
}

export const KIND_CONFIG: Record<CurriculumKind, KindConfig> = {
  program: {
    path: '/programs',
    idField: 'program_id',
    titleField: 'label',
    listKey: 'programs',
    titleMaxBytes: 128,
    descriptionMaxBytes: 128,
    noteMaxBytes: null,
    displayOrder: true,
    location: false,
    search: false,
    imageUpload: false,
  },
  grade: {
    path: '/grades',
    idField: 'grade_id',
    titleField: 'label',
    listKey: 'grades',
    titleMaxBytes: 128,
    descriptionMaxBytes: 128,
    noteMaxBytes: null,
    displayOrder: true,
    location: false,
    search: false,
    imageUpload: true,
  },
  semester: {
    path: '/semesters',
    idField: 'semester_id',
    titleField: 'name',
    listKey: 'semesters',
    titleMaxBytes: 100,
    descriptionMaxBytes: null,
    noteMaxBytes: null,
    displayOrder: true,
    location: false,
    search: false,
    imageUpload: false,
  },
  school: {
    path: '/schools',
    idField: 'school_id',
    titleField: 'name',
    listKey: 'schools',
    titleMaxBytes: 100,
    descriptionMaxBytes: null,
    noteMaxBytes: 500,
    displayOrder: false,
    location: true,
    search: true,
    imageUpload: false,
  },
}

/** Max bytes of a school's district / province. */
export const LOCATION_MAX_BYTES = 100

/** display_order is an int8 on the server; negatives are rejected. */
export const DISPLAY_ORDER_MAX = 127

/** Max size of an uploaded grade image (MaxImageUploadSize in internal/module/grade/handler.go). */
export const IMAGE_MAX_BYTES = 10 << 20

/** Every query of one kind starts with this key — invalidate it after any change. */
export function curriculumQueryKey(kind: CurriculumKind) {
  return ['curriculum', kind] as const
}

type WireItem = Record<string, unknown> & {
  description?: string
  image_key?: string
  image_url: string | null
  display_order?: number
  district?: string
  province?: string
  note?: string
  create_dt: string
}

function toItem(kind: CurriculumKind, wire: WireItem): CurriculumItem {
  const { idField, titleField } = KIND_CONFIG[kind]
  return {
    id: wire[idField] as number,
    title: wire[titleField] as string,
    description: wire.description ?? '',
    imageKey: wire.image_key,
    imageUrl: wire.image_url,
    displayOrder: wire.display_order,
    district: wire.district,
    province: wire.province,
    note: wire.note,
    createDt: wire.create_dt,
  }
}

/** Form fields → request body fields; undefined ones are left out of the JSON. */
function toWireFields(kind: CurriculumKind, input: CurriculumFieldsInput) {
  return {
    [KIND_CONFIG[kind].titleField]: input.title,
    description: input.description,
    display_order: input.displayOrder,
    district: input.district,
    province: input.province,
    note: input.note,
    image_key: input.imageKey,
  }
}

/** `search` is only sent for kinds whose /list supports it (KIND_CONFIG.search). */
export function curriculumListQueryOptions(
  kind: CurriculumKind,
  { page, size, search }: OffsetPageRequest & { search?: string },
) {
  const { path, listKey } = KIND_CONFIG[kind]
  const filter = KIND_CONFIG[kind].search && search ? { search } : {}
  return queryOptions({
    queryKey: [...curriculumQueryKey(kind), { page, size, ...filter }],
    queryFn: async ({ signal }) => {
      // OFFSET only; active rows sorted by display_order then id (schools: by name then id).
      const res = await apiPost<Record<string, unknown> & { pagination: OffsetPagination }>(
        `${path}/list`,
        { page, size, ...filter },
        { signal },
      )
      const rows = (res[listKey] as WireItem[] | null) ?? []
      return { items: rows.map((row) => toItem(kind, row)), pagination: res.pagination }
    },
    placeholderData: keepPreviousData,
  })
}

/** The screens refetch the list afterwards, so the created row in the response is not returned. */
export async function createCurriculumItem(kind: CurriculumKind, input: CurriculumFieldsInput) {
  await apiPost(`${KIND_CONFIG[kind].path}/create`, toWireFields(kind, input))
}

/**
 * Patches the changed fields, then uploads the grade image when one is given.
 * Two calls because the multipart form of /grades/update ignores display_order;
 * the image-only call leaves every other column as it is.
 */
export async function updateCurriculumItem(
  kind: CurriculumKind,
  id: number,
  changes: CurriculumFieldsInput,
  image?: File,
) {
  const { path, idField } = KIND_CONFIG[kind]
  if (Object.values(changes).some((value) => value !== undefined)) {
    await apiPost(`${path}/update`, { [idField]: id, ...toWireFields(kind, changes) })
  }
  if (image && KIND_CONFIG[kind].imageUpload) {
    await apiPostMultipart(`${path}/update`, { [idField]: id, image })
  }
}

/** Hides the row from every read. There is no restore endpoint. */
export function softDeleteCurriculumItem(kind: CurriculumKind, id: number) {
  const { path, idField } = KIND_CONFIG[kind]
  return apiPost(`${path}/soft-delete`, { [idField]: id })
}

/** Physically deletes the row. Irreversible. */
export function forceDeleteCurriculumItem(kind: CurriculumKind, id: number) {
  const { path, idField } = KIND_CONFIG[kind]
  return apiPost(`${path}/force-delete`, { [idField]: id })
}


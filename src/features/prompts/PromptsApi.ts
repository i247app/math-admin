/** /prompts/* calls (docs/API-CONTRACT.md §4, Prompts). ADMIN sessions only. */
import type { QueryClient } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { apiPost } from "@/libs/ApiClient";
import type {
  ListPromptsResponse,
  Prompt,
  PromptCode,
  PromptResponse,
} from "@/types/Prompt";
import { PROMPT_CODES } from "@/types/Prompt";

/** Every prompt row, full text included, ordered by code, grade, language. Not paginated: one row per scope. */
export function promptsQueryOptions() {
  return queryOptions({
    queryKey: ["prompts"],
    queryFn: async ({ signal }) =>
      (await apiPost<ListPromptsResponse>("/prompts/list", {}, { signal }))
        .prompts ?? [],
  });
}

/** Overwrites the row's text (no history) and bumps its prompt_version. */
export async function updatePrompt(promptId: number, systemPrompt: string) {
  return (
    await apiPost<PromptResponse>("/prompts/update", {
      prompt_id: promptId,
      system_prompt: systemPrompt,
    })
  ).prompt;
}

export function storePrompt(queryClient: QueryClient, prompt: Prompt) {
  queryClient.setQueryData(promptsQueryOptions().queryKey, (current) =>
    current?.map((row) => (row.prompt_id === prompt.prompt_id ? prompt : row)),
  );
}

export function knownPromptCode(code: string): PromptCode | undefined {
  return PROMPT_CODES.find((option) => option === code);
}

/** The keys question.ParseGenerationOf reads from a generated exam. */
const EXAM_GENERATION_KEYS = [
  '"short_text"',
  '"questions"',
  '"question_number"',
  '"question_type"',
  '"question_name"',
  '"answers"',
  '"label"',
  '"content"',
  '"right_answer_label"',
  '"right_answer_content"',
  '"question_topic"',
  '"question_grade"',
];

/**
 * The JSON keys math-svr refuses a prompt without, per code, quoted as the output-structure block names them.
 * Mirrors Spec.RequiredKeys in math-svr internal/domain/prompt/catalog.go — keep the two in sync.
 */
const REQUIRED_KEYS: Record<PromptCode, readonly string[]> = {
  EXAM_ASSESSMENT: EXAM_GENERATION_KEYS,
  EXAM_GRADE: EXAM_GENERATION_KEYS,
  EXAM_PRACTICE: EXAM_GENERATION_KEYS,
  EXAM_REVIEW: ['"short"', '"long"'],
};

/** None for a code the catalog does not know: the server skips the check too. */
export function requiredKeysOf(code: string): readonly string[] {
  const known = knownPromptCode(code);
  return known ? REQUIRED_KEYS[known] : [];
}

export function missingPromptKeys(text: string, keys: readonly string[]) {
  return keys.filter((key) => !text.includes(key));
}

/**
 * Answer objects with a key deleted: innermost {…} blocks that name "label" or "content" but not both.
 * Stricter than math-svr, which only checks each key appears somewhere — the four example answers
 * (A–D) keep a key "present" after it is removed from one of them, and the model copies the example.
 */
export function brokenAnswerObjects(text: string) {
  return (text.match(/\{[^{}]*\}/g) ?? []).filter(
    (block) => block.includes('"label"') !== block.includes('"content"'),
  );
}

/** Codes whose prompt_version is part of the exam cache tag: a rewrite stops their cached sets being served. */
export function isCachedPromptCode(code: string) {
  return code === "EXAM_ASSESSMENT" || code === "EXAM_GRADE";
}

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

// Whitespace-only edits are no change; a real edit of an answer or the topic is.
assert.equal(isChanged(stored, { ...draft, name: ` ${draft.name} ` }), false)
assert.equal(isChanged(stored, { ...draft, topic: ' Đếm  ' }), false)
assert.equal(isChanged(stored, { ...draft, answers: draft.answers.map((a) => ({ ...a, content: ` ${a.content} ` })) }), false)
assert.equal(isChanged(stored, { ...draft, answers: draft.answers.map((a) => (a.label === 'B' ? { ...a, content: '7' } : a)) }), true)
assert.equal(isChanged(stored, { ...draft, topic: 'Số đếm' }), true)

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

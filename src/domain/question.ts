import { z } from 'zod';

const text = z.string().trim().min(1);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Expected a real calendar date (YYYY-MM-DD)');
const choiceId = z.enum(['a', 'b', 'c', 'd']);

export const questionMetadataSchema = z.object({
  id: text,
  revision: z.literal(1),
  status: z.enum(['reviewed', 'draft']),
  verifiedOn: date,
  startYear: z.number().int().min(1).max(9999),
  endYear: z.number().int().min(1).max(9999),
  topics: z.array(text).min(1),
  territories: z.array(text).min(1),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  sensitivity: z.enum(['low', 'medium', 'high']),
  choices: z.array(z.object({ id: choiceId, text }).strict()).length(4),
  correctChoiceId: choiceId,
  sources: z.array(z.object({
    title: text,
    publisher: text,
    url: z.url().refine(value => /^https?:\/\//.test(value), 'Expected HTTP(S) source URL'),
    accessed: date,
  }).strict()).min(1),
}).strict().superRefine((value, ctx) => {
  if (value.startYear > value.endYear) {
    ctx.addIssue({ code: 'custom', path: ['endYear'], message: 'Must be >= startYear' });
  }
  if (new Set(value.choices.map(choice => choice.id)).size !== 4) {
    ctx.addIssue({ code: 'custom', path: ['choices'], message: 'Choice IDs must be unique (a, b, c, d)' });
  }
  if (new Set(value.choices.map(choice => choice.text)).size !== 4) {
    ctx.addIssue({ code: 'custom', path: ['choices'], message: 'Choice texts must be distinct' });
  }
  if (!value.choices.some(choice => choice.id === value.correctChoiceId)) {
    ctx.addIssue({ code: 'custom', path: ['correctChoiceId'], message: 'Must reference an existing choice' });
  }
});

export const questionSchema = questionMetadataSchema.safeExtend({
  prompt: text,
  fact: text,
  explanation: text,
  contentRevision: text,
});

export type Question = z.infer<typeof questionSchema>;
export type Range = { startYear: number; endYear: number };

export function validateBank(value: unknown): Question[] {
  const bank = z.array(questionSchema).min(1).parse(value);
  const ids = new Set<string>();
  for (const question of bank) {
    if (ids.has(question.id)) throw new Error(`Duplicate question ID: ${question.id}`);
    if (question.status !== 'reviewed') throw new Error(`Draft in runtime bank: ${question.id}`);
    ids.add(question.id);
  }
  return bank;
}

export function availableBounds(bank: Question[]): Range {
  if (!bank.length) throw new Error('Question bank is empty');
  return {
    startYear: Math.min(...bank.map(question => question.startYear)),
    endYear: Math.max(...bank.map(question => question.endYear)),
  };
}

export function eligibleQuestions(bank: Question[], range: Range): Question[] {
  if (!Number.isSafeInteger(range.startYear) || !Number.isSafeInteger(range.endYear) ||
      range.startYear < 1 || range.endYear > 9999 || range.startYear > range.endYear) {
    throw new Error('Bitte einen gueltigen ganzzahligen Zeitraum angeben (Beginn <= Ende).');
  }
  return bank.filter(question => question.startYear <= range.endYear && question.endYear >= range.startYear);
}

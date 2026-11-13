import { createHash } from 'node:crypto';
import { parseDocument } from 'yaml';
import { questionMetadataSchema, questionSchema, type Question } from '../src/domain/question.ts';

export function parseQuestion(file: string, source: string): Question {
  const normalized = source.replace(/\r\n/g, '\n');
  const frontmatter = normalized.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!frontmatter) throw new Error(`${file}: frontmatter: Expected YAML between --- delimiters`);
  const document = parseDocument(frontmatter[1], { uniqueKeys: true });
  if (document.errors.length) {
    throw new Error(`${file}: YAML: ${document.errors.map(error => error.message).join('; ')}`);
  }
  let yaml: unknown;
  try { yaml = document.toJS(); }
  catch (error) {
    throw new Error(`${file}: YAML: ${error instanceof Error ? error.message : String(error)}`);
  }
  const metadata = questionMetadataSchema.safeParse(yaml);
  if (!metadata.success) {
    throw new Error(`${file}: ${metadata.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`);
  }
  const headings = [...frontmatter[2].matchAll(/^## (.+)$/gm)];
  const expected = ['Frage', 'Historischer Fakt', 'Erklärung'];
  if (headings.length !== 3 || headings.some((heading, index) => heading[1] !== expected[index])) {
    throw new Error(`${file}: sections: Expected exactly ## Frage / ## Historischer Fakt / ## Erklärung in order`);
  }
  const sections = headings.map((heading, index) => frontmatter[2]
    .slice((heading.index ?? 0) + heading[0].length, headings[index + 1]?.index).trim());
  if (sections.some(section => !section)) throw new Error(`${file}: sections: Required sections cannot be empty`);
  const result = questionSchema.safeParse({
    ...metadata.data,
    prompt: sections[0],
    fact: sections[1],
    explanation: sections[2],
    contentRevision: createHash('sha256').update(normalized).digest('hex'),
  });
  if (!result.success) throw new Error(`${file}: ${result.error.message}`);
  return result.data;
}

export function parseBank(files: { file: string; source: string }[]): Question[] {
  const ids = new Set<string>();
  const reviewed: Question[] = [];
  for (const { file, source } of files) {
    const question = parseQuestion(file, source);
    if (ids.has(question.id)) throw new Error(`${file}: id: Duplicate question ID ${question.id}`);
    ids.add(question.id);
    if (question.status === 'reviewed') reviewed.push(question);
  }
  return reviewed;
}

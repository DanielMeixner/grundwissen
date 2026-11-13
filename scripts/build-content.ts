import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { parseBank } from './content-parser.ts';

const files: { file: string; source: string }[] = [];
for (const century of ['18', '19', '20', '21']) {
  const directory = `content/questions/${century}`;
  for (const name of (await readdir(directory)).filter(name => name.endsWith('.md')).sort()) {
    const file = `${directory}/${name}`;
    files.push({ file, source: await readFile(file, 'utf8') });
  }
}
const bank = parseBank(files);
if (bank.length !== 160) throw new Error(`Expected 160 reviewed questions, received ${bank.length}`);
for (const century of [18, 19, 20, 21]) {
  const count = bank.filter(question => Math.ceil(question.startYear / 100) === century).length;
  if (count !== 40) throw new Error(`Century ${century}: Expected 40 reviewed questions, received ${count}`);
}
await mkdir('src/generated', { recursive: true });
await writeFile('src/generated/questions.json', `${JSON.stringify(bank, null, 2)}\n`);
console.log(`Validated ${bank.length} reviewed questions; authored cutoff ${Math.max(...bank.map(q => q.endYear))}.`);

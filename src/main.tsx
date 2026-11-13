import { createRoot } from 'react-dom/client';
import rawBank from './generated/questions.json';
import { App } from './App';
import { validateBank } from './domain/question';
import { browserStore } from './persistence/store';

const element = document.getElementById('root');
if (!element) throw new Error('Application root is missing');
const root = createRoot(element);
root.render(<p role="status">Grundwissen wird geladen …</p>);

async function initialize() {
  try {
    const bank = validateBank(rawBank);
    const store = browserStore(bank);
    await store.initialize();
    root.render(<App bank={bank} store={store} />);
  } catch (error) {
    root.render(<main><h1>Grundwissen konnte nicht gestartet werden</h1>
      <p role="alert">{error instanceof Error ? error.message : String(error)}</p>
      <p>Vorhandener Browserfortschritt wird nicht automatisch geloescht.</p>
    </main>);
  }
}

void initialize();

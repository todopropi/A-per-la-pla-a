import express from 'express';
import path from 'path';
import fs from 'fs';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '15mb' }));

const CUSTOM_QUESTIONS_FILE = path.join(__dirname, 'custom_questions.json');

const BANK_FILES = {
  pl: {
    path: path.join(__dirname, 'P_L_Preguntas.js'),
    varName: 'bancoPoliciaLocal'
  },
  mossos: {
    path: path.join(__dirname, 'Mossos_Preguntas.js'),
    varName: 'bancoPreguntes'
  },
  act: {
    path: path.join(__dirname, 'Actualidad_preguntas.js'),
    varName: 'bancoActualitat'
  }
};

function readBankArrayFromFile(bancKey) {
  const cfg = BANK_FILES[bancKey] || BANK_FILES.mossos;
  if (!fs.existsSync(cfg.path)) return [];
  const code = fs.readFileSync(cfg.path, 'utf8');
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.window[cfg.varName] || [];
}

function writeBankArrayToFile(bancKey, array) {
  const cfg = BANK_FILES[bancKey] || BANK_FILES.mossos;
  const content = `window.${cfg.varName} = ${JSON.stringify(array, null, 2)};\n`;
  fs.writeFileSync(cfg.path, content, 'utf8');
}

function getSavedCustomQuestions() {
  try {
    if (fs.existsSync(CUSTOM_QUESTIONS_FILE)) {
      const data = fs.readFileSync(CUSTOM_QUESTIONS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Error reading custom questions:', e);
  }
  return { mossos: [], pl: [], act: [] };
}

function saveCustomQuestions(data) {
  try {
    fs.writeFileSync(CUSTOM_QUESTIONS_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('Error saving custom questions:', e);
    return false;
  }
}

// API for custom questions
app.get('/api/custom-questions', (req, res) => {
  res.json(getSavedCustomQuestions());
});

app.post('/api/custom-questions', (req, res) => {
  const { banc, pregunta } = req.body;
  if (!banc || !pregunta) {
    return res.status(400).json({ error: 'Missing banc or pregunta data' });
  }
  const current = getSavedCustomQuestions();
  const key = banc === 'pl' ? 'pl' : banc === 'act' ? 'act' : 'mossos';
  if (!Array.isArray(current[key])) current[key] = [];
  
  const existingIdx = current[key].findIndex(q => q.id === pregunta.id);
  if (existingIdx !== -1) {
    current[key][existingIdx] = pregunta;
  } else {
    current[key].push(pregunta);
  }
  
  saveCustomQuestions(current);
  res.json({ success: true, count: current[key].length, pregunta });
});

// Endpoint per MODIFICAR directament al fitxer .js (P_L_Preguntas.js, Mossos_Preguntas.js, Actualidad_preguntas.js)
app.post('/api/modificar-pregunta-fitxer', (req, res) => {
  try {
    const { banc, pregunta, esNova } = req.body;
    if (!banc || !pregunta) {
      return res.status(400).json({ success: false, error: 'Falten dades de banc o pregunta' });
    }
    const bancKey = banc === 'pl' ? 'pl' : banc === 'act' ? 'act' : 'mossos';
    const llista = readBankArrayFromFile(bancKey);

    let id = pregunta.id;
    if (!id) {
      id = (bancKey === 'pl' ? 'PL_' : bancKey === 'act' ? 'ACT_' : 'MOSSOS_') + Date.now();
      pregunta.id = id;
    }

    const idx = llista.findIndex(q => q && String(q.id).trim() === String(id).trim());

    if (idx !== -1 && !esNova) {
      // Modificació de pregunta existent
      llista[idx] = { ...llista[idx], ...pregunta };
    } else {
      // Afegir com a nova pregunta
      if (idx !== -1) {
        llista[idx] = { ...llista[idx], ...pregunta };
      } else {
        llista.push(pregunta);
      }
    }

    // Si és Policia Local, reordenem per tema numèric per mantenir l'ordre 1-40
    if (bancKey === 'pl') {
      function getTemaNum(q) {
        const txt = `${q.seccio || ''} ${q.tema || ''} ${q.pregunta || ''}`;
        const m = txt.match(/Tema\s*(\d+)/i);
        return m ? parseInt(m[1], 10) : null;
      }
      const ambTema = llista.filter(q => getTemaNum(q) !== null);
      const senseTema = llista.filter(q => getTemaNum(q) === null);
      ambTema.sort((a, b) => {
        const nA = getTemaNum(a);
        const nB = getTemaNum(b);
        if (nA !== nB) return nA - nB;
        return (a.id || '').localeCompare(b.id || '', 'ca', { numeric: true });
      });
      writeBankArrayToFile(bancKey, [...ambTema, ...senseTema]);
    } else {
      writeBankArrayToFile(bancKey, llista);
    }

    console.log(`[API] Pregunta ${id} desada directament al fitxer .js de ${bancKey}`);
    return res.json({
      success: true,
      id,
      banc: bancKey,
      total: llista.length,
      missatge: `Pregunta desada correctament al fitxer .js!`
    });
  } catch (error) {
    console.error('Error desant al fitxer .js:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint per ELIMINAR directament del fitxer .js
app.post('/api/eliminar-pregunta-fitxer', (req, res) => {
  try {
    const { banc, id } = req.body;
    if (!banc || !id) {
      return res.status(400).json({ success: false, error: 'Falten dades de banc o id' });
    }
    const bancKey = banc === 'pl' ? 'pl' : banc === 'act' ? 'act' : 'mossos';
    let llista = readBankArrayFromFile(bancKey);
    const inicial = llista.length;
    llista = llista.filter(q => q && String(q.id).trim() !== String(id).trim());

    if (llista.length === inicial) {
      return res.status(404).json({ success: false, error: 'No sha trobat cap pregunta amb aquest ID al fitxer .js' });
    }

    writeBankArrayToFile(bancKey, llista);
    console.log(`[API] Pregunta ${id} eliminada directament del fitxer .js de ${bancKey}`);
    return res.json({ success: true, id, total: llista.length, missatge: 'Pregunta eliminada del fitxer .js' });
  } catch (error) {
    console.error('Error eliminant del fitxer .js:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Serve static assets from project root
app.use(express.static(__dirname));

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Agent Medina server running on http://0.0.0.0:${PORT}`);
});


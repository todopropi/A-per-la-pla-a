import express from 'express';
import path from 'path';
import fs from 'fs';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { GoogleGenAI } from '@google/genai';
import mammoth from 'mammoth';
import {
  getTotsElsTemesGuia,
  getTemaGuiaPerId,
  cercarALaGuia,
  construirContextGuiaPerPrompt
} from './guia_mossos_service.js';

const require = createRequire(import.meta.url);

async function extractTextFromPdf(buffer) {
  try {
    const pkg = require('pdf-parse');
    if (pkg && pkg.PDFParse) {
      const parser = new pkg.PDFParse({ data: buffer });
      const res = await parser.getText();
      const txt = (res && res.text ? res.text : '').trim();
      try { await parser.destroy(); } catch (_) {}
      if (txt && txt.length > 5) return txt;
    }
    if (typeof pkg === 'function') {
      const res = await pkg(buffer);
      if (res && res.text && res.text.trim().length > 5) return res.text.trim();
    }
    if (pkg && typeof pkg.default === 'function') {
      const res = await pkg.default(buffer);
      if (res && res.text && res.text.trim().length > 5) return res.text.trim();
    }
  } catch (err) {
    console.warn('Avís parsejant PDF amb pdf-parse:', err?.message || err);
  }
  return '';
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '25mb' }));

const CUSTOM_QUESTIONS_FILE = path.join(__dirname, 'custom_questions.json');
const TEMES_ANNEXOS_FILE = path.join(__dirname, 'temes_annexos.json');
const EXAMENS_OFICIALS_FILE = path.join(__dirname, 'examens_oficials.json');

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

// Endpoint per MODIFICAR/AFEGIR en LOT directament al fitxer .js
app.post('/api/modificar-preguntes-fitxer-lot', (req, res) => {
  try {
    const { banc, preguntes } = req.body;
    if (!banc || !Array.isArray(preguntes) || preguntes.length === 0) {
      return res.status(400).json({ success: false, error: 'Falten dades de banc o llista de preguntes' });
    }
    const bancKey = banc === 'pl' ? 'pl' : banc === 'act' ? 'act' : 'mossos';
    const llista = readBankArrayFromFile(bancKey);

    let afegides = 0;
    const now = Date.now();

    preguntes.forEach((p, i) => {
      let id = p.id;
      if (!id) {
        id = (bancKey === 'pl' ? 'PL_' : bancKey === 'act' ? 'ACT_' : 'MOSSOS_') + now + '_' + i;
        p.id = id;
      }
      const idx = llista.findIndex(q => q && String(q.id).trim() === String(id).trim());
      if (idx !== -1) {
        llista[idx] = { ...llista[idx], ...p };
      } else {
        llista.push(p);
      }
      afegides++;
    });

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

    console.log(`[API] Lot de ${afegides} preguntes desades directament al fitxer .js de ${bancKey}`);
    return res.json({
      success: true,
      banc: bancKey,
      afegides,
      total: llista.length,
      missatge: `${afegides} preguntes desades correctament al fitxer .js!`
    });
  } catch (error) {
    console.error('Error desant lot al fitxer .js:', error);
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

// ============================================================================
// INTEGRACIÓ GEMINI IA (GOOGLE GENAI) - AGENT MEDINA
// ============================================================================
let geminiClient = null;
function getGeminiClient() {
  if (!geminiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return null;
    geminiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return geminiClient;
}

async function executarGeminiAmbFallback(ai, promptOrContents, responseMimeType = 'application/json', tools = undefined, extraConfig = {}) {
  // Models oficials suportats per l'API de Gemini a Google AI Studio
  const models = ['gemini-3.1-flash-lite', 'gemini-flash-latest'];
  let lastErr = null;

  // Fem fins a 2 rondes completes alternant entre models
  for (let ronda = 0; ronda < 2; ronda++) {
    for (const model of models) {
      try {
        const config = { ...extraConfig };
        if (responseMimeType && responseMimeType === 'application/json') {
          config.responseMimeType = 'application/json';
        }
        if (tools) config.tools = tools;

        const response = await ai.models.generateContent({
          model,
          contents: promptOrContents,
          config
        });
        if (response && response.text) {
          return { response, model };
        }
      } catch (err) {
        lastErr = err;
        const msg = err?.message || String(err);
        const esSaturat = err?.status === 503 || msg.includes('503') || msg.includes('high demand') || err?.status === 429 || msg.includes('429');
        console.warn(`[Gemini] Model ${model} (ronda ${ronda + 1}) ha fallat (${msg.slice(0, 110)}), provant següent model...`);

        // Si és un error de demanda/quota, passem immediatament al següent model disponible
        if (!esSaturat && (err?.status === 400 || msg.includes('INVALID_ARGUMENT'))) {
          continue;
        }
      }
    }

    // Si tots els models han fallat en la primera ronda, esperem amb backoff i jitter
    if (ronda === 0) {
      await new Promise(r => setTimeout(r, 1200 + Math.random() * 800));
    }
  }
  throw lastErr;
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Endpoint universal /api/chat compatible amb Vercel i clients remots
app.all('/api/chat', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const prompt = (req.body && (req.body.prompt || req.body.message || req.body.missatge)) || req.query.prompt || req.query.q || '';
  if (!prompt || !prompt.trim()) {
    return res.json({ text: "Sóc el teu tutor d'oposicions. En què et puc ajudar avui?" });
  }

  const ai = getGeminiClient();
  if (!ai) {
    const trobats = cercarALaGuia(prompt, 2);
    if (trobats && trobats.length > 0) {
      const t = trobats[0];
      return res.json({
        text: `📌 **Guia d'Estudi Mossos d'Esquadra (Juny 2026) - ${t.codi}: ${t.titol}**\n\n${(t.ideesForca || []).slice(0, 3).join('\n')}\n\n💡 *Pàgines oficials: ${t.pagines}*`
      });
    }
    return res.json({
      text: `S'ha rebut la teva consulta: "${prompt}". Consulta la Guia Mossos 2026 o el temari de Policia Local per a més informació.`
    });
  }

  try {
    const { response } = await executarGeminiAmbFallback(ai, prompt, undefined);
    if (response && response.text) {
      return res.json({ text: response.text });
    }
    throw new Error('No s\'ha pogut obtenir resposta de Gemini');
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Error generant resposta' });
  }
});

// 1. Endpoint per resoldre DUBTES d'una pregunta amb Gemini IA
app.post('/api/gemini/dubte-pregunta', async (req, res) => {
  const { pregunta, opcions, resposta, respostaTriada, explicacio, banc, seccio, dubte } = req.body || {};
  if (!pregunta || !Array.isArray(opcions)) {
    return res.status(400).json({ success: false, error: 'Falta la pregunta o les opcions' });
  }

  const lletres = ['A', 'B', 'C', 'D'];
  const idxResp = (typeof resposta === 'number' && resposta >= 0 && resposta < opcions.length) ? resposta : 0;
  const lletraCorrecta = lletres[idxResp];
  const textCorrecte = opcions[idxResp] || '';
  const triadaLletra = (typeof respostaTriada === 'number' && respostaTriada >= 0 && respostaTriada < opcions.length) ? lletres[respostaTriada] : null;

  // Cerca de suport a la Guia Oficial de Mossos d'Esquadra
  let matchGuia = null;
  let contextGuiaDubte = '';
  try {
    const cerca = cercarALaGuia(`${pregunta} ${seccio || ''}`, 1);
    if (cerca.length > 0 && (banc === 'mossos' || cerca[0].puntuacio >= 15)) {
      matchGuia = cerca[0];
      const topFragment = matchGuia.coincidencies.map(c => c.text).slice(0, 2).join('\n\n');
      contextGuiaDubte = `
FONT DE LA GUIA OFICIAL MOSSOS D'ESQUADRA (JUNY 2026):
${matchGuia.codi}: ${matchGuia.titol} [Pàgines ${matchGuia.pagines}]
${topFragment || matchGuia.contingutText.slice(0, 1500)}
Si la resposta es fonamenta en aquesta guia, cita [Pàg. X] expressament.
`;
    }
  } catch (_) {}

  const fallbackLocal = () => ({
    explicacioClau: `La resposta oficial correcta és l'opció **${lletraCorrecta}) ${textCorrecte}**. ${explicacio ? `\n\n📌 *Justificació del temari:* ${explicacio}` : ''}`,
    perQueEsCorrecta: `Segons el temari oficial i la normativa de referència de l'oposició (${banc === 'pl' ? 'Policia Local' : banc === 'mossos' ? "Mossos d'Esquadra" : 'Actualitat'}), l'opció ${lletraCorrecta} reflecteix amb exactitud el precepte aplicable.${matchGuia ? ` [Guia Mossos 2026, ${matchGuia.codi}, pàg. ${matchGuia.pagines}]` : ''}`,
    perQueSonFalses: `Les altres opcions contenen distractors típics d'examen com terminis modificats, terminologia no vigent o conceptes incompatibles.`,
    baseLegalVigent: matchGuia ? `Guia Oficial Mossos 2026: ${matchGuia.codi} [Pàg. ${matchGuia.pagines}] / Legislació aplicable` : (explicacio || 'Legislació vigent de Catalunya i de l\'Estat (CE, CP, LECrim, Llei 16/1991 o 10/1994).'),
    estatVigencia: 'vigent',
    detallVigencia: 'Aquesta pregunta està d\'acord amb les bases oficials i la normativa vigent.',
    consellExamen: 'Llegeix sempre amb atenció paraules com "sempre", "mai", "excepte" o els terminis temporals.'
  });

  const ai = getGeminiClient();
  if (!ai) {
    return res.json({
      success: true,
      font: 'local_fallback',
      respostaIA: fallbackLocal(),
      avisApiKey: 'Per gaudir de respostes jurídiques personalitzades en temps real amb Gemini, afegeix GEMINI_API_KEY a la configuració.'
    });
  }

  try {
    const opcionsLlistat = opcions.map((o, idx) => `${lletres[idx]}) ${o}`).join('\n');
    const prompt = `Ets el tutor d'oposicions jurídic expert en els cossos de Mossos d'Esquadra i Policia Local de Catalunya d'Agent Medina.
Un opositor té un dubte sobre la següent pregunta tipus test:

PREGUNTA:
"${pregunta}"

OPCIONS:
${opcionsLlistat}

RESPOSTA CORRECTA OFICIAL: Opció ${lletraCorrecta}) "${textCorrecte}"
${triadaLletra ? `L'opositor havia triat: Opció ${triadaLletra}) "${opcions[respostaTriada] || ''}"` : ''}
${explicacio ? `Justificació del temari: "${explicacio}"` : ''}
${seccio ? `Tema o matèria: "${seccio}"` : ''}
${banc ? `Cos policial: ${banc === 'pl' ? 'Policia Local' : banc === 'mossos' ? "Mossos d'Esquadra" : 'Actualitat'}` : ''}
${contextGuiaDubte}
DUBTE O CONSULTA DE L'OPOSITOR:
"${dubte || 'Explica\'m detalladament per què aquesta és la resposta correcta, per què les altres són falses, la cita legal exacta i si està vigent.'}"

Instruccions estrictes:
1. Respon SEMPRE en català clar, formal i directe.
2. Cita l'article i la llei vigent exacte (Constitució Espanyola, Llei 16/1991 de policies locals, Llei 10/1994 de Mossos, Codi Penal, LECrim, Llei 4/2015 de seguretat ciutadana, RGC, etc.).
3. Explica breument per què les opcions falses són distractors.
4. Indica clarament si la norma està VIGENT o si ha sofert alguna reforma recent.
5. Proporciona un consell mnemotècnic o clau pràctica per a l'examen.

Retorna exclusivament un JSON amb l'estructura:
{
  "explicacioClau": "Explicació pedagògica clara i resumida (2-4 frases).",
  "perQueEsCorrecta": "Anàlisi jurídica detallada citant article i precepte literal.",
  "perQueSonFalses": "Per què cadascuna de les altres opcions és incorrecta.",
  "baseLegalVigent": "Cita concreta (ex: Art. 17.2 Constitució Espanyola)",
  "estatVigencia": "vigent" | "revisio" | "neutral",
  "detallVigencia": "Indicació de vigència actual (ex: 'Normativa 100% vigent sense modificacions recents').",
  "consellExamen": "Truc mnemotècnic o recomanació per a l'examen oficial."
}`;

    const { response, model } = await executarGeminiAmbFallback(ai, prompt, 'application/json');

    let respostaIA = {};
    try {
      let text = (response.text || '').trim();
      text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
      respostaIA = JSON.parse(text);
      if (typeof respostaIA.explicacioClau === 'string' && respostaIA.explicacioClau.trim().startsWith('{')) {
        try {
          const nested = JSON.parse(respostaIA.explicacioClau);
          if (nested && typeof nested === 'object') {
            respostaIA = { ...respostaIA, ...nested };
          }
        } catch (_) {}
      }
    } catch (parseErr) {
      respostaIA = {
        explicacioClau: response.text || 'No s\'ha pogut processar la resposta.',
        perQueEsCorrecta: '',
        perQueSonFalses: '',
        baseLegalVigent: '',
        estatVigencia: 'vigent',
        detallVigencia: 'Normativa vigent',
        consellExamen: ''
      };
    }

    return res.json({
      success: true,
      font: `gemini (${model})`,
      respostaIA
    });
  } catch (error) {
    console.error('Error a /api/gemini/dubte-pregunta, utilitzant resposta local assistida:', error?.message);
    return res.json({
      success: true,
      font: 'local_fallback_on_error',
      respostaIA: fallbackLocal(),
      avisError: 'Els servidors de Gemini tenien alta demanda puntual. S\'ha generat la resposta estructurada de suport.'
    });
  }
});

// Helper de classificació heurística local quan no hi ha GEMINI_API_KEY
function classificarLocalmentPregunta(q, temarisDisponibles = [], bancPref = 'pl') {
  const txt = `${q.pregunta || ''} ${(q.opcions || []).join(' ')} ${q.explicacio || ''}`.toLowerCase();
  
  // Detecció de vigència
  let estatVigencia = 'vigent';
  let motiuVigencia = 'Normativa aparentment vigent';

  if (txt.includes('30/1992') || txt.includes('llei 30/1992')) {
    estatVigencia = 'desactualitzada';
    motiuVigencia = '⚠️ La Llei 30/1992 va ser derogada per la Llei 39/2015 del procediment administratiu comú.';
  } else if (txt.includes('falta penal') || txt.includes('faltes penals') || txt.includes('judici de faltes')) {
    estatVigencia = 'desactualitzada';
    motiuVigencia = '⚠️ Les faltes penals van ser suprimides per la reforma del Codi Penal (LO 1/2015) i substituïdes per delictes lleus o infraccions administratives.';
  } else if (txt.includes('1/1992') || txt.includes('llei 1/1992')) {
    estatVigencia = 'desactualitzada';
    motiuVigencia = '⚠️ La Llei 1/1992 de seguretat ciutadana va ser derogada per la LO 4/2015.';
  } else if (txt.includes('velocitat màxima en carrer') && (txt.includes('50 km/h') || txt.includes('50km/h'))) {
    estatVigencia = 'desactualitzada';
    motiuVigencia = '⚠️ Recorda que el RD 970/2020 va establir el límit general en vies urbanes d\'un sol carril per sentit a 30 km/h (o 20 km/h en plataforma única).';
  }

  // Detecció de tema coincident entre els temaris disponibles
  const llistaTemes = Array.isArray(temarisDisponibles) ? temarisDisponibles : [];
  let temaTrobat = null;

  const matxTemes = [
    { keywords: ['constitució', 'ce', 'tribunal constitucional', 'corona', 'corts generals'], nomPart: 'constitució' },
    { keywords: ['estatut', 'generalitat', 'parlament de catalunya', 'síndic de greuges', 'consell de garanties'], nomPart: 'estatut' },
    { keywords: ['llei 16/1991', 'policia local', 'cossos de policia local', 'institut armat'], nomPart: '16/1991' },
    { keywords: ['municipi', 'alcalde', 'ple', 'comissió de govern', 'padró', 'llei 7/1985', 'règim local'], nomPart: 'municipi' },
    { keywords: ['39/2015', '40/2015', 'procediment administratiu', 'acte administratiu', 'silenci administratiu'], nomPart: 'procediment' },
    { keywords: ['codi penal', 'homicidi', 'robatori', 'furt', 'pena', 'presó', 'legítima defensa'], nomPart: 'penal' },
    { keywords: ['detenció', 'habeas corpus', 'lecrim', 'atestat', 'policia judicial', 'enjudiciament criminal'], nomPart: 'detenci' },
    { keywords: ['trànsit', 'circulació', 'seguretat viària', 'permís de conduir', 'alcoholèmia', 'rgc'], nomPart: 'trànsit' },
    { keywords: ['4/2015', 'seguretat ciutadana', 'escorcoll', 'identificació a la via pública'], nomPart: 'seguretat ciutadana' },
    { keywords: ['mossos', 'llei 10/1994', 'policia de la generalitat'], nomPart: 'mossos' },
    { keywords: ['protecció de dades', 'lopd', 'rgpd'], nomPart: 'dades' },
    { keywords: ['unió europea', 'tractat', 'comissió europea'], nomPart: 'unió europea' }
  ];

  for (const m of matxTemes) {
    if (m.keywords.some(k => txt.includes(k))) {
      // Buscar a la llista de temaris un tema que contingui aquest nomPart
      const match = llistaTemes.find(t => t.toLowerCase().includes(m.nomPart));
      if (match) {
        temaTrobat = match;
        break;
      }
    }
  }

  // Banc recomanat
  let bancRecomanat = bancPref || 'pl';
  if (txt.includes('mossos') || txt.includes('llei 10/1994') || txt.includes('generalitat')) {
    bancRecomanat = 'mossos';
  } else if (txt.includes('policia local') || txt.includes('alcalde') || txt.includes('ordenança municipal') || txt.includes('llei 16/1991')) {
    bancRecomanat = 'pl';
  }

  return {
    id: q.id,
    coincideix: Boolean(temaTrobat),
    temaCoincident: temaTrobat,
    suggerimentNouTema: temaTrobat ? null : suggerirTitolNouTema(q),
    bancRecomanat,
    estatVigencia,
    motiuVigencia,
    confianca: temaTrobat ? 85 : 40
  };
}

function suggerirTitolNouTema(q) {
  const txt = (q.pregunta || '').toLowerCase();
  if (txt.includes('medi ambient') || txt.includes('residu') || txt.includes('animal')) return 'Medi Ambient i Convivència Animal';
  if (txt.includes('espectacle') || txt.includes('local') || txt.includes('horari')) return 'Policia Administrativa: Activitats i Espectacles Públics';
  if (txt.includes('urbanisme') || txt.includes('llicència d\'obres')) return 'Règim Urbanístic i Policia d\'Edificació';
  if (txt.includes('penitenciari') || txt.includes('presó')) return 'Dret i Àmbit Penitenciari';
  if (txt.includes('dret civil') || txt.includes('contracte')) return 'Dret Civil i Contractació Pública';
  if (txt.includes('estrangeria') || txt.includes('visat') || txt.includes('expulsió')) return 'Dret d\'Estrangeria i Protecció Internacional';
  return 'Tema Específic Addicional';
}

// 2. Endpoint per CLASSIFICAR EN LOT per temes i verificar VIGÈNCIA
app.post('/api/gemini/classificar-lot', async (req, res) => {
  try {
    const { preguntes, banc, municipi, temarisDisponibles } = req.body;
    if (!Array.isArray(preguntes) || preguntes.length === 0) {
      return res.status(400).json({ success: false, error: 'Llista de preguntes buida' });
    }

    const ai = getGeminiClient();
    const lletres = ['a', 'b', 'c', 'd'];
    const lotAProcessar = preguntes.slice(0, 35); // Màxim 35 per crida per mantenir velocitat i precisió

    if (!ai) {
      const classificacions = lotAProcessar.map(q => classificarLocalmentPregunta(q, temarisDisponibles, banc));
      return res.json({
        success: true,
        font: 'local_heuristic',
        classificacions,
        avisApiKey: 'Pots configurar GEMINI_API_KEY per activar la verificació jurídica en temps real amb Gemini 3.8 Flash.'
      });
    }

    const temesTxt = Array.isArray(temarisDisponibles) && temarisDisponibles.length > 0
      ? temarisDisponibles.slice(0, 60).join('\n')
      : 'Temari general de Policia Local i Mossos (Constitució Espanyola, Estatut d\'Autonomia, LPAC 39/2015, Règim Local 7/1985, Codi Penal, LECrim, Trànsit RGC, Seguretat Ciutadana 4/2015, Llei 16/1991 de policies locals, Deontologia)';

    const preguntesFormat = lotAProcessar.map((q, idx) => {
      const ops = (q.opcions || []).map((o, i) => `${lletres[i]}) ${o}`).join('; ');
      return `ID: ${q.id || `Q_${idx}`}\nPregunta: ${q.pregunta}\nOpcions: ${ops}\nResposta: ${lletres[q.resposta] || 'a'}\nExplicació: ${q.explicacio || ''}`;
    }).join('\n---\n');

    const prompt = `Ets el classificador oficial de temaris d'oposicions de Mossos d'Esquadra i Policia Local de Catalunya d'Agent Medina.
Aquest és el catàleg oficial de temes disponibles actualment:
${temesTxt}

Objectiu per a CADA pregunta:
1. "coincideix": boolean. True si la pregunta correspon a un dels temes oficials del catàleg anterior.
2. "temaCoincident": string amb el nom exacte del tema del catàleg al qual correspon (o null si no coincideix).
3. "suggerimentNouTema": string proposant un nom per a un nou tema si no hi ha coincidència (ex: "Dret Processal Civil", "Activitats i Espectacles Públics", "Protecció del Medi Ambient Local", etc.), o null si ja coincideix.
4. "bancRecomanat": "pl" (Policia Local), "mossos" (Mossos d'Esquadra) o "act" (Actualitat).
5. "estatVigencia": "vigent" (normativa actualitzada i en vigor), "desactualitzada" (fa referència a lleis derogades com la Llei 30/1992, la Llei 1/1992, faltes penals suprimides el 2015, límits de velocitat antics, etc.), o "neutral" (cultura general, geografia, psicotècnics).
6. "motiuVigencia": frase breu explicativa de la vigència legal en català (ex: "Art. 17.2 CE plenament vigent" o "⚠️ Llei 30/1992 derogada per la Llei 39/2015").
7. "confianca": percentatge numèric de seguretat (0 a 100).

PREGUNTES:
${preguntesFormat}

Respon ÚNICAMENT amb un array JSON amb aquest format:
[
  {
    "id": "ID de la pregunta",
    "coincideix": true,
    "temaCoincident": "Nom exacte del tema coincident",
    "suggerimentNouTema": null,
    "bancRecomanat": "pl",
    "estatVigencia": "vigent",
    "motiuVigencia": "Art. 17.2 CE vigent",
    "confianca": 95
  }
]`;

    const { response, model } = await executarGeminiAmbFallback(ai, prompt, 'application/json');

    let classificacions = [];
    try {
      const text = response.text ? response.text.trim() : '[]';
      classificacions = JSON.parse(text);
      if (!Array.isArray(classificacions)) classificacions = [classificacions];
    } catch (parseErr) {
      console.warn('Fallback a classificació local per error en JSON de Gemini:', parseErr);
      classificacions = lotAProcessar.map(q => classificarLocalmentPregunta(q, temarisDisponibles, banc));
    }

    return res.json({
      success: true,
      font: `gemini (${model})`,
      classificacions
    });
  } catch (error) {
    console.error('Error a /api/gemini/classificar-lot, usant classificador local:', error?.message);
    const { preguntes, temarisDisponibles, banc } = req.body || {};
    const lotAProcessar = (Array.isArray(preguntes) ? preguntes : []).slice(0, 35);
    const classificacions = lotAProcessar.map(q => classificarLocalmentPregunta(q, temarisDisponibles, banc));
    return res.json({
      success: true,
      font: 'local_fallback_on_error',
      classificacions,
      avisError: 'Els servidors de Gemini tenien alta demanda temporal. S\'ha utilitzat la classificació heurística assistida.'
    });
  }
});

// ==========================================
// SERVEI D'ORDENANCES I DOCUMENTS D'ESTUDI
// ==========================================
const DOCUMENTS_FILE = path.join(__dirname, 'documents_ordenances.json');

function getDocuments() {
  try {
    if (fs.existsSync(DOCUMENTS_FILE)) {
      const d = JSON.parse(fs.readFileSync(DOCUMENTS_FILE, 'utf8'));
      if (Array.isArray(d)) return d;
    }
  } catch (e) {
    console.error('Error llegint documents_ordenances.json:', e);
  }
  return [];
}

function saveDocuments(docs) {
  try {
    fs.writeFileSync(DOCUMENTS_FILE, JSON.stringify(docs, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Error desant documents_ordenances.json:', e);
    return false;
  }
}

app.get('/api/documents-ordenances', (req, res) => {
  res.json({ success: true, documents: getDocuments() });
});

app.post('/api/documents-ordenances', (req, res) => {
  const { doc } = req.body || {};
  if (!doc || !doc.titol || !doc.contingutText) {
    return res.status(400).json({ success: false, error: 'Falten el títol o el contingut del document' });
  }

  const docs = getDocuments();
  let id = doc.id;
  if (!id) {
    id = 'doc_' + Date.now();
    doc.id = id;
  }
  doc.dataActualitzacio = new Date().toISOString();
  if (!doc.dataCreacio) doc.dataCreacio = doc.dataActualitzacio;

  const idx = docs.findIndex(d => d.id === id);
  if (idx !== -1) {
    docs[idx] = { ...docs[idx], ...doc };
  } else {
    docs.unshift(doc);
  }

  saveDocuments(docs);
  res.json({ success: true, doc, total: docs.length });
});

app.delete('/api/documents-ordenances/:id', (req, res) => {
  const { id } = req.params;
  let docs = getDocuments();
  const inicial = docs.length;
  docs = docs.filter(d => d.id !== id);
  if (docs.length === inicial) {
    return res.status(404).json({ success: false, error: 'Document no trobat' });
  }
  saveDocuments(docs);
  res.json({ success: true, id, total: docs.length });
});

// ==========================================
// GESTIÓ DE TEMES ANNEXOS (PERSONALITZATS / MUNICIPALS)
// ==========================================
function getTemesAnnexos() {
  try {
    if (!fs.existsSync(TEMES_ANNEXOS_FILE)) {
      return [];
    }
    const data = fs.readFileSync(TEMES_ANNEXOS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    console.error('Error llegint temes_annexos.json:', e);
    return [];
  }
}

function saveTemesAnnexos(temes) {
  try {
    fs.writeFileSync(TEMES_ANNEXOS_FILE, JSON.stringify(temes, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Error desant temes_annexos.json:', e);
    return false;
  }
}

app.get('/api/temes-annexos', (req, res) => {
  res.json({ success: true, temes: getTemesAnnexos() });
});

app.post('/api/temes-annexos', (req, res) => {
  const { tema } = req.body || {};
  if (!tema || !tema.nom) {
    return res.status(400).json({ success: false, error: 'Falta el nom del tema annex' });
  }

  const temes = getTemesAnnexos();
  let id = tema.id;
  if (!id) {
    id = 'annex_' + Date.now();
    tema.id = id;
  }
  tema.dataActualitzacio = new Date().toISOString();
  if (!tema.dataCreacio) tema.dataCreacio = tema.dataActualitzacio;

  const idx = temes.findIndex(t => t.id === id);
  if (idx !== -1) {
    temes[idx] = { ...temes[idx], ...tema };
  } else {
    temes.push(tema);
  }

  saveTemesAnnexos(temes);
  res.json({ success: true, tema, total: temes.length });
});

app.delete('/api/temes-annexos/:id', (req, res) => {
  const { id } = req.params;
  let temes = getTemesAnnexos();
  const inicial = temes.length;
  temes = temes.filter(t => t.id !== id);
  if (temes.length === inicial) {
    return res.status(404).json({ success: false, error: 'Tema annex no trobat' });
  }
  saveTemesAnnexos(temes);
  res.json({ success: true, id, total: temes.length });
});

// ==========================================
// GESTIÓ D'EXÀMENS OFICIALS REALS (BLOCS DE SIMULACRE)
// ==========================================
function getExamensOficials() {
  try {
    if (!fs.existsSync(EXAMENS_OFICIALS_FILE)) {
      return [];
    }
    const data = fs.readFileSync(EXAMENS_OFICIALS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    console.error('Error llegint examens_oficials.json:', e);
    return [];
  }
}

function saveExamensOficials(examens) {
  try {
    fs.writeFileSync(EXAMENS_OFICIALS_FILE, JSON.stringify(examens, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Error desant examens_oficials.json:', e);
    return false;
  }
}

app.get('/api/examens-oficials', (req, res) => {
  res.json({ success: true, examens: getExamensOficials() });
});

app.post('/api/examens-oficials', (req, res) => {
  const { examen } = req.body || {};
  if (!examen || !examen.titol || !Array.isArray(examen.preguntes)) {
    return res.status(400).json({ success: false, error: 'Falten el títol o les preguntes de l\'examen' });
  }

  const examens = getExamensOficials();
  let id = examen.id;
  if (!id) {
    id = 'examen_' + Date.now();
    examen.id = id;
  }
  examen.dataActualitzacio = new Date().toISOString();
  if (!examen.dataCreacio) examen.dataCreacio = examen.dataActualitzacio;

  const idx = examens.findIndex(e => e.id === id);
  if (idx !== -1) {
    examens[idx] = { ...examens[idx], ...examen };
  } else {
    examens.unshift(examen);
  }

  saveExamensOficials(examens);
  res.json({ success: true, examen, total: examens.length });
});

app.delete('/api/examens-oficials/:id', (req, res) => {
  const { id } = req.params;
  let examens = getExamensOficials();
  const inicial = examens.length;
  examens = examens.filter(e => e.id !== id);
  if (examens.length === inicial) {
    return res.status(404).json({ success: false, error: 'Examen no trobat' });
  }
  saveExamensOficials(examens);
  res.json({ success: true, id, total: examens.length });
});

// ==========================================
// GUIA D'ESTUDI OFICIAL MOSSOS D'ESQUADRA 2026
// ==========================================
app.get('/api/guia-mossos/temes', (req, res) => {
  try {
    const temes = getTotsElsTemesGuia();
    res.json({ success: true, total: temes.length, temes });
  } catch (err) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

app.get('/api/guia-mossos/tema/:id', (req, res) => {
  try {
    const tema = getTemaGuiaPerId(req.params.id);
    if (!tema) return res.status(404).json({ success: false, error: 'Tema no trobat a la Guia' });
    res.json({ success: true, tema });
  } catch (err) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

app.post('/api/guia-mossos/cercar', (req, res) => {
  try {
    const { query, max } = req.body || {};
    const resultats = cercarALaGuia(query, max || 4);
    res.json({ success: true, query, total: resultats.length, resultats });
  } catch (err) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// ==========================================
// TUTOR IA PERSONAL (AGENT MEDINA)
// ==========================================
// Endpoint per analitzar bases d'un municipi amb IA i detectar transversals
app.post('/api/gemini/analitzar-bases-municipi', async (req, res) => {
  try {
    const { nomMunicipi, textBases, municipisExistents } = req.body || {};
    const nomMun = String(nomMunicipi || '').trim() || 'Nou Municipi';
    const rawText = String(textBases || '').trim();

    if (!rawText) {
      return res.status(400).json({ success: false, error: 'Cal proporcionar el text o llistat de temes de les bases.' });
    }

    const llistaMun = Array.isArray(municipisExistents) && municipisExistents.length > 0
      ? municipisExistents
      : ['Constantí', 'Cubelles', 'Cunit'];

    // Map de matèries troncals i en quins municipis clàssics solen entrar
    const MATERIES_MAP = {
      'constitucio': { nom: 'Constitució Espanyola de 1978 i TC', munHabituals: ['Constantí', 'Cubelles', 'Cunit'] },
      'estatut': { nom: 'Estatut d’Autonomia de Catalunya', munHabituals: ['Constantí', 'Cubelles', 'Cunit'] },
      'regim_local': { nom: 'Organització Territorial i Règim Local (LBRL)', munHabituals: ['Constantí', 'Cubelles', 'Cunit'] },
      'procediment_administratiu': { nom: 'Procediment Administratiu Comú (Llei 39/2015)', munHabituals: ['Constantí', 'Cubelles', 'Cunit'] },
      'disciplinari_incompatibilitats': { nom: 'Funció Pública i Règim Disciplinari', munHabituals: ['Constantí', 'Cubelles', 'Cunit'] },
      'transparencia_dades': { nom: 'Transparència i Protecció de Dades (RGPD / LOPD)', munHabituals: ['Constantí', 'Cubelles', 'Cunit'] },
      'llei_16_1991': { nom: 'Llei 16/1991 de Policies Locals de Catalunya', munHabituals: ['Constantí', 'Cubelles', 'Cunit'] },
      'forces_cossos': { nom: 'Forces i Cossos de Seguretat (LO 2/1986)', munHabituals: ['Constantí', 'Cubelles', 'Cunit'] },
      'seguretat_ciutadana': { nom: 'Seguretat Ciutadana (Llei Orgànica 4/2015)', munHabituals: ['Constantí', 'Cubelles', 'Cunit'] },
      'seguretat_publica': { nom: 'Sistema de Seguretat Pública de Catalunya (Llei 4/2003)', munHabituals: ['Constantí', 'Cubelles', 'Cunit'] },
      'codi_penal': { nom: 'Codi Penal i Delictes', munHabituals: ['Constantí', 'Cubelles', 'Cunit'] },
      'transit': { nom: 'Trànsit, RGC i Seguretat Viària', munHabituals: ['Constantí', 'Cubelles', 'Cunit'] },
      'accidents_transit': { nom: 'Accidents de Trànsit i Alcoholèmies', munHabituals: ['Constantí', 'Cubelles', 'Cunit'] },
      'detencions': { nom: 'Detencions, Drets del Detingut i Habeas Corpus (LECrim)', munHabituals: ['Constantí', 'Cubelles', 'Cunit'] },
      'atestat_policial': { nom: 'L’Atestat Policial, Denúncies i Actes', munHabituals: ['Constantí', 'Cubelles', 'Cunit'] },
      'codi_etica': { nom: 'Codi d’Ètica Policial de Catalunya', munHabituals: ['Constantí', 'Cubelles', 'Cunit'] },
      'unio_europea': { nom: 'La Unió Europea i Institucions', munHabituals: ['Cubelles', 'Cunit'] }
    };

    const ai = getGeminiClient();

    if (ai) {
      try {
        const promptIA = `Ets un expert en oposicions de Policia Local a Catalunya.
Analitza el següent text de les bases de convocatòria per al municipi de "${nomMun}".
Els municipis que ja tenim registrats a la plataforma són: ${llistaMun.join(', ')}.

Matèries transversals conegudes:
${Object.entries(MATERIES_MAP).map(([id, info]) => `- ${id}: ${info.nom} (Entra habitualment a: ${info.munHabituals.join(', ')})`).join('\n')}

Objectius de l'anàlisi:
1. Extreu tots i cadascun dels temes que componen el temari oficial d'aquest municipi.
2. Identifica si cada tema és TRANSVERSAL (coincideix amb una matèria comuna) o ESPECÍFIC LOCAL (propi exclusiu de ${nomMun}, com ordenances del municipi, carrerer, història local, geografia).
3. Si és transversal, indica quins municipis dels registrats (${llistaMun.join(', ')}) també tenen aquest tema (coincideixAmb), i quins NO el tenen (noCoincideixAmb).
4. Genera una etiqueta clara de transversalitat (ex: "Transversal: Cubelles, El Vendrell · No a Cunit" o "Transversal a tots els municipis").

Respon EXCLUSIVAMENT amb un objecte JSON vàlid amb aquest format:
{
  "nomMunicipi": "${nomMun}",
  "temes": [
    {
      "id": "1",
      "codi": "T1",
      "titol": "Títol complet del tema",
      "descripcio": "Resum o contingut clau",
      "materiaId": "codi_penal | constitucio | estatut | regim_local | procediment_administratiu | llei_16_1991 | etc... o especific_${nomMun.toLowerCase()}",
      "materiaNom": "Nom de la matèria o Específic local de ${nomMun}",
      "esTransversal": true,
      "esEspecific": false,
      "coincideixAmb": ["Cubelles", "Constantí"],
      "noCoincideixAmb": ["Cunit"],
      "etiquetaTransversal": "Transversal: Cubelles, Constantí, ${nomMun} · No a Cunit"
    }
  ],
  "estadistiques": {
    "totalTemes": 0,
    "totalTransversals": 0,
    "totalEspecifics": 0,
    "resumCompatibilitat": "Descripció en una frase del grau de coincidència"
  }
}

Text de les bases a analitzar:
${rawText.slice(0, 30000)}
`;

        const model = 'gemini-2.5-flash';
        const response = await ai.models.generateContent({
          model,
          contents: promptIA,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.1
          }
        });

        if (response.text) {
          const parsed = JSON.parse(response.text.trim());
          if (Array.isArray(parsed.temes) && parsed.temes.length > 0) {
            return res.json({
              success: true,
              font: `gemini (${model})`,
              ...parsed
            });
          }
        }
      } catch (geminiError) {
        console.warn('Avís a anàlisi de bases amb Gemini, utilitzant motor heurístic local:', geminiError?.message);
      }
    }

    // Motor heurístic local de reserva (garanteix resposta instantània si la IA no està disponible)
    const linies = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const temesDetectats = [];
    let temaActual = null;

    linies.forEach(linia => {
      const m = linia.match(/^(?:tema|t\.)\s*([0-9a-zA-Z\.\-_]+)(?:[:\.\-\s]+)(.*)$/i) ||
                linia.match(/^([0-9]{1,3})[\.\-\)\s]+(.*)$/);
      if (m && m[1] && m[2]) {
        if (temaActual) temesDetectats.push(temaActual);
        temaActual = { rawId: m[1].replace(/[^0-9a-zA-Z]/g, ''), titol: m[2].trim(), descripcio: '' };
      } else if (temaActual) {
        temaActual.descripcio += (temaActual.descripcio ? ' ' : '') + linia;
      } else if (linia.length > 5 && linia.length < 250) {
        temaActual = { rawId: String(temesDetectats.length + 1), titol: linia, descripcio: '' };
      }
    });
    if (temaActual) temesDetectats.push(temaActual);

    let countTransversals = 0;
    let countEspecifics = 0;

    const temes = temesDetectats.map((t, idx) => {
      const id = String(idx + 1);
      const codi = `T${t.rawId || id}`;
      const txt = (t.titol + ' ' + t.descripcio).toLowerCase();
      const munLow = nomMun.toLowerCase();

      let materiaId = 'altres';
      let esEspecific = false;

      if (txt.includes(munLow) || txt.includes('ordenança municipal') || txt.includes('carrerer') || txt.includes('història local')) {
        materiaId = `especific_${munLow}`;
        esEspecific = true;
      } else if (txt.includes('penal') || txt.includes('delict')) {
        materiaId = 'codi_penal';
      } else if (txt.includes('constitució') || txt.includes('constitucional')) {
        materiaId = 'constitucio';
      } else if (txt.includes('estatut')) {
        materiaId = 'estatut';
      } else if (txt.includes('municipi') || txt.includes('règim local') || txt.includes('7/1985')) {
        materiaId = 'regim_local';
      } else if (txt.includes('procediment administratiu') || txt.includes('39/2015') || txt.includes('acte administratiu')) {
        materiaId = 'procediment_administratiu';
      } else if (txt.includes('16/1991')) {
        materiaId = 'llei_16_1991';
      } else if (txt.includes('2/1986') || txt.includes('forces i cossos')) {
        materiaId = 'forces_cossos';
      } else if (txt.includes('4/2015') || txt.includes('seguretat ciutadana')) {
        materiaId = 'seguretat_ciutadana';
      } else if (txt.includes('trànsit') || txt.includes('circulació')) {
        materiaId = 'transit';
      } else if (txt.includes('detenció') || txt.includes('habeas corpus')) {
        materiaId = 'detencions';
      } else if (txt.includes('atestat')) {
        materiaId = 'atestat_policial';
      } else if (txt.includes('unió europea') || txt.includes('europea')) {
        materiaId = 'unio_europea';
      } else if (txt.includes('ètica') || txt.includes('deontologia')) {
        materiaId = 'codi_etica';
      } else {
        materiaId = 'altres';
      }

      const matInfo = MATERIES_MAP[materiaId];
      const esTransversal = !esEspecific && materiaId !== 'altres';

      if (esTransversal) countTransversals++;
      else countEspecifics++;

      const habituals = matInfo ? matInfo.munHabituals.filter(m => llistaMun.includes(m)) : [];
      const coincideixAmb = esTransversal ? [...habituals] : [];
      const noCoincideixAmb = esTransversal ? llistaMun.filter(m => !habituals.includes(m)) : llistaMun;

      let etiquetaTransversal = '';
      if (esEspecific) {
        etiquetaTransversal = `📌 Específic local exclusiu de ${nomMun}`;
      } else if (esTransversal) {
        const altres = coincideixAmb.join(', ');
        const noHiEs = noCoincideixAmb.length > 0 ? ` · No entra a ${noCoincideixAmb.join(', ')}` : '';
        etiquetaTransversal = altres ? `Transversal: ${altres}, ${nomMun}${noHiEs}` : `Transversal nou: ${nomMun}`;
      } else {
        etiquetaTransversal = `Matèria general (${nomMun})`;
      }

      return {
        id,
        codi,
        titol: t.titol,
        descripcio: t.descripcio || '',
        materiaId,
        materiaNom: matInfo ? matInfo.nom : (esEspecific ? `Específic de ${nomMun}` : 'Altres matèries'),
        esTransversal,
        esEspecific,
        coincideixAmb,
        noCoincideixAmb,
        etiquetaTransversal
      };
    });

    return res.json({
      success: true,
      font: 'heuristica_local',
      nomMunicipi: nomMun,
      temes,
      estadistiques: {
        totalTemes: temes.length,
        totalTransversals: countTransversals,
        totalEspecifics: countEspecifics,
        resumCompatibilitat: `${countTransversals} temes transversals compartits amb altres municipis i ${countEspecifics} específics locals.`
      }
    });
  } catch (err) {
    console.error('Error a analitzar-bases-municipi:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Resposta estructurada de suport per a contingut policial en cas de caiguda o desconnexió de Gemini
function generarRespostaEstructuradaAgentMedina(pregunta, cos, ambit, docContext) {
  const q = (pregunta || '').toLowerCase().trim();
  const cosNom = cos === 'pl' ? 'Policia Local' : cos === 'mossos' ? "Mossos d'Esquadra" : 'PL / Mossos';

  if (q.includes('com estas') || q.includes('com estàs') || q.includes('que tal') || q.includes('què tal') || q.startsWith('hola') || q.startsWith('bon dia') || q.startsWith('bona tarda') || q === 'hola' || q === 'bones') {
    return `Hola! Estic al 100% i amb moltes ganes d'ajudar-te a aconseguir la plaça. Com et trobes avui? Digues-me si vols practicar un test ràpid o repassar algun tema concret!`;
  }

  if (q.includes('495') || (q.includes('delicte') && q.includes('lleu')) || (q.includes('detencio') && q.includes('falta'))) {
    return `🎯 **Idea Força & Concepte Clau:**
Com a regla general, per delictes lleus **NO** s'ha de detenir a ningú, llevat que concorrin les excepcions taxades de l'article 495 LECrim.

🧠 **Regla Mnemotècnica / Truc d'Oposició:**
Recorda la regla **DO-FI**: Sense **DO**micili conegut i sense **FI**ança bastant -> Només llavors procedeix la detenció.

⚖️ **Fonamentació Legal i Literalitat:**
- **Article 495 LECrim:** *"No se podrá detener por simples faltas [delitos leves], a no ser que el presunto reo no tuviese domicilio conocido ni diese fianza bastante, a juicio de la Autoridad o agente que intente detenerle."*
- **Article 17 CE:** Dret fonamental a la llibertat i seguretat personal.

⚠️ **Trampa Típica de Tribunal:**
Els tribunals de test solen posar preguntes trampa afirmant que «la reiteració delictiva o els antecedents policials faculten la detenció per delicte lleu». Això és **FALS**: Si el presumpte autor té domicili conegut i acreditat, és preceptiva la citació (Art. 962 LECrim) i està prohibida la detenció.

📊 **Esquema d'Actuació Operativa:**
| Situació de l'autor | Acció Policial Exigible | Base Legal |
|---|---|---|
| Amb domicili acreditat | Identificació i citació formal a judici immediat | Art. 962 LECrim |
| Sense domicili ni fiança | Detenció tècnica i custòdia policial | Art. 495 LECrim |`;
  }

  if (q.includes('alcohol') || q.includes('drog') || q.includes('taxa') || q.includes('383') || q.includes('379')) {
    return `🎯 **Idea Força & Concepte Clau:**
Conduir superant les taxes permeses és infracció administrativa molt greu (RGC / LSV) o delicte contra la seguretat viària (Art. 379.2 CP). La negativa a sotmetre's a les proves és delicte autònom de desobediència greu (Art. 383 CP).

🧠 **Regla Mnemotècnica / Truc d'Oposició:**
Recorda **15 - 25 - 60**:
- **15** (0,15 mg/l): Novells (fins a 2 anys) i Conductors Professionals.
- **25** (0,25 mg/l): Taxa General, ciclistes i VMP.
- **60** (0,60 mg/l en aire / 1,2 g/l en sang): Delicte Penal automàtic (Art. 379.2 CP).

⚖️ **Fonamentació Legal i Literalitat:**
- **Art. 379.2 Codi Penal:** Delicte si supera 0,60 mg/l d'alcohol en aire expirat (o 1,2 g/l en sang).
- **Art. 383 Codi Penal:** Negativa a les proves legalment establertes (presó de 6 mesos a 1 any i retirada del permís d'1 a 4 anys).
- **Taxa 0,0:** Menors d'edat conductors de qualsevol vehicle (ciclistes, VMP, ciclomotors).

⚠️ **Trampa Típica de Tribunal:**
Pregunten si un ciclista o usuari de VMP pot incórrer en el delicte de l'Art. 383 CP per negativa: La jurisprudència estableix que només és delicte en conductors de vehicles a motor o ciclomotors; per a VMP o bicicletes és sanció administrativa molt greu (1.000 €).

📊 **Taula de Taxes d'Alcoholèmia:**
| Tipus de Conductor | Taxa Màx. Aire | Taxa Màx. Sang | Tipus d'Infracció |
|---|---|---|---|
| General / VMP / Bici | 0,25 mg/l | 0,50 g/l | Administrativa |
| Novell (fins a 2 anys) | 0,15 mg/l | 0,30 g/l | Administrativa |
| Menors d'edat | 0,00 mg/l | 0,00 g/l | Administrativa |
| Qualsevol > 0,60 mg/l | > 0,60 mg/l | > 1,20 g/l | Delicte Penal (379.2 CP) |`;
  }

  if (docContext && docContext.contingutText) {
    return `🎯 **Idea Força & Concepte Clau:**
Anàlisi de l'ordenança/document oficial **${docContext.titol || 'Normativa'}**.

⚖️ **Fonamentació Legal Aplicable:**
${docContext.contingutText.slice(0, 700)}

💡 **Consell d'Estudi:** Consulta els articles destacats per aprofundir en les competències sancionadores de ${cosNom}.`;
  }

  return `🎯 **Idea Força & Concepte Clau:**
Per a preparar l'examen de **${cosNom}**, és fonamental estructurar els conceptes legals amb claredat i distingir les competències sancionadores de les operatives.

⚖️ **Marc Jurídic Bàsic:**
- **Constitució Espanyola:** Drets fonamentals (Arts. 14 a 29 CE) i principis rectors.
- **Llei Orgànica 2/1986 de Forces i Cossos de Seguretat:** Principis bàsics d'actuació (Art. 5).
- **Llei 10/1994 de la Policia de la Generalitat - Mossos d'Esquadra** / **Llei 16/1991 de Policies Locals**.

💡 **Recomanació de l'Agent Medina:** Pots demanar un test de 3 preguntes o consultar un article o procediment concret per memoritzar-lo amb tot el detall.`;
}

app.post('/api/gemini/tutor-xat', async (req, res) => {
  const {
    missatge,
    historial,
    documentContext,
    titolDocument,
    municipi,
    cos,
    guiaTemaId,
    plTemaId,
    usuariNom,
    usuariEmail,
    cercarInternet
  } = req.body || {};

  if (!missatge || !missatge.trim()) {
    return res.status(400).json({ success: false, error: 'Missatge buit' });
  }

  const textNet = missatge.trim();
  const qLow = textNet.toLowerCase();

  let nomTractament = (usuariNom || '').trim();
  if (!nomTractament || /^(òscar|oscar|oposcarmossos|usuari|aspirant)$/i.test(nomTractament)) {
    if (usuariEmail) {
      const nomFromEmail = usuariEmail.split('@')[0].replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[0-9_.-]/g, ' ').trim();
      const firstWord = nomFromEmail.split(/\s+/)[0];
      if (firstWord && firstWord.length >= 2 && !/^(òscar|oscar|usuari)$/i.test(firstWord)) {
        nomTractament = firstWord.charAt(0).toUpperCase() + firstWord.slice(1);
      }
    }
  }
  if (!nomTractament || /^(òscar|oscar|oposcarmossos|usuari)$/i.test(nomTractament)) {
    nomTractament = 'Aspirant';
  }

  const cosTxt = cos === 'mossos' ? "Mossos d'Esquadra" : cos === 'pl' ? 'Policia Local' : 'Policia Local i Mossos d\'Esquadra';

  // 1. Detecció de consultes conversacionals, salutacions, cortesia, suport a l'opositor o seguiment de conversa
  const esSalutacio = /^(hola|bon dia|bona tarda|bona nit|bones|ei|eiii|hey|salut|qui ets|com estas|com estàs|què fas|com va|com et trobes|què tal|hello|hi)\b/i.test(qLow);
  const esCortesia = /^(gràcies|moltes gràcies|merci|molt bé|perfecte|genial|d'acord|ok|entès|clar|moltes mercès|adéu|fins després|fins demà|adeu)\b/i.test(qLow);
  const esSuportPedagogic = /(com estudiar|com començar|consell|metodologia|mètode|motivaci|cansat|nervi|bloquej|estrès|desanimat|planific|planificar|horari|quantes hores|repassar|repassos|com memoritzar|organitzar l'estudi|què em recomanes|ajuda|ajuda'm)/i.test(qLow);
  const esSeguimentConversa = /^(i si|i en el cas|i quan|per què|pots posar un exemple|un exemple|no ho entenc|no ho he entès|més senzill|explica-m'ho|continua|següent)\b/i.test(qLow);
  const esConversacional = esSalutacio || esCortesia || esSuportPedagogic || esSeguimentConversa;

  // 2. Cerca a documents i temaris oficials de la plataforma
  let docContextFinal = (documentContext || '').trim();
  let titolDocFinal = titolDocument || null;
  let municipiDocFinal = municipi || null;

  // Si no hi ha documentContext explícit, cerquem si coincideix amb alguna ordenança carregada
  if (!docContextFinal) {
    const totsDocs = getDocuments();
    for (const d of totsDocs) {
      const nomM = (d.municipi || '').toLowerCase();
      const titM = (d.titol || '').toLowerCase();
      if ((nomM && qLow.includes(nomM)) || (titM && qLow.includes(titM)) || (qLow.includes('ordenança') && qLow.includes(nomM))) {
        docContextFinal = d.contingutText || '';
        titolDocFinal = d.titol;
        municipiDocFinal = d.municipi;
        break;
      }
    }
  }

  // Cerca a la Guia Oficial de Mossos 2026
  let contextGuia = '';
  let trobatsGuia = [];
  try {
    const guiaIdNet = (guiaTemaId && guiaTemaId !== 'null' && guiaTemaId !== 'undefined')
      ? String(guiaTemaId).replace(/^guia:/, '').trim()
      : null;

    if (guiaIdNet && guiaIdNet !== 'auto' && guiaIdNet !== 'guia_auto') {
      contextGuia = construirContextGuiaPerPrompt(textNet, guiaIdNet);
    } else if (guiaIdNet === 'auto' || guiaIdNet === 'guia_auto' || cos === 'mossos') {
      contextGuia = construirContextGuiaPerPrompt(textNet, 'auto');
      trobatsGuia = cercarALaGuia(textNet, 3);
    } else {
      trobatsGuia = cercarALaGuia(textNet, 3);
      if (trobatsGuia.length > 0 && trobatsGuia[0].puntuacio >= 8) {
        contextGuia = construirContextGuiaPerPrompt(textNet, null);
      }
    }
  } catch (e) {
    console.warn('Avís processant Guia Mossos per a tutor:', e?.message);
  }

  // Avaluació de coincidència documental
  const teDocActiu = !!(docContextFinal && docContextFinal.length > 20);
  const teGuia = !!(trobatsGuia.length > 0 && trobatsGuia[0].puntuacio >= 6);
  const paraulesClauPolicials = /(art|article|llei|constitucio|constitucional|penal|delicte|detencio|detingut|alcohol|transit|policia|mossos|guardia|civisme|ordenan|infraccio|multa|sancio|habeas|dret|atestat|denuncia|jutjat|fiscal|parlament|generalitat|ajuntament|alcalde|test|suposit|pregunt|pregunta|competenci|competència|16\/1991|10\/1994|4\/2015|2\/1986|7\/1985|lecrim|cp|rgc|trltsv)/i;
  const esTemariPolicial = paraulesClauPolicials.test(qLow);

  const coincideixAmbDocuments = teDocActiu || teGuia || esTemariPolicial;

  // 3. Avaluació de sol·licitud de cerca a Internet
  const volInternet = cercarInternet === true || /cerca(?:r)? a internet|busca(?:r)? a internet|a internet/i.test(qLow);

  // Si la informació NO és als documents, NO és conversa/coaching i NO s'ha sol·licitat cerca a Internet
  const esPreguntaExterna = !coincideixAmbDocuments && !esConversacional && !volInternet;

  if (esPreguntaExterna) {
    return res.json({
      success: true,
      font: 'sense_coincidencia_documents',
      proposarCercaInternet: true,
      consultaOriginal: textNet,
      resposta: `Als teus documents i temari oficial no trobo referències a la teva consulta: "${textNet}".\n\nVols que busqui a Internet per a complementar la resposta?`
    });
  }

  const ai = getGeminiClient();

  // 4. Si no tenim client Gemini (o clau no disponible), retornem contingut estructurat del repositori o resposta conversacional
  if (!ai) {
    if (esConversacional) {
      if (esSalutacio) {
        const h = new Date().getHours();
        const sal = h < 14 ? 'Bon dia' : h < 21 ? 'Bona tarda' : 'Bona nit';
        return res.json({
          success: true,
          font: 'agent_medina_conversacio',
          resposta: `👋 **${sal}, ${nomTractament}! Molt bé i a punt per treballar amb tu.**

Com portes la sessió d'estudi d'avui? Què et ve de gust que repassem ara mateix: temari de ${cosTxt}, resolució d'un supòsit pràctic o unes quantes preguntes tipus test per escalfar motors?`
        });
      }
      if (esCortesia) {
        return res.json({
          success: true,
          font: 'agent_medina_conversacio',
          resposta: `De res, ${nomTractament}! Per a això estic aquí. Quan vulguis continuem amb qualsevol dubte o nou tema!`
        });
      }
      return res.json({
        success: true,
        font: 'agent_medina_conversacio',
        resposta: `I tant, ${nomTractament}! Per a qualsevol dubte d'estudi o de temari de ${cosTxt}, pregunta'm el que necessitis i ho analitzem plegats.`
      });
    }

    if (trobatsGuia.length > 0) {
      const top = trobatsGuia[0];
      const fragments = top.coincidencies.slice(0, 3).map(c => `> *${c.text}*`).join('\n\n');
      return res.json({
        success: true,
        font: 'guia_oficial_servidor',
        resposta: `📘 **Guia Oficial de la Policia de la Generalitat - Mossos d'Esquadra (Juny 2026)**
📌 **${top.codi}: ${top.titol} [Pàgines ${top.pagines}]**

🎯 **Idea Força & Concepte Clau:**
Informació extreta directament del temari oficial de Mossos d'Esquadra emmagatzemat a la plataforma.

⚖️ **Contingut Oficial de Referència:**
${fragments || (top.contingutText || '').slice(0, 800)}

⚠️ **Clau d'Examen:** Revisa els termes literals destacats per a les preguntes test!`
      });
    }

    const respostaEstructurada = generarRespostaEstructuradaAgentMedina(textNet, cos, 'general', docContextFinal ? { titol: titolDocFinal, contingutText: docContextFinal } : null);
    return res.json({
      success: true,
      font: 'agent_medina_local',
      resposta: respostaEstructurada
    });
  }

  // 5. Construcció del prompt per a Gemini amb màxima precisió de rol, memorització visual i memòria de xat
  try {
    const historialTxt = Array.isArray(historial) && historial.length > 0
      ? historial.slice(-8).map(h => `${h.role === 'user' ? 'Opositor' : 'Tutor Agent Medina'}: ${h.text}`).join('\n\n')
      : '';

    let contextInstruccions = '';

    if (volInternet) {
      contextInstruccions += `\nAUTORITZACIÓ DE CERCA A INTERNET I LEGISLACIÓ GENERAL:
L'aspirant ha demanat expressament consultar a Internet i legislació general vigent. Complementa la resposta amb la màxima actualització normativa i marca clarament a l'inici:
🌐 **Informació complementària d'Internet i Marc Jurídic General**\n`;
    }

    if (docContextFinal) {
      contextInstruccions += `\nDOCUMENT / ORDENANÇA MUNICIPAL SELECCIONADA COM A BASE PRINCIPAL:
Títol: ${titolDocFinal || 'Ordenança Municipal'} ${municipiDocFinal ? `(Municipi: ${municipiDocFinal})` : ''}
---
${docContextFinal.slice(0, 45000)}
---
REGLA D'OR:
La base de la teva resposta ha de ser aquest document. Cita literalment l'article concret, les infraccions (lleus, greus, molt greus) i els imports exactes de les sancions previstos en aquesta ordenança.\n`;
    }

    if (contextGuia) {
      contextInstruccions += `\n${contextGuia}\n`;
    }

    const directriusCos = cos === 'mossos' ? `
🎯 ENFOCAMENT EXCLUSIU DE COS: MOSSOS D'ESQUADRA (PG-ME)
Totes les teves respostes han d'estar estricta i prioritàriament PENSADES PER A MOSSOS D'ESQUADRA:
• Marc competencial: Generalitat de Catalunya i Departament d'Interior.
• Aplicació de la Llei 10/1994 de la PG-ME i Decret d'estructura (Prefectura de Policia, Comissaries Generals, Àrees Bàsiques Policials ABP, ARRO, etc.).
• En trànsit: competència del Servei Català de Trànsit (SCT) en vies interurbanes.
• Procediments policials: actuació de la dotació de Mossos, atestats i instrucció de diligències penals i de seguretat ciutadana (LO 4/2015).
• Model d'examen oficial de la Generalitat de Catalunya per a Mossos d'Esquadra (criteris de correcció oficials).
` : cos === 'pl' ? `
🎯 ENFOCAMENT EXCLUSIU DE COS: POLICIA LOCAL
Totes les teves respostes han d'estar estricta i prioritàriament PENSADES PER A POLICIA LOCAL:
• Marc competencial municipal: Ajuntament i Alcaldia (Llei 7/1985 LRBRL, DL 2/2003 TRMRLC). L'òrgan sancionador principal és l'Alcalde/Alcaldessa.
• Aplicació de la Llei 16/1991 de les Policies Locals de Catalunya.
• Àmbits clau d'oposició: Policia administrativa, disciplina urbanística, ordenances municipals de convivència i civisme, venda no sedentària, terrasses, trànsit i atestats en vies urbanes.
• Model d'examen d'oposició de Policia Local dels Ajuntaments catalans.
` : `
🎯 ENFOCAMENT COMPARTIT: MOSSOS D'ESQUADRA I POLICIA LOCAL
Distingeix clarament les competències exclusives i compartides entre ambdós cossos d'acord amb la Llei 4/2003 de Seguretat Pública de Catalunya.
`;

    const prompt = `Ets el Tutor d'Intel·ligència Artificial personal de referència de l'acadèmia policial "Agent Medina" a Catalunya.
Estàs acompanyant a l'aspirant ${nomTractament} en la seva preparació integral per aprovar l'oposició.
${directriusCos}

OBJECTIU PEDAGÒGIC I COMUNICATIU:
L'aspirant vol un acompanyament real, proper, motivador i eficaç per assolir tots els conceptes i memoritzar-los de manera fàcil i molt visual per anar a l'examen amb garanties d'èxit.
Escriu en català correcte, natural i proper com Agent Medina.

${esConversacional ? `🎯 MODALITAT CONVERSACIONAL I COACHING PERSONALITZAT (MÀXIMA BREVETAT):
L'aspirant (${nomTractament}) s'adreça a tu de forma conversacional, cordial o d'acompanyament (ex: "com estàs?", "hola", "què tal?", "gràcies", demanant un consell ràpid):
- REGLA D'OR: MÀXIMA BREVETAT. Respon en 2 o 3 frases curtes com a màxim (MÀXIM 35-45 PARAULES EN TOTAL).
- Sigues proper, motivador, empàtic i enèrgic com a company/mentor, però NO facis discursos llargs ni paràgrafs densos.
- Saluda pel nom, respon com et trobes i pregunta-li com està o proposa-li fer un test o repàs ràpid.
- NO utilitzis la plantilla dels 5 blocs per a xerrades cordials.` : `🎯 ESTRUCTURA VISUAL PER A MEMORITZAR FÀCILMENT (SINTÈTICA I DIRECTA AL GRA):
IMPORTANT: Sigues molt sintètic, visual i concís. Prohibit fer paràgrafs llargs o redundants. L'aspirant vol memoritzar en segons:

1. 🎯 **Idea Força & Concepte Clau**: 1 sola frase contundent i directa.
2. 🧠 **Regla Mnemotècnica / Truc d'Oposició**: 1 truc de memòria o acrònim breu (1-2 línies).
3. ⚖️ **Fonamentació Legal i Literalitat**: L'article clau exacte i el text essencial (sense textos feixucs).
4. ⚠️ **Trampa Típica de Tribunal**: 1 advertència breu de test (1 línia).
5. 📊 **Esquema Visual o Taula de Repàs**: Una taula Markdown compacta (màxim 3 files) o 2-3 punts clau.`}

SI L'ASPIRANT DEMANA PREGUNTES DE TEST (ex: "Test 3 preguntes"):
Genera 3 preguntes tipus test breus d'alta qualitat d'examen amb 4 opcions (a, b, c, d), solució i justificació legal concisa.

${contextInstruccions}

${historialTxt ? `HISTORIAL DE LA CONVERSA RECENT (Mantingues la coherència i continuïtat):\n${historialTxt}\n` : ''}

CONSULTA ACTUAL DE L'ASPIRANT ${nomTractament.toUpperCase()}:
"${textNet}"

DIRECTRIU FINAL: Resposta curta, directa i sense palla.
Genera la resposta adequada:`;

    const extraCfg = esConversacional ? { maxOutputTokens: 200 } : { maxOutputTokens: 800 };
    const responseMime = esConversacional ? 'text/plain' : 'application/json';
    const { response, model } = await executarGeminiAmbFallback(ai, prompt, responseMime, undefined, extraCfg);
    let textResposta = response.text ? response.text.trim() : 'No s\'ha pogut generar una resposta.';

    // Normalització pedagògica si el model respon en JSON estructurat
    function normalitzarRespostaJSON(str) {
      if (!str) return '';
      let net = str.trim();
      if (net.startsWith('```json') && net.endsWith('```')) {
        net = net.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
      } else if (net.startsWith('```') && net.endsWith('```')) {
        net = net.replace(/^```\s*/, '').replace(/\s*```$/, '').trim();
      }
      if ((net.startsWith('{') && net.endsWith('}')) || (net.startsWith('[') && net.endsWith(']'))) {
        try {
          let parsed = JSON.parse(net);
          if (Array.isArray(parsed) && parsed.length > 0) {
            parsed = parsed[0];
          }

          const teBlocsPedagogics = !!(
            parsed.blocs || parsed.blocs_estudi || parsed.agent_medina_response ||
            parsed.idea_forca || parsed.idea_forca_concepte_clau || parsed.concepte_clau ||
            parsed.regla_mnemotecnica || parsed.fonamentacio_legal || parsed.trampa_tribunal ||
            (parsed.resposta && typeof parsed.resposta === 'object')
          );

          if (!teBlocsPedagogics) {
            if (typeof parsed.resposta === 'string' && parsed.resposta.trim()) {
              return parsed.resposta.trim();
            }
            if (typeof parsed.text === 'string' && parsed.text.trim()) {
              return parsed.text.trim();
            }
            if (typeof parsed.message === 'string' && parsed.message.trim()) {
              return parsed.message.trim();
            }
          }

          let obj = parsed;
          if (obj.agent_medina_response && typeof obj.agent_medina_response === 'object') {
            obj = obj.agent_medina_response;
          }
          if (obj.resposta && typeof obj.resposta === 'object') {
            obj = obj.resposta;
          }
          if (obj.blocs_estudi && typeof obj.blocs_estudi === 'object') {
            obj = { ...obj, ...obj.blocs_estudi };
          }
          if (obj.blocs && typeof obj.blocs === 'object') {
            obj = { ...obj, ...obj.blocs };
          }

          function extreureText(val) {
            if (!val) return '';
            if (typeof val === 'string') return val;
            if (Array.isArray(val)) {
              return val.map(item => typeof item === 'string' ? `• ${item}` : Object.entries(item).map(([k, v]) => `• **${k}**: ${v}`).join('\n')).join('\n');
            }
            if (typeof val === 'object') {
              if (val.taula) return val.taula;
              if (val.text && val.cita) return `${val.cita}\n\n${val.text}`;
              if (val.nom && val.explicacio) return `**${val.nom}**\n${val.explicacio}`;
              if (val.concepte && val.focalitzacio) return `${val.concepte}\n\n${val.focalitzacio}`;
              if (val.concepte) return val.concepte;
              if (val.advertencia) return val.advertencia;
              if (val.explicacio) return val.explicacio;
              if (val.text) return val.text;
              return Object.entries(val).map(([k, v]) => `• **${k.replace(/_/g, ' ')}:** ${typeof v === 'object' ? JSON.stringify(v) : v}`).join('\n');
            }
            return String(val);
          }

          const blocs = [];

          if (obj.introduccio && typeof obj.introduccio === 'string') {
            blocs.push(obj.introduccio);
          } else if (parsed.text && typeof parsed.text === 'string' && teBlocsPedagogics) {
            blocs.push(parsed.text.trim());
          }
          
          const idea = obj.idea_forca_concepte_clau || obj.idea_forca || obj.concepte_clau;
          if (idea) {
            blocs.push(`🎯 **Idea Força & Concepte Clau:**\n${extreureText(idea)}`);
          }
          
          const mnemonic = obj.regla_mnemonic_truc_oposicio || obj.regla_mnemotecnica_truc_oposicio || obj.regla_mnemotecnica || obj.mnemotecnica;
          if (mnemonic) {
            blocs.push(`🧠 **Regla Mnemotècnica / Truc d'Oposició:**\n${extreureText(mnemonic)}`);
          }
          
          const f = obj.fonamentacio_legal_i_literalitat || obj.fonamentacio_legal || obj.base_legal;
          if (f) {
            blocs.push(`⚖️ **Fonamentació Legal i Literalitat:**\n${extreureText(f)}`);
          }
          
          const trampa = obj.trampa_tipica_de_tribunal || obj.trampa_de_tribunal || obj.clau_de_test_pel_tribunal || obj.trampa_tribunal || obj.trampa;
          if (trampa) {
            blocs.push(`⚠️ **Trampa Típica de Tribunal:**\n${extreureText(trampa)}`);
          }
          
          const esq = obj.esquema_visual_repas || obj.esquema_visual_o_taula_de_repas || obj.esquema_visual_o_taula_de_repàs || obj.esquema_visual || obj.taula;
          if (esq) {
            blocs.push(`📊 **Esquema Visual o Taula de Repàs:**\n${extreureText(esq)}`);
          }
          if (blocs.length > 0) return blocs.join('\n\n');
        } catch (_) {}
      }
      return str;
    }

    textResposta = normalitzarRespostaJSON(textResposta);

    return res.json({
      success: true,
      font: `gemini (${model})`,
      resposta: textResposta
    });
  } catch (error) {
    console.error('Error a /api/gemini/tutor-xat:', error?.message);

    // Si Gemini falla temporalment, retornem resposta estructurada de qualitat de la base de dades local
    if (trobatsGuia.length > 0) {
      const top = trobatsGuia[0];
      const fragments = top.coincidencies.slice(0, 3).map(c => `> *${c.text}*`).join('\n\n');
      return res.json({
        success: true,
        font: 'guia_oficial_servidor',
        resposta: `📘 **Guia Oficial de la Policia de la Generalitat - Mossos d'Esquadra (Juny 2026)**
📌 **${top.codi}: ${top.titol} [Pàgines ${top.pagines}]**

🎯 **Idea Força & Concepte Clau:**
Informació obtinguda directament de la Guia Oficial d'Estudi emmagatzemada a la plataforma.

⚖️ **Articulat i Contingut Oficial:**
${fragments || (top.contingutText || '').slice(0, 900)}

💡 **Consell d'Examen:** Revisa les paraules clau i terminis destacats per a les preguntes de test!`
      });
    }

    const respostaLocal = generarRespostaEstructuradaAgentMedina(textNet, cos, 'general', docContextFinal ? { titol: titolDocFinal, contingutText: docContextFinal } : null);
    return res.json({
      success: true,
      font: 'agent_medina_estructurat',
      resposta: respostaLocal
    });
  }
});

// ==========================================
// GENERADOR DE PREGUNTES DES DE DOCUMENTS / ORDENANCES
// ==========================================
app.post('/api/gemini/generar-preguntes-document', async (req, res) => {
  const { textDocument, titolDocument, municipi, quantitat, enfocament, temaDesti, bancDesti } = req.body || {};
  if (!textDocument || !textDocument.trim()) {
    return res.status(400).json({ success: false, error: 'Falta el text del document' });
  }

  const ai = getGeminiClient();
  const numPreguntes = Math.min(Math.max(parseInt(quantitat, 10) || 5, 1), 20);
  const titol = titolDocument || 'Ordenança Municipal';
  const mun = municipi || 'General';
  const banc = bancDesti || 'pl';

  if (!ai) {
    return res.status(400).json({
      success: false,
      error: 'Cal configurar GEMINI_API_KEY per utilitzar la generació automàtica de preguntes amb IA.'
    });
  }

  try {
    const prompt = `Ets un tribunal examinador oficial d'oposicions de Policia Local i Mossos d'Esquadra a Catalunya de l'Agent Medina.
A partir del següent text d'una ordenança municipal o temari policial:

TÍTOL DEL DOCUMENT: ${titol}
MUNICIPI / ÀMBIT: ${mun}
ENFOCAMENT REQUERIT: ${enfocament || 'Variat: infraccions, terminis, sancions i competències dels òrgans'}
QUANTITAT DE PREGUNTES A GENERAR: ${numPreguntes}

TEXT DEL DOCUMENT (extracte o contingut):
---
${textDocument.slice(0, 40000)}
---

INSTRUCCIONS DE GENERACIÓ PER A LES PREGUNTES:
1. Genera exactament ${numPreguntes} preguntes tipus test basades ESTRICTAMENT en el text anterior.
2. Cada pregunta ha de tenir 4 opcions (A, B, C, D) versemblants i rigoroses. Les opcions incorrectes han de ser distractors típics d'oposició (canvis en terminis, xifres de multes econòmiques, confusions entre òrgans com Alcalde vs Ple, qualificació d'infracció lleu/greu/molt greu).
3. "resposta" ha de ser l'índex numèric de l'opció correcta (0 per A, 1 per B, 2 per C, 3 per D). Distribueix les respostes correctes de manera equilibrada entre les 4 lletres (no posis sempre la 0).
4. "explicacio" ha de citar l'article i paràgraf exacte del document que justifica la resposta i explicar breument per què és la correcta.
5. "tema" serà: "${temaDesti || `Ordenança: ${titol}`}".
6. "seccio" serà: "${titol}".
7. "municipi" serà: "${mun}".
8. "banc" serà: "${banc}".

Respon ÚNICAMENT amb un array JSON vàlid amb aquest format:
[
  {
    "pregunta": "Segons l'ordenança de convivència, quina és la sanció màxima per una infracció molt greu?",
    "opcions": [
      "Fins a 750 euros",
      "De 751 a 1.500 euros",
      "De 1.501 a 3.000 euros",
      "Fins a 6.000 euros"
    ],
    "resposta": 2,
    "explicacio": "L'article 45.3 de l'ordenança estableix que les infraccions molt greus se sancionaran amb multa de 1.501 a 3.000 euros.",
    "tema": "${temaDesti || `Ordenança: ${titol}`}",
    "seccio": "${titol}",
    "municipi": "${mun}"
  }
]`;

    const { response, model } = await executarGeminiAmbFallback(ai, prompt, 'application/json');
    let preguntes = [];
    try {
      let text = (response.text || '').trim();
      text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
      preguntes = JSON.parse(text);
      if (!Array.isArray(preguntes)) preguntes = [preguntes];
    } catch (parseErr) {
      console.error('Error parsejant JSON de preguntes generades:', parseErr);
      return res.status(500).json({ success: false, error: 'La resposta de la IA no tenia el format JSON esperat.' });
    }

    // Normalització i assignació d'IDs
    const timestamp = Date.now();
    preguntes = preguntes.map((q, idx) => {
      return {
        id: `${banc === 'pl' ? 'PL_GEN_' : 'MOSSOS_GEN_'}${timestamp}_${idx + 1}`,
        pregunta: (q.pregunta || '').trim(),
        opcions: Array.isArray(q.opcions) ? q.opcions.map(o => String(o).trim()) : [],
        resposta: typeof q.resposta === 'number' && q.resposta >= 0 && q.resposta < (q.opcions || []).length ? q.resposta : 0,
        explicacio: (q.explicacio || `Segons ${titol}`).trim(),
        tema: q.tema || `Ordenança: ${titol}`,
        seccio: q.seccio || titol,
        municipi: q.municipi || mun,
        banc: banc
      };
    }).filter(q => q.pregunta && q.opcions.length === 4);

    return res.json({
      success: true,
      font: `gemini (${model})`,
      total: preguntes.length,
      preguntes
    });
  } catch (error) {
    console.error('Error a /api/gemini/generar-preguntes-document, usant generació assistida de suport:', error?.message);
    
    // Fallback de suport: generació basada en fragments del document
    const fragments = textDocument.split(/(?:\.\s+|\n\n+)/).map(s => s.trim()).filter(s => s.length > 40 && s.length < 220);
    const fallbackPreguntes = [];
    const numToGen = Math.min(numPreguntes, Math.max(fragments.length, 1));
    const now = Date.now();

    for (let i = 0; i < numToGen; i++) {
      const frag = fragments[i] || `Disposició general relativa a ${titol} del municipi de ${mun}.`;
      fallbackPreguntes.push({
        id: `${banc === 'pl' ? 'PL_GEN_' : 'MOSSOS_GEN_'}${now}_${i + 1}`,
        pregunta: `D'acord amb la normativa de "${titol}" (${mun}), quina de les següents afirmacions és correcta?`,
        opcions: [
          frag,
          `La competència correspon exclusivament a l'Administració General de l'Estat sense participació de ${mun}.`,
          `No s'aplica cap règim sancionador ni procediment administratiu en aquest supòsit.`,
          `Queda derogat expressament qualsevol control previ o llicència d'acord amb la normativa autonòmica.`
        ],
        resposta: 0,
        explicacio: `D'acord amb el text de ${titol}: "${frag}".`,
        tema: temaDesti || `Ordenança: ${titol}`,
        seccio: titol,
        municipi: mun,
        banc: banc
      });
    }

    if (fallbackPreguntes.length > 0) {
      return res.json({
        success: true,
        font: 'local_fallback',
        total: fallbackPreguntes.length,
        preguntes: fallbackPreguntes,
        avis: 'Generat mitjançant el motor d\'anàlisi de text assistit.'
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Error generant preguntes: ' + (error?.message || 'Error del model')
    });
  }
});

// ==========================================
// PARSER HEURÍSTIC D'EXÀMENS OFICIALS (FALLBACK ROBUST PER PDF / TEXT)
// ==========================================
function parsejarPlantillaSolucions(plantillaText) {
  const map = {};
  if (!plantillaText || typeof plantillaText !== 'string') return map;
  const regex = /(?:pregunta\s*|p\s*|q\s*)?(\d+)[\s.:\-_–>)\]=]+([a-dA-D])/gi;
  let m;
  while ((m = regex.exec(plantillaText)) !== null) {
    const num = parseInt(m[1], 10);
    const lletra = m[2].toUpperCase();
    const idx = lletra.charCodeAt(0) - 65; // A->0, B->1, C->2, D->3
    if (idx >= 0 && idx < 4) map[num] = idx;
  }
  return map;
}

function classificarTemaHeuristic(text, cos = 'pl') {
  const t = text.toLowerCase();
  if (cos === 'mossos') {
    if (t.includes('constitució') || t.includes('estatut') || t.includes('parlament') || t.includes('procediment administratiu') || t.includes('llei 39/2015') || t.includes('dret penal') || t.includes('delicte')) {
      return { tema: "Àmbit B: Institucional i Marc Legal", motiu: "Normativa institucional, dret penal o procediment administratiu." };
    }
    if (t.includes('llei 10/1994') || t.includes('mossos') || t.includes('seguretat ciutadana') || t.includes('trànsit') || t.includes('seguretat pública') || t.includes('detenció') || t.includes('520 lecrim')) {
      return { tema: "Àmbit C: Seguretat i Policia", motiu: "Legislació policial, trànsit i seguretat ciutadana." };
    }
    return { tema: "Àmbit A: Coneixements de l'entorn", motiu: "Història, geografia o institucions de Catalunya." };
  } else {
    // Policia Local
    if (t.includes('constitució') || t.includes('tribunal constitucional')) return { tema: "Tema 1: La Constitució espanyola de 1978: estructura i principis. Tribunal Constitucional.", motiu: "Dret constitucional" };
    if (t.includes('drets fonamentals') || t.includes('defensor del poble')) return { tema: "Tema 2: Drets i deures fonamentals. Garanties i suspensió. El Defensor del Poble.", motiu: "Drets fonamentals" };
    if (t.includes('estatut') || t.includes('generalitat')) return { tema: "Tema 3: Organització territorial. L'Estatut d'Autonomia de Catalunya i la Generalitat.", motiu: "Estatut i organització de Catalunya" };
    if (t.includes('municipi') && (t.includes('competències') || t.includes('organització'))) return { tema: "Tema 4: El municipi i la seva regulació jurídica. Organització i competències.", motiu: "Règim municipal" };
    if (t.includes('ordenança') || t.includes('bans')) return { tema: "Tema 7: Les ordenances i els bans municipals.", motiu: "Normativa municipal" };
    if (t.includes('39/2015') || t.includes('acte administratiu') || t.includes('procediment administratiu')) return { tema: "Tema 10: El procediment administratiu: principis i fases (Llei 39/2015).", motiu: "Procediment administratiu" };
    if (t.includes('16/1991') || t.includes('policies locals de catalunya')) return { tema: "Tema 17: Llei 16/1991, de 10 de juliol, de les Policies Locals de Catalunya: funcions i coordinació.", motiu: "Llei de Policies Locals" };
    if (t.includes('4/2015') || t.includes('seguretat ciutadana')) return { tema: "Tema 18: Llei Orgànica 4/2015 de Seguretat Ciutadana (I): Disposicions generals i documentació/identificació.", motiu: "Seguretat ciutadana" };
    if (t.includes('2/1986') || t.includes('forces i cossos')) return { tema: "Tema 20: Llei Orgànica 2/1986 de Forces i Cossos de Seguretat: principis d'actuació i Policia Local.", motiu: "FCS" };
    if (t.includes('furt') || t.includes('robatori') || t.includes('estafa') || t.includes('danys')) return { tema: "Tema 22: Codi Penal (II): Delictes contra el patrimoni (furt, robatori, estafa, danys, usurpació).", motiu: "Codi Penal patrimoni" };
    if (t.includes('alcoholèmia') || t.includes('379') || t.includes('seguretat viària') || t.includes('velocitat penal')) return { tema: "Tema 23: Codi Penal (III): Delictes contra la seguretat viària (arts. 379 a 385 ter).", motiu: "Codi Penal seguretat viària" };
    if (t.includes('atemptat') || t.includes('desobediència') || t.includes('resistència')) return { tema: "Tema 24: Codi Penal (IV): Ordre públic: atemptat, resistència, desobediència i desordres públics.", motiu: "Ordre públic" };
    if (t.includes('trànsit') || t.includes('ltsv') || t.includes('circulació')) return { tema: "Tema 35: Llei sobre Trànsit, Circulació de Vehicles a Motor i Seguretat Viària (LTSV): Infraccions i sancions.", motiu: "Normativa de trànsit" };
    if (t.includes('detenció') || t.includes('520') || t.includes('habeas corpus')) return { tema: "Tema 39: La detenció i els drets de la persona detinguda (art. 520 LECrim i Habeas Corpus).", motiu: "Detenció i drets del detingut" };
    if (t.includes('violència de gènere') || t.includes('ordre de protecció')) return { tema: "Tema 40: Violència de gènere i domèstica: Marc legal, protecció a la víctima i atenció policial.", motiu: "Violència de gènere" };
    return { tema: "Tema 10: El procediment administratiu: principis i fases (Llei 39/2015).", motiu: "Temari general de Policia Local" };
  }
}

function extraurePreguntesHeuristiques(text, cos = 'pl', municipi = '', any = '', titol = '', plantillaText = '') {
  if (!text || typeof text !== 'string') return [];
  const solucionsMap = parsejarPlantillaSolucions(plantillaText);
  const preguntes = [];

  // Normalitzem salts de línia
  const clean = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Regex universal de segmentació per número de pregunta (ex: 1., 1.-, 1), Pregunta 1:, 1:, Q1., P1.)
  const questionPattern = /(?:^|\n)\s*(?:Pregunta\s*|Q\s*|P\s*|N[úu]m\.?\s*)?(\d+)(?:[\.\)\:\/\-]|[\.\-]{1,2})\s*([\s\S]*?)(?=(?:\n\s*(?:Pregunta\s*|Q\s*|P\s*|N[úu]m\.?\s*)?\d+(?:[\.\)\:\/\-]|[\.\-]{1,2})\s*)|$)/gi;

  let match;
  while ((match = questionPattern.exec(clean)) !== null) {
    const num = parseInt(match[1], 10);
    const cosPregunta = match[2].trim();

    // Reconeix opcions tant verticals com horitzontals: a), A), a., A., (a), (A), a.-, A.-, [a], [A]
    const optRegex = /(?:^|\n|\s{2,}|\t)\s*(?:\(?([a-dA-D])\)|\(?([a-dA-D])[\.\:\-\]\/]|([a-dA-D])\.-)\s+([\s\S]*?)(?=(?:(?:\n|\s{2,}|\t)\s*(?:\(?[a-dA-D]\)|\(?[a-dA-D][\.\:\-\]\/]|[a-dA-D]\.-)\s+)|$)/gi;

    const opcionsMatches = [];
    let optMatch;
    let primerIndex = -1;
    while ((optMatch = optRegex.exec(cosPregunta)) !== null) {
      if (primerIndex === -1) primerIndex = optMatch.index;
      const lletra = (optMatch[1] || optMatch[2] || optMatch[3]).toUpperCase();
      const txtOp = optMatch[4].trim().replace(/\s+/g, ' ');
      opcionsMatches.push({ lletra, text: txtOp });
    }

    if (opcionsMatches.length >= 2) {
      let enunciat = (primerIndex !== -1 ? cosPregunta.substring(0, primerIndex) : cosPregunta)
        .replace(/^\s*(?:Pregunta\s*|Q\s*|P\s*|N[úu]m\.?\s*)?\d+(?:[\.\)\:\/\-]|[\.\-]{1,2})\s*/i, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (enunciat.length >= 6) {
        const opcions = opcionsMatches.map(m => m.text).slice(0, 4);
        while (opcions.length < 4) {
          opcions.push(`Opció ${String.fromCharCode(65 + opcions.length)} (no especificada)`);
        }

        // Determinar resposta correcta
        let respostaCorrecta = 0;
        if (solucionsMap[num] !== undefined) {
          respostaCorrecta = solucionsMap[num];
        } else {
          const mSol = cosPregunta.match(/(?:resposta|soluci[oó]|correcta|rc)[\s\:\-]+([a-dA-D])/i) ||
                        cosPregunta.match(/[\(\[]\s*([a-dA-D])\s*[\)\]]\s*[\*✓✔]/i);
          if (mSol) {
            respostaCorrecta = mSol[1].toUpperCase().charCodeAt(0) - 65;
          }
        }

        const classif = classificarTemaHeuristic(enunciat + ' ' + opcions.join(' '), cos);

        preguntes.push({
          id: `oficial_${Date.now()}_${num}`,
          num,
          pregunta: enunciat,
          opcions,
          respostaCorrecta: (respostaCorrecta >= 0 && respostaCorrecta < 4) ? respostaCorrecta : 0,
          esReserva: /reserva|suplent/i.test(enunciat) || /R\d+/i.test(enunciat),
          esAnulada: /anul[·l]ada|sense efecte/i.test(enunciat),
          temaClassificat: classif.tema,
          esMunicipalONoCoincideix: Boolean(municipi && (enunciat.toLowerCase().includes(municipi.toLowerCase()) || enunciat.toLowerCase().includes('ordenan') || enunciat.toLowerCase().includes('municipal'))),
          motiuClassificacio: classif.motiu,
          explicacio: `Extreta de l'examen oficial${municipi ? ' de ' + municipi : ''}${any ? ' (' + any + ')' : ''}.`,
          esExamenOficial: true,
          examenOrigen: titol || `Examen Oficial ${municipi || ''} ${any || ''}`.trim(),
          municipi: municipi || '',
          any: any || '',
          cos: cos || 'pl'
        });
      }
    }
  }

  // Si el format per número no ha trobat preguntes suficients, fallback per segments
  if (preguntes.length === 0) {
    const segments = clean.split(/(?=(?:^|\n)\s*(?:Pregunta\s*)?\d+[\.\)\-:\/]\s+)/i);
    for (const seg of segments) {
      const mNum = seg.match(/(?:^|\n)\s*(?:Pregunta\s*)?(\d+)[\.\)\-:\/]\s+([\s\S]+)/i);
      if (!mNum) continue;
      const num = parseInt(mNum[1], 10);
      const cosPregunta = mNum[2].trim();
      const opcionsMatches = [...cosPregunta.matchAll(/(?:^|\n)\s*([a-dA-D])[\.\)\-\]\:]\s*([^\n]+(?:\n(?!\s*[a-dA-D][\.\)\-\]\:]|\s*(?:Pregunta\s*)?\d+[\.\)\-]|(?:\n\s*Soluci[oó]|\n\s*Resp))[^\n]+)*)/gi)];
      if (opcionsMatches.length >= 2) {
        const primerIndex = opcionsMatches[0].index;
        let enunciat = cosPregunta.substring(0, primerIndex).replace(/^\s*(?:Pregunta\s*)?\d+[\.\)\-:\/]\s*/i, '').replace(/\s+/g, ' ').trim();
        if (enunciat.length >= 6) {
          const opcions = opcionsMatches.map(m => m[2].trim().replace(/\s+/g, ' ')).slice(0, 4);
          while (opcions.length < 4) {
            opcions.push(`Opció ${String.fromCharCode(65 + opcions.length)} (no especificada)`);
          }
          const classif = classificarTemaHeuristic(enunciat + ' ' + opcions.join(' '), cos);
          preguntes.push({
            id: `oficial_${Date.now()}_${num}`,
            num,
            pregunta: enunciat,
            opcions,
            respostaCorrecta: solucionsMap[num] !== undefined ? solucionsMap[num] : 0,
            esReserva: /reserva|suplent/i.test(enunciat),
            esAnulada: /anul[·l]ada/i.test(enunciat),
            temaClassificat: classif.tema,
            esMunicipalONoCoincideix: Boolean(municipi && (enunciat.toLowerCase().includes(municipi.toLowerCase()) || enunciat.toLowerCase().includes('ordenan'))),
            motiuClassificacio: classif.motiu,
            explicacio: `Extreta de l'examen oficial${municipi ? ' de ' + municipi : ''}${any ? ' (' + any + ')' : ''}.`,
            esExamenOficial: true,
            examenOrigen: titol || `Examen Oficial ${municipi || ''} ${any || ''}`.trim(),
            municipi: municipi || '',
            any: any || '',
            cos: cos || 'pl'
          });
        }
      }
    }
  }

  return preguntes;
}

// ==========================================
// IMPORTACIÓ I CLASSIFICACIÓ D'EXÀMENS OFICIALS REALS (PDF / WORD)
// ==========================================
app.post('/api/gemini/analitzar-examen-oficial', async (req, res) => {
  const {
    textExamen,
    textDirecte,
    fitxerBase64,
    nomFitxer,
    plantillaSolucions,
    municipi,
    titol,
    any,
    cos
  } = req.body || {};

  let textComplet = (textDirecte || textExamen || '').trim();
  let pdfBase64Data = null;

  // Extracció de text des de fitxer PDF o Word (.docx)
  if (fitxerBase64) {
    try {
      const base64Net = fitxerBase64.replace(/^data:.*?;base64,/, '');
      const buffer = Buffer.from(base64Net, 'base64');
      const ext = (nomFitxer || '').toLowerCase();

      if (ext.endsWith('.pdf')) {
        pdfBase64Data = base64Net;
        const textExtret = await extractTextFromPdf(buffer);
        if (textExtret) {
          textComplet = (textComplet ? textComplet + '\n\n' : '') + textExtret;
        }
      } else if (ext.endsWith('.docx') || ext.endsWith('.doc')) {
        const mammothResult = await mammoth.extractRawText({ buffer });
        const docxText = (mammothResult.value || '').trim();
        if (docxText) {
          textComplet = (textComplet ? textComplet + '\n\n' : '') + docxText;
        }
      } else {
        // Text pla o desconegut
        const rawText = buffer.toString('utf8').trim();
        if (rawText) {
          textComplet = (textComplet ? textComplet + '\n\n' : '') + rawText;
        }
      }
    } catch (e) {
      console.error('Error processant fitxer adjunt:', e);
      const ext = (nomFitxer || '').toLowerCase();
      if (!ext.endsWith('.pdf')) {
        return res.status(400).json({
          success: false,
          error: 'No s\'ha pogut processar el document. Assegura\'t que és un PDF o Word (.docx) vàlid: ' + (e.message || e)
        });
      }
    }
  }

  // Si no tenim text extret suficient i tampoc és un PDF amb contingut base64
  if ((!textComplet || textComplet.length < 25) && !pdfBase64Data) {
    return res.status(400).json({
      success: false,
      error: 'El document adjunt no conté text llegible o està buit. Si és un PDF escanejat com a imatge, assegura\'t que no estigui malmès.'
    });
  }

  const ai = getGeminiClient();
  if (!ai) {
    return res.status(500).json({
      success: false,
      error: 'La clau GEMINI_API_KEY no està configurada al servidor.'
    });
  }

  const cosNom = cos === 'mossos' ? "Mossos d'Esquadra" : "Policia Local";

  const textCompletNet = (textComplet || '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

  const prompt = `Ets el màxim expert preparador i jurista d'oposicions de ${cosNom} a Catalunya (tribunal examinador oficial).
T'adjuntem un EXAMEN OFICIAL REAL d'oposicions${municipi ? ` del municipi de ${municipi}` : ''}${any ? ` de l'any ${any}` : ''}.

El teu objectiu és extreure totes les preguntes d'opció múltiple de l'examen, resoldre-les amb justificació jurídica vigent citant article i llei, i classificar-les respecte al temari oficial.

${textCompletNet ? `TEXT DE L'EXAMEN RECOLLIT:
"""
${textCompletNet.slice(0, 26000)}
"""` : `L'examen es troba al document PDF adjunt. Llegeix acuradament totes les preguntes, enunciats i opcions de resposta (A, B, C, D).`}

${plantillaSolucions && plantillaSolucions.trim() ? `
PLANTILLA DE RESPOSTES CORRECTES / SOLUCIONS OFICIALS DEL TRIBUNAL:
"""
${plantillaSolucions.trim()}
"""
` : 'ATENCIÓ: Si el document inclou al final la plantilla de solucions o les respostes correctes marcades pel tribunal, utilitza-les rigorosament. Si no en té o alguna no ve indicada, determina tu la resposta correcta jurídica oficial d\'acord amb la normativa vigent.'}

TEMARI OFICIAL DE REFERÈNCIA:
${cos === 'mossos' ? `
Àmbit A: Coneixements de l'entorn (Geografia, Història, Societat i Institucions de Catalunya)
Àmbit B: Institucional i Marc Legal (Constitució Espanyola 1978, Estatut d'Autonomia de Catalunya 2006, Institucions de l'Estat i UE, Procediment Administratiu 39/2015, Dret Penal i Processal Penal, LECrim, Detenció)
Àmbit C: Seguretat i Policia (Llei 10/1994 de Mossos d'Esquadra, Llei 4/2003 de Seguretat Pública de Catalunya, Codi d'Ètica de la Policia de Catalunya, Llei 4/2015 de Seguretat Ciutadana, Trànsit i Seguretat Viària)
` : `
Tema 1: La Constitució espanyola de 1978: estructura i principis. Tribunal Constitucional.
Tema 2: Drets i deures fonamentals. Garanties i suspensió. El Defensor del Poble.
Tema 3: Organització territorial. L'Estatut d'Autonomia de Catalunya i la Generalitat.
Tema 4: El municipi i la seva regulació jurídica. Organització i competències.
Tema 5: L'Administració pública: principis d'actuació (eficàcia, jerarquia, coordinació).
Tema 6: Fonts del Dret Públic: La llei i el Reglament.
Tema 7: Les ordenances i els bans municipals.
Tema 8: L'acte administratiu: concepte, classes i motivació.
Tema 9: Els ciutadans davant l'Administració: drets i col·laboració.
Tema 10: El procediment administratiu: principis i fases (Llei 39/2015).
Tema 11: Els recursos administratius: alçada, reposició i revisió.
Tema 12: El pressupost municipal: concepte i regulació.
Tema 13: Règim d'incompatibilitats del personal al servei de les administracions públiques.
Tema 14: Règim disciplinari dels funcionaris dels cossos de Policia Local.
Tema 15: Transparència, accés a la informació pública i bon govern.
Tema 16: El dret a la protecció de dades (RGPD i LOPDGDD).
Tema 17: Llei 16/1991, de 10 de juliol, de les Policies Locals de Catalunya: funcions i coordinació.
Tema 18: Llei Orgànica 4/2015 de Seguretat Ciutadana (I): Disposicions generals i documentació/identificació.
Tema 19: Llei Orgànica 4/2015 de Seguretat Ciutadana (II): Actuacions per al manteniment de la seguretat ciutadana.
Tema 20: Llei Orgànica 2/1986 de Forces i Cossos de Seguretat: principis d'actuació i Policia Local.
Tema 21: Codi Penal (I): Homicidi, lesions, llibertat, llibertat sexual, intimitat, inviolabilitat domicili.
Tema 22: Codi Penal (II): Delictes contra el patrimoni (furt, robatori, estafa, danys, usurpació).
Tema 23: Codi Penal (III): Delictes contra la seguretat viària (arts. 379 a 385 ter).
Tema 24: Codi Penal (IV): Ordre públic: atemptat, resistència, desobediència i desordres públics.
Tema 25: Codi Penal (V): Delictes contra l'Administració pública: prevaricació, suborn, malversació.
Tema 26: Llei 39/2015 del Procediment Administratiu Comú.
Tema 27: Llei 4/2003 de Seguretat Pública de Catalunya (I): Disposicions generals i estructura.
Tema 28: Llei 4/2003 de Seguretat Pública de Catalunya (II): Juntes Locals de Seguretat i coordinació.
Tema 29: Llei 7/1985 Reguladora de les Bases del Règim Local (LRBRL): El municipi.
Tema 30: Decret 179/2015 del Reglament del procediment del règim disciplinari de Policia Local.
Tema 31: El Codi d'Ètica de la Policia de Catalunya: principis, ús de la força, detenció.
Tema 32: Reglament General de Circulació (RGC): Normes generals de comportament en la circulació.
Tema 33: Reglament General de Conductors: Permisos i llicències de conducció.
Tema 34: Reglament General de Vehicles.
Tema 35: Llei sobre Trànsit, Circulació de Vehicles a Motor i Seguretat Viària (LTSV): Infraccions i sancions.
Tema 36: Procediment sancionador en matèria de trànsit.
Tema 37: Investigació d'accidents de trànsit i atestats policials.
Tema 38: La policia judicial: LECrim, actuacions inicials i cadena de custòdia.
Tema 39: La detenció i els drets de la persona detinguda (art. 520 LECrim i Habeas Corpus).
Tema 40: Violència de gènere i domèstica: Marc legal, protecció a la víctima i atenció policial.
`}

INSTRUCCIONS DE CLASSIFICACIÓ I EXTRACCIÓ:
Per a CADA pregunta trobada a l'examen oficial:
1. 'num': El número oficial de la pregunta (1, 2, 3...).
2. 'pregunta': Enunciat complet, netejant talls o caràcters d'escaneig corruptes.
3. 'opcions': Exactament 4 opcions (A, B, C, D), netes de lletres 'a)', 'b)', 'A.', etc.
4. 'respostaCorrecta': Número enter 0, 1, 2 o 3 (0=A, 1=B, 2=C, 3=D).
5. 'esReserva': true si a l'examen indica 'pregunta de reserva', 'R1', 'reserva 1', etc., altrament false.
6. 'esAnulada': true si a la plantilla oficial o al text s'indica que el tribunal ha anul·lat aquesta pregunta, altrament false.
7. 'temaClassificat': Si la pregunta coincideix clarament amb algun dels temes oficials esmentats a dalt, posa el nom exactament (ex: "Tema 21: Codi Penal (I)" o "Àmbit B: Institucional"). Si és una pregunta local, d'ordenança municipal o no encaixa en cap tema general, posa null.
8. 'esMunicipalONoCoincideix': true si tracta d'història local, carrerer, patrimoni, ordenances d'un municipi en concret (${municipi || 'específic'}) o si no encaixa en el temari oficial general.
9. 'motiuClassificacio': Explicació breu (1 frase) de perquè pertany a aquest tema oficial o perquè és municipal.
10. 'explicacio': Justificació jurídica oficial per a l'estudi de l'opositor, CITANT SEMPRE L'ARTICLE I LA LLEI EXACTA (ex: "La resposta correcta és la B d'acord amb l'article 520.2 de la LECrim, que estableix...").

Respon EXCLUSIVAMENT amb un objecte JSON que contingui:
{
  "titol": "${titol || 'Examen Oficial ' + (municipi || '') + ' ' + (any || '')}",
  "municipi": "${municipi || ''}",
  "any": "${any || ''}",
  "cos": "${cos || 'pl'}",
  "preguntes": [
    {
      "num": 1,
      "pregunta": "...",
      "opcions": ["opció A", "opció B", "opció C", "opció D"],
      "respostaCorrecta": 1,
      "esReserva": false,
      "esAnulada": false,
      "temaClassificat": "Tema 21: Codi Penal (I)",
      "esMunicipalONoCoincideix": false,
      "motiuClassificacio": "Tracta sobre la definició de furt i robatori amb força.",
      "explicacio": "Correcta la B: Segons l'article 237 del Codi Penal, són reus de robatori els que..."
    }
  ]
}`;

  try {
    // Si tenim PDF base64 i poc text extret (o per reforçar l'OCR de pàgines complexes), enviem part multimodal
    let contents = prompt;
    if (pdfBase64Data && (!textComplet || textComplet.length < 500)) {
      contents = {
        parts: [
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: pdfBase64Data
            }
          },
          {
            text: prompt
          }
        ]
      };
    }

    const { response } = await executarGeminiAmbFallback(ai, contents, 'application/json');
    let textNetejat = (response?.text || '{}').trim();
    if (textNetejat.startsWith('```json')) textNetejat = textNetejat.slice(7);
    if (textNetejat.startsWith('```')) textNetejat = textNetejat.slice(3);
    if (textNetejat.endsWith('```')) textNetejat = textNetejat.slice(0, -3);

    const parsed = JSON.parse(textNetejat.trim());
    const preguntes = (parsed.preguntes || []).map((q, idx) => {
      const rawOpcions = Array.isArray(q.opcions) ? q.opcions.map(o => String(o).trim()) : [];
      while (rawOpcions.length < 4 && rawOpcions.length >= 2) {
        rawOpcions.push(`Opció ${String.fromCharCode(65 + rawOpcions.length)}`);
      }
      return {
        id: `oficial_${Date.now()}_${idx + 1}`,
        num: q.num || (idx + 1),
        pregunta: (q.pregunta || '').trim(),
        opcions: rawOpcions,
        respostaCorrecta: typeof q.respostaCorrecta === 'number' && q.respostaCorrecta >= 0 && q.respostaCorrecta < rawOpcions.length ? q.respostaCorrecta : 0,
        esReserva: Boolean(q.esReserva),
        esAnulada: Boolean(q.esAnulada),
        temaClassificat: q.temaClassificat || null,
        esMunicipalONoCoincideix: Boolean(q.esMunicipalONoCoincideix),
        motiuClassificacio: q.motiuClassificacio || '',
        explicacio: q.explicacio || '',
        esExamenOficial: true,
        examenOrigen: titol || `Examen Oficial ${municipi || ''} ${any || ''}`.trim(),
        municipi: municipi || '',
        any: any || '',
        cos: cos || 'pl'
      };
    }).filter(q => q.pregunta && q.opcions.length >= 2);

    const coincidents = preguntes.filter(q => !q.esMunicipalONoCoincideix && q.temaClassificat);
    const municipals = preguntes.filter(q => q.esMunicipalONoCoincideix || !q.temaClassificat);
    const anulades = preguntes.filter(q => q.esAnulada);
    const reserves = preguntes.filter(q => q.esReserva);

    const examenObj = {
      id: `examen_${Date.now()}`,
      titol: parsed.titol || titol || `Examen Oficial ${municipi || ''} ${any || ''}`.trim(),
      municipi: municipi || '',
      any: any || '',
      cos: cos || 'pl',
      total: preguntes.length,
      resum: {
        total: preguntes.length,
        coincidents: coincidents.length,
        municipals: municipals.length,
        anulades: anulades.length,
        reserves: reserves.length
      },
      preguntes
    };

    return res.json({
      success: true,
      examen: examenObj,
      ...examenObj
    });
  } catch (error) {
    console.error('Error a /api/gemini/analitzar-examen-oficial, provant extractor heurístic de suport:', error?.message);
    
    // Fallback robust: intentar extreure preguntes directament del text de l'examen
    const preguntesHeuristiques = extraurePreguntesHeuristiques(textComplet, cos, municipi, any, titol, plantillaSolucions);
    if (preguntesHeuristiques && preguntesHeuristiques.length > 0) {
      const coincidents = preguntesHeuristiques.filter(q => !q.esMunicipalONoCoincideix && q.temaClassificat);
      const municipals = preguntesHeuristiques.filter(q => q.esMunicipalONoCoincideix || !q.temaClassificat);
      const anulades = preguntesHeuristiques.filter(q => q.esAnulada);
      const reserves = preguntesHeuristiques.filter(q => q.esReserva);

      const examenObj = {
        id: `examen_${Date.now()}`,
        titol: titol || `Examen Oficial ${municipi || ''} ${any || ''}`.trim() || 'Examen Oficial Extret',
        municipi: municipi || '',
        any: any || '',
        cos: cos || 'pl',
        total: preguntesHeuristiques.length,
        resum: {
          total: preguntesHeuristiques.length,
          coincidents: coincidents.length,
          municipals: municipals.length,
          anulades: anulades.length,
          reserves: reserves.length
        },
        preguntes: preguntesHeuristiques,
        avis: 'Preguntes detectades automàticament des del text de l\'examen.'
      };

      return res.json({
        success: true,
        examen: examenObj,
        ...examenObj
      });
    }

    const es503 = error?.status === 503 || error?.message?.includes('503') || error?.message?.includes('high demand');
    const msgClar = es503
      ? 'Els servidors de IA estan experimentant una alta demanda momentània i no s\'han pogut extreure preguntes del PDF. Prova de copiar i enganxar el text de l\'examen directament a la pestanya "Enganxar text" o torna-ho a intentar en uns segons.'
      : 'No s\'han pogut extreure preguntes vàlides del document. Assegura\'t que contingui text seleccionable o enganxa el text directament a la casella de text.';

    return res.status(500).json({
      success: false,
      error: msgClar
    });
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


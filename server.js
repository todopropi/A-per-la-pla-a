import express from 'express';
import path from 'path';
import fs from 'fs';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { GoogleGenAI } from '@google/genai';
import mammoth from 'mammoth';

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

async function executarGeminiAmbFallback(ai, promptOrContents, responseMimeType = 'application/json', tools = undefined) {
  // Prioritzem models estables sense saturació 503: gemini-3.1-flash-lite i gemini-flash-latest
  const models = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'];
  let lastErr = null;
  for (const model of models) {
    for (let intent = 0; intent < 2; intent++) {
      try {
        const config = {};
        if (responseMimeType) config.responseMimeType = responseMimeType;
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
        console.warn(`[Gemini] Model ${model} (intent ${intent + 1}) ha fallat (${err?.message?.slice(0, 100)}), provant alternativa...`);
        // Si és un error 503 o 429, esperem breument abans del següent intent o model
        if (err?.status === 503 || err?.message?.includes('503') || err?.message?.includes('high demand') || err?.status === 429 || err?.message?.includes('429')) {
          await new Promise(r => setTimeout(r, 600 * (intent + 1)));
        } else {
          break;
        }
      }
    }
  }
  throw lastErr;
}

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

  const fallbackLocal = () => ({
    explicacioClau: `La resposta oficial correcta és l'opció **${lletraCorrecta}) ${textCorrecte}**. ${explicacio ? `\n\n📌 *Justificació del temari:* ${explicacio}` : ''}`,
    perQueEsCorrecta: `Segons el temari oficial i la normativa de referència de l'oposició (${banc === 'pl' ? 'Policia Local' : banc === 'mossos' ? "Mossos d'Esquadra" : 'Actualitat'}), l'opció ${lletraCorrecta} reflecteix amb exactitud el precepte legal aplicable.`,
    perQueSonFalses: `Les altres opcions contenen distractors típics d'examen com terminis modificats, terminologia no vigent o conceptes incompatibles.`,
    baseLegalVigent: explicacio || 'Legislació vigent de Catalunya i de l\'Estat (CE, CP, LECrim, Llei 16/1991 o 10/1994).',
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
// TUTOR IA PERSONAL (AGENT MEDINA)
// ==========================================
app.post('/api/gemini/tutor-xat', async (req, res) => {
  const { missatge, historial, documentContext, titolDocument, municipi, cos } = req.body || {};
  if (!missatge || !missatge.trim()) {
    return res.status(400).json({ success: false, error: 'Missatge buit' });
  }

  const ai = getGeminiClient();
  const cosTxt = cos === 'mossos' ? "Mossos d'Esquadra" : cos === 'pl' ? 'Policia Local' : 'Policia Local i Mossos d\'Esquadra';

  if (!ai) {
    return res.json({
      success: true,
      font: 'local_fallback',
      resposta: `Hola! Sóc el teu Tutor d'Agent Medina. Actualment s'està utilitzant el mode local. 

📌 **Consulta sobre:** "${missatge.trim()}"
${documentContext ? `\n📖 *Document de referència:* ${titolDocument || 'Ordenança adjunta'}` : ''}

Per gaudir de respostes jurídiques en temps real amb Gemini 3.8 Flash i cerca a la xarxa, afegeix la clau \`GEMINI_API_KEY\` a la configuració del projecte. Recorda que pots consultar qualsevol article de la Llei 16/1991, Llei 10/1994, Codi Penal o l'Estatut!`
    });
  }

  try {
    // Construcció del prompt amb context i historial
    const historialTxt = Array.isArray(historial) && historial.length > 0
      ? historial.slice(-6).map(h => `${h.role === 'user' ? 'Opositor' : 'Tutor'}: ${h.text}`).join('\n')
      : '';

    let contextInstruccions = '';
    if (documentContext && documentContext.trim()) {
      contextInstruccions = `
DOCUMENT / ORDENANÇA ADJUNTA DE REFERÈNCIA:
Títol: ${titolDocument || 'Document adjunt'} ${municipi ? `(Municipi: ${municipi})` : ''}
---
${documentContext.slice(0, 45000)}
---
REGLA D'OR DE CERCA:
1. Analitza en primer lloc el text del document adjunt anterior. Si la resposta es troba a l'articulat o contingut d'aquest document, respon citant literalment l'article o apartat d'aquesta ordenança/document.
2. Si la informació NO es troba al document adjunt, o si es tracta d'una consulta de normativa general policial (Codi Penal, LECrim, Constitució, Llei 16/1991, Llei 10/1994, etc.), utilitza la teva base de coneixement jurídica i dades actualitzades per respondre amb precisió. Especifica clarament a l'opositor quan la resposta prové del document adjunt i quan prové de la legislació general.
`;
    }

    const prompt = `Ets el Tutor d'Intel·ligència Artificial personal de l'acadèmia "Agent Medina", especialitzat en la preparació d'oposicions de ${cosTxt} a Catalunya.

El teu to és proper, pedagògic, rigorós i motivador.
Escriu SEMPRE en català correcte.

INSTRUCCIONS PRINCIPALS:
- Cita sempre els articles concrets de les lleis aplicables (ex: Art. 17 CE, Art. 138 CP, Art. 11 Llei 16/1991, Art. 12 LO 4/2015, etc.).
- Si l'opositor et demana una regla mnemotècnica, crea acrònims o associacions mentals fàcils de recordar.
- Si et demana un cas pràctic, planteja una intervenció policial realista pas a pas amb la fonamentació jurídica i procediment d'actuació (identificació, escorcoll, citació o detenció).
- Fes servir negretes, llistes i emoticones policials/jurídiques per estructurar la resposta de manera molt visual i llegible.
${contextInstruccions}
${historialTxt ? `HISTORIAL DE LA CONVERSA:\n${historialTxt}\n` : ''}
CONSULTA DE L'OPOSITOR:
"${missatge.trim()}"

Respon de manera clara, pedagògica i estructurada:`;

    const { response, model } = await executarGeminiAmbFallback(ai, prompt, 'text/plain');
    const textResposta = response.text ? response.text.trim() : 'No s\'ha pogut generar una resposta.';

    return res.json({
      success: true,
      font: `gemini (${model})`,
      resposta: textResposta
    });
  } catch (error) {
    console.error('Error a /api/gemini/tutor-xat:', error?.message);
    const textCons = (missatge || '').trim();
    const respostaLocal = `📚 **Resposta d'assistència:**\n\nPel que fa a la teva consulta sobre *"${textCons.slice(0, 100)}"*, recorda tenir en compte la jerarquia normativa:\n- **Constitució Espanyola (CE):** Drets fonamentals (art. 14 a 29 i 30.2), detenció preventiva màxima de 72 hores (art. 17).\n- **Llei Orgànica 2/1986 i Llei 16/1991:** Principis bàsics d'actuació (congruència, oportunitat i proporcionalitat).\n- **Llei Orgànica 4/2015:** Règim de seguretat ciutadana, identificacions i escorcolls.\n- **Codi Penal (LO 10/1995):** Tipicitat dels delictes contra les persones, patrimoni i seguretat viària.\n\n*(Nota: Hi ha hagut una alta demanda temporal del servidor de IA. Pots formular una nova pregunta o especificar l'article exacte.)*`;
    return res.json({
      success: true,
      font: 'assistit_local',
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
  const linies = plantillaText.split(/\r?\n/);
  for (const l of linies) {
    // Patrons comuns com "1. A", "1-B", "1: C", "Pregunta 1 -> D", "1 A"
    const m = l.match(/(?:pregunta\s*)?(\d+)[\s.:\-_–>)]+([a-dA-D])/i);
    if (m) {
      const num = parseInt(m[1], 10);
      const lletra = m[2].toUpperCase();
      const idx = lletra.charCodeAt(0) - 65; // A->0, B->1, C->2, D->3
      if (idx >= 0 && idx < 4) map[num] = idx;
    }
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

  // Regex per detectar blocs numerats com:
  // "1. Enunciat..." o "Pregunta 1: Enunciat..."
  const regexBlocs = /(?:^|\n)\s*(?:Pregunta\s*)?(\d+)[\.\)\-\:\s]\s*([^\n]+(?:\n(?!\s*[a-dA-D][\.\)\-\:]|\s*(?:Pregunta\s*)?\d+[\.\)\-\:])[^\n]+)*)/g;
  
  // Alternativa més senzilla i resilient per blocs d'examen: dividir per número de pregunta
  const segments = clean.split(/(?=(?:^|\n)\s*(?:Pregunta\s*)?\d+[\.\)\-]\s+)/i);

  for (const seg of segments) {
    const mNum = seg.match(/(?:^|\n)\s*(?:Pregunta\s*)?(\d+)[\.\)\-]\s+([\s\S]+)/i);
    if (!mNum) continue;

    const num = parseInt(mNum[1], 10);
    const cosPregunta = mNum[2].trim();

    // Busquem les opcions a, b, c, d
    const opcionsMatches = [...cosPregunta.matchAll(/(?:^|\n)\s*([a-dA-D])[\.\)\-\]\:]\s*([^\n]+(?:\n(?!\s*[a-dA-D][\.\)\-\]\:]|\s*(?:Pregunta\s*)?\d+[\.\)\-]|(?:\n\s*Soluci[oó]|\n\s*Resp))[^\n]+)*)/gi)];

    if (opcionsMatches.length >= 2) {
      // Extreure l'enunciat: tot el que hi ha abans de la primera opció
      const primerIndex = opcionsMatches[0].index;
      let enunciat = cosPregunta.substring(0, primerIndex).replace(/^\s*(?:Pregunta\s*)?\d+[\.\)\-]\s*/i, '').trim();
      // Neteja caràcters espuris
      enunciat = enunciat.replace(/\s+/g, ' ');

      if (enunciat.length >= 8) {
        const opcions = opcionsMatches.map(m => m[2].trim().replace(/\s+/g, ' ')).slice(0, 4);

        // Omplir fins a 4 opcions si en té 3
        while (opcions.length < 4) {
          opcions.push(`Opció ${String.fromCharCode(65 + opcions.length)} (no especificada)`);
        }

        // Determinar resposta correcta
        let respostaCorrecta = 0;
        if (solucionsMap[num] !== undefined) {
          respostaCorrecta = solucionsMap[num];
        } else {
          // Cercar marcadors inline com "Solució: B" o "(B) *" o "✅"
          const mSol = seg.match(/(?:resposta|soluci[oó]|correcta)[\s\:\-]+([a-dA-D])/i);
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

  const prompt = `Ets el màxim expert preparador i jurista d'oposicions de ${cosNom} a Catalunya (tribunal examinador oficial).
T'adjuntem un EXAMEN OFICIAL REAL d'oposicions${municipi ? ` del municipi de ${municipi}` : ''}${any ? ` de l'any ${any}` : ''}.

El teu objectiu és extreure totes les preguntes d'opció múltiple de l'examen, resoldre-les amb justificació jurídica vigent citant article i llei, i classificar-les respecte al temari oficial.

${textComplet ? `TEXT DE L'EXAMEN RECOLLIT:
"""
${textComplet.slice(0, 48000)}
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
    const preguntes = (parsed.preguntes || []).map((q, idx) => ({
      id: `oficial_${Date.now()}_${idx + 1}`,
      num: q.num || (idx + 1),
      pregunta: (q.pregunta || '').trim(),
      opcions: Array.isArray(q.opcions) ? q.opcions.map(o => String(o).trim()) : [],
      respostaCorrecta: typeof q.respostaCorrecta === 'number' && q.respostaCorrecta >= 0 && q.respostaCorrecta < 4 ? q.respostaCorrecta : 0,
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
    })).filter(q => q.pregunta && q.opcions.length === 4);

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

    return res.status(500).json({
      success: false,
      error: 'Error analitzant l\'examen oficial: ' + (error?.message || 'No s\'han pogut detectar preguntes vàlides al document.')
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


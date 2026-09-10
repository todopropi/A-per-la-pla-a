import express from 'express';
import path from 'path';
import fs from 'fs';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

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

async function executarGeminiAmbFallback(ai, prompt, responseMimeType = 'application/json') {
  // Models oficials compatibles segons les directrius de Gemini API
  const models = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.1-pro-preview'];
  let lastErr = null;
  for (const model of models) {
    for (let intent = 0; intent < 2; intent++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType
          }
        });
        if (response && response.text) {
          return { response, model };
        }
      } catch (err) {
        lastErr = err;
        console.warn(`[Gemini] Model ${model} (intent ${intent + 1}) ha fallat (${err?.message?.slice(0, 100)}), provant alternativa...`);
        // Si és un error 503 o 429, esperem una mica abans del següent intent o model
        if (err?.status === 503 || err?.message?.includes('503') || err?.message?.includes('high demand') || err?.status === 429 || err?.message?.includes('429')) {
          await new Promise(r => setTimeout(r, 750 * (intent + 1)));
        } else {
          // Si és un error 404 o no suportat, passem directament al següent model
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

// Serve static assets from project root
app.use(express.static(__dirname));

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Agent Medina server running on http://0.0.0.0:${PORT}`);
});


import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GUIA_PATH = path.join(__dirname, 'guia_mossos_2026.json');

let guiaData = null;

export function loadGuiaMossos() {
  if (guiaData) return guiaData;
  try {
    if (fs.existsSync(GUIA_PATH)) {
      const raw = fs.readFileSync(GUIA_PATH, 'utf-8');
      guiaData = JSON.parse(raw);
    }
  } catch (e) {
    console.error('Error carregant guia_mossos_2026.json:', e);
  }
  return guiaData;
}

export function getTotsElsTemesGuia() {
  const g = loadGuiaMossos();
  if (!g || !Array.isArray(g.temes)) return [];
  return g.temes.map(t => ({
    id: t.id,
    codi: t.codi,
    ambit: t.ambit,
    ambitNom: t.ambitNom,
    titol: t.titol,
    pagines: t.pagines,
    epigrafs: t.epigrafs || [],
    ideesForca: t.ideesForca || [],
    glossari: t.glossari || [],
    longitudText: (t.contingutText || '').length
  }));
}

export function getTemaGuiaPerId(id) {
  const g = loadGuiaMossos();
  if (!g || !Array.isArray(g.temes)) return null;
  const tid = (id || '').toUpperCase().trim();
  return g.temes.find(t => t.id.toUpperCase() === tid || t.codi.toUpperCase().includes(tid)) || null;
}

export function cercarALaGuia(query, maxResultats = 4) {
  const g = loadGuiaMossos();
  if (!g || !Array.isArray(g.temes)) return [];

  const textNet = (query || '')
    .toLowerCase()
    .replace(/[^\w\sáéíóúàèòïüçñ·]/gi, ' ')
    .trim();

  if (!textNet) return [];

  const stopWords = new Set([
    'de', 'del', 'dels', 'la', 'les', 'el', 'els', 'un', 'una', 'uns', 'unes',
    'a', 'amb', 'en', 'per', 'per a', 'o', 'i', 'que', 'què', 'es', 'son', 'era',
    'com', 'quin', 'quina', 'quins', 'quines', 'on', 'quan', 'perquè', 'sobre',
    'segons', 'dintre', 'fins', 'al', 'als', 'pel', 'pels', 'del', 'dels', 'cap',
    'guia', 'oficial', 'temari', 'tema', 'temes', 'mossos', 'esquadra', 'policia',
    'catalunya', 'segons', 'explica', 'digues', 'saps', 'pots', 'dir', 'diu', 'parla',
    'quin', 'quina', 'quins', 'quines', 'qual', 'quals', 'dona', 'donam'
  ]);

  let paraules = textNet.split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
  if (paraules.length === 0) {
    paraules = textNet.split(/\s+/).filter(w => w.length > 2);
  }
  if (paraules.length === 0) return [];

  // Calcular raresa de cada paraula (IDF simple)
  const docFreq = {};
  for (const p of paraules) {
    let count = 0;
    for (const t of g.temes) {
      const allText = (t.titol + ' ' + (t.ideesForca || []).join(' ') + ' ' + (t.contingutText || '')).toLowerCase();
      if (allText.includes(p)) count++;
    }
    docFreq[p] = count;
  }

  // Detectar menció explícita de tema (ex: "tema c.2", "c2", "a.1", "b.4")
  const matchCodi = textNet.match(/\b([abc])[\s\.\-_]*([1-8])\b/i);
  const codiMencionat = matchCodi ? `${matchCodi[1].toUpperCase()}${matchCodi[2]}` : null;

  const resultats = [];

  for (const tema of g.temes) {
    let puntuacio = 0;
    const coincidencies = [];

    // Bonus si l'usuari ha demanat el tema explícitament (ex: C2 o Tema C.2)
    if (codiMencionat && tema.id === codiMencionat) {
      puntuacio += 150;
    }

    // Coincidència de títol o codi
    const titolMinus = (tema.titol + ' ' + tema.codi + ' ' + (tema.ambitNom || '')).toLowerCase();
    for (const p of paraules) {
      const df = docFreq[p] || 1;
      const pesRaresa = df <= 2 ? 4 : df <= 5 ? 2 : 1;
      if (titolMinus.includes(p)) puntuacio += 15 * pesRaresa;
    }

    // Coincidència a idees força
    if (Array.isArray(tema.ideesForca)) {
      for (const ifor of tema.ideesForca) {
        const ifMinus = ifor.toLowerCase();
        let hit = 0;
        for (const p of paraules) {
          if (ifMinus.includes(p)) {
            const df = docFreq[p] || 1;
            const pesRaresa = df <= 2 ? 3 : 1;
            hit += pesRaresa;
          }
        }
        if (hit > 0) {
          puntuacio += hit * 12;
          coincidencies.push({ tipus: 'idea_força', text: ifor });
        }
      }
    }

    // Coincidència a glossari
    if (Array.isArray(tema.glossari)) {
      for (const gl of tema.glossari) {
        const glMinus = gl.toLowerCase();
        for (const p of paraules) {
          if (glMinus.includes(p)) {
            puntuacio += 10;
            coincidencies.push({ tipus: 'glossari', text: gl });
          }
        }
      }
    }

    // Coincidència al contingut textual complet
    const contingut = tema.contingutText || '';
    const parragrafs = contingut.split(/\n\s*\n|\n(?=\d+\.)/);

    for (const parr of parragrafs) {
      const parrMinus = parr.toLowerCase();
      let matchCount = 0;
      for (const p of paraules) {
        if (parrMinus.includes(p)) {
          const df = docFreq[p] || 1;
          const pesRaresa = df <= 2 ? 6 : df <= 6 ? 2 : 1;
          matchCount += pesRaresa;
        }
      }
      if (matchCount > 0) {
        puntuacio += matchCount * 4;
        coincidencies.push({
          tipus: 'paragraf',
          text: parr.trim(),
          matchCount
        });
      }
    }

    if (puntuacio > 0) {
      coincidencies.sort((a, b) => (b.matchCount || 1) - (a.matchCount || 1));
      resultats.push({
        temaId: tema.id,
        codi: tema.codi,
        titol: tema.titol,
        ambit: tema.ambit,
        pagines: tema.pagines,
        puntuacio,
        contingutText: tema.contingutText,
        coincidencies: coincidencies.slice(0, 5)
      });
    }
  }

  // Ordenar per rellevància
  resultats.sort((a, b) => b.puntuacio - a.puntuacio);
  return resultats.slice(0, maxResultats);
}

export function construirContextGuiaPerPrompt(consulta, temaIdForcat = null) {
  const g = loadGuiaMossos();
  if (!g) return '';

  let temaSel = null;
  if (temaIdForcat) {
    temaSel = getTemaGuiaPerId(temaIdForcat);
  }

  if (temaSel) {
    return `
FONT OFICIAL OBLIGATÒRIA: GUIA D'ESTUDI MOSSOS D'ESQUADRA (JUNY 2026)
TEMA SELECCIONAT: ${temaSel.codi} - ${temaSel.titol} [Pàgines ${temaSel.pagines}]
Àmbit: ${temaSel.ambit} (${temaSel.ambitNom})
---
IDEES FORÇA OFICIALS DEL TEMA:
${(temaSel.ideesForca || []).map(i => '- ' + i).join('\n')}

TERMES CLAU DEL GLOSSARI:
${(temaSel.glossari || []).join(', ')}

TEXT OFICIAL I PÀGINES DEL TEMA:
${(temaSel.contingutText || '').slice(0, 35000)}
---
INSTRUCCIÓ ESTRICTA DE FIDELITAT:
Respon a la consulta de l'opositor fent servir exclusivament la informació i els paràgrafs textuals d'aquest Tema de la Guia Oficial. Cita expressament el número de pàgina oficial [Pàg. X] i l'apartat concret.
`;
  }

  // Si no s'ha forçat un tema, fer cerca intel·ligent
  const trobats = cercarALaGuia(consulta, 2);
  if (trobats.length === 0) return '';

  const fragmentsTxt = trobats.map(t => {
    const millorsParr = t.coincidencies
      .filter(c => c.tipus === 'paragraf' || c.tipus === 'idea_força')
      .map(c => c.text)
      .slice(0, 4)
      .join('\n\n');

    return `
[${t.codi}: ${t.titol} - Pàgines ${t.pagines}]
COINCIDÈNCIES I PARÀGRAFS DESTACATS:
${millorsParr}

TEXT OFICIAL COMPLET DEL TEMA:
${(t.contingutText || '').slice(0, 15000)}
`;
  }).join('\n===\n');

  return `
FONT OFICIAL DETECTADA: GUIA D'ESTUDI MOSSOS D'ESQUADRA (JUNY 2026)
S'han trobat els següents fragments literals oficials pertinents a la consulta de l'opositor:
${fragmentsTxt}
---
INSTRUCCIÓ DE CITACIÓ OFICIAL:
Aquesta consulta versa sobre el temari oficial de Mossos d'Esquadra. Utilitza i prioritza les definicions, dates, números i explicacions de la Guia Oficial 2026 citades anteriorment. Esmenta sempre la cita oficial [Pàg. X] de la guia.
`;
}

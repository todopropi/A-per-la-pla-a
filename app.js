// --// ==========================================
// 1. LÒGICA DE FLASHCARDS
// ==========================================
// ==========================================
// 1. LÒGICA DE FLASHCARDS
// ==========================================
let flashcardsData = [];
let currentCardIndex = 0;
let showingAnswer = false;
let activeTestContainerId = 'test-container';
window.ultimTestPreguntes = window.ultimTestPreguntes || [];

// Torna sempre a la vista Inici, també des de funcions fora del controlador principal.
function tornarAInici(e) {
  if (e) e.preventDefault();
  activeTestContainerId = 'test-container';
  document.querySelectorAll('.view-content').forEach(view => {
    view.style.display = view.id === 'view-inici' ? 'block' : 'none';
  });
  document.querySelectorAll('[data-tab]').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('[data-tab="inici"]').forEach(btn => btn.classList.add('active'));
  document.body.className = 'sec-inici';
  if (typeof window.mostrarInici === 'function') {
    window.mostrarInici();
  }
  requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
}
window.tornarAInici = tornarAInici;

function obtenirContenidorTest() {
  const preferit = document.getElementById(activeTestContainerId);
  if (preferit && preferit.offsetParent !== null) return preferit;
  const visibles = Array.from(document.querySelectorAll('[id="test-container"], [id="repas-errors-container"]'));
  return visibles.find(el => el.offsetParent !== null) || preferit || visibles[0] || null;
}

function actualitzarFlashcardsDesErrors() {
  const errors = obtenirTotesLesPreguntesFallades()
    .sort((a, b) => (b.errorCount || 0) - (a.errorCount || 0))
    .slice(0, 10);

  flashcardsData = errors.length
    ? errors.map(q => ({
        pregunta: q.pregunta,
        resposta: q.opcions?.[q.resposta] || q.resposta || '',
        errors: q.errorCount || 0,
        seccio: q.seccio || q.ambit || q._font || ''
      }))
    : [
        { pregunta: "Quina és la composició quantitativa bàsica del Govern de la Generalitat de Catalunya segons l'Estatut?", resposta: "El President/a, els vicepresidents/es (si escau) i els consellers/es.", errors: 0 },
        { pregunta: "A quina llei orgànica s'estableixen les competències i forces de seguretat de l'Estat a Catalunya?", resposta: "Llei Orgànica 2/1986, de Forces i Cossos de Seguretat (LOFCS).", errors: 0 },
        { pregunta: "Segons el Codi Penal, quin principi regeix la irretroactivitat de les lleis penals?", resposta: "No seran aplicables a fets anteriors llevat que afavoreixin al reu (retroactivitat favorable).", errors: 0 },
        { pregunta: "Quin organisme coordina les policies locals a Catalunya?", resposta: "La Comissió de Coordinació de Policies Locals de Catalunya.", errors: 0 },
        { pregunta: "Quin termini màxim pot durar la detenció preventiva sense passar a disposició judicial?", resposta: "El temps estrictament necessari per a la realització de les diligències i, en tot cas, un màxim de 72 hores.", errors: 0 }
      ];

  currentCardIndex = 0;
}

function actualitzarFlashcard() {
  const cardText = document.getElementById('flashcard-text');
  const cardBadge = document.getElementById('flashcard-badge');
  const counter = document.getElementById('flashcard-counter');
  const meta = document.getElementById('flashcard-meta');
  if (!cardText || !flashcardsData.length) return;

  showingAnswer = false;
  const card = flashcardsData[currentCardIndex];
  cardBadge.textContent = card.errors
    ? `✍️ ${card.errors} errors · ${card.seccio || 'Pregunta'} (Clica per girar)`
    : `Flashcard clau d'examen #${currentCardIndex + 1} (Clica per girar)`;
  cardText.textContent = card.pregunta;
  cardText.style.color = "#333";
  if (meta) meta.textContent = card.errors ? "Ordenades de més fallada a menys fallada" : "Encara no hi ha errors acumulats";
  if (counter) counter.textContent = `${currentCardIndex + 1} / ${flashcardsData.length}`;
}

function girarFlashcard() {
  const cardText = document.getElementById('flashcard-text');
  const cardBadge = document.getElementById('flashcard-badge');
  if (!cardText || !flashcardsData.length) return;

  if (!showingAnswer) {
    cardBadge.textContent = "✅ Resposta correcta:";
    cardText.textContent = flashcardsData[currentCardIndex].resposta;
    cardText.style.color = "#007aff";
    showingAnswer = true;
  } else {
    actualitzarFlashcard();
  }
}

function canviarFlashcard(direccio) {
  if (!flashcardsData.length) return;
  currentCardIndex += direccio;
  if (currentCardIndex < 0) currentCardIndex = flashcardsData.length - 1;
  if (currentCardIndex >= flashcardsData.length) currentCardIndex = 0;
  actualitzarFlashcard();
}

// ==========================================
// 2. VARIABLES GLOBALS I UTILS
// ==========================================
let bancoPreguntes = [];
let bancoPoliciaLocal = [];
let bancoActualitat = [];

// Petita utilitat global (fora de qualsevol closure) per escapar text quan
// l'inserim com a HTML — la fem servir per mostrar l'ID de la pregunta de
// forma segura des de qualsevol part del fitxer.
function escapeHtmlGlobal(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Petita etiqueta amb l'ID de la pregunta, pensada per mostrar-se en petit
// a un lateral de la pregunta durant els tests (perquè es pugui reportar
// un error concret indicant l'ID al Gestor de preguntes).
function etiquetaIdPreguntaHtml(preguntaObj) {
  if (!preguntaObj || !preguntaObj.id) return '';
  return `<span title="ID de la pregunta" style="font-size:10px;color:#94a3b8;font-weight:800;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:6px;padding:3px 8px;white-space:nowrap;flex:none;">🆔 ${escapeHtmlGlobal(preguntaObj.id)}</span>`;
}

function barrejarArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function mostrarPregunta(preguntaObj) {
    const respostaCorrectaText = preguntaObj.opcions[preguntaObj.resposta];
    let opcionsBarrejades = [...preguntaObj.opcions];
    barrejarArray(opcionsBarrejades);
    
    const nouIndexCorrecte = opcionsBarrejades.indexOf(respostaCorrectaText);
    
    const contenedor = obtenirContenidorTest();
    if (!contenedor) return;

    contenedor.innerHTML = `
        <div class="pregunta-box" style="background: white; padding: 25px; border-radius: 16px; border: 1px solid #e2e8f0; margin-top: 15px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
                <h3 style="margin: 0; color: #0f172a; font-size: 16px;">${preguntaObj.pregunta}</h3>
                ${etiquetaIdPreguntaHtml(preguntaObj)}
            </div>
            <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 15px;" id="llista-opcions"></div>
        </div>
        <div id="feedback" style="margin-top: 15px;"></div>
    `;

    const llistaOpcions = contenedor.querySelector('#llista-opcions');
    
    opcionsBarrejades.forEach((opcio, index) => {
        const btn = document.createElement('button');
        btn.className = 'btn-opcio-test';
        btn.style.cssText = "padding: 12px 15px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; text-align: left; cursor: pointer; font-size: 14px;";
        btn.textContent = opcio;
        
        btn.addEventListener('click', () => {
            llistaOpcions.querySelectorAll('button').forEach(b => b.style.pointerEvents = 'none');
            
            const feedback = document.getElementById('feedback');
            const esCorrecte = (index === nouIndexCorrecte);
            
            if (preguntaObj.id) {
                const fontPregunta = (typeof detectarFontPregunta === 'function' ? detectarFontPregunta(preguntaObj) : '') || 'Mossos';
                registrarRespuestaGlobal(preguntaObj.id, esCorrecte, preguntaObj);
                if (esCorrecte) {
                    eliminarPreguntaAcertada(preguntaObj.id, fontPregunta);
                } else {
                    guardarPreguntaFallada(preguntaObj);
                }
            }

            if (esCorrecte) {
                btn.style.background = '#d1fae5';
                btn.style.borderColor = '#10b981';
                feedback.innerHTML = `
                    <div style="background: #d1fae5; border: 1px solid #6ee7b7; padding: 15px; border-radius: 8px; color: #065f46;">
                        <p style="margin: 0 0 5px 0; font-weight: 700;">✅ Correcte!</p>
                        <p style="margin: 0; font-size: 13px;">${preguntaObj.explicacio || ''}</p>
                    </div>
                `;
            } else {
                btn.style.background = '#fee2e2';
                btn.style.borderColor = '#ef4444';
                feedback.innerHTML = `
                    <div style="background: #fee2e2; border: 1px solid #fca5a5; padding: 15px; border-radius: 8px; color: #991b1b;">
                        <p style="margin: 0 0 5px 0; font-weight: 700;">❌ Incorrecte.</p>
                        <p style="margin: 0; font-size: 13px;">${preguntaObj.explicacio || ''}</p>
                    </div>
                `;
            }
        });

        llistaOpcions.appendChild(btn);
    });
}


// ==========================================
// 3. GESTIÓ D'HISTORIAL, ERRORS I ESTADÍSTIQUES
// ==========================================

const ERROR_DB_KEY = 'mossos_errors_db_v2';

function obtenerHistorial() {
  try {
    return JSON.parse(localStorage.getItem('mossos_stats_db') || '{"respondidas": {}, "descobertes": {}}');
  } catch (e) {
    return { respondidas: {}, descobertes: {} };
  }
}

function registrarRespuestaGlobal(idPregunta, esCorrecta, preguntaObj = null) {
  let stats = obtenerHistorial();
  if (!stats.respondidas) stats.respondidas = {};
  if (!stats.descobertes) stats.descobertes = {};

  const font = detectarFontPregunta(preguntaObj) || 'Mossos';
  const clau = `${font}::${idPregunta}`;

  // "descobertes" només marca que aquesta pregunta s'ha vist alguna vegada.
  // Per tant, repetir-la 2, 10 o 100 vegades NO augmenta el progrés.
  stats.descobertes[clau] = true;

  // Les respostes es guarden amb clau "Font::id" per evitar col·lisions quan
  // dues preguntes de bancs diferents (Mossos / Policia Local / Actualitat)
  // comparteixen el mateix identificador numèric.
  stats.respondidas[clau] = {
    correcta: !!esCorrecta,
    font,
    ambit: preguntaObj?.ambit || '',
    seccio: preguntaObj?.seccio || '',
    updatedAt: Date.now()
  };

  // Compatibilitat amb dades antigues que encara consulten per id "nu":
  // si ja no hi ha cap altra pregunta amb aquest mateix id en un altre banc,
  // mantenim també l'entrada antiga sincronitzada.
  if (stats.respondidas[idPregunta] && stats.respondidas[idPregunta].font === font) {
    delete stats.respondidas[idPregunta];
  }

  localStorage.setItem('mossos_stats_db', JSON.stringify(stats));

  // Ratxa real: encerts consecutius. Es conserva entre recàrregues.
  let ratxa = Number(localStorage.getItem('ratxa_comptador') || 0);
  let millorRatxa = Number(localStorage.getItem('millor_ratxa') || 0);
  if (esCorrecta) {
    ratxa += 1;
    if (ratxa > millorRatxa) millorRatxa = ratxa;
  } else {
    ratxa = 0;
  }
  localStorage.setItem('ratxa_comptador', String(ratxa));
  localStorage.setItem('millor_ratxa', String(millorRatxa));
  actualitzarRatxaUI();
  if (typeof actualizarEstadisticasTop === 'function') actualizarEstadisticasTop();
}

function obtenirRatxa() {
  return Number(localStorage.getItem('ratxa_comptador') || 0);
}

function obtenirMillorRatxa() {
  return Number(localStorage.getItem('millor_ratxa') || 0);
}

function actualitzarRatxaUI() {
  const ratxa = obtenirRatxa();
  const top = document.getElementById('ratxa-val');
  if (top) top.textContent = `🔥 ${ratxa}`;
  const topLabel = top?.parentElement?.querySelector('.l');
  if (topLabel) topLabel.textContent = `ratxa`;
  const inici = document.getElementById('inici-ratxa');
  if (inici) inici.textContent = `${ratxa}`;
  const iniciLabel = inici?.parentElement?.querySelector('span:last-child');
  if (iniciLabel) iniciLabel.textContent = `Ratxa activa`;
}
window.actualitzarRatxaUI = actualitzarRatxaUI;

function normalitzarRespostaStat(valor) {
  if (typeof valor === 'boolean') return { correcta: valor };
  return valor || { correcta: false };
}

function detectarFontPregunta(pregunta) {
  if (!pregunta) return '';
  if (pregunta._font) return pregunta._font;

  const id = String(pregunta.id || '').toUpperCase();
  const text = `${pregunta.font || ''} ${pregunta.origen || ''} ${pregunta.categoria || ''} ${pregunta.ambit || ''}`.toLowerCase();

  if (id.startsWith('MOSSOS') || String(pregunta.ambit || '').toUpperCase().startsWith('ÀMBIT')) return 'Mossos';
  if (id.startsWith('PL') || text.includes('policia local') || text.includes('municipi')) return 'Policia Local';
  if (id.startsWith('ACT') || text.includes('actualitat')) return 'Actualitat';
  return '';
}

function obtenerErrorDB() {
  try {
    const raw = JSON.parse(localStorage.getItem(ERROR_DB_KEY) || '{}');
    return {
      Mossos: Array.isArray(raw.Mossos) ? raw.Mossos : [],
      'Policia Local': Array.isArray(raw['Policia Local']) ? raw['Policia Local'] : [],
      Actualitat: Array.isArray(raw.Actualitat) ? raw.Actualitat : []
    };
  } catch (e) {
    return { Mossos: [], 'Policia Local': [], Actualitat: [] };
  }
}

function guardarErrorDB(db) {
  localStorage.setItem(ERROR_DB_KEY, JSON.stringify(db));
}

function migrarErrorsAntics() {
  const actual = obtenerErrorDB();
  const antic = (() => {
    try { return JSON.parse(localStorage.getItem('mossos_errors_db') || '[]'); } catch (e) { return []; }
  })();

  if (!Array.isArray(antic) || !antic.length) return actual;

  let canvi = false;
  antic.forEach(q => {
    const font = detectarFontPregunta(q) || 'Mossos';
    const dest = actual[font];
    const existent = dest.find(x => x.id === q.id);
    if (existent) {
      existent.errorCount = Math.max(existent.errorCount || 1, q.errorCount || 1);
    } else {
      dest.push({ ...q, _font: font, errorCount: q.errorCount || 1, lastErrorAt: q.lastErrorAt || Date.now() });
    }
    canvi = true;
  });

  if (canvi) {
    guardarErrorDB(actual);
    localStorage.removeItem('mossos_errors_db');
  }
  return actual;
}

function obtenerPreguntasFalladas(font = null) {
  const db = migrarErrorsAntics();
  if (font) return [...(db[font] || [])];
  return obtenirTotesLesPreguntesFallades();
}

function obtenirTotesLesPreguntesFallades() {
  const db = migrarErrorsAntics();
  return [...db.Mossos, ...db['Policia Local'], ...db.Actualitat];
}

function guardarPreguntaFallada(pregunta) {
  if (!pregunta?.id) return;
  const db = migrarErrorsAntics();
  const font = detectarFontPregunta(pregunta) || 'Mossos';
  const dest = db[font];
  const existent = dest.find(q => q.id === pregunta.id);

  if (existent) {
    existent.errorCount = (existent.errorCount || 1) + 1;
    existent.lastErrorAt = Date.now();
  } else {
    dest.push({
      ...pregunta,
      _font: font,
      errorCount: 1,
      lastErrorAt: Date.now()
    });
  }

  guardarErrorDB(db);
  actualitzarBotonsRepasErrors();
  actualitzarFlashcardsDesErrors();
  actualitzarDashboardInici();
}

function eliminarPreguntaAcertada(idPregunta, font = null) {
  const db = migrarErrorsAntics();
  const fonts = font ? [font] : Object.keys(db);

  fonts.forEach(f => {
    db[f] = (db[f] || []).filter(q => q.id !== idPregunta);
  });

  guardarErrorDB(db);
  actualitzarBotonsRepasErrors();
  actualitzarFlashcardsDesErrors();
  actualitzarDashboardInici();
}

function esborrarTotsElsErrors() {
  if (!confirm("⚠️ Segur que vols esborrar TOTS els errors acumulats de Mossos, Policia Local i Actualitat? Aquesta acció no es pot desfer.")) return;
  localStorage.removeItem(ERROR_DB_KEY);
  localStorage.removeItem('mossos_errors_db');
  actualitzarBotonsRepasErrors();
  actualitzarFlashcardsDesErrors();
  actualitzarDashboardInici();
  alert("✅ Errors acumulats esborrats.");
}

function actualitzarBotonsRepasErrors() {
  const db = migrarErrorsAntics();
  const btnRepas = document.getElementById('btn-repas-errors-inici');
  if (btnRepas) {
    const errors = obtenirTotesLesPreguntesFallades();
    const total = errors.length;
    const fallades = errors.reduce((sum, q) => sum + (q.errorCount || 1), 0);
    btnRepas.innerText = `🔁 Repàs d'errors acumulats (${total})`;
    btnRepas.style.background = total > 0 ? '#ef4444' : '#e2e8f0';
    btnRepas.style.color = total > 0 ? '#ffffff' : '#64748b';
    btnRepas.onclick = (e) => { e.preventDefault(); iniciarRepasErrorsTots(); };
  }
}

function obtenirDatasetPerFont(font) {
  if (font === 'Mossos') return Array.isArray(bancoPreguntes) ? bancoPreguntes : [];
  if (font === 'Policia Local') return Array.isArray(bancoPoliciaLocal) ? bancoPoliciaLocal : [];
  if (font === 'Actualitat') return Array.isArray(bancoActualitat) ? bancoActualitat : [];
  return [];
}

function obtenirEstadistiquesBanc(dataset) {
  const stats = obtenerHistorial();
  const respostes = stats.respondidas || {};
  const descobertes = stats.descobertes || {};
  const total = dataset.length;
  let contestades = 0;
  let encerts = 0;

  // Evitem comptar dues vegades el mateix id si, per error de dades,
  // apareix repetit dins del mateix banc.
  const idsUnics = new Set();

  dataset.forEach(q => {
    if (!q || !q.id) return;
    if (idsUnics.has(q.id)) return;
    idsUnics.add(q.id);

    const font = detectarFontPregunta(q) || 'Mossos';
    const clau = `${font}::${q.id}`;

    // Registre de la resposta: primer mirem la clau namespaced (correcta),
    // i si no existeix, mirem la clau antiga (bare id) per compatibilitat
    // amb progrés guardat abans d'aquesta correcció.
    const registre = respostes[clau] || respostes[q.id];

    const vista = Object.prototype.hasOwnProperty.call(descobertes, clau) || !!registre;
    if (!vista) return;

    contestades++;
    if (registre && normalitzarRespostaStat(registre).correcta === true) encerts++;
  });

  return {
    total,
    contestades,
    encerts,
    // El progrés real de l'oposició és el nombre de preguntes ÚNIQUES ja
    // dominades (contestades i encertades) sobre el total del banc.
    errors: Math.max(0, contestades - encerts),
    progrés: total ? Math.round((encerts / total) * 100) : 0,
    pctErrors: contestades ? Math.round(((contestades - encerts) / contestades) * 100) : 0,
    pctEncerts: contestades ? Math.round((encerts / contestades) * 100) : 0
  };
}

function obtenirEstadistiquesSeccio(dataset, seccio) {
  return obtenirEstadistiquesBanc((dataset || []).filter(q => q.seccio === seccio));
}

function actualitzarDashboardInici() {
  const dbErrors = migrarErrorsAntics();
  const datasets = {
    mossosA: bancoPreguntes.filter(q => q.ambit === 'Àmbit A'),
    mossosB: bancoPreguntes.filter(q => q.ambit === 'Àmbit B'),
    mossosC: bancoPreguntes.filter(q => q.ambit === 'Àmbit C'),
    mossos: bancoPreguntes,
    pl: bancoPoliciaLocal,
    act: bancoActualitat
  };
  const fontForKey = key => key === 'pl' ? 'Policia Local' : key === 'act' ? 'Actualitat' : 'Mossos';

  const dades = {};
  Object.entries(datasets).forEach(([key, dataset]) => {
    const base = obtenirEstadistiquesBanc(dataset);
    const font = fontForKey(key);
    const ids = new Set(dataset.map(q => q.id));
    let pendents = (dbErrors[font] || []).filter(q => ids.has(q.id)).length;
    dades[key] = {
      ...base,
      errors: pendents,
      pctErrors: dataset.length ? Math.round((pendents / dataset.length) * 100) : 0
    };
  });

  Object.entries(dades).forEach(([key, val]) => {
    const el = document.querySelector(`[data-progress="${key}"]`);
    if (!el) return;
    el.querySelector('.dash-prog-fill')?.style.setProperty('width', `${val.progrés}%`);
    const pct = el.querySelector('.dash-prog-pct');
    if (pct) pct.textContent = `${val.progrés}%`;
    const detail = el.querySelector('.dash-prog-detail');
    if (detail) detail.textContent = `${val.encerts} encertades de ${val.total} (${val.contestades} contestades)`;
    const err = el.querySelector('.dash-error');
    if (err) err.textContent = `${val.pctErrors}% errors · ${val.errors} fallades`;
  });

  const rank = document.getElementById('ranking-errors');
  if (rank) {
    const errors = obtenirTotesLesPreguntesFallades()
      .sort((a, b) => (b.errorCount || 0) - (a.errorCount || 0))
      .slice(0, 10);

    rank.innerHTML = errors.length ? errors.map((q, i) => `
      <div class="dash-rank-row">
        <div class="dash-rank-pos">${i + 1}</div>
        <div class="dash-rank-main">
          <div class="dash-rank-q">${q.pregunta}</div>
          <div class="dash-rank-meta">${q._font || detectarFontPregunta(q)} · ${q.seccio || q.ambit || 'Sense secció'}</div>
        </div>
        <div class="dash-rank-count">🚨 ${q.errorCount || 1}</div>
      </div>
    `).join('') : `<div class="dash-empty">🎉 No tens errors acumulats. Això és exactament el que volem.</div>`;
  }

  const totalErrors = obtenirTotesLesPreguntesFallades().length;
  const badge = document.getElementById('total-errors-dashboard');
  if (badge) badge.textContent = `${totalErrors} preguntes pendents`;
}

function recuperarPreguntaCompleta(q) {
  if (!q || !q.id) return null;

  const id = String(q.id);

  // Construïm un únic banc de recerca i el fem tolerant a bancs
  // que estiguin organitzats en subarrays.
  const normalitzarBanc = (banc) => {
    if (!Array.isArray(banc)) return [];
    return banc.flat ? banc.flat(Infinity).filter(Boolean) : banc.filter(Boolean);
  };

  const bancs = [
    ...normalitzarBanc(window.bancoPreguntes),
    ...normalitzarBanc(window.bancoPoliciaLocal),
    ...normalitzarBanc(window.bancoActualitat),
    ...normalitzarBanc(bancoPreguntes),
    ...normalitzarBanc(bancoPoliciaLocal),
    ...normalitzarBanc(bancoActualitat)
  ];

  const original = bancs.find(x => x && String(x.id) === id);
  const completa = original ? { ...original, ...q } : { ...q };

  // Si tenim la pregunta original, ella és la font de veritat per al text,
  // opcions i resposta. Conservem del registre d'errors només el comptador.
  if (original) {
    completa.pregunta = original.pregunta;
    completa.opcions = Array.isArray(original.opcions) ? [...original.opcions] : original.opcions;
    completa.resposta = original.resposta;
    completa.explicacio = original.explicacio || '';
    completa.ambit = original.ambit || completa.ambit || '';
    completa.seccio = original.seccio || completa.seccio || '';
  }

  if (!Array.isArray(completa.opcions) || completa.opcions.length < 2) return null;

  // Normalitzem la resposta perquè funcionin tant els registres nous com
  // els antics: 0/1/2/3, "0"/"1"..., A/B/C/D o el text de l'opció.
  let resposta = completa.resposta;
  if (typeof resposta === 'string') {
    const r = resposta.trim();
    if (/^[0-9]+$/.test(r)) resposta = Number(r);
    else {
      const lletra = r.toUpperCase();
      const mapa = { A: 0, B: 1, C: 2, D: 3, E: 4, F: 5 };
      if (Object.prototype.hasOwnProperty.call(mapa, lletra)) resposta = mapa[lletra];
      else {
        const idxText = completa.opcions.indexOf(resposta);
        if (idxText >= 0) resposta = idxText;
      }
    }
  }

  if (typeof resposta !== 'number' || !Number.isInteger(resposta) || resposta < 0 || resposta >= completa.opcions.length) {
    return null;
  }

  completa.resposta = resposta;
  completa.errorCount = Number(q.errorCount) || 1;
  completa._font = q._font || detectarFontPregunta(completa) || 'Mossos';
  return completa;
}

function iniciarRepasErrorsTots() {
  // REPÀS D'ERRORS: motor independent del test normal.
  // Treballem directament amb els registres guardats a localStorage.
  // No depèn de mostrarPregunta(), mostrarPreguntaAmbSeguent() ni de #test-container.
  const errors = obtenirTotesLesPreguntesFallades()
    .filter(q => q && q.id && Array.isArray(q.opcions) && q.opcions.length >= 2)
    .map(q => ({ ...q, errorCount: Number(q.errorCount) || 1 }))
    .sort((a,b) => b.errorCount - a.errorCount);

  if (!errors.length) {
    alert('🎉 No tens cap error pendent.');
    return;
  }

  const view = document.getElementById('view-inici');
  if (!view) return;

  activeTestContainerId = 'repas-errors-container';
  let index = 0;
  let encerts = 0;
  let fallades = 0;

  function tornar() { tornarAInici(); }

  function render() {
    if (index >= errors.length) {
      const pendents = obtenirTotesLesPreguntesFallades();
      view.innerHTML = `
        <div style="max-width:900px;margin:0 auto;padding:25px 0 80px;">
          <div style="background:white;border:1px solid #e2e8f0;border-radius:16px;padding:30px;text-align:center;">
            <div style="font-size:44px;">${pendents.length ? '💪' : '🏆'}</div>
            <h2 style="color:#0f172a;margin:10px 0;">Repàs d'errors finalitzat</h2>
            <p style="color:#475569;">Has repassat ${errors.length} preguntes.</p>
            <p><b>✅ Encertades: ${encerts}</b> &nbsp;&nbsp; <b>❌ Fallades: ${fallades}</b></p>
            <p style="font-size:18px;font-weight:800;color:${pendents.length ? '#dc2626' : '#16a34a'};">
              ${pendents.length ? `Queden ${pendents.length} preguntes pendents.` : '🎉 Has eliminat tots els errors!'}
            </p>
            <button id="rep-errors-home" style="background:#007aff;color:white;border:0;border-radius:9px;padding:12px 24px;font-weight:800;cursor:pointer;">🏠 Tornar a Inici</button>
          </div>
        </div>`;
      document.getElementById('rep-errors-home').onclick = tornar;
      window.scrollTo({top:0, behavior:'auto'});
      return;
    }

    const q = errors[index];
    let correct = q.resposta;
    if (typeof correct === 'string') { const r=correct.trim(); if (/^[0-9]+$/.test(r)) correct=Number(r); else { const m={A:0,B:1,C:2,D:3,E:4,F:5}; correct=m[r.toUpperCase()] ?? q.opcions.indexOf(correct); } }
    let options = q.opcions.map((text, i) => ({text, original:i}));
    for (let i=options.length-1;i>0;i--) {
      const j=Math.floor(Math.random()*(i+1));
      [options[i],options[j]]=[options[j],options[i]];
    }

    view.innerHTML = `
      <div id="repas-errors-container" style="max-width:900px;margin:0 auto;padding:10px 0 80px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;gap:10px;">
          <div>
            <div style="font-size:12px;color:#64748b;font-weight:800;">🔁 REPÀS D'ERRORS ACUMULATS</div>
            <div style="font-size:13px;color:#dc2626;font-weight:800;margin-top:3px;">🔥 Aquesta pregunta l'has fallat ${q.errorCount} vegada${q.errorCount===1?'':'es'}</div>
          </div>
          <button id="rep-errors-exit" style="background:#e2e8f0;color:#334155;border:0;border-radius:8px;padding:10px 14px;font-weight:800;cursor:pointer;">🏠 Inici</button>
        </div>
        <div style="background:white;border:1px solid #e2e8f0;border-radius:16px;padding:25px;">
          <div style="font-size:12px;color:#64748b;font-weight:800;margin-bottom:9px;display:flex;justify-content:space-between;align-items:center;gap:10px;">
            <span>Pregunta ${index+1} de ${errors.length}</span>
            ${etiquetaIdPreguntaHtml(q)}
          </div>
          <h3 style="margin:0 0 20px;color:#0f172a;font-size:18px;line-height:1.45;">${escapeHtmlRep(q.pregunta || '')}</h3>
          <div id="rep-errors-options" style="display:flex;flex-direction:column;gap:10px;"></div>
          <div id="rep-errors-feedback"></div>
        </div>
      </div>`;

    document.getElementById('rep-errors-exit').onclick = tornar;
    const list = document.getElementById('rep-errors-options');
    const feedback = document.getElementById('rep-errors-feedback');
    let answered = false;

    options.forEach((opt) => {
      const b=document.createElement('button');
      b.textContent=opt.text;
      b.style.cssText='padding:14px 16px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:10px;text-align:left;cursor:pointer;font-size:15px;color:#1e293b;';
      b.onclick=()=>{
        if(answered) return;
        answered=true;
        list.querySelectorAll('button').forEach(x=>x.disabled=true);
        const ok = opt.original === correct;
        if(ok){
          encerts++;
          eliminarPreguntaAcertada(q.id, q._font || detectarFontPregunta(q));
          b.style.background='#dcfce7'; b.style.borderColor='#22c55e';
        } else {
          fallades++;
          guardarPreguntaFallada(q);
          b.style.background='#fee2e2'; b.style.borderColor='#ef4444';
          list.querySelectorAll('button').forEach((x,k)=>{ if(options[k].original===correct){x.style.background='#dcfce7';x.style.borderColor='#22c55e';} });
        }
        feedback.innerHTML=`<div style="margin-top:16px;padding:14px;border-radius:10px;background:${ok?'#dcfce7':'#fee2e2'};color:${ok?'#166534':'#991b1b'};"><b>${ok?'✅ Correcte!':'❌ Incorrecte'}</b><div style="margin-top:6px;font-size:13px;">${escapeHtmlRep(q.explicacio || '')}</div></div><button id="rep-errors-next" style="width:100%;margin-top:14px;background:#007aff;color:white;border:0;border-radius:9px;padding:13px;font-weight:800;cursor:pointer;">${index+1===errors.length?'Finalitzar repàs ✓':'Següent pregunta ➜'}</button>`;
        document.getElementById('rep-errors-next').onclick=()=>{index++;render();window.scrollTo({top:0,behavior:'auto'});};
      };
      list.appendChild(b);
    });
    window.scrollTo({top:0,behavior:'auto'});
  }

  render();
}

function escapeHtmlRep(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function iniciarRepasErrors(font) {
  activeTestContainerId = 'test-container';
  const errors = obtenerPreguntasFalladas(font).sort((a, b) => (b.errorCount || 0) - (a.errorCount || 0));
  if (!errors.length) {
    alert(`🎉 No tens errors pendents a ${font}.`);
    return;
  }

  const contenedor = obtenirContenidorTest();
  if (!contenedor) return;

  let index = 0;

  function següent() {
    const pendents = obtenerPreguntasFalladas(font);
    if (index >= errors.length) {
      const actuals = pendents.length;
      contenedor.innerHTML = `
        <div style="background:white;padding:30px;border-radius:16px;border:1px solid #e2e8f0;text-align:center;margin-top:20px;">
          <h2>🔁 Repàs completat</h2>
          <p>Has revisat les preguntes que tenies acumulades a <b>${font}</b>.</p>
          <p style="font-size:18px;font-weight:800;color:${actuals ? '#dc2626' : '#16a34a'};margin:15px 0;">
            ${actuals ? `Queden ${actuals} preguntes pendents.` : '🎉 No queda cap error pendent!'}
          </p>
          <button onclick="mostrarInici()" style="background:#007aff;color:white;border:none;padding:11px 22px;border-radius:8px;font-weight:700;cursor:pointer;">Tornar a Inici</button>
        </div>`;
      return;
    }

    const q = errors[index];
    mostrarPreguntaAmbSeguent(q, index, errors.length, () => {
      index++;
      següent();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  següent();
}

function actualizarEstadisticasTop() {
  const stats = obtenerHistorial();
  const idsRespondidas = Object.keys(stats.respondidas || {});
  const totalContestadas = idsRespondidas.length;
  const totalAcertadas = idsRespondidas.filter(id => normalitzarRespostaStat(stats.respondidas[id]).correcta === true).length;

  const porcentajeAciertos = totalContestadas > 0 ? ((totalAcertadas / totalContestadas) * 100).toFixed(1) : '0.0';

  const notaMossos = document.getElementById('nota-mossos');
  if (notaMossos) notaMossos.textContent = `📊 ${porcentajeAciertos}%`;

  const iniciPreguntes = document.getElementById('inici-preguntes');
  if (iniciPreguntes) iniciPreguntes.textContent = totalContestadas;

  actualitzarDashboardInici();
}

// ==========================================
// 4. INICIALITZACIÓ PRINCIPAL I VISTES
// ==========================================
document.addEventListener('DOMContentLoaded', () => {

  // Netejar restes de xat
  function netejarXat() {
    const selectors = ['.chat-mini', '.chat-mini-open', '.rightrail', '[title="Obre el xat"]'];
    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => el.remove());
    });
  }
  netejarXat();
  const observer = new MutationObserver(netejarXat);
  observer.observe(document.body, { childList: true, subtree: true });

  // Calcular dies restants per a l'examen oficial (17 d'octubre de 2026)
  const targetDate = new Date('2026-10-17T00:00:00');
  const today = new Date();
  const diffTime = targetDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const elDies = document.getElementById('dies-examen');
  if (elDies) elDies.textContent = diffDays > 0 ? diffDays : 0;

  // --- NAVEGACIÓ GENERAL PER PESTANYES (data-tab) ---
  const navButtons = document.querySelectorAll('[data-tab]');

  navButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      const targetTab = button.getAttribute('data-tab');

      navButtons.forEach(btn => btn.classList.remove('active'));
      const activeButtons = document.querySelectorAll(`[data-tab="${targetTab}"]`);
      activeButtons.forEach(btn => btn.classList.add('active'));

      document.body.className = `sec-${targetTab}`;

      const views = document.querySelectorAll('.view-content');
      views.forEach(view => {
        if (view.id === `view-${targetTab}`) {
          view.style.display = 'block';
        } else {
          view.style.display = 'none';
        }
      });

      if (targetTab === 'inici') {
        mostrarInici();
      } else if (targetTab === 'mossos') {
        mostrarTemarioMossos();
      } else if (targetTab === 'policia-local') {
        mostrarTemarioPL();
      } else if (targetTab === 'actualitat') {
        mostrarTemarioActualitat();
      } else if (targetTab === 'editor') {
        mostrarGestorPreguntes();
      }
    });
  });

  // --- CARGA DE BANCOS DE DATOS ---
  try {
    bancoPreguntes = (typeof window.bancoPreguntes !== 'undefined' && Array.isArray(window.bancoPreguntes)) ? window.bancoPreguntes : [];
    bancoPoliciaLocal = (typeof window.bancoPoliciaLocal !== 'undefined' && Array.isArray(window.bancoPoliciaLocal)) ? window.bancoPoliciaLocal : [];
    bancoActualitat = (typeof window.bancoActualitat !== 'undefined' && Array.isArray(window.bancoActualitat)) ? window.bancoActualitat : [];

    if (Array.isArray(bancoPreguntes) && bancoPreguntes.length > 0 && Array.isArray(bancoPreguntes[0])) {
      bancoPreguntes = bancoPreguntes.flat();
    }

    // Afegim les preguntes creades/editades des del Gestor de preguntes
    // (es guarden a localStorage perquè encara no hi ha base de dades al servidor).
    const _custom = carregarPreguntesCustom();
    bancoPreguntes = bancoPreguntes.concat(_custom.mossos || []);
    bancoPoliciaLocal = bancoPoliciaLocal.concat(_custom.pl || []);
    bancoActualitat = bancoActualitat.concat(_custom.act || []);

    // Apliquem les correccions fetes des del Gestor de preguntes a preguntes
    // del banc ORIGINAL (cercades i editades per ID). Es guarden a part
    // (overrides) perquè el fitxer .js original és de només lectura des
    // del navegador; així el canvi es veu igualment de seguida a tota l'app.
    const _overrides = carregarOverridesPreguntes();
    bancoPreguntes = aplicarOverridesBanc(bancoPreguntes, _overrides.mossos);
    bancoPoliciaLocal = aplicarOverridesBanc(bancoPoliciaLocal, _overrides.pl);
    bancoActualitat = aplicarOverridesBanc(bancoActualitat, _overrides.act);

    console.log("S'han carregat correctament", bancoPreguntes.length, "preguntes de Mossos.");

  } catch (error) {
    console.error("Error en la càrrega dels bancs:", error);
  }

  // Cada funció d'inicialització es crida en el seu propi try/catch: si una falla,
  // les altres (incloent mostrarInici, que pinta les Convocatòries Actives guardades)
  // continuen executant-se igualment.
  try { if (typeof mostrarTemarioMossos === 'function') mostrarTemarioMossos(); } catch (e) { console.error('Error a mostrarTemarioMossos:', e); }
  try { if (typeof mostrarInici === 'function') mostrarInici(); } catch (e) { console.error('Error a mostrarInici:', e); }
  try { actualitzarBotonsRepasErrors(); } catch (e) { console.error('Error a actualitzarBotonsRepasErrors:', e); }
  try { actualizarEstadisticasTop(); } catch (e) { console.error('Error a actualizarEstadisticasTop:', e); }

  // --- CONVOCATÒRIES GESTIONABLES DES DE LA INTERFÍCIE ---
  const CONVOCATORIES_KEY = 'agentmedina_convocatories_v2';
  const CONVOCATORIES_OLD_KEYS = ['agentmedina_convocatories_v1'];
  const convocatoriesPerDefecte = [
    { id: 'mossos-46-26', nom: 'Mossos (Convocatòria 46-26)', url: 'https://mossos.gencat.cat/ca/els_mossos_desquadra/acces_al_cos/Mosso_a/mosso-a-convocatoria-46-26/', color: '#007aff' },
    { id: 'pl-mollerussa', nom: 'Policia Local (Mollerussa)', url: 'https://mollerussa.convoca.online/processDetail.html?id=190266bf-4c8b-49eb-4520-08de7dbdb6c7&type=0', color: '#28a745' }
  ];

  function normalitzarConvocatories(dades) {
    if (!Array.isArray(dades)) return [...convocatoriesPerDefecte];
    const netes = dades.filter(c => c && c.id && c.nom && c.url).map(c => ({
      id: String(c.id), nom: String(c.nom), url: String(c.url), color: String(c.color || '#007aff')
    }));
    const ids = new Set(netes.map(c => c.id));
    for (const base of convocatoriesPerDefecte) {
      if (!ids.has(base.id)) netes.unshift({...base});
    }
    return netes;
  }

  function obtenirConvocatories() {
    try {
      // Primer intenta la clau nova. Si no existeix, migra automàticament
      // les dades de versions anteriors.
      let raw = localStorage.getItem(CONVOCATORIES_KEY);
      if (!raw) {
        for (const oldKey of CONVOCATORIES_OLD_KEYS) {
          const oldRaw = localStorage.getItem(oldKey);
          if (oldRaw) { raw = oldRaw; break; }
        }
      }
      const dades = raw ? normalitzarConvocatories(JSON.parse(raw)) : [...convocatoriesPerDefecte];
      // Guardem sempre la versió normalitzada perquè sobrevisqui a recàrregues.
      localStorage.setItem(CONVOCATORIES_KEY, JSON.stringify(dades));
      return dades;
    } catch(e) {
      console.warn('No s’han pogut carregar les convocatòries', e);
      return [...convocatoriesPerDefecte];
    }
  }

  function guardarConvocatories(dades) {
    const netes = normalitzarConvocatories(dades);
    localStorage.setItem(CONVOCATORIES_KEY, JSON.stringify(netes));
    // També manté una còpia en una segona clau per recuperar dades si
    // alguna versió antiga de l'aplicació sobrescriu accidentalment la clau.
    localStorage.setItem('agentmedina_convocatories_backup', JSON.stringify(netes));
    return netes;
  }

  function pintarConvocatories() {
    const box = document.getElementById('llista-convocatories');
    if (!box) return;
    const dades = obtenirConvocatories();
    box.innerHTML = dades.length ? dades.map(c => `
      <div style="display:flex;align-items:center;gap:7px;">
        <a href="${escapeHtml(c.url)}" target="_blank" rel="noopener noreferrer" style="background:${escapeHtml(c.color || '#007aff')};color:white;text-decoration:none;padding:8px 13px;font-weight:700;border-radius:7px;font-size:13px;">${escapeHtml(c.nom)} ↗</a>
      </div>
    `).join('') : '<span style="font-size:13px;color:#64748b;">No hi ha convocatòries guardades.</span>';
  }

  function obrirFormConvocatoria(id = '') {
    const dades = obtenirConvocatories();
    const actual = dades.find(c => c.id === id) || { id:'', nom:'', url:'', color:'#007aff' };
    const modal = document.createElement('div');
    modal.id = 'modal-convocatoria';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.52);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;';
    modal.innerHTML = `
      <div style="background:white;width:min(520px,100%);max-height:90vh;overflow:auto;border-radius:16px;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,.25);">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px;">
          <h3 style="margin:0;color:#0f172a;">${id ? '✏️ Editar convocatòria' : '➕ Convocatòries'}</h3>
          <button type="button" id="conv-close" aria-label="Tancar" style="width:34px;height:34px;border:none;background:#f1f5f9;color:#475569;border-radius:50%;font-size:18px;cursor:pointer;">×</button>
        </div>
        ${!id ? `
          <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:18px;">
            ${dades.length ? dades.map(c => `
              <div style="display:flex;align-items:center;gap:8px;padding:9px 10px;border:1px solid #e2e8f0;border-radius:9px;background:#f8fafc;">
                <span style="width:13px;height:13px;border-radius:50%;background:${escapeHtml(c.color || '#007aff')};flex:none;"></span>
                <span style="flex:1;min-width:0;font-size:13px;font-weight:700;color:#334155;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(c.nom)}</span>
                <button type="button" data-edit-conv="${escapeHtml(c.id)}" title="Editar" style="border:1px solid #cbd5e1;background:white;color:#475569;border-radius:6px;padding:5px 7px;cursor:pointer;">✏️</button>
                <button type="button" data-del-conv="${escapeHtml(c.id)}" title="Eliminar" style="border:1px solid #fecaca;background:#fff1f2;color:#b91c1c;border-radius:6px;padding:5px 7px;cursor:pointer;">🗑️</button>
              </div>
            `).join('') : '<span style="font-size:13px;color:#64748b;">No hi ha convocatòries guardades.</span>'}
          </div>` : ''}
        <form id="form-convocatoria" style="border-top:${id ? '0' : '1px solid #e2e8f0'};padding-top:${id ? '0' : '16px'};">
          <h4 style="margin:0 0 10px;color:#334155;">${id ? 'Modificar convocatòria' : 'Afegir nova convocatòria'}</h4>
          <label style="display:block;font-size:13px;font-weight:700;margin:10px 0 5px;">Nom</label>
          <input id="conv-nom" required value="${escapeHtml(actual.nom)}" placeholder="Ex.: Mossos 47/26" style="width:100%;box-sizing:border-box;padding:10px;border:1px solid #cbd5e1;border-radius:8px;">
          <label style="display:block;font-size:13px;font-weight:700;margin:10px 0 5px;">URL</label>
          <input id="conv-url" type="url" required value="${escapeHtml(actual.url)}" placeholder="https://..." style="width:100%;box-sizing:border-box;padding:10px;border:1px solid #cbd5e1;border-radius:8px;">
          <label style="display:block;font-size:13px;font-weight:700;margin:10px 0 5px;">Color</label>
          <div style="display:flex;align-items:center;gap:10px;"><input id="conv-color" type="color" value="${escapeHtml(actual.color || '#007aff')}" style="width:55px;height:38px;padding:2px;border:1px solid #cbd5e1;border-radius:7px;"><span style="font-size:12px;color:#64748b;">Color del botó</span></div>
          <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:20px;">
            <button type="button" id="conv-cancel" style="padding:10px 15px;border:1px solid #cbd5e1;background:white;border-radius:8px;font-weight:700;cursor:pointer;">${id ? 'Tornar' : 'Cancel·lar'}</button>
            <button type="submit" style="padding:10px 15px;border:none;background:#007aff;color:white;border-radius:8px;font-weight:700;cursor:pointer;">💾 Guardar</button>
          </div>
        </form>
      </div>`;
    document.body.appendChild(modal);
    const tancar = () => modal.remove();
    modal.querySelector('#conv-close').onclick = tancar;
    modal.addEventListener('click', e => { if (e.target === modal) tancar(); });
    modal.querySelector('#conv-cancel').onclick = () => { if (id) { modal.remove(); obrirFormConvocatoria(); } else tancar(); };
    modal.querySelectorAll('[data-edit-conv]').forEach(btn => btn.addEventListener('click', () => { modal.remove(); obrirFormConvocatoria(btn.dataset.editConv); }));
    modal.querySelectorAll('[data-del-conv]').forEach(btn => btn.addEventListener('click', () => {
      const actualDel = dades.find(c => c.id === btn.dataset.delConv);
      if (!actualDel || !confirm(`Eliminar la convocatòria «${actualDel.nom}»?`)) return;
      guardarConvocatories(dades.filter(c => c.id !== btn.dataset.delConv));
      pintarConvocatories();
      modal.remove();
      obrirFormConvocatoria();
    }));
    modal.querySelector('#form-convocatoria').onsubmit = e => {
      e.preventDefault();
      const nom = modal.querySelector('#conv-nom').value.trim();
      const url = modal.querySelector('#conv-url').value.trim();
      const color = modal.querySelector('#conv-color').value;
      const nova = { id: actual.id || `conv-${Date.now()}`, nom, url, color };
      const index = dades.findIndex(c => c.id === nova.id);
      if (index >= 0) dades[index] = nova; else dades.push(nova);
      guardarConvocatories(dades);
      pintarConvocatories();
      modal.remove();
      if (!id) obrirFormConvocatoria();
    };
  }

  function eliminarConvocatoria(id) {
    const dades = obtenirConvocatories();
    const actual = dades.find(c => c.id === id);
    if (!actual) return;
    if (!confirm(`Eliminar la convocatòria «${actual.nom}»?`)) return;
    guardarConvocatories(dades.filter(c => c.id !== id));
    pintarConvocatories();
  }

  function escapeHtml(valor) {
    return String(valor ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }

  // --- VISTA INICI ---
  function mostrarInici() {
    const contenedor = document.getElementById('view-inici');
    if (!contenedor) return;

    const stats = obtenerHistorial();
    const idsRespondidas = Object.keys(stats.respondidas || {});
    const totalContestadas = idsRespondidas.length;
    const totalAcertadas = idsRespondidas.filter(id => normalitzarRespostaStat(stats.respondidas[id]).correcta === true).length;
    const porcentajeAciertos = totalContestadas ? ((totalAcertadas / totalContestadas) * 100).toFixed(1) : '0.0';
    const ratxaActual = obtenirRatxa();

    const cards = [
      ['mossosA','🔵','Mossos · Àmbit A','Coneixements de l’entorn', 'Àmbit A'],
      ['mossosB','🔴','Mossos · Àmbit B','Institucional i Marc Legal', 'Àmbit B'],
      ['mossosC','🟢','Mossos · Àmbit C','Seguretat i Policia', 'Àmbit C'],
      ['pl','🚔','Policia Local','Banc complet', 'Policia Local'],
      ['act','📰','Actualitat','Banc complet', 'Actualitat']
    ];

    contenedor.innerHTML = `
      <div style="max-width:1100px;margin:0 auto;display:flex;flex-direction:column;gap:20px;">
        <div style="background:#eef6ff;border:1px solid #b8daff;padding:15px 20px;border-radius:12px;display:flex;flex-direction:column;gap:12px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:20px;">📜</span>
            <h4 style="margin:0;font-size:16px;color:#004085;">Convocatòries Actives</h4>
          </div>
          <div id="llista-convocatories" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;"></div>
          <div>
            <button id="btn-afegir-convocatoria" type="button" style="border:1px dashed #94a3b8;background:white;color:#334155;padding:6px 10px;font-weight:700;border-radius:7px;font-size:12px;cursor:pointer;white-space:nowrap;">➕ Afegir</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;">
          <div style="background:#f8f9fa;border:1px solid #e9ecef;padding:15px;border-radius:10px;text-align:center;">
            <span style="font-size:24px;display:block;margin-bottom:5px;">🔥</span>
            <span style="font-size:18px;font-weight:700;" id="inici-ratxa">${ratxaActual}</span>
            <span style="font-size:12px;color:#6c757d;display:block;">Ratxa activa</span>
          </div>
          <div style="background:#f8f9fa;border:1px solid #e9ecef;padding:15px;border-radius:10px;text-align:center;">
            <span style="font-size:24px;display:block;margin-bottom:5px;">🎯</span>
            <span style="font-size:18px;font-weight:700;" id="inici-preguntes">${totalContestadas}</span>
            <span style="font-size:12px;color:#6c757d;display:block;">Preguntes contestades</span>
          </div>
          <div style="background:#f8f9fa;border:1px solid #e9ecef;padding:15px;border-radius:10px;text-align:center;">
            <span style="font-size:24px;display:block;margin-bottom:5px;">📊</span>
            <span style="font-size:18px;font-weight:700;">${porcentajeAciertos}%</span>
            <span style="font-size:12px;color:#6c757d;display:block;">Encerts globals</span>
          </div>
          <div style="background:#fff5f5;border:1px solid #fecaca;padding:15px;border-radius:10px;text-align:center;">
            <span style="font-size:24px;display:block;margin-bottom:5px;">🔥</span>
            <span style="font-size:18px;font-weight:700;" id="total-errors-dashboard">0 preguntes pendents</span>
            <span style="font-size:12px;color:#991b1b;display:block;">Errors acumulats</span>
          </div>
        </div>

        <div style="display:flex;justify-content:center;">
          <button id="btn-repas-errors-inici" style="width:100%;max-width:520px;border:none;padding:13px 18px;border-radius:10px;font-weight:800;cursor:pointer;font-size:15px;">🔁 Repàs d'errors acumulats (0)</button>
        </div>

        <div style="background:#ffffff;border:1px solid #e2e8f0;padding:18px;border-radius:12px;">
          <div style="margin-bottom:12px;"><h2 style="margin:0;color:#0f172a;font-size:20px;">🎯 Centre d'entrenament</h2><p style="margin:4px 0 0;color:#64748b;font-size:13px;">Accés ràpid a les quatre formes principals d'entrenar.</p></div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;">
            <button id="centre-continuar" type="button" style="padding:14px;border:1px solid #bfdbfe;background:#eff6ff;border-radius:10px;text-align:left;cursor:pointer;"><b>📖 Continuar estudi</b><small style="display:block;color:#64748b;margin-top:4px;">Torna a Mossos i continua amb els àmbits.</small></button>
            <button id="centre-errors" type="button" style="padding:14px;border:1px solid #fecaca;background:#fff5f5;border-radius:10px;text-align:left;cursor:pointer;"><b>🔁 Repàs d'errors</b><small style="display:block;color:#64748b;margin-top:4px;">Treballa les preguntes que més fallen.</small></button>
            <button id="centre-simulacre" type="button" style="padding:14px;border:1px solid #bbf7d0;background:#f0fdf4;border-radius:10px;text-align:left;cursor:pointer;"><b>📝 Simulacre oficial</b><small style="display:block;color:#64748b;margin-top:4px;">30 preguntes · 30 minuts.</small></button>
            <button id="centre-dificils" type="button" style="padding:14px;border:1px solid #fde68a;background:#fffbeb;border-radius:10px;text-align:left;cursor:pointer;"><b>🔥 Preguntes difícils</b><small style="display:block;color:#64748b;margin-top:4px;">Repàs prioritari de les més fallades.</small></button>
          </div>
        </div>

        <div style="background:#ffffff;border:1.5px solid #e2e8f0;padding:18px;border-radius:12px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
            <span style="font-size:18px;">💾</span>
            <h4 style="margin:0;font-size:15px;color:#002B5E;">Còpia de seguretat del progrés (PC ⇄ Android)</h4>
          </div>
          <p style="margin:0 0 12px;font-size:12.5px;color:#64748b;line-height:1.5;">
            Descarrega el teu progrés (errors, ratxa, estadístiques, convocatòries) des de l'ordinador i importa'l al mòbil Android —o a l'inrevés— per tenir-ho tot sincronitzat sense servidors externs.
          </p>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button id="btn-exportar-progres" type="button" style="flex:1;min-width:170px;background:#002B5E;color:#E8C000;border:none;border-radius:8px;padding:12px 16px;font-weight:800;font-size:13.5px;cursor:pointer;">⬇️ Exportar progrés (JSON)</button>
            <label for="input-importar-progres" style="flex:1;min-width:170px;text-align:center;background:#fff;color:#002B5E;border:1.5px solid #002B5E;border-radius:8px;padding:12px 16px;font-weight:800;font-size:13.5px;cursor:pointer;">⬆️ Importar progrés (JSON)</label>
            <input id="input-importar-progres" type="file" accept="application/json,.json" style="display:none;">
            <button id="btn-instalar-app" type="button" style="display:none;flex:1;min-width:170px;background:#16a34a;color:#fff;border:none;border-radius:8px;padding:12px 16px;font-weight:800;font-size:13.5px;cursor:pointer;">📲 Instal·lar l'app al dispositiu</button>
          </div>
        </div>

        <div>
          <div style="display:flex;align-items:end;justify-content:space-between;gap:10px;margin-bottom:10px;">
            <div>
              <h2 style="margin:0;color:#0f172a;font-size:20px;">📈 Progrés i errors per secció</h2>
              <p style="margin:4px 0 0;color:#64748b;font-size:13px;">Progrés = preguntes úniques contestades del banc. Els errors baixen quan els corregeixes.</p>
            </div>
            <button onclick="esborrarTotsElsErrors()" style="border:1px solid #fecaca;background:#fff1f2;color:#b91c1c;padding:8px 12px;border-radius:8px;font-weight:800;cursor:pointer;">🗑 Esborrar errors</button>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:14px;">
            ${cards.map(([key,ico,title,sub]) => `
              <div class="dash-progress-card" data-progress="${key}">
                <div style="display:flex;align-items:center;gap:10px;">
                  <span style="font-size:22px;">${ico}</span>
                  <div style="flex:1;">
                    <div style="font-weight:800;color:#0f172a;">${title}</div>
                    <div style="font-size:12px;color:#94a3b8;">${sub}</div>
                  </div>
                  <b class="dash-prog-pct" style="color:#007aff;">0%</b>
                </div>
                <div style="height:10px;background:#e2e8f0;border-radius:999px;overflow:hidden;margin:12px 0 6px;">
                  <span class="dash-prog-fill" style="display:block;width:0%;height:100%;background:linear-gradient(90deg,#007aff,#5aa9ff);transition:width .25s;"></span>
                </div>
                <div style="display:flex;justify-content:space-between;gap:10px;font-size:12px;">
                  <span class="dash-prog-detail" style="color:#64748b;">0 / 0 preguntes fetes</span>
                  <span class="dash-error" style="font-weight:800;color:#dc2626;">0% errors · 0 fallades</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="dash-fallades-flash">
          <div class="fallades-block" style="background:white;border:1px solid #e9ecef;padding:20px;border-radius:12px;">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px;">
              <div>
                <h3 style="margin:0;font-size:18px;">✍️ Preguntes més fallades</h3>
                <p style="margin:4px 0 0;color:#64748b;font-size:12px;">La classificació suma cada vegada que tornes a fallar una pregunta.</p>
              </div>
              <button onclick="actualitzarFlashcardsDesErrors();actualitzarFlashcard()" style="background:#eef6ff;color:#0057a8;border:1px solid #bfdbfe;padding:7px 10px;border-radius:8px;font-weight:800;cursor:pointer;">⚡ Flashcards</button>
            </div>
            <div id="ranking-errors"></div>
          </div>

          <div class="flashcard-block" style="background:white;border:1px solid #e9ecef;padding:20px;border-radius:12px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
              <h3 style="margin:0;font-size:18px;">⚡ Flashcards</h3>
              <span id="flashcard-meta" style="font-size:11px;color:#94a3b8;"></span>
            </div>
            <div id="flashcard-container" onclick="girarFlashcard()" style="background:#fdfdfd;border:2px dashed #007aff;border-radius:10px;padding:25px;text-align:center;cursor:pointer;min-height:170px;display:flex;flex-direction:column;justify-content:center;align-items:center;">
              <span id="flashcard-badge" style="font-size:11px;text-transform:uppercase;color:#007aff;font-weight:700;margin-bottom:8px;">Clica per girar</span>
              <p id="flashcard-text" style="font-size:16px;font-weight:600;color:#333;margin:0;"></p>
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:15px;">
              <button onclick="canviarFlashcard(-1)" style="background:#e9ecef;border:none;padding:8px 15px;border-radius:6px;cursor:pointer;font-weight:600;">Anterior</button>
              <span id="flashcard-counter" style="font-size:14px;color:#6c757d;align-self:center;">1 / 1</span>
              <button onclick="canviarFlashcard(1)" style="background:#007aff;color:white;border:none;padding:8px 15px;border-radius:6px;cursor:pointer;font-weight:600;">Següent</button>
            </div>
          </div>
        </div>
      </div>
    `;

    const btnRepasErrors = document.getElementById('btn-repas-errors-inici');
    if (btnRepasErrors) {
      btnRepasErrors.addEventListener('click', iniciarRepasErrorsTots);
    }
    const btnAfegirConv = document.getElementById('btn-afegir-convocatoria');
    if (btnAfegirConv) btnAfegirConv.addEventListener('click', () => obrirFormConvocatoria());
    const centreContinuar = document.getElementById('centre-continuar');
    if (centreContinuar) centreContinuar.addEventListener('click', () => {
      document.querySelector('[data-tab="mossos"]')?.click();
      requestAnimationFrame(() => window.scrollTo({top:0,behavior:'smooth'}));
    });
    const centreErrors = document.getElementById('centre-errors');
    if (centreErrors) centreErrors.addEventListener('click', iniciarRepasErrorsTots);
    const centreDificils = document.getElementById('centre-dificils');
    if (centreDificils) centreDificils.addEventListener('click', iniciarRepasErrorsTots);
    const centreSimulacre = document.getElementById('centre-simulacre');
    if (centreSimulacre) centreSimulacre.addEventListener('click', () => {
      document.querySelector('[data-tab="mossos"]')?.click();
      setTimeout(() => document.querySelector('.tab-interna[data-subtab="examen"]')?.click(), 0);
    });

    const btnExportar = document.getElementById('btn-exportar-progres');
    if (btnExportar) btnExportar.addEventListener('click', exportarProgresJSON);
    const inputImportar = document.getElementById('input-importar-progres');
    if (inputImportar) inputImportar.addEventListener('change', () => gestionarSeleccioFitxerImport(inputImportar));
    const btnInstalarApp = document.getElementById('btn-instalar-app');
    if (btnInstalarApp) {
      btnInstalarApp.addEventListener('click', instalarAppPWA);
      if (window.deferredInstallPromptDisponible) btnInstalarApp.style.display = 'inline-flex';
    }

    pintarConvocatories();

    actualitzarFlashcardsDesErrors();
    actualitzarFlashcard();
    actualitzarDashboardInici();
    // Important: mostrarInici() reconstrueix l'HTML, per tant el botó de
    // repàs s'ha d'actualitzar DESPRÉS de crear-lo. Si no, quedava visualment
    // a (0) encara que la base d'errors tingués preguntes acumulades.
    actualitzarBotonsRepasErrors();
  }

  window.mostrarInici = mostrarInici;

  // --- VISTA MOSSOS ---
  function mostrarTemarioMossos() {
    const contenedor = document.getElementById('view-mossos');
    if (!contenedor) return;

    contenedor.innerHTML = `
      <div class="teoria-host" style="display: flex; flex-direction: column; gap: 20px;">
        <div class="teoria-tabs" style="display: flex; background: #f1f5f9; padding: 6px; border-radius: 12px; width: fit-content; gap: 6px;">
          <button class="tab-interna on" data-subtab="estudia" style="padding: 8px 16px; border: none; background: white; border-radius: 8px; font-weight: 700; cursor: pointer;">▶ Estudia</button>
          <button class="tab-interna" data-subtab="examen" style="padding: 8px 16px; border: none; background: transparent; border-radius: 8px; font-weight: 600; cursor: pointer; color: #64748b;">📝 Examen Oficial (30p)</button>
        </div>

        <div id="subview-estudia" class="subview-content" style="display: block;">
          <div class="hub">
            <div class="startbar">
              <div class="sb-lab">
                <span class="sb-k">Si prems Barrejat faràs</span>
                <span class="sb-lab-row"><span class="sb-t"><span class="mission-copy-wide">🧠 Test de tots els àmbits barrejats</span></span></span>
              </div>
              <div class="sb-go">
                <button class="btn-start btn-start-mossos">🔀 Barrejat</button>
              </div>
            </div>
            <p class="hub-pick-hint">👇 <b>Tria un tema</b></p>
            
            <div class="hub-ambit2 amb-active">
              <button class="amb-bar amb-bar-mossos" data-ambit="Àmbit A">
                <span class="amb-sq" style="background: rgb(0, 122, 255);"></span>
                <span class="amb-name">Àmbit A<small>Coneixements de l'entorn</small></span>
                <span class="amb-pct">0%</span>
                <span class="amb-chev">▸</span>
              </button>
            </div>
            <div class="hub-ambit2 amb-active">
              <button class="amb-bar amb-bar-mossos" data-ambit="Àmbit B">
                <span class="amb-sq" style="background: rgb(225, 29, 72);"></span>
                <span class="amb-name">Àmbit B<small>Institucional i Marc Legal</small></span>
                <span class="amb-pct">0%</span>
                <span class="amb-chev">▸</span>
              </button>
            </div>
            <div class="hub-ambit2 amb-active">
              <button class="amb-bar amb-bar-mossos" data-ambit="Àmbit C">
                <span class="amb-sq" style="background: rgb(22, 163, 74);"></span>
                <span class="amb-name">Àmbit C<small>Seguretat i Policia</small></span>
                <span class="amb-pct">0%</span>
                <span class="amb-chev">▸</span>
              </button>
            </div>
            <div class="hub-bottom">
            </div>
          </div>
        </div>

        <div id="subview-examen" class="subview-content" style="display: none;">
          <div style="background: white; border: 1px solid #e2e8f0; padding: 30px; border-radius: 16px; text-align: center; max-width: 700px; margin: 40px auto;">
            <h3 style="margin-top:0;">📝 Examen Oficial — 30 preguntes</h3>
            <p style="color:#64748b;line-height:1.5;">30 preguntes barrejades dels Àmbits A, B i C. Temps màxim: <b>30 minuts</b>.</p>
            <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:20px;">
              <button id="btn-examen-estudi-30" style="background:#16a34a;color:white;border:none;padding:14px 22px;border-radius:12px;font-weight:700;cursor:pointer;">📚 Mode Estudi</button>
              <button id="btn-examen-real-30" style="background:#007aff;color:white;border:none;padding:14px 22px;border-radius:12px;font-weight:700;cursor:pointer;">🎯 Mode Examen</button>
            </div>
            <p style="font-size:12px;color:#94a3b8;margin:15px 0 0;">Estudi: correcció immediata · Examen: resultats només al final</p>
          </div>
        </div>
      </div>
      <div id="test-container"></div>
    `;

    const subtabs = contenedor.querySelectorAll('.tab-interna');
    subtabs.forEach(tab => {
      tab.addEventListener('click', () => {
        subtabs.forEach(t => t.classList.remove('on'));
        tab.classList.add('on');
        const target = tab.getAttribute('data-subtab');
        document.getElementById('subview-estudia').style.display = target === 'estudia' ? 'block' : 'none';
        document.getElementById('subview-examen').style.display = target === 'examen' ? 'block' : 'none';
      });
    });

    const btnExamenEstudi = contenedor.querySelector('#btn-examen-estudi-30');
    const btnExamenReal = contenedor.querySelector('#btn-examen-real-30');
    if (btnExamenEstudi) btnExamenEstudi.addEventListener('click', () => iniciarExamenOficial('estudi'));
    if (btnExamenReal) btnExamenReal.addEventListener('click', () => iniciarExamenOficial('examen'));

    const btnStartMossos = contenedor.querySelector('.btn-start-mossos');
    if (btnStartMossos) {
      btnStartMossos.addEventListener('click', () => {
        const dades = window.bancoPreguntes && window.bancoPreguntes.length > 0 ? window.bancoPreguntes : bancoPreguntes;
        mostrarSelectorPreguntas("Tots els Àmbits (Barrejat - Mossos)", dades, true);
      });
    }

    const ambitsMossos = contenedor.querySelectorAll('.amb-bar-mossos');
    ambitsMossos.forEach(ambit => {
      ambit.addEventListener('click', () => {
        const nomAmbit = ambit.querySelector('.amb-name')?.innerText.trim() || "";
        const dades = window.bancoPreguntes && window.bancoPreguntes.length > 0 ? window.bancoPreguntes : bancoPreguntes;
        
        let preguntesFiltrades = dades;
        
        if (nomAmbit.includes("Àmbit A")) {
          preguntesFiltrades = dades.filter(q => q.ambit && q.ambit.toUpperCase().includes("ÀMBIT A"));
        } else if (nomAmbit.includes("Àmbit B")) {
          preguntesFiltrades = dades.filter(q => q.ambit && q.ambit.toUpperCase().includes("ÀMBIT B"));
        } else if (nomAmbit.includes("Àmbit C")) {
          preguntesFiltrades = dades.filter(q => q.ambit && q.ambit.toUpperCase().includes("ÀMBIT C"));
        }

        if (preguntesFiltrades.length === 0) {
          alert(`Encara no hi ha preguntes carregades per a "${nomAmbit}". Aquest àmbit estarà disponible properament.`);
          return;
        }

        mostrarSelectorSeccions(nomAmbit, preguntesFiltrades, mostrarTemarioMossos);
      });
    });

    // Omplir el percentatge real de progrés de cada Àmbit (A/B/C), calculat a partir
    // de les preguntes úniques ja contestades de cada àmbit. Abans es quedava fix a "0%".
    ambitsMossos.forEach(ambit => {
      const nomAmbit = ambit.querySelector('.amb-name')?.innerText.trim() || "";
      const pctEl = ambit.querySelector('.amb-pct');
      if (!pctEl) return;
      let subset = [];
      if (nomAmbit.includes("Àmbit A")) subset = bancoPreguntes.filter(q => q.ambit === 'Àmbit A');
      else if (nomAmbit.includes("Àmbit B")) subset = bancoPreguntes.filter(q => q.ambit === 'Àmbit B');
      else if (nomAmbit.includes("Àmbit C")) subset = bancoPreguntes.filter(q => q.ambit === 'Àmbit C');
      const est = obtenirEstadistiquesBanc(subset);
      pctEl.textContent = `${est.progrés}%`;
    });

    actualitzarBotonsRepasErrors();
  }

  // --- VISTA POLICIA LOCAL ---
  function mostrarTemarioPL() {
    const contenedor = document.getElementById('view-policia-local');
    if (!contenedor) return;

    contenedor.innerHTML = `
      <div class="teoria-host" style="display:flex;flex-direction:column;gap:20px;">
        <div class="hub">
          <div class="startbar">
            <div class="sb-lab">
              <span class="sb-k">Si prems Barrejat faràs</span>
              <span class="sb-lab-row"><span class="sb-t"><span class="mission-copy-wide">🧠 Test de tots els àmbits barrejats</span></span></span>
            </div>
            <div class="sb-go"><button class="btn-start btn-start-pl">🔀 Barrejat</button></div>
          </div>
          <p class="hub-pick-hint">👇 <b>Tria un tema</b></p>

          <div class="hub-ambit2 amb-active">
            <button class="amb-bar amb-bar-pl" data-pl-section="teoria">
              <span class="amb-sq" style="background:#007aff;"></span>
              <span class="amb-name">Teoria</span>
              <span class="amb-chev">▸</span>
            </button>
          </div>

          <div class="hub-ambit2 amb-active">
            <button class="amb-bar amb-bar-pl" data-pl-section="municipis">
              <span class="amb-sq" style="background:#e11d48;"></span>
              <span class="amb-name">Municipis</span>
              <span class="amb-chev">▸</span>
            </button>
            <div class="pl-municipis-list" style="display:none;padding:8px 12px 4px 42px;">
              ${carregarMunicipisPL().map(m => `
                <div style="display:flex;align-items:center;gap:6px;margin:5px 0;">
                  <button class="pl-municipi" data-municipi="${escapeHtml(m)}" style="flex:1;">${escapeHtml(m)}</button>
                  <button class="pl-municipi-eliminar" data-municipi="${escapeHtml(m)}" title="Eliminar municipi" style="flex:none;border:none;background:#fee2e2;color:#b91c1c;border-radius:8px;width:32px;height:32px;font-weight:800;cursor:pointer;">🗑</button>
                </div>
              `).join('')}
              <div style="display:flex;gap:6px;margin:8px 0 4px;">
                <input id="pl-nou-municipi" type="text" placeholder="Nom del municipi..." style="flex:1;min-width:0;font-size:16px;padding:8px 10px;border:1.5px solid #E2E8F0;border-radius:8px;">
                <button id="pl-afegir-municipi" style="flex:none;background:var(--gold2,#E8C000);color:var(--blue,#002B5E);border:none;border-radius:8px;padding:0 14px;font-weight:800;cursor:pointer;">➕</button>
              </div>
            </div>
          </div>

          <div class="hub-ambit2 amb-active">
            <button class="amb-bar amb-bar-pl" data-pl-section="cultura general">
              <span class="amb-sq" style="background:#16a34a;"></span>
              <span class="amb-name">Cultura general</span>
              <span class="amb-chev">▸</span>
            </button>
          </div>
        </div>
      </div>
      <div id="test-container"></div>
    `;

    const btnStartPL = contenedor.querySelector('.btn-start-pl');
    if (btnStartPL) btnStartPL.addEventListener('click', () => mostrarSelectorPreguntas('Tots els àmbits (Barrejat - Policia Local)', bancoPoliciaLocal, true));

    contenedor.querySelectorAll('[data-pl-section]').forEach(btn => {
      btn.addEventListener('click', () => {
        const section = btn.dataset.plSection;
        if (section === 'municipis') {
          const list = btn.parentElement.querySelector('.pl-municipis-list');
          if (list) list.style.display = list.style.display === 'none' ? 'block' : 'none';
          return;
        }
        const nom = section === 'teoria' ? 'Teoria' : 'Cultura general';
        const filtrades = bancoPoliciaLocal.filter(q => {
          const txt = `${q.seccio || ''} ${q.ambit || ''} ${q.tema || ''}`.toLowerCase();
          return txt.includes(section);
        });
        if (!filtrades.length) {
          alert(`Encara no hi ha preguntes carregades per a «${nom}». Aquest apartat està preparat per afegir contingut.`);
          return;
        }
        // Igual que a Mossos: mostrem el selector de seccions perquè es puguin
        // triar una, vàries o totes les seccions abans de començar el test.
        mostrarSelectorSeccions(nom, filtrades, mostrarTemarioPL);
      });
    });

    contenedor.querySelectorAll('.pl-municipi').forEach(btn => {
      btn.style.cssText = 'display:block;width:100%;margin:0;padding:9px 12px;text-align:left;border:1px solid #e2e8f0;background:#fff;border-radius:8px;cursor:pointer;font-weight:700;color:#334155;';
      btn.addEventListener('click', () => {
        const municipi = btn.dataset.municipi;
        const filtrades = bancoPoliciaLocal.filter(q => {
          const txt = `${q.seccio || ''} ${q.ambit || ''} ${q.tema || ''} ${q.municipi || ''}`.toLowerCase();
          return txt.includes(municipi.toLowerCase());
        });
        if (!filtrades.length) {
          alert(`Encara no hi ha preguntes carregades per a ${municipi}. Aquest apartat està preparat per afegir contingut.`);
          return;
        }
        // Igual que a Teoria/Cultura general: agrupem per "seccio" dins del
        // municipi (p. ex. Municipi > Cunit > Ordenança de convivència),
        // en lloc d'anar directes al test amb totes les preguntes barrejades.
        mostrarSelectorSeccions(municipi, filtrades, mostrarTemarioPL);
      });
    });

    contenedor.querySelectorAll('.pl-municipi-eliminar').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const municipi = btn.dataset.municipi;
        if (!confirm(`Eliminar «${municipi}» de la llista de municipis?\n\n(Les preguntes que ja tinguis guardades amb aquest municipi no s'esborren, només deixa de sortir a la llista.)`)) return;
        eliminarMunicipiPL(municipi);
        mostrarTemarioPL();
        const list = document.querySelector('.pl-municipis-list');
        if (list) list.style.display = 'block';
      });
    });

    const btnAfegirMunicipi = document.getElementById('pl-afegir-municipi');
    const inputNouMunicipi = document.getElementById('pl-nou-municipi');
    if (btnAfegirMunicipi && inputNouMunicipi) {
      const afegir = () => {
        const nom = inputNouMunicipi.value.trim();
        if (!nom) return;
        afegirMunicipiPL(nom);
        mostrarTemarioPL();
        const list = document.querySelector('.pl-municipis-list');
        if (list) list.style.display = 'block';
      };
      btnAfegirMunicipi.addEventListener('click', afegir);
      inputNouMunicipi.addEventListener('keydown', (e) => { if (e.key === 'Enter') afegir(); });
    }

    actualitzarBotonsRepasErrors();
    actualitzarRatxaUI();
  }

  // --- VISTA ACTUALITAT ---
  function mostrarTemarioActualitat() {
    const contenedor = document.getElementById('view-actualitat');
    if (!contenedor) return;

    contenedor.innerHTML = `
      <div class="teoria-host" style="display: flex; flex-direction: column; gap: 20px;">
        <div style="background: linear-gradient(135deg, #0f172a, #1e293b); color: white; padding: 24px; border-radius: 16px;">
          <h3 style="margin: 0 0 10px 0; font-size: 18px;">📰 Butlletí d'Actualitat i Seguretat</h3>
          <p style="margin: 0; font-size: 14px; color: #94a3b8;">Actualitzacions clau per a les proves d'oposicions.</p>
        </div>
        <div class="hub">
          <div class="startbar">
            <div class="sb-lab">
              <span class="sb-k">Si prems Barrejat faràs</span>
              <span class="sb-lab-row"><span class="sb-t"><span class="mission-copy-wide">🧠 Test d'actualitat barrejat</span></span></span>
            </div>
            <div class="sb-go">
              <button class="btn-start btn-start-act">🔀 Barrejat</button>
            </div>
          </div>
          <div class="hub-ambit2 amb-active" style="margin-top:14px;">
            <button class="amb-bar amb-bar-pl" data-act-section="repetides">
              <span class="amb-sq" style="background:#7c3aed;"></span>
              <span class="amb-name">Preguntes més repetides</span>
              <span class="amb-chev">▸</span>
            </button>
          </div>
          <div class="hub-ambit2 amb-active">
            <button class="amb-bar amb-bar-pl act-subsection" data-act-category="Politica">
              <span class="amb-sq" style="background:#1d4ed8;"></span>
              <span class="amb-name">🏛️ Política</span>
              <span class="amb-chev">▸</span>
            </button>
          </div>
          <div class="hub-ambit2 amb-active">
            <button class="amb-bar amb-bar-pl act-subsection" data-act-category="Esports">
              <span class="amb-sq" style="background:#16a34a;"></span>
              <span class="amb-name">⚽ Esports</span>
              <span class="amb-chev">▸</span>
            </button>
          </div>
          <div class="hub-ambit2 amb-active">
            <button class="amb-bar amb-bar-pl act-subsection" data-act-category="Premis">
              <span class="amb-sq" style="background:#f59e0b;"></span>
              <span class="amb-name">🏆 Premis</span>
              <span class="amb-chev">▸</span>
            </button>
          </div>
          <div class="hub-ambit2 amb-active">
            <button class="amb-bar amb-bar-pl act-subsection" data-act-category="Altres">
              <span class="amb-sq" style="background:#64748b;"></span>
              <span class="amb-name">📰 Altres</span>
              <span class="amb-chev">▸</span>
            </button>
          </div>
        </div>
      </div>
      <div id="test-container"></div>
    `;

    const btnStartAct = contenedor.querySelector('.btn-start-act');
    if (btnStartAct) {
      btnStartAct.addEventListener('click', () => mostrarSelectorPreguntas("Tots els Àmbits (Barrejat - Actualitat)", bancoActualitat, true));
    }

    contenedor.querySelectorAll('[data-act-section]').forEach(btn => {
      btn.addEventListener('click', () => {
        const section = btn.dataset.actSection;
        if (section === 'actuals') {
          const list = btn.parentElement.nextElementSibling;
          if (list) list.style.display = list.style.display === 'none' ? 'block' : 'none';
          return;
        }
        if (section === 'repetides') {
          alert('Aquest apartat queda preparat per afegir les preguntes més repetides.');
        }
      });
    });

    contenedor.querySelectorAll('.act-subsection').forEach(btn => {
      btn.style.cssText = 'display:block;width:100%;margin:5px 0;padding:9px 12px;text-align:left;border:1px solid #e2e8f0;background:#fff;border-radius:8px;cursor:pointer;font-weight:700;color:#334155;';
      btn.addEventListener('click', () => {
        const categoria = btn.dataset.actCategory;
        const filtrades = bancoActualitat.filter(q => {
          const txt = `${q.categoria || ''} ${q.seccio || ''} ${q.ambit || ''} ${q.tema || ''} ${q.subseccio || ''}`.toLowerCase();
          return txt.includes(categoria.toLowerCase());
        });
        if (!filtrades.length) {
          alert(`Encara no hi ha preguntes carregades per a «${categoria}». Aquest apartat està preparat per afegir contingut.`);
          return;
        }
        // Igual que a Mossos i Policia Local: selector de seccions per triar
        // una, vàries o totes les seccions dins d'aquesta categoria.
        mostrarSelectorSeccions(categoria, filtrades, mostrarTemarioActualitat);
      });
    });

    actualitzarBotonsRepasErrors();
  }

  // --- MUNICIPIS DE POLICIA LOCAL (afegir/eliminar des de la interfície) ---
  const MUNICIPIS_PL_KEY = 'agentmedina_municipis_pl_v1';
  const MUNICIPIS_PL_DEFECTE = ['Tàrrega', 'Cunit', 'Cubelles'];

  function carregarMunicipisPL() {
    try {
      const raw = localStorage.getItem(MUNICIPIS_PL_KEY);
      const llista = raw ? JSON.parse(raw) : null;
      return Array.isArray(llista) ? llista : [...MUNICIPIS_PL_DEFECTE];
    } catch (e) {
      console.error('Error llegint municipis PL:', e);
      return [...MUNICIPIS_PL_DEFECTE];
    }
  }
  window.carregarMunicipisPL = carregarMunicipisPL;

  function guardarMunicipisPL(llista) {
    localStorage.setItem(MUNICIPIS_PL_KEY, JSON.stringify(llista));
  }

  function afegirMunicipiPL(nom) {
    const llista = carregarMunicipisPL();
    const net = String(nom || '').trim();
    if (!net) return;
    if (llista.some(m => m.toLowerCase() === net.toLowerCase())) return;
    llista.push(net);
    guardarMunicipisPL(llista);
  }

  function eliminarMunicipiPL(nom) {
    const llista = carregarMunicipisPL().filter(m => m !== nom);
    guardarMunicipisPL(llista);
  }

  // --- GESTOR DE PREGUNTES (afegir / editar, individual i massiu) ---
  // Com que l'app encara és estàtica (sense servidor/base de dades), les
  // preguntes que es creen o editen aquí es guarden a localStorage i es
  // fusionen amb els bancs originals en carregar l'app (veure més amunt,
  // a "CARGA DE BANCOS DE DATOS"). Per fer-les permanents de debò cal
  // exportar-les (botó "Exportar JSON") i enganxar-les al fitxer .js
  // corresponent (Mossos_Preguntas.js / P.L.Preguntas.js / Actualidad_preguntas.js).
  const CUSTOM_PREGUNTES_KEY = 'agentmedina_preguntes_custom_v1';

  // --- CORRECCIONS (OVERRIDES) A PREGUNTES DEL BANC ORIGINAL ---
  // Quan s'edita, des del Gestor, una pregunta que NO és personalitzada
  // (és a dir, que ve d'un dels fitxers .js originals), no la podem
  // modificar directament (és de només lectura al navegador). En comptes
  // d'això guardem només els canvis fets, indexats per ID, i els apliquem
  // per sobre de la pregunta original cada cop que es carrega l'app.
  const OVERRIDES_PREGUNTES_KEY = 'agentmedina_overrides_preguntes_v1';

  function carregarOverridesPreguntes() {
    try {
      const raw = localStorage.getItem(OVERRIDES_PREGUNTES_KEY);
      const dades = raw ? JSON.parse(raw) : {};
      return {
        mossos: (dades.mossos && typeof dades.mossos === 'object') ? dades.mossos : {},
        pl: (dades.pl && typeof dades.pl === 'object') ? dades.pl : {},
        act: (dades.act && typeof dades.act === 'object') ? dades.act : {}
      };
    } catch (e) {
      console.error('Error llegint correccions de preguntes:', e);
      return { mossos: {}, pl: {}, act: {} };
    }
  }
  window.carregarOverridesPreguntes = carregarOverridesPreguntes;

  function guardarOverridesPreguntes(dades) {
    localStorage.setItem(OVERRIDES_PREGUNTES_KEY, JSON.stringify(dades));
  }

  function aplicarOverridesBanc(llista, overridesBanc) {
    if (!Array.isArray(llista) || !overridesBanc) return llista;
    return llista.map(q => (q && q.id && overridesBanc[q.id]) ? { ...q, ...overridesBanc[q.id] } : q);
  }

  function desarOverridePregunta(banc, preguntaNormalitzada) {
    const dades = carregarOverridesPreguntes();
    dades[banc][preguntaNormalitzada.id] = preguntaNormalitzada;
    guardarOverridesPreguntes(dades);
  }

  function eliminarOverridePregunta(banc, id) {
    const dades = carregarOverridesPreguntes();
    if (dades[banc] && dades[banc][id]) {
      delete dades[banc][id];
      guardarOverridesPreguntes(dades);
    }
  }

  // Retorna l'array (viu, en memòria) del banc de preguntes actiu.
  function obtenirBancActiu(banc) {
    if (banc === 'pl') return bancoPoliciaLocal;
    if (banc === 'act') return bancoActualitat;
    return bancoPreguntes;
  }

  function carregarPreguntesCustom() {
    try {
      const raw = localStorage.getItem(CUSTOM_PREGUNTES_KEY);
      const dades = raw ? JSON.parse(raw) : {};
      return {
        mossos: Array.isArray(dades.mossos) ? dades.mossos : [],
        pl: Array.isArray(dades.pl) ? dades.pl : [],
        act: Array.isArray(dades.act) ? dades.act : []
      };
    } catch (e) {
      console.error('Error llegint preguntes personalitzades:', e);
      return { mossos: [], pl: [], act: [] };
    }
  }
  window.carregarPreguntesCustom = carregarPreguntesCustom;

  function guardarPreguntesCustom(dades) {
    localStorage.setItem(CUSTOM_PREGUNTES_KEY, JSON.stringify(dades));
  }

  function generarIdCustom(prefix) {
    return `${prefix}_CUSTOM_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  }

  // Valida i normalitza una pregunta arribada del formulari o d'un import massiu.
  function normalitzarPreguntaEditor(q, banc) {
    if (!q || typeof q !== 'object') throw new Error('Pregunta no vàlida.');
    const pregunta = String(q.pregunta || '').trim();
    const opcions = Array.isArray(q.opcions) ? q.opcions.map(o => String(o || '').trim()) : [];
    if (!pregunta) throw new Error('Falta el text de la pregunta.');
    if (opcions.length < 2 || opcions.some(o => !o)) throw new Error(`Cal almenys 2 opcions (pregunta: "${pregunta.slice(0, 40)}...").`);
    let resposta = q.resposta;
    if (typeof resposta === 'string' && /^\d+$/.test(resposta.trim())) resposta = parseInt(resposta, 10);
    if (typeof resposta !== 'number' || resposta < 0 || resposta >= opcions.length) {
      throw new Error(`La resposta correcta no és vàlida (pregunta: "${pregunta.slice(0, 40)}...").`);
    }
    const base = {
      id: q.id || generarIdCustom(banc === 'mossos' ? 'MOSSOS' : banc === 'pl' ? 'PL' : 'ACT'),
      pregunta,
      opcions,
      resposta,
      explicacio: String(q.explicacio || '').trim()
    };
    if (banc === 'mossos') {
      base.ambit = q.ambit || 'Àmbit A';
      base.seccio = String(q.seccio || '').trim();
    } else if (banc === 'pl') {
      base.seccio = String(q.seccio || '').trim();
      base.tema = String(q.tema || '').trim();
      if (q.municipi) base.municipi = String(q.municipi).trim();
    } else if (banc === 'act') {
      base.categoria = q.categoria || 'Altres';
      base.seccio = String(q.seccio || '').trim();
    }
    return base;
  }

  function afegirPreguntesCustom(banc, preguntes) {
    const dades = carregarPreguntesCustom();
    const normalitzades = preguntes.map(q => normalitzarPreguntaEditor(q, banc));
    dades[banc] = [...dades[banc], ...normalitzades];
    guardarPreguntesCustom(dades);
    // Afegim també les preguntes noves a l'array VIU en memòria (bancoPreguntes /
    // bancoPoliciaLocal / bancoActualitat) perquè apareguin de seguida als tests,
    // sense haver de recarregar la pàgina.
    const arrayViu = obtenirBancActiu(banc);
    if (Array.isArray(arrayViu)) arrayViu.push(...normalitzades);
    return normalitzades.length;
  }

  function eliminarPreguntaCustom(banc, id) {
    const dades = carregarPreguntesCustom();
    dades[banc] = dades[banc].filter(q => q.id !== id);
    guardarPreguntesCustom(dades);
  }
  window.eliminarPreguntaCustom = function (banc, id) {
    if (!confirm('Eliminar aquesta pregunta?')) return;
    eliminarPreguntaCustom(banc, id);
    mostrarGestorPreguntes();
  };

  // Desa els canvis fets a una pregunta EXISTENT (identificada per ID).
  // Si l'ID pertany a una pregunta personalitzada, actualitza aquell
  // registre; si pertany al banc original, es desa com a "override".
  // També actualitza la còpia en memòria perquè el canvi es vegi a l'instant.
  function desarPreguntaEditada(banc, id, dadesFormulari) {
    const normalitzada = normalitzarPreguntaEditor({ ...dadesFormulari, id }, banc);
    const custom = carregarPreguntesCustom();
    const idxCustom = (custom[banc] || []).findIndex(q => q.id === id);
    if (idxCustom !== -1) {
      custom[banc][idxCustom] = normalitzada;
      guardarPreguntesCustom(custom);
    } else {
      desarOverridePregunta(banc, normalitzada);
    }
    const arrayViu = obtenirBancActiu(banc);
    const idxViu = arrayViu.findIndex(q => q && q.id === id);
    if (idxViu !== -1) arrayViu[idxViu] = { ...arrayViu[idxViu], ...normalitzada };
    return normalitzada;
  }

  // Omple el formulari d'"Afegir / editar pregunta" amb les dades d'una
  // pregunta existent i el deixa en "mode edició".
  function carregarPreguntaAFormulari(banc, q) {
    if (!q) return;
    const btnGuardar = document.getElementById('ed-guardar-una');
    if (btnGuardar) {
      btnGuardar.dataset.editId = q.id;
      btnGuardar.textContent = '💾 Guardar canvis';
    }
    const btnCancelar = document.getElementById('ed-cancelar-edicio');
    if (btnCancelar) btnCancelar.style.display = 'inline-block';
    const avis = document.getElementById('ed-avis-edicio');
    if (avis) {
      avis.style.display = 'inline-block';
      avis.textContent = `✏️ Editant: ${q.id}`;
    }

    const camp = (elId) => document.getElementById(elId);
    if (camp('ed-pregunta')) camp('ed-pregunta').value = q.pregunta || '';
    [0, 1, 2, 3].forEach(i => { if (camp(`ed-op${i}`)) camp(`ed-op${i}`).value = (q.opcions && q.opcions[i]) || ''; });
    if (camp('ed-resposta')) camp('ed-resposta').value = String(q.resposta ?? 0);
    if (camp('ed-explicacio')) camp('ed-explicacio').value = q.explicacio || '';
    if (banc === 'mossos') {
      if (camp('ed-ambit')) camp('ed-ambit').value = q.ambit || 'Àmbit A';
      if (camp('ed-seccio')) camp('ed-seccio').value = q.seccio || '';
    } else if (banc === 'pl') {
      if (camp('ed-tema')) camp('ed-tema').value = q.tema || '';
      if (camp('ed-seccio')) camp('ed-seccio').value = q.seccio || '';
      if (camp('ed-municipi')) camp('ed-municipi').value = q.municipi || '';
    } else {
      if (camp('ed-categoria')) camp('ed-categoria').value = q.categoria || 'Altres';
      if (camp('ed-seccio')) camp('ed-seccio').value = q.seccio || '';
    }
    camp('ed-pregunta')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // Permet obrir directament l'edició d'una pregunta (per ID) des de
  // qualsevol botó de la pàgina (p. ex. la llista de preguntes noves).
  window.editarPreguntaPerId = function (banc, id) {
    mostrarGestorPreguntes(banc);
    const dataset = obtenirBancActiu(banc);
    const trobada = dataset.find(q => q && String(q.id) === String(id));
    if (trobada) carregarPreguntaAFormulari(banc, trobada);
  };

  function exportarPreguntesCustom(banc) {
    const dades = carregarPreguntesCustom();
    const llista = dades[banc] || [];
    const blob = new Blob([JSON.stringify(llista, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const noms = { mossos: 'mossos_preguntes_noves', pl: 'policia_local_preguntes_noves', act: 'actualitat_preguntes_noves' };
    a.href = url;
    a.download = `${noms[banc]}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  window.exportarPreguntesCustom = exportarPreguntesCustom;

  const EDITOR_CAMPS_PER_BANC = {
    mossos: { label: 'Mossos d\'Esquadra', opcions: ['Àmbit A', 'Àmbit B', 'Àmbit C'] },
    pl: { label: 'Policia Local', opcions: null },
    act: { label: 'Actualitat', opcions: ['Politica', 'Esports', 'Premis', 'Altres'] }
  };

  function campsExtraEditor(banc) {
    if (banc === 'mossos') {
      return `
        <label class="ed-lbl">Àmbit
          <select id="ed-ambit">
            <option value="Àmbit A">Àmbit A · Coneixements de l'entorn</option>
            <option value="Àmbit B">Àmbit B · Institucional i Marc Legal</option>
            <option value="Àmbit C">Àmbit C · Seguretat i Policia</option>
          </select>
        </label>
        <label class="ed-lbl">Secció / tema <input id="ed-seccio" type="text" placeholder="p. ex. Història de Catalunya"></label>`;
    }
    if (banc === 'pl') {
      const municipis = carregarMunicipisPL();
      return `
        <label class="ed-lbl">Tema <input id="ed-tema" type="text" placeholder="p. ex. Teoria general / Municipi"></label>
        <label class="ed-lbl">Subtema / secció <input id="ed-seccio" type="text" placeholder="p. ex. Cunit, Cubelles..."></label>
        <label class="ed-lbl">Municipi (opcional)
          <select id="ed-municipi">
            <option value="">— Cap —</option>
            ${municipis.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('')}
          </select>
        </label>`;
    }
    return `
      <label class="ed-lbl">Categoria
        <select id="ed-categoria">
          <option value="Politica">🏛️ Política</option>
          <option value="Esports">⚽ Esports</option>
          <option value="Premis">🏆 Premis</option>
          <option value="Altres">📰 Altres</option>
        </select>
      </label>
      <label class="ed-lbl">Subtema / secció <input id="ed-seccio" type="text" placeholder="p. ex. Actualitat setembre 2026"></label>`;
  }

  function llegirCampsExtraEditor(banc) {
    if (banc === 'mossos') return { ambit: document.getElementById('ed-ambit')?.value, seccio: document.getElementById('ed-seccio')?.value };
    if (banc === 'pl') return { tema: document.getElementById('ed-tema')?.value, seccio: document.getElementById('ed-seccio')?.value, municipi: document.getElementById('ed-municipi')?.value };
    return { categoria: document.getElementById('ed-categoria')?.value, seccio: document.getElementById('ed-seccio')?.value };
  }

  function llistaPreguntesCustomHtml(banc) {
    const dades = carregarPreguntesCustom();
    const llista = dades[banc] || [];
    if (!llista.length) return `<p style="color:#94a3b8;font-size:.88rem;">Encara no has afegit cap pregunta nova en aquest banc.</p>`;
    return `<div style="display:flex;flex-direction:column;gap:8px;max-height:320px;overflow-y:auto;">
      ${llista.map(q => `
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
          <div style="min-width:0;">
            <div style="font-weight:700;color:#0f172a;font-size:.88rem;">${escapeHtml(q.pregunta)}</div>
            <div style="color:#94a3b8;font-size:.74rem;margin-top:2px;">${escapeHtml(q.id)}${q.seccio ? ' · ' + escapeHtml(q.seccio) : ''}</div>
          </div>
          <div style="display:flex;gap:6px;flex:none;">
            <button onclick="editarPreguntaPerId('${banc}','${q.id}')" title="Editar" style="border:none;background:#eef6ff;color:#0057a8;border-radius:8px;padding:6px 10px;font-weight:800;font-size:.76rem;cursor:pointer;">✏️</button>
            <button onclick="eliminarPreguntaCustom('${banc}','${q.id}')" title="Eliminar" style="border:none;background:#fee2e2;color:#b91c1c;border-radius:8px;padding:6px 10px;font-weight:800;font-size:.76rem;cursor:pointer;">🗑</button>
          </div>
        </div>
      `).join('')}
    </div>`;
  }

  function mostrarGestorPreguntes(bancInicial) {
    const contenedor = document.getElementById('view-editor');
    if (!contenedor) return;
    const banc = bancInicial || contenedor.dataset.bancActiu || 'mossos';
    contenedor.dataset.bancActiu = banc;

    contenedor.innerHTML = `
      <style>
        .ed-lbl{display:flex;flex-direction:column;gap:4px;font-weight:700;color:#334155;font-size:.85rem;}
        .ed-lbl input,.ed-lbl select,.ed-lbl textarea{font:inherit;font-size:16px;padding:9px 11px;border:1.5px solid #E2E8F0;border-radius:9px;}
        .ed-tabs button{border:none;background:#f1f5f9;color:#475569;padding:9px 16px;border-radius:9px;font-weight:800;cursor:pointer;font-size:.88rem;}
        .ed-tabs button.on{background:var(--blue,#002B5E);color:#fff;}
      </style>
      <div style="max-width:900px;margin:0 auto;display:flex;flex-direction:column;gap:18px;">
        <div>
          <h2 style="margin:0 0 4px;color:#0f172a;">✏️ Gestor de preguntes</h2>
          <p style="margin:0;color:#64748b;font-size:.9rem;line-height:1.5;">
            Afegeix preguntes noves (una a una o en bloc) a qualsevol banc, per tema i subtema. Les preguntes es guarden al dispositiu i ja apareixen als tests immediatament. Per fer-les permanents al fitxer de dades, exporta-les i enganxa-les al .js corresponent.
          </p>
        </div>

        <div class="ed-tabs" style="display:flex;gap:8px;flex-wrap:wrap;">
          <button data-banc="mossos" class="${banc === 'mossos' ? 'on' : ''}">🔵 Mossos</button>
          <button data-banc="pl" class="${banc === 'pl' ? 'on' : ''}">🚔 Policia Local</button>
          <button data-banc="act" class="${banc === 'act' ? 'on' : ''}">📰 Actualitat</button>
        </div>

        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:18px;">
          <h3 style="margin:0 0 6px;font-size:1rem;color:var(--blue,#002B5E);">🔎 Cercar pregunta per ID (per corregir-la)</h3>
          <p style="margin:0 0 10px;color:#64748b;font-size:.82rem;line-height:1.5;">
            Si has trobat un error en una pregunta (p. ex. <code>MOSSOS_505</code>), busca-la aquí pel seu ID i corregeix-la al formulari de sota.
          </p>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <input id="ed-cerca-id" type="text" placeholder="p. ex. MOSSOS_505" style="flex:1;min-width:180px;font-size:16px;padding:9px 11px;border:1.5px solid #E2E8F0;border-radius:9px;">
            <button id="ed-cercar-btn" style="background:var(--blue,#002B5E);color:#fff;border:none;border-radius:9px;padding:10px 18px;font-weight:800;cursor:pointer;">🔎 Cercar</button>
          </div>
          <div id="ed-cerca-resultat" style="margin-top:10px;"></div>
        </div>

        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:18px;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
            <h3 style="margin:0;font-size:1rem;color:var(--blue,#002B5E);">➕ Afegir / editar pregunta</h3>
            <span id="ed-avis-edicio" style="display:none;background:#fef9c3;color:#854d0e;font-weight:800;font-size:.78rem;padding:5px 10px;border-radius:999px;"></span>
          </div>
          <div style="display:flex;flex-direction:column;gap:10px;">
            ${campsExtraEditor(banc)}
            <label class="ed-lbl">Pregunta <textarea id="ed-pregunta" rows="2" placeholder="Text de la pregunta..."></textarea></label>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;">
              <label class="ed-lbl">Opció A <input id="ed-op0" type="text"></label>
              <label class="ed-lbl">Opció B <input id="ed-op1" type="text"></label>
              <label class="ed-lbl">Opció C <input id="ed-op2" type="text"></label>
              <label class="ed-lbl">Opció D (opcional) <input id="ed-op3" type="text"></label>
            </div>
            <label class="ed-lbl">Resposta correcta
              <select id="ed-resposta">
                <option value="0">Opció A</option>
                <option value="1">Opció B</option>
                <option value="2">Opció C</option>
                <option value="3">Opció D</option>
              </select>
            </label>
            <label class="ed-lbl">Explicació (opcional) <textarea id="ed-explicacio" rows="2" placeholder="Per què és correcta..."></textarea></label>
            <div>
              <button id="ed-guardar-una" style="background:var(--gold2,#E8C000);color:var(--blue,#002B5E);border:none;border-radius:9px;padding:11px 20px;font-weight:800;cursor:pointer;">💾 Guardar pregunta</button>
              <button id="ed-cancelar-edicio" type="button" style="display:none;background:#f1f5f9;color:#334155;border:none;border-radius:9px;padding:11px 16px;font-weight:800;cursor:pointer;margin-left:8px;">✖ Cancel·lar edició</button>
              <span id="ed-missatge" style="margin-left:10px;font-weight:700;font-size:.85rem;"></span>
            </div>
          </div>
        </div>

        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:18px;">
          <h3 style="margin:0 0 6px;font-size:1rem;color:var(--blue,#002B5E);">📥 Afegir en massa (JSON)</h3>
          <p style="margin:0 0 10px;color:#64748b;font-size:.82rem;line-height:1.5;">
            Enganxa un array JSON de preguntes amb el mateix format que el banc (camps <code>pregunta</code>, <code>opcions</code>, <code>resposta</code> —índex de l'opció correcta—, <code>explicacio</code>${banc === 'mossos' ? ', <code>ambit</code>, <code>seccio</code>' : banc === 'pl' ? ', <code>tema</code>, <code>seccio</code>' : ', <code>categoria</code>, <code>seccio</code>'}).
          </p>
          <textarea id="ed-bulk" rows="8" style="width:100%;box-sizing:border-box;font-family:monospace;font-size:.82rem;padding:10px;border:1.5px solid #E2E8F0;border-radius:9px;" placeholder='[
  { "pregunta": "...", "opcions": ["...","...","...","..."], "resposta": 0, "explicacio": "..." }
]'></textarea>
          <div style="margin-top:10px;">
            <button id="ed-guardar-bulk" style="background:#eef6ff;color:#0057a8;border:1px solid #bfdbfe;border-radius:9px;padding:10px 18px;font-weight:800;cursor:pointer;">📥 Importar totes</button>
            <span id="ed-missatge-bulk" style="margin-left:10px;font-weight:700;font-size:.85rem;"></span>
          </div>
        </div>

        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:18px;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap;">
            <h3 style="margin:0;font-size:1rem;color:var(--blue,#002B5E);">📋 Preguntes noves d'aquest banc</h3>
            <button id="ed-exportar" style="background:#f1f5f9;color:#334155;border:none;border-radius:8px;padding:8px 14px;font-weight:800;font-size:.82rem;cursor:pointer;">⬇️ Exportar JSON</button>
          </div>
          ${llistaPreguntesCustomHtml(banc)}
        </div>
      </div>
    `;

    contenedor.querySelectorAll('.ed-tabs button').forEach(btn => {
      btn.addEventListener('click', () => mostrarGestorPreguntes(btn.dataset.banc));
    });

    const msg = document.getElementById('ed-missatge');
    document.getElementById('ed-guardar-una')?.addEventListener('click', () => {
      try {
        const extra = llegirCampsExtraEditor(banc);
        const opcions = [0, 1, 2, 3].map(i => document.getElementById(`ed-op${i}`)?.value || '').filter(o => o.trim());
        const q = {
          ...extra,
          pregunta: document.getElementById('ed-pregunta')?.value || '',
          opcions,
          resposta: parseInt(document.getElementById('ed-resposta')?.value || '0', 10),
          explicacio: document.getElementById('ed-explicacio')?.value || ''
        };
        const editId = document.getElementById('ed-guardar-una')?.dataset.editId || '';
        if (editId) {
          desarPreguntaEditada(banc, editId, q);
          msg.style.color = '#15803d';
          msg.textContent = '✅ Canvis guardats.';
        } else {
          afegirPreguntesCustom(banc, [q]);
          msg.style.color = '#15803d';
          msg.textContent = '✅ Pregunta guardada.';
        }
        mostrarGestorPreguntes(banc);
      } catch (e) {
        msg.style.color = '#b91c1c';
        msg.textContent = `❌ ${e.message}`;
      }
    });

    document.getElementById('ed-cancelar-edicio')?.addEventListener('click', () => mostrarGestorPreguntes(banc));

    // --- Cercar pregunta per ID ---
    const cercaResultat = document.getElementById('ed-cerca-resultat');
    function executarCercaPerId() {
      const idBuscat = (document.getElementById('ed-cerca-id')?.value || '').trim();
      if (!cercaResultat) return;
      if (!idBuscat) { cercaResultat.innerHTML = ''; return; }
      const dataset = obtenirBancActiu(banc);
      const trobada = dataset.find(q => q && String(q.id).toLowerCase() === idBuscat.toLowerCase());
      if (!trobada) {
        cercaResultat.innerHTML = `<p style="color:#b91c1c;font-weight:700;font-size:.85rem;margin:6px 0 0;">❌ No s'ha trobat cap pregunta amb aquest ID en aquest banc.</p>`;
        return;
      }
      const custom = carregarPreguntesCustom();
      const esCustom = (custom[banc] || []).some(q => q.id === trobada.id);
      const overridesBanc = carregarOverridesPreguntes()[banc] || {};
      const teOverride = !!overridesBanc[trobada.id];
      const etiquetaOrigen = esCustom ? '🆕 pregunta personalitzada' : (teOverride ? '✏️ pregunta original (ja editada)' : '📚 pregunta del banc original');
      cercaResultat.innerHTML = `
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;">
          <div style="font-weight:700;color:#0f172a;font-size:.88rem;">${escapeHtml(trobada.pregunta)}</div>
          <div style="color:#64748b;font-size:.76rem;margin-top:4px;">${escapeHtml(trobada.id)} · ${etiquetaOrigen}</div>
          <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
            <button id="ed-editar-trobada" style="background:var(--gold2,#E8C000);color:var(--blue,#002B5E);border:none;border-radius:8px;padding:8px 14px;font-weight:800;font-size:.82rem;cursor:pointer;">✏️ Editar aquesta pregunta</button>
            ${(!esCustom && teOverride) ? `<button id="ed-restaurar-trobada" style="background:#fff;color:#b91c1c;border:1px solid #fecaca;border-radius:8px;padding:8px 14px;font-weight:800;font-size:.82rem;cursor:pointer;">↩️ Restaurar original</button>` : ''}
          </div>
        </div>`;
      document.getElementById('ed-editar-trobada')?.addEventListener('click', () => carregarPreguntaAFormulari(banc, trobada));
      document.getElementById('ed-restaurar-trobada')?.addEventListener('click', () => {
        if (!confirm("Restaurar el text original d'aquesta pregunta? Es descartaran els canvis fets.")) return;
        eliminarOverridePregunta(banc, trobada.id);
        mostrarGestorPreguntes(banc);
      });
    }
    document.getElementById('ed-cercar-btn')?.addEventListener('click', executarCercaPerId);
    document.getElementById('ed-cerca-id')?.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') { ev.preventDefault(); executarCercaPerId(); }
    });

    const msgBulk = document.getElementById('ed-missatge-bulk');
    document.getElementById('ed-guardar-bulk')?.addEventListener('click', () => {
      try {
        const text = document.getElementById('ed-bulk')?.value || '[]';
        const arr = JSON.parse(text);
        if (!Array.isArray(arr)) throw new Error('Cal enganxar un array JSON ([ {...}, {...} ]).');
        const n = afegirPreguntesCustom(banc, arr);
        msgBulk.style.color = '#15803d';
        msgBulk.textContent = `✅ ${n} preguntes importades.`;
        mostrarGestorPreguntes(banc);
      } catch (e) {
        msgBulk.style.color = '#b91c1c';
        msgBulk.textContent = `❌ ${e.message}`;
      }
    });

    document.getElementById('ed-exportar')?.addEventListener('click', () => exportarPreguntesCustom(banc));
  }
  window.mostrarGestorPreguntes = mostrarGestorPreguntes;

  // --- SELECTOR DE PREGUNTAS ---
  function mostrarSelectorPreguntas(nom, dataset, mezclar = false) {
    const nomSelector = String(nom || '');
    const fontSelector = document.body.classList.contains('sec-policia-local') ||
      nomSelector.toLowerCase().includes('policia local') ||
      nomSelector.toLowerCase().includes('municipi')
      ? 'Policia Local'
      : document.body.classList.contains('sec-actualitat') || nomSelector.toLowerCase().includes('actualitat')
        ? 'Actualitat'
        : 'Mossos';
    dataset = (dataset || []).map(q => ({ ...q, _font: q._font || fontSelector }));
    const activeView = obtenirContenidorTest() || document.querySelector('.view-content') || document.body;
    if (!activeView) return;

    // Amaguem el "Tria un tema" i els botons d'àmbit perquè no quedin visibles
    // per sobre del selector/test que estem a punt de mostrar.
    document.querySelectorAll('.hub').forEach(h => { h.style.display = 'none'; });

    activeView.innerHTML = `
      <div style="background: #ffffff; padding: 28px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); text-align: center; margin-top: 20px;">
        <h2 style="font-size: 20px; color: #0f172a; margin-bottom: 8px; font-weight: 700;">${nom}</h2>
        <p style="font-size: 15px; color: #64748b; margin-bottom: 24px;">Selecciona la quantitat de preguntes (Disponibles: ${dataset.length}):</p>
        <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;" id="selector-num-container">
          <button class="btn-num-q" data-cant="5" style="padding: 14px 24px; background: #007aff; color: white; border: none; border-radius: 12px; font-size: 17px; font-weight: 700; cursor: pointer;">5</button>
          <button class="btn-num-q" data-cant="10" style="padding: 14px 24px; background: #007aff; color: white; border: none; border-radius: 12px; font-size: 17px; font-weight: 700; cursor: pointer;">10</button>
          <button class="btn-num-q" data-cant="20" style="padding: 14px 24px; background: #007aff; color: white; border: none; border-radius: 12px; font-size: 17px; font-weight: 700; cursor: pointer;">20</button>
          <button class="btn-num-q" data-cant="30" style="padding: 14px 24px; background: #007aff; color: white; border: none; border-radius: 12px; font-size: 17px; font-weight: 700; cursor: pointer;">30</button>
        </div>
      </div>
    `;

    const contenedorBones = document.getElementById('selector-num-container');
    if (contenedorBones) {
        contenedorBones.onclick = (e) => {
            const btn = e.target.closest('.btn-num-q');
            if (!btn) return;
            
            const cantDeseada = parseInt(btn.getAttribute('data-cant'));
            let subset = [...dataset];
            
            if (mezclar) {
              barrejarArray(subset);
            }
            
            const cantFinal = Math.min(cantDeseada, subset.length);
            if (cantFinal === 0) {
              alert("No hi ha preguntes disponibles per a aquesta selecció.");
              return;
            }

            if (typeof iniciarExamen === 'function') {
              iniciarExamen(cantFinal, false, subset.slice(0, cantFinal));
            } else {
              // Fallback si iniciarExamen està definit en un altre fitxer
              mostrarPregunta(subset[0]);
            }
        };
    }
  }


  // --- SELECTOR DE SECCIONS DINS D'UN ÀMBIT ---
  function mostrarSelectorSeccions(nomAmbit, dataset, onTornar) {
    const activeView = obtenirContenidorTest() || document.querySelector('.view-content') || document.body;
    if (!activeView) return;

    // Amaguem el "Tria un tema" i els botons d'àmbit mentre es tria la secció/test.
    document.querySelectorAll('.hub').forEach(h => { h.style.display = 'none'; });

    // Agrupem les preguntes per secció, mantenint l'ordre d'aparició al banc
    const seccionsMap = new Map();
    dataset.forEach(q => {
      const sec = q.seccio || 'Sense secció';
      seccionsMap.set(sec, (seccionsMap.get(sec) || 0) + 1);
    });
    const seccions = Array.from(seccionsMap.entries()); // [ [nom, count], ... ]

    // Si només hi ha una secció (o cap dada de secció), anem directes al pas de quantitat
    if (seccions.length <= 1) {
      mostrarSelectorPreguntas(nomAmbit, dataset, false);
      return;
    }

    activeView.innerHTML = `
      <div style="background: #ffffff; padding: 24px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); margin-top: 20px; text-align: left;">
        ${onTornar ? `<button id="btn-tornar-seccions" style="background:none;border:none;color:#007aff;font-weight:700;cursor:pointer;padding:0 0 14px;font-size:14px;">← Tornar</button>` : ''}
        <h2 style="font-size: 20px; color: #0f172a; margin: 0 0 6px; font-weight: 700;">${nomAmbit}</h2>
        <p style="font-size: 14px; color: #64748b; margin-bottom: 18px;">Tria una, vàries o totes les seccions (${dataset.length} preguntes disponibles en total):</p>

        <div style="display:flex; gap:10px; margin-bottom: 14px;">
          <button id="btn-sec-totes" style="flex:1; padding:10px; background:#eef6ff; color:#007aff; border:1.5px solid #b8daff; border-radius:10px; font-weight:700; cursor:pointer; font-size:13px;">☑️ Seleccionar totes</button>
          <button id="btn-sec-cap" style="flex:1; padding:10px; background:#f8fafc; color:#64748b; border:1.5px solid #e2e8f0; border-radius:10px; font-weight:700; cursor:pointer; font-size:13px;">◻️ Desmarcar totes</button>
        </div>

        <div id="llista-seccions" style="display:flex; flex-direction:column; gap:8px; margin-bottom: 20px;">
          ${seccions.map(([nom, count]) => `
            <label style="display:flex; align-items:center; gap:10px; padding:12px 14px; background:#f8fafc; border:1.5px solid #e2e8f0; border-radius:10px; cursor:pointer; font-size:14px; color:#1e293b; font-weight:600;">
              <input type="checkbox" class="chk-seccio" data-seccio="${nom.replace(/"/g, '&quot;')}" style="width:18px;height:18px;accent-color:#007aff;flex:none;">
              <span style="flex:1;">${nom}</span>
              <span style="color:#94a3b8; font-weight:700; font-size:12px;">${count}p</span>
            </label>
          `).join('')}
        </div>

        <button id="btn-continuar-seccions" disabled style="width:100%; padding:14px; background:#cbd5e1; color:#fff; border:none; border-radius:12px; font-weight:800; font-size:15px; cursor:not-allowed;">
          Selecciona almenys una secció
        </button>
      </div>
    `;

    const checkboxes = activeView.querySelectorAll('.chk-seccio');
    const btnContinuar = document.getElementById('btn-continuar-seccions');

    function actualitzarBotoContinuar() {
      const seleccionades = Array.from(checkboxes).filter(c => c.checked);
      const totalPreguntes = seleccionades.reduce((sum, c) => sum + (seccionsMap.get(c.getAttribute('data-seccio')) || 0), 0);

      if (seleccionades.length === 0) {
        btnContinuar.disabled = true;
        btnContinuar.style.background = '#cbd5e1';
        btnContinuar.style.cursor = 'not-allowed';
        btnContinuar.textContent = 'Selecciona almenys una secció';
      } else {
        btnContinuar.disabled = false;
        btnContinuar.style.background = '#007aff';
        btnContinuar.style.cursor = 'pointer';
        btnContinuar.textContent = `Continuar amb ${seleccionades.length} secció${seleccionades.length > 1 ? 's' : ''} (${totalPreguntes} preguntes) ➔`;
      }
    }

    checkboxes.forEach(chk => chk.addEventListener('change', actualitzarBotoContinuar));

    const btnTotes = document.getElementById('btn-sec-totes');
    if (btnTotes) btnTotes.addEventListener('click', () => {
      checkboxes.forEach(c => c.checked = true);
      actualitzarBotoContinuar();
    });

    const btnCap = document.getElementById('btn-sec-cap');
    if (btnCap) btnCap.addEventListener('click', () => {
      checkboxes.forEach(c => c.checked = false);
      actualitzarBotoContinuar();
    });

    btnContinuar.addEventListener('click', () => {
      if (btnContinuar.disabled) return;
      const seleccionades = Array.from(checkboxes).filter(c => c.checked).map(c => c.getAttribute('data-seccio'));
      const preguntesFiltrades = dataset.filter(q => seleccionades.includes(q.seccio || 'Sense secció'));
      const nomTest = seleccionades.length === seccions.length
        ? `${nomAmbit} (Totes les seccions)`
        : `${nomAmbit} — ${seleccionades.join(', ')}`;
      mostrarSelectorPreguntas(nomTest, preguntesFiltrades, true);
    });

    if (onTornar) {
      const btnTornar = document.getElementById('btn-tornar-seccions');
      if (btnTornar) btnTornar.addEventListener('click', onTornar);
    }
  }

  // --- MOTOR D'EXAMENS ---
  function iniciarExamen(numPreguntes, esRepasErrors, datasetSource) {
    let indexPreguntaActual = 0;
    let preguntesActives = datasetSource;
    let encerts = 0;

    function renderitzarPas() {
      if (indexPreguntaActual >= preguntesActives.length) {
        const contenedor = obtenirContenidorTest();
        if (contenedor) {
          contenedor.innerHTML = `
            <div style="background: white; padding: 30px; border-radius: 12px; text-align: center; border: 1px solid #e2e8f0; margin-top: 20px;">
              <h2>🏆 Test Finalitzat!</h2>
              <p>Has encertat ${encerts} de ${preguntesActives.length} preguntes.</p>
              <button onclick="location.reload()" style="background: #007aff; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 700;">Tornar a l'Inici</button>
            </div>
          `;
        }
        return;
      }

      const q = preguntesActives[indexPreguntaActual];
      mostrarPregunta(q);

      window.verificarRespuesta = function(indexTriat, indexCorrecte, explicacio) {
        const feedback = document.getElementById('feedback');
        if (!feedback) return;

        const esCorrecta = (indexTriat === indexCorrecte);
        registrarRespuestaGlobal(q.id, esCorrecta, q);

        if (esCorrecta) {
          encerts++;
          eliminarPreguntaAcertada(q.id);
          feedback.innerHTML = `
            <div style="background: #d1fae5; border: 1px solid #6ee7b7; padding: 15px; border-radius: 8px; color: #065f46; margin-bottom: 15px;">
              <p style="margin: 0 0 5px 0; font-weight: 700;">✅ Correcte!</p>
              <p style="margin: 0; font-size: 13px;">${explicacio}</p>
            </div>
            <button id="btn-seguent-pregunta" style="background: #007aff; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 700; cursor: pointer;">Següent Pregunta ➔</button>
          `;
        } else {
          guardarPreguntaFallada(q);
          feedback.innerHTML = `
            <div style="background: #fee2e2; border: 1px solid #fca5a5; padding: 15px; border-radius: 8px; color: #991b1b; margin-bottom: 15px;">
              <p style="margin: 0 0 5px 0; font-weight: 700;">❌ Incorrecte.</p>
              <p style="margin: 0; font-size: 13px;">${explicacio}</p>
            </div>
            <button id="btn-seguent-pregunta" style="background: #007aff; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 700; cursor: pointer;">Següent Pregunta ➔</button>
          `;
        }

        const btnSeguent = document.getElementById('btn-seguent-pregunta');
        if (btnSeguent) {
          btnSeguent.onclick = () => {
            indexPreguntaActual++;
            renderitzarPas();
          };
        }
      };
    }

    renderitzarPas();
  }
// ==========================================
// EXAMEN OFICIAL MOSSOS — 30 PREGUNTES / 30 MIN
// ==========================================
function iniciarExamenOficial(mode = 'estudi') {
    const dades = Array.isArray(window.bancoPreguntes) && window.bancoPreguntes.length
      ? window.bancoPreguntes.flat(Infinity)
      : (Array.isArray(bancoPreguntes) ? bancoPreguntes.flat(Infinity) : []);

    // L'Examen Oficial utilitza exclusivament preguntes dels Àmbits A, B i C.
    const disponibles = dades.filter(q => q && q.id && q.pregunta && Array.isArray(q.opcions) && q.opcions.length >= 2);
    if (disponibles.length < 30) {
      alert(`No hi ha 30 preguntes disponibles per fer l'Examen Oficial. Actualment n'hi ha ${disponibles.length}.`);
      return;
    }

    const preguntes = [...disponibles];
    barrejarArray(preguntes);
    const examen = preguntes.slice(0, 30);
    const esEstudi = mode === 'estudi';
    const duradaMs = 30 * 60 * 1000;
    let index = 0;
    let encerts = 0;
    let errors = 0;
    let blancs = 0;
    let respostaDonada = false;
    let temporitzador = null;
    let tempsRestant = duradaMs;
    let inici = Date.now();
    // Un únic rellotge global: evita que timers d'un examen anterior continuïn corrent.
    if (window._agentMedinaTimer) { clearInterval(window._agentMedinaTimer); window._agentMedinaTimer = null; }

    const respostes = [];

    window.ultimTestPreguntes = [...examen];
    activeTestContainerId = 'test-container';

    function contenidor() { return obtenirContenidorTest(); }

    function acabarExamen(perTemps = false) {
      if (temporitzador) { clearInterval(temporitzador); temporitzador = null; }
      if (window._agentMedinaTimer) { clearInterval(window._agentMedinaTimer); window._agentMedinaTimer = null; }
      index = examen.length;

      // Recalculem els blancs a partir del total, tant si s'acaba pel temps, per haver
      // respost totes les preguntes, com si l'usuari decideix finalitzar l'examen a mitges
      // (botó "Finalitzar ara"). Així sempre queden correctament comptades totes les
      // preguntes que s'han quedat sense contestar.
      blancs = Math.max(0, examen.length - encerts - errors);

      const c = contenidor();
      if (!c) return;
      const puntuacioBruta = encerts - (errors * 0.25);
      const nota = Math.max(0, Math.round((puntuacioBruta / 3) * 100) / 100);
      const percent = Math.round((encerts / 30) * 100);
      c.innerHTML = `
        <div style="background:white;padding:30px;border-radius:16px;border:1px solid #e2e8f0;text-align:center;margin-top:20px;">
          <div style="font-size:42px;">${perTemps ? '⏰' : '🏁'}</div>
          <h2 style="color:#0f172a;margin:10px 0;">${perTemps ? 'Temps esgotat!' : 'Examen finalitzat'}</h2>
          <p style="color:#64748b;">${esEstudi ? 'Mode Estudi' : 'Mode Examen'} · 30 preguntes</p>
          <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:20px 0;">
            <div style="padding:14px 20px;background:#ecfdf5;border-radius:12px;"><b style="font-size:24px;color:#15803d;">${encerts}</b><br>Encerts</div>
            <div style="padding:14px 20px;background:#fef2f2;border-radius:12px;"><b style="font-size:24px;color:#b91c1c;">${errors}</b><br>Errors</div>
            <div style="padding:14px 20px;background:#f8fafc;border-radius:12px;"><b style="font-size:24px;color:#475569;">${blancs}</b><br>En blanc</div>
          </div>
          <p style="font-size:28px;font-weight:800;color:#007aff;margin:15px 0;">Nota: ${nota} / 10</p>
          <p style="color:#64748b;font-size:13px;">Aquesta simulació aplica +1 per encert, −0,25 per error i 0 per blanc.</p>
          <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:20px;">
            <button id="btn-repas-oficial" style="background:#16a34a;color:white;border:none;padding:12px 20px;border-radius:8px;font-weight:700;cursor:pointer;">📚 Repasar les 30 preguntes</button>
            <button id="btn-inici-oficial" style="background:#007aff;color:white;border:none;padding:12px 20px;border-radius:8px;font-weight:700;cursor:pointer;">🏠 Tornar a Inici</button>
          </div>
        </div>`;
      document.getElementById('btn-repas-oficial')?.addEventListener('click', iniciarRepasUltimTest);
      document.getElementById('btn-inici-oficial')?.addEventListener('click', tornarAInici);
    }

    function actualitzarRellotge() {
      const ara = Date.now();
      tempsRestant = Math.max(0, duradaMs - (ara - inici));
      const el = document.getElementById('rellotge-examen-oficial');
      if (el) {
        const totalSec = Math.ceil(tempsRestant / 1000);
        const min = Math.floor(totalSec / 60);
        const sec = totalSec % 60;
        el.textContent = `⏱️ ${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
        el.style.color = totalSec <= 300 ? '#dc2626' : '#0f172a';
      }
      if (tempsRestant <= 0) acabarExamen(true);
    }

    function render() {
      if (index >= examen.length) { acabarExamen(false); return; }
      respostaDonada = false;
      const q = examen[index];
      const correcte = q.opcions[q.resposta];
      const opcions = [...q.opcions];
      barrejarArray(opcions);
      const idxCorrecte = opcions.indexOf(correcte);
      const c = contenidor();
      if (!c) return;
      c.innerHTML = `
        <div style="background:white;padding:20px 25px;border-radius:16px;border:1px solid #e2e8f0;margin-top:15px;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:15px;margin-bottom:12px;">
            <span style="font-size:13px;color:#64748b;font-weight:700;">Pregunta ${index+1} de 30</span>
            <span id="rellotge-examen-oficial" style="font-size:18px;font-weight:800;">⏱️ 30:00</span>
          </div>
          <div style="height:7px;background:#e2e8f0;border-radius:99px;overflow:hidden;margin-bottom:20px;"><div style="width:${((index)/30)*100}%;height:100%;background:#007aff;"></div></div>
          <div style="display:flex;justify-content:flex-end;margin-bottom:6px;">${etiquetaIdPreguntaHtml(q)}</div>
          <h3 style="margin:0;color:#0f172a;font-size:17px;line-height:1.45;">${q.pregunta}</h3>
          <div id="llista-opcions-oficial" style="display:flex;flex-direction:column;gap:10px;margin-top:18px;"></div>
          <div id="feedback-oficial" style="margin-top:15px;"></div>
          <button id="btn-finalitzar-ara-oficial" style="margin-top:18px;width:100%;background:#fff;color:#b91c1c;border:1.5px solid #fecaca;padding:11px 18px;border-radius:8px;font-weight:700;cursor:pointer;">🏁 Finalitzar ara (${encerts + errors} de 30 contestades)</button>
        </div>`;
      c.querySelector('#btn-finalitzar-ara-oficial').onclick = () => {
        if (confirm('Segur que vols finalitzar l\'examen ara? Les preguntes que et quedin sense contestar comptaran com a blanc.')) {
          acabarExamen(false);
        }
      };
      const lista = c.querySelector('#llista-opcions-oficial');
      opcions.forEach((opcio, i) => {
        const b = document.createElement('button');
        b.textContent = opcio;
        b.style.cssText = 'padding:13px 15px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:9px;text-align:left;cursor:pointer;font-size:14px;color:#1e293b;';
        b.onclick = () => {
          if (respostaDonada) return;
          respostaDonada = true;
          lista.querySelectorAll('button').forEach(x => x.style.pointerEvents='none');
          const esCorrecte = i === idxCorrecte;
          if (esCorrecte) encerts++; else errors++;
          respostes[index] = esCorrecte ? q.resposta : null;
          registrarRespuestaGlobal(q.id, esCorrecte, q);
          if (esCorrecte) eliminarPreguntaAcertada(q.id); else guardarPreguntaFallada(q);

          if (esEstudi) {
            b.style.background = esCorrecte ? '#d1fae5' : '#fee2e2';
            b.style.borderColor = esCorrecte ? '#10b981' : '#ef4444';
            if (!esCorrecte) lista.querySelectorAll('button').forEach((x,j)=>{ if(j===idxCorrecte){x.style.background='#d1fae5';x.style.borderColor='#10b981';} });
          } else {
            b.style.background = '#e0f2fe';
            b.style.borderColor = '#0284c7';
          }
          const fb = c.querySelector('#feedback-oficial');
          if (esEstudi) fb.innerHTML = `<div style="padding:14px;border-radius:10px;background:${esCorrecte?'#d1fae5':'#fee2e2'};color:${esCorrecte?'#065f46':'#991b1b'};"><b>${esCorrecte?'✅ Correcte':'❌ Incorrecte'}</b>${q.explicacio?`<div style="margin-top:5px;font-size:13px;">${q.explicacio}</div>`:''}</div>`;
          fb.innerHTML += `<button id="btn-next-oficial" style="margin-top:12px;width:100%;background:#007aff;color:white;border:none;padding:12px 20px;border-radius:8px;font-weight:700;cursor:pointer;">${index===29?'Finalitzar examen':'Següent pregunta ➔'}</button>`;
          document.getElementById('btn-next-oficial').onclick = () => { index++; render(); };
        };
        lista.appendChild(b);
      });
      actualitzarRellotge();
    }

    // Cronòmetre únic per als dos modes; el temps màxim és sempre 30 minuts.
    inici = Date.now();
    // Actualització cada segon; el temps real sempre es calcula amb Date.now().
    temporitzador = setInterval(actualitzarRellotge, 1000);
    window._agentMedinaTimer = temporitzador;
    render();
}

// ==========================================
// CONTROLADOR DEL TEST (INICIAR EXAMEN)
// ==========================================
function iniciarExamen(quantitatDeseada = 10, esRepasErrors = false, datasetPersonalitzat = null) {
    if (esRepasErrors) {
      const font = datasetPersonalitzat?.[0]?._font || detectarFontPregunta(datasetPersonalitzat?.[0]) || 'Mossos';
      iniciarRepasErrors(font);
      return;
    }

    let dataset = datasetPersonalitzat && datasetPersonalitzat.length > 0
      ? [...datasetPersonalitzat]
      : [...(window.bancoPreguntes || bancoPreguntes || [])];

    if (dataset.length === 0) {
      alert("No hi ha preguntes disponibles.");
      return;
    }

    barrejarArray(dataset);
    const preguntesTest = dataset.slice(0, Math.min(quantitatDeseada, dataset.length));
    window.ultimTestPreguntes = [...preguntesTest];
    activeTestContainerId = 'test-container';

    let indexActual = 0;
    let encerts = 0;
    let fallades = 0;

    function renderitzarPreguntaActual() {
      if (indexActual >= preguntesTest.length) {
        const contenedor = obtenirContenidorTest();
        if (contenedor) {
          const valorPerPregunta = 10 / preguntesTest.length;
          const penalitzacio = valorPerPregunta / 4;
          let notaFinal = (encerts * valorPerPregunta) - (fallades * penalitzacio);
          if (notaFinal < 0) notaFinal = 0;
          notaFinal = Math.round(notaFinal * 100) / 100;
          const esApte = notaFinal >= 6.0;

          contenedor.innerHTML = `
            <div style="background:white;padding:30px;border-radius:16px;border:1px solid #e2e8f0;text-align:center;margin-top:20px;">
              <h2 style="color:#0f172a;">🏆 Test Finalitzat!</h2>
              <p style="font-size:16px;margin:15px 0;color:#334155;">Encerts: <b>${encerts}</b> | Fallades: <b>${fallades}</b></p>
              <p style="font-size:24px;font-weight:800;color:#007aff;margin:15px 0;">Nota Final: ${notaFinal} / 10</p>
              <div style="padding:15px;border-radius:8px;background:${esApte ? '#d1fae5' : '#fee2e2'};color:${esApte ? '#065f46' : '#991b1b'};font-weight:bold;margin-bottom:20px;">
                ${esApte ? '✅ APTE (Objectiu 6 superat!)' : '❌ NO APTE (Cal seguir practicant)'}
              </div>
              <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:10px;"><button id="btn-repas-test-finalitzat" style="background:#16a34a;color:white;border:none;padding:12px 20px;border-radius:8px;font-weight:700;cursor:pointer;">📚 Repasar totes les preguntes</button><button id="btn-tornar-inici-finalitzat" style="background:#007aff;color:white;border:none;padding:12px 20px;border-radius:8px;font-weight:700;cursor:pointer;">🏠 Tornar a Inici</button></div>
            </div>`;
          document.getElementById('btn-repas-test-finalitzat')?.addEventListener('click', iniciarRepasUltimTest);
          document.getElementById('btn-tornar-inici-finalitzat')?.addEventListener('click', tornarAInici);
        }
        return;
      }

      const preguntaActual = preguntesTest[indexActual];

      mostrarPreguntaAmbSeguent(preguntaActual, indexActual, preguntesTest.length, (esCorrecte) => {
        if (esCorrecte) encerts++;
        else fallades++;
        indexActual++;
        renderitzarPreguntaActual();
        requestAnimationFrame(() => {
          const nouTest = obtenirContenidorTest();
          if (nouTest) {
            const y = Math.max(0, nouTest.getBoundingClientRect().top + window.scrollY - 20);
            window.scrollTo({ top: y, behavior: 'smooth' });
          }
        });
      });
    }

    renderitzarPreguntaActual();
}

// Funció auxiliar per mostrar la pregunta amb el botó "Següent"
function iniciarRepasUltimTest() {
  const preguntes = Array.isArray(window.ultimTestPreguntes) ? window.ultimTestPreguntes : [];
  if (!preguntes.length) { alert('No hi ha cap test recent per repassar.'); return; }
  activeTestContainerId = 'test-container';
  const contenedor = obtenirContenidorTest();
  if (!contenedor) return;
  let index = 0;
  function render() {
    if (index >= preguntes.length) {
      contenedor.innerHTML = `<div style="background:white;padding:30px;border-radius:16px;border:1px solid #e2e8f0;text-align:center;margin-top:20px;"><h2>📚 Repàs del test completat</h2><p>Has repassat les <b>${preguntes.length}</b> preguntes de l'últim test.</p><button id="btn-tornar-inici-repas-test" style="background:#007aff;color:white;border:none;padding:12px 24px;border-radius:8px;font-weight:700;cursor:pointer;">🏠 Tornar a Inici</button></div>`;
      document.getElementById('btn-tornar-inici-repas-test')?.addEventListener('click', tornarAInici);
      return;
    }
    const q = preguntes[index];
    const respostaCorrecta = q.opcions?.[q.resposta] ?? q.resposta ?? '';
    contenedor.innerHTML = `<div style="background:white;padding:25px;border-radius:16px;border:1px solid #e2e8f0;margin-top:20px;"><div style="font-size:12px;color:#64748b;font-weight:700;margin-bottom:8px;">Repàs ${index+1} de ${preguntes.length}</div><h3 style="margin:0 0 18px;color:#0f172a;font-size:17px;">${q.pregunta || ''}</h3><div style="display:flex;flex-direction:column;gap:9px;">${(q.opcions||[]).map((op,i)=>`<div style="padding:12px 14px;border-radius:9px;border:1px solid ${i===q.resposta?'#86efac':'#cbd5e1'};background:${i===q.resposta?'#dcfce7':'#f8fafc'};color:${i===q.resposta?'#166534':'#334155'};font-weight:${i===q.resposta?'800':'500'};">${String.fromCharCode(65+i)}. ${op}${i===q.resposta?' ✅':''}</div>`).join('')}</div><div style="margin-top:16px;background:#eff6ff;border:1px solid #bfdbfe;padding:14px;border-radius:10px;color:#1e3a8a;"><b>Resposta correcta:</b> ${respostaCorrecta}${q.explicacio?`<div style="margin-top:7px;font-size:13px;">${q.explicacio}</div>`:''}</div><button id="btn-seguent-repas-test" style="width:100%;margin-top:16px;background:#007aff;color:white;border:none;padding:12px 20px;border-radius:8px;font-weight:700;cursor:pointer;">${index+1===preguntes.length?'Finalitzar repàs ✓':'Següent pregunta ➔'}</button></div>`;
    document.getElementById('btn-seguent-repas-test')?.addEventListener('click',()=>{
      index++;
      render();
      requestAnimationFrame(() => {
        const y = Math.max(0, contenedor.getBoundingClientRect().top + window.scrollY - 20);
        window.scrollTo({ top: y, behavior: 'smooth' });
      });
    });
  }
  render();
}

function mostrarPreguntaAmbSeguent(preguntaObj, indexActual, totalPreguntes, onSeguent) {
    const respostaCorrectaText = preguntaObj.opcions[preguntaObj.resposta];
    let opcionsBarrejades = [...preguntaObj.opcions];
    barrejarArray(opcionsBarrejades);
    
    const nouIndexCorrecte = opcionsBarrejades.indexOf(respostaCorrectaText);
    
    const contenedor = obtenirContenidorTest();
    if (!contenedor) return;

    contenedor.innerHTML = `
        <div class="pregunta-box" style="background: white; padding: 25px; border-radius: 16px; border: 1px solid #e2e8f0; margin-top: 15px; max-height: 75vh; overflow-y: auto; box-sizing: border-box;">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:8px;">
                <div style="font-size: 12px; color: #64748b; font-weight: 700;">Pregunta ${indexActual + 1} de ${totalPreguntes}</div>
                ${etiquetaIdPreguntaHtml(preguntaObj)}
            </div>
            <h3 style="margin-top: 0; color: #0f172a; font-size: 16px;">${preguntaObj.pregunta}</h3>
            <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 15px;" id="llista-opcions"></div>
        </div>
        <div id="feedback" style="margin-top: 15px; padding-bottom: 80px;"></div>
    `;

    const llistaOpcions = contenedor.querySelector('#llista-opcions');
    
    opcionsBarrejades.forEach((opcio, index) => {
        const btn = document.createElement('button');
        btn.style.cssText = "padding: 12px 15px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; text-align: left; cursor: pointer; font-size: 14px; font-weight: 500; color: #1e293b;";
        btn.textContent = opcio;
        
        btn.addEventListener('click', () => {
            const scrollAbans = window.scrollY;
            llistaOpcions.querySelectorAll('button').forEach(b => b.style.pointerEvents = 'none');
            
            const feedback = document.getElementById('feedback');
            const esCorrecte = (index === nouIndexCorrecte);
            
            if (preguntaObj.id) {
                const fontPregunta = (typeof detectarFontPregunta === 'function' ? detectarFontPregunta(preguntaObj) : '') || 'Mossos';
                registrarRespuestaGlobal(preguntaObj.id, esCorrecte, preguntaObj);
                if (esCorrecte) eliminarPreguntaAcertada(preguntaObj.id, fontPregunta);
                else guardarPreguntaFallada(preguntaObj);
            }

            if (esCorrecte) {
                btn.style.background = '#d1fae5';
                btn.style.borderColor = '#10b981';
                btn.style.color = '#065f46';
            } else {
                btn.style.background = '#fee2e2';
                btn.style.borderColor = '#ef4444';
                btn.style.color = '#991b1b';
                llistaOpcions.querySelectorAll('button').forEach((b, idx) => {
                    if (idx === nouIndexCorrecte) {
                        b.style.background = '#d1fae5';
                        b.style.borderColor = '#10b981';
                    }
                });
            }

            feedback.innerHTML = `
                <div style="background: ${esCorrecte ? '#d1fae5' : '#fee2e2'}; border: 1px solid ${esCorrecte ? '#6ee7b7' : '#fca5a5'}; padding: 15px; border-radius: 12px; color: ${esCorrecte ? '#065f46' : '#991b1b'}; margin-bottom: 15px;">
                    <p style="margin: 0 0 5px 0; font-weight: 700;">${esCorrecte ? '✅ Correcte!' : '❌ Incorrecte.'}</p>
                    <p style="margin: 0; font-size: 13px;">${preguntaObj.explicacio || ''}</p>
                </div>
                <button id="btn-seguent-pregunta" style="background: #007aff; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-weight: 700; cursor: pointer; width: 100%;">Següent pregunta ➔</button>
            `;

            // No facis saltar la pàgina després de respondre.
            requestAnimationFrame(() => window.scrollTo({ top: scrollAbans, behavior: 'auto' }));

            document.getElementById('btn-seguent-pregunta').addEventListener('click', () => {
                onSeguent(esCorrecte);
            });
        });
        llistaOpcions.appendChild(btn);
    });
}
// ==========================================
// CORRECCIÓ DEL FILTRE D'ÀMBITS (Àmbit A, B, C)
// ==========================================

// Actualització de la funció que gestiona els clics als àmbits de Mossos
document.addEventListener('DOMContentLoaded', () => {
  const contenedorMossos = document.getElementById('view-mossos');
  if (!contenedorMossos) return;

  // Sobrescrivim l'esdeveniment dels botons d'àmbit de Mossos per filtrar correctament
  const ambitsMossos = contenedorMossos.querySelectorAll('.amb-bar-mossos');
  ambitsMossos.forEach(ambit => {
    // Eliminem possibles esdeveniments anteriors clonant el node o assignant directament
    const nouAmbit = ambit.cloneNode(true);
    ambit.parentNode.replaceChild(nouAmbit, ambit);

    nouAmbit.addEventListener('click', () => {
      const nomAmbit = nouAmbit.querySelector('.amb-name')?.innerText.trim() || "";
      const dades = window.bancoPreguntes && window.bancoPreguntes.length > 0 ? window.bancoPreguntes : bancoPreguntes;
      
      // Filtrem les preguntes segons l'àmbit seleccionat (Àmbit A, Àmbit B o Àmbit C)
      let preguntesFiltrades = dades;
      
      if (nomAmbit.includes("Àmbit A")) {
        preguntesFiltrades = dades.filter(q => q.ambit === "Àmbit A" || (q.tema && q.tema.startsWith("A")));
      } else if (nomAmbit.includes("Àmbit B")) {
        preguntesFiltrades = dades.filter(q => q.ambit === "Àmbit B" || (q.tema && q.tema.startsWith("B")));
      } else if (nomAmbit.includes("Àmbit C")) {
        preguntesFiltrades = dades.filter(q => q.ambit === "Àmbit C" || (q.tema && q.tema.startsWith("C")));
      }

      // Si no hi ha preguntes amb aquesta etiqueta exacta, avisem en lloc de mostrar dades incorrectes
      if (preguntesFiltrades.length === 0) {
        alert(`Encara no hi ha preguntes carregades per a "${nomAmbit}". Aquest àmbit estarà disponible properament.`);
        return;
      }

      // Crida al selector de seccions amb les preguntes ja filtrades per àmbit
      mostrarSelectorSeccions(nomAmbit, preguntesFiltrades, mostrarTemarioMossos);
    });
  });
});
    });

// ==========================================
// 5. EXPORTAR / IMPORTAR PROGRÉS (portabilitat entre dispositius)
// ==========================================
// Es guarda TOT el que hi ha a localStorage (estadístiques, errors, ratxa,
// convocatòries, notes...) en un únic fitxer JSON. Així es pot descarregar
// des de l'ordinador i importar-lo al mòbil (o a l'inrevés) sense servidor.

function exportarProgresJSON() {
  try {
    const dades = {};
    for (let i = 0; i < localStorage.length; i++) {
      const clau = localStorage.key(i);
      dades[clau] = localStorage.getItem(clau);
    }

    const payload = {
      app: 'agent-medina',
      versio: 1,
      exportatEl: new Date().toISOString(),
      dades
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const enllac = document.createElement('a');
    const dataFitxer = new Date().toISOString().slice(0, 10);
    enllac.href = url;
    enllac.download = `agent-medina-progres-${dataFitxer}.json`;
    document.body.appendChild(enllac);
    enllac.click();
    enllac.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);

    const btn = document.getElementById('btn-exportar-progres');
    if (btn) {
      const original = btn.textContent;
      btn.textContent = '✅ Fitxer descarregat!';
      setTimeout(() => { btn.textContent = original; }, 2200);
    }
    return true;
  } catch (e) {
    alert('❌ No s\'ha pogut exportar el progrés: ' + e.message);
    return false;
  }
}
window.exportarProgresJSON = exportarProgresJSON;

function importarProgresJSON(fitxer) {
  if (!fitxer) return;
  const lector = new FileReader();

  lector.onload = (ev) => {
    try {
      const payload = JSON.parse(ev.target.result);
      // Tolerant tant al format nou {app, dades:{...}} com a un bolcat "en cru" de localStorage.
      const dades = (payload && typeof payload === 'object' && payload.dades) ? payload.dades : payload;

      if (!dades || typeof dades !== 'object' || Array.isArray(dades)) {
        throw new Error('El fitxer no té el format esperat d\'una còpia de seguretat d\'Agent Medina.');
      }

      const numClaus = Object.keys(dades).length;
      if (!numClaus) throw new Error('El fitxer no conté cap dada per importar.');

      const missatge = `Vols importar aquesta còpia de seguretat?\n\n` +
        `Es sobreescriurà el progrés d'aquest dispositiu (errors, ratxa, estadístiques, convocatòries...) ` +
        `amb el contingut del fitxer (${numClaus} claus).\n\nAquesta acció no es pot desfer.`;
      if (!confirm(missatge)) return;

      Object.keys(dades).forEach(clau => {
        try {
          const valor = dades[clau];
          localStorage.setItem(clau, typeof valor === 'string' ? valor : JSON.stringify(valor));
        } catch (e) { /* clau individual corrupta: la ignorem i seguim amb la resta */ }
      });

      alert('✅ Progrés importat correctament. Es recarregarà la pàgina per aplicar els canvis.');
      window.location.reload();
    } catch (e) {
      alert('❌ El fitxer seleccionat no és una còpia de seguretat vàlida d\'Agent Medina.\n\n' + e.message);
    }
  };

  lector.onerror = () => alert('❌ No s\'ha pogut llegir el fitxer seleccionat.');
  lector.readAsText(fitxer);
}
window.importarProgresJSON = importarProgresJSON;

function gestionarSeleccioFitxerImport(input) {
  const fitxer = input?.files?.[0];
  if (fitxer) importarProgresJSON(fitxer);
  if (input) input.value = '';
}
window.gestionarSeleccioFitxerImport = gestionarSeleccioFitxerImport;

// ==========================================
// 6. DRECERES DE TECLAT (ordinador): 1-4 / A-D per respondre, Enter per continuar
// ==========================================
(function configurarDreceresTeclat() {
  const IDS_CONTENIDOR_OPCIONS = ['llista-opcions', 'rep-errors-options'];
  const IDS_BOTO_SEGUENT = [
    'btn-seguent-pregunta',
    'btn-seguent-repas-test',
    'rep-errors-next',
    'btn-tornar-inici-repas-test',
    'rep-errors-home'
  ];

  function esVisible(el) {
    return !!el && el.offsetParent !== null;
  }

  function trobarContenidorOpcions() {
    for (const id of IDS_CONTENIDOR_OPCIONS) {
      const el = document.getElementById(id);
      if (esVisible(el)) return el;
    }
    return null;
  }

  function trobarBotoSeguent() {
    for (const id of IDS_BOTO_SEGUENT) {
      const el = document.getElementById(id);
      if (esVisible(el) && !el.disabled) return el;
    }
    return null;
  }

  document.addEventListener('keydown', (e) => {
    const actiu = document.activeElement;
    const tag = (actiu && actiu.tagName || '').toLowerCase();
    // No interferim si l'usuari està escrivint en un camp de text/cerca.
    if (tag === 'input' || tag === 'textarea' || actiu?.isContentEditable) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const mapaLletres = { a: 0, b: 1, c: 2, d: 3 };
    let idx = null;
    if (e.key >= '1' && e.key <= '4') idx = Number(e.key) - 1;
    else if (Object.prototype.hasOwnProperty.call(mapaLletres, e.key.toLowerCase())) idx = mapaLletres[e.key.toLowerCase()];

    if (idx !== null) {
      const contenidor = trobarContenidorOpcions();
      if (contenidor) {
        const botons = Array.from(contenidor.querySelectorAll('button')).filter(b => !b.disabled && b.style.pointerEvents !== 'none');
        if (botons[idx]) {
          e.preventDefault();
          botons[idx].click();
        }
      }
      return;
    }

    if (e.key === 'Enter') {
      const boto = trobarBotoSeguent();
      if (boto) {
        e.preventDefault();
        boto.click();
      }
    }
  });
})();

// ==========================================
// 7. PWA: registre del Service Worker + botó d'instal·lació
// ==========================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* PWA opcional: si falla, l'app segueix funcionant normal */ });
  });
}

let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  window.deferredInstallPromptDisponible = true;
  const btn = document.getElementById('btn-instalar-app');
  if (btn) btn.style.display = 'inline-flex';
});

function instalarAppPWA() {
  if (!deferredInstallPrompt) {
    alert('La instal·lació ja està feta o el teu navegador no la permet des d\'aquí. Al mòbil Android, prova el menú del navegador → "Afegir a la pantalla d\'inici".');
    return;
  }
  deferredInstallPrompt.prompt();
  deferredInstallPrompt.userChoice.finally(() => {
    deferredInstallPrompt = null;
    window.deferredInstallPromptDisponible = false;
    const btn = document.getElementById('btn-instalar-app');
    if (btn) btn.style.display = 'none';
  });
}
window.instalarAppPWA = instalarAppPWA;

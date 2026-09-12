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

// Constants globals de claus de persistència i configuració (inicialitzades a l'inici per evitar errors de TDZ)
const CUSTOM_PREGUNTES_KEY = 'agentmedina_preguntes_custom_v1';
const OVERRIDES_PREGUNTES_KEY = 'agentmedina_overrides_preguntes_v1';
const CONVOCATORIES_KEY = 'agentmedina_convocatories_v2';
const CONVOCATORIES_OLD_KEYS = ['agentmedina_convocatories_v1'];
const convocatoriesPerDefecte = [
  { id: 'mossos-46-26', nom: 'Mossos (Convocatòria 46-26)', url: 'https://mossos.gencat.cat/ca/els_mossos_desquadra/acces_al_cos/Mosso_a/mosso-a-convocatoria-46-26/', color: '#007aff' },
  { id: 'pl-mollerussa', nom: 'Policia Local (Mollerussa)', url: 'https://mollerussa.convoca.online/processDetail.html?id=190266bf-4c8b-49eb-4520-08de7dbdb6c7&type=0', color: '#28a745' }
];

// Funció global d'escapament HTML per evitar atacs XSS i ReferenceError
function escapeHtml(valor) {
  return String(valor ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}
window.escapeHtml = escapeHtml;

function establirClasseSeccio(tabName) {
  const isDark = (localStorage.getItem('agentmedina_theme') === 'dark');
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  document.documentElement.classList.toggle('theme-dark', isDark);
  if (document.body) {
    document.body.className = `sec-${tabName}${isDark ? ' theme-dark' : ''}`;
  }
}
window.establirClasseSeccio = establirClasseSeccio;

// Modal de confirmació elegant i 100% compatible amb iFrame (sense window.confirm nadiu)
function modalConfirmacio({ titol, missatge, textBoto = 'Confirmar', textCancel = 'Cancel·lar', esPerillos = true, onAcceptar }) {
  const antic = document.getElementById('modal-confirmacio-generic');
  if (antic) antic.remove();

  const modal = document.createElement('div');
  modal.id = 'modal-confirmacio-generic';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.65);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;z-index:99999;padding:20px;';
  modal.innerHTML = `
    <div style="background:var(--bg-card,#ffffff);border:1.5px solid var(--border-card,#e2e8f0);border-radius:18px;max-width:440px;width:100%;padding:24px 26px;box-shadow:0 16px 40px rgba(0,0,0,.3);color:var(--text-main,#0f172a);animation:modalEntrada .15s ease-out;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
        <div style="width:40px;height:40px;border-radius:10px;background:${esPerillos ? 'rgba(239,68,68,0.12)' : 'rgba(37,99,235,0.12)'};color:${esPerillos ? '#ef4444' : '#2563eb'};display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">
          ${esPerillos ? '⚠️' : 'ℹ️'}
        </div>
        <h3 style="margin:0;font-size:17.5px;font-weight:900;color:var(--text-main,#0f172a);">${escapeHtml(titol || 'Confirmació')}</h3>
      </div>
      <p style="margin:0 0 22px;font-size:13.5px;color:var(--text-muted,#64748b);line-height:1.55;">${escapeHtml(missatge)}</p>
      <div style="display:flex;gap:10px;justify-content:flex-end;">
        <button type="button" id="modal-conf-cancel" style="padding:10px 16px;border-radius:10px;border:1.5px solid var(--border-card,#cbd5e1);background:var(--bg-card-subtle,#f8fafc);font-weight:700;font-size:13.5px;cursor:pointer;color:var(--text-main,#334155);">${escapeHtml(textCancel)}</button>
        <button type="button" id="modal-conf-ok" style="padding:10px 20px;border-radius:10px;border:none;background:${esPerillos ? '#dc2626' : '#2563eb'};color:#ffffff;font-weight:800;font-size:13.5px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.15);">${escapeHtml(textBoto)}</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  const tancar = () => modal.remove();
  const btnCancel = modal.querySelector('#modal-conf-cancel');
  const btnOk = modal.querySelector('#modal-conf-ok');
  if (btnCancel) btnCancel.onclick = tancar;
  modal.addEventListener('click', e => { if (e.target === modal) tancar(); });
  if (btnOk) {
    btnOk.onclick = () => {
      tancar();
      if (typeof onAcceptar === 'function') onAcceptar();
    };
  }
}
window.modalConfirmacio = modalConfirmacio;

// Torna sempre a la vista Inici, també des de funcions fora del controlador principal.
function tornarAInici(e) {
  if (e) e.preventDefault();
  activeTestContainerId = 'test-container';
  document.querySelectorAll('.view-content').forEach(view => {
    const isTarget = view.id === 'view-inici';
    view.style.display = isTarget ? 'block' : 'none';
    view.classList.toggle('view-activa', isTarget);
  });
  document.querySelectorAll('[data-tab]').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('[data-tab="inici"]').forEach(btn => btn.classList.add('active'));
  establirClasseSeccio('inici');
  if (typeof window.mostrarInici === 'function') {
    window.mostrarInici();
  }
  requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
}
window.tornarAInici = tornarAInici;

function obtenirVistaActiva() {
  const views = Array.from(document.querySelectorAll('.view-content'));
  const ambClasse = views.find(v => v.classList.contains('view-activa') && v.style.display !== 'none');
  if (ambClasse) return ambClasse;
  const visible = views.find(v => v.style.display !== 'none' && window.getComputedStyle(v).display !== 'none');
  if (visible) return visible;
  return document.getElementById('view-inici') || views[0] || document.body;
}
window.obtenirVistaActiva = obtenirVistaActiva;

function ferVisibleZonaPareTest(el) {
  if (!el) return;
  el.style.display = 'block';
  const zona = el.closest('#mossos-zona-test, #pl-zona-test, #act-zona-test-container');
  if (zona) {
    zona.style.display = 'block';
    const pare = zona.parentElement || zona.closest('.view-content');
    if (pare) {
      const principal = pare.querySelector('#mossos-contingut-principal, #pl-contingut-principal, #act-contingut-principal');
      if (principal) principal.style.display = 'none';
    }
  }
}

function obtenirContenidorTest() {
  if (activeTestContainerId) {
    const preferit = document.getElementById(activeTestContainerId);
    if (preferit) {
      ferVisibleZonaPareTest(preferit);
      return preferit;
    }
  }

  const vistaActiva = obtenirVistaActiva();
  if (vistaActiva) {
    if (vistaActiva.id === 'view-mossos') {
      const c = document.getElementById('test-container-mossos');
      if (c) {
        ferVisibleZonaPareTest(c);
        activeTestContainerId = 'test-container-mossos';
        return c;
      }
    } else if (vistaActiva.id === 'view-policia-local' || vistaActiva.id === 'view-pl') {
      const c = document.getElementById('test-container-pl');
      if (c) {
        ferVisibleZonaPareTest(c);
        activeTestContainerId = 'test-container-pl';
        return c;
      }
    } else if (vistaActiva.id === 'view-actualitat') {
      const c = document.getElementById('test-container-actualitat');
      if (c) {
        ferVisibleZonaPareTest(c);
        activeTestContainerId = 'test-container-actualitat';
        return c;
      }
    }

    let local = vistaActiva.querySelector('#test-container') || vistaActiva.querySelector('.zona-test-activa');
    if (!local) {
      local = document.createElement('div');
      local.id = 'test-container';
      local.style.cssText = 'max-width:980px;margin:20px auto;width:100%;';
      vistaActiva.prepend(local);
    }
    local.style.display = 'block';
    activeTestContainerId = local.id;
    return local;
  }

  const candidats = ['test-container-mossos', 'test-container-pl', 'test-container-actualitat', 'test-container', 'repas-errors-container'];
  for (const id of candidats) {
    const el = document.getElementById(id);
    if (el) {
      ferVisibleZonaPareTest(el);
      return el;
    }
  }
  return document.getElementById('test-container') || null;
}
window.obtenirContenidorTest = obtenirContenidorTest;

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
        <div class="pregunta-box" style="background: var(--bg-card, #ffffff); padding: 26px 24px; border-radius: 18px; border: 1.5px solid var(--border-card, #e2e8f0); box-shadow: var(--shadow-card); max-width: 820px; margin: 0 auto;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:12px;">
                <h3 style="margin: 0; color: var(--text-main, #0f172a); font-size: 17px; line-height: 1.5; font-weight: 800;">${preguntaObj.pregunta}</h3>
                <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
                    <button type="button" class="btn-ia-dubte-head" title="Preguntar a la IA sobre aquesta pregunta" style="background:var(--bg-card-subtle,#eff6ff);color:#1d4ed8;border:1px solid #bfdbfe;border-radius:8px;padding:4px 10px;font-size:12px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:4px;">
                        <span>🤖</span><span>Dubte IA</span>
                    </button>
                    ${etiquetaIdPreguntaHtml(preguntaObj)}
                </div>
            </div>
            <div style="display: flex; flex-direction: column; gap: 11px; margin-top: 15px;" id="llista-opcions"></div>
        </div>
        <div id="feedback" style="margin-top: 15px; max-width: 820px; margin-left: auto; margin-right: auto;"></div>
    `;

    const btnDubteHead = contenedor.querySelector('.btn-ia-dubte-head');
    if (btnDubteHead) {
        btnDubteHead.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof window.obrirModalDubteIA === 'function') {
                window.obrirModalDubteIA(preguntaObj);
            }
        });
    }

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

            const feedbackIAPrompt = `
                <div style="margin-top:12px;padding-top:10px;border-top:1px dashed ${esCorrecte ? '#6ee7b7' : '#fca5a5'};display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
                    <span style="font-size:12px;opacity:0.9;">Tens algun dubte sobre aquesta resposta o la llei aplicable?</span>
                    <button type="button" class="btn-ia-feedback-ask" style="background:${esCorrecte ? '#059669' : '#dc2626'};color:#fff;border:none;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:6px;box-shadow:0 2px 6px rgba(0,0,0,0.15);">
                        <span>✨</span> <span>Pregunta a la IA (Gemini)</span>
                    </button>
                </div>
            `;

            if (esCorrecte) {
                btn.style.background = '#d1fae5';
                btn.style.borderColor = '#10b981';
                feedback.innerHTML = `
                    <div style="background: #d1fae5; border: 1px solid #6ee7b7; padding: 15px; border-radius: 8px; color: #065f46;">
                        <p style="margin: 0 0 5px 0; font-weight: 700;">✅ Correcte!</p>
                        <p style="margin: 0; font-size: 13px;">${preguntaObj.explicacio || ''}</p>
                        ${feedbackIAPrompt}
                    </div>
                `;
            } else {
                btn.style.background = '#fee2e2';
                btn.style.borderColor = '#ef4444';
                feedback.innerHTML = `
                    <div style="background: #fee2e2; border: 1px solid #fca5a5; padding: 15px; border-radius: 8px; color: #991b1b;">
                        <p style="margin: 0 0 5px 0; font-weight: 700;">❌ Incorrecte.</p>
                        <p style="margin: 0; font-size: 13px;">${preguntaObj.explicacio || ''}</p>
                        ${feedbackIAPrompt}
                    </div>
                `;
            }

            const btnIA = feedback.querySelector('.btn-ia-feedback-ask');
            if (btnIA) {
                const opcioTriadaOriginal = preguntaObj.opcions.indexOf(opcio);
                btnIA.addEventListener('click', () => {
                    if (typeof window.obrirModalDubteIA === 'function') {
                        window.obrirModalDubteIA(preguntaObj, opcioTriadaOriginal, esCorrecte);
                    }
                });
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

  const font = (preguntaObj && preguntaObj._font) ? preguntaObj._font : (detectarFontPregunta(preguntaObj) || 'Mossos');
  const clau = `${font}::${idPregunta}`;
  const idStr = String(idPregunta);

  stats.descobertes[clau] = true;
  stats.descobertes[idStr] = true;

  const registre = {
    correcta: !!esCorrecta,
    font,
    ambit: preguntaObj?.ambit || '',
    seccio: preguntaObj?.seccio || '',
    updatedAt: Date.now()
  };

  stats.respondidas[clau] = registre;
  stats.respondidas[idStr] = registre;

  localStorage.setItem('mossos_stats_db', JSON.stringify(stats));

  // Ratxa d'encerts consecutius
  let ratxaEncerts = Number(localStorage.getItem('ratxa_encerts_consecutius') || 0);
  let millorRatxaEncerts = Number(localStorage.getItem('millor_ratxa_encerts') || 0);
  if (esCorrecta) {
    ratxaEncerts += 1;
    if (ratxaEncerts > millorRatxaEncerts) millorRatxaEncerts = ratxaEncerts;
  } else {
    ratxaEncerts = 0;
  }
  localStorage.setItem('ratxa_encerts_consecutius', String(ratxaEncerts));
  localStorage.setItem('millor_ratxa_encerts', String(millorRatxaEncerts));

  // Ratxa de dies consecutius d'estudi (calendari diari permanent)
  registrarEstudiAvui();

  actualitzarRatxaUI();
  if (typeof actualizarEstadisticasTop === 'function') actualizarEstadisticasTop();
}

function calcularRatxaDiesEstudi() {
  const avui = new Date().toISOString().slice(0, 10);
  const ultimDia = localStorage.getItem('data_ultim_estudi');
  let diesConsecutius = Number(localStorage.getItem('ratxa_dies_consecutius') || 0);

  if (!ultimDia) return diesConsecutius || 0;

  const dAvui = new Date(avui + 'T00:00:00');
  const dUltim = new Date(ultimDia + 'T00:00:00');
  const diffDies = Math.round((dAvui - dUltim) / (1000 * 60 * 60 * 24));

  if (diffDies === 0 || diffDies === 1) {
    return Math.max(1, diesConsecutius);
  } else if (diffDies > 1) {
    return 0;
  }
  return diesConsecutius;
}

function registrarEstudiAvui() {
  const avui = new Date().toISOString().slice(0, 10);
  const ultimDia = localStorage.getItem('data_ultim_estudi');
  let diesConsecutius = Number(localStorage.getItem('ratxa_dies_consecutius') || 0);
  let millorRatxa = Number(localStorage.getItem('millor_ratxa_dies') || 0);

  if (!ultimDia) {
    diesConsecutius = 1;
  } else {
    const dAvui = new Date(avui + 'T00:00:00');
    const dUltim = new Date(ultimDia + 'T00:00:00');
    const diffDies = Math.round((dAvui - dUltim) / (1000 * 60 * 60 * 24));

    if (diffDies === 1) {
      diesConsecutius += 1;
    } else if (diffDies > 1) {
      diesConsecutius = 1;
    } else if (diffDies === 0 && diesConsecutius === 0) {
      diesConsecutius = 1;
    }
  }

  if (diesConsecutius > millorRatxa) millorRatxa = diesConsecutius;

  localStorage.setItem('data_ultim_estudi', avui);
  localStorage.setItem('ratxa_dies_consecutius', String(diesConsecutius));
  localStorage.setItem('ratxa_comptador', String(diesConsecutius));
  localStorage.setItem('millor_ratxa_dies', String(millorRatxa));
  return diesConsecutius;
}

function obtenirRatxa() {
  return calcularRatxaDiesEstudi();
}

function obtenirMillorRatxa() {
  return Number(localStorage.getItem('millor_ratxa_dies') || 0);
}

function actualitzarRatxaUI() {
  const ratxa = obtenirRatxa();
  const top = document.getElementById('ratxa-val');
  if (top) top.textContent = `🔥 ${ratxa}d`;
  const topLabel = top?.parentElement?.querySelector('.l');
  if (topLabel) topLabel.textContent = `ratxa dies`;
  const inici = document.getElementById('inici-ratxa');
  if (inici) inici.textContent = `${ratxa}`;
  const iniciLabel = inici?.parentElement?.querySelector('span:last-child');
  if (iniciLabel) iniciLabel.textContent = `Ratxa activa`;
}
window.actualitzarRatxaUI = actualitzarRatxaUI;
window.registrarEstudiAvui = registrarEstudiAvui;

function normalitzarRespostaStat(valor) {
  if (typeof valor === 'boolean') return { correcta: valor };
  return valor || { correcta: false };
}

function detectarFontPregunta(pregunta) {
  if (!pregunta) return '';
  if (pregunta._font) return pregunta._font;

  const id = String(pregunta.id || '').toUpperCase();
  const text = `${pregunta.font || ''} ${pregunta.origen || ''} ${pregunta.categoria || ''} ${pregunta.ambit || ''} ${pregunta.seccio || ''} ${pregunta.tema || ''}`.toLowerCase();

  // Comprovar si pertany expressament a un dels bancs en memòria
  if (Array.isArray(window.bancoPoliciaLocal) && window.bancoPoliciaLocal.some(q => q && q.id === pregunta.id)) {
    return 'Policia Local';
  }
  if (Array.isArray(window.bancoActualitat) && window.bancoActualitat.some(q => q && q.id === pregunta.id)) {
    return 'Actualitat';
  }
  if (Array.isArray(window.bancoPreguntes) && window.bancoPreguntes.some(q => q && q.id === pregunta.id)) {
    return 'Mossos';
  }

  if (id.startsWith('MOSSOS') || String(pregunta.ambit || '').toUpperCase().startsWith('ÀMBIT')) return 'Mossos';
  if (id.startsWith('PL') || id.startsWith('GUB') || id.startsWith('CON') || id.startsWith('CUB') || id.startsWith('CUN') || id.startsWith('LOCAL') || pregunta.municipi || text.includes('policia local') || text.includes('municipi')) {
    return 'Policia Local';
  }
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

function calcularProgresPreguntes(dataset) {
  if (!Array.isArray(dataset)) {
    return { total: 0, contestades: 0, encerts: 0, encertades: 0, errors: 0, fallades: 0, maiFetes: 0, progrés: 0, pctProgres: 0, pctErrors: 0, pctEncerts: 0 };
  }
  const stats = (typeof obtenerHistorial === 'function') ? obtenerHistorial() : { respondidas: {}, descobertes: {} };
  const respostes = stats.respondidas || {};
  const descobertes = stats.descobertes || {};

  let idsErrors = new Set();
  try {
    const errDb = (typeof migrarErrorsAntics === 'function') ? migrarErrorsAntics() : (typeof obtenerErrorDB === 'function' ? obtenerErrorDB() : null);
    if (errDb) {
      ['Mossos', 'Policia Local', 'Actualitat'].forEach(k => {
        (errDb[k] || []).forEach(errQ => {
          if (errQ && errQ.id) idsErrors.add(String(errQ.id));
        });
      });
    }
  } catch (_) {}

  const idsUnics = new Set();
  let contestades = 0;
  let encerts = 0;
  let fallades = 0;
  let maiFetes = 0;

  dataset.forEach(q => {
    if (!q || !q.id) return;
    const qidStr = String(q.id);
    if (idsUnics.has(qidStr)) return;
    idsUnics.add(qidStr);

    const font = (typeof detectarFontPregunta === 'function' ? detectarFontPregunta(q) : '') || 'Mossos';
    const clau = `${font}::${qidStr}`;

    const registre = respostes[clau] ||
      respostes[`Policia Local::${qidStr}`] ||
      respostes[`Mossos::${qidStr}`] ||
      respostes[`Actualitat::${qidStr}`] ||
      respostes[qidStr] ||
      respostes[q.id];

    const haEstatVista = Object.prototype.hasOwnProperty.call(descobertes, clau) ||
      Object.prototype.hasOwnProperty.call(descobertes, `Policia Local::${qidStr}`) ||
      Object.prototype.hasOwnProperty.call(descobertes, `Mossos::${qidStr}`) ||
      Object.prototype.hasOwnProperty.call(descobertes, `Actualitat::${qidStr}`) ||
      Object.prototype.hasOwnProperty.call(descobertes, qidStr) ||
      Object.prototype.hasOwnProperty.call(descobertes, q.id) ||
      !!registre;

    const estaEnBustiaErrors = idsErrors.has(qidStr) || idsErrors.has(String(q.id));

    if (!haEstatVista && !registre && !estaEnBustiaErrors) {
      maiFetes++;
    } else {
      contestades++;
      const norm = registre ? (typeof normalitzarRespostaStat === 'function' ? normalitzarRespostaStat(registre) : registre) : null;
      if (norm && norm.correcta === true && !estaEnBustiaErrors) {
        encerts++;
      } else {
        fallades++;
      }
    }
  });

  const total = idsUnics.size;
  const progrés = total ? Math.round((encerts / total) * 100) : 0;

  return {
    total,
    contestades,
    encerts,
    encertades: encerts,
    errors: fallades,
    fallades,
    maiFetes,
    progrés,
    pctProgres: progrés,
    pctErrors: contestades ? Math.round((fallades / contestades) * 100) : 0,
    pctEncerts: contestades ? Math.round((encerts / contestades) * 100) : 0
  };
}

window.calcularProgresPreguntes = calcularProgresPreguntes;

function obtenirEstadistiquesBanc(dataset) {
  return calcularProgresPreguntes(dataset);
}
window.obtenirEstadistiquesBanc = obtenirEstadistiquesBanc;

function obtenirEstadistiquesSeccio(dataset, seccio) {
  return calcularProgresPreguntes((dataset || []).filter(q => q.seccio === seccio));
}
window.obtenirEstadistiquesSeccio = obtenirEstadistiquesSeccio;

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
  if (badge) badge.textContent = String(totalErrors);
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

  // Inicialitzar compte enrere dinàmic de dates d'examen
  if (typeof renderExamensCountdown === 'function') {
    renderExamensCountdown();
  }

  // --- NAVEGACIÓ GENERAL PER PESTANYES (data-tab) ---
  const navButtons = document.querySelectorAll('[data-tab]');

  navButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      const targetTab = button.getAttribute('data-tab');

      navButtons.forEach(btn => btn.classList.remove('active'));
      const activeButtons = document.querySelectorAll(`[data-tab="${targetTab}"]`);
      activeButtons.forEach(btn => btn.classList.add('active'));

      establirClasseSeccio(targetTab);

      const views = document.querySelectorAll('.view-content');
      views.forEach(view => {
        const isTarget = (view.id === `view-${targetTab}`);
        view.style.display = isTarget ? 'block' : 'none';
        view.classList.toggle('view-activa', isTarget);
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
      } else if (targetTab === 'tutor-ia') {
        if (typeof window.renderitzarVistaTutorIA === 'function') {
          window.renderitzarVistaTutorIA();
        }
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
  // (Les constants CONVOCATORIES_KEY i convocatoriesPerDefecte estan definides a l'inici del fitxer)

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
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.62);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;';
    modal.innerHTML = `
      <div style="background:var(--bg-card,#ffffff);color:var(--text-main,#0f172a);border:1.5px solid var(--border-card,#e2e8f0);width:min(520px,100%);max-height:90vh;overflow:auto;border-radius:16px;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,.35);">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px;">
          <h3 style="margin:0;color:var(--text-main,#0f172a);">${id ? '✏️ Editar convocatòria' : '➕ Convocatòries Actives'}</h3>
          <button type="button" id="conv-close" aria-label="Tancar" style="width:34px;height:34px;border:none;background:var(--bg-card-subtle,#f1f5f9);color:var(--text-main,#475569);border-radius:50%;font-size:18px;cursor:pointer;">×</button>
        </div>
        ${!id ? `
          <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:18px;">
            ${dades.length ? dades.map(c => `
              <div style="display:flex;align-items:center;gap:8px;padding:9px 10px;border:1px solid var(--border-card,#e2e8f0);border-radius:9px;background:var(--bg-card-subtle,#f8fafc);">
                <span style="width:13px;height:13px;border-radius:50%;background:${escapeHtml(c.color || '#007aff')};flex:none;"></span>
                <span style="flex:1;min-width:0;font-size:13px;font-weight:700;color:var(--text-main,#334155);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(c.nom)}</span>
                <button type="button" data-edit-conv="${escapeHtml(c.id)}" title="Editar" style="border:1px solid var(--border-card,#cbd5e1);background:var(--bg-card,#fff);color:var(--text-main,#475569);border-radius:6px;padding:5px 7px;cursor:pointer;">✏️</button>
                <button type="button" data-del-conv="${escapeHtml(c.id)}" title="Eliminar" style="border:1px solid #fecaca;background:#fff1f2;color:#b91c1c;border-radius:6px;padding:5px 7px;cursor:pointer;">🗑️</button>
              </div>
            `).join('') : '<span style="font-size:13px;color:var(--text-muted,#64748b);">No hi ha convocatòries guardades.</span>'}
          </div>` : ''}
        <form id="form-convocatoria" style="border-top:${id ? '0' : '1px solid var(--border-card,#e2e8f0)'};padding-top:${id ? '0' : '16px'};">
          <h4 style="margin:0 0 10px;color:var(--text-main,#334155);">${id ? 'Modificar convocatòria' : 'Afegir nova convocatòria'}</h4>
          <label style="display:block;font-size:13px;font-weight:700;margin:10px 0 5px;color:var(--text-main,#0f172a);">Nom de la convocatòria</label>
          <input id="conv-nom" required value="${escapeHtml(actual.nom)}" placeholder="Ex.: Mossos 47/26" style="width:100%;box-sizing:border-box;padding:10px;border:1px solid var(--border-card,#cbd5e1);border-radius:8px;background:var(--bg-card,#fff);color:var(--text-main,#0f172a);">
          <label style="display:block;font-size:13px;font-weight:700;margin:10px 0 5px;color:var(--text-main,#0f172a);">Enllaç oficial (URL)</label>
          <input id="conv-url" type="url" required value="${escapeHtml(actual.url)}" placeholder="https://..." style="width:100%;box-sizing:border-box;padding:10px;border:1px solid var(--border-card,#cbd5e1);border-radius:8px;background:var(--bg-card,#fff);color:var(--text-main,#0f172a);">
          <label style="display:block;font-size:13px;font-weight:700;margin:10px 0 5px;color:var(--text-main,#0f172a);">Color identificatiu</label>
          <div style="display:flex;align-items:center;gap:10px;"><input id="conv-color" type="color" value="${escapeHtml(actual.color || '#007aff')}" style="width:55px;height:38px;padding:2px;border:1px solid var(--border-card,#cbd5e1);border-radius:7px;background:var(--bg-card,#fff);"><span style="font-size:12px;color:var(--text-muted,#64748b);">Color del botó</span></div>
          <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:20px;">
            <button type="button" id="conv-cancel" style="padding:10px 15px;border:1px solid var(--border-card,#cbd5e1);background:var(--bg-card,#fff);color:var(--text-main,#334155);border-radius:8px;font-weight:700;cursor:pointer;">${id ? 'Tornar' : 'Cancel·lar'}</button>
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
        <div class="convocatories-box">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:20px;">📜</span>
              <h4 class="convocatories-box-title">Convocatòries Actives</h4>
            </div>
            <button id="btn-afegir-convocatoria" type="button" class="convocatories-box-btn-add">➕ Afegir convocatòria</button>
          </div>
          <div id="llista-convocatories" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;"></div>
        </div>

        <!-- 1. Dials Radials i Mètriques (Inspirat en Sample 1 Radial & Sample 2 Modern de 1234.jpeg) -->
        <div class="dash-metrics-grid">
          <!-- Radial 1: Ratxa -->
          <div class="dash-radial-card">
            <div class="radial-dial-wrap">
              <svg class="radial-dial-svg" viewBox="0 0 100 100">
                <circle class="radial-dial-bg" cx="50" cy="50" r="40"></circle>
                <circle class="radial-dial-progress" cx="50" cy="50" r="40" stroke="#f59e0b" stroke-dasharray="251.2" stroke-dashoffset="${251.2 - Math.min(ratxaActual * 25, 251.2)}"></circle>
              </svg>
              <div class="radial-center-content">
                <span class="radial-icon">🔥</span>
                <span class="radial-value" id="inici-ratxa">${ratxaActual}</span>
              </div>
            </div>
            <span class="radial-label">Ratxa activa</span>
            <span class="radial-subtext">Dies consecutius</span>
          </div>

          <!-- Radial 2: Preguntes Contestades -->
          <div class="dash-radial-card">
            <div class="radial-dial-wrap">
              <svg class="radial-dial-svg" viewBox="0 0 100 100">
                <circle class="radial-dial-bg" cx="50" cy="50" r="40"></circle>
                <circle class="radial-dial-progress" cx="50" cy="50" r="40" stroke="#8b5cf6" stroke-dasharray="251.2" stroke-dashoffset="${251.2 - Math.min((totalContestadas / 200) * 251.2, 251.2)}"></circle>
              </svg>
              <div class="radial-center-content">
                <span class="radial-icon">🎯</span>
                <span class="radial-value" id="inici-preguntes">${totalContestadas}</span>
              </div>
            </div>
            <span class="radial-label">Preguntes</span>
            <span class="radial-subtext">Total contestades</span>
          </div>

          <!-- Radial 3: Encerts Globals % -->
          <div class="dash-radial-card">
            <div class="radial-dial-wrap">
              <svg class="radial-dial-svg" viewBox="0 0 100 100">
                <circle class="radial-dial-bg" cx="50" cy="50" r="40"></circle>
                <circle class="radial-dial-progress" cx="50" cy="50" r="40" stroke="#10b981" stroke-dasharray="251.2" stroke-dashoffset="${251.2 - (parseFloat(porcentajeAciertos) / 100) * 251.2}"></circle>
              </svg>
              <div class="radial-center-content">
                <span class="radial-icon">📝</span>
                <span class="radial-value">${porcentajeAciertos}%</span>
              </div>
            </div>
            <span class="radial-label">Encerts</span>
            <span class="radial-subtext">Puntuació global</span>
          </div>

          <!-- Radial 4: Errors Pendents -->
          <div class="dash-radial-card">
            <div class="radial-dial-wrap">
              <svg class="radial-dial-svg" viewBox="0 0 100 100">
                <circle class="radial-dial-bg" cx="50" cy="50" r="40"></circle>
                <circle class="radial-dial-progress" cx="50" cy="50" r="40" stroke="#ef4444" stroke-dasharray="251.2" stroke-dashoffset="0"></circle>
              </svg>
              <div class="radial-center-content">
                <span class="radial-icon">⚠️</span>
                <span class="radial-value" id="total-errors-dashboard">0</span>
              </div>
            </div>
            <span class="radial-label">Errors</span>
            <span class="radial-subtext">Pendents de repàs</span>
          </div>
        </div>

        <div style="display:flex;justify-content:center;">
          <button id="btn-repas-errors-inici" style="width:100%;max-width:520px;border:none;padding:13px 18px;border-radius:12px;font-weight:800;cursor:pointer;font-size:15px;background:linear-gradient(135deg,#b91c1c,#ef4444);color:#fff;box-shadow:0 4px 14px rgba(239,68,68,0.25);">🔁 Repàs d'errors acumulats (0)</button>
        </div>

        <!-- 2. Centre d'entrenament millorat -->
        <div style="background:var(--bg-card,#ffffff);border:1px solid var(--border-card,#e2e8f0);padding:20px;border-radius:16px;box-shadow:var(--shadow-card);">
          <div class="dash-section-header">
            <div>
              <h2 class="dash-section-title">🎯 Centre d'entrenament</h2>
              <p class="dash-section-subtitle">Tria com vols estudiar avui o crea preguntes directament per als teus temaris.</p>
            </div>
            <button onclick="window.obrirModalCrearPregunta()" class="btn-crear-pregunta-top" style="font-size:13px;padding:8px 14px;">
              <span>➕</span> <span>Nova Pregunta</span>
            </button>
          </div>

          <div class="training-center-grid">
            <div id="centre-continuar" class="action-card card-blue">
              <div class="action-card-icon-wrap" style="color:#007aff;">📖</div>
              <div>
                <h4 class="action-card-title">Continuar estudi</h4>
                <p class="action-card-desc">Torna directament al temari de Mossos d'Esquadra o Policia Local.</p>
              </div>
            </div>

            <div id="centre-errors" class="action-card card-red">
              <div class="action-card-icon-wrap" style="color:#ef4444;">🎯</div>
              <div>
                <h4 class="action-card-title">Repàs d'errors</h4>
                <p class="action-card-desc">Posa el focus en les preguntes que més has fallat fins a dominar-les.</p>
              </div>
            </div>

            <div id="centre-simulacre" class="action-card card-green">
              <div class="action-card-icon-wrap" style="color:#10b981;">⏱️</div>
              <div>
                <h4 class="action-card-title">Simulacre oficial</h4>
                <p class="action-card-desc">30 preguntes reals en 30 minuts amb cronòmetre d'oposició.</p>
              </div>
            </div>

            <div id="centre-crear" class="action-card card-purple" onclick="window.obrirModalCrearPregunta()">
              <div class="action-card-icon-wrap" style="color:#8b5cf6;">➕</div>
              <div>
                <span class="action-card-badge">Directe al temari</span>
                <h4 class="action-card-title" style="margin-top:4px;">Crear pregunta</h4>
                <p class="action-card-desc">Afegeix preguntes a qualsevol tema de P. Local o Mossos sense tocar codi.</p>
              </div>
            </div>

            <div id="centre-dificils" class="action-card card-gold">
              <div class="action-card-icon-wrap" style="color:#f59e0b;">🔥</div>
              <div>
                <h4 class="action-card-title">Preguntes difícils</h4>
                <p class="action-card-desc">Repàs prioritari d'aquelles preguntes amb més taxa d'error.</p>
              </div>
            </div>

            <div id="centre-tutor-ia" class="action-card card-blue" onclick="document.querySelector('[data-tab=\'tutor-ia\']')?.click();" style="cursor:pointer;border:1.5px solid #002B5E;background:linear-gradient(135deg,rgba(0,43,94,0.04),rgba(0,122,255,0.06));">
              <div class="action-card-icon-wrap" style="color:#002B5E;font-size:24px;">🧠</div>
              <div>
                <span class="action-card-badge" style="background:#002B5E;color:#fff;">Assistent Personal</span>
                <h4 class="action-card-title" style="margin-top:4px;">Tutor IA & Ordenances</h4>
                <p class="action-card-desc">Resol dubtes, puja ordenances (Cunit, Badalona...) i genera tests IA a mida.</p>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div style="display:flex;align-items:end;justify-content:space-between;gap:10px;margin-bottom:10px;">
            <div>
              <h2 style="margin:0;color:var(--text-main,#0f172a);font-size:20px;">📈 Progrés i errors per secció</h2>
              <p style="margin:4px 0 0;color:var(--text-muted,#64748b);font-size:13px;">Progrés = preguntes úniques contestades del banc. Els errors baixen quan els corregeixes.</p>
            </div>
            <button onclick="esborrarTotsElsErrors()" style="border:1px solid #fecaca;background:#fff1f2;color:#b91c1c;padding:8px 12px;border-radius:8px;font-weight:800;cursor:pointer;">🗑 Esborrar errors</button>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:14px;">
            ${cards.map(([key,ico,title,sub]) => `
              <div class="dash-progress-card" data-progress="${key}">
                <div style="display:flex;align-items:center;gap:10px;">
                  <span style="font-size:22px;">${ico}</span>
                  <div style="flex:1;">
                    <div style="font-weight:800;color:var(--text-main,#0f172a);">${title}</div>
                    <div style="font-size:12px;color:var(--text-muted,#94a3b8);">${sub}</div>
                  </div>
                  <b class="dash-prog-pct" style="color:#007aff;">0%</b>
                </div>
                <div style="height:10px;background:var(--border-card,#e2e8f0);border-radius:999px;overflow:hidden;margin:12px 0 6px;">
                  <span class="dash-prog-fill" style="display:block;width:0%;height:100%;background:linear-gradient(90deg,#007aff,#5aa9ff);transition:width .25s;"></span>
                </div>
                <div style="display:flex;justify-content:space-between;gap:10px;font-size:12px;">
                  <span class="dash-prog-detail" style="color:var(--text-muted,#64748b);">0 / 0 preguntes fetes</span>
                  <span class="dash-error" style="font-weight:800;color:#dc2626;">0% errors · 0 fallades</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="dash-fallades-flash">
          <div class="fallades-block" style="background:var(--bg-card,#ffffff);border:1px solid var(--border-card,#e9ecef);padding:20px;border-radius:12px;box-shadow:0 4px 15px rgba(0,0,0,0.04);">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px;">
              <div>
                <h3 style="margin:0;font-size:18px;color:var(--text-main,#0f172a);">✍️ Preguntes més fallades</h3>
                <p style="margin:4px 0 0;color:var(--text-muted,#64748b);font-size:12px;">La classificació suma cada vegada que tornes a fallar una pregunta.</p>
              </div>
              <button onclick="actualitzarFlashcardsDesErrors();actualitzarFlashcard()" style="background:#eef6ff;color:#0057a8;border:1px solid #bfdbfe;padding:7px 10px;border-radius:8px;font-weight:800;cursor:pointer;">⚡ Flashcards</button>
            </div>
            <div id="ranking-errors"></div>
          </div>

          <div class="flashcard-block" style="background:var(--bg-card,#ffffff);border:1px solid var(--border-card,#e9ecef);padding:20px;border-radius:12px;box-shadow:0 4px 15px rgba(0,0,0,0.04);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
              <h3 style="margin:0;font-size:18px;color:var(--text-main,#0f172a);">⚡ Flashcards</h3>
              <span id="flashcard-meta" style="font-size:11px;color:var(--text-muted,#94a3b8);"></span>
            </div>
            <div id="flashcard-container" onclick="girarFlashcard()" style="background:var(--bg-card-subtle,#f8fafc);border:2px dashed #007aff;border-radius:10px;padding:25px;text-align:center;cursor:pointer;min-height:170px;display:flex;flex-direction:column;justify-content:center;align-items:center;">
              <span id="flashcard-badge" style="font-size:11px;text-transform:uppercase;color:#007aff;font-weight:700;margin-bottom:8px;">Clica per girar</span>
              <p id="flashcard-text" style="font-size:16px;font-weight:600;color:var(--text-main,#0f172a);margin:0;"></p>
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:15px;">
              <button onclick="canviarFlashcard(-1)" style="background:var(--bg-card-subtle,#e9ecef);border:1px solid var(--border-card,#cbd5e1);color:var(--text-main,#334155);padding:8px 15px;border-radius:6px;cursor:pointer;font-weight:600;">Anterior</button>
              <span id="flashcard-counter" style="font-size:14px;color:var(--text-muted,#6c757d);align-self:center;">1 / 1</span>
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

  // --- VISTA MOSSOS (Disseny Oficial Agent Medina) ---
  function mostrarTemarioMossos() {
    const contenedor = document.getElementById('view-mossos');
    if (!contenedor) return;

    const dades = window.bancoPreguntes && window.bancoPreguntes.length > 0 ? window.bancoPreguntes : (typeof bancoPreguntes !== 'undefined' ? bancoPreguntes : []);
    
    const preguntesA = dades.filter(q => q.ambit && q.ambit.toUpperCase().includes("ÀMBIT A"));
    const preguntesB = dades.filter(q => q.ambit && q.ambit.toUpperCase().includes("ÀMBIT B"));
    const preguntesC = dades.filter(q => q.ambit && q.ambit.toUpperCase().includes("ÀMBIT C"));
    
    const estTotal = obtenirEstadistiquesBanc(dades);
    const estA = obtenirEstadistiquesBanc(preguntesA);
    const estB = obtenirEstadistiquesBanc(preguntesB);
    const estC = obtenirEstadistiquesBanc(preguntesC);

    contenedor.innerHTML = `
      <div style="max-width: 980px; margin: 0 auto; width: 100%;">
        <!-- ZONA DE TEST ACTIU MOSSOS (A DALT DE TOT) -->
        <div id="mossos-zona-test" style="display: none; margin-bottom: 24px;">
          <div style="background: var(--bg-card, #ffffff); border: 1.5px solid var(--border-card, #e2e8f0); border-radius: 16px; padding: 14px 20px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.04);">
            <button type="button" id="btn-mossos-sortir-test" style="display: inline-flex; align-items: center; gap: 6px; background: var(--bg-card-subtle, #f1f5f9); color: var(--text-main, #1e293b); border: 1px solid var(--border-card, #cbd5e1); padding: 8px 14px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer;">
              ← Tornar al temari de Mossos
            </button>
            <div id="mossos-test-titol-superior" style="font-weight: 800; font-size: 14.5px; color: var(--text-main, #0f172a);">
              🔵 Test de Mossos d'Esquadra en curs
            </div>
          </div>
          <div id="test-container-mossos"></div>
        </div>

        <div id="mossos-contingut-principal" class="academy-curriculum-container" style="display: flex; flex-direction: column; gap: 22px;">
        
        <!-- Capçalera Oficial Mossos -->
        <div class="curriculum-hero-card" style="background: var(--bg-card, #ffffff); border: 1.5px solid var(--border-card, #e2e8f0); border-radius: 18px; padding: 22px 26px; box-shadow: var(--shadow-card); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
          <div style="display: flex; align-items: center; gap: 16px;">
            <div style="width: 54px; height: 54px; border-radius: 14px; background: linear-gradient(135deg, #1e3a8a, #3b82f6); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(30, 58, 138, 0.25); flex-shrink: 0;">
              <img src="Escut.png" alt="Escut Mossos" style="width: 36px; height: 36px; object-fit: contain;">
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <h2 style="margin: 0; font-size: 21px; font-weight: 900; color: var(--text-main, #0f172a);">Temari Oficial Mossos d'Esquadra</h2>
                <span style="background: #1e3a8a; color: #93c5fd; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 6px;">DOGC 46/2026</span>
              </div>
              <p style="margin: 4px 0 0; font-size: 13.5px; color: var(--text-muted, #64748b);">
                Subprova de coneixements — 20 temes oficials estructurats en 3 àmbits acadèmics
              </p>
            </div>
          </div>
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <button onclick="window.obrirModalCrearPregunta('mossos')" class="btn-crear-pregunta-top" style="font-size: 13px; padding: 9px 16px;">
              <span>➕</span> <span>Nova Pregunta</span>
            </button>
            <button onclick="window.obrirModalImportarLot('mossos')" style="padding: 9px 16px; border-radius: 10px; font-weight: 800; font-size: 13px; cursor: pointer; border: none; background: linear-gradient(135deg,#059669,#10b981); color: #ffffff; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.25);" title="Importar preguntes massives o generades per IA">
              <span>⚡</span> <span>Importar lot / IA</span>
            </button>
            <button id="btn-quick-mixed-test" style="padding: 9px 16px; border-radius: 10px; font-weight: 800; font-size: 13px; cursor: pointer; border: none; background: #007aff; color: #ffffff; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 8px rgba(0, 122, 255, 0.25);">
              <span>🔀</span> <span>Test Barrejat</span>
            </button>
          </div>
        </div>

        <!-- PANELL DE PROGRÈS GLOBAL MOSSOS -->
        <div style="background: var(--bg-card, #ffffff); border: 1.5px solid var(--border-card, #e2e8f0); border-radius: 16px; padding: 18px 22px; box-shadow: var(--shadow-card); display: flex; flex-direction: column; gap: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
            <div>
              <div style="font-size: 11.5px; font-weight: 800; color: var(--text-muted, #64748b); text-transform: uppercase; letter-spacing: 0.5px;">Progrés General del Temari de Mossos</div>
              <div style="font-size: 15px; font-weight: 800; color: var(--text-main, #0f172a); margin-top: 3px;">
                ${estTotal.encerts} encertades · ${estTotal.errors} fallades · ${estTotal.maiFetes} que encara no has fet mai
              </div>
            </div>
            <div style="display: flex; align-items: baseline; gap: 6px;">
              <span style="font-size: 24px; font-weight: 900; color: #1e3a8a;">${estTotal.progrés}%</span>
              <span style="font-size: 12px; font-weight: 800; color: var(--text-muted, #64748b);">dominat (${estTotal.contestades} de ${estTotal.total})</span>
            </div>
          </div>

          <div style="height: 10px; background: #e2e8f0; border-radius: 999px; overflow: hidden; display: flex;" title="${estTotal.encerts} encertades, ${estTotal.errors} fallades, ${estTotal.maiFetes} mai fetes">
            <div style="width: ${estTotal.total ? (estTotal.encerts / estTotal.total) * 100 : 0}%; background: #10b981;" title="Encertades: ${estTotal.encerts}"></div>
            <div style="width: ${estTotal.total ? (estTotal.errors / estTotal.total) * 100 : 0}%; background: #ef4444;" title="Fallades: ${estTotal.errors}"></div>
            <div style="width: ${estTotal.total ? (estTotal.maiFetes / estTotal.total) * 100 : 0}%; background: #cbd5e1;" title="Mai fetes: ${estTotal.maiFetes}"></div>
          </div>

          <div style="display: flex; gap: 10px; flex-wrap: wrap; font-size: 12.5px; font-weight: 800;">
            <span style="background: rgba(16, 185, 129, 0.12); color: #059669; padding: 4px 10px; border-radius: 8px; display: inline-flex; align-items: center; gap: 5px;">
              <span>✅</span> <span>${estTotal.encerts} Encertades</span>
            </span>
            <span style="background: rgba(239, 68, 68, 0.12); color: #dc2626; padding: 4px 10px; border-radius: 8px; display: inline-flex; align-items: center; gap: 5px;">
              <span>❌</span> <span>${estTotal.errors} Fallades</span>
            </span>
            <span style="background: rgba(100, 116, 139, 0.12); color: #475569; padding: 4px 10px; border-radius: 8px; display: inline-flex; align-items: center; gap: 5px;">
              <span>⏳</span> <span>${estTotal.maiFetes} Que encara no has fet mai</span>
            </span>
          </div>
        </div>

        <!-- Selector de Modes -->
        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          <button class="tab-interna on" data-subtab="estudia" style="padding: 10px 18px; border-radius: 10px; font-weight: 800; font-size: 13.5px; cursor: pointer; border: 1.5px solid #007aff; background: #007aff; color: #ffffff; display: flex; align-items: center; gap: 8px;">
            <span>📚</span> <span>Pla d'Estudi per Àmbits</span>
          </button>
          <button class="tab-interna" data-subtab="examen" style="padding: 10px 18px; border-radius: 10px; font-weight: 800; font-size: 13.5px; cursor: pointer; border: 1.5px solid var(--border-card, #cbd5e1); background: var(--bg-card, #ffffff); color: var(--text-main, #334155); display: flex; align-items: center; gap: 8px;">
            <span>⏱️</span> <span>Simulacre Oficial (30 preguntes)</span>
          </button>
        </div>

        <!-- VISTA PLA D'ESTUDI -->
        <div id="subview-estudia" class="subview-content" style="display: block;">
          <div style="display: flex; flex-direction: column; gap: 14px;">
            
            <!-- Targeta Àmbit A -->
            <div class="academy-module-card" style="background: var(--bg-card, #ffffff); border: 1.5px solid var(--border-card, #e2e8f0); border-radius: 16px; padding: 22px; box-shadow: var(--shadow-card);">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; flex-wrap: wrap;">
                <div style="display: flex; gap: 14px; align-items: center;">
                  <div style="width: 44px; height: 44px; border-radius: 12px; background: rgba(37, 99, 235, 0.12); color: #2563eb; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0;">
                    🗺️
                  </div>
                  <div>
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                      <h3 style="margin: 0; font-size: 17px; font-weight: 800; color: var(--text-main, #0f172a);">Àmbit A · Coneixements de l'Entorn</h3>
                      <span style="background: rgba(37, 99, 235, 0.1); color: #2563eb; font-weight: 700; font-size: 11px; padding: 2px 8px; border-radius: 6px;">Temes 1 al 7</span>
                    </div>
                    <p style="margin: 4px 0 0; font-size: 13px; color: var(--text-muted, #64748b);">
                      Història social i política de Catalunya, geografia física i econòmica, i estructura de la societat.
                    </p>
                  </div>
                </div>
                <div style="text-align: right; min-width: 110px;">
                  <div style="font-size: 20px; font-weight: 900; color: #2563eb;">${estA.progrés}%</div>
                  <div style="font-size: 11px; color: var(--text-dim, #94a3b8);">${estA.contestades} / ${preguntesA.length} contestades</div>
                </div>
              </div>

              <!-- Indicadors detallats Àmbit A -->
              <div style="display: flex; gap: 8px; flex-wrap: wrap; margin: 12px 0 6px; font-size: 12px; font-weight: 800;">
                <span style="background: rgba(16, 185, 129, 0.12); color: #059669; padding: 3px 8px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px;">
                  <span>✅</span> <span>${estA.encerts} encertades</span>
                </span>
                <span style="background: rgba(239, 68, 68, 0.12); color: #dc2626; padding: 3px 8px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px;">
                  <span>❌</span> <span>${estA.errors} fallades</span>
                </span>
                <span style="background: rgba(100, 116, 139, 0.12); color: #475569; padding: 3px 8px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px;">
                  <span>⏳</span> <span>${estA.maiFetes} mai fetes</span>
                </span>
              </div>

              <div style="margin: 6px 0 14px; height: 8px; background: var(--bg-card-subtle, #e2e8f0); border-radius: 999px; overflow: hidden; display: flex;">
                <div style="width: ${preguntesA.length ? (estA.encerts / preguntesA.length) * 100 : 0}%; height: 100%; background: #10b981;" title="Encertades: ${estA.encerts}"></div>
                <div style="width: ${preguntesA.length ? (estA.errors / preguntesA.length) * 100 : 0}%; height: 100%; background: #ef4444;" title="Fallades: ${estA.errors}"></div>
                <div style="width: ${preguntesA.length ? (estA.maiFetes / preguntesA.length) * 100 : 0}%; height: 100%; background: #cbd5e1;" title="Mai fetes: ${estA.maiFetes}"></div>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; padding-top: 4px;">
                <span style="font-size: 12.5px; color: var(--text-muted, #64748b);">
                  📊 <b>${preguntesA.length}</b> preguntes al banc
                </span>
                <div style="display: flex; gap: 8px;">
                  <button class="btn-ambit-test" data-ambit="Àmbit A" style="background: #2563eb; color: #fff; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 800; font-size: 13px; cursor: pointer;">
                    ▶ Fer Test
                  </button>
                  <button class="btn-ambit-seccions" data-ambit="Àmbit A" style="background: var(--bg-card-subtle, #f8fafc); color: var(--text-main, #334155); border: 1px solid var(--border-card, #cbd5e1); padding: 8px 14px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer;">
                    📋 Triar Temes
                  </button>
                </div>
              </div>
            </div>

            <!-- Targeta Àmbit B -->
            <div class="academy-module-card" style="background: var(--bg-card, #ffffff); border: 1.5px solid var(--border-card, #e2e8f0); border-radius: 16px; padding: 22px; box-shadow: var(--shadow-card);">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; flex-wrap: wrap;">
                <div style="display: flex; gap: 14px; align-items: center;">
                  <div style="width: 44px; height: 44px; border-radius: 12px; background: rgba(225, 29, 72, 0.12); color: #e11d48; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0;">
                    🏛️
                  </div>
                  <div>
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                      <h3 style="margin: 0; font-size: 17px; font-weight: 800; color: var(--text-main, #0f172a);">Àmbit B · Institucional i Marc Legal</h3>
                      <span style="background: rgba(225, 29, 72, 0.1); color: #e11d48; font-weight: 700; font-size: 11px; padding: 2px 8px; border-radius: 6px;">Temes 8 al 15</span>
                    </div>
                    <p style="margin: 4px 0 0; font-size: 13px; color: var(--text-muted, #64748b);">
                      Constitució Espanyola de 1978, Estatut d'Autonomia, Govern de la Generalitat i Procediment Administratiu.
                    </p>
                  </div>
                </div>
                <div style="text-align: right; min-width: 110px;">
                  <div style="font-size: 20px; font-weight: 900; color: #e11d48;">${estB.progrés}%</div>
                  <div style="font-size: 11px; color: var(--text-dim, #94a3b8);">${estB.contestades} / ${preguntesB.length} contestades</div>
                </div>
              </div>

              <!-- Indicadors detallats Àmbit B -->
              <div style="display: flex; gap: 8px; flex-wrap: wrap; margin: 12px 0 6px; font-size: 12px; font-weight: 800;">
                <span style="background: rgba(16, 185, 129, 0.12); color: #059669; padding: 3px 8px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px;">
                  <span>✅</span> <span>${estB.encerts} encertades</span>
                </span>
                <span style="background: rgba(239, 68, 68, 0.12); color: #dc2626; padding: 3px 8px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px;">
                  <span>❌</span> <span>${estB.errors} fallades</span>
                </span>
                <span style="background: rgba(100, 116, 139, 0.12); color: #475569; padding: 3px 8px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px;">
                  <span>⏳</span> <span>${estB.maiFetes} mai fetes</span>
                </span>
              </div>

              <div style="margin: 6px 0 14px; height: 8px; background: var(--bg-card-subtle, #e2e8f0); border-radius: 999px; overflow: hidden; display: flex;">
                <div style="width: ${preguntesB.length ? (estB.encerts / preguntesB.length) * 100 : 0}%; height: 100%; background: #10b981;" title="Encertades: ${estB.encerts}"></div>
                <div style="width: ${preguntesB.length ? (estB.errors / preguntesB.length) * 100 : 0}%; height: 100%; background: #ef4444;" title="Fallades: ${estB.errors}"></div>
                <div style="width: ${preguntesB.length ? (estB.maiFetes / preguntesB.length) * 100 : 0}%; height: 100%; background: #cbd5e1;" title="Mai fetes: ${estB.maiFetes}"></div>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; padding-top: 4px;">
                <span style="font-size: 12.5px; color: var(--text-muted, #64748b);">
                  📊 <b>${preguntesB.length}</b> preguntes al banc
                </span>
                <div style="display: flex; gap: 8px;">
                  <button class="btn-ambit-test" data-ambit="Àmbit B" style="background: #e11d48; color: #fff; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 800; font-size: 13px; cursor: pointer;">
                    ▶ Fer Test
                  </button>
                  <button class="btn-ambit-seccions" data-ambit="Àmbit B" style="background: var(--bg-card-subtle, #f8fafc); color: var(--text-main, #334155); border: 1px solid var(--border-card, #cbd5e1); padding: 8px 14px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer;">
                    📋 Triar Temes
                  </button>
                </div>
              </div>
            </div>

            <!-- Targeta Àmbit C -->
            <div class="academy-module-card" style="background: var(--bg-card, #ffffff); border: 1.5px solid var(--border-card, #e2e8f0); border-radius: 16px; padding: 22px; box-shadow: var(--shadow-card);">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; flex-wrap: wrap;">
                <div style="display: flex; gap: 14px; align-items: center;">
                  <div style="width: 44px; height: 44px; border-radius: 12px; background: rgba(16, 185, 129, 0.12); color: #10b981; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0;">
                    🛡️
                  </div>
                  <div>
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                      <h3 style="margin: 0; font-size: 17px; font-weight: 800; color: var(--text-main, #0f172a);">Àmbit C · Seguretat Pública i Policial</h3>
                      <span style="background: rgba(16, 185, 129, 0.1); color: #10b981; font-weight: 700; font-size: 11px; padding: 2px 8px; border-radius: 6px;">Temes 16 al 20</span>
                    </div>
                    <p style="margin: 4px 0 0; font-size: 13px; color: var(--text-muted, #64748b);">
                      Forces i Cossos de Seguretat (LO 2/1986), Policia de la Generalitat (Llei 10/1994), Codi Penal, Detenció i Ètica.
                    </p>
                  </div>
                </div>
                <div style="text-align: right; min-width: 110px;">
                  <div style="font-size: 20px; font-weight: 900; color: #10b981;">${estC.progrés}%</div>
                  <div style="font-size: 11px; color: var(--text-dim, #94a3b8);">${estC.contestades} / ${preguntesC.length} contestades</div>
                </div>
              </div>

              <!-- Indicadors detallats Àmbit C -->
              <div style="display: flex; gap: 8px; flex-wrap: wrap; margin: 12px 0 6px; font-size: 12px; font-weight: 800;">
                <span style="background: rgba(16, 185, 129, 0.12); color: #059669; padding: 3px 8px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px;">
                  <span>✅</span> <span>${estC.encerts} encertades</span>
                </span>
                <span style="background: rgba(239, 68, 68, 0.12); color: #dc2626; padding: 3px 8px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px;">
                  <span>❌</span> <span>${estC.errors} fallades</span>
                </span>
                <span style="background: rgba(100, 116, 139, 0.12); color: #475569; padding: 3px 8px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px;">
                  <span>⏳</span> <span>${estC.maiFetes} mai fetes</span>
                </span>
              </div>

              <div style="margin: 6px 0 14px; height: 8px; background: var(--bg-card-subtle, #e2e8f0); border-radius: 999px; overflow: hidden; display: flex;">
                <div style="width: ${preguntesC.length ? (estC.encerts / preguntesC.length) * 100 : 0}%; height: 100%; background: #10b981;" title="Encertades: ${estC.encerts}"></div>
                <div style="width: ${preguntesC.length ? (estC.errors / preguntesC.length) * 100 : 0}%; height: 100%; background: #ef4444;" title="Fallades: ${estC.errors}"></div>
                <div style="width: ${preguntesC.length ? (estC.maiFetes / preguntesC.length) * 100 : 0}%; height: 100%; background: #cbd5e1;" title="Mai fetes: ${estC.maiFetes}"></div>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; padding-top: 4px;">
                <span style="font-size: 12.5px; color: var(--text-muted, #64748b);">
                  📊 <b>${preguntesC.length}</b> preguntes al banc
                </span>
                <div style="display: flex; gap: 8px;">
                  <button class="btn-ambit-test" data-ambit="Àmbit C" style="background: #10b981; color: #fff; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 800; font-size: 13px; cursor: pointer;">
                    ▶ Fer Test
                  </button>
                  <button class="btn-ambit-seccions" data-ambit="Àmbit C" style="background: var(--bg-card-subtle, #f8fafc); color: var(--text-main, #334155); border: 1px solid var(--border-card, #cbd5e1); padding: 8px 14px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer;">
                    📋 Triar Temes
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>

        <!-- VISTA SIMULACRE D'EXAMEN -->
        <div id="subview-examen" class="subview-content" style="display: none;">
          <div style="background: var(--bg-card, #ffffff); border: 1.5px solid var(--border-card, #e2e8f0); padding: 36px 24px; border-radius: 18px; text-align: center; max-width: 680px; margin: 20px auto; box-shadow: var(--shadow-card);">
            <div style="font-size: 40px; margin-bottom: 12px;">⏱️</div>
            <h3 style="margin: 0 0 10px; font-size: 22px; font-weight: 900; color: var(--text-main, #0f172a);">Simulacre Oficial Mossos d'Esquadra</h3>
            <p style="color: var(--text-muted, #64748b); font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
              30 preguntes reals extretes aleatòriament dels Àmbits A, B i C.<br>
              Temps límit: <b>30 minuts</b>. Barem oficial: 4 errors resten 1 encert complet.
            </p>
            <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
              <button id="btn-examen-estudi-30" style="background: #10b981; color: white; border: none; padding: 13px 22px; border-radius: 10px; font-weight: 800; font-size: 14px; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                <span>📚</span> <span>Mode Estudi (Correcció a l'instant)</span>
              </button>
              <button id="btn-examen-real-30" style="background: #2563eb; color: white; border: none; padding: 13px 22px; border-radius: 10px; font-weight: 800; font-size: 14px; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                <span>🎯</span> <span>Mode Examen Real (Resultats al final)</span>
              </button>
            </div>
          </div>
        </div>

        </div>
      </div>
      <div id="test-container" style="display:none;"></div>
    `;

    // Intercanvi de pestanyes internes
    const subtabs = contenedor.querySelectorAll('.tab-interna');
    subtabs.forEach(tab => {
      tab.addEventListener('click', () => {
        subtabs.forEach(t => {
          t.classList.remove('on');
          t.style.background = 'var(--bg-card, #ffffff)';
          t.style.color = 'var(--text-main, #334155)';
          t.style.borderColor = 'var(--border-card, #cbd5e1)';
        });
        tab.classList.add('on');
        tab.style.background = '#007aff';
        tab.style.color = '#ffffff';
        tab.style.borderColor = '#007aff';
        const target = tab.getAttribute('data-subtab');
        const viewEstudia = document.getElementById('subview-estudia');
        const viewExamen = document.getElementById('subview-examen');
        if (viewEstudia) viewEstudia.style.display = target === 'estudia' ? 'block' : 'none';
        if (viewExamen) viewExamen.style.display = target === 'examen' ? 'block' : 'none';
      });
    });

    const btnExamenEstudi = contenedor.querySelector('#btn-examen-estudi-30');
    const btnExamenReal = contenedor.querySelector('#btn-examen-real-30');
    if (btnExamenEstudi) btnExamenEstudi.addEventListener('click', () => iniciarExamenOficial('estudi'));
    if (btnExamenReal) btnExamenReal.addEventListener('click', () => iniciarExamenOficial('examen'));

    const btnQuickMixed = contenedor.querySelector('#btn-quick-mixed-test');
    if (btnQuickMixed) {
      btnQuickMixed.addEventListener('click', () => {
        mostrarSelectorPreguntas("Tots els Àmbits (Barrejat - Mossos)", dades, true);
      });
    }

    // Botons Fer Test per àmbit sencer
    contenedor.querySelectorAll('.btn-ambit-test').forEach(btn => {
      btn.addEventListener('click', () => {
        const nomAmbit = btn.getAttribute('data-ambit') || '';
        let preguntes = [];
        if (nomAmbit.includes("Àmbit A")) preguntes = preguntesA;
        else if (nomAmbit.includes("Àmbit B")) preguntes = preguntesB;
        else if (nomAmbit.includes("Àmbit C")) preguntes = preguntesC;

        if (preguntes.length === 0) {
          mostrarToast(`No hi ha preguntes disponibles per a ${nomAmbit}`, 'info');
          return;
        }
        mostrarSelectorPreguntas(nomAmbit, preguntes, true);
      });
    });

    // Botons Triar Temes per a seleccionar seccions individuals de l'àmbit
    contenedor.querySelectorAll('.btn-ambit-seccions').forEach(btn => {
      btn.addEventListener('click', () => {
        const nomAmbit = btn.getAttribute('data-ambit') || '';
        let preguntes = [];
        if (nomAmbit.includes("Àmbit A")) preguntes = preguntesA;
        else if (nomAmbit.includes("Àmbit B")) preguntes = preguntesB;
        else if (nomAmbit.includes("Àmbit C")) preguntes = preguntesC;

        if (preguntes.length === 0) {
          mostrarToast(`No hi ha preguntes disponibles per a ${nomAmbit}`, 'info');
          return;
        }
        mostrarSelectorSeccions(nomAmbit, preguntes, mostrarTemarioMossos);
      });
    });

    actualitzarBotonsRepasErrors();
  }

  // Temari Oficial de Policia Local Constantí (Temes 1 al 40) - BOPT 31-8-2026
  const TEMARI_PL_OFICIAL = [
    { num: 1, nom: "La Constitució espanyol de 1978: estructura i contingut. Principis generals. La reforma de la constitució. El Tribunal Constitucional." },
    { num: 2, nom: "Drets i deures fonamentals dels espanyols. Garanties i suspensió dels drets i llibertats fonamentals. El Defensor del poble." },
    { num: 3, nom: "Organització territorial de l’Estat (I): Les Comunitats Autònomes. L’Estatut d’Autonomia de Catalunya: estructura, continguts essencials i principis fonamentals. La Generalitat: competències exclusives, de desenvolupament legislatiu i executives." },
    { num: 4, nom: "Organització territorial de l’Estat (II): El municipi i la seva regulació jurídica. Organització i competències." },
    { num: 5, nom: "L’Administració pública: principis d’actuació a l’Administració Pública: eficàcia, jerarquia, descentralització, desconcentració i coordinació." },
    { num: 6, nom: "Submissió de l’Administració A la Llei i al Dret: Fonts del Dret Públic. La llei: classes de llei. El Reglament: concepte i classes." },
    { num: 7, nom: "Les ordenances i els bans. Concepte. Règim d’aprovació. Destinataris. Control del seu compliment." },
    { num: 8, nom: "L’acte administratiu: concepte, classes i elements. La motivació i la forma." },
    { num: 9, nom: "Els ciutadans davant l’Administració: drets i col·laboració." },
    { num: 10, nom: "El procediment administratiu: principis generals. Les fases del procediment administratiu." },
    { num: 11, nom: "Els recursos administratius: Objectes i classes." },
    { num: 12, nom: "El pressupost municipal: Concepte, estructura i regulació." },
    { num: 13, nom: "El règim d’incompatibilitats del personal al servei de les administracions públiques." },
    { num: 14, nom: "Règim disciplinari dels funcionaris públics pertanyents a un cos de Policia Local." },
    { num: 15, nom: "Línies bàsiques sobre transparència i informació pública." },
    { num: 16, nom: "El dret a la protecció de dades com a dret fonamental." },
    { num: 17, nom: "Llei 16/1991, de 10 de juliol, de les Policies Locals de Catalunya (I): Títol 1, De les policies locals i llurs funcions." },
    { num: 18, nom: "Llei orgànica 4/2015, de 30 de març, de Protecció de la Seguretat Ciutadana (I): Capítol I: Disposicions generals. Capítol II. Documentació i identificació personal." },
    { num: 19, nom: "Llei orgànica 4/2015, de 30 de març, de Protecció de la Seguretat Ciutadana (II): Capítol III, Actuacions per al manteniment i restabliment de la seguretat ciutadana." },
    { num: 20, nom: "Llei Orgànica 2/1986 de 13 de març de Forces i Cossos de Seguretat. Definició de forces o cossos de seguretat pública. Les policies locals." },
    { num: 21, nom: "Codi Penal (I): Delictes contra les persones: homicidi i les seves formes; les lesions; delictes contra la llibertat; delictes contra la llibertat sexual; delictes contra la intimitat, el dret a la pròpia imatge i la inviolabilitat del domicili; delictes contra l’honor; delictes contra les relacions familiars." },
    { num: 22, nom: "Codi Penal (II): Delictes contra el patrimoni: el furt i robatori; l’extorsió; el robatori i el furt d’ús de vehicles; la usurpació; l’estafa i l’apropiació indeguda; els danys." },
    { num: 23, nom: "Codi Penal (III): Delictes contra la seguretat del trànsit." },
    { num: 24, nom: "Codi Penal (IV): Delictes contra l’ordre públic: atemptat, resistència i desobediència. Els desordres públics." },
    { num: 25, nom: "Codi penal (V): Delictes comesos pel funcionariat públic contra les garanties constitucionals i contra l’administració pública." },
    { num: 26, nom: "Llei 39/2015, d’1 d’octubre, del Procediment Administratiu Comú de les Administracions Públiques (II): Títol II, De l’activitat de les Administracions Públiques (articles 13 i 18). Títol III, dels actes administratius (articles 34 i 35)." },
    { num: 27, nom: "Llei 4/2003 (I) de 7 d'abril, d’ Ordenació del Sistema de Seguretat Pública de Catalunya: Capítol I, Disposicions generals. Capítol II, Estructura del sistema de seguretat. Capítol V, Relacions amb els ciutadans." },
    { num: 28, nom: "Llei 4/2003, de 7 d’abril, d’ordenació del sistema de seguretat pública de Catalunya (II): Les juntes locals de seguretat. Funcions. Les Meses de Coordinació operatives." },
    { num: 29, nom: "Llei 7/1985, de 2 d’abril, Reguladora de les bases del règim local. Títol I. Disposicions generals. Títol II. El municipi." },
    { num: 30, nom: "El Decret 179/2015, de 4 d'agost, pel qual s'aprova el Reglament del procediment del règim disciplinari aplicable als cossos de Policia local de Catalunya." },
    { num: 31, nom: "El Codi d’ètica de la Policia de Catalunya: Actuació de la Policia. Àmbits d’aplicació: resolució de conflictes i ús de la força, investigació, detenció i privació de llibertat, atenció a les víctimes i testimonis." },
    { num: 32, nom: "El Reglament General de Circulació (I): Títol Preliminar. Títol I, Normes generals de comportament en la circulació." },
    { num: 33, nom: "El Reglament General de Conductors: Títol I, De les autoritzacions administratives, Capítol 1, Del permís i de la llicència de conducció." },
    { num: 34, nom: "Resolució INT/2344/2019, de 5 de setembre, per la qual s'aprova i es dona publicitat al Protocol per a l'abordatge de les infraccions d'odi i discriminació per a les policies locals de Catalunya." },
    { num: 35, nom: "Ordenança Municipal de Convivència Ciutadana a la Via Pública (Constantí)." },
    { num: 36, nom: "Les detencions. Qui pot i qui ha d’efectuar detencions i quines són les circumstàncies que permeten o obliguen a efectuar-les. Forma i durada de les detencions." },
    { num: 37, nom: "L’accident de trànsit. Atestats per accidents de trànsit. Alcoholèmies: normativa reguladora i procediment." },
    { num: 38, nom: "Coneixement del municipi de Constantí." },
    { num: 39, nom: "La jurisdicció penal. Òrgans i competències." },
    { num: 40, nom: "L’atestat policial. Estructura. Valor dels atestats policials." }
  ];

  const PL_MUNICIPI_ACTIU_KEY = 'agentmedina_pl_municipi_actiu_v1';

  function obtenirMunicipiActiuPL() {
    return localStorage.getItem(PL_MUNICIPI_ACTIU_KEY) || 'Constantí';
  }

  function establirMunicipiActiuPL(nom) {
    localStorage.setItem(PL_MUNICIPI_ACTIU_KEY, nom || 'Constantí');
  }

  function obtenirTemariPLPerMunicipi(municipi) {
    const mun = (municipi || 'Constantí').trim();
    return TEMARI_PL_OFICIAL.map(t => {
      if (t.num === 35) {
        if (mun.toLowerCase() === 'constantí' || mun.toLowerCase() === 'constanti') {
          return { ...t };
        }
        if (mun.toLowerCase().startsWith('comú') || mun.toLowerCase() === 'tots') {
          return { num: 35, nom: "Ordenances municipals de convivència ciutadana i ús de la via pública (Marc Comú / General)." };
        }
        return { num: 35, nom: `Ordenances municipals de convivència ciutadana i espai públic (${mun}).` };
      }
      if (t.num === 38) {
        if (mun.toLowerCase() === 'constantí' || mun.toLowerCase() === 'constanti') {
          return { ...t };
        }
        if (mun.toLowerCase().startsWith('comú') || mun.toLowerCase() === 'tots') {
          return { num: 38, nom: "Coneixement del terme municipal, geografia local, carrerer i serveis d'urgències (General)." };
        }
        return { num: 38, nom: `Coneixement del municipi de ${mun} (història, geografia, carrerer i equipaments).` };
      }
      return { ...t };
    });
  }

  function extreureNumeroTemaPL(q) {
    if (!q) return null;
    const txt = `${q.seccio || ''} ${q.tema || ''} ${q.pregunta || ''}`;
    const m = txt.match(/Tema\s*(\d+)/i);
    return m ? parseInt(m[1], 10) : null;
  }

  function preguntaEsAptaPerMunicipi(q, municipiActiu, numTema) {
    if (!q) return false;
    const act = (municipiActiu || 'Constantí').trim().toLowerCase();
    if (act === 'comú (tots)' || act === 'comú' || act === 'comu' || act === 'tots') {
      return true;
    }

    const qMun = (q.municipi || '').trim().toLowerCase();
    if (qMun === 'comú' || qMun === 'comu' || qMun === 'tots') return true;
    if (qMun && qMun === act) return true;

    // Si la pregunta és dels temes específics locals 35 o 38
    if (numTema === 35 || numTema === 38) {
      if (qMun && qMun !== act) return false;
      const txt = `${q.seccio || ''} ${q.tema || ''} ${q.pregunta || ''}`.toLowerCase();
      if (act === 'constantí' || act === 'constanti') {
        return txt.includes('constantí') || txt.includes('constanti') || (!txt.includes('cunit') && !txt.includes('tàrrega') && !txt.includes('cubelles'));
      }
      return txt.includes(act);
    }

    // Per a tots els temes de legislació comuna (1 a 34, 36, 37, 39, 40: Constitució, Penal, Trànsit, Llei 16/1991...)
    // La normativa és idèntica a tota Catalunya, de manera que s'aprofita per a qualsevol municipi
    return true;
  }

  // --- VISTA POLICIA LOCAL ---
  function mostrarTemarioPL() {
    const contenedor = document.getElementById('view-policia-local');
    if (!contenedor) return;

    if (typeof window.renderitzadorTemariPL === 'function') {
      window.renderitzadorTemariPL(contenedor, {
        bancoPoliciaLocal,
        mostrarSelectorPreguntas,
        mostrarSelectorSeccions,
        mostrarToast,
        modalConfirmacio,
        escapeHtml,
        actualitzarBotonsRepasErrors,
        actualitzarRatxaUI,
        mostrarTemarioPL
      });
      return;
    }

    const municipiActiu = obtenirMunicipiActiuPL();
    const municipisDisponibles = carregarMunicipisPL();
    const temariActual = obtenirTemariPLPerMunicipi(municipiActiu);

    // Agrupem preguntes de teoria per número de tema (1 al 40)
    const mapaPreguntesPerTema = new Map();
    (bancoPoliciaLocal || []).forEach(q => {
      const num = extreureNumeroTemaPL(q);
      if (num !== null && preguntaEsAptaPerMunicipi(q, municipiActiu, num)) {
        if (!mapaPreguntesPerTema.has(num)) mapaPreguntesPerTema.set(num, []);
        mapaPreguntesPerTema.get(num).push(q);
      }
    });

    const totalTeoria = (bancoPoliciaLocal || []).filter(q => {
      const num = extreureNumeroTemaPL(q);
      return num !== null && preguntaEsAptaPerMunicipi(q, municipiActiu, num);
    }).length;
    const totalCultura = (bancoPoliciaLocal || []).filter(q => (q.ambit || '').toLowerCase().includes('cultura')).length;

    // Llista unificada de municipis per a les pestanyes superiors
    const pestanyesMunicipi = ['Constantí', 'Cunit', 'Comú (Tots)'];
    municipisDisponibles.forEach(m => {
      if (!pestanyesMunicipi.some(p => p.toLowerCase() === m.toLowerCase())) {
        pestanyesMunicipi.push(m);
      }
    });

    contenedor.innerHTML = `
      <div style="max-width: 1100px; margin: 0 auto; width: 100%;">
        <!-- ZONA DE TEST ACTIU PL (A DALT DE TOT) -->
        <div id="pl-zona-test" style="display: none; margin-bottom: 24px;">
          <div style="background: var(--bg-card, #ffffff); border: 1.5px solid var(--border-card, #e2e8f0); border-radius: 16px; padding: 14px 20px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.04);">
            <button type="button" id="btn-pl-sortir-test" style="display: inline-flex; align-items: center; gap: 6px; background: var(--bg-card-subtle, #f1f5f9); color: var(--text-main, #1e293b); border: 1px solid var(--border-card, #cbd5e1); padding: 8px 14px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer;">
              ← Tornar al temari de Policia Local
            </button>
            <div id="pl-test-titol-superior" style="font-weight: 800; font-size: 14.5px; color: var(--text-main, #0f172a);">
              🚔 Test de Policia Local en curs
            </div>
          </div>
          <div id="test-container-pl"></div>
        </div>

        <div id="pl-contingut-principal" class="teoria-host" style="display:flex;flex-direction:column;gap:18px;">
        <!-- Banner d'accions ràpides Policia Local -->
        <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg-card,#fff);border:1px solid var(--border-card,#e2e8f0);padding:16px 20px;border-radius:14px;box-shadow:var(--shadow-card);flex-wrap:wrap;gap:12px;">
          <div>
            <h3 style="margin:0;font-size:18px;color:var(--text-main,#0f172a);font-weight:900;display:flex;align-items:center;gap:8px;">
              <span>🚔</span> <span>Temari Policia Local</span>
            </h3>
            <p style="margin:4px 0 0;font-size:13px;color:var(--text-muted,#64748b);">
              Temes ordenats estrictament de l'<b>1 al 40</b>, municipis i cultura general.
            </p>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button id="btn-selector-multiple-pl" style="background:#e0f2fe;color:#0369a1;border:1px solid #bae6fd;padding:9px 15px;border-radius:10px;font-weight:800;font-size:13px;cursor:pointer;">
              ☑️ Selector múltiple de temes
            </button>
            <button onclick="window.obrirModalCrearPregunta('pl')" class="btn-crear-pregunta-top" style="font-size:13px;padding:9px 15px;">
              <span>➕</span> <span>Afegir pregunta a P. Local</span>
            </button>
          </div>
        </div>

        <!-- Selector d'Oposició i Municipi Actiu -->
        <div style="background:var(--bg-card,#fff);border:1.5px solid var(--border-card,#e2e8f0);border-radius:16px;padding:16px 20px;box-shadow:var(--shadow-card);">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="font-size:24px;">🏛️</span>
              <div>
                <div style="font-size:16px;font-weight:900;color:var(--text-main,#0f172a);display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                  <span>Oposició activa:</span>
                  <span style="color:#2563eb;background:rgba(37,99,235,0.08);padding:3px 10px;border-radius:8px;border:1.5px solid rgba(37,99,235,0.25);font-size:15px;">
                    ${escapeHtml(municipiActiu)}
                  </span>
                  ${municipiActiu === 'Constantí' ? '<span style="background:#dcfce7;color:#15803d;font-weight:800;font-size:11.5px;padding:2px 8px;border-radius:6px;">BOPT 2026</span>' : ''}
                </div>
                <div style="font-size:12.5px;color:var(--text-muted,#64748b);margin-top:3px;">
                  ${municipiActiu === 'Constantí' 
                    ? 'Temari oficial de la convocatòria de Constantí (38 temes de dret comú + 2 temes locals específics).'
                    : municipiActiu === 'Cunit'
                    ? 'Preparació Cunit: es comparteixen automàticament els 38 temes de legislació comuna i es mostren les preguntes de Cunit.'
                    : 'Temari general compartit vàlid per a qualsevol oposició de policia local a Catalunya.'}
                </div>
              </div>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
              <span style="font-size:12px;font-weight:800;color:var(--text-muted,#64748b);margin-right:2px;">Tria municipi:</span>
              ${pestanyesMunicipi.map(m => {
                const actiu = (m.toLowerCase() === municipiActiu.toLowerCase());
                return `
                  <button type="button" class="btn-pl-canvi-municipi" data-municipi="${escapeHtml(m)}" style="padding:6px 12px;border-radius:9px;font-weight:800;font-size:12.5px;cursor:pointer;border:1.5px solid ${actiu ? '#2563eb' : 'var(--border-card,#cbd5e1)'};background:${actiu ? '#2563eb' : 'var(--bg-card-subtle,#f8fafc)'};color:${actiu ? '#fff' : 'var(--text-main,#334155)'};transition:all .15s ease;">
                    ${m === 'Constantí' ? '🏛️ Constantí' : m === 'Cunit' ? '🏛️ Cunit' : m.startsWith('Comú') ? '🌐 Comú' : '📍 ' + escapeHtml(m)}
                  </button>
                `;
              }).join('')}
            </div>
          </div>
        </div>

        <!-- Barra d'inici ràpid barrejat -->
        <div class="startbar" style="border-radius:14px;">
          <div class="sb-lab">
            <span class="sb-k">Test ràpid</span>
            <span class="sb-lab-row"><span class="sb-t"><span class="mission-copy-wide">🧠 Tots els temes de ${escapeHtml(municipiActiu)} barrejats</span></span></span>
          </div>
          <div class="sb-go"><button class="btn-start btn-start-pl">🔀 Barrejat</button></div>
        </div>

        <!-- LLISTA DELS 40 TEMES ORDENATS 1-40 - MINIMITZABLE -->
        <div style="background:var(--bg-card,#fff);border:1.5px solid var(--border-card,#e2e8f0);border-radius:16px;padding:18px 20px;box-shadow:var(--shadow-card);">
          <button id="pl-toggle-teoria" type="button" style="width:100%;display:flex;justify-content:space-between;align-items:center;background:none;border:none;cursor:pointer;padding:0;text-align:left;gap:12px;flex-wrap:wrap;">
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="font-size:22px;">📘</span>
              <div>
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                  <span style="font-size:16.5px;font-weight:900;color:var(--text-main,#0f172a);">Temari Teòric: ${escapeHtml(municipiActiu)} (Temes 1 al 40)</span>
                  <span style="background:rgba(37,99,235,0.1);color:#2563eb;font-weight:800;font-size:11px;padding:2px 8px;border-radius:6px;">
                    ${municipiActiu === 'Constantí' ? 'BOPT 2026' : municipiActiu === 'Cunit' ? 'Temari Cunit' : 'General'}
                  </span>
                </div>
                <div style="font-size:12.5px;color:var(--text-muted,#64748b);margin-top:2px;">
                  ${municipiActiu === 'Constantí' 
                    ? 'Subprova teòrica específica oficial del municipi de Constantí'
                    : municipiActiu === 'Cunit'
                    ? 'Temes de dret comú compartits + temari local de Cunit'
                    : 'Temari general compartit de Policia Local'}
                </div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="font-size:12.5px;font-weight:700;color:var(--text-muted,#64748b);background:var(--bg-card-subtle,#f1f5f9);padding:4px 10px;border-radius:999px;">
                ${totalTeoria} preguntes disponibles
              </span>
              <span id="pl-teoria-status-btn" style="font-size:12.5px;font-weight:800;color:#2563eb;background:rgba(37,99,235,0.08);padding:5px 12px;border-radius:8px;border:1px solid rgba(37,99,235,0.2);">Minimitzar</span>
              <span id="chev-teoria" style="font-size:15px;color:var(--text-muted,#64748b);font-weight:900;">▼</span>
            </div>
          </button>

          <div id="pl-teoria-panel" style="margin-top:16px;display:block;">
            <!-- 🔍 FILTRE DE TEMES EN DIRECTE -->
            <div style="margin-bottom:12px;">
              <input type="text" id="pl-filtre-input" placeholder="🔍 Cercar tema (ex: Tema 12, Trànsit, Constitució, Detencions, Llei 16/1991)..." style="width:100%;box-sizing:border-box;padding:10px 14px;background:var(--bg-card-subtle,#f8fafc);border:1.5px solid var(--border-card,#cbd5e1);border-radius:10px;font-size:14.5px;color:var(--text-main,#0f172a);outline:none;">
            </div>

            <div id="pl-temes-grid" style="display:flex;flex-direction:column;gap:8px;max-height:560px;overflow-y:auto;padding-right:4px;">
              ${temariActual.map(t => {
                const preguntes = mapaPreguntesPerTema.get(t.num) || [];
                const count = preguntes.length;
                return `
                  <div class="pl-tema-item" data-num="${t.num}" data-text="tema ${t.num} ${t.nom.toLowerCase()}" style="background:var(--bg-card-subtle,#f8fafc);border:1px solid var(--border-card,#e2e8f0);border-radius:10px;padding:11px 14px;display:flex;justify-content:space-between;align-items:center;gap:12px;transition:all .15s ease;">
                    <div style="display:flex;align-items:center;gap:10px;min-width:0;flex:1;">
                      <span style="background:var(--blue,#002B5E);color:var(--gold2,#E8C000);font-weight:900;font-size:12px;padding:4px 9px;border-radius:7px;flex:none;">
                        T${t.num}
                      </span>
                      <div style="min-width:0;">
                        <div style="font-weight:800;color:var(--text-main,#0f172a);font-size:14px;line-height:1.35;">
                          Tema ${t.num}: ${escapeHtml(t.nom)}
                        </div>
                        <div style="font-size:12px;color:var(--text-muted,#64748b);margin-top:2px;">
                          ${count > 0 ? `<b style="color:#16a34a;">${count} preguntes</b> disponibles` : `<span style="color:#94a3b8;">Encara sense preguntes</span>`}
                        </div>
                      </div>
                    </div>
                    <div style="display:flex;gap:6px;flex:none;align-items:center;">
                      ${count > 0 ? `
                        <button class="btn-test-tema-pl" data-num="${t.num}" style="background:#007aff;color:#fff;border:none;border-radius:8px;padding:8px 14px;font-weight:800;font-size:12.5px;cursor:pointer;white-space:nowrap;">
                          ▶ Fer Test (${count})
                        </button>
                      ` : ''}
                      <button class="btn-afegir-pregunta-tema" data-num="${t.num}" data-nom="${escapeHtml('Tema ' + t.num + ' - ' + t.nom)}" title="Afegir pregunta a aquest tema" style="background:#f1f5f9;color:#334155;border:1px solid #cbd5e1;border-radius:8px;padding:8px 11px;font-weight:800;font-size:12px;cursor:pointer;">
                        ➕
                      </button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>

        <!-- 🏛️ APARTAT DE MUNICIPIS -->
        <div style="background:var(--bg-card,#fff);border:1.5px solid var(--border-card,#e2e8f0);border-radius:16px;padding:18px 20px;box-shadow:var(--shadow-card);">
          <button id="pl-toggle-municipis" style="width:100%;display:flex;justify-content:space-between;align-items:center;background:none;border:none;cursor:pointer;padding:0;text-align:left;">
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="font-size:20px;">🏛️</span>
              <div>
                <span style="font-size:16.5px;font-weight:900;color:var(--text-main,#0f172a);">Municipis específics</span>
                <div style="font-size:12.5px;color:var(--text-muted,#64748b);margin-top:2px;">
                  Pots afegir o eliminar qualsevol municipi segons les teves oposicions
                </div>
              </div>
            </div>
            <span id="chev-municipis" style="font-size:14px;color:#64748b;font-weight:900;">▼</span>
          </button>
          <div id="pl-municipis-panel" style="margin-top:16px;display:block;">
            <div style="display:flex;flex-direction:column;gap:8px;">
              ${carregarMunicipisPL().length === 0 ? `
                <div style="font-size:13px;color:var(--text-muted,#64748b);padding:8px 0;">No hi ha cap municipi a la llista. Afegeix-ne un amb el formulari inferior.</div>
              ` : carregarMunicipisPL().map(m => {
                const esActiu = (m.toLowerCase() === municipiActiu.toLowerCase());
                return `
                  <div style="display:flex;align-items:center;gap:8px;">
                    <button class="pl-municipi" data-municipi="${escapeHtml(m)}" style="flex:1;text-align:left;padding:10px 14px;background:${esActiu ? '#eff6ff' : 'var(--bg-card-subtle,#f8fafc)'};border:1.5px solid ${esActiu ? '#3b82f6' : 'var(--border-card,#e2e8f0)'};border-radius:10px;cursor:pointer;font-weight:700;color:var(--text-main,#334155);display:flex;justify-content:space-between;align-items:center;">
                      <span>📍 ${escapeHtml(m)} ${esActiu ? '<b style="color:#2563eb;font-size:12px;margin-left:6px;">(Actiu)</b>' : ''}</span>
                      <span style="font-size:12px;color:var(--text-muted,#64748b);font-weight:600;">Obrir / Activar ▸</span>
                    </button>
                    <button class="pl-municipi-eliminar" data-municipi="${escapeHtml(m)}" title="Eliminar municipi ${escapeHtml(m)}" style="flex:none;border:none;background:#fee2e2;color:#b91c1c;border-radius:10px;width:38px;height:38px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:15px;transition:all .15s ease;">🗑</button>
                  </div>
                `;
              }).join('')}
            </div>
            <div style="display:flex;gap:8px;margin-top:12px;">
              <input id="pl-nou-municipi" type="text" placeholder="Nom del nou municipi (ex: Constantí, Reus, Tarragona...)" style="flex:1;min-width:0;font-size:14px;padding:10px 12px;border:1.5px solid var(--border-card,#cbd5e1);border-radius:10px;background:var(--bg-card-subtle,#fff);color:var(--text-main,#0f172a);">
              <button id="pl-afegir-municipi" style="flex:none;background:var(--blue,#002B5E);color:var(--gold2,#E8C000);border:none;border-radius:10px;padding:0 18px;font-weight:800;font-size:13.5px;cursor:pointer;">➕ Afegir</button>
            </div>
          </div>
        </div>

        <!-- 🌍 APARTAT DE CULTURA GENERAL -->
        <div style="background:var(--bg-card,#fff);border:1px solid var(--border-card,#e2e8f0);border-radius:14px;padding:16px 20px;">
          <button id="pl-btn-cultura" style="width:100%;display:flex;justify-content:space-between;align-items:center;background:none;border:none;cursor:pointer;padding:0;text-align:left;">
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="background:#16a34a;width:12px;height:12px;border-radius:4px;display:inline-block;"></span>
              <span style="font-size:16px;font-weight:900;color:var(--text-main,#0f172a);">🌍 Cultura general</span>
            </div>
            <span style="font-size:13px;font-weight:800;color:#16a34a;background:#dcfce7;padding:4px 10px;border-radius:999px;">
              ${totalCultura} preguntes disponibles ▸
            </span>
          </button>
        </div>
        </div>
      </div>
      <div id="test-container" style="display:none;"></div>
    `;

    // Pestanyes de canvi ràpid de municipi
    contenedor.querySelectorAll('.btn-pl-canvi-municipi').forEach(btn => {
      btn.addEventListener('click', () => {
        const nouMun = btn.dataset.municipi;
        if (!nouMun) return;
        establirMunicipiActiuPL(nouMun);
        mostrarToast(`Oposició canviada a «${nouMun}»`, 'info');
        mostrarTemarioPL();
      });
    });

    // Toggle panell Temari Teòric (Minimitzar / Expandir)
    const toggleTeoria = document.getElementById('pl-toggle-teoria');
    const panelTeoria = document.getElementById('pl-teoria-panel');
    const chevTeoria = document.getElementById('chev-teoria');
    const statusTeoria = document.getElementById('pl-teoria-status-btn');

    const estaMinimitzat = localStorage.getItem('agentmedina_pl_teoria_collapsed') === 'true';
    if (estaMinimitzat && panelTeoria) {
      panelTeoria.style.display = 'none';
      if (chevTeoria) chevTeoria.textContent = '▶';
      if (statusTeoria) statusTeoria.textContent = 'Expandir';
    }

    if (toggleTeoria && panelTeoria) {
      toggleTeoria.addEventListener('click', () => {
        const isHidden = panelTeoria.style.display === 'none';
        panelTeoria.style.display = isHidden ? 'block' : 'none';
        if (chevTeoria) chevTeoria.textContent = isHidden ? '▼' : '▶';
        if (statusTeoria) statusTeoria.textContent = isHidden ? 'Minimitzar' : 'Expandir';
        localStorage.setItem('agentmedina_pl_teoria_collapsed', isHidden ? 'false' : 'true');
      });
    }

    // Filtre ràpid dels 40 temes
    const inputFiltre = document.getElementById('pl-filtre-input');
    if (inputFiltre) {
      inputFiltre.addEventListener('input', () => {
        const q = inputFiltre.value.toLowerCase().trim();
        contenedor.querySelectorAll('.pl-tema-item').forEach(el => {
          const txt = el.getAttribute('data-text') || '';
          el.style.display = (!q || txt.includes(q)) ? 'flex' : 'none';
        });
      });
    }

    // Botó Test Barrejat PL
    const btnStartPL = contenedor.querySelector('.btn-start-pl');
    if (btnStartPL) {
      btnStartPL.addEventListener('click', () => {
        const preguntesAptes = (bancoPoliciaLocal || []).filter(q => {
          const num = extreureNumeroTemaPL(q);
          return preguntaEsAptaPerMunicipi(q, municipiActiu, num);
        });
        mostrarSelectorPreguntas(`Tots els temes (${municipiActiu} - Barrejat)`, preguntesAptes.length ? preguntesAptes : bancoPoliciaLocal, true);
      });
    }

    // Botó Test directe per Tema 1..40
    contenedor.querySelectorAll('.btn-test-tema-pl').forEach(btn => {
      btn.addEventListener('click', () => {
        const num = parseInt(btn.dataset.num, 10);
        const preguntesTema = (mapaPreguntesPerTema.get(num) || []);
        const nomTema = `Tema ${num} (${municipiActiu})`;
        mostrarSelectorPreguntas(nomTema, preguntesTema, false);
      });
    });

    // Botó Afegir pregunta a un Tema específic
    contenedor.querySelectorAll('.btn-afegir-pregunta-tema').forEach(btn => {
      btn.addEventListener('click', () => {
        const nomTema = btn.dataset.nom || `Tema ${btn.dataset.num}`;
        if (typeof window.obrirModalCrearPregunta === 'function') {
          window.obrirModalCrearPregunta('pl', nomTema);
        }
      });
    });

    // Selector múltiple de seccions (per combinar temes a voluntat)
    const btnSelectorMultiple = document.getElementById('btn-selector-multiple-pl');
    if (btnSelectorMultiple) {
      btnSelectorMultiple.addEventListener('click', () => {
        const teoria = (bancoPoliciaLocal || []).filter(q => {
          const num = extreureNumeroTemaPL(q);
          return num !== null && preguntaEsAptaPerMunicipi(q, municipiActiu, num);
        });
        mostrarSelectorSeccions(`Temari Teòric: ${municipiActiu} (Temes 1 al 40)`, teoria, mostrarTemarioPL);
      });
    }

    // Toggle panell municipis
    const toggleMunicipis = document.getElementById('pl-toggle-municipis');
    const panelMunicipis = document.getElementById('pl-municipis-panel');
    const chevMunicipis = document.getElementById('chev-municipis');
    if (toggleMunicipis && panelMunicipis) {
      toggleMunicipis.addEventListener('click', () => {
        const isHidden = panelMunicipis.style.display === 'none';
        panelMunicipis.style.display = isHidden ? 'block' : 'none';
        if (chevMunicipis) chevMunicipis.textContent = isHidden ? '▼' : '▶';
      });
    }

    // Click Municipi
    contenedor.querySelectorAll('.pl-municipi').forEach(btn => {
      btn.addEventListener('click', () => {
        const municipi = btn.dataset.municipi;
        establirMunicipiActiuPL(municipi);
        const filtrades = bancoPoliciaLocal.filter(q => {
          const txt = `${q.seccio || ''} ${q.ambit || ''} ${q.tema || ''} ${q.municipi || ''}`.toLowerCase();
          return txt.includes(municipi.toLowerCase());
        });
        if (!filtrades.length) {
          mostrarToast(`Oposició canviada a «${municipi}». Encara no hi ha preguntes específiques d'aquest terme.`, 'info');
          mostrarTemarioPL();
          return;
        }
        mostrarToast(`Oposició canviada a «${municipi}»`, 'success');
        mostrarSelectorSeccions(municipi, filtrades, mostrarTemarioPL);
      });
    });

    // Eliminar Municipi (amb modal 100% compatible amb iFrame)
    contenedor.querySelectorAll('.pl-municipi-eliminar').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const municipi = btn.dataset.municipi;
        if (!municipi) return;
        modalConfirmacio({
          titol: 'Eliminar municipi',
          missatge: `Vols eliminar «${municipi}» de la llista de municipis?\n\n(Les preguntes que ja tinguis creades es mantindran al teu banc de preguntes).`,
          textBoto: 'Eliminar municipi',
          esPerillos: true,
          onAcceptar: () => {
            eliminarMunicipiPL(municipi);
            if (obtenirMunicipiActiuPL().toLowerCase() === municipi.toLowerCase()) {
              establirMunicipiActiuPL('Constantí');
            }
            mostrarToast(`Municipi «${municipi}» eliminat correctament`, 'success');
            mostrarTemarioPL();
          }
        });
      });
    });

    // Afegir Municipi nou
    const btnAfegirMunicipi = document.getElementById('pl-afegir-municipi');
    const inputNouMunicipi = document.getElementById('pl-nou-municipi');
    if (btnAfegirMunicipi && inputNouMunicipi) {
      const afegir = () => {
        const nom = inputNouMunicipi.value.trim();
        if (!nom) return;
        afegirMunicipiPL(nom);
        mostrarToast(`Municipi «${nom}» afegit correctament`, 'success');
        mostrarTemarioPL();
      };
      btnAfegirMunicipi.addEventListener('click', afegir);
      inputNouMunicipi.addEventListener('keydown', (e) => { if (e.key === 'Enter') afegir(); });
    }

    // Cultura general
    const btnCultura = document.getElementById('pl-btn-cultura');
    if (btnCultura) {
      btnCultura.addEventListener('click', () => {
        const filtrades = bancoPoliciaLocal.filter(q => {
          const txt = `${q.seccio || ''} ${q.ambit || ''} ${q.tema || ''}`.toLowerCase();
          return txt.includes('cultura');
        });
        if (!filtrades.length) {
          alert("Encara no hi ha preguntes de Cultura General.");
          return;
        }
        mostrarSelectorSeccions('Cultura general (Policia Local)', filtrades, mostrarTemarioPL);
      });
    }

    actualitzarBotonsRepasErrors();
    actualitzarRatxaUI();
  }

  // --- VISTA ACTUALITAT ---
  // --- VISTA ACTUALITAT MODERNA I UNIFORME (ESTIL MOSSOS / POLICIA LOCAL) ---
  function mostrarTemarioActualitat() {
    const contenedor = document.getElementById('view-actualitat');
    if (!contenedor) return;

    const dataset = (typeof window.obtenirBancActiu === 'function') 
      ? window.obtenirBancActiu('act') 
      : (Array.isArray(window.bancoActualitat) ? window.bancoActualitat : (Array.isArray(bancoActualitat) ? bancoActualitat : []));
    const estTotal = obtenirEstadistiquesBanc(dataset);

    // Definició dels blocs temàtics d'Actualitat
    const blocsDef = [
      {
        id: 'politica',
        nom: '🏛️ Política, Govern i Institucions',
        desc: 'Estatut d\'Autonomia, Generalitat, Govern d\'Espanya, Unió Europea i tractats internacionals.',
        keywords: ['polític', 'politica', 'govern', 'parlament', 'generalitat', 'estat', 'constitucio', 'senat', 'congres', 'ue', 'unió europea', 'institucio']
      },
      {
        id: 'seguretat',
        nom: '⚖️ Seguretat Pública, Policia i Societat',
        desc: 'Cossos de seguretat, protecció civil, emergències 112, trànsit i normativa ciutadana.',
        keywords: ['seguretat', 'policia', 'mosso', 'guardia', 'emergenc', 'transit', 'societat', 'delict', 'normativ', 'llei']
      },
      {
        id: 'esports',
        nom: '⚽ Esports i Fites Esportives',
        desc: 'Grans campionats, atletes catalans i internacionals, Jocs Olímpics i fites esportives recents.',
        keywords: ['esport', 'futbol', 'olimp', 'campion', 'atlet', 'piloto', 'motor', 'basquet', 'lliga', 'indycar', 'palou', 'pilota']
      },
      {
        id: 'premis',
        nom: '🏆 Premis, Cultura i Ciència',
        desc: 'Premis Nobel, Premis d\'Honor de les Lletres Catalanes, fites científiques i patrimoni.',
        keywords: ['premi', 'nobel', 'cultur', 'lletres', 'cienc', 'tecnolog', 'art', 'patrimoni', 'escriptor', 'sagrada família', 'gaudí']
      },
      {
        id: 'repetides',
        nom: '🔥 Preguntes Clau i Més Repetides',
        desc: 'Preguntes recurrents, conceptes clau i dades indispensables d\'exàmens oficials.',
        keywords: ['repetid', 'clau', 'frequent', 'examen', 'oficial', 'noticia', 'recent']
      }
    ];

    // Assignar preguntes a cada bloc sense duplicitats artificials
    const blocs = blocsDef.map(b => {
      const preguntesBloc = dataset.filter(q => {
        if (!q) return false;
        const cat = (q.categoria || '').toLowerCase();
        if (b.id === 'esports' && (cat === 'esports' || cat.includes('esport'))) return true;
        if (b.id === 'politica' && (cat === 'política' || cat === 'politica' || cat.includes('polític'))) return true;
        if (b.id === 'seguretat' && (cat === 'seguretat' || cat.includes('seguretat'))) return true;
        if (b.id === 'premis' && (cat === 'premis' || cat.includes('premi') || cat.includes('cultur'))) return true;
        if (b.id === 'repetides' && (cat === 'repetides' || cat.includes('repetid') || cat.includes('clau'))) return true;
        const sec = (q.seccio || '').toLowerCase();
        const tem = (q.tema || '').toLowerCase();
        const txt = (q.pregunta || '').toLowerCase();
        return b.keywords.some(kw => cat.includes(kw) || sec.includes(kw) || tem.includes(kw) || txt.includes(kw));
      });
      const estBloc = obtenirEstadistiquesBanc(preguntesBloc);
      return { ...b, preguntes: preguntesBloc, stats: estBloc };
    });

    // Detectar preguntes que no han coincidit amb cap dels 5 blocs predefinits
    const assignadesSet = new Set();
    blocs.forEach(b => b.preguntes.forEach(q => assignadesSet.add(String(q.id))));
    const noAssignades = dataset.filter(q => q && !assignadesSet.has(String(q.id)));
    if (noAssignades.length > 0) {
      const estNoAssignades = obtenirEstadistiquesBanc(noAssignades);
      blocs.push({
        id: 'altres',
        nom: '🌍 Altres Categories i Noves Preguntes',
        desc: 'Preguntes creades manualment, per lot o temes complementaris d\'actualitat.',
        keywords: [],
        preguntes: noAssignades,
        stats: estNoAssignades
      });
    }

    contenedor.innerHTML = `
      <div style="max-width:1100px;margin:0 auto;display:flex;flex-direction:column;gap:20px;">
        
        <!-- ZONA DE TEST ACTIU (A DALT DE TOT DE LA VISTA QUAN ES FA UN TEST) -->
        <div id="act-zona-test-container" style="display:none;">
          <div style="background:var(--bg-card,#ffffff);border:1.5px solid var(--border-card,#e2e8f0);border-radius:16px;padding:14px 20px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;box-shadow:0 4px 15px rgba(0,0,0,0.04);">
            <button type="button" id="btn-act-sortir-test" style="display:inline-flex;align-items:center;gap:6px;background:var(--bg-card-subtle,#f1f5f9);color:var(--text-main,#1e293b);border:1px solid var(--border-card,#cbd5e1);padding:8px 14px;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer;transition:all .15s;">
              ← Tornar als temes d'Actualitat
            </button>
            <div id="act-test-titol-superior" style="font-weight:800;font-size:14.5px;color:var(--text-main,#0f172a);">
              📰 Test d'Actualitat en curs
            </div>
          </div>
          <div id="test-container-actualitat"></div>
        </div>

        <!-- CONTINGUT PRINCIPAL D'ACTUALITAT -->
        <div id="act-contingut-principal" style="display:flex;flex-direction:column;gap:20px;">
          <!-- 1. HERO BANNER UNIFORME -->
          <div style="background:linear-gradient(135deg, #0f172a 0%, #1e293b 100%);color:#ffffff;border-radius:18px;padding:24px 28px;box-shadow:0 10px 30px rgba(15,23,42,0.25);position:relative;overflow:hidden;">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:16px;">
              <div style="display:flex;align-items:center;gap:16px;">
                <div style="width:52px;height:52px;border-radius:14px;background:rgba(255,255,255,0.12);display:flex;align-items:center;justify-content:center;font-size:28px;flex:none;border:1px solid rgba(255,255,255,0.2);">
                  📰
                </div>
                <div>
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                    <span style="background:rgba(239,68,68,0.25);color:#fca5a5;border:1px solid rgba(239,68,68,0.4);font-size:11px;font-weight:800;padding:2px 8px;border-radius:6px;letter-spacing:0.04em;">
                      ACTUALITZAT 2026
                    </span>
                    <span style="font-size:12.5px;color:#94a3b8;font-weight:600;">Oposicions Policials</span>
                  </div>
                  <h2 style="margin:0;font-size:22px;font-weight:800;letter-spacing:-0.02em;">Actualitat i Seguretat Pública</h2>
                  <p style="margin:6px 0 0;font-size:13.5px;color:#cbd5e1;max-width:650px;">
                    Coneixement de l'entorn polític, social, institucional, cultural, esportiu i novetats policials clau.
                  </p>
                </div>
              </div>

              <!-- Botons d'acció ràpida -->
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <button type="button" onclick="window.obrirModalCrearPregunta('act')" style="background:rgba(255,255,255,0.15);color:#ffffff;border:1px solid rgba(255,255,255,0.25);padding:9px 14px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all .15s;">
                  ➕ Nova Pregunta
                </button>
                <button type="button" onclick="window.obrirModalImportarLot('act')" style="background:rgba(255,255,255,0.15);color:#ffffff;border:1px solid rgba(255,255,255,0.25);padding:9px 14px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all .15s;">
                  ⚡ Importar Lot / IA
                </button>
                <button type="button" onclick="window.obrirModalGestorActualitat()" style="background:#fee2e2;color:#b91c1c;border:1.5px solid #fca5a5;padding:9px 14px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all .15s;" title="Revisar o esborrar preguntes que han quedat desactualitzades">
                  🗑️ Esborrar Desactualitzades
                </button>
                <button type="button" id="btn-act-barrejat-hero" style="background:#007aff;color:#ffffff;border:none;padding:9px 16px;border-radius:10px;font-size:13.5px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:6px;box-shadow:0 4px 14px rgba(0,122,255,0.4);transition:all .15s;">
                  🔀 Barrejat
                </button>
              </div>
            </div>
          </div>

          <!-- 2. PANELL DE PROGRÉS GLOBAL (FORMAT UNIFORME MOSSOS I PL) -->
          <div style="background:var(--bg-card,#ffffff);border:1.5px solid var(--border-card,#e2e8f0);border-radius:16px;padding:20px 24px;box-shadow:0 4px 15px rgba(0,0,0,0.03);">
            <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
              <div>
                <span style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-muted,#64748b);">
                  Progrés General del Banc d'Actualitat
                </span>
                <div style="font-size:13.5px;font-weight:700;color:var(--text-main,#1e293b);margin-top:2px;">
                  ${estTotal.encerts} encertades · ${estTotal.errors} fallades · ${estTotal.maiFetes} que encara no has fet mai
                </div>
              </div>
              <div style="text-align:right;">
                <span style="font-size:22px;font-weight:900;color:#007aff;">${estTotal.progrés}%</span>
                <span style="font-size:12.5px;color:var(--text-muted,#64748b);font-weight:600;margin-left:4px;">dominat (${estTotal.contestades} de ${estTotal.total})</span>
              </div>
            </div>

            <!-- Barra tricolor de progrés (Verd encertades, Vermell fallades, Gris mai fetes) -->
            <div style="height:10px;background:var(--bg-card-subtle,#e2e8f0);border-radius:999px;overflow:hidden;display:flex;margin-bottom:16px;">
              <div style="height:100%;width:${estTotal.total ? (estTotal.encerts / estTotal.total) * 100 : 0}%;background:#10b981;transition:width .4s;" title="Encertades: ${estTotal.encerts}"></div>
              <div style="height:100%;width:${estTotal.total ? (estTotal.errors / estTotal.total) * 100 : 0}%;background:#ef4444;transition:width .4s;" title="Fallades: ${estTotal.errors}"></div>
              <div style="height:100%;width:${estTotal.total ? (estTotal.maiFetes / estTotal.total) * 100 : 0}%;background:#cbd5e1;transition:width .4s;" title="Mai fetes: ${estTotal.maiFetes}"></div>
            </div>

            <!-- 3 Badges d'estat uniformes -->
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
              <div style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.25);color:#047857;font-size:12px;font-weight:700;">
                <span>✅</span> <span><b>${estTotal.encerts}</b> Encertades</span>
              </div>
              <div style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);color:#b91c1c;font-size:12px;font-weight:700;">
                <span>❌</span> <span><b>${estTotal.errors}</b> Fallades</span>
              </div>
              <div style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;background:var(--bg-card-subtle,#f1f5f9);border:1px solid var(--border-card,#cbd5e1);color:var(--text-main,#475569);font-size:12px;font-weight:700;">
                <span>⏳</span> <span><b>${estTotal.maiFetes}</b> Que encara no has fet mai</span>
              </div>
            </div>
          </div>

          <!-- 3. BLOCS TEMÀTICS D'ACTUALITAT -->
          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
              <h3 style="margin:0;font-size:17px;font-weight:800;color:var(--text-main,#0f172a);">
                📚 Blocs Temàtics d'Actualitat
              </h3>
              <span style="font-size:12.5px;color:var(--text-muted,#64748b);">5 blocs disponibles</span>
            </div>

            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;">
              ${blocs.map(b => `
                <div style="background:var(--bg-card,#ffffff);border:1.5px solid var(--border-card,#e2e8f0);border-radius:14px;padding:18px;display:flex;flex-direction:column;justify-content:space-between;gap:14px;box-shadow:0 3px 12px rgba(0,0,0,0.03);transition:transform .15s, border-color .15s;">
                  <div>
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:6px;">
                      <h4 style="margin:0;font-size:15px;font-weight:800;color:var(--text-main,#0f172a);line-height:1.35;">${escapeHtml(b.nom)}</h4>
                      <span style="background:var(--bg-card-subtle,#f1f5f9);color:var(--text-main,#475569);border:1px solid var(--border-card,#cbd5e1);font-size:11px;font-weight:700;padding:3px 8px;border-radius:6px;white-space:nowrap;">
                        ${b.preguntes.length} preguntes
                      </span>
                    </div>
                    <p style="margin:0 0 12px;font-size:12.5px;color:var(--text-muted,#64748b);line-height:1.4;">${escapeHtml(b.desc)}</p>
                    
                    <!-- Progrés del bloc -->
                    <div style="display:flex;justify-content:space-between;font-size:11.5px;font-weight:700;color:var(--text-muted,#64748b);margin-bottom:6px;">
                      <span>Dominat: <b style="color:#007aff;">${b.stats.progrés}%</b></span>
                      <span>${b.stats.contestades}/${b.stats.total} contestades</span>
                    </div>
                    <div style="height:6px;background:var(--bg-card-subtle,#e2e8f0);border-radius:999px;overflow:hidden;display:flex;margin-bottom:10px;">
                      <div style="height:100%;width:${b.stats.total ? (b.stats.encerts / b.stats.total) * 100 : 0}%;background:#10b981;"></div>
                      <div style="height:100%;width:${b.stats.total ? (b.stats.errors / b.stats.total) * 100 : 0}%;background:#ef4444;"></div>
                      <div style="height:100%;width:${b.stats.total ? (b.stats.maiFetes / b.stats.total) * 100 : 0}%;background:#cbd5e1;"></div>
                    </div>

                    <!-- Mini badges estat -->
                    <div style="display:flex;gap:6px;font-size:11px;font-weight:700;flex-wrap:wrap;">
                      <span style="color:#047857;background:rgba(16,185,129,0.1);padding:2px 6px;border-radius:4px;">✅ ${b.stats.encerts}</span>
                      <span style="color:#b91c1c;background:rgba(239,68,68,0.1);padding:2px 6px;border-radius:4px;">❌ ${b.stats.errors}</span>
                      <span style="color:var(--text-main,#475569);background:var(--bg-card-subtle,#f1f5f9);padding:2px 6px;border-radius:4px;">⏳ ${b.stats.maiFetes} mai fetes</span>
                    </div>
                  </div>

                  <div style="display:flex;gap:8px;margin-top:6px;">
                    <button type="button" class="btn-act-fer-test" data-bloc-nom="${escapeHtml(b.nom)}" data-bloc-id="${b.id}" style="flex:1;padding:9px 12px;background:#007aff;color:#ffffff;border:none;border-radius:8px;font-weight:800;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;transition:all .15s;">
                      ▶️ Fer Test
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    // Funció per activar la zona de test a dalt de tot de la pantalla
    const prepararZonaTestActualitat = (titolTest) => {
      const zonaTest = document.getElementById('act-zona-test-container');
      const contingutPrincipal = document.getElementById('act-contingut-principal');
      const titolEl = document.getElementById('act-test-titol-superior');
      if (zonaTest) zonaTest.style.display = 'block';
      if (contingutPrincipal) contingutPrincipal.style.display = 'none';
      if (titolEl && titolTest) titolEl.innerHTML = `📰 ${escapeHtml(titolTest)}`;
      activeTestContainerId = 'test-container-actualitat';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Botó per sortir del test i tornar als temes
    const btnSortir = document.getElementById('btn-act-sortir-test');
    if (btnSortir) {
      btnSortir.addEventListener('click', () => {
        mostrarTemarioActualitat();
      });
    }

    // Botó barrejat a la capçalera
    const btnBarrejatHero = document.getElementById('btn-act-barrejat-hero');
    if (btnBarrejatHero) {
      btnBarrejatHero.addEventListener('click', () => {
        prepararZonaTestActualitat("Actualitat (Barrejat - Tots els blocs)");
        mostrarSelectorPreguntas("Actualitat (Barrejat - Tots els blocs)", dataset, true);
      });
    }

    // Botons "Fer Test" de cada bloc
    contenedor.querySelectorAll('.btn-act-fer-test').forEach(btn => {
      btn.addEventListener('click', () => {
        const blocId = btn.dataset.blocId;
        const blocNom = btn.dataset.blocNom || "Bloc d'Actualitat";
        const blocObj = blocs.find(b => b.id === blocId);
        const preguntes = (blocObj && blocObj.preguntes.length > 0) ? blocObj.preguntes : dataset;
        
        prepararZonaTestActualitat(blocNom);
        mostrarSelectorPreguntas(blocNom, preguntes, true);
      });
    });

    actualitzarBotonsRepasErrors();
  }

  // --- GESTOR DE PREGUNTES (afegir / editar, individual i massiu) ---
  // Com que l'app encara és estàtica (sense servidor/base de dades), les
  // preguntes que es creen o editen aquí es guarden a localStorage i es
  // fusionen amb els bancs originals en carregar l'app (veure més amunt,
  // a "CARGA DE BANCOS DE DATOS"). Per fer-les permanents de debò cal
  // exportar-les (botó "Exportar JSON") i enganxar-les al fitxer .js
  // corresponent (Mossos_Preguntas.js / P.L.Preguntas.js / Actualidad_preguntas.js).
  // (CUSTOM_PREGUNTES_KEY està definida a l'inici del fitxer)

  // --- CORRECCIONS (OVERRIDES) A PREGUNTES DEL BANC ORIGINAL ---
  // Quan s'edita, des del Gestor, una pregunta que NO és personalitzada
  // (és a dir, que ve d'un dels fitxers .js originals), no la podem
  // modificar directament (és de només lectura al navegador). En comptes
  // d'això guardem només els canvis fets, indexats per ID, i els apliquem
  // per sobre de la pregunta original cada cop que es carrega l'app.
  // (OVERRIDES_PREGUNTES_KEY està definida a l'inici del fitxer)

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

  // Funcions per sincronitzar canvis directament amb el fitxer .js del servidor
  function enviarPreguntaAlFitxerServidor(banc, pregunta, esNova = false) {
    return fetch('/api/modificar-pregunta-fitxer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ banc, pregunta, esNova })
    })
    .then(r => r.json())
    .then(res => {
      if (res.success) {
        console.log(`[AgentMedina] Pregunta ${pregunta.id} desada al fitxer .js correctament.`);
        if (typeof mostrarToast === 'function') {
          mostrarToast('💾 Canvis guardats directament al fitxer .js!', 'success');
        }
      }
      return res;
    })
    .catch(err => {
      console.warn('[AgentMedina] Nota: No s\'ha pogut contactar amb el servidor per desar al .js:', err);
      return { success: false, error: err };
    });
  }
  window.enviarPreguntaAlFitxerServidor = enviarPreguntaAlFitxerServidor;

  function eliminarPreguntaDelFitxerServidor(banc, id) {
    return fetch('/api/eliminar-pregunta-fitxer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ banc, id })
    })
    .then(r => r.json())
    .then(res => {
      if (res.success) {
        console.log(`[AgentMedina] Pregunta ${id} eliminada del fitxer .js correctament.`);
        if (typeof mostrarToast === 'function') {
          mostrarToast('🗑️ Pregunta eliminada del fitxer .js!', 'info');
        }
      }
      return res;
    })
    .catch(err => {
      console.warn('[AgentMedina] Error eliminant del fitxer .js:', err);
      return { success: false, error: err };
    });
  }
  window.eliminarPreguntaDelFitxerServidor = eliminarPreguntaDelFitxerServidor;

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

    // Sincronitzar amb el fitxer .js
    normalitzades.forEach(q => {
      enviarPreguntaAlFitxerServidor(banc, q, true);
    });

    return normalitzades.length;
  }
  window.afegirPreguntesCustom = afegirPreguntesCustom;
  window.obtenirBancActiu = obtenirBancActiu;
  window.carregarPreguntesCustom = carregarPreguntesCustom;

  function eliminarPreguntaCustom(banc, id) {
    const dades = carregarPreguntesCustom();
    dades[banc] = dades[banc].filter(q => q.id !== id);
    guardarPreguntesCustom(dades);

    // Eliminar de l'array viu en memòria
    const arrayViu = obtenirBancActiu(banc);
    if (Array.isArray(arrayViu)) {
      const idx = arrayViu.findIndex(q => q && String(q.id).trim() === String(id).trim());
      if (idx !== -1) arrayViu.splice(idx, 1);
    }

    // Sincronitzar eliminació amb el fitxer .js
    eliminarPreguntaDelFitxerServidor(banc, id);
  }
  window.eliminarPreguntaCustom = function (banc, id) {
    if (!confirm('Eliminar aquesta pregunta? Es borrarà permanentment del fitxer .js.')) return;
    eliminarPreguntaCustom(banc, id);
    mostrarGestorPreguntes(banc);
  };

  // Desa els canvis fets a una pregunta EXISTENT (identificada per ID).
  // Si l'ID pertany a una pregunta personalitzada, actualitza aquell
  // registre; si pertany al banc original, es desa com a "override".
  // També actualitza la còpia en memòria perquè el canvi es vegi a l'instant
  // i sincronitza DIRECTAMENT amb el fitxer .js al servidor.
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

    // Sincronitzem directament amb el fitxer .js!
    enviarPreguntaAlFitxerServidor(banc, normalitzada, false);

    return normalitzada;
  }

  // Omple el formulari d'"Afegir / editar pregunta" amb les dades d'una
  // pregunta existent i el deixa en "mode edició".
  function carregarPreguntaAFormulari(banc, q) {
    if (!q) return;
    const btnGuardar = document.getElementById('ed-guardar-una');
    if (btnGuardar) {
      btnGuardar.dataset.editId = q.id;
      btnGuardar.textContent = '💾 Guardar canvis directament al fitxer .js';
    }
    const btnCancelar = document.getElementById('ed-cancelar-edicio');
    if (btnCancelar) btnCancelar.style.display = 'inline-block';
    const avis = document.getElementById('ed-avis-edicio');
    if (avis) {
      avis.style.display = 'inline-block';
      avis.textContent = `✏️ Editant pregunta ${q.id} (es guardarà al fitxer .js)`;
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

    const nomBanc = banc === 'pl' ? 'Policia Local (P_L_Preguntas.js)' : (banc === 'act' ? 'Actualitat (Actualidad_preguntas.js)' : 'Mossos d\'Esquadra (Mossos_Preguntas.js)');

    contenedor.innerHTML = `
      <style>
        .ed-lbl{display:flex;flex-direction:column;gap:4px;font-weight:700;color:#334155;font-size:.85rem;}
        .ed-lbl input,.ed-lbl select,.ed-lbl textarea{font:inherit;font-size:15px;padding:9px 11px;border:1.5px solid #E2E8F0;border-radius:9px;}
        .ed-tabs button{border:none;background:#f1f5f9;color:#475569;padding:9px 16px;border-radius:9px;font-weight:800;cursor:pointer;font-size:.88rem;transition:all .2s;}
        .ed-tabs button.on{background:var(--blue,#002B5E);color:#fff;}
      </style>
      <div style="max-width:920px;margin:0 auto;display:flex;flex-direction:column;gap:18px;">
        <div style="background:var(--bg-card,#fff);border:1px solid var(--border-card,#e2e8f0);border-radius:12px;padding:16px 20px;">
          <h2 style="margin:0 0 6px;color:var(--text-main,#0f172a);font-size:1.3rem;">✏️ Gestor de preguntes</h2>
          <p style="margin:0;color:var(--text-muted,#64748b);font-size:.88rem;line-height:1.5;">
            Cerca qualsevol pregunta per text o ID, modifica el seu enunciat, opcions o explicació, i <b>els canvis es desaran directament al fitxer .js</b> corresponent al servidor (<span style="color:#0284c7;font-weight:700;">${nomBanc}</span>).
          </p>
        </div>

        <div class="ed-tabs" style="display:flex;gap:8px;flex-wrap:wrap;">
          <button data-banc="mossos" class="${banc === 'mossos' ? 'on' : ''}">🔵 Mossos d'Esquadra</button>
          <button data-banc="pl" class="${banc === 'pl' ? 'on' : ''}">🚔 Policia Local</button>
          <button data-banc="act" class="${banc === 'act' ? 'on' : ''}">📰 Actualitat</button>
        </div>

        <!-- 🔎 CERCADOR PER TEXT I ID DIRECTE -->
        <div style="background:var(--bg-card,#fff);border:1px solid var(--border-card,#e2e8f0);border-radius:12px;padding:18px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:8px;">
            <h3 style="margin:0;font-size:1.02rem;color:var(--blue,#002B5E);font-weight:800;">🔎 Cercar preguntes per modificar</h3>
            <span style="font-size:12px;color:#64748b;">Escriu per filtrar a l'instant</span>
          </div>
          <p style="margin:0 0 10px;color:var(--text-muted,#64748b);font-size:.83rem;line-height:1.5;">
            Pots escriure qualsevol paraula del text de la pregunta o el seu ID (p. ex. <code>GUB_001</code>, <code>MOSSOS_505</code>, <code>Constitució</code>, <code>trànsit</code>):
          </p>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <input id="ed-cerca-text" type="text" placeholder="🔍 Escriu una paraula clau o ID..." style="flex:1;min-width:220px;font-size:15px;padding:10px 12px;border:1.5px solid #CBD5E1;border-radius:9px;">
            <button id="ed-cercar-btn" style="background:var(--blue,#002B5E);color:#fff;border:none;border-radius:9px;padding:10px 20px;font-weight:800;cursor:pointer;">🔎 Cercar</button>
          </div>
          <div id="ed-cerca-resultat" style="margin-top:14px;"></div>
        </div>

        <!-- ➕ / ✏️ FORMULARI D'EDICIÓ DIRECTA -->
        <div id="ed-formulari-anchor" style="background:var(--bg-card,#fff);border:1px solid var(--border-card,#e2e8f0);border-radius:12px;padding:18px;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
            <h3 id="ed-titol-formulari" style="margin:0;font-size:1.02rem;color:var(--blue,#002B5E);font-weight:800;">➕ Afegir / modificar pregunta al .js</h3>
            <span id="ed-avis-edicio" style="display:none;background:#fef9c3;color:#854d0e;font-weight:800;font-size:.82rem;padding:6px 12px;border-radius:999px;border:1px solid #fde047;"></span>
          </div>
          <div style="display:flex;flex-direction:column;gap:12px;">
            ${campsExtraEditor(banc)}
            <label class="ed-lbl">Enunciat de la pregunta <textarea id="ed-pregunta" rows="2" placeholder="Text complet de la pregunta..."></textarea></label>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;">
              <label class="ed-lbl">Opció A <input id="ed-op0" type="text" placeholder="Opció A..."></label>
              <label class="ed-lbl">Opció B <input id="ed-op1" type="text" placeholder="Opció B..."></label>
              <label class="ed-lbl">Opció C <input id="ed-op2" type="text" placeholder="Opció C..."></label>
              <label class="ed-lbl">Opció D (opcional) <input id="ed-op3" type="text" placeholder="Opció D..."></label>
            </div>
            <label class="ed-lbl">Resposta correcta
              <select id="ed-resposta">
                <option value="0">Opció A</option>
                <option value="1">Opció B</option>
                <option value="2">Opció C</option>
                <option value="3">Opció D</option>
              </select>
            </label>
            <label class="ed-lbl">Explicació o referència oficial (opcional) <textarea id="ed-explicacio" rows="2" placeholder="Articles, normativa o justificació de la resposta..."></textarea></label>
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:6px;">
              <button id="ed-guardar-una" style="background:#0284c7;color:#fff;border:none;border-radius:9px;padding:11px 22px;font-weight:800;font-size:.9rem;cursor:pointer;display:flex;align-items:center;gap:6px;">
                <span>💾</span> <span>Guardar directament al fitxer .js</span>
              </button>
              <button id="ed-cancelar-edicio" type="button" style="display:none;background:#f1f5f9;color:#334155;border:none;border-radius:9px;padding:11px 16px;font-weight:800;cursor:pointer;">✖ Cancel·lar edició</button>
              <span id="ed-missatge" style="font-weight:700;font-size:.85rem;"></span>
            </div>
          </div>
        </div>

        <!-- 📥 IMPORTACIÓ EN MASSA -->
        <div style="background:var(--bg-card,#fff);border:1px solid var(--border-card,#e2e8f0);border-radius:12px;padding:18px;">
          <h3 style="margin:0 0 6px;font-size:1rem;color:var(--blue,#002B5E);">📥 Afegir en massa (JSON)</h3>
          <p style="margin:0 0 10px;color:#64748b;font-size:.82rem;line-height:1.5;">
            Enganxa un array JSON de preguntes amb els camps <code>pregunta</code>, <code>opcions</code>, <code>resposta</code>, <code>explicacio</code>${banc === 'mossos' ? ', <code>ambit</code>, <code>seccio</code>' : banc === 'pl' ? ', <code>tema</code>, <code>seccio</code>' : ', <code>categoria</code>, <code>seccio</code>'}.
          </p>
          <textarea id="ed-bulk" rows="6" style="width:100%;box-sizing:border-box;font-family:monospace;font-size:.82rem;padding:10px;border:1.5px solid #E2E8F0;border-radius:9px;" placeholder='[
  { "pregunta": "...", "opcions": ["...","...","...","..."], "resposta": 0, "explicacio": "..." }
]'></textarea>
          <div style="margin-top:10px;">
            <button id="ed-guardar-bulk" style="background:#eef6ff;color:#0057a8;border:1px solid #bfdbfe;border-radius:9px;padding:10px 18px;font-weight:800;cursor:pointer;">📥 Importar totes al .js</button>
            <span id="ed-missatge-bulk" style="margin-left:10px;font-weight:700;font-size:.85rem;"></span>
          </div>
        </div>

        <!-- 📋 LLISTA DE PREGUNTES PERSONALITZADES -->
        <div style="background:var(--bg-card,#fff);border:1px solid var(--border-card,#e2e8f0);border-radius:12px;padding:18px;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap;">
            <h3 style="margin:0;font-size:1rem;color:var(--blue,#002B5E);">📋 Preguntes personalitzades d'aquest banc</h3>
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
        const textPregunta = (document.getElementById('ed-pregunta')?.value || '').trim();
        if (!textPregunta) throw new Error('Cal escriure l\'enunciat de la pregunta.');
        if (opcions.length < 2) throw new Error('Cal omplir almenys dues opcions.');

        const q = {
          ...extra,
          pregunta: textPregunta,
          opcions,
          resposta: parseInt(document.getElementById('ed-resposta')?.value || '0', 10),
          explicacio: document.getElementById('ed-explicacio')?.value || ''
        };
        const editId = document.getElementById('ed-guardar-una')?.dataset.editId || '';
        if (editId) {
          desarPreguntaEditada(banc, editId, q);
          msg.style.color = '#15803d';
          msg.textContent = '✅ Pregunta actualitzada i guardada al fitxer .js!';
        } else {
          afegirPreguntesCustom(banc, [q]);
          msg.style.color = '#15803d';
          msg.textContent = '✅ Pregunta nova guardada al fitxer .js!';
        }
        setTimeout(() => mostrarGestorPreguntes(banc), 900);
      } catch (e) {
        msg.style.color = '#b91c1c';
        msg.textContent = `❌ ${e.message}`;
      }
    });

    document.getElementById('ed-cancelar-edicio')?.addEventListener('click', () => mostrarGestorPreguntes(banc));

    // --- CERCADOR MILLORAT (Per text o ID) ---
    const cercaInput = document.getElementById('ed-cerca-text');
    const cercaResultat = document.getElementById('ed-cerca-resultat');

    function cercarPreguntes() {
      if (!cercaResultat) return;
      const query = (cercaInput?.value || '').trim().toLowerCase();
      if (!query) {
        cercaResultat.innerHTML = '';
        return;
      }

      const dataset = obtenirBancActiu(banc) || [];
      const trobades = dataset.filter(q => {
        if (!q) return false;
        const qId = String(q.id || '').toLowerCase();
        const qPregunta = String(q.pregunta || '').toLowerCase();
        const qSeccio = String(q.seccio || '').toLowerCase();
        return qId.includes(query) || qPregunta.includes(query) || qSeccio.includes(query);
      }).slice(0, 15); // Màxim 15 resultats per no saturar

      if (!trobades.length) {
        cercaResultat.innerHTML = `<p style="color:#b91c1c;font-weight:700;font-size:.85rem;margin:6px 0 0;">❌ No s'ha trobat cap pregunta que coincideixi amb «${escapeHtml(query)}» en aquest banc.</p>`;
        return;
      }

      cercaResultat.innerHTML = `
        <div style="font-weight:800;color:#334155;font-size:.82rem;margin-bottom:8px;">
          S'han trobat ${trobades.length} preguntes coincidents:
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;max-height:420px;overflow-y:auto;padding-right:4px;">
          ${trobades.map((q, idx) => `
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:8px;">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap;">
                <span style="background:#e0f2fe;color:#0369a1;font-weight:800;font-size:.76rem;padding:3px 8px;border-radius:6px;">${escapeHtml(q.id)}</span>
                <span style="color:#64748b;font-size:.76rem;">${escapeHtml(q.seccio || q.tema || q.categoria || 'Sense tema')}</span>
              </div>
              <div style="font-weight:700;color:#0f172a;font-size:.88rem;line-height:1.4;">${escapeHtml(q.pregunta)}</div>
              <div style="display:flex;flex-direction:column;gap:3px;font-size:.8rem;color:#475569;">
                ${(q.opcions || []).map((op, opIdx) => `
                  <div style="${opIdx === q.resposta ? 'font-weight:700;color:#16a34a;' : ''}">
                    ${opIdx === q.resposta ? '✓' : '•'} <b>${String.fromCharCode(65 + opIdx)}:</b> ${escapeHtml(op)}
                  </div>
                `).join('')}
              </div>
              ${q.explicacio ? `<div style="font-size:.76rem;color:#64748b;background:#fff;padding:6px 10px;border-radius:6px;border:1px solid #e2e8f0;">💡 <i>${escapeHtml(q.explicacio)}</i></div>` : ''}
              <div style="display:flex;gap:8px;margin-top:4px;flex-wrap:wrap;">
                <button class="btn-editar-trobada" data-idx="${idx}" style="background:#0284c7;color:#fff;border:none;border-radius:8px;padding:7px 14px;font-weight:800;font-size:.8rem;cursor:pointer;">
                  ✏️ Modificar al formulari
                </button>
                <button class="btn-eliminar-trobada" data-id="${escapeHtml(q.id)}" style="background:#fff;color:#b91c1c;border:1px solid #fecaca;border-radius:8px;padding:7px 12px;font-weight:800;font-size:.8rem;cursor:pointer;">
                  🗑️ Eliminar del .js
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `;

      cercaResultat.querySelectorAll('.btn-editar-trobada').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.idx, 10);
          const q = trobades[idx];
          if (q) {
            carregarPreguntaAFormulari(banc, q);
            const anchor = document.getElementById('ed-formulari-anchor');
            if (anchor) anchor.scrollIntoView({ behavior: 'smooth' });
          }
        });
      });

      cercaResultat.querySelectorAll('.btn-eliminar-trobada').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          if (!id) return;
          if (!confirm(`Segur que vols eliminar permanentment la pregunta ${id} del fitxer .js?`)) return;
          eliminarPreguntaCustom(banc, id);
          cercarPreguntes();
        });
      });
    }

    document.getElementById('ed-cercar-btn')?.addEventListener('click', cercarPreguntes);
    cercaInput?.addEventListener('input', () => {
      clearTimeout(cercaInput._deb);
      cercaInput._deb = setTimeout(cercarPreguntes, 250);
    });
    cercaInput?.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') { ev.preventDefault(); cercarPreguntes(); }
    });

    const msgBulk = document.getElementById('ed-missatge-bulk');
    document.getElementById('ed-guardar-bulk')?.addEventListener('click', () => {
      try {
        const text = document.getElementById('ed-bulk')?.value || '[]';
        const arr = JSON.parse(text);
        if (!Array.isArray(arr)) throw new Error('Cal enganxar un array JSON ([ {...}, {...} ]).');
        const n = afegirPreguntesCustom(banc, arr);
        msgBulk.style.color = '#15803d';
        msgBulk.textContent = `✅ ${n} preguntes importades directament al fitxer .js.`;
        setTimeout(() => mostrarGestorPreguntes(banc), 900);
      } catch (e) {
        msgBulk.style.color = '#b91c1c';
        msgBulk.textContent = `❌ ${e.message}`;
      }
    });

    document.getElementById('ed-exportar')?.addEventListener('click', () => exportarPreguntesCustom(banc));
  }
  window.mostrarGestorPreguntes = mostrarGestorPreguntes;
  window.mostrarGestorPreguntes = mostrarGestorPreguntes;

  // --- SELECTOR DE PREGUNTAS (MODAL ACCESSIBLE SENSE FER SCROLL A BAIX) ---
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
    const totalDisponibles = dataset.length;

    if (totalDisponibles === 0) {
      alert("No hi ha preguntes disponibles per a aquesta selecció.");
      return;
    }

    // Eliminem qualsevol modal selector previ
    const anticModal = document.getElementById('modal-selector-preguntes-directe');
    if (anticModal) anticModal.remove();

    // Amaguem el "Tria un tema" i els botons d'àmbit perquè la vista quedi neta
    document.querySelectorAll('.hub').forEach(h => { h.style.display = 'none'; });

    // Creem el modal centrat en pantalla perquè l'usuari NO hagi d'anar al final de la pàgina
    const modalEl = document.createElement('div');
    modalEl.id = 'modal-selector-preguntes-directe';
    modalEl.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(15, 23, 42, 0.65);
      backdrop-filter: blur(4px);
      padding: 16px;
      box-sizing: border-box;
    `;

    const presets = [5, 10, 15, 20, 25, 30].filter(n => n < totalDisponibles);
    presets.push(totalDisponibles);
    let quantitatSeleccionada = Math.min(20, totalDisponibles);

    modalEl.innerHTML = `
      <div style="background: var(--bg-card, #ffffff); max-width: 500px; width: 100%; border-radius: 20px; box-shadow: 0 25px 60px rgba(0,0,0,0.35); border: 1.5px solid var(--border-card, #e2e8f0); overflow: hidden; position: relative; font-family: inherit;">
        <!-- Capçalera blava fosca estil Agent Medina -->
        <div style="background: linear-gradient(135deg, #002B5E 0%, #1e3a8a 100%); padding: 20px 24px; color: #ffffff; position: relative;">
          <button type="button" id="btn-tancar-modal-selector" style="position: absolute; top: 16px; right: 16px; background: rgba(255,255,255,0.18); border: none; color: #ffffff; width: 32px; height: 32px; border-radius: 50%; font-size: 15px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center;">✕</button>
          <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #93c5fd; margin-bottom: 4px;">
            🎯 Configuració del Test
          </div>
          <h2 style="font-size: 18px; margin: 0; font-weight: 800; line-height: 1.35; padding-right: 28px; color: #ffffff;">${nom}</h2>
          <div style="margin-top: 8px; display: inline-flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.14); padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 700;">
            <span>📚</span> <span><b>${totalDisponibles}</b> preguntes disponibles</span>
          </div>
        </div>

        <!-- Cos amb selector de preguntes accessible -->
        <div style="padding: 22px 24px;">
          <label style="display: block; font-size: 13.5px; font-weight: 800; color: var(--text-main, #0f172a); margin-bottom: 12px;">
            Quantes preguntes vols fer?
          </label>

          <!-- Pills de quantitat -->
          <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;" id="modal-selector-pills">
            ${presets.map(n => `
              <button type="button" class="btn-preset-q-modal" data-cant="${n}" style="flex: 1 1 65px; padding: 11px 6px; background: ${n === quantitatSeleccionada ? '#007aff' : 'var(--bg-card-subtle, #f1f5f9)'}; color: ${n === quantitatSeleccionada ? '#ffffff' : 'var(--text-main, #1e293b)'}; border: 1.5px solid ${n === quantitatSeleccionada ? '#007aff' : 'var(--border-card, #cbd5e1)'}; border-radius: 10px; font-size: 14px; font-weight: 800; cursor: pointer; text-align: center; transition: all 0.15s;">
                ${n === totalDisponibles ? `Totes (${n})` : n}
              </button>
            `).join('')}
          </div>

          <!-- Selector numèric manual -->
          <div style="display: flex; align-items: center; justify-content: space-between; background: var(--bg-card-subtle, #f8fafc); padding: 10px 14px; border-radius: 10px; border: 1px solid var(--border-card, #e2e8f0); margin-bottom: 20px;">
            <span style="font-size: 12.5px; font-weight: 700; color: var(--text-muted, #475569);">Quantitat exacta:</span>
            <div style="display: flex; align-items: center; gap: 8px;">
              <button type="button" id="btn-modal-restar-q" style="width: 32px; height: 32px; border-radius: 8px; background: var(--bg-card, #ffffff); color: var(--text-main, #0f172a); border: 1px solid var(--border-card, #cbd5e1); font-weight: 900; cursor: pointer; font-size: 16px;">−</button>
              <input type="number" id="input-modal-quantitat" value="${quantitatSeleccionada}" min="1" max="${totalDisponibles}" style="width: 60px; text-align: center; font-weight: 800; font-size: 15px; padding: 6px 4px; border: 1px solid var(--border-card, #cbd5e1); border-radius: 8px; outline: none; background: var(--bg-card, #fff); color: var(--text-main, #0f172a);">
              <button type="button" id="btn-modal-sumar-q" style="width: 32px; height: 32px; border-radius: 8px; background: var(--bg-card, #ffffff); color: var(--text-main, #0f172a); border: 1px solid var(--border-card, #cbd5e1); font-weight: 900; cursor: pointer; font-size: 16px;">+</button>
            </div>
          </div>

          <!-- Botó d'acció començar test -->
          <button type="button" id="btn-modal-iniciar-test-actiu" style="width: 100%; padding: 14px; background: linear-gradient(135deg, #002B5E, #007aff); color: #ffffff; border: none; border-radius: 12px; font-size: 16px; font-weight: 800; cursor: pointer; box-shadow: 0 4px 14px rgba(0,122,255,0.35); display: flex; align-items: center; justify-content: center; gap: 8px;">
            <span>▶️ Començar Test</span> <span id="label-modal-btn-q">(${quantitatSeleccionada} preguntes)</span>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modalEl);

    const inputQ = document.getElementById('input-modal-quantitat');
    const labelBtnQ = document.getElementById('label-modal-btn-q');
    const btnIniciar = document.getElementById('btn-modal-iniciar-test-actiu');
    const btnTancar = document.getElementById('btn-tancar-modal-selector');

    const actualitzarQuantitat = (novaQ) => {
      let val = parseInt(novaQ, 10);
      if (isNaN(val) || val < 1) val = 1;
      if (val > totalDisponibles) val = totalDisponibles;
      quantitatSeleccionada = val;
      if (inputQ) inputQ.value = val;
      if (labelBtnQ) labelBtnQ.textContent = `(${val} preguntes)`;

      modalEl.querySelectorAll('.btn-preset-q-modal').forEach(b => {
        const c = parseInt(b.dataset.cant, 10);
        if (c === val) {
          b.style.background = '#007aff';
          b.style.color = '#ffffff';
          b.style.borderColor = '#007aff';
        } else {
          b.style.background = '#f1f5f9';
          b.style.color = '#1e293b';
          b.style.borderColor = '#cbd5e1';
        }
      });
    };

    modalEl.querySelectorAll('.btn-preset-q-modal').forEach(b => {
      b.addEventListener('click', () => {
        const c = parseInt(b.dataset.cant, 10);
        actualitzarQuantitat(c);
      });
    });

    document.getElementById('btn-modal-restar-q')?.addEventListener('click', () => {
      actualitzarQuantitat(quantitatSeleccionada - 1);
    });

    document.getElementById('btn-modal-sumar-q')?.addEventListener('click', () => {
      actualitzarQuantitat(quantitatSeleccionada + 1);
    });

    if (inputQ) {
      inputQ.addEventListener('input', () => {
        actualitzarQuantitat(inputQ.value);
      });
    }

    const tancarModal = () => {
      modalEl.remove();
    };

    if (btnTancar) btnTancar.addEventListener('click', tancarModal);
    modalEl.addEventListener('click', e => {
      if (e.target === modalEl) tancarModal();
    });

    const executarTest = () => {
      const cantFinal = Math.min(quantitatSeleccionada, totalDisponibles);
      if (cantFinal <= 0) {
        alert("No hi ha preguntes disponibles.");
        return;
      }

      let subset = [...dataset];
      if (mezclar) {
        barrejarArray(subset);
      }

      tancarModal();

      if (typeof iniciarExamen === 'function') {
        iniciarExamen(cantFinal, false, subset.slice(0, cantFinal));
      } else {
        mostrarPregunta(subset[0]);
      }

      // Fem scroll suau immediat fins al contenidor del test perquè la primera pregunta quedi en pantalla
      requestAnimationFrame(() => {
        const contenedor = obtenirContenidorTest();
        if (contenedor) {
          const y = Math.max(0, contenedor.getBoundingClientRect().top + window.scrollY - 20);
          window.scrollTo({ top: y, behavior: 'smooth' });
        }
      });
    };

    if (btnIniciar) btnIniciar.addEventListener('click', executarTest);
  }


  // --- SELECTOR DE SECCIONS DINS D'UN ÀMBIT ---
  function mostrarSelectorSeccions(nomAmbit, dataset, onTornar) {
    let targetView = null;
    const nomLower = String(nomAmbit || '').toLowerCase();
    if (nomLower.includes('mossos') || nomLower.includes('àmbit')) {
      targetView = document.getElementById('view-mossos');
    } else if (nomLower.includes('actualitat')) {
      targetView = document.getElementById('view-actualitat');
    } else if (nomLower.includes('policia') || nomLower.includes('local') || nomLower.includes('municipi')) {
      targetView = document.getElementById('view-policia-local') || document.getElementById('view-pl');
    }
    if (!targetView || targetView.style.display === 'none') {
      targetView = (typeof obtenirVistaActiva === 'function' ? obtenirVistaActiva() : null) || document.getElementById('view-mossos') || document.body;
    }

    const hostEl = targetView.querySelector('#mossos-contingut-principal') ||
                   targetView.querySelector('#pl-contingut-principal') ||
                   targetView.querySelector('#act-contingut-principal') ||
                   targetView;
    if (!hostEl) return;

    // Amaguem el "Tria un tema" i els botons d'àmbit mentre es tria la secció/test.
    document.querySelectorAll('.hub').forEach(h => { h.style.display = 'none'; });

    // Agrupem les preguntes per secció
    const seccionsMap = new Map();
    dataset.forEach(q => {
      const sec = q.seccio || 'Sense secció';
      seccionsMap.set(sec, (seccionsMap.get(sec) || 0) + 1);
    });
    const seccions = Array.from(seccionsMap.entries()); // [ [nom, count], ... ]

    // Ordenem de manera natural numèrica (especialment per als temes 0 al 40 de Policia Local)
    seccions.sort((a, b) => {
      const nomA = a[0] || '';
      const nomB = b[0] || '';
      const regexTema = /Tema\s*(\d+)/i;
      const mA = nomA.match(regexTema);
      const mB = nomB.match(regexTema);

      if (mA && mB) {
        const numA = parseInt(mA[1], 10);
        const numB = parseInt(mB[1], 10);
        if (numA !== numB) return numA - numB;
      } else if (mA && !mB) {
        return -1;
      } else if (!mA && mB) {
        return 1;
      }
      return nomA.localeCompare(nomB, 'ca', { numeric: true, sensitivity: 'base' });
    });

    // Si només hi ha una secció (o cap dada de secció), anem directes al pas de quantitat
    if (seccions.length <= 1) {
      mostrarSelectorPreguntas(nomAmbit, dataset, false);
      return;
    }

    hostEl.innerHTML = `
      <div style="background: var(--bg-card, #ffffff); padding: 24px; border-radius: 16px; border: 1px solid var(--border-card, #e2e8f0); box-shadow: var(--shadow-card, 0 4px 20px rgba(0,0,0,0.08)); margin-top: 20px; text-align: left;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:10px;">
          ${onTornar ? `<button id="btn-tornar-seccions" style="background:none;border:none;color:#007aff;font-weight:700;cursor:pointer;padding:0;font-size:14px;">← Tornar</button>` : '<span></span>'}
          <button onclick="window.obrirModalCrearPregunta('${nomAmbit.toLowerCase().includes('mossos') ? 'mossos' : nomAmbit.toLowerCase().includes('actualitat') ? 'act' : 'pl'}')" class="btn-crear-pregunta-top" style="font-size:12px;padding:6px 12px;">
            ➕ Afegir pregunta a aquesta secció
          </button>
        </div>
        <h2 style="font-size: 20px; color: var(--text-main, #0f172a); margin: 0 0 6px; font-weight: 800;">${nomAmbit}</h2>
        <p style="font-size: 14px; color: var(--text-muted, #64748b); margin-bottom: 18px;">Tria una, vàries o totes les seccions ordenades del 0 al 40 (${dataset.length} preguntes disponibles):</p>

        <!-- Cercador ràpid de temes -->
        <div style="margin-bottom: 14px;">
          <input type="text" id="filtre-cerca-seccions" placeholder="🔍 Cercar tema o paraula clau (ex: Tema 12, Trànsit, Constitució)..." style="width:100%; box-sizing:border-box; padding:10px 14px; background:var(--bg-card-subtle, #f8fafc); border:1.5px solid var(--border-card, #e2e8f0); border-radius:10px; font-size:14px; color:var(--text-main, #1e293b); outline:none;">
        </div>

        <div style="display:flex; gap:10px; margin-bottom: 14px;">
          <button id="btn-sec-totes" style="flex:1; padding:10px; background:#eef6ff; color:#007aff; border:1.5px solid #b8daff; border-radius:10px; font-weight:700; cursor:pointer; font-size:13px;">☑️ Seleccionar totes</button>
          <button id="btn-sec-cap" style="flex:1; padding:10px; background:var(--bg-card-subtle, #f8fafc); color:var(--text-muted, #64748b); border:1.5px solid var(--border-card, #e2e8f0); border-radius:10px; font-weight:700; cursor:pointer; font-size:13px;">◻️ Desmarcar totes</button>
        </div>

        <div id="llista-seccions" style="display:flex; flex-direction:column; gap:8px; margin-bottom: 20px; max-height: 480px; overflow-y: auto; padding-right: 4px;">
          ${seccions.map(([nom, count]) => {
            const m = nom.match(/Tema\s*(\d+)/i);
            const temaNum = m ? m[1] : null;
            const qsSec = dataset.filter(q => q && (q.seccio === nom || (!q.seccio && nom === 'Sense secció')));
            const estSec = (typeof window.calcularProgresPreguntes === 'function')
              ? window.calcularProgresPreguntes(qsSec)
              : { encertades: 0, fallades: 0, maiFetes: count, pctProgres: 0 };
            return `
            <label class="item-seccio-label" data-text="${nom.toLowerCase().replace(/"/g, '&quot;')}" style="display:flex; align-items:center; gap:10px; padding:12px 14px; background:var(--bg-card-subtle, #f8fafc); border:1.5px solid var(--border-card, #e2e8f0); border-radius:10px; cursor:pointer; font-size:14px; color:var(--text-main, #1e293b); font-weight:600; transition:all 0.15s ease;">
              <input type="checkbox" class="chk-seccio" data-seccio="${nom.replace(/"/g, '&quot;')}" style="width:18px;height:18px;accent-color:#007aff;flex:none;">
              ${temaNum !== null ? `<span style="background:#002B5E;color:#E8C000;font-weight:900;font-size:11px;padding:3px 7px;border-radius:6px;flex:none;">T${temaNum}</span>` : ''}
              <div style="flex:1;min-width:0;">
                <div style="font-size:14px;line-height:1.35;">${nom}</div>
                <div style="display:flex;align-items:center;gap:6px;margin-top:4px;font-size:11px;font-weight:800;flex-wrap:wrap;">
                  <span style="color:#059669;background:rgba(16,185,129,0.12);padding:1.5px 6px;border-radius:4px;">✅ ${estSec.encertades}</span>
                  <span style="color:#dc2626;background:rgba(239,68,68,0.12);padding:1.5px 6px;border-radius:4px;">❌ ${estSec.fallades}</span>
                  <span style="color:#475569;background:rgba(100,116,139,0.12);padding:1.5px 6px;border-radius:4px;">⏳ ${estSec.maiFetes} mai fetes</span>
                </div>
              </div>
              <span style="color:var(--text-muted, #94a3b8); font-weight:700; font-size:12px; background:var(--bg-card, #fff); padding:3px 8px; border-radius:6px; border:1px solid var(--border-card, #e2e8f0); flex:none;">${count} p</span>
            </label>
          `}).join('')}
        </div>

        <button id="btn-continuar-seccions" disabled style="width:100%; padding:14px; background:#cbd5e1; color:#fff; border:none; border-radius:12px; font-weight:800; font-size:15px; cursor:not-allowed;">
          Selecciona almenys una secció
        </button>
      </div>
    `;

    // Filtre dinàmic de cerca de seccions
    const inputFiltre = document.getElementById('filtre-cerca-seccions');
    if (inputFiltre) {
      inputFiltre.addEventListener('input', () => {
        const query = inputFiltre.value.toLowerCase().trim();
        const items = targetView.querySelectorAll('.item-seccio-label');
        items.forEach(item => {
          const txt = item.getAttribute('data-text') || '';
          item.style.display = (!query || txt.includes(query)) ? 'flex' : 'none';
        });
      });
    }

    const checkboxes = targetView.querySelectorAll('.chk-seccio');
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
      if (btnTornar) {
        btnTornar.addEventListener('click', () => {
          document.querySelectorAll('.hub').forEach(h => { h.style.display = ''; });
          onTornar();
        });
      }
    }
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
    activeTestContainerId = 'test-container-mossos';
    const mossosZona = document.getElementById('mossos-zona-test');
    const mossosPrincipal = document.getElementById('mossos-contingut-principal');
    if (mossosZona) mossosZona.style.display = 'block';
    if (mossosPrincipal) mossosPrincipal.style.display = 'none';

    const btnSortir = document.getElementById('btn-mossos-sortir-test');
    if (btnSortir) {
      btnSortir.onclick = () => {
        if (temporitzador) clearInterval(temporitzador);
        if (window._agentMedinaTimer) clearInterval(window._agentMedinaTimer);
        if (mossosZona) mossosZona.style.display = 'none';
        if (mossosPrincipal) mossosPrincipal.style.display = 'flex';
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };
    }

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
        <div style="background:white;padding:30px;border-radius:16px;border:1.5px solid #e2e8f0;text-align:center;margin:10px auto;max-width:650px;box-shadow:var(--shadow-card);">
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
            <button id="btn-temari-oficial" style="background:#002B5E;color:white;border:none;padding:12px 20px;border-radius:8px;font-weight:700;cursor:pointer;">← Tornar al Temari</button>
            <button id="btn-repas-oficial" style="background:#16a34a;color:white;border:none;padding:12px 20px;border-radius:8px;font-weight:700;cursor:pointer;">📚 Repassar les 30 preguntes</button>
            <button id="btn-inici-oficial" style="background:var(--bg-card-subtle,#f1f5f9);color:var(--text-main,#1e293b);border:1px solid #cbd5e1;padding:12px 20px;border-radius:8px;font-weight:700;cursor:pointer;">🏠 Inici</button>
          </div>
        </div>`;
      document.getElementById('btn-temari-oficial')?.addEventListener('click', () => {
        if (mossosZona) mossosZona.style.display = 'none';
        if (mossosPrincipal) mossosPrincipal.style.display = 'flex';
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
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

    const primeraQ = preguntesTest[0] || {};
    const fontDetectada = primeraQ._font || (typeof detectarFontPregunta === 'function' ? detectarFontPregunta(primeraQ) : '') || '';

    const vistaActiva = (typeof obtenirVistaActiva === 'function' ? obtenirVistaActiva() : null);
    const vistaActivaId = vistaActiva ? vistaActiva.id : '';

    let esAct = vistaActivaId === 'view-actualitat' || fontDetectada === 'Actualitat';
    let esPL = vistaActivaId === 'view-policia-local' || vistaActivaId === 'view-pl' || fontDetectada === 'Policia Local';
    let esMossos = vistaActivaId === 'view-mossos' || fontDetectada === 'Mossos';

    if (!esAct && !esPL && !esMossos) {
      if (viewPL && (viewPL.classList.contains('view-activa') || viewPL.style.display !== 'none')) esPL = true;
      else if (viewAct && (viewAct.classList.contains('view-activa') || viewAct.style.display !== 'none')) esAct = true;
      else esMossos = true;
    }

    const restaurarVistaSenseTest = () => {
      const actZona = document.getElementById('act-zona-test-container');
      const actPrincipal = document.getElementById('act-contingut-principal');
      if (actZona) actZona.style.display = 'none';
      if (actPrincipal) actPrincipal.style.display = 'flex';

      const mossosZona = document.getElementById('mossos-zona-test');
      const mossosPrincipal = document.getElementById('mossos-contingut-principal');
      if (mossosZona) mossosZona.style.display = 'none';
      if (mossosPrincipal) mossosPrincipal.style.display = 'flex';

      const plZona = document.getElementById('pl-zona-test');
      const plPrincipal = document.getElementById('pl-contingut-principal');
      if (plZona) plZona.style.display = 'none';
      if (plPrincipal) plPrincipal.style.display = 'flex';

      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Actualitzem les vistes perquè els percentatges i comptadors de progrés s'actualitzin a l'instant
      if (esPL && typeof window.mostrarTemarioPL === 'function') {
        window.mostrarTemarioPL();
      } else if (esMossos && typeof window.mostrarTemarioMossos === 'function') {
        window.mostrarTemarioMossos();
      } else if (esAct && typeof window.mostrarTemarioActualitat === 'function') {
        window.mostrarTemarioActualitat();
      }
    };

    const viewMossos = document.getElementById('view-mossos');
    const viewPL = document.getElementById('view-policia-local') || document.getElementById('view-pl');
    const viewAct = document.getElementById('view-actualitat');

    if (esAct && document.getElementById('act-zona-test-container')) {
      activeTestContainerId = 'test-container-actualitat';
      const actZona = document.getElementById('act-zona-test-container');
      const actPrincipal = document.getElementById('act-contingut-principal');
      if (actZona) actZona.style.display = 'block';
      if (actPrincipal) actPrincipal.style.display = 'none';
      const btnSortir = document.getElementById('btn-act-sortir-test');
      if (btnSortir) btnSortir.onclick = restaurarVistaSenseTest;
    } else if (esPL && document.getElementById('pl-zona-test')) {
      activeTestContainerId = 'test-container-pl';
      const plZona = document.getElementById('pl-zona-test');
      const plPrincipal = document.getElementById('pl-contingut-principal');
      if (plZona) plZona.style.display = 'block';
      if (plPrincipal) plPrincipal.style.display = 'none';
      const btnSortir = document.getElementById('btn-pl-sortir-test');
      if (btnSortir) btnSortir.onclick = restaurarVistaSenseTest;
    } else if (esMossos && document.getElementById('mossos-zona-test')) {
      activeTestContainerId = 'test-container-mossos';
      const mossosZona = document.getElementById('mossos-zona-test');
      const mossosPrincipal = document.getElementById('mossos-contingut-principal');
      if (mossosZona) mossosZona.style.display = 'block';
      if (mossosPrincipal) mossosPrincipal.style.display = 'none';
      const btnSortir = document.getElementById('btn-mossos-sortir-test');
      if (btnSortir) btnSortir.onclick = restaurarVistaSenseTest;
    } else {
      activeTestContainerId = 'test-container';
      const cont = obtenirContenidorTest();
      if (cont) cont.style.display = 'block';
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });

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
            <div style="background:var(--bg-card,#ffffff);padding:32px 24px;border-radius:18px;border:1.5px solid var(--border-card,#e2e8f0);text-align:center;margin:10px auto;max-width:650px;box-shadow:var(--shadow-card);">
              <div style="font-size:42px;margin-bottom:8px;">🏆</div>
              <h2 style="color:var(--text-main,#0f172a);margin:0 0 10px;font-size:22px;font-weight:900;">Test Finalitzat!</h2>
              <p style="font-size:15px;margin:10px 0;color:var(--text-muted,#64748b);">Encerts: <b style="color:#10b981;">${encerts}</b> | Fallades: <b style="color:#ef4444;">${fallades}</b></p>
              <p style="font-size:26px;font-weight:900;color:#007aff;margin:12px 0;">Nota Final: ${notaFinal} / 10</p>
              <div style="padding:14px;border-radius:10px;background:${esApte ? '#d1fae5' : '#fee2e2'};color:${esApte ? '#065f46' : '#991b1b'};font-weight:800;margin-bottom:22px;">
                ${esApte ? '✅ APTE (Objectiu 6 superat!)' : '❌ NO APTE (Cal seguir practicant)'}
              </div>
              <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
                <button id="btn-tornar-temari-finalitzat" style="background:#002B5E;color:#fff;border:none;padding:12px 20px;border-radius:10px;font-weight:800;font-size:14px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;">
                  <span>←</span> <span>Tornar al Temari</span>
                </button>
                <button id="btn-repas-test-finalitzat" style="background:#10b981;color:white;border:none;padding:12px 20px;border-radius:10px;font-weight:800;font-size:14px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;">
                  <span>📚</span> <span>Repassar preguntes</span>
                </button>
                <button id="btn-tornar-inici-finalitzat" style="background:var(--bg-card-subtle,#f1f5f9);color:var(--text-main,#1e293b);border:1px solid var(--border-card,#cbd5e1);padding:12px 20px;border-radius:10px;font-weight:800;font-size:14px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;">
                  <span>🏠</span> <span>Inici</span>
                </button>
              </div>
            </div>`;
          document.getElementById('btn-tornar-temari-finalitzat')?.addEventListener('click', restaurarVistaSenseTest);
          document.getElementById('btn-repas-test-finalitzat')?.addEventListener('click', iniciarRepasUltimTest);
          document.getElementById('btn-tornar-inici-finalitzat')?.addEventListener('click', () => {
            restaurarVistaSenseTest();
            tornarAInici();
          });
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

    const percentatgeProgres = Math.round(((indexActual + 1) / totalPreguntes) * 100);

    contenedor.innerHTML = `
        <div class="pregunta-box" style="background: var(--bg-card, #ffffff); padding: 26px 24px; border-radius: 18px; border: 1.5px solid var(--border-card, #e2e8f0); box-shadow: var(--shadow-card); max-width: 820px; margin: 0 auto;">
            <!-- Barra de progrés superior del test -->
            <div style="margin-bottom: 18px;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:8px;">
                <span style="font-size: 13px; font-weight: 800; color: #007aff; background: rgba(0,122,255,0.08); padding: 4px 10px; border-radius: 999px;">
                  Pregunta ${indexActual + 1} de ${totalPreguntes}
                </span>
                <div style="display:flex;align-items:center;gap:6px;">
                  <button type="button" class="btn-ia-dubte-head" title="Preguntar a la IA sobre aquesta pregunta" style="background:var(--bg-card-subtle,#eff6ff);color:#1d4ed8;border:1px solid #bfdbfe;border-radius:8px;padding:5px 10px;font-size:12px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:5px;">
                    <span>🤖</span><span>Dubte IA</span>
                  </button>
                  ${etiquetaIdPreguntaHtml(preguntaObj)}
                </div>
              </div>
              <div style="width: 100%; height: 6px; background: var(--bg-card-subtle, #e2e8f0); border-radius: 999px; overflow: hidden;">
                <div style="width: ${percentatgeProgres}%; height: 100%; background: linear-gradient(90deg, #007aff, #002B5E); border-radius: 999px; transition: width 0.3s ease;"></div>
              </div>
            </div>

            <h3 style="margin: 0 0 20px 0; color: var(--text-main, #0f172a); font-size: 17px; line-height: 1.5; font-weight: 800;">
              ${preguntaObj.pregunta}
            </h3>

            <div style="display: flex; flex-direction: column; gap: 11px;" id="llista-opcions"></div>
        </div>
        <div id="feedback" style="margin-top: 16px; max-width: 820px; margin-left: auto; margin-right: auto;"></div>
    `;

    const btnDubteHead = contenedor.querySelector('.btn-ia-dubte-head');
    if (btnDubteHead) {
        btnDubteHead.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof window.obrirModalDubteIA === 'function') {
                window.obrirModalDubteIA(preguntaObj);
            }
        });
    }

    const llistaOpcions = contenedor.querySelector('#llista-opcions');
    const lletres = ['A', 'B', 'C', 'D'];
    
    opcionsBarrejades.forEach((opcio, index) => {
        const btn = document.createElement('button');
        btn.style.cssText = `
          padding: 14px 16px;
          background: var(--bg-card-subtle, #f8fafc);
          border: 1.5px solid var(--border-card, #cbd5e1);
          border-radius: 12px;
          text-align: left;
          cursor: pointer;
          font-size: 14.5px;
          font-weight: 600;
          color: var(--text-main, #1e293b);
          display: flex;
          align-items: flex-start;
          gap: 12px;
          line-height: 1.45;
          transition: all 0.15s ease;
        `;
        btn.innerHTML = `
          <span style="flex-shrink:0;width:26px;height:26px;border-radius:50%;background:rgba(0,122,255,0.1);color:#007aff;font-size:12px;font-weight:900;display:flex;align-items:center;justify-content:center;">
            ${lletres[index] || '•'}
          </span>
          <span style="flex:1;">${escapeHtml(opcio)}</span>
        `;
        
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
                btn.style.background = 'rgba(16,185,129,0.12)';
                btn.style.borderColor = '#10b981';
                btn.style.color = '#065f46';
            } else {
                btn.style.background = 'rgba(239,68,68,0.12)';
                btn.style.borderColor = '#ef4444';
                btn.style.color = '#991b1b';
                llistaOpcions.querySelectorAll('button').forEach((b, idx) => {
                    if (idx === nouIndexCorrecte) {
                        b.style.background = 'rgba(16,185,129,0.12)';
                        b.style.borderColor = '#10b981';
                        b.style.color = '#065f46';
                    }
                });
            }

            const feedbackIAPrompt = `
                <div style="margin-top:12px;padding-top:10px;border-top:1px dashed ${esCorrecte ? '#6ee7b7' : '#fca5a5'};display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
                    <span style="font-size:12px;opacity:0.9;">Tens algun dubte sobre aquesta resposta o la llei aplicable?</span>
                    <button type="button" class="btn-ia-feedback-ask" style="background:${esCorrecte ? '#059669' : '#dc2626'};color:#fff;border:none;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:6px;box-shadow:0 2px 6px rgba(0,0,0,0.15);">
                        <span>✨</span> <span>Pregunta a la IA (Gemini)</span>
                    </button>
                </div>
            `;

            feedback.innerHTML = `
                <div style="background: ${esCorrecte ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)'}; border: 1.5px solid ${esCorrecte ? '#6ee7b7' : '#fca5a5'}; padding: 18px 20px; border-radius: 14px; color: ${esCorrecte ? '#065f46' : '#991b1b'}; margin-bottom: 16px;">
                    <p style="margin: 0 0 6px 0; font-weight: 800; font-size: 15px;">${esCorrecte ? '✅ Resposta Correcta!' : '❌ Resposta Incorrecta.'}</p>
                    <p style="margin: 0; font-size: 13.5px; line-height: 1.5;">${preguntaObj.explicacio || ''}</p>
                    ${feedbackIAPrompt}
                </div>
                <button id="btn-seguent-pregunta" style="background: linear-gradient(135deg, #002B5E, #007aff); color: white; border: none; padding: 14px 24px; border-radius: 12px; font-weight: 800; font-size: 15px; cursor: pointer; width: 100%; box-shadow: 0 4px 14px rgba(0,122,255,0.3); display: flex; align-items: center; justify-content: center; gap: 8px;">
                  <span>${indexActual + 1 === totalPreguntes ? '🏁 Finalitzar Test' : 'Següent Pregunta'}</span> <span>➔</span>
                </button>
            `;

            const btnIA = feedback.querySelector('.btn-ia-feedback-ask');
            if (btnIA) {
                const opcioTriadaOriginal = preguntaObj.opcions.indexOf(opcio);
                btnIA.addEventListener('click', () => {
                    if (typeof window.obrirModalDubteIA === 'function') {
                        window.obrirModalDubteIA(preguntaObj, opcioTriadaOriginal, esCorrecte);
                    }
                });
            }

            // Mantenir la posició de scroll suau
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

  window.iniciarExamen = iniciarExamen;
  window.iniciarExamenOficial = iniciarExamenOficial;
  window.mostrarSelectorSeccions = mostrarSelectorSeccions;
  window.mostrarSelectorPreguntas = mostrarSelectorPreguntas;
  window.mostrarPreguntaAmbSeguent = mostrarPreguntaAmbSeguent;
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
    navigator.serviceWorker.register('sw.js').then((reg) => {
      reg.update().catch(() => {});
    }).catch(() => { /* PWA opcional */ });
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

// ============================================================================
// 8. REDISSENY AGENT MEDINA: CONTROLADOR DE MODALS, CREACIÓ DE PREGUNTES I TEMA
// ============================================================================

// --- 8.1 Notificacions Toast ---
function mostrarToast(missatge, tipus = 'info') {
  const container = document.getElementById('app-toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `app-toast toast-${tipus}`;
  const icon = tipus === 'success' ? '✅' : tipus === 'error' ? '❌' : 'ℹ️';
  toast.innerHTML = `<span style="font-size:16px;">${icon}</span> <span style="line-height:1.4;">${missatge}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
window.mostrarToast = mostrarToast;

// --- 8.2 Canvi de Tema (Fosc / Clar) ---
function inicialitzarTema() {
  const guardat = localStorage.getItem('agentmedina_theme') || 'light';
  aplicarTema(guardat);
}

function aplicarTema(tema) {
  const isDark = (tema === 'dark');
  localStorage.setItem('agentmedina_theme', isDark ? 'dark' : 'light');
  
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  document.documentElement.classList.toggle('theme-dark', isDark);
  
  if (document.body) {
    document.body.classList.toggle('theme-dark', isDark);
  }

  const icon = document.getElementById('theme-toggle-icon');
  const txt = document.getElementById('theme-toggle-text');
  if (icon) icon.textContent = isDark ? '☀️' : '🌙';
  if (txt) txt.textContent = isDark ? 'Clar' : 'Fosc';
}

function toggleTheme() {
  const actual = localStorage.getItem('agentmedina_theme') || (document.documentElement.classList.contains('theme-dark') ? 'dark' : 'light');
  const nou = actual === 'dark' ? 'light' : 'dark';
  aplicarTema(nou);
  mostrarToast(nou === 'dark' ? 'Mode fosc activat' : 'Mode clar activat', 'info');
}
window.toggleTheme = toggleTheme;
window.inicialitzarTema = inicialitzarTema;

// --- 8.3 Modal de Perfil d'Usuari ---
function obrirModalPerfil() {
  const modal = document.getElementById('modal-perfil-usuari');
  if (!modal) return;

  // Actualitzem les estadístiques dins el modal
  if (typeof obtenerHistorial === 'function') {
    const stats = obtenerHistorial();
    const ids = Object.keys(stats.respondidas || {});
    const totalContestades = ids.length;
    const totalEncerts = ids.filter(id => {
      const r = stats.respondidas[id];
      return r && (r.correcta === true || r === true);
    }).length;
    const pct = totalContestades > 0 ? ((totalEncerts / totalContestades) * 100).toFixed(1) : '0.0';

    const elRatxa = document.getElementById('perfil-stat-ratxa');
    const elPreg = document.getElementById('perfil-stat-preguntes');
    const elEnc = document.getElementById('perfil-stat-encerts');

    if (elRatxa && typeof calcularRatxaDies === 'function') elRatxa.textContent = `${calcularRatxaDies()} dies`;
    if (elPreg) elPreg.textContent = totalContestades;
    if (elEnc) elEnc.textContent = `${pct}%`;
  }

  // Refrescar dades d'usuari
  if (window.actualitzarBotoLogin) window.actualitzarBotoLogin();

  modal.classList.add('active');
}

function tancarModalPerfil() {
  const modal = document.getElementById('modal-perfil-usuari');
  if (modal) modal.classList.remove('active');
}

function gestionarLoginGoogleModal() {
  if (typeof window.alternarSessioFirebase === 'function') {
    window.alternarSessioFirebase();
  } else {
    mostrarToast('El servei de sincronització Firebase s\'està inicialitzant...', 'info');
  }
}

function forcarSincronitzacioManual() {
  if (typeof window.pujarDadesANucol === 'function') {
    window.pujarDadesANucol();
    mostrarToast('✅ Progrés sincronitzat amb el núvol!', 'success');
  } else {
    mostrarToast('Progrés guardat localment al teu navegador.', 'info');
  }
}

function descarregarProgresDirecte() {
  if (typeof exportarProgresJSON === 'function') {
    exportarProgresJSON();
    mostrarToast('S\'està descarregant la còpia de seguretat (JSON)...', 'info');
  }
}

function restaurarProgresDirecte(event) {
  const file = event.target?.files?.[0];
  if (file && typeof importarProgresJSON === 'function') {
    importarProgresJSON(file);
    mostrarToast('✅ Progrés restaurat correctament!', 'success');
  }
}

window.obrirModalPerfil = obrirModalPerfil;
window.tancarModalPerfil = tancarModalPerfil;
window.gestionarLoginGoogleModal = gestionarLoginGoogleModal;
window.forcarSincronitzacioManual = forcarSincronitzacioManual;
window.descarregarProgresDirecte = descarregarProgresDirecte;
window.restaurarProgresDirecte = restaurarProgresDirecte;

// --- 8.4 Creador i Modificador de Preguntes Directe al Temari ---
function obrirModalCrearPregunta(bancPref = 'pl', temaPref = null, municipiPref = null, idEditar = null) {
  const modal = document.getElementById('modal-crear-pregunta');
  if (!modal) return;

  if (idEditar) {
    modal.classList.add('active');
    carregarPreguntaPerEditar(bancPref, idEditar);
    return;
  }

  netejarFormulariCrearPregunta();

  if (typeof window.canviarModeCreacio === 'function') {
    window.canviarModeCreacio('manual');
  }

  // Seleccionar el banc
  const radio = modal.querySelector(`input[name="banc-pregunta"][value="${bancPref}"], input[name="cp-banc"][value="${bancPref}"]`);
  if (radio) radio.checked = true;

  // Si hi ha municipi preferent o actiu
  const munSelect = document.getElementById('cp-select-municipi');
  const munActiu = (typeof window.obtenirMunicipiActiuPL === 'function') ? window.obtenirMunicipiActiuPL() : 'Constantí';
  const targetMun = municipiPref || (munActiu !== 'Compartit' ? munActiu : 'Comú');
  if (munSelect && targetMun) {
    let exists = false;
    for (let i = 0; i < munSelect.options.length; i++) {
      if (munSelect.options[i].value.toLowerCase() === targetMun.toLowerCase()) {
        munSelect.selectedIndex = i;
        exists = true;
        break;
      }
    }
    if (!exists) {
      const opt = document.createElement('option');
      opt.value = targetMun;
      opt.textContent = `🏛️ ${targetMun}`;
      munSelect.appendChild(opt);
      munSelect.value = targetMun;
    }
  }

  canviarBancCrearPregunta(bancPref, temaPref, targetMun);

  modal.classList.add('active');
}

function tancarModalCrearPregunta() {
  const modal = document.getElementById('modal-crear-pregunta');
  if (modal) {
    modal.classList.remove('active');
    netejarFormulariCrearPregunta();
  }
}

function netejarFormulariCrearPregunta() {
  const modal = document.getElementById('modal-crear-pregunta');
  if (modal) {
    delete modal.dataset.mode;
    delete modal.dataset.editId;
    delete modal.dataset.editBanc;
  }
  const banner = document.getElementById('cp-banner-mode-edicio');
  if (banner) banner.style.display = 'none';

  const btnDesar = document.getElementById('btn-guardar-pregunta-modal');
  if (btnDesar) {
    btnDesar.innerHTML = '💾 Desar i afegir directament';
    btnDesar.style.background = 'linear-gradient(135deg,#002B5E,#007aff)';
  }

  const campPregunta = document.getElementById('cp-pregunta') || document.getElementById('cp-text-pregunta');
  if (campPregunta) campPregunta.value = '';
  [0, 1, 2, 3].forEach(i => {
    const op = document.getElementById(`cp-op-${i}`);
    if (op) op.value = '';
  });
  const campExp = document.getElementById('cp-explicacio');
  if (campExp) campExp.value = '';
  marcarOpcioCorrecta(0);
}

function carregarPreguntaPerEditar(banc, id) {
  const dataset = (typeof window.obtenirBancActiu === 'function') ? window.obtenirBancActiu(banc) : [];
  const q = dataset.find(item => item && String(item.id).trim() === String(id).trim());
  if (!q) {
    mostrarToast('❌ No s\'ha trobat la pregunta seleccionada per editar.', 'error');
    return;
  }

  const modal = document.getElementById('modal-crear-pregunta');
  if (!modal) return;

  modal.dataset.mode = 'editar';
  modal.dataset.editId = q.id;
  modal.dataset.editBanc = banc;

  if (typeof window.canviarModeCreacio === 'function') {
    window.canviarModeCreacio('manual');
  }

  // Marcar ràdio de banc
  const radioBanc = modal.querySelector(`input[name="banc-pregunta"][value="${banc}"], input[name="cp-banc"][value="${banc}"]`);
  if (radioBanc) radioBanc.checked = true;

  // Actualitzar selector de temes per a aquest banc
  canviarBancCrearPregunta(banc, q.seccio || q.tema || q.categoria || q.ambit);

  // Omplir formulari
  const campPregunta = document.getElementById('cp-pregunta') || document.getElementById('cp-text-pregunta');
  if (campPregunta) campPregunta.value = q.pregunta || '';

  [0, 1, 2, 3].forEach(i => {
    const inputOp = document.getElementById(`cp-op-${i}`);
    if (inputOp) inputOp.value = (Array.isArray(q.opcions) && q.opcions[i] !== undefined) ? q.opcions[i] : '';
  });

  const respIndex = (typeof q.resposta === 'number' && q.resposta >= 0 && q.resposta <= 3) ? q.resposta : 0;
  marcarOpcioCorrecta(respIndex);

  const campExp = document.getElementById('cp-explicacio');
  if (campExp) campExp.value = q.explicacio || '';

  // Banner d'edició
  const banner = document.getElementById('cp-banner-mode-edicio');
  const bannerText = document.getElementById('cp-text-mode-edicio');
  if (banner) banner.style.display = 'flex';
  if (bannerText) {
    const nomCos = banc === 'pl' ? 'Policia Local' : (banc === 'mossos' ? 'Mossos d\'Esquadra' : 'Actualitat');
    bannerText.innerHTML = `Editant pregunta existent <b>${escapeHtml(String(q.id))}</b> (${nomCos})`;
  }

  // Botó guardar
  const btnDesar = document.getElementById('btn-guardar-pregunta-modal');
  if (btnDesar) {
    btnDesar.innerHTML = '💾 Desar canvis directament al banc';
    btnDesar.style.background = 'linear-gradient(135deg, #b45309, #f59e0b)';
  }

  mostrarToast(`✏️ Editant la pregunta ${q.id}. Pots canviar l'enunciat, opcions o explicació.`, 'info');
}

function renderLlistaModificarPreguntes(banc, query = '') {
  const targetBanc = banc || document.querySelector('input[name="cp-mod-banc"]:checked')?.value || 'pl';
  const llistaEl = document.getElementById('llista-cerca-preguntes-modificar');
  const comptadorEl = document.getElementById('cp-mod-comptador');
  if (!llistaEl) return;

  const dataset = (typeof window.obtenirBancActiu === 'function') ? window.obtenirBancActiu(targetBanc) : [];
  const qClean = (query || '').trim().toLowerCase();

  let filtrades = dataset;
  if (qClean) {
    filtrades = dataset.filter(item => {
      if (!item) return false;
      const strId = String(item.id || '').toLowerCase();
      const strPreg = String(item.pregunta || '').toLowerCase();
      const strTema = String(item.seccio || item.tema || item.categoria || '').toLowerCase();
      const strOps = Array.isArray(item.opcions) ? item.opcions.join(' ').toLowerCase() : '';
      return strId.includes(qClean) || strPreg.includes(qClean) || strTema.includes(qClean) || strOps.includes(qClean);
    });
  }

  const nomBanc = targetBanc === 'pl' ? 'Policia Local' : (targetBanc === 'mossos' ? 'Mossos d\'Esquadra' : 'Actualitat');
  if (comptadorEl) {
    comptadorEl.innerHTML = `Mostrant <b>${Math.min(filtrades.length, 60)}</b> de <b>${filtrades.length}</b> preguntes trobades (${nomBanc})`;
  }

  if (filtrades.length === 0) {
    llistaEl.innerHTML = `
      <div style="padding:28px 16px;text-align:center;background:var(--bg-card-subtle,#f8fafc);border:1px dashed var(--border-card,#cbd5e1);border-radius:12px;color:var(--text-muted,#64748b);">
        <span style="font-size:24px;display:block;margin-bottom:6px;">🔎</span>
        <p style="margin:0;font-size:13.5px;font-weight:700;">No s'han trobat preguntes amb aquest filtre de cerca.</p>
        <p style="margin:4px 0 0;font-size:12px;">Prova d'escriure un terme més genèric o una paraula clau de l'enunciat.</p>
      </div>
    `;
    return;
  }

  // Renderitzem fins a 60 resultats per màxima velocitat
  const mostrar = filtrades.slice(0, 60);
  llistaEl.innerHTML = mostrar.map(q => {
    const respIndex = (typeof q.resposta === 'number' && q.resposta >= 0 && q.resposta <= 3) ? q.resposta : 0;
    const respText = (Array.isArray(q.opcions) && q.opcions[respIndex] !== undefined) ? q.opcions[respIndex] : '';
    const tema = q.seccio || q.tema || q.categoria || 'General';
    return `
      <div style="background:var(--bg-card,#ffffff);border:1px solid var(--border-card,#e2e8f0);border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:8px;box-shadow:0 2px 6px rgba(0,0,0,0.02);">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
            <span style="background:var(--bg-card-subtle,#f1f5f9);color:var(--text-main,#334155);border:1px solid var(--border-card,#cbd5e1);font-size:11px;font-weight:800;padding:2px 6px;border-radius:4px;">
              ID: ${escapeHtml(String(q.id))}
            </span>
            <span style="font-size:12px;color:var(--text-muted,#64748b);font-weight:600;">
              📁 ${escapeHtml(tema)}
            </span>
          </div>
          <div style="display:flex;gap:6px;">
            <button type="button" onclick="window.carregarPreguntaPerEditar('${targetBanc}', '${escapeHtml(String(q.id))}')" style="background:#007aff;color:#fff;border:none;padding:5px 12px;border-radius:6px;font-size:12px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:4px;box-shadow:0 2px 6px rgba(0,122,255,0.25);">
              ✏️ Modificar
            </button>
            <button type="button" onclick="window.eliminarPreguntaDirecta('${targetBanc}', '${escapeHtml(String(q.id))}')" style="background:#fee2e2;color:#b91c1c;border:1px solid #fca5a5;padding:5px 9px;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;" title="Eliminar pregunta">
              🗑️
            </button>
          </div>
        </div>
        <div style="font-size:13.5px;font-weight:700;color:var(--text-main,#0f172a);line-height:1.4;">
          ${escapeHtml(q.pregunta || '')}
        </div>
        <div style="font-size:12px;color:#047857;background:rgba(16,185,129,0.08);padding:4px 8px;border-radius:6px;display:inline-flex;align-items:center;gap:4px;">
          <span>✅ Correcta:</span> <b>${escapeHtml(respText)}</b>
        </div>
      </div>
    `;
  }).join('');
}

function canviarBancModificar(banc) {
  const inputCerca = document.getElementById('cp-mod-cerca-input');
  const query = inputCerca ? inputCerca.value : '';
  renderLlistaModificarPreguntes(banc, query);
}

function filtrarPreguntesModificar(cerca) {
  const targetBanc = document.querySelector('input[name="cp-mod-banc"]:checked')?.value || 'pl';
  renderLlistaModificarPreguntes(targetBanc, cerca);
}

function eliminarPreguntaDirecta(banc, id) {
  if (!confirm(`Segur que vols eliminar la pregunta ${id} del banc de ${banc}?`)) return;
  if (typeof window.eliminarPreguntaCustom === 'function') {
    window.eliminarPreguntaCustom(banc, id);
  } else {
    const arrayViu = (typeof window.obtenirBancActiu === 'function') ? window.obtenirBancActiu(banc) : [];
    if (Array.isArray(arrayViu)) {
      const idx = arrayViu.findIndex(q => q && String(q.id).trim() === String(id).trim());
      if (idx !== -1) arrayViu.splice(idx, 1);
    }
  }
  mostrarToast(`🗑️ Pregunta ${id} eliminada.`, 'info');
  renderLlistaModificarPreguntes(banc);
}

function canviarBancCrearPregunta(banc, temaPref = null, municipiPref = null) {
  const select = document.getElementById('cp-select-tema');
  if (!select) return;

  // Mostrar o amagar selector de municipi
  const blocMun = document.getElementById('cp-bloc-municipi');
  if (blocMun) {
    blocMun.style.display = (banc === 'pl') ? 'block' : 'none';
  }

  // Obtenir totes les seccions existents d'aquest banc
  const dataset = (typeof window.obtenirBancActiu === 'function') ? window.obtenirBancActiu(banc) : [];
  const seccionsMap = new Map();
  (dataset || []).forEach(q => {
    const s = q.seccio || q.tema || q.categoria || q.ambit;
    if (s) seccionsMap.set(s, (seccionsMap.get(s) || 0) + 1);
  });

  // Si és Policia Local, afegim els temes oficials del municipi perquè estiguin disponibles fins i tot si tenen 0 preguntes
  let temesOficials = [];
  if (banc === 'pl') {
    const mun = municipiPref || (typeof window.obtenirMunicipiActiuPL === 'function' ? window.obtenirMunicipiActiuPL() : 'Constantí');
    if (typeof window.obtenirTemariPLPerMunicipi === 'function') {
      temesOficials = window.obtenirTemariPLPerMunicipi(mun);
    }
  }

  // Reconstruir opcions del select
  let html = `<option value="">-- Tria una secció o tema existent --</option>`;
  html += `<option value="NOU_TEMA">➕ Escriure un tema o municipi nou...</option>`;

  if (temesOficials.length > 0) {
    const munNom = municipiPref || (typeof window.obtenirMunicipiActiuPL === 'function' ? window.obtenirMunicipiActiuPL() : 'Constantí');
    html += `<optgroup label="Temari Oficial de ${escapeHtml(munNom)}">`;
    temesOficials.forEach(t => {
      const nomComplet = `${t.codi || 'T' + t.id}. ${t.nom}`;
      const count = seccionsMap.get(nomComplet) || seccionsMap.get(t.nom) || 0;
      const isSel = (temaPref && (temaPref === nomComplet || temaPref === t.nom || temaPref.includes(`Tema ${t.id}`))) ? 'selected' : '';
      html += `<option value="${escapeHtml(nomComplet)}" ${isSel}>${escapeHtml(nomComplet)} (${count} preguntes)</option>`;
    });
    html += `</optgroup>`;
  }

  if (banc === 'act') {
    html += `<optgroup label="Categories Oficials d'Actualitat">`;
    const catsAct = [
      '⚽ Esports i Fites Esportives',
      '🏛️ Política, Govern i Institucions',
      '⚖️ Seguretat Pública i Policia',
      '🏆 Premis, Cultura i Ciència',
      '🔥 Preguntes Clau i Més Repetides',
      '🌍 Societat, Medi Ambient i Efemèrides'
    ];
    catsAct.forEach(catNom => {
      const count = seccionsMap.get(catNom) || 0;
      const isSel = (temaPref && (temaPref === catNom || catNom.toLowerCase().includes(temaPref.toLowerCase()))) ? 'selected' : '';
      html += `<option value="${escapeHtml(catNom)}" ${isSel}>${escapeHtml(catNom)} (${count} preguntes)</option>`;
    });
    html += `</optgroup>`;
  }

  const seccions = Array.from(seccionsMap.entries());
  seccions.sort((a, b) => {
    const nomA = a[0] || '';
    const nomB = b[0] || '';
    const regexTema = /Tema\s*(\d+)/i;
    const mA = nomA.match(regexTema);
    const mB = nomB.match(regexTema);
    if (mA && mB) {
      const numA = parseInt(mA[1], 10);
      const numB = parseInt(mB[1], 10);
      if (numA !== numB) return numA - numB;
    } else if (mA && !mB) {
      return -1;
    } else if (!mA && mB) {
      return 1;
    }
    return nomA.localeCompare(nomB, 'ca', { numeric: true, sensitivity: 'base' });
  });

  if (seccions.length > 0) {
    html += `<optgroup label="Altres seccions existents (${banc.toUpperCase()})">`;
    seccions.forEach(([s, count]) => {
      const isSel = (temaPref && temaPref === s) ? 'selected' : '';
      html += `<option value="${escapeHtml(s)}" ${isSel}>${escapeHtml(s)} (${count} preguntes)</option>`;
    });
    html += `</optgroup>`;
  }

  select.innerHTML = html;

  if (temaPref) {
    for (let i = 0; i < select.options.length; i++) {
      if (select.options[i].value === temaPref || select.options[i].text.includes(temaPref)) {
        select.selectedIndex = i;
        break;
      }
    }
  }
  onCanviSelectTema(select.value);
}

function onCanviSelectTema(val) {
  const wrap = document.getElementById('cp-nou-tema-wrap');
  if (wrap) {
    wrap.style.display = (val === 'NOU_TEMA') ? 'block' : 'none';
    if (val === 'NOU_TEMA') {
      const input = document.getElementById('cp-nou-tema-input');
      if (input) input.focus();
    }
  }
}

function marcarOpcioCorrecta(index) {
  const hiddenInput = document.getElementById('cp-resposta-index');
  if (hiddenInput) hiddenInput.value = index;

  [0, 1, 2, 3].forEach(i => {
    const row = document.getElementById(`row-op-${i}`);
    const badge = document.getElementById(`badge-op-${i}`);
    const radio = document.querySelector(`input[name="cp-correcta-radio"][value="${i}"]`);
    if (row && badge) {
      if (i === index) {
        row.classList.add('correcta-activa');
        badge.style.background = '#10b981';
        badge.style.color = '#fff';
        if (radio) radio.checked = true;
      } else {
        row.classList.remove('correcta-activa');
        badge.style.background = 'var(--bg-card-subtle, #f1f5f9)';
        badge.style.color = 'var(--text-main, #334155)';
        if (radio) radio.checked = false;
      }
    }
  });
}

function desarPreguntaDirecta(event) {
  if (event) event.preventDefault();

  const modal = document.getElementById('modal-crear-pregunta');
  if (!modal) return;

  const isEditing = modal.dataset.mode === 'editar' && modal.dataset.editId;
  const editId = modal.dataset.editId;
  const editBanc = modal.dataset.editBanc;

  const bancRadio = modal.querySelector('input[name="banc-pregunta"]:checked') || modal.querySelector('input[name="cp-banc"]:checked');
  const banc = (isEditing && editBanc) ? editBanc : (bancRadio ? bancRadio.value : 'pl');

  const selectTema = document.getElementById('cp-select-tema');
  const nouTemaInput = document.getElementById('cp-nou-tema-input');
  let seccioFinal = selectTema ? selectTema.value.trim() : '';

  if (seccioFinal === 'NOU_TEMA') {
    seccioFinal = nouTemaInput ? nouTemaInput.value.trim() : '';
  }

  if (!seccioFinal) {
    mostrarToast('❌ Si us plau, tria o escriu el tema/secció.', 'error');
    if (selectTema) selectTema.focus();
    return;
  }

  const campPreguntaEl = document.getElementById('cp-pregunta') || document.getElementById('cp-text-pregunta');
  const textPregunta = campPreguntaEl ? campPreguntaEl.value.trim() : '';
  if (!textPregunta) {
    mostrarToast('❌ Si us plau, escriu l\'enunciat de la pregunta.', 'error');
    if (campPreguntaEl) campPreguntaEl.focus();
    return;
  }

  const opcions = [
    document.getElementById('cp-op-0')?.value.trim() || '',
    document.getElementById('cp-op-1')?.value.trim() || '',
    document.getElementById('cp-op-2')?.value.trim() || '',
    document.getElementById('cp-op-3')?.value.trim() || ''
  ];

  if (opcions.some(op => !op)) {
    mostrarToast('❌ Has d\'omplir les 4 opcions (A, B, C i D).', 'error');
    return;
  }

  const radioCorrecta = modal.querySelector('input[name="cp-resposta-correcta"]:checked') || modal.querySelector('input[name="cp-correcta-radio"]:checked');
  const respostaIndex = radioCorrecta ? parseInt(radioCorrecta.value, 10) : parseInt(document.getElementById('cp-resposta-index')?.value || '0', 10);
  const explicacio = document.getElementById('cp-explicacio')?.value.trim() || '';

  if (isEditing) {
    // MODIFICAR PREGUNTA EXISTENT
    const preguntaActualitzada = {
      id: editId,
      pregunta: textPregunta,
      opcions: opcions,
      resposta: respostaIndex,
      explicacio: explicacio,
      seccio: seccioFinal,
      tema: seccioFinal,
      categoria: seccioFinal,
      actualitzatEl: new Date().toISOString()
    };

    if (banc === 'mossos') {
      if (seccioFinal.includes('Àmbit B') || seccioFinal.includes('Ambit B')) preguntaActualitzada.ambit = 'Àmbit B';
      else if (seccioFinal.includes('Àmbit C') || seccioFinal.includes('Ambit C')) preguntaActualitzada.ambit = 'Àmbit C';
      else preguntaActualitzada.ambit = 'Àmbit A';
    }

    // Actualitzar array en memòria viva
    const viu = (typeof window.obtenirBancActiu === 'function') ? window.obtenirBancActiu(banc) : [];
    if (Array.isArray(viu)) {
      const idx = viu.findIndex(q => q && String(q.id).trim() === String(editId).trim());
      if (idx !== -1) {
        viu[idx] = { ...viu[idx], ...preguntaActualitzada };
      }
    }

    // Desar localment
    if (typeof desarPreguntaEditada === 'function') {
      desarPreguntaEditada(banc, editId, preguntaActualitzada);
    }

    // Persistir al servidor
    if (typeof enviarPreguntaAlFitxerServidor === 'function') {
      enviarPreguntaAlFitxerServidor(banc, preguntaActualitzada, false);
    }
    fetch('/api/custom-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ banc, pregunta: preguntaActualitzada })
    }).catch(() => {});

    mostrarToast(`✅ Pregunta ${editId} modificada i desada correctament al banc!`, 'success');
    tancarModalCrearPregunta();

    // Actualitzar la vista activa
    const viewPL = document.getElementById('view-pl');
    const viewMossos = document.getElementById('view-mossos');
    const viewAct = document.getElementById('view-actualitat');
    if (viewPL && viewPL.classList.contains('view-activa') && typeof window.mostrarTemarioPL === 'function') {
      window.mostrarTemarioPL();
    } else if (viewMossos && viewMossos.classList.contains('view-activa') && typeof window.mostrarTemarioMossos === 'function') {
      window.mostrarTemarioMossos();
    } else if (viewAct && viewAct.classList.contains('view-activa') && typeof window.mostrarTemarioActualitat === 'function') {
      window.mostrarTemarioActualitat();
    } else if (typeof actualizarEstadisticasTop === 'function') {
      actualizarEstadisticasTop();
    }
    return;
  }

  // CREAR NOVA PREGUNTA
  const novaPregunta = {
    id: `${banc}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    pregunta: textPregunta,
    opcions: opcions,
    resposta: respostaIndex,
    explicacio: explicacio,
    seccio: seccioFinal,
    tema: seccioFinal,
    categoria: seccioFinal,
    creatEl: new Date().toISOString()
  };

  if (banc === 'mossos') {
    if (seccioFinal.includes('Àmbit B') || seccioFinal.includes('Ambit B')) novaPregunta.ambit = 'Àmbit B';
    else if (seccioFinal.includes('Àmbit C') || seccioFinal.includes('Ambit C')) novaPregunta.ambit = 'Àmbit C';
    else novaPregunta.ambit = 'Àmbit A';
  } else if (banc === 'act') {
    let catNeta = 'General';
    const sLower = seccioFinal.toLowerCase();
    if (sLower.includes('esport')) catNeta = 'Esports';
    else if (sLower.includes('polític') || sLower.includes('politica') || sLower.includes('govern') || sLower.includes('instituc')) catNeta = 'Política';
    else if (sLower.includes('seguretat') || sLower.includes('policia')) catNeta = 'Seguretat';
    else if (sLower.includes('premi') || sLower.includes('cultur') || sLower.includes('ciènci')) catNeta = 'Premis';
    else if (sLower.includes('clau') || sLower.includes('repetid')) catNeta = 'Preguntes Clau';
    else catNeta = seccioFinal.replace(/^[\p{Emoji}\s]+/u, '').trim() || 'General';

    novaPregunta.categoria = catNeta;
    novaPregunta.seccio = seccioFinal;
  }

  // 1. Desar a la memòria local de l'aplicació
  if (typeof window.afegirPreguntesCustom === 'function') {
    window.afegirPreguntesCustom(banc, [novaPregunta]);
  }

  // 2. Persistir al fitxer i servidor
  if (typeof enviarPreguntaAlFitxerServidor === 'function') {
    enviarPreguntaAlFitxerServidor(banc, novaPregunta, true);
  }
  fetch('/api/custom-questions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ banc, pregunta: novaPregunta })
  }).then(r => r.json()).then(res => {
    console.log('Pregunta persistida al servidor:', res);
  }).catch(err => {
    console.warn('Avís en persistir pregunta al servidor:', err);
  });

  mostrarToast(`✅ Pregunta afegida amb èxit a «${seccioFinal}»!`, 'success');
  tancarModalCrearPregunta();

  const viewPL = document.getElementById('view-pl');
  const viewMossos = document.getElementById('view-mossos');
  const viewAct = document.getElementById('view-actualitat');
  if (viewPL && viewPL.classList.contains('view-activa') && typeof window.mostrarTemarioPL === 'function') {
    window.mostrarTemarioPL();
  } else if (viewMossos && viewMossos.classList.contains('view-activa') && typeof window.mostrarTemarioMossos === 'function') {
    window.mostrarTemarioMossos();
  } else if (viewAct && viewAct.classList.contains('view-activa') && typeof window.mostrarTemarioActualitat === 'function') {
    window.mostrarTemarioActualitat();
  } else if (typeof actualizarEstadisticasTop === 'function') {
    actualizarEstadisticasTop();
  }
}

window.obrirModalCrearPregunta = obrirModalCrearPregunta;
window.tancarModalCrearPregunta = tancarModalCrearPregunta;
window.canviarBancCrearPregunta = canviarBancCrearPregunta;
window.onCanviSelectTema = onCanviSelectTema;
window.marcarOpcioCorrecta = marcarOpcioCorrecta;
window.desarPreguntaDirecta = desarPreguntaDirecta;
window.carregarPreguntaPerEditar = carregarPreguntaPerEditar;
window.renderLlistaModificarPreguntes = renderLlistaModificarPreguntes;
window.canviarBancModificar = canviarBancModificar;
window.filtrarPreguntesModificar = filtrarPreguntesModificar;
window.eliminarPreguntaDirecta = eliminarPreguntaDirecta;
window.netejarFormulariCrearPregunta = netejarFormulariCrearPregunta;

// Carregar preguntes del servidor a l'arrencada per tenir sincronització total
function carregarPreguntesServidor() {
  fetch('/api/custom-questions')
    .then(r => r.json())
    .then(data => {
      if (!data) return;
      ['pl', 'mossos', 'act'].forEach(banc => {
        const llistaServidor = data[banc];
        if (Array.isArray(llistaServidor) && llistaServidor.length > 0) {
          const viu = (typeof window.obtenirBancActiu === 'function') ? window.obtenirBancActiu(banc) : [];
          llistaServidor.forEach(q => {
            if (q && q.id && !viu.some(item => item && item.id === q.id)) {
              viu.push(q);
            }
          });
        }
      });
    })
    .catch(() => { /* No hi ha connexió al servidor: mode estàtic resilient */ });
}

// ==========================================================================
// ⏱️ GESTIÓ DE DATES D'EXAMEN I COMPTE ENRERE DINÀMIC
// ==========================================================================
const STORAGE_EXAM_DATES = 'agentmedina_exam_dates';

function obtenirExamensCountdown() {
  try {
    const raw = localStorage.getItem(STORAGE_EXAM_DATES);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length > 0) return arr;
    }
  } catch (e) {
    console.warn('Error llegint exam_dates de localStorage:', e);
  }
  // Valors per defecte inicials
  const defaults = [
    {
      id: 'mossos_46_26',
      nom: 'Mossos',
      data: '2026-10-17',
      ico: '🔵',
      link: 'https://mossos.gencat.cat/ca/els_mossos_desquadra/acces_al_cos/Mosso_a/mosso-a-convocatoria-46-26/'
    },
    {
      id: 'pl_general',
      nom: 'P. Local',
      data: '2026-11-20',
      ico: '🚔',
      link: 'https://mollerussa.convoca.online/processDetail.html?id=190266bf-4c8b-49eb-4520-08de7dbdb6c7&type=0'
    }
  ];
  try {
    localStorage.setItem(STORAGE_EXAM_DATES, JSON.stringify(defaults));
  } catch (e) {}
  return defaults;
}

function desarExamensCountdown(llista) {
  try {
    localStorage.setItem(STORAGE_EXAM_DATES, JSON.stringify(llista));
  } catch (e) {}
  renderExamensCountdown();
}

function calcularDiesRestants(dataStr) {
  if (!dataStr) return null;
  const target = new Date(dataStr + 'T00:00:00');
  const today = new Date();
  // Comparar inici del dia actual
  today.setHours(0, 0, 0, 0);
  const diffTime = target - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function renderExamensCountdown() {
  const container = document.getElementById('topbar-examens-countdown');
  if (!container) return;

  const examens = obtenirExamensCountdown();
  let html = '';

  examens.forEach(e => {
    const dies = calcularDiesRestants(e.data);
    let badgeClass = 'exam-badge-blue';
    let textDies = '';

    if (dies === null) {
      textDies = '--';
    } else if (dies > 30) {
      badgeClass = 'exam-badge-blue';
      textDies = `${dies} dies`;
    } else if (dies > 7) {
      badgeClass = 'exam-badge-gold';
      textDies = `${dies} dies`;
    } else if (dies >= 0) {
      badgeClass = 'exam-badge-red';
      textDies = dies === 0 ? 'Avui! 🎉' : `${dies} dies! ⚠️`;
    } else {
      badgeClass = 'exam-badge-green';
      textDies = 'Finalitzat';
    }

    if (e.link) {
      html += `
        <a href="${escapeHtml(e.link)}" target="_blank" rel="noopener noreferrer" class="exam-pill" title="${escapeHtml(e.nom)} · Data: ${e.data} (Clica per obrir la convocatòria oficial)">
          <span>${e.ico || '📜'}</span>
          <span>${escapeHtml(e.nom)}:</span>
          <span class="exam-badge-days ${badgeClass}">${textDies}</span>
        </a>
      `;
    } else {
      html += `
        <div class="exam-pill" onclick="window.obrirModalGestioExamens()" title="${escapeHtml(e.nom)} · Data: ${e.data}">
          <span>${e.ico || '📜'}</span>
          <span>${escapeHtml(e.nom)}:</span>
          <span class="exam-badge-days ${badgeClass}">${textDies}</span>
        </div>
      `;
    }
  });

  // Botó per afegir data
  html += `
    <button type="button" class="exam-pill-add" onclick="window.obrirModalGestioExamens()" title="Afegir o configurar dates d'examen">
      <span>➕</span> <span>Afegir</span>
    </button>
  `;

  container.innerHTML = html;
}

function obrirModalGestioExamens() {
  const modal = document.getElementById('modal-gestio-examens');
  if (!modal) return;
  modal.classList.add('active');
  renderLlistaExamensGestio();
}

function tancarModalGestioExamens() {
  const modal = document.getElementById('modal-gestio-examens');
  if (modal) modal.classList.remove('active');
}

function renderLlistaExamensGestio() {
  const container = document.getElementById('llista-examens-gestio');
  if (!container) return;
  const examens = obtenirExamensCountdown();

  if (examens.length === 0) {
    container.innerHTML = `<div style="font-size:13px;color:var(--text-muted);padding:10px 0;">No hi ha dates d'examen configurades. Afegeix-ne una a dalt.</div>`;
    return;
  }

  container.innerHTML = examens.map(e => {
    const dies = calcularDiesRestants(e.data);
    let badgeText = dies !== null ? (dies >= 0 ? `${dies} dies restants` : 'Examen passat') : '';
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--bg-card);border:1px solid var(--border-card);border-radius:10px;">
        <div style="display:flex;align-items:center;gap:10px;min-width:0;">
          <span style="font-size:18px;">${e.ico || '📜'}</span>
          <div style="min-width:0;">
            <div style="font-weight:700;font-size:13px;color:var(--text-main);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${escapeHtml(e.nom)}
            </div>
            <div style="font-size:11.5px;color:var(--text-muted);display:flex;gap:6px;align-items:center;">
              <span>📅 ${e.data}</span>
              <span>·</span>
              <span style="color:#007aff;font-weight:700;">${badgeText}</span>
              ${e.link ? `<span>·</span> <a href="${escapeHtml(e.link)}" target="_blank" rel="noopener noreferrer" style="color:#007aff;text-decoration:none;">Enllaç ↗</a>` : ''}
            </div>
          </div>
        </div>
        <button type="button" onclick="window.eliminarDataExamen('${escapeHtml(e.id)}')" style="background:#fee2e2;color:#b91c1c;border:1px solid #fca5a5;padding:5px 9px;border-radius:6px;font-size:12px;cursor:pointer;" title="Eliminar aquesta data">
          🗑️
        </button>
      </div>
    `;
  }).join('');
}

function desarDataExamen(event) {
  if (event && event.preventDefault) event.preventDefault();
  const nomInput = document.getElementById('input-examen-nom');
  const dataInput = document.getElementById('input-examen-data');
  const icoSelect = document.getElementById('input-examen-ico');
  const linkInput = document.getElementById('input-examen-link');

  if (!nomInput || !dataInput || !nomInput.value.trim() || !dataInput.value) {
    mostrarToast('Si us plau, omple el nom i la data de l\'examen.', 'error');
    return;
  }

  const examens = obtenirExamensCountdown();
  const nouExamen = {
    id: `exam_${Date.now()}`,
    nom: nomInput.value.trim(),
    data: dataInput.value,
    ico: icoSelect ? icoSelect.value : '📜',
    link: linkInput ? linkInput.value.trim() : ''
  };

  examens.push(nouExamen);
  desarExamensCountdown(examens);

  nomInput.value = '';
  dataInput.value = '';
  if (linkInput) linkInput.value = '';

  renderLlistaExamensGestio();
  mostrarToast(`⏱️ Data d'examen per a «${nouExamen.nom}» desada amb èxit!`, 'success');
}

function eliminarDataExamen(id) {
  if (!confirm('Segur que vols eliminar aquesta data d\'examen del compte enrere?')) return;
  let examens = obtenirExamensCountdown();
  examens = examens.filter(e => e && String(e.id) !== String(id));
  desarExamensCountdown(examens);
  renderLlistaExamensGestio();
  mostrarToast('🗑️ Data eliminada del compte enrere.', 'info');
}

window.obtenirExamensCountdown = obtenirExamensCountdown;
window.renderExamensCountdown = renderExamensCountdown;
window.obrirModalGestioExamens = obrirModalGestioExamens;
window.tancarModalGestioExamens = tancarModalGestioExamens;
window.desarDataExamen = desarDataExamen;
window.eliminarDataExamen = eliminarDataExamen;

// ==========================================================================
// 📰 GESTOR DE PREGUNTES D'ACTUALITAT (ESBORRAR DESACTUALITZADES)
// ==========================================================================
let filtreCategoriaActualitatActiu = 'totes';

function obrirModalGestorActualitat(filtreInicial = 'totes') {
  const modal = document.getElementById('modal-gestor-actualitat');
  if (!modal) return;
  modal.classList.add('active');

  filtreCategoriaActualitatActiu = filtreInicial || 'totes';
  const btns = document.querySelectorAll('.btn-filtre-act');
  btns.forEach(b => {
    if (b.dataset.cat === filtreCategoriaActualitatActiu) b.classList.add('active');
    else b.classList.remove('active');
  });

  const cercaInput = document.getElementById('cerca-gestor-actualitat');
  if (cercaInput) cercaInput.value = '';

  renderLlistaGestorActualitat();
}

function tancarModalGestorActualitat() {
  const modal = document.getElementById('modal-gestor-actualitat');
  if (modal) modal.classList.remove('active');
}

function canviarFiltreCategoriaActualitat(cat, btn) {
  filtreCategoriaActualitatActiu = cat;
  document.querySelectorAll('.btn-filtre-act').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderLlistaGestorActualitat();
}

function filtrarGestorActualitat() {
  renderLlistaGestorActualitat();
}

function renderLlistaGestorActualitat() {
  const container = document.getElementById('llista-preguntes-gestor-actualitat');
  const comptador = document.getElementById('comptador-gestor-actualitat');
  if (!container) return;

  const dataset = (typeof window.obtenirBancActiu === 'function')
    ? window.obtenirBancActiu('act')
    : (Array.isArray(window.bancoActualitat) ? window.bancoActualitat : (Array.isArray(bancoActualitat) ? bancoActualitat : []));

  const cerca = (document.getElementById('cerca-gestor-actualitat')?.value || '').toLowerCase().trim();
  const catFiltre = filtreCategoriaActualitatActiu || 'totes';

  const mapKeywordsCat = {
    esports: ['esport', 'futbol', 'olimp', 'campion', 'atlet', 'piloto', 'motor', 'basquet', 'lliga', 'indycar', 'palou', 'pilota'],
    politica: ['polític', 'politica', 'govern', 'parlament', 'generalitat', 'estat', 'constitucio', 'senat', 'congres', 'ue', 'unió europea', 'institucio'],
    seguretat: ['seguretat', 'policia', 'mosso', 'guardia', 'emergenc', 'transit', 'societat', 'delict', 'normativ', 'llei'],
    cultura: ['premi', 'nobel', 'cultur', 'lletres', 'cienc', 'tecnolog', 'art', 'patrimoni', 'escriptor', 'sagrada família', 'gaudí'],
    repetides: ['repetid', 'clau', 'frequent', 'examen', 'oficial', 'noticia', 'recent']
  };

  const filtrades = dataset.filter(q => {
    if (!q) return false;
    const cat = (q.categoria || '').toLowerCase();
    const sec = (q.seccio || '').toLowerCase();
    const tem = (q.tema || '').toLowerCase();
    const txt = (q.pregunta || '').toLowerCase();

    // Filtre de cerca de text
    if (cerca && !txt.includes(cerca) && !cat.includes(cerca) && !sec.includes(cerca) && !String(q.id || '').toLowerCase().includes(cerca)) {
      return false;
    }

    // Filtre de categoria
    if (catFiltre !== 'totes') {
      const kws = mapKeywordsCat[catFiltre] || [catFiltre];
      const match = kws.some(kw => cat.includes(kw) || sec.includes(kw) || tem.includes(kw) || txt.includes(kw));
      if (!match) return false;
    }

    return true;
  });

  if (comptador) {
    comptador.textContent = `Mostrant ${filtrades.length} de ${dataset.length} preguntes d'Actualitat`;
  }

  if (filtrades.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:30px 20px;color:var(--text-muted);background:var(--bg-card-subtle);border-radius:12px;border:1px dashed var(--border-card);">
        <span style="font-size:28px;display:block;margin-bottom:8px;">🔍</span>
        <b>No s'ha trobat cap pregunta amb aquest filtre.</b>
        <p style="margin:4px 0 0;font-size:12.5px;">Pots crear-ne una de nova amb el botó «➕ Nova Pregunta».</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtrades.map(q => {
    const respIndex = (typeof q.resposta === 'number') ? q.resposta : 0;
    const respText = (Array.isArray(q.opcions) && q.opcions[respIndex]) ? q.opcions[respIndex] : 'Opció correcta';
    const categoria = q.seccio || q.categoria || q.tema || 'General';

    return `
      <div style="background:var(--bg-card);border:1.5px solid var(--border-card);border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:8px;box-shadow:0 2px 8px rgba(0,0,0,0.03);">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span style="background:rgba(0,122,255,0.1);color:#007aff;font-size:11px;font-weight:800;padding:2px 7px;border-radius:6px;font-family:monospace;">
              ${escapeHtml(String(q.id))}
            </span>
            <span style="font-size:12px;color:var(--text-muted);font-weight:700;">
              📁 ${escapeHtml(categoria)}
            </span>
          </div>
          <div style="display:flex;gap:6px;">
            <button type="button" onclick="window.tancarModalGestorActualitat();window.carregarPreguntaPerEditar('act', '${escapeHtml(String(q.id))}')" style="background:#007aff;color:#fff;border:none;padding:5px 12px;border-radius:6px;font-size:12px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:4px;">
              ✏️ Modificar
            </button>
            <button type="button" onclick="window.eliminarPreguntaActualitat('${escapeHtml(String(q.id))}')" style="background:#fee2e2;color:#b91c1c;border:1px solid #fca5a5;padding:5px 10px;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;" title="Esborrar pregunta desactualitzada">
              🗑️ Esborrar
            </button>
          </div>
        </div>

        <div style="font-size:13.5px;font-weight:700;color:var(--text-main);line-height:1.4;">
          ${escapeHtml(q.pregunta || '')}
        </div>

        <div style="display:flex;flex-wrap:wrap;gap:6px;font-size:12px;">
          <span style="color:#047857;background:rgba(16,185,129,0.1);padding:4px 8px;border-radius:6px;font-weight:700;">
            ✅ Correcta: ${escapeHtml(respText)}
          </span>
          ${q.explicacio ? `
            <span style="color:var(--text-muted);background:var(--bg-card-subtle);padding:4px 8px;border-radius:6px;font-size:11.5px;max-width:450px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(q.explicacio)}">
              💡 ${escapeHtml(q.explicacio)}
            </span>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function eliminarPreguntaActualitat(id) {
  if (!confirm(`Segur que vols eliminar la pregunta ${id} del banc d'Actualitat? Aquesta acció esborrarà permanentment la pregunta del fitxer.`)) {
    return;
  }

  // 1. Eliminar de la memòria viva
  if (Array.isArray(window.bancoActualitat)) {
    const idx = window.bancoActualitat.findIndex(q => q && String(q.id).trim() === String(id).trim());
    if (idx !== -1) window.bancoActualitat.splice(idx, 1);
  }
  if (typeof bancoActualitat !== 'undefined' && Array.isArray(bancoActualitat)) {
    const idx = bancoActualitat.findIndex(q => q && String(q.id).trim() === String(id).trim());
    if (idx !== -1) bancoActualitat.splice(idx, 1);
  }

  // 2. Persistir eliminació al fitxer del servidor
  fetch('/api/eliminar-pregunta-fitxer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ banc: 'act', id })
  }).then(r => r.json()).then(res => {
    console.log('Pregunta d\'actualitat eliminada del fitxer:', res);
  }).catch(err => {
    console.warn('Avís eliminant del servidor:', err);
  });

  // 3. Eliminar també de custom_questions.json si hi és
  fetch(`/api/custom-questions/act/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});

  mostrarToast(`🗑️ Pregunta ${id} eliminada d'Actualitat.`, 'info');
  renderLlistaGestorActualitat();

  // Actualitzar vistes si cal
  const viewAct = document.getElementById('view-actualitat');
  if (viewAct && viewAct.classList.contains('view-activa') && typeof window.mostrarTemarioActualitat === 'function') {
    window.mostrarTemarioActualitat();
  }
  const viewInici = document.getElementById('view-inici');
  if (viewInici && viewInici.classList.contains('view-activa') && typeof window.mostrarInici === 'function') {
    window.mostrarInici();
  }
}

window.obrirModalGestorActualitat = obrirModalGestorActualitat;
window.tancarModalGestorActualitat = tancarModalGestorActualitat;
window.canviarFiltreCategoriaActualitat = canviarFiltreCategoriaActualitat;
window.filtrarGestorActualitat = filtrarGestorActualitat;
window.renderLlistaGestorActualitat = renderLlistaGestorActualitat;
window.eliminarPreguntaActualitat = eliminarPreguntaActualitat;

// ==========================================================================
// ⚡ IMPORTACIÓ I GESTIÓ EN LOT AMB DETECCIO D'ACTUALITAT I SELECCIÓ
// ==========================================================================
let preguntesLotTemporals = [];

function canviarModeCreacio(mode) {
  const btnManual = document.getElementById('btn-mode-crear-manual');
  const btnModificar = document.getElementById('btn-mode-crear-modificar');
  const btnLot = document.getElementById('btn-mode-crear-lot');

  const panellManual = document.getElementById('form-crear-pregunta-directa');
  const panellModificar = document.getElementById('panell-modificar-preguntes-existent') || document.getElementById('panell-modificar-preguntes');
  const panellLot = document.getElementById('panell-crear-preguntes-lot');

  [btnManual, btnModificar, btnLot].forEach(b => {
    if (!b) return;
    b.style.background = 'transparent';
    b.style.color = 'var(--text-main)';
  });

  if (panellManual) panellManual.style.display = 'none';
  if (panellModificar) panellModificar.style.display = 'none';
  if (panellLot) panellLot.style.display = 'none';

  if (mode === 'editar') {
    if (btnModificar) {
      btnModificar.style.background = 'linear-gradient(135deg,#002B5E,#007aff)';
      btnModificar.style.color = '#fff';
    }
    if (panellModificar) panellModificar.style.display = 'block';
    const bancActiu = document.querySelector('input[name="cp-mod-banc"]:checked')?.value || 'pl';
    renderLlistaModificarPreguntes(bancActiu);
  } else if (mode === 'lot') {
    if (btnLot) {
      btnLot.style.background = 'linear-gradient(135deg,#002B5E,#007aff)';
      btnLot.style.color = '#fff';
    }
    if (panellLot) panellLot.style.display = 'block';
    recarregarTemesLot();
  } else {
    if (btnManual) {
      btnManual.style.background = 'linear-gradient(135deg,#002B5E,#007aff)';
      btnManual.style.color = '#fff';
    }
    if (panellManual) panellManual.style.display = 'block';
  }
}

function obrirModalImportarLot(banc = 'act') {
  obrirModalCrearPregunta(banc);
  canviarModeCreacio('lot');
  const radio = document.querySelector(`input[name="cp-lot-banc"][value="${banc}"]`);
  if (radio) {
    radio.checked = true;
    canviarBancLot(banc);
  }
}

function canviarBancLot(banc) {
  const blocMun = document.getElementById('cp-lot-bloc-municipi');
  if (blocMun) {
    blocMun.style.display = (banc === 'pl') ? 'block' : 'none';
  }
  recarregarTemesLot();
}

function recarregarTemesLot() {
  const select = document.getElementById('cp-lot-select-tema');
  if (!select) return;
  const banc = document.querySelector('input[name="cp-lot-banc"]:checked')?.value || 'pl';

  let html = `<option value="DETECTAR_AUTO">🎯 Detectar automàticament per contingut de la pregunta</option>`;

  if (banc === 'act') {
    html += `<optgroup label="Categories d'Actualitat">`;
    html += `<option value="⚽ Esports i Fites Esportives">⚽ Esports i Fites Esportives</option>`;
    html += `<option value="🏛️ Política, Govern i Institucions">🏛️ Política, Govern i Institucions</option>`;
    html += `<option value="⚖️ Seguretat Pública i Policia">⚖️ Seguretat Pública i Policia</option>`;
    html += `<option value="🏆 Premis, Cultura i Ciència">🏆 Premis, Cultura i Ciència</option>`;
    html += `<option value="🔥 Preguntes Clau i Més Repetides">🔥 Preguntes Clau i Més Repetides</option>`;
    html += `<option value="🌍 Societat, Medi Ambient i Efemèrides">🌍 Societat, Medi Ambient i Efemèrides</option>`;
    html += `</optgroup>`;
  } else if (banc === 'mossos') {
    html += `<optgroup label="Àmbits Mossos d'Esquadra">`;
    html += `<option value="Àmbit A - Coneixements de l'entorn">🔵 Àmbit A - Coneixements de l'entorn</option>`;
    html += `<option value="Àmbit B - Institucional">🔴 Àmbit B - Institucional</option>`;
    html += `<option value="Àmbit C - Seguretat i policia">🟢 Àmbit C - Seguretat i policia</option>`;
    html += `</optgroup>`;
  } else {
    html += `<optgroup label="Temari Policia Local">`;
    for (let i = 1; i <= 40; i++) {
      html += `<option value="Tema ${i}">Tema ${i}</option>`;
    }
    html += `</optgroup>`;
  }

  select.innerHTML = html;
}

function detectarCategoriaActualitat(text) {
  const t = (text || '').toLowerCase();
  if (t.includes('esport') || t.includes('futbol') || t.includes('olimp') || t.includes('campion') || t.includes('atlet') || t.includes('pilot') || t.includes('motor') || t.includes('indycar') || t.includes('palou') || t.includes('pilota')) {
    return '⚽ Esports i Fites Esportives';
  }
  if (t.includes('govern') || t.includes('parlament') || t.includes('generalitat') || t.includes('estatut') || t.includes('constituc') || t.includes('senat') || t.includes('congres') || t.includes('ue') || t.includes('europeu') || t.includes('president') || t.includes('consell')) {
    return '🏛️ Política, Govern i Institucions';
  }
  if (t.includes('policia') || t.includes('mosso') || t.includes('guardia') || t.includes('112') || t.includes('emergenc') || t.includes('transit') || t.includes('sct') || t.includes('delicte') || t.includes('seguretat') || t.includes('penal')) {
    return '⚖️ Seguretat Pública i Policia';
  }
  if (t.includes('premi') || t.includes('nobel') || t.includes('lletres') || t.includes('cultur') || t.includes('cienc') || t.includes('art') || t.includes('patrimoni') || t.includes('gaudí') || t.includes('sagrada família')) {
    return '🏆 Premis, Cultura i Ciència';
  }
  return '🔥 Preguntes Clau i Més Repetides';
}

function processarTextLot() {
  const textarea = document.getElementById('cp-lot-textarea');
  if (!textarea || !textarea.value.trim()) {
    mostrarToast('Si us plau, enganxa el text o les preguntes abans d\'analitzar.', 'error');
    return;
  }

  const raw = textarea.value.trim();
  const banc = document.querySelector('input[name="cp-lot-banc"]:checked')?.value || 'act';
  const temaSelectVal = document.getElementById('cp-lot-select-tema')?.value || 'DETECTAR_AUTO';

  let llista = [];

  // 1. Provar si és format JSON directe
  if (raw.startsWith('[') && raw.endsWith(']')) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        llista = parsed.map((item, idx) => {
          let seccio = item.seccio || item.categoria || item.tema;
          if (!seccio || seccio === 'DETECTAR_AUTO' || temaSelectVal !== 'DETECTAR_AUTO') {
            seccio = (temaSelectVal !== 'DETECTAR_AUTO') ? temaSelectVal : (banc === 'act' ? detectarCategoriaActualitat(item.pregunta) : (banc === 'mossos' ? 'Àmbit A' : 'Tema 1'));
          }
          return {
            id: item.id || `${banc.toUpperCase()}_LOT_${Date.now()}_${idx}`,
            pregunta: item.pregunta || '',
            opcions: Array.isArray(item.opcions) ? item.opcions : ['Opció A', 'Opció B', 'Opció C', 'Opció D'],
            resposta: typeof item.resposta === 'number' ? item.resposta : 0,
            explicacio: item.explicacio || '',
            seccio: seccio,
            categoria: seccio,
            tema: seccio
          };
        });
      }
    } catch (e) {}
  }

  // 2. Parser robust de format text natural (1. Enunciat... a)... b)... c)... d)... Resposta: c)
  if (llista.length === 0) {
    const blocs = raw.split(/\n\s*(?=\d+[\.\)]\s+)/g);
    blocs.forEach((bloc, idx) => {
      const bText = bloc.trim();
      if (!bText) return;

      const linies = bText.split('\n').map(l => l.trim()).filter(Boolean);
      if (linies.length < 3) return;

      const primera = linies[0].replace(/^\d+[\.\)]\s*/, '').trim();
      const opcions = [];
      let respostaIdx = 0;
      let explicacio = '';

      linies.slice(1).forEach(linia => {
        const matchOpcio = linia.match(/^([a-dA-D])[\.\)]\s*(.+)$/);
        if (matchOpcio) {
          opcions.push(matchOpcio[2].trim());
          return;
        }

        const matchResp = linia.match(/(?:Resposta|Correcta|Solució|Solucio)[\s:]*([a-dA-D])/i);
        if (matchResp) {
          const lletra = matchResp[1].toUpperCase();
          respostaIdx = (lletra === 'A') ? 0 : (lletra === 'B') ? 1 : (lletra === 'C') ? 2 : 3;
          return;
        }

        const matchExpl = linia.match(/(?:Explicació|Explicacio|Motiu)[\s:]*(.+)$/i);
        if (matchExpl) {
          explicacio = matchExpl[1].trim();
        }
      });

      if (primera && opcions.length >= 2) {
        while (opcions.length < 4) opcions.push(`Opció complementària ${opcions.length + 1}`);

        let seccio = (temaSelectVal !== 'DETECTAR_AUTO')
          ? temaSelectVal
          : (banc === 'act' ? detectarCategoriaActualitat(primera) : (banc === 'mossos' ? 'Àmbit A' : 'Tema 1'));

        llista.push({
          id: `${banc.toUpperCase()}_LOT_${Date.now()}_${idx}`,
          pregunta: primera,
          opcions: opcions.slice(0, 4),
          resposta: respostaIdx,
          explicacio: explicacio,
          seccio: seccio,
          categoria: seccio,
          tema: seccio
        });
      }
    });
  }

  if (llista.length === 0) {
    mostrarToast('No s\'ha pogut reconèixer cap pregunta vàlida. Fes clic a «📄 Veure exemple».', 'error');
    return;
  }

  preguntesLotTemporals = llista;

  // Render de la previsualització i notificació de categories
  const blocResum = document.getElementById('cp-lot-resum-bloc');
  const badgeRecompte = document.getElementById('cp-lot-badge-recompte');
  const containerPreview = document.getElementById('cp-lot-preview-container');
  const btnConfirmar = document.getElementById('btn-confirmar-lot');

  if (blocResum) blocResum.style.display = 'block';

  // Mostrar notificació clara del destí i permetre escollir
  if (badgeRecompte) {
    const catDestiPredominant = llista[0]?.seccio || 'General';
    badgeRecompte.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;width:100%;flex-wrap:wrap;gap:8px;">
        <span>🎯 <b>Trobades ${llista.length} preguntes</b> ${banc === 'act' ? `i assignades a <b>«${escapeHtml(catDestiPredominant)}»</b>` : ''}</span>
        ${banc === 'act' ? `
          <div style="display:flex;align-items:center;gap:6px;">
            <label style="font-size:12px;font-weight:700;color:var(--text-main);">Canviar destí de totes:</label>
            <select onchange="window.reassignarCategoriaTotesLot(this.value)" style="padding:4px 8px;border-radius:6px;font-size:12px;font-weight:700;border:1px solid #cbd5e1;background:#fff;color:#0f172a;">
              <option value="">-- Mantenir assignació automàtica --</option>
              <option value="⚽ Esports i Fites Esportives">⚽ Esports</option>
              <option value="🏛️ Política, Govern i Institucions">🏛️ Política</option>
              <option value="⚖️ Seguretat Pública i Policia">⚖️ Seguretat</option>
              <option value="🏆 Premis, Cultura i Ciència">🏆 Premis / Cultura</option>
              <option value="🔥 Preguntes Clau i Més Repetides">🔥 Preguntes Clau</option>
              <option value="🌍 Societat, Medi Ambient i Efemèrides">🌍 Societat / Efemèrides</option>
            </select>
          </div>
        ` : ''}
      </div>
    `;
  }

  renderPreviewLotCards();

  if (btnConfirmar) {
    btnConfirmar.disabled = false;
    btnConfirmar.style.opacity = '1';
    btnConfirmar.innerHTML = `💾 Confirmar i Desar (${llista.length} preguntes)`;
  }

  mostrarToast(`✨ Trobades ${llista.length} preguntes! Revisa-les a sota abans de desar.`, 'success');
}

function renderPreviewLotCards() {
  const containerPreview = document.getElementById('cp-lot-preview-container');
  if (!containerPreview) return;
  const banc = document.querySelector('input[name="cp-lot-banc"]:checked')?.value || 'act';

  containerPreview.innerHTML = preguntesLotTemporals.map((q, i) => {
    const respIndex = q.resposta || 0;
    const respText = q.opcions[respIndex] || 'Opció correcta';

    return `
      <div style="background:var(--bg-card);border:1px solid var(--border-card);border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:6px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
          <span style="font-weight:800;font-size:12px;color:var(--text-muted);">#${i + 1}</span>
          ${banc === 'act' ? `
            <div style="display:flex;align-items:center;gap:6px;">
              <label style="font-size:11.5px;font-weight:700;color:var(--text-muted);">Categoria:</label>
              <select onchange="window.canviarCategoriaPreguntaLot(${i}, this.value)" style="padding:3px 8px;border-radius:6px;font-size:11.5px;font-weight:700;border:1px solid var(--border-card);background:var(--bg-card-subtle);color:var(--text-main);">
                <option value="⚽ Esports i Fites Esportives" ${q.seccio.includes('Esport') ? 'selected' : ''}>⚽ Esports</option>
                <option value="🏛️ Política, Govern i Institucions" ${q.seccio.includes('Polític') || q.seccio.includes('Govern') ? 'selected' : ''}>🏛️ Política</option>
                <option value="⚖️ Seguretat Pública i Policia" ${q.seccio.includes('Seguretat') ? 'selected' : ''}>⚖️ Seguretat</option>
                <option value="🏆 Premis, Cultura i Ciència" ${q.seccio.includes('Premi') || q.seccio.includes('Cultur') ? 'selected' : ''}>🏆 Premis / Cultura</option>
                <option value="🔥 Preguntes Clau i Més Repetides" ${q.seccio.includes('Clau') || q.seccio.includes('Repetid') ? 'selected' : ''}>🔥 Preguntes Clau</option>
              </select>
            </div>
          ` : `
            <span style="font-size:11.5px;font-weight:700;color:#007aff;background:rgba(0,122,255,0.1);padding:2px 6px;border-radius:4px;">
              📁 ${escapeHtml(q.seccio)}
            </span>
          `}
        </div>
        <div style="font-size:13px;font-weight:700;color:var(--text-main);line-height:1.35;">
          ${escapeHtml(q.pregunta)}
        </div>
        <div style="font-size:12px;color:#047857;background:rgba(16,185,129,0.08);padding:3px 8px;border-radius:6px;display:inline-flex;align-items:center;gap:4px;">
          <span>✅ Correcta:</span> <b>${escapeHtml(respText)}</b>
        </div>
      </div>
    `;
  }).join('');
}

function reassignarCategoriaTotesLot(novaCat) {
  if (!novaCat) return;
  preguntesLotTemporals.forEach(q => {
    q.seccio = novaCat;
    q.categoria = novaCat;
    q.tema = novaCat;
  });
  renderPreviewLotCards();
  mostrarToast(`📁 Totes les preguntes s'assignaran a: ${novaCat}`, 'info');
}

function canviarCategoriaPreguntaLot(idx, novaCat) {
  if (preguntesLotTemporals[idx]) {
    preguntesLotTemporals[idx].seccio = novaCat;
    preguntesLotTemporals[idx].categoria = novaCat;
    preguntesLotTemporals[idx].tema = novaCat;
  }
}

function desarLotPreguntesDirecte() {
  if (!preguntesLotTemporals || preguntesLotTemporals.length === 0) {
    mostrarToast('No hi ha preguntes per desar.', 'error');
    return;
  }

  const banc = document.querySelector('input[name="cp-lot-banc"]:checked')?.value || 'act';
  const llistaDesar = [...preguntesLotTemporals];

  // 1. Desar en memòria viva local
  const viu = (typeof window.obtenirBancActiu === 'function') ? window.obtenirBancActiu(banc) : [];
  if (Array.isArray(viu)) {
    llistaDesar.forEach(q => {
      if (!viu.some(item => item && String(item.id).trim() === String(q.id).trim())) {
        viu.push(q);
      }
    });
  }

  // 2. Persistir directament al fitxer corresponent (Actualidad_preguntas.js, etc.)
  fetch('/api/modificar-preguntes-fitxer-lot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ banc, preguntes: llistaDesar })
  }).then(r => r.json()).then(res => {
    console.log('Lot desat al fitxer .js:', res);
  }).catch(err => {
    console.warn('Avís desant lot al servidor:', err);
  });

  // 3. Persistir a custom_questions.json com a còpia de seguretat
  llistaDesar.forEach(q => {
    fetch('/api/custom-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ banc, pregunta: q })
    }).catch(() => {});
  });

  mostrarToast(`💾 ${llistaDesar.length} preguntes afegides amb èxit al banc de ${banc.toUpperCase()}!`, 'success');
  tancarModalCrearPregunta();

  // Netejar temporals
  preguntesLotTemporals = [];
  const textarea = document.getElementById('cp-lot-textarea');
  if (textarea) textarea.value = '';

  // Actualitzar vistes
  const viewAct = document.getElementById('view-actualitat');
  const viewPL = document.getElementById('view-pl');
  const viewMossos = document.getElementById('view-mossos');
  if (viewAct && viewAct.classList.contains('view-activa') && typeof window.mostrarTemarioActualitat === 'function') {
    window.mostrarTemarioActualitat();
  } else if (viewPL && viewPL.classList.contains('view-activa') && typeof window.mostrarTemarioPL === 'function') {
    window.mostrarTemarioPL();
  } else if (viewMossos && viewMossos.classList.contains('view-activa') && typeof window.mostrarTemarioMossos === 'function') {
    window.mostrarTemarioMossos();
  } else if (typeof actualizarEstadisticasTop === 'function') {
    actualizarEstadisticasTop();
  }
}

function carregarExempleLot() {
  const textarea = document.getElementById('cp-lot-textarea');
  if (!textarea) return;
  textarea.value = `1. Qui ha guanyat el darrer Gran Premi de Fórmula 1 a Montmeló?
a) Carlos Sainz
b) Max Verstappen
c) Fernando Alonso
d) Lewis Hamilton
Resposta: b
Explicació: El pilot neerlandès ha guanyat la cursa al Circuit de Barcelona-Catalunya.

2. Quin organisme ostenta la competència exclusiva en matèria de protecció civil a Catalunya segons l'Estatut?
a) La Generalitat de Catalunya
b) El Ministeri de l'Interior
c) La Delegació del Govern
d) La Diputació Provincial
Resposta: a
Explicació: L'article 132 de l'Estatut d'Autonomia atribueix la competència exclusiva a la Generalitat.

3. Quin esportista català és considerat un dels millors jugadors d'hoquei patins de la història?
a) Jordi Bargalló
b) Marc Gual
c) Pau Bargalló
d) Aitor Egurrola
Resposta: d
Explicació: Aitor Egurrola és el porter més llorejat de la història de l'hoquei sobre patins català.`;
  mostrarToast('📄 Exemple d\'Actualitat carregat. Fes clic a «Analitzar i previsualitzar».', 'info');
}

function netejarTextareaLot() {
  const textarea = document.getElementById('cp-lot-textarea');
  if (textarea) textarea.value = '';
  preguntesLotTemporals = [];
  const blocResum = document.getElementById('cp-lot-resum-bloc');
  if (blocResum) blocResum.style.display = 'none';
  const btnConfirmar = document.getElementById('btn-confirmar-lot');
  if (btnConfirmar) {
    btnConfirmar.disabled = true;
    btnConfirmar.style.opacity = '0.5';
    btnConfirmar.innerHTML = '💾 Confirmar i Desar (0 preguntes)';
  }
}

function copiarPromptIA() {
  const banc = document.querySelector('input[name="cp-lot-banc"]:checked')?.value || 'act';
  let promptText = '';
  if (banc === 'act') {
    promptText = `Ets un preparador expert d'oposicions de Mossos d'Esquadra i Policia Local a Catalunya.
Genera 10 preguntes tipus test d'ACTUALITAT de màxima vigència per a aquest any sobre política, institucions catalanes, seguretat pública, societat, cultura o esports catalans.
Cada pregunta ha de tenir 4 opcions (a, b, c, d), indicar clarament la resposta correcta i una explicació breu amb la font o norma.
Format estricte requerit:

1. [Enunciat de la pregunta]
a) [Opció A]
b) [Opció B]
c) [Opció C]
d) [Opció D]
Resposta: [lletra correcta: a, b, c o d]
Explicació: [Motiu jurídic o font oficial]`;
  } else {
    promptText = `Ets un preparador d'oposicions policials a Catalunya. Genera 10 preguntes tipus test oficials de nivell d'examen.
Format estricte requerit:

1. [Enunciat de la pregunta]
a) [Opció A]
b) [Opció B]
c) [Opció C]
d) [Opció D]
Resposta: [lletra correcta: a, b, c o d]
Explicació: [Article de la llei vigent]`;
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(promptText).then(() => {
      mostrarToast('📋 Prompt copiat al portapapers! Enganxa\'l a ChatGPT o Gemini.', 'success');
    }).catch(() => {
      alert(promptText);
    });
  } else {
    alert(promptText);
  }
}

function enganxarPortapapersLot() {
  if (navigator.clipboard && navigator.clipboard.readText) {
    navigator.clipboard.readText().then(text => {
      const textarea = document.getElementById('cp-lot-textarea');
      if (textarea && text) {
        textarea.value = text;
        mostrarToast('📋 Text enganxat del portapapers! Ara fes clic a Analitzar.', 'info');
      }
    }).catch(() => {
      mostrarToast('Pots fer Ctrl+V directament dins del quadre de text.', 'info');
    });
  } else {
    mostrarToast('Pots fer Ctrl+V directament dins del quadre de text.', 'info');
  }
}

window.canviarModeCreacio = canviarModeCreacio;
window.obrirModalImportarLot = obrirModalImportarLot;
window.canviarBancLot = canviarBancLot;
window.recarregarTemesLot = recarregarTemesLot;
window.processarTextLot = processarTextLot;
window.renderPreviewLotCards = renderPreviewLotCards;
window.reassignarCategoriaTotesLot = reassignarCategoriaTotesLot;
window.canviarCategoriaPreguntaLot = canviarCategoriaPreguntaLot;
window.desarLotPreguntesDirecte = desarLotPreguntesDirecte;
window.carregarExempleLot = carregarExempleLot;
window.netejarTextareaLot = netejarTextareaLot;
window.copiarPromptIA = copiarPromptIA;
window.enganxarPortapapersLot = enganxarPortapapersLot;

// Inicialització en carregar la pàgina
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    inicialitzarTema();
    carregarPreguntesServidor();
    renderExamensCountdown();
  });
} else {
  inicialitzarTema();
  carregarPreguntesServidor();
  renderExamensCountdown();
}

// ============================================================================
// AGENT MEDINA - TUTOR IA & GESTOR D'ORDENANCES I TEMARI PROPI
// Permet consultar dubtes jurídics amb IA, carregar ordenances de municipis
// (Cunit, Badalona, etc.) i generar preguntes tipus test a mida.
// ============================================================================

(function () {
  'use strict';

  // Estat intern
  let pestanyaActiva = 'xat'; // 'xat', 'ordenances', 'generador'
  let documentActiuId = null;
  let documentsCache = [];
  let historialXat = [];
  let cosActiu = 'pl'; // 'pl', 'mossos', 'tots'
  let preguntesGeneradesUltimes = [];

  // Gestió de sessions i historial persistent de xat (Firebase + Local)
  let sessionsCache = [];
  let sessioActivaId = null;
  let modePantallaCompletaXat = false;
  let filtreCercaSessions = '';
  let barraLateralOberta = true;
  let drawerObert = false;
  let panellFiltresObert = false;
  let suggerimentsOberts = false;
  let ambitNormatiuActiu = 'general';

  function obtenirClauSessions() {
    const u = (typeof window.obtenirUsuariFirebase === 'function') ? window.obtenirUsuariFirebase() : null;
    if (u && u.uid) {
      return `agentmedina_chat_sessions_${u.uid}`;
    }
    return 'agentmedina_chat_sessions_local';
  }

  function carregarSessions() {
    try {
      const clau = obtenirClauSessions();
      let raw = localStorage.getItem(clau);
      if (!raw && clau !== 'agentmedina_chat_sessions_local') {
        raw = localStorage.getItem('agentmedina_chat_sessions_local') || localStorage.getItem('agentmedina_chat_sessions');
      }
      if (raw) {
        sessionsCache = JSON.parse(raw);
        if (!Array.isArray(sessionsCache)) sessionsCache = [];
      } else {
        sessionsCache = [];
      }
    } catch (e) {
      console.warn('Error carregant sessions de xat:', e);
      sessionsCache = [];
    }

    if (sessionsCache.length === 0) {
      const nova = {
        id: 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        titol: 'Nova consulta jurídica',
        dataCreacio: new Date().toISOString(),
        dataActualitzacio: new Date().toISOString(),
        cos: cosActiu || 'pl',
        contextDocId: documentActiuId || '',
        missatges: []
      };
      sessionsCache.push(nova);
      sessioActivaId = nova.id;
      guardarSessions();
    } else {
      if (!sessioActivaId || !sessionsCache.some(s => s.id === sessioActivaId)) {
        sessioActivaId = sessionsCache[0].id;
      }
    }

    // Sincronitzar historialXat amb la sessió activa
    const sActiva = sessionsCache.find(s => s.id === sessioActivaId) || sessionsCache[0];
    if (sActiva) {
      historialXat = sActiva.missatges || [];
      if (sActiva.cos) cosActiu = sActiva.cos;
      if (sActiva.contextDocId !== undefined) documentActiuId = sActiva.contextDocId;
    }
  }

  function guardarSessions() {
    try {
      const clau = obtenirClauSessions();
      const idx = sessionsCache.findIndex(s => s.id === sessioActivaId);
      if (idx !== -1) {
        sessionsCache[idx].missatges = historialXat;
        sessionsCache[idx].cos = cosActiu;
        sessionsCache[idx].contextDocId = documentActiuId;
        sessionsCache[idx].dataActualitzacio = new Date().toISOString();
      }
      localStorage.setItem(clau, JSON.stringify(sessionsCache));
      localStorage.setItem('agentmedina_chat_sessions', JSON.stringify(sessionsCache));

      // Sincronització immediata amb el compte de l'usuari (Firestore)
      if (typeof window.pujarDadesANucolManual === 'function') {
        window.pujarDadesANucolManual();
      }
    } catch (e) {
      console.warn('Error guardant sessions:', e);
    }
  }

  // Documents predeterminats de mostra si no n'hi ha cap desat
  const DOCUMENTS_MOSTRA = [
    {
      id: 'doc_mostra_cunit_civisme',
      titol: 'Ordenança de Convivència Ciutadana i Ús dels Espais Públics',
      municipi: 'Cunit',
      tipus: 'Ordenança Municipal',
      dataCreacio: new Date().toISOString(),
      dataActualitzacio: new Date().toISOString(),
      contingutText: `ORDENANÇA DE CONVIVÈNCIA CIUTADANA I ÚS DELS ESPAIS PÚBLICS DE CUNIT
Article 1. Objecte i àmbit d'aplicació
Aquesta ordenança té per objecte preservar l'espai públic com a lloc de convivència i civisme, garantint la llibertat de circulació, l'oci pacífic i el respecte als béns públics i privats del terme municipal de Cunit.

Article 12. Consum de begudes alcohòliques a la via pública
1. Queda prohibit el consum de begudes alcohòliques a la via pública quan alteri la convivència ciutadana o es realitzi en envasos de vidre o llaunes fora dels espais autoritzats (terrasses de bars amb llicència).
2. Queda terminantment prohibit el subministrament o venda d'alcohol a menors de 18 anys a qualsevol hora i establiment.

Article 24. Neteja viària i residus
1. Els propietaris o posseïdors d'animals estan obligats a recollir de manera immediata les deposicions fecals que els animals facin a les vies públiques, places o parcs.
2. És obligatori diluir amb aigua neta o aigua amb vinagre les miccions d'animals a façanes i mobiliari urbà.

Article 45. Classificació de les infraccions
1. Les infraccions a aquesta ordenança es classifiquen en lleus, greus i molt greus.
2. Són infraccions lleus:
   a) No recollir de manera immediata les dejeccions dels animals.
   b) Llençar burilles, papers o xiclets a terra.
   c) El consum de begudes alcohòliques a la via pública sense causar alteracions greus.
3. Són infraccions greus:
   a) Deteriorar el mobiliari urbà (papereres, bancs, senyals de trànsit) sempre que el dany no superi els 400 euros.
   b) Negar-se a identificar-se davant els agents de la Policia Local quan cometin una infracció a aquesta ordenança.
   c) La reiteració en la comissió de dues o més infraccions lleus en el termini d'un any.
4. Són infraccions molt greus:
   a) Causar danys intencionats a béns públics de valor superior a 400 euros.
   b) La venda ambulant de begudes alcohòliques sense autorització a la via pública.
   c) Incitar al desordre públic o impedir l'ús de serveis essencials.

Article 46. Sancions econòmiques
1. Les infraccions lleus se sancionaran amb multa de fins a 750 euros.
2. Les infraccions greus se sancionaran amb multa de 751 euros fins a 1.500 euros.
3. Les infraccions molt greus se sancionaran amb multa de 1.501 euros fins a 3.000 euros.

Article 47. Competència sancionadora
1. La competència per incoar i resoldre els procediments sancionadors correspon a l'Alcalde-President de l'Ajuntament de Cunit, que podrà delegar-la en el Regidor de Seguretat Ciutadana.
2. El termini màxim per notificar la resolució expressa del procediment sancionador serà de 6 mesos.`
    }
  ];

  let examensCache = [];
  let temesAnnexosCache = [];
  let examenAnalitzatActual = null;

  // Carregar documents des del servidor o localStorage
  async function carregarDocuments() {
    try {
      const res = await fetch('/api/documents-ordenances');
      const dades = await res.json();
      if (dades.success && Array.isArray(dades.documents) && dades.documents.length > 0) {
        documentsCache = dades.documents;
        return;
      }
    } catch (e) {
      console.warn('Error carregant documents del servidor, provant local:', e);
    }

    try {
      const loc = localStorage.getItem('agentmedina_documents_ordenances');
      if (loc) {
        documentsCache = JSON.parse(loc);
        if (documentsCache.length > 0) return;
      }
    } catch (_) {}

    // Si no n'hi ha cap, desarem el document de mostra
    documentsCache = [...DOCUMENTS_MOSTRA];
    desarDocumentsLocal(documentsCache);
  }

  function desarDocumentsLocal(docs) {
    try {
      localStorage.setItem('agentmedina_documents_ordenances', JSON.stringify(docs));
    } catch (_) {}
  }

  async function guardarDocument(doc) {
    let guardatServidor = false;
    try {
      const res = await fetch('/api/documents-ordenances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doc })
      });
      const dades = await res.json();
      if (dades.success && dades.doc) {
        guardatServidor = true;
        doc = dades.doc;
      }
    } catch (e) {
      console.warn('Error guardant document al servidor:', e);
    }

    const idx = documentsCache.findIndex(d => d.id === doc.id);
    if (idx !== -1) {
      documentsCache[idx] = doc;
    } else {
      documentsCache.unshift(doc);
    }
    desarDocumentsLocal(documentsCache);
    if (window.pujarDadesANucolManual) window.pujarDadesANucolManual();
    return doc;
  }

  async function esborrarDocument(id) {
    try {
      await fetch(`/api/documents-ordenances/${id}`, { method: 'DELETE' });
    } catch (_) {}
    documentsCache = documentsCache.filter(d => d.id !== id);
    if (documentActiuId === id) documentActiuId = null;
    desarDocumentsLocal(documentsCache);
    if (window.pujarDadesANucolManual) window.pujarDadesANucolManual();
  }

  // ---------- GESTIÓ DE TEMES ANNEXOS (NÚVOL I LOCAL) ----------
  async function carregarTemesAnnexos() {
    try {
      const res = await fetch('/api/temes-annexos');
      const dades = await res.json();
      if (dades.success && Array.isArray(dades.temes)) {
        temesAnnexosCache = dades.temes;
        localStorage.setItem('agentmedina_temes_annexos', JSON.stringify(temesAnnexosCache));
        return;
      }
    } catch (e) {}
    try {
      const loc = localStorage.getItem('agentmedina_temes_annexos');
      if (loc) temesAnnexosCache = JSON.parse(loc);
    } catch (_) {}
  }

  async function guardarTemaAnnex(tema) {
    if (!tema || !tema.nom) return null;
    try {
      const res = await fetch('/api/temes-annexos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tema })
      });
      const d = await res.json();
      if (d.success && d.tema) tema = d.tema;
    } catch (e) {}

    const idx = temesAnnexosCache.findIndex(t => t.id === tema.id);
    if (idx !== -1) temesAnnexosCache[idx] = tema;
    else temesAnnexosCache.push(tema);
    localStorage.setItem('agentmedina_temes_annexos', JSON.stringify(temesAnnexosCache));
    if (window.pujarDadesANucolManual) window.pujarDadesANucolManual();
    return tema;
  }

  async function eliminarTemaAnnex(id) {
    try {
      await fetch(`/api/temes-annexos/${id}`, { method: 'DELETE' });
    } catch (_) {}
    temesAnnexosCache = temesAnnexosCache.filter(t => t.id !== id);
    localStorage.setItem('agentmedina_temes_annexos', JSON.stringify(temesAnnexosCache));
    if (window.pujarDadesANucolManual) window.pujarDadesANucolManual();
  }

  // ---------- GESTIÓ D'EXÀMENS OFICIALS REALS ----------
  async function carregarExamensOficials() {
    try {
      const res = await fetch('/api/examens-oficials');
      const dades = await res.json();
      if (dades.success && Array.isArray(dades.examens)) {
        examensCache = dades.examens;
        localStorage.setItem('agentmedina_examens_oficials', JSON.stringify(examensCache));
        return;
      }
    } catch (e) {}
    try {
      const loc = localStorage.getItem('agentmedina_examens_oficials');
      if (loc) examensCache = JSON.parse(loc);
    } catch (_) {}
  }

  async function guardarExamenOficial(examen) {
    if (!examen || !examen.titol) return null;
    try {
      const res = await fetch('/api/examens-oficials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examen })
      });
      const d = await res.json();
      if (d.success && d.examen) examen = d.examen;
    } catch (e) {}

    const idx = examensCache.findIndex(e => e.id === examen.id);
    if (idx !== -1) examensCache[idx] = examen;
    else examensCache.unshift(examen);
    localStorage.setItem('agentmedina_examens_oficials', JSON.stringify(examensCache));
    if (window.pujarDadesANucolManual) window.pujarDadesANucolManual();
    return examen;
  }

  async function eliminarExamenOficial(id) {
    try {
      await fetch(`/api/examens-oficials/${id}`, { method: 'DELETE' });
    } catch (_) {}
    examensCache = examensCache.filter(e => e.id !== id);
    localStorage.setItem('agentmedina_examens_oficials', JSON.stringify(examensCache));
    if (window.pujarDadesANucolManual) window.pujarDadesANucolManual();
  }

  window.carregarTemesAnnexos = carregarTemesAnnexos;
  window.guardarTemaAnnex = guardarTemaAnnex;
  window.eliminarTemaAnnex = eliminarTemaAnnex;
  window.carregarExamensOficials = carregarExamensOficials;
  window.guardarExamenOficial = guardarExamenOficial;
  window.eliminarExamenOficial = eliminarExamenOficial;
  window.obtenirTemesAnnexos = () => temesAnnexosCache;
  window.obtenirExamensOficials = () => examensCache;

  // Renderitzador principal de la vista
  window.renderitzarVistaTutorIA = async function () {
    const container = document.getElementById('view-tutor-ia');
    if (!container) return;

    await Promise.all([carregarDocuments(), carregarTemesAnnexos(), carregarExamensOficials()]);
    carregarSessions();

    if (pestanyaActiva === 'xat') {
      renderitzarInterficieXatTelegram(container);
    } else {
      renderitzarContenidorPestanyes(container);
    }
  };

  function renderitzarContenidorPestanyes(container) {
    container.innerHTML = `
      <div class="tutor-container">
        <!-- HEADER COMPACTE PER ALS SUBTEMARIS AMB BOTÓ TORNAR AL XAT -->
        <div style="margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; background: #002B5E; color: white; padding: 10px 16px; border-radius: 12px; box-shadow: 0 3px 12px rgba(0,43,94,0.2);">
          <div style="display: flex; align-items: center; gap: 10px;">
            <button type="button" onclick="window.canviarPestanyaTutor('xat')" style="background: #0284c7; color: #ffffff; border: none; padding: 6px 12px; border-radius: 8px; font-weight: 700; font-size: 12.5px; cursor: pointer; display: flex; align-items: center; gap: 5px; transition: all 0.2s;">
              <span>💬</span> <span>Tornar al Xat</span>
            </button>
            <span style="font-weight: 800; font-size: 14px; letter-spacing: -0.01em;">Agent Medina · Temaris i Eines</span>
          </div>
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            <button class="tutor-nav-btn ${pestanyaActiva === 'examens' ? 'active' : ''}" onclick="window.canviarPestanyaTutor('examens')" style="border:none; padding:6px 10px; border-radius:7px; font-weight:700; font-size:12px; cursor:pointer; background:${pestanyaActiva === 'examens' ? '#ffffff' : 'rgba(255,255,255,0.15)'}; color:${pestanyaActiva === 'examens' ? '#002B5E' : '#ffffff'};">
              🏛️ Exàmens PDF (${examensCache.length})
            </button>
            <button class="tutor-nav-btn ${pestanyaActiva === 'temes_annexos' ? 'active' : ''}" onclick="window.canviarPestanyaTutor('temes_annexos')" style="border:none; padding:6px 10px; border-radius:7px; font-weight:700; font-size:12px; cursor:pointer; background:${pestanyaActiva === 'temes_annexos' ? '#ffffff' : 'rgba(255,255,255,0.15)'}; color:${pestanyaActiva === 'temes_annexos' ? '#002B5E' : '#ffffff'};">
              📑 Temes Annexos (${temesAnnexosCache.length})
            </button>
            <button class="tutor-nav-btn ${pestanyaActiva === 'ordenances' ? 'active' : ''}" onclick="window.canviarPestanyaTutor('ordenances')" style="border:none; padding:6px 10px; border-radius:7px; font-weight:700; font-size:12px; cursor:pointer; background:${pestanyaActiva === 'ordenances' ? '#ffffff' : 'rgba(255,255,255,0.15)'}; color:${pestanyaActiva === 'ordenances' ? '#002B5E' : '#ffffff'};">
              📂 Ordenances (${documentsCache.length})
            </button>
            <button class="tutor-nav-btn ${pestanyaActiva === 'generador' ? 'active' : ''}" onclick="window.canviarPestanyaTutor('generador')" style="border:none; padding:6px 10px; border-radius:7px; font-weight:700; font-size:12px; cursor:pointer; background:${pestanyaActiva === 'generador' ? '#ffffff' : 'rgba(255,255,255,0.15)'}; color:${pestanyaActiva === 'generador' ? '#002B5E' : '#ffffff'};">
              ⚡ Generar Tests
            </button>
          </div>
        </div>
        <div id="tutor-subview-content"></div>
      </div>
    `;
    renderitzarSubvista();
  }

  window.canviarPestanyaTutor = function (pestanya) {
    pestanyaActiva = pestanya;
    window.renderitzarVistaTutorIA();
  };

  function actualitzarDrawerSessionsUI() {
    const el = document.getElementById('tutor-drawer-sessions-list');
    if (!el) return;
    el.innerHTML = sessionsCache.map(s => `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;padding:6px 8px;border-radius:8px;background:${s.id === sessioActivaId ? 'rgba(0,132,255,0.15)' : 'transparent'};border:1px solid ${s.id === sessioActivaId ? '#0084ff' : 'transparent'};cursor:pointer;" onclick="window.carregarSessioOPredefinit('${s.id}')">
        <span style="font-size:12px;font-weight:600;color:#f1f5f9;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">
          💬 ${escapeHtml(s.titol || 'Consulta')}
        </span>
        <button 
          type="button" 
          onclick="event.stopPropagation(); window.eliminarSessioDrawer('${s.id}', event);" 
          style="background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.25);color:#fca5a5;cursor:pointer;font-size:12px;font-weight:bold;padding:2px 7px;border-radius:6px;line-height:1.2;display:flex;align-items:center;justify-content:center;transition:all 0.15s;" 
          onmouseover="this.style.background='rgba(239,68,68,0.3)'; this.style.color='#ffffff'" 
          onmouseout="this.style.background='rgba(239,68,68,0.12)'; this.style.color='#fca5a5'" 
          title="Eliminar consulta">✕</button>
      </div>
    `).join('');
  }

  function actualitzarMissatgesXatUI() {
    const msgBox = document.getElementById('tutor-chat-messages');
    if (msgBox) {
      msgBox.innerHTML = (historialXat.length === 0)
        ? renderitzarBenvingudaTelegram()
        : historialXat.map(renderitzarMissatgeTelegram).join('');
      msgBox.scrollTop = msgBox.scrollHeight;
    }
    const fsMsgBox = document.getElementById('tutor-fs-messages');
    if (fsMsgBox) {
      const inner = fsMsgBox.firstElementChild || fsMsgBox;
      inner.innerHTML = (historialXat.length === 0 ? renderitzarBenvingudaXat(obtenirDocActiu(), true) : '') +
        historialXat.map(msg => renderitzarMissatgeXat(msg, true)).join('');
      fsMsgBox.scrollTop = fsMsgBox.scrollHeight;
    }
    actualitzarDrawerSessionsUI();
  }

  function renderitzarSubvista() {
    if (pestanyaActiva === 'xat') {
      const msgBox = document.getElementById('tutor-chat-messages');
      if (msgBox) {
        actualitzarMissatgesXatUI();
        return;
      }
      const container = document.getElementById('view-tutor-ia');
      if (container) {
        renderitzarInterficieXatTelegram(container);
      }
      return;
    }

    const host = document.getElementById('tutor-subview-content');
    if (!host) {
      const container = document.getElementById('view-tutor-ia');
      if (container) renderitzarContenidorPestanyes(container);
      return;
    }

    if (pestanyaActiva === 'examens') {
      renderitzarExamensOficials(host);
    } else if (pestanyaActiva === 'temes_annexos') {
      renderitzarTemesAnnexos(host);
    } else if (pestanyaActiva === 'ordenances') {
      renderitzarOrdenances(host);
    } else if (pestanyaActiva === 'generador') {
      renderitzarGenerador(host);
    }
  }

  function obtenirTemesGuiaMossos() {
    const g = window.GUIA_MOSSOS_2026;
    return (g && Array.isArray(g.temes)) ? g.temes : [];
  }

  function obtenirDocActiu() {
    if (!documentActiuId) return null;
    if (documentActiuId === 'guia_auto') {
      return {
        id: 'guia_auto',
        titol: "Guia d'Estudi Mossos d'Esquadra (Juny 2026)",
        municipi: 'Temari Oficial (20 Temes / 242 Pàgines)',
        contingutText: ''
      };
    }
    if (typeof documentActiuId === 'string' && documentActiuId.startsWith('guia:')) {
      const tid = documentActiuId.replace('guia:', '');
      const temes = obtenirTemesGuiaMossos();
      const t = temes.find(x => x.id === tid || x.id.toLowerCase() === tid.toLowerCase() || x.id.replace(/^t_/, '').toLowerCase() === tid.replace(/^t_/, '').toLowerCase());
      if (t) {
        return {
          id: `guia:${t.id}`,
          titol: `${t.codi}: ${t.titol} [Pàg. ${t.pagines}]`,
          municipi: t.ambitNom,
          contingutText: t.contingutText,
          pagines: t.pagines
        };
      }
    }
    return documentsCache.find(d => d.id === documentActiuId) || null;
  }

  function obtenirEtiquetaAmbitResum() {
    if (documentActiuId === 'guia_auto') {
      return '📕 Guia Mossos (Auto)';
    }
    if (typeof documentActiuId === 'string' && documentActiuId.startsWith('guia:')) {
      const tid = documentActiuId.replace('guia:', '');
      const temes = obtenirTemesGuiaMossos();
      const t = temes.find(x => x.id === tid || x.id.toLowerCase() === tid.toLowerCase() || x.id.replace(/^t_/, '').toLowerCase() === tid.replace(/^t_/, '').toLowerCase());
      if (t) return `📘 ${t.codi}`;
      return `📘 Guia ${tid.toUpperCase()}`;
    }
    if (documentActiuId) {
      const d = documentsCache.find(x => x.id === documentActiuId);
      if (d) return `📎 ${d.municipi || d.titol.slice(0, 10)}`;
    }
    if (cosActiu === 'mossos' && (!ambitNormatiuActiu || ambitNormatiuActiu === 'guia_mossos')) {
      return '📕 Guia Mossos (Auto)';
    }
    if (ambitNormatiuActiu === 'transit') return '🚗 Trànsit';
    if (ambitNormatiuActiu === 'ordenances') return '📜 Ordenances';
    return '🌐 General';
  }

  function generarOpcionsAmbitSelect(cos, docId, ambit) {
    const temesGuia = obtenirTemesGuiaMossos();

    const temesA = temesGuia.filter(t => t.ambit === 'Àmbit A' || (t.id && t.id.startsWith('A')));
    const temesB = temesGuia.filter(t => t.ambit === 'Àmbit B' || (t.id && t.id.startsWith('B')));
    const temesC = temesGuia.filter(t => t.ambit === 'Àmbit C' || (t.id && t.id.startsWith('C')));

    const esGuiaAuto = docId === 'guia_auto' || (!docId && (cos === 'mossos' || ambit === 'guia_mossos'));

    const htmlBlocGuia = `
      <optgroup label="📕 Guia d'Estudi Mossos 2026 (Temari Oficial)">
        <option value="guia_auto" ${esGuiaAuto ? 'selected' : ''}>
          🔍 Guia Mossos: Cerca Intel·ligent (20 Temes / 242 Pàg.)
        </option>
      </optgroup>
      ${temesA.length > 0 ? `
        <optgroup label="📘 Àmbit A: Coneixements de l'entorn (A1-A7)">
          ${temesA.map(t => `
            <option value="guia:${t.id}" ${docId === ('guia:' + t.id) ? 'selected' : ''}>
              ${t.codi}: ${escapeHtml(t.titol.slice(0, 32))} [Pàg. ${t.pagines}]
            </option>
          `).join('')}
        </optgroup>
      ` : ''}
      ${temesB.length > 0 ? `
        <optgroup label="📘 Àmbit B: Institucional (B1-B8)">
          ${temesB.map(t => `
            <option value="guia:${t.id}" ${docId === ('guia:' + t.id) ? 'selected' : ''}>
              ${t.codi}: ${escapeHtml(t.titol.slice(0, 32))} [Pàg. ${t.pagines}]
            </option>
          `).join('')}
        </optgroup>
      ` : ''}
      ${temesC.length > 0 ? `
        <optgroup label="📘 Àmbit C: Seguretat i Policia (C1-C5)">
          ${temesC.map(t => `
            <option value="guia:${t.id}" ${docId === ('guia:' + t.id) ? 'selected' : ''}>
              ${t.codi}: ${escapeHtml(t.titol.slice(0, 32))} [Pàg. ${t.pagines}]
            </option>
          `).join('')}
        </optgroup>
      ` : ''}
    `;

    const htmlBlocGeneral = `
      <optgroup label="🌐 Normativa General Policial">
        <option value="general" ${(!docId && ambit === 'general') ? 'selected' : ''}>🌐 General (CP, LECrim, LOFCS, 16/91, CE)</option>
        <option value="transit" ${(!docId && ambit === 'transit') ? 'selected' : ''}>🚗 Trànsit (TRLTSV, RGC, RGV)</option>
        <option value="ordenances" ${(!docId && ambit === 'ordenances') ? 'selected' : ''}>📜 Ordenances Municipals Generals</option>
      </optgroup>
      ${documentsCache.length > 0 ? `
        <optgroup label="📎 Ordenances Carregades">
          ${documentsCache.map(d => `
            <option value="doc:${d.id}" ${docId === d.id || docId === ('doc:' + d.id) ? 'selected' : ''}>
              📎 [${escapeHtml(d.municipi || 'Doc')}] ${escapeHtml(d.titol.slice(0, 24))}...
            </option>
          `).join('')}
        </optgroup>
      ` : ''}
    `;

    if (cos === 'mossos') {
      return htmlBlocGuia + htmlBlocGeneral;
    }
    return htmlBlocGeneral + htmlBlocGuia;
  }

  // ==========================================================================
  // GESTIÓ D'HISTORIAL DE CONVERSES I SESSIONS
  // ==========================================================================
  window.crearNovaConversaTutor = function () {
    const d = new Date();
    const nova = {
      id: 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      titol: 'Nova consulta ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      dataCreacio: d.toISOString(),
      dataActualitzacio: d.toISOString(),
      cos: cosActiu || 'pl',
      contextDocId: documentActiuId || '',
      missatges: []
    };
    sessionsCache.unshift(nova);
    sessioActivaId = nova.id;
    historialXat = [];
    guardarSessions();
    renderitzarSubvista();
    if (modePantallaCompletaXat) {
      renderitzarPantallaCompletaModal();
    }
    setTimeout(() => {
      const inp = document.getElementById(modePantallaCompletaXat ? 'tutor-fs-input-msg' : 'tutor-input-msg');
      if (inp) inp.focus();
    }, 100);
  };

  window.canviarSessioTutor = function (id) {
    if (!id || id === sessioActivaId) return;
    guardarSessions();
    sessioActivaId = id;
    const s = sessionsCache.find(x => x.id === id);
    if (s) {
      historialXat = s.missatges || [];
      if (s.cos) cosActiu = s.cos;
      if (s.contextDocId !== undefined) documentActiuId = s.contextDocId;
    }
    renderitzarSubvista();
    if (modePantallaCompletaXat) {
      renderitzarPantallaCompletaModal();
    }
  };

  window.esborrarSessioTutor = function (id, e) {
    if (e) {
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
      if (typeof e.preventDefault === 'function') e.preventDefault();
    }

    // Eliminació directa sense bloquejos per confirm() de finestra/iframe
    sessionsCache = sessionsCache.filter(x => x.id !== id);

    if (sessionsCache.length === 0) {
      const nova = {
        id: 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        titol: 'Nova consulta jurídica',
        dataCreacio: new Date().toISOString(),
        dataActualitzacio: new Date().toISOString(),
        cos: cosActiu || 'mossos',
        contextDocId: documentActiuId || 'guia_auto',
        missatges: []
      };
      sessionsCache.push(nova);
      sessioActivaId = nova.id;
    } else if (sessioActivaId === id) {
      sessioActivaId = sessionsCache[0].id;
    }

    const sActiva = sessionsCache.find(s => s.id === sessioActivaId) || sessionsCache[0];
    if (sActiva) {
      historialXat = sActiva.missatges || [];
      if (sActiva.cos) cosActiu = sActiva.cos;
      if (sActiva.contextDocId !== undefined) documentActiuId = sActiva.contextDocId;
    } else {
      historialXat = [];
    }

    guardarSessions();
    actualitzarDrawerSessionsUI();
    actualitzarLlistaSessionsFS();
    actualitzarMissatgesXatUI();
    renderitzarSubvista();
    if (modePantallaCompletaXat) {
      renderitzarPantallaCompletaModal();
    }
    if (typeof window.mostrarToast === 'function') {
      window.mostrarToast('🗑️ Conversa eliminada', 'info');
    }
  };

  window.renombrarSessioTutor = function (id, e) {
    if (e && e.stopPropagation) e.stopPropagation();
    const s = sessionsCache.find(x => x.id === id);
    if (!s) return;
    const nou = prompt('Canvia el títol d\'aquesta consulta:', s.titol);
    if (nou && nou.trim()) {
      s.titol = nou.trim();
      guardarSessions();
      renderitzarSubvista();
      if (modePantallaCompletaXat) renderitzarPantallaCompletaModal();
    }
  };

  window.filtrarSessionsTutor = function (terme) {
    filtreCercaSessions = (terme || '').toLowerCase().trim();
    if (modePantallaCompletaXat) {
      const llistaHost = document.getElementById('tutor-fs-session-list');
      if (llistaHost) llistaHost.innerHTML = renderitzarItemsLlistaSessions();
    }
  };

  window.alternarBarraLateralTutor = function () {
    barraLateralOberta = !barraLateralOberta;
    const sidebar = document.getElementById('tutor-fs-sidebar');
    if (sidebar) {
      sidebar.style.display = barraLateralOberta ? 'flex' : 'none';
    }
  };

  // ==========================================================================
  // PANTALLA COMPLETA DEL XAT TUTOR
  // ==========================================================================
  window.alternarPantallaCompletaTutor = function (forcar) {
    if (typeof forcar === 'boolean') {
      modePantallaCompletaXat = forcar;
    } else {
      modePantallaCompletaXat = !modePantallaCompletaXat;
    }

    const wrapper = document.getElementById('tutor-app-wrapper');
    const btn = document.getElementById('tutor-btn-fullscreen');

    if (wrapper) {
      if (modePantallaCompletaXat) {
        wrapper.classList.add('is-fullscreen');
        if (btn) {
          btn.innerHTML = '🗗';
          btn.title = 'Sortir de pantalla completa (Esc)';
        }
        document.body.style.overflow = 'hidden';
      } else {
        wrapper.classList.remove('is-fullscreen');
        if (btn) {
          btn.innerHTML = '⛶';
          btn.title = 'Pantalla completa';
        }
        document.body.style.overflow = '';
      }
      return;
    }

    // Modal de seguretat si no s'ha renderitzat el wrapper
    let modal = document.getElementById('tutor-fullscreen-modal');
    if (modePantallaCompletaXat) {
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'tutor-fullscreen-modal';
        document.body.appendChild(modal);
      }
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
      renderitzarPantallaCompletaModal();
      setTimeout(() => {
        const inp = document.getElementById('tutor-fs-input-msg');
        if (inp) inp.focus();
      }, 100);
    } else {
      if (modal) {
        modal.style.display = 'none';
      }
      document.body.style.overflow = '';
      renderitzarSubvista();
    }
  };

  window.tancarPantallaCompletaTutor = function () {
    window.alternarPantallaCompletaTutor(false);
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modePantallaCompletaXat) {
        window.alternarPantallaCompletaTutor(false);
      }
    });
  }

  window.copiarTextRespostaTutor = function (btn) {
    if (!btn) return;
    const textEncoded = btn.getAttribute('data-text') || '';
    const text = decodeURIComponent(textEncoded);
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      const originalHtml = btn.innerHTML;
      btn.innerHTML = '<span>✓ Copiat al porta-retalls!</span>';
      btn.style.color = '#10b981';
      setTimeout(() => {
        btn.innerHTML = originalHtml;
        btn.style.color = '';
      }, 2200);
    }).catch(err => {
      console.warn('No s\'ha pogut copiar:', err);
    });
  };

  function renderitzarItemsLlistaSessions() {
    let filtrades = sessionsCache;
    if (filtreCercaSessions) {
      filtrades = sessionsCache.filter(s =>
        (s.titol || '').toLowerCase().includes(filtreCercaSessions) ||
        (s.missatges || []).some(m => (m.text || '').toLowerCase().includes(filtreCercaSessions))
      );
    }

    if (filtrades.length === 0) {
      return `
        <div style="padding: 20px 14px; text-align: center; color: #94a3b8; font-size: 13px;">
          Cap consulta coincideix amb la cerca.
        </div>
      `;
    }

    return filtrades.map(s => {
      const esActiva = s.id === sessioActivaId;
      const numMsgs = (s.missatges && s.missatges.length) || 0;
      let dataText = '';
      if (s.dataActualitzacio) {
        const d = new Date(s.dataActualitzacio);
        const ara = new Date();
        if (d.toDateString() === ara.toDateString()) {
          dataText = 'Avui ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else {
          dataText = d.toLocaleDateString([], { day: '2-digit', month: 'short' });
        }
      }

      return `
        <div 
          onclick="window.canviarSessioTutor('${s.id}')"
          style="padding: 10px 12px; border-radius: 10px; cursor: pointer; margin-bottom: 4px; display: flex; align-items: center; justify-content: space-between; gap: 8px; transition: all 0.15s; background: ${esActiva ? '#1e293b' : 'transparent'}; border: 1px solid ${esActiva ? '#38bdf8' : 'transparent'};"
          onmouseover="if(!${esActiva}) this.style.background='rgba(255,255,255,0.05)'"
          onmouseout="if(!${esActiva}) this.style.background='transparent'"
          title="${escapeHtml(s.titol)}">
          
          <div style="flex: 1; min-width: 0;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 13px; color: ${esActiva ? '#38bdf8' : '#cbd5e1'};">💬</span>
              <span style="font-size: 13px; font-weight: ${esActiva ? '700' : '500'}; color: ${esActiva ? '#ffffff' : '#e2e8f0'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block;">
                ${escapeHtml(s.titol || 'Sense títol')}
              </span>
            </div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px; display: flex; align-items: center; gap: 8px;">
              <span>${dataText}</span>
              ${numMsgs > 0 ? `<span style="background: rgba(255,255,255,0.08); padding: 1px 6px; border-radius: 999px; font-size: 10px; color: #94a3b8;">${numMsgs} msgs</span>` : ''}
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
            <button 
              type="button"
              onclick="window.renombrarSessioTutor('${s.id}', event)" 
              style="background: transparent; border: none; color: #94a3b8; font-size: 12px; cursor: pointer; padding: 4px; border-radius: 4px; opacity: 0.7; transition: opacity 0.2s;"
              onmouseover="this.style.opacity='1'; this.style.color='#38bdf8'"
              onmouseout="this.style.opacity='0.7'; this.style.color='#94a3b8'"
              title="Canviar títol">
              ✏️
            </button>
            <button 
              type="button"
              onclick="window.esborrarSessioTutor('${s.id}', event)" 
              style="background: transparent; border: none; color: #94a3b8; font-size: 12px; cursor: pointer; padding: 4px; border-radius: 4px; opacity: 0.7; transition: opacity 0.2s;"
              onmouseover="this.style.opacity='1'; this.style.color='#f87171'"
              onmouseout="this.style.opacity='0.7'; this.style.color='#94a3b8'"
              title="Eliminar consulta">
              🗑️
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderitzarPantallaCompletaModal() {
    const modal = document.getElementById('tutor-fullscreen-modal');
    if (!modal) return;

    const docActiu = obtenirDocActiu();
    const gMossos = window.GUIA_MOSSOS_2026;
    const temesGuia = (gMossos && Array.isArray(gMossos.temes)) ? gMossos.temes : [];
    const sessioActiva = sessionsCache.find(s => s.id === sessioActivaId) || sessionsCache[0];
    const usuariFb = (typeof window.obtenirUsuariFirebase === 'function') ? window.obtenirUsuariFirebase() : null;

    modal.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 999999;
      background: #091024;
      color: #f8fafc;
      display: flex;
      flex-direction: row;
      height: 100vh;
      width: 100vw;
      overflow: hidden;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    modal.innerHTML = `
      <!-- BARRA LATERAL D'HISTORIAL -->
      <aside id="tutor-fs-sidebar" style="width: 320px; min-width: 280px; max-width: 380px; background: #070c1d; border-right: 1.5px solid #1e293b; display: ${barraLateralOberta ? 'flex' : 'none'}; flex-direction: column; height: 100%; flex-shrink: 0; transition: width 0.2s;">
        
        <!-- HEADER BARRA LATERAL -->
        <div style="padding: 16px; border-bottom: 1.5px solid #1e293b; display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.15);">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 32px; height: 32px; border-radius: 8px; background: linear-gradient(135deg, #002B5E, #0284c7); display: flex; align-items: center; justify-content: center; font-size: 18px; box-shadow: 0 2px 6px rgba(0,43,94,0.4);">
              🧠
            </div>
            <div>
              <div style="font-size: 14px; font-weight: 800; color: #ffffff; letter-spacing: -0.01em;">Agent Medina Tutor</div>
              <div style="font-size: 11px; color: #38bdf8; font-weight: 600;">Pantalla Completa</div>
            </div>
          </div>
          <button 
            type="button" 
            onclick="window.alternarBarraLateralTutor()" 
            style="background: transparent; border: 1px solid #334155; color: #94a3b8; border-radius: 6px; padding: 4px 8px; font-size: 12px; cursor: pointer;"
            title="Amagar panell lateral">
            ◀ Amagar
          </button>
        </div>

        <!-- ESTAT DE COMPTE / SINCRONITZACIÓ -->
        <div style="padding: 10px 14px; border-bottom: 1px solid #1e293b; background: #0c152e; display: flex; align-items: center; justify-content: space-between; font-size: 11.5px;">
          ${usuariFb && usuariFb.email ? `
            <div style="display: flex; align-items: center; gap: 6px; color: #10b981; font-weight: 700;">
              <span>☁️ Sincronitzat</span>
              <span style="color: #94a3b8; font-weight: 400; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">(${usuariFb.email})</span>
            </div>
          ` : `
            <div style="display: flex; align-items: center; gap: 6px; color: #f59e0b; font-weight: 600;">
              <span>💾 Historial local</span>
            </div>
          `}
          ${typeof window.alternarSessioFirebase === 'function' ? `
            <button 
              type="button" 
              onclick="window.alternarSessioFirebase()" 
              style="background: #1e293b; border: 1px solid #334155; color: #e2e8f0; border-radius: 6px; padding: 2px 7px; font-size: 11px; cursor: pointer;">
              ${usuariFb ? 'Compte' : 'Accedir'}
            </button>
          ` : ''}
        </div>

        <!-- BOTÓ NOVA CONVERSA -->
        <div style="padding: 12px 14px 8px 14px;">
          <button 
            type="button"
            onclick="window.crearNovaConversaTutor()" 
            style="width: 100%; background: linear-gradient(135deg, #002B5E, #0284c7); color: #ffffff; border: 1.5px solid rgba(56,189,248,0.3); border-radius: 10px; padding: 10px 14px; font-size: 13.5px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 12px rgba(2,132,199,0.25); transition: all 0.2s;"
            onmouseover="this.style.boxShadow='0 4px 16px rgba(2,132,199,0.45)'"
            onmouseout="this.style.boxShadow='0 4px 12px rgba(2,132,199,0.25)'">
            <span style="font-size: 16px;">➕</span>
            <span>Nova consulta jurídica</span>
          </button>
        </div>

        <!-- FILTRE DE CERCA DE SESSIONS -->
        <div style="padding: 6px 14px 10px 14px;">
          <input 
            type="text" 
            placeholder="🔍 Cercar a l'historial..." 
            value="${escapeHtml(filtreCercaSessions)}"
            oninput="window.filtrarSessionsTutor(this.value)"
            style="width: 100%; box-sizing: border-box; background: #0f172a; border: 1px solid #1e293b; border-radius: 8px; padding: 7px 10px; font-size: 12px; color: #ffffff; outline: none;"
          />
        </div>

        <!-- LLISTAT DE CONVERSES DESADES -->
        <div id="tutor-fs-session-list" style="flex: 1; overflow-y: auto; padding: 0 10px 16px 10px;">
          ${renderitzarItemsLlistaSessions()}
        </div>

        <!-- PEU DE LA BARRA LATERAL -->
        <div style="padding: 10px 14px; border-top: 1.5px solid #1e293b; font-size: 11px; color: #64748b; display: flex; align-items: center; justify-content: space-between;">
          <span>${sessionsCache.length} consultes guardades</span>
          <span>Esc per sortir</span>
        </div>
      </aside>

      <!-- PANELL PRINCIPAL DE XAT -->
      <main id="tutor-fs-main" style="flex: 1; display: flex; flex-direction: column; height: 100%; background: #0b1329; position: relative; min-width: 0; overflow: hidden;">
        
        <!-- HEADER DEL PANELL PRINCIPAL -->
        <header style="padding: 12px 20px; border-bottom: 1.5px solid #1e293b; background: #070c1d; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; z-index: 10;">
          
          <div style="display: flex; align-items: center; gap: 12px; min-width: 220px; flex: 1;">
            ${!barraLateralOberta ? `
              <button 
                type="button" 
                onclick="window.alternarBarraLateralTutor()" 
                style="background: #1e293b; border: 1px solid #334155; color: #e2e8f0; border-radius: 8px; padding: 6px 10px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                <span>☰</span> <span>Historial (${sessionsCache.length})</span>
              </button>
            ` : ''}

            <div style="display: flex; align-items: center; gap: 8px;">
              <h2 style="margin: 0; font-size: 16px; font-weight: 800; color: #ffffff; letter-spacing: -0.01em; max-width: 320px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${escapeHtml((sessioActiva && sessioActiva.titol) || 'Xat Tutor')}
              </h2>
              ${sessioActiva ? `
                <button 
                  type="button" 
                  onclick="window.renombrarSessioTutor('${sessioActiva.id}')" 
                  style="background: transparent; border: none; color: #94a3b8; font-size: 13px; cursor: pointer; padding: 2px;"
                  title="Canviar títol">
                  ✏️
                </button>
              ` : ''}
            </div>
          </div>

          <!-- CONTROLS: COS, CONTEXT I BOTÓ SORTIR -->
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            
            <!-- Selector de Cos -->
            <div style="display: flex; align-items: center; background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 2px;">
              <button 
                type="button" 
                onclick="window.canviarCosTutor('pl'); window.renderitzarPantallaCompletaModal();"
                style="border: none; padding: 5px 10px; border-radius: 6px; font-size: 11.5px; font-weight: 700; cursor: pointer; background: ${cosActiu === 'pl' ? '#002B5E' : 'transparent'}; color: ${cosActiu === 'pl' ? '#38bdf8' : '#94a3b8'}; transition: all 0.15s;">
                🚔 PL
              </button>
              <button 
                type="button" 
                onclick="window.canviarCosTutor('mossos'); window.renderitzarPantallaCompletaModal();"
                style="border: none; padding: 5px 10px; border-radius: 6px; font-size: 11.5px; font-weight: 700; cursor: pointer; background: ${cosActiu === 'mossos' ? '#002B5E' : 'transparent'}; color: ${cosActiu === 'mossos' ? '#38bdf8' : '#94a3b8'}; transition: all 0.15s;">
                👮 Mossos
              </button>
              <button 
                type="button" 
                onclick="window.canviarCosTutor('tots'); window.renderitzarPantallaCompletaModal();"
                style="border: none; padding: 5px 10px; border-radius: 6px; font-size: 11.5px; font-weight: 700; cursor: pointer; background: ${cosActiu === 'tots' ? '#002B5E' : 'transparent'}; color: ${cosActiu === 'tots' ? '#38bdf8' : '#94a3b8'}; transition: all 0.15s;">
                ⚖️ Ambdós
              </button>
            </div>

            <!-- Selector de Context -->
            <select 
              id="tutor-fs-sel-doc" 
              onchange="window.canviarDocumentActiu(this.value); window.renderitzarPantallaCompletaModal();" 
              style="background: #0f172a; border: 1px solid #334155; padding: 6px 10px; border-radius: 8px; font-size: 12px; font-weight: 600; color: #ffffff; max-width: 280px; cursor: pointer; outline: none;">
              ${generarOpcionsAmbitSelect(cosActiu, documentActiuId, ambitNormatiuActiu)}
            </select>

            <!-- Botó Netejar Xat -->
            <button 
              type="button"
              onclick="window.netejarHistorialXat()" 
              style="background: #0f172a; border: 1px solid #334155; color: #94a3b8; padding: 6px 10px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer;" 
              title="Buidar conversa">
              🗑️ Netejar
            </button>

            <!-- Botó Sortir Pantalla Completa -->
            <button 
              type="button"
              onclick="window.tancarPantallaCompletaTutor()" 
              style="background: #ef4444; color: #ffffff; border: none; padding: 6px 14px; border-radius: 8px; font-size: 12.5px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 8px rgba(239,68,68,0.3); transition: background 0.2s;"
              onmouseover="this.style.background='#dc2626'"
              onmouseout="this.style.background='#ef4444'"
              title="Sortir de la pantalla completa (Esc)">
              <span>✕</span>
              <span>Sortir</span>
            </button>
          </div>
        </header>

        <!-- STREAM DE MISSATGES (GRAN, AMB ESPAI I LLETRA CÒMODA) -->
        <div id="tutor-fs-messages" style="flex: 1; overflow-y: auto; padding: 24px 20px; display: flex; flex-direction: column;">
          <div style="max-width: 860px; width: 100%; margin: 0 auto; display: flex; flex-direction: column; gap: 18px;">
            ${historialXat.length === 0 ? renderitzarBenvingudaXat(docActiu, true) : ''}
            ${historialXat.map(msg => renderitzarMissatgeXat(msg, true)).join('')}
          </div>
        </div>

        <!-- ACCIONS RÀPIDES I FORMULARI D'ENTRADA A SOTA -->
        <div style="background: #070c1d; border-top: 1.5px solid #1e293b; padding: 12px 20px 18px 20px;">
          <div style="max-width: 860px; width: 100%; margin: 0 auto; display: flex; flex-direction: column; gap: 10px;">
            
            <!-- CHIPS DE PROMPTS RÀPIDS -->
            <div style="display: flex; gap: 8px; overflow-x: auto; white-space: nowrap; padding-bottom: 4px; -webkit-overflow-scrolling: touch;">
              <button type="button" class="quick-prompt-btn" onclick="window.generar3PreguntesTestTemaActiu()" style="background: linear-gradient(135deg, rgba(245,158,11,0.25), rgba(217,119,6,0.35)); border: 1.5px solid #f59e0b; border-radius: 20px; padding: 5px 14px; font-size: 12px; color: #fde047; cursor: pointer; font-weight: 800; flex-shrink: 0; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 8px rgba(245,158,11,0.25);">
                <span>🎯</span> <span>Fes-me 3 preguntes test d'aquest tema</span>
              </button>
              <button type="button" class="quick-prompt-btn" onclick="window.omplirIEnviarPrompt('Fes-me una regla mnemotècnica clara per recordar els principis bàsics d\\'actuació policial.')" style="background:#0f172a; border:1px solid #334155; border-radius:20px; padding:5px 12px; font-size:12px; color:#cbd5e1; cursor:pointer; font-weight:600; flex-shrink:0;">
                💡 Mnemotècnica principis d'actuació
              </button>
              <button type="button" class="quick-prompt-btn" onclick="window.omplirIEnviarPrompt('Quina és la diferència exacta entre detenció policial i detenció judicial segons la LECrim?')" style="background:#0f172a; border:1px solid #334155; border-radius:20px; padding:5px 12px; font-size:12px; color:#cbd5e1; cursor:pointer; font-weight:600; flex-shrink:0;">
                ⚖️ Detenció Policial vs Judicial
              </button>
              <button type="button" class="quick-prompt-btn" onclick="window.omplirIEnviarPrompt('Planteja\\'m un cas pràctic d\\'una actuació a la via pública i fes-me 3 preguntes amb la seva solució jurídica.')" style="background:#0f172a; border:1px solid #334155; border-radius:20px; padding:5px 12px; font-size:12px; color:#cbd5e1; cursor:pointer; font-weight:600; flex-shrink:0;">
                🚔 Cas pràctic policial
              </button>
              ${docActiu ? `
                <button type="button" class="quick-prompt-btn" onclick="window.omplirIEnviarPrompt('Quines són les infraccions molt greus que recull aquesta ordenança i quines sancions tenen?')" style="background:rgba(2,132,199,0.2); border:1px solid #0284c7; border-radius:20px; padding:5px 12px; font-size:12px; color:#38bdf8; cursor:pointer; font-weight:700; flex-shrink:0;">
                  📜 Infraccions i sancions d'aquesta ordenança
                </button>
              ` : `
                <button type="button" class="quick-prompt-btn" onclick="window.omplirIEnviarPrompt('Quins són els terminis clau de la Llei 39/2015 que solen preguntar als exàmens oficials?')" style="background:#0f172a; border:1px solid #334155; border-radius:20px; padding:5px 12px; font-size:12px; color:#cbd5e1; cursor:pointer; font-weight:600; flex-shrink:0;">
                  ⏱️ Terminis administratius d'examen
                </button>
              `}
            </div>

            <!-- FORMULARI D'ENTRADA -->
            <form id="tutor-fs-chat-form" onsubmit="window.enviarMissatgeTutor(event)" style="display: flex; gap: 12px; align-items: flex-end;">
              <div style="flex: 1; background: #0f172a; border: 1.5px solid #334155; border-radius: 14px; padding: 10px 14px; display: flex; flex-direction: column; gap: 4px; box-shadow: 0 4px 16px rgba(0,0,0,0.3);">
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #64748b;">
                  <span>Escriu la teva consulta jurídica, article o cas pràctic:</span>
                  <span>Enter per enviar · Shift+Enter salt de línia</span>
                </div>
                <textarea 
                  id="tutor-fs-input-msg" 
                  placeholder="${docActiu ? `Fes una pregunta sobre '${escapeHtml(docActiu.titol)}'...` : 'Escriu qualsevol dubte jurídic, sol·licita un cas pràctic o premissa d\'oposició...'}" 
                  oninput="window.handleTutorInputAutoResize(this)" 
                  onkeydown="window.handleTutorInputKeyDown(event)"
                  style="width: 100%; box-sizing: border-box; background: transparent; border: none; color: #ffffff; font-size: 15.5px; line-height: 1.5; resize: none; outline: none; min-height: 56px; max-height: 240px; font-family: inherit;"></textarea>
              </div>

              <button 
                type="submit" 
                id="tutor-fs-btn-enviar" 
                style="background: linear-gradient(135deg, #002B5E, #0284c7); color: white; border: none; padding: 0 24px; min-height: 70px; border-radius: 14px; font-weight: 800; font-size: 15px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 16px rgba(2,132,199,0.3); transition: all 0.2s; flex-shrink: 0;"
                onmouseover="this.style.boxShadow='0 4px 22px rgba(2,132,199,0.5)'"
                onmouseout="this.style.boxShadow='0 4px 16px rgba(2,132,199,0.3)'">
                <span>Enviar</span>
                <span style="font-size: 18px;">➔</span>
              </button>
            </form>

          </div>
        </div>

      </main>
    `;

    const scrollEl = document.getElementById('tutor-fs-messages');
    if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
  }

  // ==========================================================================
  // PESTANYA 1: XAT AMB EL TUTOR IA
  // ==========================================================================
  const PRESET_TOPICS = [
    {
      id: 'preset_lecrim495',
      titol: 'Art. 495 LECrim',
      badge: 'LLEIS',
      tagColor: '#0369a1',
      tagBg: '#e0f2fe',
      pregunta: 'Quins requisits exigeix l\'Art. 495 de la LECrim per detenir excepcionalment per un delicte lleu?'
    },
    {
      id: 'preset_alcoholemia',
      titol: 'Alcoholemia RGC',
      badge: 'TRÀNSIT',
      tagColor: '#92400e',
      tagBg: '#fef3c7',
      pregunta: 'Quines són les taxes reglamentàries d\'alcoholèmia al RGC i quan és delicte de l\'art. 379.2 o negativa de l\'art. 383 CP?'
    },
    {
      id: 'preset_furt_robatori',
      titol: 'Furt vs Robatori',
      badge: 'PENAL',
      tagColor: '#166534',
      tagBg: '#f0fdf4',
      pregunta: 'Quines diferències hi ha entre el delicte de furt (Art. 234 CP) i el robatori amb força en les coses (Art. 237-238 CP)?'
    }
  ];

  function generarRespostaEstructuradaAgentMedina(pregunta, cos, ambit, docContext) {
    const q = (pregunta || '').toLowerCase();
    const cosNom = cos === 'pl' ? 'Policia Local' : cos === 'mossos' ? "Mossos d'Esquadra" : 'PL / Mossos';

    if (q.includes('495') || (q.includes('delicte') && q.includes('lleu')) || (q.includes('detencio') && q.includes('falta'))) {
      return `**Regla general:** Per delictes lleus no s'ha de detenir, *excepte* si el presumpte autor no té domicili conegut o no presta fiança bastant (Art. 495 LECrim).

📄 **Procediment d'actuació:**
1. **Identificació completa** de la persona al lloc dels fets.
2. **Comprovació de domicili conegut** i arrelament demostrable a l'Estat.
3. **En cas d'acreditar domicili:** citació formal per a judici immediat de delictes lleus (Art. 962 LECrim). Mai detenció.
4. **En cas de NO tenir domicili conegut ni prestar fiança bastant:** detenció tècnica segons Art. 495 LECrim i trasllat a comissaria per a la instrucció de diligències i posada a disposició judicial.

💡 **Clau d'oposició:**
La reiteració delictiva o la constància d'antecedents policials **NO habiliten** per si sols la detenció si el sospitós té domicili conegut. Detenir-lo suposaria una vulneració de l'Art. 17 CE i Art. 495 LECrim.`;
    }

    if (q.includes('alcohol') || q.includes('drog') || q.includes('taxa') || q.includes('383') || q.includes('379')) {
      return `**Regla general:** Conduir sota la influència de begudes alcohòliques o substàncies és infracció administrativa molt greu (RGC) o delicte contra la seguretat viària (Art. 379.2 CP). La negativa és delicte autònom de desobediència greu (Art. 383 CP).

📄 **Procediment d'actuació i taxes:**
1. **Taxa general / ciclistes / VMP:** 0,25 mg/l en aire expirat (0,50 g/l en sang).
2. **Novells (fins a 2 anys de permís) i professionals:** 0,15 mg/l (0,30 g/l en sang). Menors d'edat: taxa 0,0 absoluta.
3. **Límit penal directe (Art. 379.2 CP):** Superar 0,60 mg/l en aire (o 1,2 g/l en sang) és delicte penal directe, independentment de símptomes.
4. **Negativa a fer les proves (Art. 383 CP):** Pena de presó de 6 mesos a 1 any i retirada del permís d'1 a 4 anys.

💡 **Clau d'oposició:**
Si el conductor es nega després del requeriment formal i advertiment exprés de les conseqüències penals, s'instruiran diligències per l'Art. 383 CP i, si té símptomes evidents, en concurs real amb l'Art. 379.2 CP.`;
    }

    if (q.includes('furt') || q.includes('robatori') || q.includes('234') || q.includes('237') || q.includes('238')) {
      return `**Regla general:** El furt (Art. 234 CP) consisteix en l'apropiació de cosa moble aliena sense violència ni força. El robatori (Art. 237 CP) exigeix l'ús de força en les coses per accedir/abandonar o violència/intimidació en les persones.

📄 **Procediment d'actuació:**
1. **Les 5 circumstàncies taxades de força (Art. 238 CP):**
   • Escalament (superació de desnivell rellevant o entrada per lloc no destinat).
   • Ruptura de paret, sostre o terra, o fractura de porta o finestra.
   • Fractura d'armaris, arques o mobles tancats (o dels seus panys).
   • Ús de claus falses (rossinyols, claus robades a l'amo, targetes mestres).
   • Inutilització de sistemes d'alarma o guarda.
2. **Límit econòmic:** 400 € només determina si el furt és lleu (<400 €) o menys greu (>400 €).

💡 **Clau d'oposició:**
El robatori amb força o amb violència **MAI és delicte lleu**, encara que l'objecte sostret valgui només 1 euro.`;
    }

    if (q.includes('identificacio') || q.includes('16') || q.includes('4/2015') || q.includes('seguretat ciutadana')) {
      return `**Regla general:** La identificació a la via pública es regeix per l'Art. 16 de la LO 4/2015. Exigeix indicis racionals d'infracció o necessitat preventiva de seguretat ciutadana.

📄 **Procediment d'actuació:**
1. **Requeriment al carrer:** Mostrar placa/identificació policial i sol·licitar document d'identitat.
2. **Trasllat a dependències:** Únicament quan no sigui possible acreditar la identitat per cap mitjà (inclosos telemàtics) o la persona es negui.
3. **Termini màxim:** El temps strictly necessari, amb límit infranquejable de **6 hores**.
4. **Garanties:** Registre al Llibre d'Identificacions i expedició de volant acreditatiu si ho demana.

💡 **Clau d'oposició:**
El trasllat a comissaria per identificació **NO és una detenció penal**. No s'informa dels drets de l'Art. 520 LECrim com a detingut sinó del procediment identificatiu de seguretat ciutadana.`;
    }

    return `**Regla general:** Actuació segons el marc jurídic de ${cosNom} d'acord amb la Constitució Espanyola (Arts. 9.3, 14, 17, 104) i Llei Orgànica 2/1986.

📄 **Procediment d'actuació:**
1. **Tipicitat:** Valoració de si la conducta de "${escapeHtml(pregunta.trim())}" és infracció penal, administrativa (LO 4/2015 o RGC) o ordenança municipal.
2. **Principis d'intervenció:** Congruència, oportunitat i proporcionalitat permanent en la resposta policial.
3. **Diligències:** Confecció de l'acta de denúncia o atestat policial amb recollida objectiva d'indicis.

💡 **Clau d'oposició:**
Verifica sempre la competència sancionadora: Alcaldia per ordenances i trànsit urbà (PL), o Departament d'Interior per àmbit autonòmic (Mossos d'Esquadra).`;
  }

  function renderitzarInterficieXatTelegram(container) {
    container.innerHTML = `
      <div class="tutor-app-wrapper" id="tutor-app-wrapper">

        <!-- 1. CAPÇALERA ULTRA COMPACTA (<40px D'ALT) -->
        <div class="tutor-compact-topbar">
          <div class="tutor-topbar-left">
            <button type="button" class="tutor-btn-drawer-toggle" onclick="window.toggleTutorDrawer(true)" title="Obrir historial de consultes i temaris">
              ☰
            </button>
            <span class="tutor-topbar-title">
              <span>🚓</span>
              <span>Medina</span>
            </span>
            <span class="tutor-badge-cos" id="tutor-header-badge">
              <span style="color:#0284c7; font-size:12px; margin-right:2px;">•</span>${cosActiu === 'pl' ? 'PL' : cosActiu === 'mossos' ? 'Mossos' : 'Ambdós'}
            </span>
            <span id="tutor-header-ambit-badge" onclick="window.toggleTutorFiltres(true)" style="cursor:pointer; background:rgba(2,132,199,0.18); border:1px solid rgba(2,132,199,0.35); color:#38bdf8; font-size:11px; font-weight:700; padding:2px 8px; border-radius:6px; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:inline-flex; align-items:center; gap:4px;" title="Clica per canviar d'àmbit o tema">
              ${obtenirEtiquetaAmbitResum()}
            </span>
          </div>

          <div style="display: flex; align-items: center; gap: 6px;">
            <button type="button" id="tutor-btn-filtres" class="tutor-topbar-btn ${panellFiltresObert ? 'active' : ''}" onclick="window.toggleTutorFiltres()" title="Filtres de cos i àmbit normatiu">
              <span>⚙️ Filtres</span>
              <span style="font-size: 10px; opacity: 0.85;">${panellFiltresObert ? '▲' : '▼'}</span>
            </button>
            <button type="button" class="tutor-topbar-icon-btn" onclick="window.netejarXatActual()" title="Netejar la conversa actual">
              🗑️
            </button>
            <button type="button" id="tutor-btn-fullscreen" class="tutor-topbar-icon-btn" onclick="window.alternarPantallaCompletaTutor()" title="${modePantallaCompletaXat ? 'Sortir de pantalla completa (Esc)' : 'Pantalla completa'}">
              ${modePantallaCompletaXat ? '🗗' : '⛶'}
            </button>
          </div>
        </div>

        <!-- 2. PANELL DESPLEGABLE SUPERIOR DE FILTRES -->
        <div class="tutor-filter-panel ${panellFiltresObert ? 'open' : ''}" id="tutor-filter-panel">
          <div class="tutor-filter-row" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
            <!-- Selector de Cos -->
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 11px; font-weight: 700; color: #94a3b8;">Cos:</span>
              <div class="tutor-filter-cos-group">
                <button type="button" id="tutor-cos-btn-pl" class="tutor-cos-tab-btn ${cosActiu === 'pl' ? 'active' : ''}" onclick="window.canviarCosFiltre('pl')">
                  🚔 PL
                </button>
                <button type="button" id="tutor-cos-btn-mossos" class="tutor-cos-tab-btn ${cosActiu === 'mossos' ? 'active' : ''}" onclick="window.canviarCosFiltre('mossos')">
                  👮 Mossos
                </button>
                <button type="button" id="tutor-cos-btn-tots" class="tutor-cos-tab-btn ${cosActiu === 'tots' ? 'active' : ''}" onclick="window.canviarCosFiltre('tots')">
                  ⚖️ Ambdós
                </button>
              </div>
            </div>

            <!-- Desplegable d'Àmbit Normatiu -->
            <div style="display: flex; align-items: center; gap: 6px; flex: 1; min-width: 240px;">
              <span style="font-size: 11px; font-weight: 700; color: #94a3b8; white-space: nowrap;">Àmbit:</span>
              <select class="tutor-ambit-select" id="tutor-ambit-select" onchange="window.canviarAmbitFiltre(this.value)" style="flex: 1; width: 100%; max-width: 100%;">
                ${generarOpcionsAmbitSelect(cosActiu, documentActiuId, ambitNormatiuActiu)}
              </select>
            </div>
          </div>
        </div>

        <!-- PÍNDOLA CENTRAL D'AVÍS D'HISTORIAL I CONTEXT -->
        <div class="tutor-history-hint" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px;">
          <span>💡 Fes clic a ☰ a dalt per veure el teu historial de consultes</span>
          <span style="display: inline-flex; align-items: center; gap: 5px; cursor: pointer;" onclick="window.toggleTutorFiltres(true)" title="Fes clic per canviar d'àmbit o tema">
            <span style="opacity: 0.75;">🎯 Àmbit actiu:</span>
            <strong id="tutor-hint-ambit-nom" style="color: #38bdf8;">${obtenirEtiquetaAmbitResum()}</strong>
            <span style="font-size: 10px; opacity: 0.8;">⚙️</span>
          </span>
        </div>

        <!-- 3. ÀREA DE MISSATGES (>80% D'ALÇADA ÚTIL, SENSE SCROLL GENERAL) -->
        <div id="tutor-chat-messages" class="tutor-stream-messages">
          ${historialXat.length === 0 ? renderitzarBenvingudaTelegram() : ''}
          ${historialXat.map(renderitzarMissatgeTelegram).join('')}
        </div>

        <!-- 4. BARRA INFERIOR ESTIL TELEGRAM -->
        <div class="tutor-telegram-bar">
          <!-- Línia horitzontal de prompt chips desplegable amb 💡 -->
          <div class="tutor-chips-row ${suggerimentsOberts ? 'open' : ''}" id="tutor-chips-row">
            <button type="button" class="tutor-prompt-chip" onclick="window.generar3PreguntesTestTemaActiu()" style="border:1.5px solid #f59e0b; background:rgba(245,158,11,0.22); color:#fde047; font-weight:800; display:inline-flex; align-items:center; gap:5px;">
              <span>🎯</span> <span>Test 3 preguntes del Tema Actiu</span>
            </button>
            <button type="button" class="tutor-prompt-chip" onclick="window.enviarPromptRapid('Quins requisits exigeix l\\'Art. 495 de la LECrim per detenir excepcionalment per un delicte lleu?')">
              ⚖️ Art. 495 LECrim: Detenció lleus
            </button>
            <button type="button" class="tutor-prompt-chip" onclick="window.enviarPromptRapid('Quines són les taxes reglamentàries d\\'alcoholèmia al RGC i quan és delicte de l\\'art. 379.2 o negativa de l\\'art. 383 CP?')">
              🍺 Alcoholèmia RGC i Taxes
            </button>
            <button type="button" class="tutor-prompt-chip" onclick="window.enviarPromptRapid('Quines són les diferències exactes entre el furt i el robatori amb força segons el Codi Penal?')">
              🔒 Furt vs Robatori amb força (Art. 237 CP)
            </button>
            <button type="button" class="tutor-prompt-chip" onclick="window.enviarPromptRapid('Quan pot una patrulla identificar persones a la via pública segons l\\'Art. 16 de la LO 4/2015?')">
              🆔 Identificació al carrer (Art. 16 LO 4/2015)
            </button>
            <button type="button" class="tutor-prompt-chip" onclick="window.enviarPromptRapid('Planteja\\'m un supòsit pràctic policial breu amb preguntes tipus test i solució jurídica.')">
              📝 Supòsit pràctic d'examen
            </button>
          </div>

          <!-- Píndola d'input telegram -->
          <div class="tutor-input-pill-container">
            <button type="button" id="tutor-btn-bulb" class="tutor-btn-bulb ${suggerimentsOberts ? 'active' : ''}" onclick="window.toggleTutorSuggeriments()" title="Obrir/amagar suggeriments ràpids">
              💡
            </button>
            <textarea 
              id="tutor-input-msg" 
              class="tutor-telegram-textarea" 
              placeholder="Escriu la teva consulta..." 
              rows="1" 
              oninput="window.handleTelegramInputResize(this)" 
              onkeydown="window.handleTelegramInputKeyDown(event)"></textarea>
            <button type="button" id="tutor-btn-enviar" class="tutor-btn-telegram-send" onclick="window.enviarMissatgeTelegram()" title="Enviar">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                <path d="m12 3 9 9-9 9-9-9 9-9Z"/>
                <path d="m8 12 4-4 4 4"/>
                <path d="M12 8v8"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- 5. BARRA LATERAL (DRAWER DESPLEGABLE) -->
        <div class="tutor-drawer-overlay ${drawerObert ? 'open' : ''}" id="tutor-drawer-overlay" onclick="window.toggleTutorDrawer(false)"></div>
        <div class="tutor-drawer ${drawerObert ? 'open' : ''}" id="tutor-drawer">
          <div class="tutor-drawer-header">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:16px;">🧠</span>
              <span style="font-weight:800;font-size:13.5px;">Tutor IA Agent Medina</span>
            </div>
            <button type="button" onclick="window.toggleTutorDrawer(false)" style="background:none;border:none;color:#ffffff;font-size:18px;cursor:pointer;padding:2px 6px;line-height:1;">✕</button>
          </div>

          <div class="tutor-drawer-content">
            <!-- Botó ➕ Nova Consulta -->
            <button type="button" onclick="window.crearNovaConsultaDrawer()" style="width:100%;background:#0084ff;color:#ffffff;border:none;padding:10px 14px;border-radius:10px;font-size:13px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 2px 8px rgba(0,132,255,0.3);">
              <span>➕</span> <span>Nova Consulta</span>
            </button>

            <!-- Historial de xats recents -->
            <div>
              <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.05em;color:#94a3b8;margin-bottom:8px;padding-left:4px;">
                💬 Historial de Consultes
              </div>

              <!-- Consultes Clau Predefinides -->
              <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:12px;">
                <div style="font-size:10.5px;font-weight:700;color:#38bdf8;padding-left:4px;">TEMES DESTACATS D'ESTUDI:</div>
                ${PRESET_TOPICS.map(p => `
                  <button type="button" onclick="window.carregarSessioOPredefinit('${p.id}')" style="width:100%;text-align:left;background:#0d1829;border:1px solid #1e293b;border-radius:8px;padding:8px 10px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:6px;">
                    <span style="font-size:12px;font-weight:700;color:#f1f5f9;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p.titol}</span>
                    <span style="font-size:9.5px;background:${p.tagBg};color:${p.tagColor};padding:1px 5px;border-radius:4px;font-weight:800;">${p.badge}</span>
                  </button>
                `).join('')}
              </div>

              <!-- Llista de sessions de l'usuari -->
              <div id="tutor-drawer-sessions-list" style="display:flex;flex-direction:column;gap:5px;max-height:200px;overflow-y:auto;">
                ${sessionsCache.map(s => `
                  <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;padding:6px 8px;border-radius:8px;background:${s.id === sessioActivaId ? 'rgba(0,132,255,0.15)' : 'transparent'};border:1px solid ${s.id === sessioActivaId ? '#0084ff' : 'transparent'};cursor:pointer;" onclick="window.carregarSessioOPredefinit('${s.id}')">
                    <span style="font-size:12px;font-weight:600;color:#f1f5f9;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">
                      💬 ${escapeHtml(s.titol || 'Consulta')}
                    </span>
                    <button 
                      type="button" 
                      onclick="event.stopPropagation(); window.eliminarSessioDrawer('${s.id}', event);" 
                      style="background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.25);color:#fca5a5;cursor:pointer;font-size:12px;font-weight:bold;padding:2px 7px;border-radius:6px;line-height:1.2;display:flex;align-items:center;justify-content:center;transition:all 0.15s;" 
                      onmouseover="this.style.background='rgba(239,68,68,0.3)'; this.style.color='#ffffff'" 
                      onmouseout="this.style.background='rgba(239,68,68,0.12)'; this.style.color='#fca5a5'" 
                      title="Eliminar consulta">✕</button>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Acoblaments a Temaris i Eines -->
            <div style="border-top:1px solid #1e293b;padding-top:10px;">
              <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.05em;color:#94a3b8;margin-bottom:8px;padding-left:4px;">
                📚 Acoblaments a Temaris
              </div>
              <div style="display:flex;flex-direction:column;gap:6px;">
                <button type="button" onclick="window.activarGuiaMossosDesDeDrawer();" style="width:100%;text-align:left;background:linear-gradient(135deg,rgba(0,43,94,0.45),rgba(2,132,199,0.25));border:1.5px solid #0284c7;border-radius:8px;padding:8px 10px;font-size:12px;font-weight:700;color:#38bdf8;cursor:pointer;display:flex;align-items:center;justify-content:space-between;">
                  <span>📕 Guia Oficial Mossos 2026</span>
                  <span style="font-size:10px;background:#0284c7;color:#fff;padding:2px 7px;border-radius:10px;font-weight:800;">20 Temes</span>
                </button>
                <button type="button" onclick="window.canviarPestanyaTutor('examens'); window.toggleTutorDrawer(false);" style="width:100%;text-align:left;background:transparent;border:1px solid #1e293b;border-radius:8px;padding:8px 10px;font-size:12px;font-weight:700;color:#f1f5f9;cursor:pointer;display:flex;align-items:center;justify-content:space-between;">
                  <span>🏛️ Exàmens Oficials PDF</span>
                  <span style="font-size:10.5px;color:#94a3b8;font-weight:700;">${examensCache.length}</span>
                </button>
                <button type="button" onclick="window.canviarPestanyaTutor('temes_annexos'); window.toggleTutorDrawer(false);" style="width:100%;text-align:left;background:transparent;border:1px solid #1e293b;border-radius:8px;padding:8px 10px;font-size:12px;font-weight:700;color:#f1f5f9;cursor:pointer;display:flex;align-items:center;justify-content:space-between;">
                  <span>📑 Temes Annexos</span>
                  <span style="font-size:10.5px;color:#94a3b8;font-weight:700;">${temesAnnexosCache.length}</span>
                </button>
                <button type="button" onclick="window.canviarPestanyaTutor('ordenances'); window.toggleTutorDrawer(false);" style="width:100%;text-align:left;background:transparent;border:1px solid #1e293b;border-radius:8px;padding:8px 10px;font-size:12px;font-weight:700;color:#f1f5f9;cursor:pointer;display:flex;align-items:center;justify-content:space-between;">
                  <span>📂 Gestor d'Ordenances</span>
                  <span style="font-size:10.5px;color:#94a3b8;font-weight:700;">${documentsCache.length}</span>
                </button>
                <button type="button" onclick="window.canviarPestanyaTutor('generador'); window.toggleTutorDrawer(false);" style="width:100%;text-align:left;background:transparent;border:1px solid #1e293b;border-radius:8px;padding:8px 10px;font-size:12px;font-weight:700;color:#f1f5f9;cursor:pointer;display:flex;align-items:center;justify-content:space-between;">
                  <span>⚡ Generador de Tests</span>
                  <span style="font-size:10.5px;color:#38bdf8;font-weight:800;">IA</span>
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    `;

    // Scroll automàtic al final
    const scrollEl = document.getElementById('tutor-chat-messages');
    if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
  }

  function renderitzarBenvingudaTelegram() {
    return `
      <div style="display:flex; gap:10px; align-items:flex-start; max-width:88%; margin-bottom:6px;">
        <div style="width:34px; height:34px; border-radius:50%; background:#0084ff; color:#ffffff; display:flex; align-items:center; justify-content:center; font-size:12.5px; font-weight:900; flex-shrink:0; box-shadow:0 2px 8px rgba(0,132,255,0.4); margin-top:2px;">
          AM
        </div>
        <div style="background:#111e32; border:1.5px solid #1c314e; border-radius:18px; padding:14px 16px; color:#f1f5f9; box-shadow:0 4px 14px rgba(0,0,0,0.3); flex:1;">
          <h4 style="margin:0 0 6px 0; color:#38bdf8; font-size:15px; font-weight:800;">Hola! Sóc l'Agent Medina 🚓</h4>
          <p style="margin:0 0 14px 0; color:#cbd5e1; font-size:13.5px; line-height:1.5;">
            Pregunta qualsevol dubte jurídic sobre CP, LECrim, Llei 16/1991, Llei 4/2015 o RGC.
          </p>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button type="button" onclick="window.generar3PreguntesTestTemaActiu()" style="border:1.5px solid #f59e0b; background:rgba(245,158,11,0.22); color:#fde047; padding:5px 12px; border-radius:6px; font-size:11.5px; font-weight:800; cursor:pointer; display:flex; align-items:center; gap:5px;">
              <span>🎯</span> <span>Test 3 preguntes</span>
            </button>
            <button type="button" onclick="window.enviarPromptRapid('Quins requisits exigeix l\\'Art. 495 de la LECrim per detenir per delicte lleu?')" style="border:1px solid #0284c7; background:rgba(2,132,199,0.18); color:#38bdf8; padding:5px 11px; border-radius:6px; font-size:11.5px; font-weight:700; cursor:pointer;">
              ✓ Articles vigents
            </button>
            <button type="button" onclick="window.enviarPromptRapid('Dona\\'m les millors regles mnemotècniques per recordar els articles clau del Codi Penal i RGC.')" style="border:1px solid #d97706; background:rgba(217,119,6,0.18); color:#f59e0b; padding:5px 11px; border-radius:6px; font-size:11.5px; font-weight:700; cursor:pointer;">
              ✓ Mnemotècnies
            </button>
            <button type="button" onclick="window.enviarPromptRapid('Planteja\\'m un cas pràctic real de patrulla sobre furt o robatori amb preguntes d\\'examen.')" style="border:1px solid #16a34a; background:rgba(22,163,74,0.18); color:#4ade80; padding:5px 11px; border-radius:6px; font-size:11.5px; font-weight:700; cursor:pointer;">
              ✓ Casos pràctics
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function renderitzarMissatgeTelegram(msg) {
    const esUsuari = msg.role === 'user';
    if (esUsuari) {
      return `
        <div style="display:flex; justify-content:flex-end; margin-bottom:8px;">
          <div style="max-width:82%; background:#0084ff; color:#ffffff; border-radius:18px 18px 4px 18px; padding:12px 18px; font-size:13.5px; font-weight:500; line-height:1.48; box-shadow:0 3px 12px rgba(0,132,255,0.3); word-break:break-word;">
            <div style="white-space:pre-line;">${escapeHtml(msg.text)}</div>
            <div style="font-size:10px; opacity:0.75; text-align:right; margin-top:4px;">${msg.hora || ''}</div>
          </div>
        </div>
      `;
    }

    // Missatge del Tutor (Agent Medina)
    const contextText = msg.contextDoc || (cosActiu === 'pl' ? 'PL' : cosActiu === 'mossos' ? 'Mossos' : 'PL / Mossos');
    return `
      <div style="display:flex; gap:10px; align-items:flex-start; max-width:92%; margin-bottom:8px;">
        <div style="width:34px; height:34px; border-radius:50%; background:#0084ff; color:#ffffff; display:flex; align-items:center; justify-content:center; font-size:12.5px; font-weight:900; flex-shrink:0; box-shadow:0 2px 8px rgba(0,132,255,0.4); margin-top:2px;">
          AM
        </div>

        <div style="background:#111e32; border:1.5px solid #1c314e; border-radius:18px; padding:14px 16px; color:#f1f5f9; box-shadow:0 4px 14px rgba(0,0,0,0.3); flex:1; font-size:13.5px; line-height:1.55; word-break:break-word;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; padding-bottom:6px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:13px; font-weight:800; color:#38bdf8;">
            <span style="display:flex; align-items:center; gap:6px;">
              <span>⚖️</span> <span>Anàlisi Jurídica</span>
            </span>
            <span style="font-size:11px; font-weight:500; color:#94a3b8;">Context: ${escapeHtml(contextText)}</span>
          </div>

          <div style="white-space:pre-line;">${formatejarTextResposta(msg.text)}</div>

          <div style="display:flex; align-items:center; justify-content:flex-end; gap:8px; margin-top:8px; padding-top:4px; border-top:1px solid rgba(255,255,255,0.04);">
            <button type="button" data-text="${encodeURIComponent(msg.text || '')}" onclick="window.copiarTextRespostaTutor(this)" style="background:none; border:none; color:#94a3b8; font-size:10.5px; cursor:pointer; padding:2px 4px; display:flex; align-items:center; gap:3px;" title="Copiar resposta">
              📋 <span>Copiar</span>
            </button>
            <span style="font-size:10px; color:#64748b;">${msg.hora || ''}</span>
          </div>
        </div>
      </div>
    `;
  }

  function renderitzarBenvingudaXat(docActiu) {
    return renderitzarBenvingudaTelegram();
  }

  function renderitzarMissatgeXat(msg) {
    return renderitzarMissatgeTelegram(msg);
  }

  function formatejarTextResposta(text) {
    if (!text) return '';
    let html = escapeHtml(text);
    
    // Regla general en color ambre
    html = html.replace(/\*\*Regla general:\*\*/g, '<span style="color:#f59e0b; font-weight:800;">Regla general:</span>');
    html = html.replace(/Regla general:/g, '<span style="color:#f59e0b; font-weight:800;">Regla general:</span>');

    // Negreta estàndard
    html = html.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    html = html.replace(/\*(.*?)\*/g, '<i>$1</i>');

    // Estilització de Procediment d'actuació com a sub-card fosca
    if (html.includes('📄 <b>Procediment d\'actuació:</b>') || html.includes('📄 Procediment d\'actuació:')) {
      html = html.replace(
        /(📄 (?:<b>)?Procediment d'actuació:(?:<\/b>)?[\s\S]*?)(?=(?:💡 (?:<b>)?Clau d'oposició:|$))/i,
        '<div style="background:#091321; border:1px solid #162942; border-radius:10px; padding:10px 14px; margin:10px 0;">$1</div>'
      );
    }

    // Estilització de Clau d'oposició o Aplicació pràctica
    if (html.includes('💡 <b>Clau d\'oposició:</b>') || html.includes('💡 Clau d\'oposició:') || html.includes('💡 <b>APLICACIÓ PRÀCTICA')) {
      html = html.replace(
        /(💡 (?:<b>)?(?:Clau d'oposició|APLICACIÓ PRÀCTICA[^<]*):(?:<\/b>)?[\s\S]*?)$/i,
        '<div style="background:rgba(245,158,11,0.06); border:1px solid rgba(245,158,11,0.25); border-radius:10px; padding:10px 14px; margin-top:10px; color:#fde68a;">$1</div>'
      );
    }

    // Estilització de Citació literal de la Guia de Mossos
    if (html.includes('📘') && (html.includes('Guia') || html.includes('Citat de la Guia'))) {
      html = html.replace(
        /(📘\s*(?:<b>)?(?:Citat de la Guia|Font oficial)[^<]*(?:<\/b>)?[\s\S]*?)(?=(?:⚠️|📄|💡|<b>\d+\.|$))/i,
        '<div style="background:rgba(2,132,199,0.12); border-left:4px solid #0284c7; border-radius:0 8px 8px 0; padding:10px 14px; margin:10px 0; color:#e0f2fe;">$1</div>'
      );
    }

    // Estilització de Clau de Test pel Tribunal
    if (html.includes('⚠️') && html.includes('Clau de Test')) {
      html = html.replace(
        /(⚠️\s*(?:<b>)?Clau de Test pel Tribunal(?:<\/b>)?[:\s]*[\s\S]*?)$/i,
        '<div style="background:rgba(239,68,68,0.1); border:1.5px solid rgba(239,68,68,0.3); border-radius:10px; padding:10px 14px; margin-top:12px; color:#fca5a5;">$1</div>'
      );
    }

    return html;
  }

  // Window handlers per al nou disseny Telegram / Drawer / Filtres
  window.toggleTutorDrawer = function (obrir) {
    drawerObert = (typeof obrir === 'boolean') ? obrir : !drawerObert;
    const overlay = document.getElementById('tutor-drawer-overlay');
    const drawer = document.getElementById('tutor-drawer');
    if (overlay && drawer) {
      if (drawerObert) {
        overlay.classList.add('open');
        drawer.classList.add('open');
      } else {
        overlay.classList.remove('open');
        drawer.classList.remove('open');
      }
    } else {
      renderitzarSubvista();
    }
  };

  window.toggleTutorFiltres = function (forcarObrir) {
    if (typeof forcarObrir === 'boolean') {
      panellFiltresObert = forcarObrir;
    } else {
      panellFiltresObert = !panellFiltresObert;
    }
    const panel = document.getElementById('tutor-filter-panel');
    const btn = document.getElementById('tutor-btn-filtres');
    if (panel) {
      if (panellFiltresObert) {
        panel.classList.add('open');
        if (btn) btn.classList.add('active');
        const sel = document.getElementById('tutor-ambit-select');
        if (sel) sel.focus();
      } else {
        panel.classList.remove('open');
        if (btn) btn.classList.remove('active');
      }
    } else {
      renderitzarSubvista();
    }
  };

  window.actualitzarEstatFiltresUI = function () {
    const badge = document.getElementById('tutor-header-badge');
    if (badge) {
      badge.innerHTML = `<span style="color:#0284c7; font-size:12px; margin-right:2px;">•</span>${cosActiu === 'pl' ? 'PL' : cosActiu === 'mossos' ? 'Mossos' : 'Ambdós'}`;
    }

    const ambitBadge = document.getElementById('tutor-header-ambit-badge');
    if (ambitBadge) {
      ambitBadge.textContent = obtenirEtiquetaAmbitResum();
    }

    const hintAmbit = document.getElementById('tutor-hint-ambit-nom');
    if (hintAmbit) {
      hintAmbit.textContent = obtenirEtiquetaAmbitResum();
    }

    ['pl', 'mossos', 'tots'].forEach(c => {
      const btn = document.getElementById(`tutor-cos-btn-${c}`);
      if (btn) {
        if (c === cosActiu) btn.classList.add('active');
        else btn.classList.remove('active');
      }
    });

    const selAmbit = document.getElementById('tutor-ambit-select');
    if (selAmbit) {
      selAmbit.innerHTML = generarOpcionsAmbitSelect(cosActiu, documentActiuId, ambitNormatiuActiu);
      if (documentActiuId === 'guia_auto') selAmbit.value = 'guia_auto';
      else if (documentActiuId && documentActiuId.startsWith('guia:')) selAmbit.value = documentActiuId;
      else if (documentActiuId) selAmbit.value = `doc:${documentActiuId}`;
      else selAmbit.value = ambitNormatiuActiu || 'general';
    }

    const fsSel = document.getElementById('tutor-fs-sel-doc');
    if (fsSel) {
      fsSel.innerHTML = generarOpcionsAmbitSelect(cosActiu, documentActiuId, ambitNormatiuActiu);
      if (documentActiuId === 'guia_auto') fsSel.value = 'guia_auto';
      else if (documentActiuId && documentActiuId.startsWith('guia:')) fsSel.value = documentActiuId;
      else if (documentActiuId) fsSel.value = `doc:${documentActiuId}`;
      else fsSel.value = ambitNormatiuActiu || 'general';
    }
  };

  window.canviarCosFiltre = function (cos) {
    cosActiu = cos;
    if (cos === 'mossos' && (!documentActiuId || !documentActiuId.startsWith('guia'))) {
      documentActiuId = 'guia_auto';
      ambitNormatiuActiu = 'guia_mossos';
    } else if (cos === 'pl' && documentActiuId && documentActiuId.startsWith('guia')) {
      documentActiuId = '';
      ambitNormatiuActiu = 'general';
    }

    // Actualitzar sessió activa
    const s = sessionsCache.find(x => x.id === sessioActivaId);
    if (s) {
      s.cos = cosActiu;
      s.contextDocId = documentActiuId;
      guardarSessions();
    }

    actualitzarEstatFiltresUI();
  };

  window.canviarAmbitFiltre = function (val) {
    if (!val || val === 'general') {
      ambitNormatiuActiu = 'general';
      documentActiuId = '';
    } else if (val === 'transit') {
      ambitNormatiuActiu = 'transit';
      documentActiuId = '';
    } else if (val === 'ordenances') {
      ambitNormatiuActiu = 'ordenances';
      documentActiuId = '';
    } else if (val === 'guia_auto') {
      documentActiuId = 'guia_auto';
      ambitNormatiuActiu = 'guia_mossos';
      cosActiu = 'mossos';
    } else if (typeof val === 'string' && val.startsWith('guia:')) {
      documentActiuId = val;
      ambitNormatiuActiu = 'guia_mossos';
      cosActiu = 'mossos';
    } else if (typeof val === 'string' && val.startsWith('doc:')) {
      documentActiuId = val.replace('doc:', '');
      ambitNormatiuActiu = 'ordenances';
    } else if (documentsCache.some(d => d.id === val)) {
      documentActiuId = val;
      ambitNormatiuActiu = 'ordenances';
    } else {
      ambitNormatiuActiu = val;
      documentActiuId = '';
    }

    const s = sessionsCache.find(x => x.id === sessioActivaId);
    if (s) {
      s.contextDocId = documentActiuId;
      s.cos = cosActiu;
      guardarSessions();
    }

    actualitzarEstatFiltresUI();
  };

  window.canviarCosTutor = function (cos) {
    window.canviarCosFiltre(cos);
    if (modePantallaCompletaXat) {
      renderitzarPantallaCompletaModal();
    }
  };

  window.canviarDocumentActiu = function (val) {
    window.canviarAmbitFiltre(val);
    if (modePantallaCompletaXat) {
      renderitzarPantallaCompletaModal();
    }
  };

  window.activarGuiaMossosDesDeDrawer = function () {
    window.canviarCosFiltre('mossos');
    window.canviarAmbitFiltre('guia_auto');
    window.toggleTutorDrawer(false);
  };

  window.netejarXatActual = function () {
    if (confirm('Vols netejar els missatges de la conversa actual?')) {
      historialXat = [];
      const s = sessionsCache.find(x => x.id === sessioActivaId);
      if (s) {
        s.missatges = [];
        s.titol = 'Nova consulta';
        guardarSessions();
      }
      renderitzarSubvista();
    }
  };

  window.toggleTutorSuggeriments = function () {
    suggerimentsOberts = !suggerimentsOberts;
    const row = document.getElementById('tutor-chips-row');
    const btn = document.getElementById('tutor-btn-bulb');
    if (row) {
      if (suggerimentsOberts) {
        row.classList.add('open');
        if (btn) btn.classList.add('active');
      } else {
        row.classList.remove('open');
        if (btn) btn.classList.remove('active');
      }
    }
  };

  window.enviarPromptRapid = function (text) {
    const inputFs = document.getElementById('tutor-fs-input-msg');
    const inputStd = document.getElementById('tutor-input-msg');
    const input = (modePantallaCompletaXat && inputFs) ? inputFs : (inputStd || inputFs);
    if (input) {
      input.value = text;
      window.enviarMissatgeTutor();
    }
  };

  window.generar3PreguntesTestTemaActiu = function () {
    const docActiu = obtenirDocActiu();
    let temaNom = '';
    if (typeof documentActiuId === 'string' && documentActiuId.startsWith('guia:')) {
      const idClean = documentActiuId.replace('guia:', '');
      const tGuia = obtenirTemesGuiaMossos().find(t => t.id === idClean || t.id.toLowerCase() === idClean.toLowerCase() || t.id.replace(/^t_/, '').toLowerCase() === idClean.replace(/^t_/, '').toLowerCase());
      temaNom = tGuia ? `${tGuia.codi}: ${tGuia.titol} [Pàg. ${tGuia.pagines}]` : `Tema ${idClean} de la Guia de Mossos 2026`;
    } else if (documentActiuId === 'guia_auto' || (!documentActiuId && cosActiu === 'mossos')) {
      temaNom = "la Guia Oficial d'Estudi de Mossos d'Esquadra (Convocatòria Juny 2026)";
    } else if (docActiu) {
      temaNom = `${docActiu.titol} (${docActiu.municipi || 'General'})`;
    } else {
      temaNom = "el temari oficial policial i marc legal vigent";
    }

    const peticio = `Genera exactament 3 preguntes de test oficials d'alta dificultat sobre ${temaNom}.
Format requerit per a cadascuna:
1. Enunciat de la pregunta (estil examen oficial de Mossos d'Esquadra).
2. 4 opcions (a, b, c, d).
3. Solució correcta justificada amb la referència de pàgina oficial de la Guia [Pàg. X] o article de la llei.
4. Parany / trampa habitual que sol posar el tribunal.`;

    window.enviarPromptRapid(peticio);
  };

  window.handleTelegramInputResize = function (el) {
    if (!el) return;
    el.style.height = '38px';
    const novaAlcada = Math.min(el.scrollHeight, 120);
    el.style.height = novaAlcada + 'px';
  };

  window.handleTelegramInputKeyDown = function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      window.enviarMissatgeTelegram();
    }
  };

  window.enviarMissatgeTelegram = function () {
    window.enviarMissatgeTutor();
  };

  window.crearNovaConsultaDrawer = function () {
    window.crearNovaConversaTutor();
    window.toggleTutorDrawer(false);
  };

  window.carregarSessioOPredefinit = function (id) {
    const preset = PRESET_TOPICS.find(p => p.id === id);
    if (preset) {
      // Crear o canviar a una sessió amb aquesta pregunta clau
      window.crearNovaConversaTutor();
      window.toggleTutorDrawer(false);
      setTimeout(() => {
        window.enviarPromptRapid(preset.pregunta);
      }, 100);
      return;
    }
    window.canviarSessioTutor(id);
    window.toggleTutorDrawer(false);
  };

  window.eliminarSessioDrawer = function (id, e) {
    window.esborrarSessioTutor(id, e);
  };

  window.handleTutorInputAutoResize = function (el) {
    if (!el) return;
    el.style.height = 'auto';
    const isMobile = window.innerWidth <= 900;
    const minH = isMobile ? 52 : 58;
    const maxH = 220;
    const novaAlcada = Math.max(minH, Math.min(el.scrollHeight, maxH));
    el.style.height = novaAlcada + 'px';

    const btnNetejar = document.getElementById('tutor-btn-netejar-input');
    if (btnNetejar) {
      btnNetejar.style.display = el.value.trim().length > 0 ? 'inline-block' : 'none';
    }
  };

  let esInputAmpliat = false;
  window.toggleAmpliarInput = function () {
    const el = document.getElementById('tutor-input-msg');
    const btn = document.getElementById('tutor-btn-toggle-expand');
    if (!el) return;
    esInputAmpliat = !esInputAmpliat;
    if (esInputAmpliat) {
      el.style.height = '140px';
      if (btn) btn.innerHTML = '🗗 Reduir casella';
    } else {
      el.style.height = 'auto';
      window.handleTutorInputAutoResize(el);
      if (btn) btn.innerHTML = '⛶ Ampliar casella';
    }
  };

  window.buidarInputTutor = function () {
    const el = document.getElementById('tutor-input-msg');
    if (el) {
      el.value = '';
      window.handleTutorInputAutoResize(el);
      el.focus();
    }
  };

  window.handleInputFocus = function (el) {
    if (window.innerWidth <= 950 || window.innerHeight <= 600) {
      setTimeout(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 250);
    }
  };

  window.handleTutorInputKeyDown = function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      window.enviarMissatgeTutor(e);
    }
  };

  window.omplirIEnviarPrompt = function (text) {
    const input = document.getElementById('tutor-input-msg');
    if (input) {
      input.value = text;
      window.enviarMissatgeTutor();
    }
  };

  window.enviarMissatgeTutor = async function (e) {
    if (e && e.preventDefault) e.preventDefault();

    const inputFs = document.getElementById('tutor-fs-input-msg');
    const inputStd = document.getElementById('tutor-input-msg');
    const input = (modePantallaCompletaXat && inputFs) ? inputFs : (inputFs && inputFs.value.trim() ? inputFs : inputStd);
    if (!input) return;
    const missatge = input.value.trim();
    if (!missatge) return;

    const d = new Date();
    const hora = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

    // Assegurar sessió activa
    let sessio = sessionsCache.find(s => s.id === sessioActivaId);
    if (!sessio) {
      sessio = {
        id: sessioActivaId || ('sess_' + Date.now()),
        titol: missatge.slice(0, 32) + (missatge.length > 32 ? '...' : ''),
        dataCreacio: d.toISOString(),
        dataActualitzacio: d.toISOString(),
        cos: cosActiu || 'pl',
        contextDocId: documentActiuId || '',
        missatges: []
      };
      sessionsCache.unshift(sessio);
      sessioActivaId = sessio.id;
    } else {
      // Si la sessió encara té el títol per defecte o està buida, actualitzar títol amb la pregunta
      if (sessio.missatges.length === 0 || (sessio.titol && sessio.titol.startsWith('Nova consulta'))) {
        sessio.titol = missatge.slice(0, 32) + (missatge.length > 32 ? '...' : '');
      }
      sessio.dataActualitzacio = d.toISOString();
    }

    // Afegir missatge d'usuari
    historialXat.push({
      role: 'user',
      text: missatge,
      hora
    });
    sessio.missatges = historialXat;
    guardarSessions();

    input.value = '';
    if (inputFs) {
      inputFs.value = '';
      window.handleTutorInputAutoResize(inputFs);
    }
    if (inputStd) {
      inputStd.value = '';
      window.handleTutorInputAutoResize(inputStd);
    }

    renderitzarSubvista();
    if (modePantallaCompletaXat) {
      renderitzarPantallaCompletaModal();
    }

    const docActiu = obtenirDocActiu();
    const guiaTemaId = typeof documentActiuId === 'string' && documentActiuId.startsWith('guia:')
      ? documentActiuId.replace('guia:', '')
      : (documentActiuId === 'guia_auto' ? 'auto' : null);

    // Afegir indicador de càrrega visual
    const loadingId = 'tutor-loading-' + Date.now();
    const msgContainers = [
      document.getElementById('tutor-chat-messages'),
      document.getElementById('tutor-fs-messages')
    ].filter(Boolean);

    msgContainers.forEach(container => {
      const loadingDiv = document.createElement('div');
      loadingDiv.className = loadingId;
      loadingDiv.style.display = 'flex';
      loadingDiv.style.alignItems = 'center';
      loadingDiv.style.gap = '10px';
      loadingDiv.style.padding = '8px 0';
      loadingDiv.innerHTML = `
        <div style="width: 34px; height: 34px; border-radius: 50%; background: #0084ff; color: white; display: flex; align-items: center; justify-content: center; font-size: 12.5px; font-weight: 900; flex-shrink: 0; box-shadow: 0 2px 8px rgba(0,132,255,0.4);">
          AM
        </div>
        <div style="background: #111e32; color: #cbd5e1; border: 1.5px solid #1c314e; padding: 10px 16px; border-radius: 18px 18px 18px 4px; font-size: 13px; display: flex; align-items: center; gap: 8px;">
          <span style="display:inline-block; animation: spin 1s linear infinite;">⏳</span> <span>Agent Medina està analitzant la normativa i elaborant la resposta...</span>
        </div>
      `;
      container.appendChild(loadingDiv);
      container.scrollTop = container.scrollHeight;
    });

    function treureLoaders() {
      document.querySelectorAll('.' + loadingId).forEach(el => el.remove());
    }

    function desarResposta(role, text, font) {
      treureLoaders();
      const respostaObj = {
        role,
        text,
        contextDoc: docActiu ? `${docActiu.titol} (${docActiu.municipi || 'General'})` : null,
        font: font || 'Tutor Agent Medina',
        hora: `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`
      };
      historialXat.push(respostaObj);
      if (sessio) {
        sessio.missatges = historialXat;
        sessio.dataActualitzacio = new Date().toISOString();
      }
      guardarSessions();
      renderitzarSubvista();
      if (modePantallaCompletaXat) {
        renderitzarPantallaCompletaModal();
      }
    }

    // 1. Prioritat: Servidor local amb la base de dades completa de la Guia de Mossos 2026
    try {
      const uFb = (typeof window.obtenirUsuariFirebase === 'function') ? window.obtenirUsuariFirebase() : null;
      const localRes = await fetch('/api/gemini/tutor-xat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          missatge,
          historial: historialXat.slice(-6),
          documentContext: docActiu ? docActiu.contingutText : null,
          titolDocument: docActiu ? docActiu.titol : null,
          municipi: docActiu ? docActiu.municipi : null,
          cos: cosActiu,
          guiaTemaId: guiaTemaId,
          usuariNom: uFb?.displayName || (uFb?.email ? uFb.email.split('@')[0] : 'Òscar'),
          usuariEmail: uFb?.email || null
        })
      });

      if (localRes.ok) {
        const localData = await localRes.json();
        if (localData && localData.success && localData.resposta) {
          let fontNom = 'Tutor Agent Medina';
          if (localData.font === 'guia_oficial_servidor') {
            fontNom = 'Guia Oficial Mossos 2026 (Servidor)';
          } else if (localData.font && localData.font.includes('gemini')) {
            fontNom = `Gemini IA + Guia Mossos 2026`;
          }
          desarResposta('model', localData.resposta, fontNom);
          return;
        }
      }
    } catch (localErr) {
      console.warn('Avís connectant amb /api/gemini/tutor-xat local, utilitzant connexió de reserva:', localErr);
    }

    // 2. Connexió de reserva
    try {
      const promptParts = [
        `Ets el Tutor virtual expert en temari i normativa policial d'Agent Medina (Mossos d'Esquadra i Policia Local de Catalunya).`,
        `Cos actiu: ${cosActiu === 'pl' ? 'Policia Local' : "Mossos d'Esquadra"}`
      ];
      if (docActiu && docActiu.titol) {
        promptParts.push(`Document/Normativa consultada: "${docActiu.titol}" (${docActiu.municipi || 'General'})\nFragment:\n${(docActiu.contingutText || '').slice(0, 2500)}`);
      }
      if (historialXat.length > 0) {
        const histRecent = historialXat.slice(-4).map(m => `${m.role === 'user' ? 'Opositor' : 'Tutor'}: ${m.text}`).join('\n');
        promptParts.push(`Historial de conversa recent:\n${histRecent}`);
      }
      promptParts.push(`Pregunta actual de l'opositor:\n"${missatge}"`);
      promptParts.push(`Respon de forma clara, pedagògica, precisa amb articles legals si escau i en català.`);

      const res = await fetch('https://backend-opos-tests.vercel.app/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptParts.join('\n\n')
        })
      });

      let dades = null;
      const rawText = await res.text();
      try {
        dades = JSON.parse(rawText);
      } catch (_) {
        dades = { text: rawText };
      }

      const respostaText = (dades && (dades.text || dades.resposta || dades.message)) || rawText;
      if (respostaText && typeof respostaText === 'string' && respostaText.trim().length > 0) {
        desarResposta('model', respostaText, 'Vercel AI Backend');
      } else {
        const respostaFallback = generarRespostaEstructuradaAgentMedina(missatge, cosActiu, ambitNormatiuActiu, docActiu);
        desarResposta('model', respostaFallback, 'Agent Medina (Base de Coneixement)');
      }
    } catch (err) {
      console.warn('Error en xat remot, aplicant base de coneixement directa:', err);
      const respostaFallback = generarRespostaEstructuradaAgentMedina(missatge, cosActiu, ambitNormatiuActiu, docActiu);
      desarResposta('model', respostaFallback, 'Agent Medina (Base de Coneixement)');
    }
  };

  // ==========================================================================
  // PESTANYA 2: GESTOR D'ORDENANCES I TEMARI PROPI
  // ==========================================================================
  function renderitzarOrdenances(host) {
    host.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 24px;">
        
        <!-- CARD PER PUJAR O ENGANXAR UNA NOVA ORDENANÇA -->
        <div style="background: var(--bg-card, #ffffff); border-radius: 16px; border: 1.5px solid var(--border-card, #e2e8f0); padding: 22px; box-shadow: var(--shadow-card, 0 4px 20px rgba(0,0,0,0.06));">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 14px;">
            <span style="font-size: 24px;">📝</span>
            <h2 style="margin: 0; font-size: 18px; font-weight: 800; color: var(--text-main, #0f172a);">
              Carregar Ordenança Municipal o Temari Propi
            </h2>
          </div>
          <p style="margin: 0 0 16px 0; font-size: 13.5px; color: var(--text-muted, #64748b); line-height: 1.5;">
            Enganxa el text de qualsevol ordenança (Convivència, Trànsit, Civisme, Terrasses) o puja un fitxer de text. La IA podrà respondre dubtes directament d'aquest text i generar preguntes tipus test automàtiques.
          </p>

          <form id="form-afegir-document" onsubmit="window.desarNouDocument(event)" style="display: flex; flex-direction: column; gap: 14px;">
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px;">
              <div>
                <label style="display: block; font-size: 12px; font-weight: 700; color: var(--text-main, #334155); margin-bottom: 6px;">Títol de l'Ordenança o Tema *</label>
                <input type="text" id="doc-input-titol" placeholder="Ex: Ordenança de Civisme i Convivència" required style="width: 100%; box-sizing: border-box; background: var(--bg-card-subtle, #f8fafc); border: 1px solid var(--border-card, #cbd5e1); border-radius: 8px; padding: 9px 12px; font-size: 13px; color: var(--text-main, #0f172a); outline: none;">
              </div>

              <div>
                <label style="display: block; font-size: 12px; font-weight: 700; color: var(--text-main, #334155); margin-bottom: 6px;">Municipi / Àmbit *</label>
                <input type="text" id="doc-input-municipi" placeholder="Ex: Cunit, Badalona, Girona, General..." required style="width: 100%; box-sizing: border-box; background: var(--bg-card-subtle, #f8fafc); border: 1px solid var(--border-card, #cbd5e1); border-radius: 8px; padding: 9px 12px; font-size: 13px; color: var(--text-main, #0f172a); outline: none;">
              </div>

              <div>
                <label style="display: block; font-size: 12px; font-weight: 700; color: var(--text-main, #334155); margin-bottom: 6px;">Tipus de contingut</label>
                <select id="doc-input-tipus" style="width: 100%; box-sizing: border-box; background: var(--bg-card-subtle, #f8fafc); border: 1px solid var(--border-card, #cbd5e1); border-radius: 8px; padding: 9px 12px; font-size: 13px; color: var(--text-main, #0f172a); outline: none; cursor: pointer;">
                  <option value="Ordenança Municipal">📜 Ordenança Municipal</option>
                  <option value="Temari Específic">📚 Temari Específic Policia Local</option>
                  <option value="Normativa General">⚖️ Normativa o Llei Específica</option>
                </select>
              </div>
            </div>

            <!-- Zona d'arxiu i text -->
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <label style="font-size: 12px; font-weight: 700; color: var(--text-main, #334155);">Articulat / Text complet del document *</label>
                <label style="cursor: pointer; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; padding: 3px 10px; border-radius: 6px; font-size: 11.5px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
                  <span>📎</span> Pujar fitxer (.txt, .pdf, .md)
                  <input type="file" id="doc-file-upload" accept=".txt,.md,.json,.pdf,.doc,.docx" onchange="window.handleDocumentFileUpload(this)" style="display: none;">
                </label>
              </div>

              <textarea id="doc-input-text" placeholder="Enganxa aquí el text o articulat de l'ordenança (Articles, sancions, infraccions, competències...)" required rows="7" style="width: 100%; box-sizing: border-box; background: var(--bg-card-subtle, #f8fafc); border: 1px solid var(--border-card, #cbd5e1); border-radius: 10px; padding: 12px; font-size: 13px; color: var(--text-main, #0f172a); outline: none; font-family: monospace; line-height: 1.45;" oninput="window.actualitzarComptadorDoc()"></textarea>
              
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px; font-size: 11.5px; color: var(--text-muted, #64748b);">
                <span id="doc-comptador-txt">0 caràcters · ~0 paraules</span>
                <span>💡 Com més complet sigui el text (amb articles i imports de multes), millors seran els tests generats.</span>
              </div>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 6px;">
              <button type="button" onclick="window.omplirExempleCunit()" style="background: none; border: 1px solid var(--border-card, #cbd5e1); color: var(--text-muted, #475569); padding: 10px 16px; border-radius: 8px; font-size: 12.5px; font-weight: 700; cursor: pointer;">
                ✨ Carregar exemple de Cunit
              </button>
              <button type="submit" id="btn-desar-document" style="background: #002B5E; color: white; border: none; padding: 10px 24px; border-radius: 8px; font-size: 13.5px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 8px rgba(0,43,94,0.25);">
                <span>💾 Desar Document</span>
              </button>
            </div>

          </form>
        </div>

        <!-- LLISTAT DE DOCUMENTS GUARDATS -->
        <div>
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
            <h2 style="margin: 0; font-size: 18px; font-weight: 800; color: var(--text-main, #0f172a);">
              Documents i Ordenances Disponibles (${documentsCache.length})
            </h2>
            <span style="font-size: 12.5px; color: var(--text-muted, #64748b);">Desats a la memòria del teu navegador i servidor</span>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px;">
            ${documentsCache.map(renderitzarTargetaDocument).join('')}
          </div>
        </div>

      </div>
    `;
  }

  function renderitzarTargetaDocument(doc) {
    const esActiu = doc.id === documentActiuId;
    const numParaules = doc.contingutText ? doc.contingutText.trim().split(/\s+/).length : 0;

    return `
      <div style="background: var(--bg-card, #ffffff); border-radius: 14px; border: 1.5px solid ${esActiu ? '#007aff' : 'var(--border-card, #e2e8f0)'}; padding: 18px; box-shadow: ${esActiu ? '0 4px 16px rgba(0,122,255,0.15)' : 'var(--shadow-card, 0 2px 10px rgba(0,0,0,0.04))'}; display: flex; flex-direction: column; justify-content: space-between; gap: 14px;">
        <div>
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px;">
            <span style="background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 800;">
              📍 ${escapeHtml(doc.municipi || 'General')}
            </span>
            <span style="font-size: 11px; color: var(--text-muted, #94a3b8);">
              ${doc.tipus || 'Ordenança'}
            </span>
          </div>

          <h3 style="margin: 0 0 8px 0; font-size: 15.5px; font-weight: 800; color: var(--text-main, #0f172a); line-height: 1.35;">
            ${escapeHtml(doc.titol)}
          </h3>

          <p style="margin: 0; font-size: 12px; color: var(--text-muted, #64748b); line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">
            ${escapeHtml(doc.contingutText.slice(0, 180))}...
          </p>
        </div>

        <div style="border-top: 1px solid var(--border-card, #f1f5f9); padding-top: 12px; display: flex; flex-direction: column; gap: 8px;">
          <div style="font-size: 11px; color: var(--text-muted, #94a3b8); display: flex; justify-content: space-between;">
            <span>${numParaules.toLocaleString()} paraules</span>
            <span>${doc.dataActualitzacio ? new Date(doc.dataActualitzacio).toLocaleDateString('ca') : ''}</span>
          </div>

          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button onclick="window.activarDocumentPerXat('${doc.id}')" style="flex: 1; background: ${esActiu ? '#10b981' : '#007aff'}; color: white; border: none; padding: 8px 12px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px;">
              <span>💬</span> ${esActiu ? 'Xat Actiu' : 'Xatejar'}
            </button>
            <button onclick="window.obrirGeneradorAmbDoc('${doc.id}')" style="flex: 1; background: #002B5E; color: white; border: none; padding: 8px 12px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px;">
              <span>⚡</span> Generar Test
            </button>
            <button onclick="window.esborrarDocumentConfirm('${doc.id}')" style="background: none; border: 1px solid #fca5a5; color: #dc2626; padding: 8px; border-radius: 8px; font-size: 12px; cursor: pointer;" title="Eliminar document">
              🗑️
            </button>
          </div>
        </div>
      </div>
    `;
  }

  window.actualitzarComptadorDoc = function () {
    const txt = document.getElementById('doc-input-text')?.value || '';
    const el = document.getElementById('doc-comptador-txt');
    if (el) {
      const paraules = txt.trim() ? txt.trim().split(/\s+/).length : 0;
      el.textContent = `${txt.length.toLocaleString()} caràcters · ~${paraules.toLocaleString()} paraules`;
    }
  };

  window.handleDocumentFileUpload = function (input) {
    const file = input.files && input.files[0];
    if (!file) return;

    // Detectar títol automàtic a partir del nom del fitxer
    const titolEl = document.getElementById('doc-input-titol');
    if (titolEl && !titolEl.value) {
      const nomNet = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
      titolEl.value = nomNet.charAt(0).toUpperCase() + nomNet.slice(1);
    }

    const reader = new FileReader();
    reader.onload = function (e) {
      const text = e.target.result;
      const textArea = document.getElementById('doc-input-text');
      if (textArea) {
        textArea.value = text;
        window.actualitzarComptadorDoc();
      }
    };

    if (file.type.includes('text') || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
      reader.readAsText(file);
    } else {
      // Per a altres formats o binaris llegim com a text si és possible
      reader.readAsText(file);
    }
  };

  window.omplirExempleCunit = function () {
    const titol = document.getElementById('doc-input-titol');
    const mun = document.getElementById('doc-input-municipi');
    const txt = document.getElementById('doc-input-text');
    if (titol) titol.value = DOCUMENTS_MOSTRA[0].titol;
    if (mun) mun.value = DOCUMENTS_MOSTRA[0].municipi;
    if (txt) txt.value = DOCUMENTS_MOSTRA[0].contingutText;
    window.actualitzarComptadorDoc();
  };

  window.desarNouDocument = async function (e) {
    if (e && e.preventDefault) e.preventDefault();

    const titol = document.getElementById('doc-input-titol')?.value.trim();
    const municipi = document.getElementById('doc-input-municipi')?.value.trim();
    const tipus = document.getElementById('doc-input-tipus')?.value;
    const contingutText = document.getElementById('doc-input-text')?.value.trim();

    if (!titol || !contingutText) {
      alert('Si us plau, omple el títol i el contingut del document.');
      return;
    }

    const btn = document.getElementById('btn-desar-document');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ Desant...';
    }

    const nouDoc = {
      id: 'doc_' + Date.now(),
      titol,
      municipi,
      tipus,
      contingutText,
      dataCreacio: new Date().toISOString(),
      dataActualitzacio: new Date().toISOString()
    };

    await guardarDocument(nouDoc);

    if (btn) {
      btn.disabled = false;
      btn.textContent = '💾 Desar Document';
    }

    // Netejar formulari i refrescar
    window.canviarPestanyaTutor('ordenances');
  };

  window.activarDocumentPerXat = function (id) {
    documentActiuId = id;
    window.canviarPestanyaTutor('xat');
  };

  window.obrirGeneradorAmbDoc = function (id) {
    documentActiuId = id;
    window.canviarPestanyaTutor('generador');
  };

  window.esborrarDocumentConfirm = async function (id) {
    const doc = documentsCache.find(d => d.id === id);
    if (!doc) return;
    if (confirm(`Estàs segur que vols eliminar "${doc.titol}"?`)) {
      await esborrarDocument(id);
      renderitzarSubvista();
    }
  };

  // ==========================================================================
  // PESTANYA 3: GENERADOR DE TESTS IA A PARTIR D'ORDENANCES
  // ==========================================================================
  function renderitzarGenerador(host) {
    const docActiu = documentsCache.find(d => d.id === documentActiuId) || documentsCache[0];

    host.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 24px;">
        
        <!-- PANELL DE CONFIGURACIÓ DE GENERACIÓ -->
        <div style="background: var(--bg-card, #ffffff); border-radius: 16px; border: 1.5px solid var(--border-card, #e2e8f0); padding: 22px; box-shadow: var(--shadow-card, 0 4px 20px rgba(0,0,0,0.06));">
          
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 14px;">
            <span style="font-size: 24px;">⚡</span>
            <h2 style="margin: 0; font-size: 18px; font-weight: 800; color: var(--text-main, #0f172a);">
              Generar Preguntes Tipus Test d'Oposició amb Gemini IA
            </h2>
          </div>

          <p style="margin: 0 0 20px 0; font-size: 13.5px; color: var(--text-muted, #64748b); line-height: 1.5;">
            Tria l'ordenança o temari i l'enfocament de preguntes que vols practicar. La IA analitzarà l'articulat per redactar preguntes de 4 opcions amb distractors d'oposició i la justificació legal exacte.
          </p>

          <form id="form-generar-tests" onsubmit="window.executarGeneracioTest(event)" style="display: flex; flex-direction: column; gap: 16px;">
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px;">
              
              <!-- Selecció de document -->
              <div>
                <label style="display: block; font-size: 12px; font-weight: 700; color: var(--text-main, #334155); margin-bottom: 6px;">
                  Document / Ordenança de referència *
                </label>
                <select id="gen-sel-doc" onchange="window.onCanviDocGenerador(this.value)" style="width: 100%; box-sizing: border-box; background: var(--bg-card-subtle, #f8fafc); border: 1px solid var(--border-card, #cbd5e1); border-radius: 8px; padding: 9px 12px; font-size: 13px; color: var(--text-main, #0f172a); outline: none; cursor: pointer;">
                  ${documentsCache.map(d => `
                    <option value="${d.id}" ${docActiu && d.id === docActiu.id ? 'selected' : ''}>
                      📍 [${escapeHtml(d.municipi || 'General')}] ${escapeHtml(d.titol)}
                    </option>
                  `).join('')}
                </select>
              </div>

              <!-- Quantitat de preguntes -->
              <div>
                <label style="display: block; font-size: 12px; font-weight: 700; color: var(--text-main, #334155); margin-bottom: 6px;">
                  Quantitat de preguntes *
                </label>
                <select id="gen-sel-quantitat" style="width: 100%; box-sizing: border-box; background: var(--bg-card-subtle, #f8fafc); border: 1px solid var(--border-card, #cbd5e1); border-radius: 8px; padding: 9px 12px; font-size: 13px; color: var(--text-main, #0f172a); outline: none; cursor: pointer;">
                  <option value="5">5 preguntes (ràpid)</option>
                  <option value="10" selected>10 preguntes (recomanat)</option>
                  <option value="15">15 preguntes (complet)</option>
                  <option value="20">20 preguntes (intensiu)</option>
                </select>
              </div>

              <!-- Enfocament de les preguntes -->
              <div>
                <label style="display: block; font-size: 12px; font-weight: 700; color: var(--text-main, #334155); margin-bottom: 6px;">
                  Enfocament de l'examen *
                </label>
                <select id="gen-sel-enfocament" style="width: 100%; box-sizing: border-box; background: var(--bg-card-subtle, #f8fafc); border: 1px solid var(--border-card, #cbd5e1); border-radius: 8px; padding: 9px 12px; font-size: 13px; color: var(--text-main, #0f172a); outline: none; cursor: pointer;">
                  <option value="Variat equilibrat (infraccions, terminis, sancions i competències)">🎯 Variat d'oposició (tot inclòs)</option>
                  <option value="Quanties de sancions i multes econòmiques">💰 Terminis i Sancions econòmiques (€)</option>
                  <option value="Qualificació d'infraccions lleus, greus i molt greus">⚖️ Infraccions lleus, greus i molt greus</option>
                  <option value="Competències de l'Alcalde, Ple municipal i Policia Local">🏛️ Competències dels òrgans municipals</option>
                  <option value="Terminis de notificació, prescripció i caducitat">⏱️ Prescripció, caducitat i terminis</option>
                </select>
              </div>

              <!-- Cos / Banc de destí -->
              <div>
                <label style="display: block; font-size: 12px; font-weight: 700; color: var(--text-main, #334155); margin-bottom: 6px;">
                  Banc de preguntes de destí
                </label>
                <select id="gen-sel-banc" style="width: 100%; box-sizing: border-box; background: var(--bg-card-subtle, #f8fafc); border: 1px solid var(--border-card, #cbd5e1); border-radius: 8px; padding: 9px 12px; font-size: 13px; color: var(--text-main, #0f172a); outline: none; cursor: pointer;">
                  <option value="pl" selected>🚔 Policia Local (Recomanat per ordenances)</option>
                  <option value="mossos">👮 Mossos d'Esquadra</option>
                </select>
              </div>

            </div>

            <div style="display: flex; justify-content: flex-end; margin-top: 8px;">
              <button type="submit" id="btn-iniciar-generacio" style="background: linear-gradient(135deg, #002B5E, #007aff); color: white; border: none; padding: 12px 28px; border-radius: 10px; font-size: 14px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 4px 14px rgba(0,43,94,0.3);">
                <span>✨ Generar Preguntes amb Gemini IA</span>
              </button>
            </div>

          </form>

        </div>

        <!-- ZONA DE RESULTATS GENERATS -->
        <div id="gen-zona-resultats">
          ${preguntesGeneradesUltimes.length > 0 ? renderitzarResultatsGenerats() : ''}
        </div>

      </div>
    `;
  }

  window.onCanviDocGenerador = function (id) {
    documentActiuId = id;
  };

  window.executarGeneracioTest = async function (e) {
    if (e && e.preventDefault) e.preventDefault();

    const selDocId = document.getElementById('gen-sel-doc')?.value;
    const doc = documentsCache.find(d => d.id === selDocId);
    if (!doc) {
      alert('Si us plau, selecciona una ordenança o puja\'n una primer.');
      return;
    }

    const quantitat = document.getElementById('gen-sel-quantitat')?.value || 10;
    const enfocament = document.getElementById('gen-sel-enfocament')?.value || '';
    const banc = document.getElementById('gen-sel-banc')?.value || 'pl';

    const btn = document.getElementById('btn-iniciar-generacio');
    const resHost = document.getElementById('gen-zona-resultats');

    if (btn) {
      btn.disabled = true;
      btn.style.opacity = '0.6';
      btn.innerHTML = '<span>⏳</span> <span>Analitzant ordenança i redactant preguntes...</span>';
    }

    if (resHost) {
      resHost.innerHTML = `
        <div style="background: var(--bg-card, #ffffff); border-radius: 14px; border: 1.5px solid var(--border-card, #cbd5e1); padding: 30px; text-align: center;">
          <div style="font-size: 38px; margin-bottom: 10px;">⚙️</div>
          <h3 style="margin: 0 0 6px 0; color: var(--text-main, #0f172a);">Generant preguntes rigoroses...</h3>
          <p style="margin: 0; color: var(--text-muted, #64748b); font-size: 13.5px;">Gemini IA està analitzant els articles de <b>"${escapeHtml(doc.titol)}"</b> per construir preguntes tipus test amb 4 opcions i distractors versemblants.</p>
        </div>
      `;
      resHost.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    try {
      const res = await fetch('/api/gemini/generar-preguntes-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          textDocument: doc.contingutText,
          titolDocument: doc.titol,
          municipi: doc.municipi,
          quantitat,
          enfocament,
          temaDesti: `Ordenança: ${doc.titol}`,
          bancDesti: banc
        })
      });

      const dades = await res.json();
      if (btn) {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.innerHTML = '<span>✨ Generar Preguntes amb Gemini IA</span>';
      }

      if (dades.success && Array.isArray(dades.preguntes) && dades.preguntes.length > 0) {
        preguntesGeneradesUltimes = dades.preguntes;
        if (resHost) resHost.innerHTML = renderitzarResultatsGenerats(doc);
      } else {
        if (resHost) {
          resHost.innerHTML = `
            <div style="background: #fee2e2; border: 1.5px solid #ef4444; border-radius: 12px; padding: 20px; color: #991b1b;">
              <h3 style="margin: 0 0 6px 0;">⚠️ No s'han pogut generar preguntes</h3>
              <p style="margin: 0; font-size: 13px;">${escapeHtml(dades.error || 'Hi ha hagut un error en processar el document.')}</p>
            </div>
          `;
        }
      }
    } catch (err) {
      if (btn) {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.innerHTML = '<span>✨ Generar Preguntes amb Gemini IA</span>';
      }
      if (resHost) {
        resHost.innerHTML = `
          <div style="background: #fee2e2; border: 1.5px solid #ef4444; border-radius: 12px; padding: 20px; color: #991b1b;">
            <h3 style="margin: 0 0 6px 0;">⚠️ Error de connexió</h3>
            <p style="margin: 0; font-size: 13px;">${escapeHtml(err.message)}</p>
          </div>
        `;
      }
    }
  };

  function renderitzarResultatsGenerats(doc) {
    const lletres = ['A', 'B', 'C', 'D'];
    const total = preguntesGeneradesUltimes.length;

    return `
      <div style="background: var(--bg-card, #ffffff); border-radius: 16px; border: 1.5px solid #10b981; padding: 22px; box-shadow: 0 4px 20px rgba(16,185,129,0.12);">
        
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 18px; padding-bottom: 14px; border-bottom: 1px solid var(--border-card, #e2e8f0);">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 24px;">🎉</span>
              <h2 style="margin: 0; font-size: 18px; font-weight: 800; color: #065f46;">
                S'han generat ${total} preguntes tipus test!
              </h2>
            </div>
            <p style="margin: 4px 0 0 0; font-size: 13px; color: var(--text-muted, #64748b);">
              Basades en l'ordenança <b>"${escapeHtml(doc ? doc.titol : 'Seleccionada')}"</b>
            </p>
          </div>

          <!-- BOTONS D'ACCIÓ CLAU -->
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <button onclick="window.comencarTestAmbPreguntesGenerades()" style="background: #16a34a; color: white; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 800; font-size: 13.5px; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 8px rgba(22,163,74,0.3);">
              <span>🚀 Començar aquest Test ARA</span>
            </button>
            <button id="btn-afegir-banc-permanent" onclick="window.afegirPreguntesAlBancPermanent()" style="background: #002B5E; color: white; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 800; font-size: 13.5px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
              <span>💾 Desar al Banc Permanent</span>
            </button>
          </div>
        </div>

        <!-- LLISTAT DE PREGUNTES PREVISUALITZADES -->
        <div style="display: flex; flex-direction: column; gap: 14px; max-height: 500px; overflow-y: auto; padding-right: 6px;">
          ${preguntesGeneradesUltimes.map((q, idx) => `
            <div style="background: var(--bg-card-subtle, #f8fafc); border: 1px solid var(--border-card, #e2e8f0); border-radius: 12px; padding: 14px;">
              <div style="display: flex; justify-content: space-between; gap: 10px; margin-bottom: 8px;">
                <span style="font-weight: 800; font-size: 13px; color: #002B5E;">#${idx + 1}.</span>
                <span style="background: #eff6ff; color: #1d4ed8; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 700;">${escapeHtml(q.tema || 'Ordenança')}</span>
              </div>
              <div style="font-weight: 700; font-size: 13.5px; color: var(--text-main, #0f172a); margin-bottom: 10px; line-height: 1.4;">
                ${escapeHtml(q.pregunta)}
              </div>
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 6px; margin-bottom: 8px;">
                ${q.opcions.map((op, opIdx) => `
                  <div style="padding: 6px 10px; border-radius: 6px; font-size: 12px; display: flex; gap: 6px; ${opIdx === q.resposta ? 'background:#dcfce7;border:1px solid #86efac;color:#14532d;font-weight:700;' : 'background:var(--bg-card,#fff);border:1px solid var(--border-card,#cbd5e1);color:var(--text-main,#334155);'}">
                    <span>${lletres[opIdx]})</span>
                    <span>${escapeHtml(op)}</span>
                    ${opIdx === q.resposta ? '<span style="margin-left:auto;color:#16a34a;">✓</span>' : ''}
                  </div>
                `).join('')}
              </div>
              <div style="font-size: 11.5px; color: #166534; background: #f0fdf4; padding: 6px 10px; border-radius: 6px;">
                <b>Justificació:</b> ${escapeHtml(q.explicacio)}
              </div>
            </div>
          `).join('')}
        </div>

      </div>
    `;
  }

  window.comencarTestAmbPreguntesGenerades = function () {
    if (!Array.isArray(preguntesGeneradesUltimes) || preguntesGeneradesUltimes.length === 0) {
      alert('No hi ha cap pregunta generada per començar el test.');
      return;
    }

    // Assignar al banc en memòria del navegador
    if (!window.bancoPoliciaLocal) window.bancoPoliciaLocal = [];
    preguntesGeneradesUltimes.forEach(q => {
      const idx = window.bancoPoliciaLocal.findIndex(p => p.id === q.id);
      if (idx === -1) window.bancoPoliciaLocal.push(q);
    });

    if (typeof window.iniciarExamen === 'function') {
      // Iniciar el test directament amb el conjunt generat
      window.iniciarExamen(preguntesGeneradesUltimes.length, false, [...preguntesGeneradesUltimes]);
    } else {
      alert('S\'han afegit les preguntes al banc. Pots accedir-hi des de la pestanya de Policia Local.');
    }
  };

  window.afegirPreguntesAlBancPermanent = async function () {
    if (!Array.isArray(preguntesGeneradesUltimes) || preguntesGeneradesUltimes.length === 0) return;

    const btn = document.getElementById('btn-afegir-banc-permanent');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ Desant al fitxer .js...';
    }

    try {
      const res = await fetch('/api/modificar-preguntes-fitxer-lot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          banc: 'pl',
          preguntes: preguntesGeneradesUltimes
        })
      });

      const dades = await res.json();
      if (dades.success) {
        if (btn) {
          btn.style.background = '#10b981';
          btn.innerHTML = `<span>✓ Desades permanentment (${dades.afegides})</span>`;
        }
        // Afegir també a la variable en memòria
        if (!window.bancoPoliciaLocal) window.bancoPoliciaLocal = [];
        preguntesGeneradesUltimes.forEach(q => {
          const idx = window.bancoPoliciaLocal.findIndex(p => p.id === q.id);
          if (idx === -1) window.bancoPoliciaLocal.push(q);
          else window.bancoPoliciaLocal[idx] = q;
        });

        alert(`✅ S'han desat correctament ${dades.afegides} preguntes al fitxer permanent de Policia Local! Ara les trobaràs sempre als tests i cerques.`);
      } else {
        alert('Error en desar: ' + (dades.error || 'Error desconegut'));
        if (btn) {
          btn.disabled = false;
          btn.textContent = '💾 Desar al Banc Permanent';
        }
      }
    } catch (err) {
      alert('Error de connexió: ' + err.message);
      if (btn) {
        btn.disabled = false;
        btn.textContent = '💾 Desar al Banc Permanent';
      }
    }
  };

  // ==========================================================================
  // PESTANYA 2: EXÀMENS OFICIALS REALS & IMPORTACIÓ AMB IA (PDF / WORD)
  // ==========================================================================
  function renderitzarExamensOficials(host) {
    host.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:20px;">
        
        <!-- HEADER AMB EXPLICACIÓ -->
        <div style="background:var(--bg-card, #ffffff); border:1px solid var(--border-card, #e2e8f0); border-radius:14px; padding:18px 20px; box-shadow:0 2px 10px rgba(0,0,0,0.03);">
          <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
            <div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:22px;">🏛️</span>
                <h2 style="margin:0; font-size:17px; font-weight:800; color:var(--text-main, #0f172a);">
                  Importador d'Exàmens Oficials Reals (PDF i Word)
                </h2>
              </div>
              <p style="margin:4px 0 0; font-size:12.5px; color:var(--text-muted, #64748b); max-width:760px; line-height:1.45;">
                Puja qualsevol examen oficial en <b>PDF</b> o <b>Word (.docx)</b>. La IA en detectarà les preguntes, solucions i <b>justificacions legals amb articles vigents</b>. Classificarà cada pregunta al temari troncal i et permetrà vincular les locals a ordenances o <b>crear Temes Annexos a mida</b>.
              </p>
            </div>
            <button onclick="document.getElementById('card-pujada-examen').scrollIntoView({behavior:'smooth'})" style="background:#002B5E; color:#fff; border:none; padding:9px 15px; border-radius:8px; font-weight:700; font-size:12px; cursor:pointer; display:flex; align-items:center; gap:6px;">
              <span>➕</span> Pujar Nou Examen
            </button>
          </div>
        </div>

        <!-- FORMULARI DE PUJADA D'EXAMEN -->
        <div id="card-pujada-examen" style="background:var(--bg-card, #ffffff); border:1.5px dashed #0284c7; border-radius:14px; padding:22px; box-shadow:0 3px 12px rgba(2,132,199,0.06);">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:14px;">
            <span style="font-size:20px;">📄</span>
            <h3 style="margin:0; font-size:15px; font-weight:800; color:var(--text-main, #0f172a);">
              Carregar Document d'Examen Oficial
            </h3>
          </div>

          <form id="form-analitzar-examen" onsubmit="window.executarAnalisiExamenIA(event)" style="display:flex; flex-direction:column; gap:14px;">
            
            <!-- Zona drag & drop o selector de fitxer -->
            <div id="zona-drop-examen" onclick="document.getElementById('input-arxiu-examen').click()" style="border:2px dashed #94a3b8; border-radius:12px; padding:24px 16px; text-align:center; background:var(--bg-card-subtle, #f8fafc); cursor:pointer; transition:all 0.2s;">
              <input type="file" id="input-arxiu-examen" accept=".pdf,.docx,.doc,.txt" style="display:none;" onchange="window.gestionarFitxerExamenSeleccionat(this)">
              <div style="font-size:32px; margin-bottom:6px;">📥</div>
              <div style="font-weight:800; font-size:13.5px; color:var(--text-main, #0f172a);" id="text-nom-fitxer-examen">
                Fes clic per triar el teu PDF o Word, o arrossega'l aquí
              </div>
              <div style="font-size:11.5px; color:var(--text-muted, #64748b); margin-top:4px;">
                Admet PDF d'oposicions reals, documents .docx, .doc o fitxers de text
              </div>
            </div>

            <!-- Camps de Metadades -->
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:12px;">
              <div>
                <label style="display:block; font-size:11.5px; font-weight:700; color:var(--text-muted, #64748b); margin-bottom:4px;">
                  Títol de l'examen:
                </label>
                <input type="text" id="input-examen-titol" required placeholder="Ex: Examen Oficial Policia Local Cunit 2024" style="width:100%; box-sizing:border-box; padding:9px 12px; border:1px solid var(--border-card, #cbd5e1); border-radius:8px; font-size:13px; background:var(--bg-card, #ffffff); color:var(--text-main, #0f172a);">
              </div>

              <div>
                <label style="display:block; font-size:11.5px; font-weight:700; color:var(--text-muted, #64748b); margin-bottom:4px;">
                  Municipi / Àmbit:
                </label>
                <input type="text" id="input-examen-municipi" placeholder="Ex: Cunit, Badalona, Constantí..." value="Cunit" style="width:100%; box-sizing:border-box; padding:9px 12px; border:1px solid var(--border-card, #cbd5e1); border-radius:8px; font-size:13px; background:var(--bg-card, #ffffff); color:var(--text-main, #0f172a);">
              </div>

              <div>
                <label style="display:block; font-size:11.5px; font-weight:700; color:var(--text-muted, #64748b); margin-bottom:4px;">
                  Any de la convocatòria:
                </label>
                <input type="number" id="input-examen-any" value="${new Date().getFullYear()}" style="width:100%; box-sizing:border-box; padding:9px 12px; border:1px solid var(--border-card, #cbd5e1); border-radius:8px; font-size:13px; background:var(--bg-card, #ffffff); color:var(--text-main, #0f172a);">
              </div>

              <div>
                <label style="display:block; font-size:11.5px; font-weight:700; color:var(--text-muted, #64748b); margin-bottom:4px;">
                  Cos Policial de Destí:
                </label>
                <select id="input-examen-cos" style="width:100%; box-sizing:border-box; padding:9px 12px; border:1px solid var(--border-card, #cbd5e1); border-radius:8px; font-size:13px; background:var(--bg-card, #ffffff); color:var(--text-main, #0f172a);">
                  <option value="pl" selected>🚔 Policia Local</option>
                  <option value="mossos">🔵 Mossos d'Esquadra</option>
                </select>
              </div>
            </div>

            <!-- Plantilla Oficial Opcional -->
            <div>
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                <label style="font-size:11.5px; font-weight:700; color:var(--text-muted, #64748b);">
                  Plantilla Oficial de Respostes del Tribunal (Opcional pero molt recomanada si la tens):
                </label>
                <span style="font-size:11px; color:#0284c7; font-weight:600;">Enganxa text o lletres (ex: 1A 2B 3D 4C...)</span>
              </div>
              <textarea id="input-examen-plantilla" rows="2" placeholder="Ex: 1-A, 2-C, 3-D, 4-B, 5-A... Si no l'enganxes, la IA resoldrà cadascuna segons la normativa vigent." style="width:100%; box-sizing:border-box; padding:8px 12px; border:1px solid var(--border-card, #cbd5e1); border-radius:8px; font-size:12px; background:var(--bg-card, #ffffff); color:var(--text-main, #0f172a); resize:vertical;"></textarea>
            </div>

            <!-- Opcional: Enganxar text de l'examen directament si no és fitxer -->
            <details style="font-size:12px; color:var(--text-muted, #64748b);">
              <summary style="cursor:pointer; font-weight:700; color:#0284c7; margin-bottom:6px;">
                O enganxar el text de l'examen manualment (copiar i enganxar)
              </summary>
              <textarea id="input-examen-text-directe" rows="4" placeholder="Enganxa aquí el contingut escrit de l'examen si no disposes del fitxer descarregat..." style="width:100%; box-sizing:border-box; padding:8px 12px; border:1px solid var(--border-card, #cbd5e1); border-radius:8px; font-size:12px; background:var(--bg-card, #ffffff); color:var(--text-main, #0f172a); resize:vertical;"></textarea>
            </details>

            <!-- Botó d'Acció d'Anàlisi -->
            <button type="submit" id="btn-iniciar-analisi-examen" style="background:linear-gradient(135deg,#002B5E,#007aff); color:#fff; border:none; padding:12px 20px; border-radius:10px; font-weight:800; font-size:14px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; box-shadow:0 4px 14px rgba(0,122,255,0.25);">
              <span>✨</span> Analitzar i Classificar Examen Oficial amb IA
            </button>
          </form>
        </div>

        <!-- CONTENIDOR DE RESULTAT DE L'ANÀLISI / TRIAGE -->
        <div id="host-triage-examen"></div>

        <!-- LLISTAT D'EXÀMENS OFICIALS GUARDATS -->
        <div style="background:var(--bg-card, #ffffff); border:1px solid var(--border-card, #e2e8f0); border-radius:14px; padding:20px; box-shadow:0 2px 10px rgba(0,0,0,0.03);">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; flex-wrap:wrap; gap:10px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:20px;">📚</span>
              <h3 style="margin:0; font-size:15px; font-weight:800; color:var(--text-main, #0f172a);">
                Els Teus Exàmens Oficials Guardats (${examensCache.length})
              </h3>
            </div>
          </div>

          ${examensCache.length === 0 ? `
            <div style="text-align:center; padding:30px 16px; background:var(--bg-card-subtle, #f8fafc); border-radius:12px; color:var(--text-muted, #64748b);">
              <div style="font-size:32px; margin-bottom:8px;">📭</div>
              <div style="font-weight:700; font-size:13.5px;">Encara no has importat cap examen oficial</div>
              <div style="font-size:12px; margin-top:4px;">Puja un PDF o document a sobre per començar a crear la teva col·lecció d'exàmens reals!</div>
            </div>
          ` : `
            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:14px;">
              ${examensCache.map(ex => `
                <div style="background:var(--bg-card-subtle, #f8fafc); border:1px solid var(--border-card, #e2e8f0); border-radius:12px; padding:16px; display:flex; flex-direction:column; justify-content:space-between; gap:12px;">
                  <div>
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; margin-bottom:6px;">
                      <span style="font-weight:800; font-size:14px; color:var(--text-main, #0f172a); line-height:1.35;">
                        ${escapeHtml(ex.titol)}
                      </span>
                      <span style="background:#0284c7; color:#fff; font-size:10px; font-weight:800; padding:2px 7px; border-radius:9999px; text-transform:uppercase; white-space:nowrap;">
                        ${escapeHtml(ex.any || 'Oficial')}
                      </span>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px; font-size:11.5px; color:var(--text-muted, #64748b); margin-bottom:8px; flex-wrap:wrap;">
                      <span>🏛️ <b>${escapeHtml(ex.municipi || 'Catalunya')}</b></span>
                      <span>•</span>
                      <span>❓ <b>${(ex.preguntes || []).length}</b> preguntes</span>
                      <span>•</span>
                      <span>🛡️ <b>${(ex.cos || 'pl').toUpperCase()}</b></span>
                    </div>
                  </div>

                  <div style="display:flex; gap:6px; flex-wrap:wrap; border-top:1px solid var(--border-card, #e2e8f0); padding-top:10px;">
                    <button onclick="window.iniciarSimulacreExamenGuardat('${ex.id}')" style="flex:1; background:#16a34a; color:#fff; border:none; padding:7px 10px; border-radius:7px; font-size:12px; font-weight:800; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:5px;">
                      <span>⏱️</span> Fer Simulacre
                    </button>
                    <button onclick="window.carregarExamenPerRevisar('${ex.id}')" style="background:#002B5E; color:#fff; border:none; padding:7px 10px; border-radius:7px; font-size:12px; font-weight:700; cursor:pointer;" title="Revisar i classificar preguntes">
                      <span>👁️</span> Revisar
                    </button>
                    <button onclick="window.eliminarExamenOficialUI('${ex.id}')" style="background:#fee2e2; color:#b91c1c; border:none; padding:7px 10px; border-radius:7px; font-size:12px; font-weight:700; cursor:pointer;" title="Eliminar examen">
                      <span>🗑️</span>
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>

      </div>
    `;
  }

  // Estat del fitxer seleccionat
  let fitxerExamenSeleccionat = null;

  window.gestionarFitxerExamenSeleccionat = function (input) {
    if (!input.files || !input.files[0]) return;
    fitxerExamenSeleccionat = input.files[0];
    const nom = fitxerExamenSeleccionat.name;
    const sizeMb = (fitxerExamenSeleccionat.size / (1024 * 1024)).toFixed(2);
    
    const label = document.getElementById('text-nom-fitxer-examen');
    if (label) {
      label.innerHTML = `✅ Fitxer seleccionat: <b>${escapeHtml(nom)}</b> (${sizeMb} MB)`;
    }

    // Auto-completar el títol si està buit
    const titolInput = document.getElementById('input-examen-titol');
    if (titolInput && !titolInput.value.trim()) {
      const net = nom.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      titolInput.value = `Examen Oficial ${net}`;
    }
  };

  // Executar l'anàlisi de l'examen amb Gemini
  window.executarAnalisiExamenIA = async function (e) {
    if (e && e.preventDefault) e.preventDefault();

    const titol = document.getElementById('input-examen-titol')?.value?.trim() || 'Examen Oficial';
    const municipi = document.getElementById('input-examen-municipi')?.value?.trim() || 'Cunit';
    const any = document.getElementById('input-examen-any')?.value?.trim() || new Date().getFullYear();
    const cos = document.getElementById('input-examen-cos')?.value || 'pl';
    const plantilla = document.getElementById('input-examen-plantilla')?.value?.trim() || '';
    const textDirecte = document.getElementById('input-examen-text-directe')?.value?.trim() || '';

    let fitxerBase64 = null;
    let nomFitxer = null;

    if (fitxerExamenSeleccionat) {
      nomFitxer = fitxerExamenSeleccionat.name;
      fitxerBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(fitxerExamenSeleccionat);
      });
    }

    if (!fitxerBase64 && !textDirecte) {
      alert('Si us plau, selecciona un arxiu d\'examen (PDF o Word) o enganxa\'n el text.');
      return;
    }

    const host = document.getElementById('host-triage-examen');
    if (host) {
      host.innerHTML = `
        <div style="background:var(--bg-card, #ffffff); border:1.5px solid #0284c7; border-radius:14px; padding:30px 20px; text-align:center; box-shadow:0 4px 20px rgba(2,132,199,0.1);">
          <div style="font-size:36px; animation:spin 1.5s linear infinite; display:inline-block; margin-bottom:12px;">⏳</div>
          <h3 style="margin:0 0 6px 0; font-size:16px; font-weight:800; color:var(--text-main, #0f172a);">
            Analitzant l'examen oficial amb Intel·ligència Artificial...
          </h3>
          <p style="margin:0 auto; font-size:12.5px; color:var(--text-muted, #64748b); max-width:560px; line-height:1.5;">
            Detectant preguntes numerades, resolent i verificant les respostes correctes amb justificacions jurídiques i classificant cada pregunta al temari corresponent. Això pot trigar entre 15 i 35 segons.
          </p>
        </div>
      `;
      host.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    const btn = document.getElementById('btn-iniciar-analisi-examen');
    if (btn) {
      btn.disabled = true;
      btn.style.opacity = '0.7';
    }

    try {
      const res = await fetch('/api/gemini/analitzar-examen-oficial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fitxerBase64,
          nomFitxer,
          textDirecte,
          titol,
          municipi,
          any,
          cos,
          plantillaSolucions: plantilla
        })
      });

      const dades = await res.json();

      if (btn) {
        btn.disabled = false;
        btn.style.opacity = '1';
      }

      const rawExamen = dades.examen || dades;
      const rawPreguntes = rawExamen ? (rawExamen.preguntes || []) : [];

      if (dades.success && Array.isArray(rawPreguntes) && rawPreguntes.length > 0) {
        examenAnalitzatActual = {
          id: rawExamen.id || `examen_${Date.now()}`,
          titol: rawExamen.titol || titol || 'Examen Oficial',
          municipi: rawExamen.municipi || municipi || '',
          any: rawExamen.any || any || '',
          cos: rawExamen.cos || cos || 'pl',
          total: rawPreguntes.length,
          preguntes: rawPreguntes.map((q, idx) => ({
            id: q.id || `q_${Date.now()}_${idx}`,
            numeroOriginal: q.numeroOriginal || q.num || (idx + 1),
            pregunta: q.pregunta || '',
            opcions: q.opcions || [],
            resposta: typeof q.resposta === 'number' ? q.resposta : (typeof q.respostaCorrecta === 'number' ? q.respostaCorrecta : 0),
            esReserva: Boolean(q.esReserva),
            esAnullada: Boolean(q.esAnullada || q.esAnulada),
            coincideixTemari: typeof q.coincideixTemari === 'boolean' ? q.coincideixTemari : (!q.esMunicipalONoCoincideix && Boolean(q.temaClassificat)),
            tema: q.tema || q.temaClassificat || (q.esMunicipalONoCoincideix ? `Específic Municipal: ${rawExamen.municipi || 'Local'}` : 'Temari General'),
            temaClassificat: q.temaClassificat || q.tema || null,
            esMunicipalONoCoincideix: Boolean(q.esMunicipalONoCoincideix),
            justificacioLegal: q.justificacioLegal || q.explicacio || '',
            explicacio: q.explicacio || q.justificacioLegal || '',
            articleLlei: q.articleLlei || '',
            descartada: Boolean(q.descartada || q.esAnullada || q.esAnulada)
          }))
        };
        renderitzarTriageExamen(host, examenAnalitzatActual);
      } else {
        if (host) {
          host.innerHTML = `
            <div style="background:#fee2e2; border:1.5px solid #ef4444; border-radius:12px; padding:20px; color:#991b1b;">
              <h4 style="margin:0 0 6px 0; font-size:15px; font-weight:800;">⚠️ No s'han pogut extreure preguntes de l'arxiu</h4>
              <p style="margin:0; font-size:12.5px;">${escapeHtml(dades.error || 'Verifica que el fitxer contingui text llegible o prova copiant el text directament a la casella.')}</p>
            </div>
          `;
        }
      }
    } catch (err) {
      if (btn) {
        btn.disabled = false;
        btn.style.opacity = '1';
      }
      if (host) {
        host.innerHTML = `
          <div style="background:#fee2e2; border:1.5px solid #ef4444; border-radius:12px; padding:20px; color:#991b1b;">
            <h4 style="margin:0 0 6px 0; font-size:15px; font-weight:800;">⚠️ Error de connexió amb el servidor</h4>
            <p style="margin:0; font-size:12.5px;">${escapeHtml(err.message)}</p>
          </div>
        `;
      }
    }
  };

  // Renderitzador del Triage i revisió interactiva de preguntes de l'examen
  let filtreTriageActiu = 'totes';

  function renderitzarTriageExamen(host, examen) {
    if (!host || !examen) return;

    const preguntes = examen.preguntes || [];
    const total = preguntes.length;
    const coincidencies = preguntes.filter(q => q.coincideixTemari && !q.descartada).length;
    const municipals = preguntes.filter(q => !q.coincideixTemari && !q.descartada).length;
    const reserves = preguntes.filter(q => q.esReserva || q.esAnullada).length;

    host.innerHTML = `
      <div style="background:var(--bg-card, #ffffff); border:2px solid #10b981; border-radius:16px; padding:22px; box-shadow:0 4px 24px rgba(16,185,129,0.12); margin-bottom:20px;">
        
        <!-- HEADER DEL TRIAGE -->
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:14px; border-bottom:1px solid var(--border-card, #e2e8f0); padding-bottom:16px; margin-bottom:16px;">
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:24px;">🎉</span>
              <h2 style="margin:0; font-size:18px; font-weight:800; color:#065f46;">
                Examen Analitzat: ${escapeHtml(examen.titol)}
              </h2>
            </div>
            <p style="margin:4px 0 0 0; font-size:12.5px; color:var(--text-muted, #64748b);">
              Municipi: <b>${escapeHtml(examen.municipi)}</b> • Any: <b>${escapeHtml(examen.any)}</b> • S'han detectat <b>${total} preguntes</b> oficials
            </p>
          </div>

          <!-- BOTONS PRINCIPALS DE LA CAPÇALERA -->
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button onclick="window.executarSimulacreARA()" style="background:#16a34a; color:#ffffff; border:none; padding:10px 16px; border-radius:9px; font-weight:800; font-size:13px; cursor:pointer; display:flex; align-items:center; gap:6px; box-shadow:0 3px 10px rgba(22,163,74,0.25);">
              <span>⏱️</span> Fer Simulacre ARA
            </button>
            <button id="btn-integrar-tot-banc" onclick="window.integrarExamenAlBancPermanent()" style="background:#002B5E; color:#ffffff; border:none; padding:10px 16px; border-radius:9px; font-weight:800; font-size:13px; cursor:pointer; display:flex; align-items:center; gap:6px;">
              <span>💾</span> Integrar al Banc Permanent
            </button>
          </div>
        </div>

        <!-- TARGETES DE RESUM DE CLASSIFICACIÓ -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(170px, 1fr)); gap:10px; margin-bottom:16px;">
          <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:12px; text-align:center;">
            <div style="font-size:22px; font-weight:900; color:#166534;">${coincidencies}</div>
            <div style="font-size:11.5px; font-weight:700; color:#166534;">🟢 Temari Troncal Oficial</div>
          </div>
          <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:10px; padding:12px; text-align:center;">
            <div style="font-size:22px; font-weight:900; color:#b45309;">${municipals}</div>
            <div style="font-size:11.5px; font-weight:700; color:#b45309;">🟠 Específiques Municipals</div>
          </div>
          <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:10px; padding:12px; text-align:center;">
            <div style="font-size:22px; font-weight:900; color:#1d4ed8;">${reserves}</div>
            <div style="font-size:11.5px; font-weight:700; color:#1d4ed8;">⚠️ Reserva o Anul·lades</div>
          </div>
          <div style="background:var(--bg-card-subtle, #f8fafc); border:1px solid var(--border-card, #e2e8f0); border-radius:10px; padding:12px; text-align:center;">
            <div style="font-size:22px; font-weight:900; color:var(--text-main, #0f172a);">${total}</div>
            <div style="font-size:11.5px; font-weight:700; color:var(--text-muted, #64748b);">Total Detectades</div>
          </div>
        </div>

        <!-- FILTRES PER VISUALITZAR -->
        <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:14px; border-bottom:1px solid var(--border-card, #e2e8f0); padding-bottom:10px;">
          <button class="btn-filtre-triage ${filtreTriageActiu === 'totes' ? 'actiu' : ''}" onclick="window.canviarFiltreTriage('totes')" style="padding:5px 12px; border-radius:6px; font-size:12px; font-weight:700; border:1px solid var(--border-card, #cbd5e1); background:${filtreTriageActiu === 'totes' ? '#002B5E' : 'transparent'}; color:${filtreTriageActiu === 'totes' ? '#ffffff' : 'inherit'}; cursor:pointer;">
            Totes (${total})
          </button>
          <button class="btn-filtre-triage ${filtreTriageActiu === 'troncal' ? 'actiu' : ''}" onclick="window.canviarFiltreTriage('troncal')" style="padding:5px 12px; border-radius:6px; font-size:12px; font-weight:700; border:1px solid #bbf7d0; background:${filtreTriageActiu === 'troncal' ? '#16a34a' : '#f0fdf4'}; color:${filtreTriageActiu === 'troncal' ? '#ffffff' : '#166534'}; cursor:pointer;">
            🟢 Temari Troncal (${coincidencies})
          </button>
          <button class="btn-filtre-triage ${filtreTriageActiu === 'municipal' ? 'actiu' : ''}" onclick="window.canviarFiltreTriage('municipal')" style="padding:5px 12px; border-radius:6px; font-size:12px; font-weight:700; border:1px solid #fde68a; background:${filtreTriageActiu === 'municipal' ? '#d97706' : '#fffbeb'}; color:${filtreTriageActiu === 'municipal' ? '#ffffff' : '#b45309'}; cursor:pointer;">
            🟠 Específiques Municipals (${municipals})
          </button>
          <button class="btn-filtre-triage ${filtreTriageActiu === 'reserves' ? 'actiu' : ''}" onclick="window.canviarFiltreTriage('reserves')" style="padding:5px 12px; border-radius:6px; font-size:12px; font-weight:700; border:1px solid #bfdbfe; background:${filtreTriageActiu === 'reserves' ? '#2563eb' : '#eff6ff'}; color:${filtreTriageActiu === 'reserves' ? '#ffffff' : '#1d4ed8'}; cursor:pointer;">
            ⚠️ Reserves / Anul·lades (${reserves})
          </button>
        </div>

        <!-- LLISTA DE PREGUNTES INTERACTIVES -->
        <div id="llista-preguntes-triage" style="display:flex; flex-direction:column; gap:16px; max-height:650px; overflow-y:auto; padding-right:6px;">
          ${renderitzarLlistaPreguntesTriage(examen)}
        </div>

      </div>
    `;
  }

  function renderitzarLlistaPreguntesTriage(examen) {
    const preguntes = examen.preguntes || [];
    const lletres = ['A', 'B', 'C', 'D'];

    const filtrades = preguntes.filter(q => {
      if (filtreTriageActiu === 'troncal') return q.coincideixTemari && !q.descartada;
      if (filtreTriageActiu === 'municipal') return !q.coincideixTemari && !q.descartada;
      if (filtreTriageActiu === 'reserves') return q.esReserva || q.esAnullada;
      return true;
    });

    if (filtrades.length === 0) {
      return `<div style="text-align:center; padding:20px; color:var(--text-muted, #64748b);">No hi ha preguntes en aquesta categoria.</div>`;
    }

    return filtrades.map((q, idx) => {
      const qIdxReal = preguntes.findIndex(item => item.id === q.id);
      const correctaLletra = lletres[q.resposta] || 'A';

      return `
        <div style="background:var(--bg-card-subtle, #f8fafc); border:${q.descartada ? '1px dashed #ef4444' : '1.5px solid var(--border-card, #e2e8f0)'}; border-radius:12px; padding:16px; opacity:${q.descartada ? '0.6' : '1'}; transition:all 0.2s;">
          
          <!-- Capçalera de Pregunta -->
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
              <span style="font-weight:900; font-size:13.5px; color:#002B5E;">
                #${q.numeroOriginal || (idx + 1)}.
              </span>

              ${q.esAnullada ? `
                <span style="background:#fee2e2; color:#b91c1c; font-size:11px; font-weight:800; padding:2px 7px; border-radius:4px;">
                  🚫 Anul·lada pel tribunal
                </span>
              ` : ''}

              ${q.esReserva ? `
                <span style="background:#eff6ff; color:#1d4ed8; font-size:11px; font-weight:800; padding:2px 7px; border-radius:4px;">
                  📌 Pregunta de Reserva
                </span>
              ` : ''}

              <span style="background:${q.coincideixTemari ? '#dcfce7' : '#fef3c7'}; color:${q.coincideixTemari ? '#15803d' : '#b45309'}; font-size:11px; font-weight:800; padding:2px 7px; border-radius:4px;">
                ${q.coincideixTemari ? '🟢 Troncal' : '🟠 Municipal / Annex'}
              </span>
            </div>

            <!-- Botó per descartar o activar la pregunta -->
            <button onclick="window.alternarDescartadaPreguntaTriage(${qIdxReal})" style="background:${q.descartada ? '#10b981' : '#fee2e2'}; color:${q.descartada ? '#fff' : '#b91c1c'}; border:none; padding:4px 10px; border-radius:6px; font-size:11.5px; font-weight:700; cursor:pointer;">
              ${q.descartada ? '↩️ Restaurar' : '🗑️ Descartar'}
            </button>
          </div>

          <!-- Enunciat -->
          <div style="font-weight:750; font-size:13.5px; color:var(--text-main, #0f172a); margin-bottom:10px; line-height:1.45;">
            ${escapeHtml(q.pregunta)}
          </div>

          <!-- Opcions -->
          <div style="display:flex; flex-direction:column; gap:6px; margin-bottom:12px;">
            ${(q.opcions || []).map((op, opIdx) => {
              const esCorrecta = (opIdx === q.resposta);
              return `
                <div style="display:flex; align-items:center; gap:8px; padding:7px 10px; border-radius:8px; font-size:12.5px; ${esCorrecta ? 'background:#dcfce7; border:1px solid #86efac; color:#14532d; font-weight:700;' : 'background:var(--bg-card, #ffffff); border:1px solid var(--border-card, #e2e8f0); color:var(--text-main, #0f172a);'}">
                  <span style="font-weight:800; width:18px;">${lletres[opIdx]})</span>
                  <span style="flex:1;">${escapeHtml(op)}</span>
                  ${esCorrecta ? '<span style="font-size:11px; font-weight:800; background:#16a34a; color:#fff; padding:1px 6px; border-radius:4px;">CORRECTA</span>' : ''}
                </div>
              `;
            }).join('')}
          </div>

          <!-- Justificació Jurídica IA -->
          <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:9px 12px; margin-bottom:12px; font-size:12px; color:#14532d; line-height:1.4;">
            <div style="font-weight:800; margin-bottom:2px; display:flex; align-items:center; gap:5px;">
              <span>⚖️</span> Justificació Legal Vigent (Gemini IA):
            </div>
            <div>${escapeHtml(q.justificacioLegal || q.explicacio || 'Resposta oficial contrastada.')}</div>
            ${q.articleLlei ? `
              <div style="margin-top:3px; font-size:11px; color:#166534; font-weight:700;">
                📖 Cita exacta: ${escapeHtml(q.articleLlei)}
              </div>
            ` : ''}
          </div>

          <!-- BARRA DE CLASSIFICACIÓ I DESTÍ -->
          <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; background:var(--bg-card, #ffffff); padding:8px 12px; border-radius:8px; border:1px solid var(--border-card, #cbd5e1);">
            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; flex:1;">
              <span style="font-size:11.5px; font-weight:700; color:var(--text-muted, #64748b);">Classificar a:</span>
              
              <select onchange="window.reclassificarPreguntaTriage(${qIdxReal}, this.value)" style="padding:5px 8px; border-radius:6px; border:1px solid var(--border-card, #cbd5e1); font-size:12px; background:var(--bg-card, #ffffff); color:var(--text-main, #0f172a); max-width:280px;">
                <optgroup label="Temari Troncal">
                  <option value="${escapeHtml(q.tema || 'Tema 21')}" selected>${escapeHtml(q.tema || 'Temari Troncal')}</option>
                  <option value="Tema 1: Constitució Espanyola">Tema 1: Constitució Espanyola</option>
                  <option value="Tema 2: Drets i Deures">Tema 2: Drets i Deures</option>
                  <option value="Tema 3: Estatut d'Autonomia">Tema 3: Estatut d'Autonomia</option>
                  <option value="Tema 4: Municipi i Administració Local">Tema 4: Municipi i Administració Local</option>
                  <option value="Tema 17: Llei 16/1991 Policies Locals">Tema 17: Llei 16/1991 Policies Locals</option>
                  <option value="Tema 18: LO 4/2015 Seguretat Ciutadana">Tema 18: LO 4/2015 Seguretat Ciutadana</option>
                  <option value="Tema 20: LO 2/1986 Forces i Cossos">Tema 20: LO 2/1986 Forces i Cossos</option>
                  <option value="Tema 21: Codi Penal">Tema 21: Codi Penal</option>
                  <option value="Tema 23: Seguretat Viària i Trànsit">Tema 23: Seguretat Viària i Trànsit</option>
                  <option value="Tema 27: Llei 4/2003 Seguretat Pública">Tema 27: Llei 4/2003 Seguretat Pública</option>
                </optgroup>
                <optgroup label="Ordenances Pujades">
                  ${documentsCache.map(doc => `<option value="Ordenança: ${escapeHtml(doc.titol)}">📄 Ordenança: ${escapeHtml(doc.titol)}</option>`).join('')}
                </optgroup>
                <optgroup label="Temes Annexos Personals">
                  ${temesAnnexosCache.map(t => `<option value="Tema Annex: ${escapeHtml(t.nom)}">📑 Tema Annex: ${escapeHtml(t.nom)}</option>`).join('')}
                </optgroup>
                <optgroup label="Específic Municipal">
                  <option value="Examen Oficial Municipal: ${escapeHtml(examen.municipi)}">🏛️ Específic Municipal (${escapeHtml(examen.municipi)})</option>
                </optgroup>
              </select>
            </div>

            <!-- Botó ràpid per crear Tema Annex al moment -->
            <button onclick="window.obrirCrearTemaAnnexPerPregunta(${qIdxReal})" style="background:#0284c7; color:#fff; border:none; padding:5px 10px; border-radius:6px; font-size:11.5px; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:4px;">
              <span>➕</span> Nou Tema Annex
            </button>
          </div>

        </div>
      `;
    }).join('');
  }

  window.canviarFiltreTriage = function (nouFiltre) {
    filtreTriageActiu = nouFiltre;
    const host = document.getElementById('host-triage-examen');
    if (host && examenAnalitzatActual) {
      renderitzarTriageExamen(host, examenAnalitzatActual);
    }
  };

  window.alternarDescartadaPreguntaTriage = function (idx) {
    if (!examenAnalitzatActual || !examenAnalitzatActual.preguntes[idx]) return;
    examenAnalitzatActual.preguntes[idx].descartada = !examenAnalitzatActual.preguntes[idx].descartada;
    const host = document.getElementById('host-triage-examen');
    if (host) renderitzarTriageExamen(host, examenAnalitzatActual);
  };

  window.reclassificarPreguntaTriage = function (idx, nouTema) {
    if (!examenAnalitzatActual || !examenAnalitzatActual.preguntes[idx]) return;
    examenAnalitzatActual.preguntes[idx].tema = nouTema;
    if (nouTema.startsWith('Tema Annex:') || nouTema.startsWith('Ordenança:') || nouTema.startsWith('Examen Oficial')) {
      examenAnalitzatActual.preguntes[idx].coincideixTemari = false;
    } else {
      examenAnalitzatActual.preguntes[idx].coincideixTemari = true;
    }
    const host = document.getElementById('host-triage-examen');
    if (host) renderitzarTriageExamen(host, examenAnalitzatActual);
  };

  window.obrirCrearTemaAnnexPerPregunta = async function (idx) {
    const nom = prompt('Introdueix el nom del nou Tema Annex per a aquesta i futures preguntes municipals:\n(Ex: "Carrerers i Guia Urbana de Cunit", "Ordenança de Circulació de Badalona", etc.)');
    if (!nom || !nom.trim()) return;

    const nouTema = await guardarTemaAnnex({
      id: 'tema_annex_' + Date.now(),
      nom: nom.trim(),
      descripcio: `Tema annex creat des de l'examen oficial de ${examenAnalitzatActual?.municipi || 'Policia Local'}`,
      municipi: examenAnalitzatActual?.municipi || 'Cunit',
      cos: examenAnalitzatActual?.cos || 'pl',
      dataCreacio: new Date().toISOString()
    });

    if (nouTema && examenAnalitzatActual && examenAnalitzatActual.preguntes[idx]) {
      examenAnalitzatActual.preguntes[idx].tema = `Tema Annex: ${nouTema.nom}`;
      examenAnalitzatActual.preguntes[idx].coincideixTemari = false;
      if (window.mostrarToast) window.mostrarToast(`✅ Creat Tema Annex: "${nouTema.nom}"`, 'success');
      const host = document.getElementById('host-triage-examen');
      if (host) renderitzarTriageExamen(host, examenAnalitzatActual);
    }
  };

  // Iniciar Simulacre Oficial de l'examen actual
  window.executarSimulacreARA = function () {
    if (!examenAnalitzatActual || !Array.isArray(examenAnalitzatActual.preguntes)) return;
    const valides = examenAnalitzatActual.preguntes.filter(q => !q.descartada);
    if (valides.length === 0) {
      alert('Totes les preguntes estan marcades com a descartades.');
      return;
    }

    // Afegir al banc local en memòria
    if (!window.bancoPoliciaLocal) window.bancoPoliciaLocal = [];
    valides.forEach(q => {
      const exist = window.bancoPoliciaLocal.findIndex(p => p.id === q.id);
      if (exist === -1) window.bancoPoliciaLocal.push(q);
    });

    if (typeof window.iniciarExamen === 'function') {
      window.iniciarExamen(valides.length, false, [...valides]);
    } else {
      alert('S\'han carregat les preguntes. Pots començar el test des de la pestanya de Policia Local.');
    }
  };

  // Integrar al Banc Permanent (servidor, examens_oficials.json, localStorage i Firestore)
  window.integrarExamenAlBancPermanent = async function () {
    if (!examenAnalitzatActual || !Array.isArray(examenAnalitzatActual.preguntes)) return;

    const btn = document.getElementById('btn-integrar-tot-banc');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ Desant al banc permanent...';
    }

    const valides = examenAnalitzatActual.preguntes.filter(q => !q.descartada);

    try {
      // 1. Desar l'examen com a entitat oficial
      await guardarExamenOficial({
        ...examenAnalitzatActual,
        preguntes: valides,
        dataActualitzacio: new Date().toISOString()
      });

      // 2. Desar les preguntes al fitxer del banc de preguntes
      await fetch('/api/modificar-preguntes-fitxer-lot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          banc: examenAnalitzatActual.cos || 'pl',
          preguntes: valides
        })
      });

      // 3. Afegir-les a bancoPoliciaLocal en memòria
      if (!window.bancoPoliciaLocal) window.bancoPoliciaLocal = [];
      valides.forEach(q => {
        const exist = window.bancoPoliciaLocal.findIndex(p => p.id === q.id);
        if (exist === -1) window.bancoPoliciaLocal.push(q);
        else window.bancoPoliciaLocal[exist] = q;
      });

      // 4. Sincronitzar amb el núvol (Firebase)
      if (window.pujarDadesANucolManual) window.pujarDadesANucolManual();

      if (window.mostrarToast) {
        window.mostrarToast(`✅ ${valides.length} preguntes integrades i sincronitzades al teu compte!`, 'success');
      } else {
        alert(`✅ S'han desat i sincronitzat ${valides.length} preguntes oficials amb èxit!`);
      }

      // Refrescar la vista
      renderitzarSubvista();
    } catch (err) {
      alert('Error en desar al banc permanent: ' + err.message);
      if (btn) {
        btn.disabled = false;
        btn.textContent = '💾 Integrar al Banc Permanent';
      }
    }
  };

  // Carregar examen des de la llista per revisar
  window.carregarExamenPerRevisar = function (id) {
    const ex = examensCache.find(item => item.id === id);
    if (!ex) return;
    examenAnalitzatActual = ex;
    const host = document.getElementById('host-triage-examen');
    if (host) {
      renderitzarTriageExamen(host, examenAnalitzatActual);
      host.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Iniciar simulacre d'un examen de la llista
  window.iniciarSimulacreExamenGuardat = function (id) {
    const ex = examensCache.find(item => item.id === id);
    if (!ex || !Array.isArray(ex.preguntes) || ex.preguntes.length === 0) {
      alert('Aquest examen no té preguntes disponibles.');
      return;
    }
    const valides = ex.preguntes.filter(q => !q.descartada);
    if (typeof window.iniciarExamen === 'function') {
      window.iniciarExamen(valides.length, false, [...valides]);
    }
  };

  // Eliminar examen oficial
  window.eliminarExamenOficialUI = async function (id) {
    if (!confirm('Segur que vols eliminar aquest examen oficial de la teva col·lecció?')) return;
    await eliminarExamenOficial(id);
    if (window.mostrarToast) window.mostrarToast('Examen eliminat amb èxit', 'info');
    renderitzarSubvista();
  };

  // ==========================================================================
  // PESTANYA 3: GESTIÓ DE TEMES ANNEXOS (PERSONALITZATS I MUNICIPALS)
  // ==========================================================================
  function renderitzarTemesAnnexos(host) {
    host.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:20px;">
        
        <!-- HEADER AMB EXPLICACIÓ -->
        <div style="background:var(--bg-card, #ffffff); border:1px solid var(--border-card, #e2e8f0); border-radius:14px; padding:18px 20px; box-shadow:0 2px 10px rgba(0,0,0,0.03);">
          <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
            <div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:22px;">📑</span>
                <h2 style="margin:0; font-size:17px; font-weight:800; color:var(--text-main, #0f172a);">
                  Temes Annexos Personalitzats
                </h2>
              </div>
              <p style="margin:4px 0 0; font-size:12.5px; color:var(--text-muted, #64748b); max-width:720px; line-height:1.45;">
                Crea temes a mida per a les matèries específiques del teu municipi: carrerers, patrimoni local, història o ordenances específiques. Pots practicar-los com qualsevol altre tema i es guarden al núvol amb el teu compte.
              </p>
            </div>
            <button onclick="window.alternarFormulariNouTemaAnnex()" style="background:#002B5E; color:#fff; border:none; padding:9px 16px; border-radius:8px; font-weight:700; font-size:12.5px; cursor:pointer; display:flex; align-items:center; gap:6px;">
              <span>➕</span> Nou Tema Annex
            </button>
          </div>
        </div>

        <!-- FORMULARI PER CREAR NOU TEMA ANNEX (OCULTABLE) -->
        <div id="card-nou-tema-annex" style="display:none; background:var(--bg-card, #ffffff); border:1.5px solid #002B5E; border-radius:14px; padding:20px; box-shadow:0 4px 16px rgba(0,43,94,0.08);">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:14px;">
            <div style="font-weight:800; font-size:15px; color:#002B5E;">➕ Crear Nou Tema Annex</div>
            <button onclick="window.alternarFormulariNouTemaAnnex()" style="background:none; border:none; font-size:16px; cursor:pointer; color:var(--text-muted, #64748b);">✕</button>
          </div>
          <form onsubmit="window.desarNouTemaAnnexUI(event)" style="display:flex; flex-direction:column; gap:12px;">
            <div>
              <label style="display:block; font-size:12px; font-weight:700; margin-bottom:4px; color:var(--text-muted, #64748b);">Nom del Tema Annex:</label>
              <input type="text" id="input-nou-tema-nom" required placeholder="Ex: Carrerer i Edificis Municipals de Cunit" style="width:100%; box-sizing:border-box; padding:9px 12px; border:1px solid var(--border-card, #cbd5e1); border-radius:8px; font-size:13px; background:var(--bg-card, #ffffff); color:var(--text-main, #0f172a);">
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
              <div>
                <label style="display:block; font-size:12px; font-weight:700; margin-bottom:4px; color:var(--text-muted, #64748b);">Municipi:</label>
                <input type="text" id="input-nou-tema-municipi" placeholder="Ex: Cunit" value="Cunit" style="width:100%; box-sizing:border-box; padding:9px 12px; border:1px solid var(--border-card, #cbd5e1); border-radius:8px; font-size:13px; background:var(--bg-card, #ffffff); color:var(--text-main, #0f172a);">
              </div>
              <div>
                <label style="display:block; font-size:12px; font-weight:700; margin-bottom:4px; color:var(--text-muted, #64748b);">Cos Policial:</label>
                <select id="input-nou-tema-cos" style="width:100%; box-sizing:border-box; padding:9px 12px; border:1px solid var(--border-card, #cbd5e1); border-radius:8px; font-size:13px; background:var(--bg-card, #ffffff); color:var(--text-main, #0f172a);">
                  <option value="pl">🚔 Policia Local</option>
                  <option value="mossos">🔵 Mossos d'Esquadra</option>
                </select>
              </div>
            </div>
            <div>
              <label style="display:block; font-size:12px; font-weight:700; margin-bottom:4px; color:var(--text-muted, #64748b);">Descripció (opcional):</label>
              <textarea id="input-nou-tema-desc" rows="2" placeholder="Ex: Temari específic sobre el municipi de Cunit, vies d'accés, monuments..." style="width:100%; box-sizing:border-box; padding:8px 12px; border:1px solid var(--border-card, #cbd5e1); border-radius:8px; font-size:12px; background:var(--bg-card, #ffffff); color:var(--text-main, #0f172a); resize:vertical;"></textarea>
            </div>
            <button type="submit" style="background:#002B5E; color:#fff; border:none; padding:10px 16px; border-radius:8px; font-weight:800; font-size:13px; cursor:pointer; align-self:flex-start;">
              💾 Desar Tema Annex
            </button>
          </form>
        </div>

        <!-- LLISTAT DE TEMES ANNEXOS EXISTENTS -->
        <div style="background:var(--bg-card, #ffffff); border:1px solid var(--border-card, #e2e8f0); border-radius:14px; padding:20px; box-shadow:0 2px 10px rgba(0,0,0,0.03);">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:14px;">
            <span style="font-size:20px;">🗂️</span>
            <h3 style="margin:0; font-size:15px; font-weight:800; color:var(--text-main, #0f172a);">
              Temes Annexos Creats (${temesAnnexosCache.length})
            </h3>
          </div>

          ${temesAnnexosCache.length === 0 ? `
            <div style="text-align:center; padding:30px 16px; background:var(--bg-card-subtle, #f8fafc); border-radius:12px; color:var(--text-muted, #64748b);">
              <div style="font-size:32px; margin-bottom:8px;">📁</div>
              <div style="font-weight:700; font-size:13.5px;">No hi ha cap Tema Annex creat encara</div>
              <div style="font-size:12px; margin-top:4px;">Clica a "Nou Tema Annex" o puja un examen oficial per assignar preguntes municipals!</div>
            </div>
          ` : `
            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(290px, 1fr)); gap:14px;">
              ${temesAnnexosCache.map(tema => {
                const banc = window.bancoPoliciaLocal || [];
                const preguntesDelTema = banc.filter(q => {
                  const t = (q.tema || '') + ' ' + (q.seccio || '');
                  return t.toLowerCase().includes(tema.nom.toLowerCase());
                });

                return `
                  <div style="background:var(--bg-card-subtle, #f8fafc); border:1px solid var(--border-card, #e2e8f0); border-radius:12px; padding:16px; display:flex; flex-direction:column; justify-content:space-between; gap:12px;">
                    <div>
                      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; margin-bottom:6px;">
                        <span style="font-weight:800; font-size:14px; color:var(--text-main, #0f172a); line-height:1.35;">
                          ${escapeHtml(tema.nom)}
                        </span>
                        <span style="background:#002B5E; color:#fff; font-size:10px; font-weight:800; padding:2px 7px; border-radius:9999px; text-transform:uppercase;">
                          ${escapeHtml(tema.cos || 'PL')}
                        </span>
                      </div>
                      ${tema.descripcio ? `
                        <p style="margin:0 0 8px 0; font-size:12px; color:var(--text-muted, #64748b); line-height:1.4;">
                          ${escapeHtml(tema.descripcio)}
                        </p>
                      ` : ''}
                      <div style="font-size:11.5px; color:var(--text-muted, #64748b);">
                        🏛️ Municipi: <b>${escapeHtml(tema.municipi || 'General')}</b> • ❓ <b>${preguntesDelTema.length}</b> preguntes
                      </div>
                    </div>

                    <div style="display:flex; gap:6px; flex-wrap:wrap; border-top:1px solid var(--border-card, #e2e8f0); padding-top:10px;">
                      <button onclick="window.ferTestTemaAnnex('${escapeHtml(tema.nom)}')" style="flex:1; background:#16a34a; color:#fff; border:none; padding:7px 10px; border-radius:7px; font-size:12px; font-weight:800; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:5px;">
                        <span>📝</span> Fer Test (${preguntesDelTema.length})
                      </button>
                      <button onclick="window.eliminarTemaAnnexUI('${tema.id}')" style="background:#fee2e2; color:#b91c1c; border:none; padding:7px 10px; border-radius:7px; font-size:12px; font-weight:700; cursor:pointer;" title="Eliminar tema annex">
                        <span>🗑️</span>
                      </button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>

      </div>
    `;
  }

  window.alternarFormulariNouTemaAnnex = function () {
    const card = document.getElementById('card-nou-tema-annex');
    if (!card) return;
    card.style.display = (card.style.display === 'none' || card.style.display === '') ? 'block' : 'none';
  };

  window.desarNouTemaAnnexUI = async function (e) {
    if (e && e.preventDefault) e.preventDefault();
    const nom = document.getElementById('input-nou-tema-nom')?.value?.trim();
    const municipi = document.getElementById('input-nou-tema-municipi')?.value?.trim() || 'Cunit';
    const cos = document.getElementById('input-nou-tema-cos')?.value || 'pl';
    const desc = document.getElementById('input-nou-tema-desc')?.value?.trim() || '';

    if (!nom) return;

    await guardarTemaAnnex({
      id: 'tema_annex_' + Date.now(),
      nom,
      municipi,
      cos,
      descripcio: desc,
      dataCreacio: new Date().toISOString()
    });

    if (window.mostrarToast) window.mostrarToast(`✅ Creat Tema Annex: "${nom}"`, 'success');
    renderitzarSubvista();
  };

  window.ferTestTemaAnnex = function (nomTema) {
    const banc = window.bancoPoliciaLocal || [];
    const preguntes = banc.filter(q => {
      const t = (q.tema || '') + ' ' + (q.seccio || '');
      return t.toLowerCase().includes(nomTema.toLowerCase());
    });

    if (preguntes.length === 0) {
      alert(`Encara no hi ha preguntes associades al tema "${nomTema}". Puja un examen oficial i assigna-li preguntes!`);
      return;
    }

    if (typeof window.iniciarExamen === 'function') {
      window.iniciarExamen(preguntes.length, false, [...preguntes]);
    }
  };

  window.eliminarTemaAnnexUI = async function (id) {
    if (!confirm('Segur que vols eliminar aquest tema annex?')) return;
    await eliminarTemaAnnex(id);
    if (window.mostrarToast) window.mostrarToast('Tema annex eliminat', 'info');
    renderitzarSubvista();
  };

  // Funció auxiliar per obrir el Tutor IA des de qualsevol pregunta de test
  window.obrirTutorAmbPregunta = function (preguntaObj, triadaIdx) {
    if (!preguntaObj) return;

    // Canviar a la pestanya del tutor
    const tabBtn = document.querySelector('[data-tab="tutor-ia"]');
    if (tabBtn) tabBtn.click();

    pestanyaActiva = 'xat';

    // Construir la consulta inicial
    const lletres = ['A', 'B', 'C', 'D'];
    const correcta = lletres[preguntaObj.resposta] || '';
    const triada = (typeof triadaIdx === 'number' && triadaIdx >= 0) ? lletres[triadaIdx] : null;

    let textPrompt = `Vull que m'expliquis detalladament la següent pregunta oficial:\n"${preguntaObj.pregunta}"\n`;
    if (Array.isArray(preguntaObj.opcions)) {
      textPrompt += preguntaObj.opcions.map((op, i) => `${lletres[i]}) ${op}`).join('\n') + '\n';
    }
    textPrompt += `La resposta oficial correcta és la ${correcta}. `;
    if (triada) {
      textPrompt += `Jo he triat la ${triada}. Per què és incorrecta i quina és la cita legal exacta vigent?`;
    } else {
      textPrompt += `Quina és la cita legal exacta vigent i la regla mnemotècnica per no fallar-la a l'examen?`;
    }

    setTimeout(() => {
      const input = document.getElementById('tutor-input-msg');
      if (input) {
        input.value = textPrompt;
        window.enviarMissatgeTutor();
      }
    }, 300);
  };

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Sincronització automàtica quan s'actualitzin dades al núvol o a una altra pestanya
  window.addEventListener('agentmedina:sync_complete', () => {
    carregarSessions();
    const s = sessionsCache.find(x => x.id === sessioActivaId) || sessionsCache[0];
    if (s) {
      historialXat = s.missatges || [];
    }
    renderitzarSubvista();
  });

  window.addEventListener('storage', (e) => {
    if (e.key && (e.key === 'agentmedina_chat_sessions' || e.key.startsWith('agentmedina_chat_sessions_'))) {
      carregarSessions();
      const s = sessionsCache.find(x => x.id === sessioActivaId) || sessionsCache[0];
      if (s) {
        historialXat = s.missatges || [];
      }
      renderitzarSubvista();
    }
  });

  // Inicialització quan canviï de pestanya a 'tutor-ia'
  document.addEventListener('DOMContentLoaded', () => {
    // Si la vista inicial o la pestanya clicada és tutor-ia
    document.querySelectorAll('[data-tab="tutor-ia"]').forEach(el => {
      el.addEventListener('click', () => {
        window.renderitzarVistaTutorIA();
      });
    });
  });

})();

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

    container.innerHTML = `
      <div class="tutor-container">
        
        <!-- HEADER DE LA SECCIÓ (ADAPTATIU MÒBIL I HORITZONTAL) -->
        <div class="tutor-header-card">
          <div style="flex: 1; min-width: 240px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <span style="font-size: 24px;">🧠</span>
              <h1 class="tutor-header-title" style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.02em;">Agent Medina Tutor & Exàmens Reals</h1>
              <span style="background: #10b981; color: white; font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 9999px; text-transform: uppercase;">Actiu</span>
            </div>
            <p class="tutor-header-desc" style="margin: 0; font-size: 13px; opacity: 0.88; max-width: 680px; line-height: 1.4;">
              El teu preparador d'oposicions. Puja <b>exàmens reals en PDF/Word</b> i la IA els classificarà amb justificació jurídica, crea <b>temes annexos</b> a mida, puja les teves <b>ordenances</b> i sincronitza-ho tot amb el teu compte.
            </p>
          </div>
          
          <!-- Botons de Pestanya Superior -->
          <div style="display: flex; gap: 6px; flex-wrap: wrap; background: rgba(255,255,255,0.12); padding: 4px; border-radius: 10px;">
            <button id="tab-btn-xat" class="tutor-nav-btn ${pestanyaActiva === 'xat' ? 'active' : ''}" onclick="window.canviarPestanyaTutor('xat')" style="border:none; padding:7px 12px; border-radius:8px; font-weight:700; font-size:12px; cursor:pointer; display:flex; align-items:center; gap:5px; background:${pestanyaActiva === 'xat' ? '#ffffff' : 'transparent'}; color:${pestanyaActiva === 'xat' ? '#002B5E' : '#ffffff'}; transition: all 0.2s;">
              <span>💬</span> Xat Tutor
            </button>
            <button id="tab-btn-examens" class="tutor-nav-btn ${pestanyaActiva === 'examens' ? 'active' : ''}" onclick="window.canviarPestanyaTutor('examens')" style="border:none; padding:7px 12px; border-radius:8px; font-weight:700; font-size:12px; cursor:pointer; display:flex; align-items:center; gap:5px; background:${pestanyaActiva === 'examens' ? '#ffffff' : 'transparent'}; color:${pestanyaActiva === 'examens' ? '#002B5E' : '#ffffff'}; transition: all 0.2s;">
              <span>🏛️</span> Exàmens PDF (${examensCache.length})
            </button>
            <button id="tab-btn-temes_annexos" class="tutor-nav-btn ${pestanyaActiva === 'temes_annexos' ? 'active' : ''}" onclick="window.canviarPestanyaTutor('temes_annexos')" style="border:none; padding:7px 12px; border-radius:8px; font-weight:700; font-size:12px; cursor:pointer; display:flex; align-items:center; gap:5px; background:${pestanyaActiva === 'temes_annexos' ? '#ffffff' : 'transparent'}; color:${pestanyaActiva === 'temes_annexos' ? '#002B5E' : '#ffffff'}; transition: all 0.2s;">
              <span>📑</span> Temes Annexos (${temesAnnexosCache.length})
            </button>
            <button id="tab-btn-ordenances" class="tutor-nav-btn ${pestanyaActiva === 'ordenances' ? 'active' : ''}" onclick="window.canviarPestanyaTutor('ordenances')" style="border:none; padding:7px 12px; border-radius:8px; font-weight:700; font-size:12px; cursor:pointer; display:flex; align-items:center; gap:5px; background:${pestanyaActiva === 'ordenances' ? '#ffffff' : 'transparent'}; color:${pestanyaActiva === 'ordenances' ? '#002B5E' : '#ffffff'}; transition: all 0.2s;">
              <span>📂</span> Ordenances (${documentsCache.length})
            </button>
            <button id="tab-btn-generador" class="tutor-nav-btn ${pestanyaActiva === 'generador' ? 'active' : ''}" onclick="window.canviarPestanyaTutor('generador')" style="border:none; padding:7px 12px; border-radius:8px; font-weight:700; font-size:12px; cursor:pointer; display:flex; align-items:center; gap:5px; background:${pestanyaActiva === 'generador' ? '#ffffff' : 'transparent'}; color:${pestanyaActiva === 'generador' ? '#002B5E' : '#ffffff'}; transition: all 0.2s;">
              <span>⚡</span> Generar Tests
            </button>
          </div>
        </div>

        <!-- CONTINGUT DINÀMIC DE PESTANYA -->
        <div id="tutor-subview-content"></div>
      </div>
    `;

    renderitzarSubvista();
  };

  window.canviarPestanyaTutor = function (pestanya) {
    pestanyaActiva = pestanya;
    document.querySelectorAll('.tutor-nav-btn').forEach(btn => {
      btn.style.background = 'transparent';
      btn.style.color = '#ffffff';
    });
    const actiu = document.getElementById(`tab-btn-${pestanya}`);
    if (actiu) {
      actiu.style.background = '#ffffff';
      actiu.style.color = '#002B5E';
    }
    renderitzarSubvista();
  };

  function renderitzarSubvista() {
    const host = document.getElementById('tutor-subview-content');
    if (!host) return;

    if (pestanyaActiva === 'xat') {
      renderitzarXat(host);
    } else if (pestanyaActiva === 'examens') {
      renderitzarExamensOficials(host);
    } else if (pestanyaActiva === 'temes_annexos') {
      renderitzarTemesAnnexos(host);
    } else if (pestanyaActiva === 'ordenances') {
      renderitzarOrdenances(host);
    } else if (pestanyaActiva === 'generador') {
      renderitzarGenerador(host);
    }
  }

  // ==========================================================================
  // PESTANYA 1: XAT AMB EL TUTOR IA
  // ==========================================================================
  function renderitzarXat(host) {
    const docActiu = documentsCache.find(d => d.id === documentActiuId);

    host.innerHTML = `
      <div class="tutor-chat-card">
        
        <!-- BARRA DE CONTROL DEL XAT -->
        <div style="padding: 10px 16px; border-bottom: 1.5px solid var(--border-card, #e2e8f0); background: var(--bg-card-subtle, #f8fafc); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
          
          <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
            <!-- Selector de Cos -->
            <div style="display: flex; align-items: center; gap: 5px;">
              <span style="font-size: 11.5px; font-weight: 700; color: var(--text-muted, #64748b);">Cos:</span>
              <select id="tutor-sel-cos" onchange="window.canviarCosTutor(this.value)" style="background: var(--bg-card, #ffffff); border: 1px solid var(--border-card, #cbd5e1); padding: 4px 8px; border-radius: 8px; font-size: 12px; font-weight: 600; color: var(--text-main, #0f172a); cursor: pointer;">
                <option value="pl" ${cosActiu === 'pl' ? 'selected' : ''}>🚔 Policia Local</option>
                <option value="mossos" ${cosActiu === 'mossos' ? 'selected' : ''}>👮 Mossos d'Esquadra</option>
                <option value="tots" ${cosActiu === 'tots' ? 'selected' : ''}>⚖️ Ambdós Cossos</option>
              </select>
            </div>

            <!-- Selector de Document / Ordenança de Context -->
            <div style="display: flex; align-items: center; gap: 5px;">
              <span style="font-size: 11.5px; font-weight: 700; color: var(--text-muted, #64748b);">Context:</span>
              <select id="tutor-sel-doc" onchange="window.canviarDocumentActiu(this.value)" style="background: var(--bg-card, #ffffff); border: 1px solid var(--border-card, #cbd5e1); padding: 4px 8px; border-radius: 8px; font-size: 12px; font-weight: 600; color: var(--text-main, #0f172a); max-width: 230px; cursor: pointer;">
                <option value="">🌐 Normativa General (sense doc)</option>
                ${documentsCache.map(d => `
                  <option value="${d.id}" ${d.id === documentActiuId ? 'selected' : ''}>
                    📎 ${escapeHtml(d.municipi ? `[${d.municipi}] ` : '')}${escapeHtml(d.titol.slice(0, 30))}...
                  </option>
                `).join('')}
              </select>
            </div>
          </div>

          <!-- Estat del context i botó netejar -->
          <div style="display: flex; align-items: center; gap: 8px;">
            ${docActiu ? `
              <span style="background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; padding: 2px 7px; border-radius: 6px; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
                <span>🟢</span> ${escapeHtml(docActiu.municipi || 'Doc')}
              </span>
            ` : ''}
            <button onclick="window.netejarHistorialXat()" style="background: none; border: 1px solid var(--border-card, #cbd5e1); color: var(--text-muted, #64748b); padding: 4px 8px; border-radius: 8px; font-size: 11px; font-weight: 600; cursor: pointer; transition: all 0.2s;" title="Netejar la conversa">
              🗑️ Netejar xat
            </button>
          </div>
        </div>

        <!-- ZONA DE MISSATGES -->
        <div id="tutor-chat-messages" class="tutor-chat-messages">
          <!-- Si no hi ha missatges, mostrar benvinguda -->
          ${historialXat.length === 0 ? renderitzarBenvingudaXat(docActiu) : ''}
          ${historialXat.map(renderitzarMissatgeXat).join('')}
        </div>

        <!-- BARRA D'ACCIONS RÀPIDES -->
        <div class="tutor-quick-prompts" style="padding: 6px 14px; background: var(--bg-card-subtle, #f8fafc); border-top: 1px solid var(--border-card, #e2e8f0); display: flex; gap: 8px; overflow-x: auto; white-space: nowrap; -webkit-overflow-scrolling: touch;">
          <button class="quick-prompt-btn" onclick="window.omplirIEnviarPrompt('Fes-me una regla mnemotècnica clara per recordar els principis bàsics d\\'actuació policial.')" style="background:var(--bg-card,#fff);border:1px solid var(--border-card,#cbd5e1);border-radius:20px;padding:4px 10px;font-size:11.5px;color:var(--text-main,#334155);cursor:pointer;font-weight:600;flex-shrink:0;">
            💡 Mnemotècnica principis d'actuació
          </button>
          <button class="quick-prompt-btn" onclick="window.omplirIEnviarPrompt('Quina és la diferència exacta entre detenció policial i detenció judicial segons la LECrim?')" style="background:var(--bg-card,#fff);border:1px solid var(--border-card,#cbd5e1);border-radius:20px;padding:4px 10px;font-size:11.5px;color:var(--text-main,#334155);cursor:pointer;font-weight:600;flex-shrink:0;">
            ⚖️ Detenció Policial vs Judicial
          </button>
          <button class="quick-prompt-btn" onclick="window.omplirIEnviarPrompt('Planteja\\'m un cas pràctic d\\'una actuació a la via pública i fes-me 3 preguntes amb la seva solució jurídica.')" style="background:var(--bg-card,#fff);border:1px solid var(--border-card,#cbd5e1);border-radius:20px;padding:4px 10px;font-size:11.5px;color:var(--text-main,#334155);cursor:pointer;font-weight:600;flex-shrink:0;">
            🚔 Cas pràctic policial
          </button>
          ${docActiu ? `
            <button class="quick-prompt-btn" onclick="window.omplirIEnviarPrompt('Quines són les infraccions molt greus que recull aquesta ordenança i quines sancions tenen?')" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:20px;padding:4px 10px;font-size:11.5px;color:#1d4ed8;cursor:pointer;font-weight:700;flex-shrink:0;">
              📜 Infraccions i sancions d'aquesta ordenança
            </button>
          ` : `
            <button class="quick-prompt-btn" onclick="window.omplirIEnviarPrompt('Quins són els terminis clau de la Llei 39/2015 que solen preguntar als exàmens oficials?')" style="background:var(--bg-card,#fff);border:1px solid var(--border-card,#cbd5e1);border-radius:20px;padding:4px 10px;font-size:11.5px;color:var(--text-main,#334155);cursor:pointer;font-weight:600;flex-shrink:0;">
              ⏱️ Terminis administratius d'examen
            </button>
          `}
        </div>

        <!-- FORMULARI D'ENTRADA - AMPLI I VISIBLE A TOTS ELS DISPOSITIUS -->
        <div class="tutor-input-area">
          <form id="tutor-chat-form" onsubmit="window.enviarMissatgeTutor(event)" style="display: flex; gap: 10px; align-items: flex-end;">
            
            <div class="tutor-input-wrapper">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; font-size: 11.5px; color: var(--text-muted, #64748b);">
                <span id="tutor-input-status-txt">Escriu la teva consulta o cas pràctic:</span>
                <div style="display: flex; gap: 8px; align-items: center;">
                  <button type="button" id="tutor-btn-netejar-input" onclick="window.buidarInputTutor()" style="display:none; background:none; border:none; color:#ef4444; font-size:11.5px; font-weight:700; cursor:pointer; padding:2px 4px;">✕ Esborrar</button>
                  <button type="button" id="tutor-btn-toggle-expand" onclick="window.toggleAmpliarInput()" style="background:var(--bg-card-subtle,#f1f5f9); border:1px solid var(--border-card,#cbd5e1); border-radius:6px; padding:2px 8px; font-size:11px; font-weight:700; color:var(--text-main,#334155); cursor:pointer;" title="Ampliar casella de text per veure més línies">⛶ Ampliar casella</button>
                </div>
              </div>

              <textarea 
                id="tutor-input-msg" 
                class="tutor-input-field" 
                placeholder="${docActiu ? `Fes una pregunta sobre '${escapeHtml(docActiu.titol)}'...` : 'Escriu qualsevol dubte jurídic, article o sol·licita un cas pràctic...'}" 
                oninput="window.handleTutorInputAutoResize(this)" 
                onfocus="window.handleInputFocus(this)" 
                onkeydown="window.handleTutorInputKeyDown(event)"></textarea>
            </div>

            <button type="submit" id="tutor-btn-enviar" style="background: #002B5E; color: white; border: none; padding: 0 18px; min-height: 60px; border-radius: 12px; font-weight: 800; font-size: 14.5px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 3px 10px rgba(0,43,94,0.3); transition: all 0.2s; flex-shrink: 0;">
              <span>Enviar</span> <span style="font-size: 16px;">➔</span>
            </button>
          </form>
        </div>

      </div>
    `;

    // Scroll al final
    const scrollEl = document.getElementById('tutor-chat-messages');
    if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
  }

  function renderitzarBenvingudaXat(docActiu) {
    return `
      <div style="text-align: center; padding: 30px 20px; background: var(--bg-card-subtle, #f8fafc); border-radius: 14px; border: 1px dashed var(--border-card, #cbd5e1); margin: auto; max-width: 600px;">
        <div style="font-size: 42px; margin-bottom: 10px;">👮‍♂️💬</div>
        <h3 style="margin: 0 0 8px 0; color: var(--text-main, #0f172a); font-size: 18px; font-weight: 800;">Hola! Sóc el teu Tutor d'Agent Medina</h3>
        <p style="margin: 0 0 16px 0; color: var(--text-muted, #64748b); font-size: 13.5px; line-height: 1.5;">
          ${docActiu 
            ? `Tens seleccionat el document <b>"${escapeHtml(docActiu.titol)}"</b> (${escapeHtml(docActiu.municipi || 'General')}). Les consultes es respondran prioritzant literalment el seu text!` 
            : `Pots preguntar qualsevol dubte sobre el Codi Penal, la Constitució, la Llei 16/1991, la Llei 10/1994, el RGC o l'Estatut. Si vols treballar amb ordenances específiques de municipis, selecciona-les a dalt o puja-les a la pestanya "Ordenances".`}
        </p>
        <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">
          <span style="font-size: 12px; background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 6px; font-weight: 700;">✓ Articles vigents</span>
          <span style="font-size: 12px; background: #fef3c7; color: #92400e; padding: 4px 10px; border-radius: 6px; font-weight: 700;">✓ Mnemotècnies d'examen</span>
          <span style="font-size: 12px; background: #f0fdf4; color: #166534; padding: 4px 10px; border-radius: 6px; font-weight: 700;">✓ Casos pràctics reals</span>
        </div>
      </div>
    `;
  }

  function renderitzarMissatgeXat(msg) {
    const esUsuari = msg.role === 'user';
    return `
      <div style="display: flex; justify-content: ${esUsuari ? 'flex-end' : 'flex-start'}; align-items: flex-start; gap: 10px;">
        ${!esUsuari ? `
          <div style="width: 32px; height: 32px; border-radius: 50%; background: #002B5E; color: white; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; box-shadow: 0 2px 5px rgba(0,43,94,0.2);">
            🧠
          </div>
        ` : ''}

        <div style="max-width: 80%; background: ${esUsuari ? '#002B5E' : 'var(--bg-card, #ffffff)'}; color: ${esUsuari ? '#ffffff' : 'var(--text-main, #0f172a)'}; padding: 12px 16px; border-radius: ${esUsuari ? '16px 16px 4px 16px' : '16px 16px 16px 4px'}; border: ${esUsuari ? 'none' : '1.5px solid var(--border-card, #e2e8f0)'}; box-shadow: 0 2px 8px rgba(0,0,0,0.05); font-size: 13.5px; line-height: 1.55;">
          ${!esUsuari && msg.contextDoc ? `
            <div style="margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid var(--border-card, #e2e8f0); font-size: 11.5px; font-weight: 700; color: #007aff; display: flex; align-items: center; gap: 4px;">
              <span>📎</span> Context: ${escapeHtml(msg.contextDoc)}
            </div>
          ` : ''}
          <div style="white-space: pre-line; word-break: break-word;">${formatejarTextResposta(msg.text)}</div>
          <div style="font-size: 10.5px; opacity: 0.6; margin-top: 6px; text-align: right;">${msg.hora || ''}</div>
        </div>

        ${esUsuari ? `
          <div style="width: 32px; height: 32px; border-radius: 50%; background: #007aff; color: white; display: flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0;">
            👤
          </div>
        ` : ''}
      </div>
    `;
  }

  function formatejarTextResposta(text) {
    if (!text) return '';
    // Converteix negretes **text** i manté salts de línia
    let html = escapeHtml(text);
    html = html.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    html = html.replace(/\*(.*?)\*/g, '<i>$1</i>');
    return html;
  }

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

  window.canviarCosTutor = function (val) {
    cosActiu = val;
  };

  window.canviarDocumentActiu = function (id) {
    documentActiuId = id || null;
    renderitzarSubvista();
  };

  window.netejarHistorialXat = function () {
    if (confirm('Vols reiniciar la conversa amb el Tutor?')) {
      historialXat = [];
      renderitzarSubvista();
    }
  };

  window.enviarMissatgeTutor = async function (e) {
    if (e && e.preventDefault) e.preventDefault();

    const input = document.getElementById('tutor-input-msg');
    if (!input) return;
    const missatge = input.value.trim();
    if (!missatge) return;

    const d = new Date();
    const hora = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

    // Afegir missatge d'usuari a l'historial
    historialXat.push({
      role: 'user',
      text: missatge,
      hora
    });

    input.value = '';
    renderitzarSubvista();

    const docActiu = documentsCache.find(d => d.id === documentActiuId);

    // Afegir missatge temporal de càrrega
    const msgContainer = document.getElementById('tutor-chat-messages');
    const loadingId = 'tutor-loading-' + Date.now();
    if (msgContainer) {
      const loadingDiv = document.createElement('div');
      loadingDiv.id = loadingId;
      loadingDiv.style.display = 'flex';
      loadingDiv.style.alignItems = 'center';
      loadingDiv.style.gap = '10px';
      loadingDiv.innerHTML = `
        <div style="width: 32px; height: 32px; border-radius: 50%; background: #002B5E; color: white; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0;">
          🧠
        </div>
        <div style="background: var(--bg-card, #ffffff); border: 1px solid var(--border-card, #e2e8f0); padding: 10px 16px; border-radius: 16px 16px 16px 4px; font-size: 13px; color: var(--text-muted, #64748b); display: flex; align-items: center; gap: 8px;">
          <span>⏳</span> <span>El Tutor d'Agent Medina està redactant la resposta...</span>
        </div>
      `;
      msgContainer.appendChild(loadingDiv);
      msgContainer.scrollTop = msgContainer.scrollHeight;
    }

    try {
      const res = await fetch('/api/gemini/tutor-xat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          missatge,
          historial: historialXat.slice(-6).map(m => ({ role: m.role, text: m.text })),
          documentContext: docActiu ? docActiu.contingutText : null,
          titolDocument: docActiu ? docActiu.titol : null,
          municipi: docActiu ? docActiu.municipi : null,
          cos: cosActiu
        })
      });

      const dades = await res.json();
      const loadEl = document.getElementById(loadingId);
      if (loadEl) loadEl.remove();

      if (dades.success && dades.resposta) {
        historialXat.push({
          role: 'model',
          text: dades.resposta,
          contextDoc: docActiu ? `${docActiu.titol} (${docActiu.municipi || 'General'})` : null,
          font: dades.font,
          hora: `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`
        });
      } else {
        historialXat.push({
          role: 'model',
          text: '⚠️ No s\'ha pogut obtenir resposta: ' + (dades.error || 'Error desconegut'),
          hora
        });
      }
    } catch (err) {
      const loadEl = document.getElementById(loadingId);
      if (loadEl) loadEl.remove();
      historialXat.push({
        role: 'model',
        text: '⚠️ Error de connexió amb el servidor del tutor: ' + err.message,
        hora
      });
    }

    renderitzarSubvista();
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

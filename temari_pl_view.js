/**
 * temari_pl_view.js
 * Renderitzador complet de la interfície de Policia Local:
 * - Suport oficial multi-municipi: Constantí (BOPT 2026), Cubelles (BOPB 2024), Cunit (BOPT 2025)
 * - Temaris ordenats estrictament segons les bases oficials
 * - Detecció clara de buits: els temes amb 0 preguntes apareixen destacats com a pendents
 * - Botó d'afegir preguntes directe a cada tema
 * - Vista de Temari Compartit Transversal amb taula de concordances i equivalències
 * - Filtres d'estat (Tots, Amb preguntes, Pendents) i blocs per a Cunit (A, B, C, D)
 * - Cerca dinàmica en temps real
 */

(function () {
  'use strict';

  let plFiltreEstat = 'tots'; // 'tots', 'amb_preguntes', 'sense_preguntes'
  let plFiltreCerca = '';
  let plFiltreBlocCunit = 'Tots'; // 'Tots', 'A', 'B', 'C', 'D'

  function renderitzadorTemariPL(contenedor, ctx) {
    if (!contenedor) return;

    const bancoPoliciaLocal = ctx.bancoPoliciaLocal || window.bancoPoliciaLocal || [];
    const mostrarSelectorPreguntas = ctx.mostrarSelectorPreguntas || window.mostrarSelectorPreguntas;
    const mostrarSelectorSeccions = ctx.mostrarSelectorSeccions || window.mostrarSelectorSeccions;
    const mostrarToast = ctx.mostrarToast || window.mostrarToast || console.log;
    const modalConfirmacio = ctx.modalConfirmacio || window.modalConfirmacio || window.confirm;
    const escapeHtml = ctx.escapeHtml || (s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'));
    const actualitzarBotonsRepasErrors = ctx.actualitzarBotonsRepasErrors || (() => {});
    const actualitzarRatxaUI = ctx.actualitzarRatxaUI || (() => {});
    const refrestarVista = () => {
      if (typeof ctx.mostrarTemarioPL === 'function') ctx.mostrarTemarioPL();
      else renderitzadorTemariPL(contenedor, ctx);
    };

    const municipiActiu = (typeof window.obtenirMunicipiActiuPL === 'function')
      ? window.obtenirMunicipiActiuPL()
      : (localStorage.getItem('agentmedina_pl_municipi_actiu_v1') || 'Constantí');

    const municipisDisponibles = (typeof window.carregarMunicipisPL === 'function')
      ? window.carregarMunicipisPL()
      : ['Constantí', 'Cubelles', 'Cunit'];

    const esCompartit = (municipiActiu === 'Compartit');
    const configOficial = (window.TEMARIS_MUNICIPALS && window.TEMARIS_MUNICIPALS[municipiActiu]) || null;
    const temariActual = (typeof window.obtenirTemariPLPerMunicipi === 'function')
      ? window.obtenirTemariPLPerMunicipi(municipiActiu)
      : [];

    const modeIntegracioMossos = (typeof window.esModeIntegracioMossosActiu === 'function')
      ? window.esModeIntegracioMossosActiu()
      : true;

    // Mapeig de preguntes per tema de l'oposició activa (PL + Mossos)
    const preguntesPerTemaMap = new Map();
    let temesAmbPreguntes = 0;
    let totalPreguntesPL = 0;
    let totalPreguntesMossosDisponibles = 0;

    temariActual.forEach(tema => {
      const qsPL = (typeof window.obtenirPreguntesPerTemaPL === 'function')
        ? window.obtenirPreguntesPerTemaPL(municipiActiu, tema, bancoPoliciaLocal)
        : [];
      const qsMossos = (typeof window.obtenirPreguntesMossosPerTemaPL === 'function')
        ? window.obtenirPreguntesMossosPerTemaPL(municipiActiu, tema)
        : [];
      const qsTotals = (typeof window.obtenirPreguntesTotalsTemaPL === 'function')
        ? window.obtenirPreguntesTotalsTemaPL(municipiActiu, tema, bancoPoliciaLocal, modeIntegracioMossos)
        : (modeIntegracioMossos ? [...qsPL, ...qsMossos] : qsPL);

      preguntesPerTemaMap.set(tema.id, {
        pl: qsPL,
        mossos: qsMossos,
        totals: qsTotals
      });

      if (qsTotals.length > 0) temesAmbPreguntes++;
      totalPreguntesPL += qsPL.length;
      totalPreguntesMossosDisponibles += qsMossos.length;
    });

    const totalPreguntesDisponibles = modeIntegracioMossos ? (totalPreguntesPL + totalPreguntesMossosDisponibles) : totalPreguntesPL;
    const temesSensePreguntes = temariActual.length - temesAmbPreguntes;
    const percentatgeCobertura = temariActual.length > 0
      ? Math.round((temesAmbPreguntes / temariActual.length) * 100)
      : 0;

    // Preguntes per a la vista compartida
    const materiesCompartides = window.MATERIES_COMPARTIDES || [];
    const preguntesCompartidesMap = new Map();
    let totalPreguntesCompartides = 0;
    materiesCompartides.forEach(m => {
      const qsPL = (typeof window.obtenirPreguntesMateriaCompartida === 'function')
        ? window.obtenirPreguntesMateriaCompartida(m.id, bancoPoliciaLocal, false)
        : [];
      const qsMossos = (typeof window.obtenirPreguntesMossosPerMateria === 'function')
        ? window.obtenirPreguntesMossosPerMateria(m.id)
        : [];
      const qsTotals = (typeof window.obtenirPreguntesMateriaCompartida === 'function')
        ? window.obtenirPreguntesMateriaCompartida(m.id, bancoPoliciaLocal, modeIntegracioMossos)
        : qsPL;

      preguntesCompartidesMap.set(m.id, { pl: qsPL, mossos: qsMossos, totals: qsTotals });
      totalPreguntesCompartides += qsTotals.length;
    });

    // Càlcul de progrés global per a l'oposició municipal activa (PL + Mossos)
    const allQsTotalsMunicipi = [];
    temariActual.forEach(tema => {
      const t = preguntesPerTemaMap.get(tema.id);
      if (t && t.totals) allQsTotalsMunicipi.push(...t.totals);
    });
    const estPLTotal = (typeof window.calcularProgresPreguntes === 'function')
      ? window.calcularProgresPreguntes(allQsTotalsMunicipi)
      : { total: allQsTotalsMunicipi.length, encerts: 0, encertades: 0, errors: 0, fallades: 0, maiFetes: allQsTotalsMunicipi.length, progrés: 0, pctProgres: 0, contestades: 0 };

    // Càlcul de progrés per al temari compartit transversal
    const allQsTotalsCompartit = [];
    materiesCompartides.forEach(m => {
      const t = preguntesCompartidesMap.get(m.id);
      if (t && t.totals) allQsTotalsCompartit.push(...t.totals);
    });
    const estCompartitTotal = (typeof window.calcularProgresPreguntes === 'function')
      ? window.calcularProgresPreguntes(allQsTotalsCompartit)
      : { total: allQsTotalsCompartit.length, encerts: 0, encertades: 0, errors: 0, fallades: 0, maiFetes: allQsTotalsCompartit.length, progrés: 0, pctProgres: 0, contestades: 0 };

    const totalCultura = (bancoPoliciaLocal || []).filter(q => (q.ambit || '').toLowerCase().includes('cultura')).length;

    contenedor.innerHTML = `
      <div class="teoria-host" style="display:flex;flex-direction:column;gap:18px;">
        
        <!-- HEADER TOP AMB PESTANYES DE MUNICIPI I ACCIONS -->
        <div style="background:var(--bg-card,#fff);border:1.5px solid var(--border-card,#e2e8f0);padding:18px 20px;border-radius:16px;box-shadow:var(--shadow-card);">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px;margin-bottom:14px;">
            <div>
              <div style="display:flex;align-items:center;gap:8px;">
                <span style="font-size:22px;">🚔</span>
                <h2 style="margin:0;font-size:20px;color:var(--text-main,#0f172a);font-weight:900;">
                  Temari Policia Local per Municipis
                </h2>
              </div>
              <p style="margin:4px 0 0;font-size:13.5px;color:var(--text-muted,#64748b);">
                Temaris ordenats segons les bases oficials, detecció de temes pendents, temari transversal i integració del banc de Mossos.
              </p>
            </div>
            
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button id="btn-toggle-integracio-mossos" style="display:flex;align-items:center;gap:7px;background:${modeIntegracioMossos ? '#fffbeb' : 'var(--bg-card-subtle,#f8fafc)'};color:${modeIntegracioMossos ? '#b45309' : 'var(--text-main,#334155)'};border:1.5px solid ${modeIntegracioMossos ? '#f59e0b' : 'var(--border-card,#e2e8f0)'};padding:8px 14px;border-radius:10px;font-weight:800;font-size:13px;cursor:pointer;" title="Alternar l'ús de preguntes comunes de Mossos d'Esquadra (Constitució, Estatut, Seguretat...)">
                <span>🦁</span> <span>Banc Mossos: ${modeIntegracioMossos ? 'Integrat (Actiu)' : 'Desactivat'}</span>
              </button>
              <button id="btn-toggle-panell-municipis" style="display:flex;align-items:center;gap:6px;background:var(--bg-card-subtle,#f8fafc);color:var(--text-main,#334155);border:1.5px solid var(--border-card,#e2e8f0);padding:8px 14px;border-radius:10px;font-weight:700;font-size:13px;cursor:pointer;">
                <span>⚙️</span> <span>Gestionar municipis</span>
              </button>
              <button onclick="window.obrirModalCrearPregunta('pl', null, '${escapeHtml(municipiActiu)}')" class="btn-crear-pregunta-top" style="font-size:13px;padding:8px 15px;">
                <span>➕</span> <span>Afegir pregunta</span>
              </button>
              <button onclick="window.obrirModalImportarLot('pl', null, '${escapeHtml(municipiActiu)}')" style="display:flex;align-items:center;gap:6px;background:linear-gradient(135deg,#059669,#10b981);color:#fff;border:none;padding:8px 15px;border-radius:10px;font-weight:700;font-size:13px;cursor:pointer;box-shadow:0 2px 8px rgba(16,185,129,0.25);" title="Importar preguntes massives o generades per IA">
                <span>⚡</span> <span>Importar lot / IA</span>
              </button>
            </div>
          </div>

          <!-- PESTANYES SELECTORES DE MUNICIPI I TEMARI COMPARTIT -->
          <div style="display:flex;align-items:center;gap:8px;overflow-x:auto;padding-bottom:4px;" id="pl-tabs-municipis">
            ${municipisDisponibles.map(mun => {
              const isAct = (!esCompartit && mun.toLowerCase() === municipiActiu.toLowerCase());
              const refBadge = mun === 'Constantí' ? 'BOPT 2026' : mun === 'Cubelles' ? 'BOPB 2024' : mun === 'Cunit' ? 'BOPT 2025' : '';
              return `
                <button type="button" class="btn-pl-tab-municipi" data-municipi="${escapeHtml(mun)}" style="display:flex;align-items:center;gap:7px;padding:9px 15px;border-radius:11px;font-weight:800;font-size:13.5px;cursor:pointer;white-space:nowrap;border:1.5px solid ${isAct ? '#2563eb' : 'var(--border-card,#e2e8f0)'};background:${isAct ? '#2563eb' : 'var(--bg-card-subtle,#f8fafc)'};color:${isAct ? '#ffffff' : 'var(--text-main,#1e293b)'};transition:all .15s ease;box-shadow:${isAct ? '0 3px 12px rgba(37,99,235,0.25)' : 'none'};">
                  <span>🏛️</span>
                  <span>${escapeHtml(mun)}</span>
                  ${refBadge ? `<span style="font-size:10.5px;font-weight:900;padding:2px 6px;border-radius:6px;background:${isAct ? 'rgba(255,255,255,0.25)' : '#e2e8f0'};color:${isAct ? '#ffffff' : '#475569'};">${refBadge}</span>` : ''}
                </button>
              `;
            }).join('')}

            <div style="height:24px;width:1.5px;background:var(--border-card,#cbd5e1);margin:0 4px;flex:none;"></div>

            <!-- Pestanya Temari Compartit -->
            <button type="button" class="btn-pl-tab-municipi" data-municipi="Compartit" style="display:flex;align-items:center;gap:7px;padding:9px 15px;border-radius:11px;font-weight:800;font-size:13.5px;cursor:pointer;white-space:nowrap;border:1.5px solid ${esCompartit ? '#0284c7' : 'var(--border-card,#e2e8f0)'};background:${esCompartit ? '#0284c7' : 'var(--bg-card-subtle,#f8fafc)'};color:${esCompartit ? '#ffffff' : 'var(--text-main,#1e293b)'};transition:all .15s ease;box-shadow:${esCompartit ? '0 3px 12px rgba(2,132,199,0.25)' : 'none'};">
              <span>🌐</span>
              <span>Temari Compartit (Transversal)</span>
              <span style="font-size:10.5px;font-weight:900;padding:2px 6px;border-radius:6px;background:${esCompartit ? 'rgba(255,255,255,0.25)' : '#e0f2fe'};color:${esCompartit ? '#ffffff' : '#0369a1'};">17 matèries</span>
            </button>
          </div>
        </div>

        <!-- PANELL DE GESTIÓ DE MUNICIPIS (AFEGIR / ELIMINAR) -->
        <div id="panell-gestio-municipis" style="display:none;background:var(--bg-card,#fff);border:1.5px solid var(--border-card,#e2e8f0);border-radius:16px;padding:20px;box-shadow:var(--shadow-card);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
            <div>
              <h3 style="margin:0;font-size:16px;color:var(--text-main,#0f172a);font-weight:800;">⚙️ Gestió de Municipis i Convocatòries</h3>
              <p style="margin:3px 0 0;font-size:12.5px;color:var(--text-muted,#64748b);">Pots afegir o retirar municipis segons les convocatòries a les quals et presentis.</p>
            </div>
            <button id="btn-tancar-gestio-municipis" style="background:none;border:none;font-size:16px;cursor:pointer;color:var(--text-muted,#64748b);">✕</button>
          </div>

          <div style="margin-bottom:18px;background:var(--bg-card-subtle,#f8fafc);border:1.5px solid var(--border-card,#cbd5e1);border-radius:12px;padding:16px;">
            <div style="display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap;">
              <input type="text" id="input-nou-municipi-pl" placeholder="Nom del nou municipi (ex: Reus, Vilanova i la Geltrú, Badalona, Sitges)..." style="flex:1;min-width:240px;padding:11px 14px;border:1.5px solid var(--border-card,#cbd5e1);border-radius:10px;font-size:14px;font-weight:600;background:var(--bg-card,#ffffff);color:var(--text-main,#1e293b);outline:none;">
              <button id="btn-afegir-municipi-pl" style="padding:11px 18px;background:#2563eb;color:#fff;border:none;border-radius:10px;font-weight:800;font-size:13.5px;cursor:pointer;display:flex;align-items:center;gap:6px;">
                <span>➕</span> <span>Afegir ràpid</span>
              </button>
            </div>

            <!-- SECCIÓ D'ADJUNTAR BASES AMB CERCA AUTOMÀTICA DE COINCIDÈNCIES -->
            <div style="border-top:1px dashed var(--border-card,#cbd5e1);padding-top:14px;margin-top:6px;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:8px;">
                <label style="font-size:13px;font-weight:800;color:var(--text-main,#0f172a);display:flex;align-items:center;gap:6px;">
                  <span>📋</span> <span>Adjuntar bases oficials per cercar coincidències automàtiques (Recomanat)</span>
                </label>
                <div style="display:flex;align-items:center;gap:8px;">
                  <button type="button" id="btn-carregar-exemple-bases-pl" style="background:none;border:none;color:#2563eb;font-weight:700;font-size:12px;cursor:pointer;text-decoration:underline;">
                    Carregar exemple bases
                  </button>
                  <label style="background:#e2e8f0;color:#334155;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:4px;">
                    <span>📁</span> <span>Arxiu .txt</span>
                    <input type="file" id="file-bases-pl" accept=".txt,.doc,.docx,.text" style="display:none;">
                  </label>
                </div>
              </div>
              <textarea id="textarea-bases-pl" rows="4" placeholder="Enganxa aquí el llistat de temes de les bases (ex:&#10;Tema 1: La Constitució espanyola de 1978: estructura i drets fonamentals&#10;Tema 2: L'Estatut d'Autonomia de Catalunya: institucions&#10;Tema 3: El municipi i les competències locals&#10;Tema 4: Llei 16/1991 de les policies locals de Catalunya...)" style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid var(--border-card,#cbd5e1);border-radius:8px;font-size:12.5px;font-family:monospace;background:var(--bg-card,#ffffff);color:var(--text-main,#1e293b);resize:vertical;"></textarea>

              <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;flex-wrap:wrap;gap:8px;">
                <p style="margin:0;font-size:12px;color:var(--text-muted,#64748b);">
                  El sistema analitzarà cada tema i buscarà les preguntes coincidents al banc comú (PL i Mossos).
                </p>
                <button type="button" id="btn-analitzar-bases-pl" style="padding:9px 18px;background:#059669;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:800;cursor:pointer;display:flex;align-items:center;gap:6px;box-shadow:0 2px 8px rgba(5,150,105,0.25);">
                  <span>🔍</span> <span>Cercar coincidències</span>
                </button>
              </div>

              <!-- CONTENIDOR DE PREVISUALITZACIÓ DE COINCIDÈNCIES -->
              <div id="contenidor-previsualitzacio-bases-pl" style="display:none;margin-top:14px;padding:14px;background:var(--bg-card,#ffffff);border:1.5px solid #10b981;border-radius:10px;">
              </div>
            </div>
          </div>

          <div style="font-size:12.5px;font-weight:700;color:var(--text-muted,#64748b);margin-bottom:8px;">Municipis actualment configurats:</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;">
            ${municipisDisponibles.map(m => `
              <div style="display:flex;align-items:center;gap:8px;padding:6px 12px;background:var(--bg-card-subtle,#f8fafc);border:1px solid var(--border-card,#cbd5e1);border-radius:9px;font-size:13px;font-weight:700;color:var(--text-main,#1e293b);">
                <span>🏛️ ${escapeHtml(m)}</span>
                ${municipisDisponibles.length > 1 ? `
                  <button type="button" class="btn-eliminar-mun" data-municipi="${escapeHtml(m)}" title="Eliminar municipi" style="background:none;border:none;color:#ef4444;font-weight:900;cursor:pointer;padding:0 2px;font-size:13px;">✕</button>
                ` : ''}
              </div>
            `).join('')}
          </div>

          <!-- INTEGRACIÓ DE PREGUNTES DE MOSSOS D'ESQUADRA -->
          <div style="margin-top:16px;padding-top:16px;border-top:1.5px dashed var(--border-card,#cbd5e1);">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
              <div>
                <div style="font-size:13.5px;font-weight:900;color:var(--text-main,#0f172a);display:flex;align-items:center;gap:6px;">
                  <span>🦁</span> <span>Importar preguntes de Mossos d'Esquadra a «${escapeHtml(municipiActiu)}»</span>
                </div>
                <p style="margin:3px 0 0;font-size:12.5px;color:var(--text-muted,#64748b);">
                  Copia i afegeix permanentment les preguntes oficials de Mossos que coincideixen amb el temari de ${escapeHtml(municipiActiu)} al banc de Policia Local.
                </p>
              </div>
              <button id="btn-importar-mossos-mun" style="display:flex;align-items:center;gap:6px;padding:9px 16px;background:#d97706;color:#ffffff;border:none;border-radius:10px;font-weight:800;font-size:13px;cursor:pointer;box-shadow:0 2px 8px rgba(217,119,6,0.25);">
                <span>📥</span> <span>Importar preguntes compatibles</span>
              </button>
            </div>
          </div>
        </div>

        ${esCompartit ? `
          <!-- ========================================================== -->
          <!-- VISTA DE TEMARI COMPARTIT TRANSVERSAL                       -->
          <!-- ========================================================== -->
          <div style="background:linear-gradient(135deg, #0284c7, #0369a1);border-radius:16px;padding:24px;color:#ffffff;box-shadow:0 8px 24px rgba(2,132,199,0.25);">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px;">
              <div>
                <div style="display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,0.2);padding:4px 10px;border-radius:8px;font-size:11.5px;font-weight:900;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">
                  🌐 Marc Transversal Catalunya
                </div>
                <h2 style="margin:0 0 6px;font-size:22px;font-weight:900;color:#ffffff;">
                  Temari Compartit de Policia Local
                </h2>
                <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.9);max-width:720px;line-height:1.5;">
                  Les convocatòries de Policia Local comparteixen la gran majoria del temari normatiu. Aquí pots practicar per matèria i veure exactament a quin número de tema correspon a Constantí, Cubelles i Cunit.
                </p>
              </div>

              <div style="display:flex;gap:10px;flex-wrap:wrap;">
                <button id="btn-start-tot-compartit" style="display:flex;align-items:center;gap:8px;background:#ffffff;color:#0369a1;border:none;padding:12px 20px;border-radius:12px;font-weight:900;font-size:14px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,0.15);transition:all .15s ease;">
                  <span>🔀</span> <span>Test de tot el temari compartit</span>
                </button>
              </div>
            </div>

            <!-- Targetes d'estadístiques -->
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:12px;margin-top:20px;">
              <div style="background:rgba(255,255,255,0.12);backdrop-filter:blur(6px);padding:12px 16px;border-radius:10px;border:1px solid rgba(255,255,255,0.2);">
                <div style="font-size:12px;opacity:0.85;font-weight:700;">Matèries troncals</div>
                <div style="font-size:20px;font-weight:900;margin-top:2px;">17 matèries</div>
              </div>
              <div style="background:rgba(255,255,255,0.12);backdrop-filter:blur(6px);padding:12px 16px;border-radius:10px;border:1px solid rgba(255,255,255,0.2);">
                <div style="font-size:12px;opacity:0.85;font-weight:700;">Preguntes teòriques</div>
                <div style="font-size:20px;font-weight:900;margin-top:2px;">${totalPreguntesCompartides} preguntes</div>
              </div>
              <div style="background:rgba(255,255,255,0.12);backdrop-filter:blur(6px);padding:12px 16px;border-radius:10px;border:1px solid rgba(255,255,255,0.2);">
                <div style="font-size:12px;opacity:0.85;font-weight:700;">Concordances actives</div>
                <div style="font-size:20px;font-weight:900;margin-top:2px;">Constantí · Cubelles · Cunit</div>
              </div>
            </div>

            <!-- Progrés en matèries comunes (encertades / fallades / mai fetes) -->
            <div style="background:rgba(255,255,255,0.12);backdrop-filter:blur(6px);padding:14px 18px;border-radius:12px;border:1px solid rgba(255,255,255,0.25);margin-top:14px;">
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:8px;">
                <span style="font-size:12px;font-weight:800;letter-spacing:0.4px;text-transform:uppercase;opacity:0.9;">
                  Progrés en matèries transversals
                </span>
                <span style="font-size:13px;font-weight:900;">
                  ${estCompartitTotal.pctProgres}% dominat (${estCompartitTotal.contestades} de ${estCompartitTotal.total})
                </span>
              </div>
              <div style="height:8px;background:rgba(255,255,255,0.25);border-radius:999px;overflow:hidden;display:flex;margin-bottom:10px;">
                <div style="width:${estCompartitTotal.total ? (estCompartitTotal.encertades / estCompartitTotal.total) * 100 : 0}%;background:#34d399;"></div>
                <div style="width:${estCompartitTotal.total ? (estCompartitTotal.fallades / estCompartitTotal.total) * 100 : 0}%;background:#f87171;"></div>
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;font-size:12px;font-weight:800;">
                <span style="background:rgba(16,185,129,0.25);color:#ecfdf5;padding:3px 9px;border-radius:6px;">
                  ✅ ${estCompartitTotal.encertades} encertades
                </span>
                <span style="background:rgba(239,68,68,0.25);color:#fee2e2;padding:3px 9px;border-radius:6px;">
                  ❌ ${estCompartitTotal.fallades} fallades
                </span>
                <span style="background:rgba(255,255,255,0.2);color:#ffffff;padding:3px 9px;border-radius:6px;">
                  ⏳ ${estCompartitTotal.maiFetes} que encara no has fet mai
                </span>
              </div>
            </div>
          </div>

          <!-- LLISTA DE MATÈRIES COMPARTIDES -->
          <div style="background:var(--bg-card,#fff);border:1.5px solid var(--border-card,#e2e8f0);border-radius:16px;padding:20px;box-shadow:var(--shadow-card);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px;">
              <div>
                <h3 style="margin:0;font-size:17px;color:var(--text-main,#0f172a);font-weight:900;">
                  Matèries Comunes i Taula de Concordances
                </h3>
                <p style="margin:2px 0 0;font-size:13px;color:var(--text-muted,#64748b);">
                  Practica per matèria amb preguntes unificades de tots els bancs (Policia Local + Mossos).
                </p>
              </div>
              <div>
                <input type="text" id="filtre-cerca-compartit" placeholder="🔍 Cercar matèria (ex: Penal, Trànsit, 16/1991)..." style="padding:8px 14px;border:1.5px solid var(--border-card,#e2e8f0);border-radius:9px;font-size:13px;background:var(--bg-card-subtle,#f8fafc);color:var(--text-main,#1e293b);width:260px;outline:none;">
              </div>
            </div>

            <div style="display:flex;flex-direction:column;gap:12px;" id="llista-materies-compartides">
              ${materiesCompartides.map(m => {
                const qsObj = preguntesCompartidesMap.get(m.id) || { pl: [], mossos: [], totals: [] };
                const qs = qsObj.totals || [];
                const c = m.concordances || {};
                const estMat = (typeof window.calcularProgresPreguntes === 'function')
                  ? window.calcularProgresPreguntes(qs)
                  : { total: qs.length, encertades: 0, fallades: 0, maiFetes: qs.length, pctProgres: 0 };
                return `
                  <div class="card-materia-compartida" data-nom="${escapeHtml(m.nom.toLowerCase())}" style="background:var(--bg-card-subtle,#f8fafc);border:1.5px solid var(--border-card,#e2e8f0);border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:10px;transition:all .15s ease;">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;">
                      <div style="flex:1;min-width:260px;">
                        <h4 style="margin:0 0 4px;font-size:15.5px;color:var(--text-main,#0f172a);font-weight:900;">
                          ${escapeHtml(m.nom)}
                        </h4>
                        <p style="margin:0;font-size:13px;color:var(--text-muted,#64748b);line-height:1.4;">
                          ${escapeHtml(m.descripcio)}
                        </p>
                        ${qs.length > 0 ? `
                          <div style="display:flex;align-items:center;gap:6px;margin-top:6px;flex-wrap:wrap;">
                            <span style="background:rgba(16,185,129,0.12);color:#059669;padding:2px 7px;border-radius:5px;font-size:11px;font-weight:800;">
                              ✅ ${estMat.encertades} encertades
                            </span>
                            <span style="background:rgba(239,68,68,0.12);color:#dc2626;padding:2px 7px;border-radius:5px;font-size:11px;font-weight:800;">
                              ❌ ${estMat.fallades} fallades
                            </span>
                            <span style="background:rgba(100,116,139,0.12);color:#475569;padding:2px 7px;border-radius:5px;font-size:11px;font-weight:800;">
                              ⏳ ${estMat.maiFetes} mai fetes
                            </span>
                            <span style="font-size:11px;font-weight:800;color:#0284c7;margin-left:3px;">
                              ${estMat.pctProgres}% dominat
                            </span>
                          </div>
                          <div style="margin-top:4px;height:4px;background:#e2e8f0;border-radius:999px;overflow:hidden;display:flex;max-width:220px;" title="${estMat.encertades} encertades, ${estMat.fallades} fallades, ${estMat.maiFetes} mai fetes">
                            <div style="width:${qs.length ? (estMat.encertades / qs.length) * 100 : 0}%;background:#10b981;"></div>
                            <div style="width:${qs.length ? (estMat.fallades / qs.length) * 100 : 0}%;background:#ef4444;"></div>
                          </div>
                        ` : ''}
                      </div>

                      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                        <span style="font-size:12px;font-weight:800;padding:4px 10px;border-radius:8px;background:${qs.length > 0 ? '#dcfce7' : '#fee2e2'};color:${qs.length > 0 ? '#15803d' : '#b91c1c'};">
                          ${qs.length > 0 ? `✓ ${qs.length} preguntes` : '0 preguntes'}
                        </span>
                        ${qsObj.pl && qsObj.mossos && qsObj.pl.length > 0 && qsObj.mossos.length > 0 && modeIntegracioMossos ? `
                          <span style="font-size:11px;font-weight:800;padding:2px 7px;border-radius:6px;background:rgba(217,119,6,0.1);color:#b45309;">
                            ${qsObj.pl.length} PL + ${qsObj.mossos.length} Mossos
                          </span>
                        ` : ''}
                        ${qs.length > 0 ? `
                          <button type="button" class="btn-test-materia-comp" data-materia="${m.id}" data-titol="${escapeHtml(m.nom)}" style="background:#0284c7;color:#fff;border:none;padding:7px 14px;border-radius:8px;font-weight:800;font-size:12.5px;cursor:pointer;">
                            ▶ Fer Test (${qs.length})
                          </button>
                        ` : ''}
                        <button type="button" onclick="window.obrirModalCrearPregunta('pl', '${escapeHtml(m.nom)}', 'Comú')" style="background:var(--bg-card,#fff);color:var(--text-main,#334155);border:1px solid var(--border-card,#cbd5e1);padding:7px 12px;border-radius:8px;font-weight:700;font-size:12.5px;cursor:pointer;">
                          ➕ Afegir
                        </button>
                      </div>
                    </div>

                    <!-- Concordances per municipi -->
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding-top:8px;border-top:1px dashed var(--border-card,#cbd5e1);font-size:12px;">
                      <span style="font-weight:800;color:var(--text-muted,#64748b);">Equivalències:</span>
                      <span style="background:rgba(37,99,235,0.08);color:#2563eb;padding:3px 8px;border-radius:6px;font-weight:700;">🏛️ Constantí: <b>${escapeHtml(c['Constantí'] || '—')}</b></span>
                      <span style="background:rgba(13,148,136,0.08);color:#0d9488;padding:3px 8px;border-radius:6px;font-weight:700;">🏛️ Cubelles: <b>${escapeHtml(c['Cubelles'] || '—')}</b></span>
                      <span style="background:rgba(124,58,237,0.08);color:#7c3aed;padding:3px 8px;border-radius:6px;font-weight:700;">🏛️ Cunit: <b>${escapeHtml(c['Cunit'] || '—')}</b></span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : `
          <!-- ========================================================== -->
          <!-- VISTA D'OPOSICIÓ MUNICIPAL ESPECÍFICA (Constantí, Cubelles, Cunit...) -->
          <!-- ========================================================== -->
          
          <!-- BANNER DE LA CONVOCATÒRIA ACTIVA -->
          <div style="background:linear-gradient(135deg, #002B5E, #1d4ed8);border-radius:16px;padding:24px;color:#ffffff;box-shadow:0 8px 24px rgba(0,43,94,0.25);">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px;">
              <div>
                <div style="display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,0.2);padding:4px 10px;border-radius:8px;font-size:11.5px;font-weight:900;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">
                  🏛️ Convocatòria Oficial · ${configOficial ? escapeHtml(configOficial.referencia) : 'Temari Oficial'}
                </div>
                <h2 style="margin:0 0 6px;font-size:22px;font-weight:900;color:#ffffff;">
                  Policia Local de ${escapeHtml(municipiActiu)}
                </h2>
                <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.9);max-width:720px;line-height:1.5;">
                  ${configOficial ? escapeHtml(configOficial.descripcio) : `Temari de preparació específic per a l'oposició de Policia Local de ${escapeHtml(municipiActiu)}.`}
                </p>
              </div>

              <div style="display:flex;gap:10px;flex-wrap:wrap;">
                <button id="btn-start-pl" style="display:flex;align-items:center;gap:8px;background:#ffffff;color:#002B5E;border:none;padding:12px 18px;border-radius:12px;font-weight:900;font-size:13.5px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,0.15);transition:all .15s ease;">
                  <span>🔀</span> <span>Test barrejat (${escapeHtml(municipiActiu)})</span>
                </button>
                <button id="btn-selector-multiple-pl" style="display:flex;align-items:center;gap:8px;background:rgba(255,255,255,0.15);color:#ffffff;border:1.5px solid rgba(255,255,255,0.35);backdrop-filter:blur(6px);padding:12px 18px;border-radius:12px;font-weight:900;font-size:13.5px;cursor:pointer;transition:all .15s ease;">
                  <span>☑️</span> <span>Selector múltiple</span>
                </button>
              </div>
            </div>

            <!-- Dades de cobertura i buits de temari -->
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(160px, 1fr));gap:12px;margin-top:20px;">
              <div style="background:rgba(255,255,255,0.12);backdrop-filter:blur(6px);padding:12px 16px;border-radius:10px;border:1px solid rgba(255,255,255,0.2);">
                <div style="font-size:12px;opacity:0.85;font-weight:700;">Cobertura de temes</div>
                <div style="font-size:20px;font-weight:900;margin-top:2px;">${temesAmbPreguntes} de ${temariActual.length} (${percentatgeCobertura}%)</div>
              </div>
              <div style="background:rgba(255,255,255,0.12);backdrop-filter:blur(6px);padding:12px 16px;border-radius:10px;border:1px solid rgba(255,255,255,0.2);">
                <div style="font-size:12px;opacity:0.85;font-weight:700;">Preguntes teòriques</div>
                <div style="font-size:20px;font-weight:900;margin-top:2px;">
                  ${totalPreguntesPL} PL ${modeIntegracioMossos && totalPreguntesMossosDisponibles > 0 ? `<span style="font-size:14px;opacity:0.9;">(+${totalPreguntesMossosDisponibles} Mossos)</span>` : ''}
                </div>
              </div>
              <div style="background:rgba(255,255,255,0.12);backdrop-filter:blur(6px);padding:12px 16px;border-radius:10px;border:1px solid rgba(255,255,255,0.2);">
                <div style="font-size:12px;opacity:0.85;font-weight:700;">Temes pendents d'afegir</div>
                <div style="font-size:20px;font-weight:900;margin-top:2px;color:${temesSensePreguntes > 0 ? '#fef08a' : '#86efac'};">
                  ${temesSensePreguntes > 0 ? `⚠️ ${temesSensePreguntes} pendents` : '✓ 100% complet!'}
                </div>
              </div>
            </div>

            <!-- Progrés de preguntes oficials (encertades / fallades / mai fetes) -->
            <div style="background:rgba(0,0,0,0.22);backdrop-filter:blur(8px);padding:14px 18px;border-radius:12px;border:1px solid rgba(255,255,255,0.25);margin-top:14px;">
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:8px;">
                <span style="font-size:12px;font-weight:800;letter-spacing:0.4px;text-transform:uppercase;opacity:0.95;">
                  Progrés en el temari de Policia Local (${escapeHtml(municipiActiu)})
                </span>
                <span style="font-size:13px;font-weight:900;">
                  ${estPLTotal.pctProgres}% dominat (${estPLTotal.contestades} de ${estPLTotal.total} contestades)
                </span>
              </div>
              <div style="height:8px;background:rgba(255,255,255,0.25);border-radius:999px;overflow:hidden;display:flex;margin-bottom:10px;" title="${estPLTotal.encertades} encertades, ${estPLTotal.fallades} fallades, ${estPLTotal.maiFetes} mai fetes">
                <div style="width:${estPLTotal.total ? (estPLTotal.encertades / estPLTotal.total) * 100 : 0}%;background:#34d399;"></div>
                <div style="width:${estPLTotal.total ? (estPLTotal.fallades / estPLTotal.total) * 100 : 0}%;background:#f87171;"></div>
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;font-size:12px;font-weight:800;">
                <span style="background:rgba(16,185,129,0.25);color:#ecfdf5;padding:3px 9px;border-radius:6px;">
                  ✅ ${estPLTotal.encertades} encertades
                </span>
                <span style="background:rgba(239,68,68,0.25);color:#fee2e2;padding:3px 9px;border-radius:6px;">
                  ❌ ${estPLTotal.fallades} fallades
                </span>
                <span style="background:rgba(255,255,255,0.2);color:#ffffff;padding:3px 9px;border-radius:6px;">
                  ⏳ ${estPLTotal.maiFetes} que encara no has fet mai
                </span>
              </div>
            </div>
          </div>

          <!-- LLISTA DELS TEMES ORDENATS SEGONS LES BASES -->
          <div style="background:var(--bg-card,#fff);border:1.5px solid var(--border-card,#e2e8f0);border-radius:16px;padding:20px;box-shadow:var(--shadow-card);">
            
            <!-- Barra de cerca i filtres de temes -->
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                <span style="font-size:12.5px;font-weight:800;color:var(--text-muted,#64748b);">Filtre d'estat:</span>
                <button type="button" class="btn-filtre-estat" data-estat="tots" style="padding:6px 12px;border-radius:8px;font-size:12.5px;font-weight:800;cursor:pointer;border:1.5px solid ${plFiltreEstat === 'tots' ? '#2563eb' : 'var(--border-card,#e2e8f0)'};background:${plFiltreEstat === 'tots' ? '#2563eb' : 'var(--bg-card-subtle,#f8fafc)'};color:${plFiltreEstat === 'tots' ? '#fff' : 'var(--text-main,#334155)'};">
                  Tots els temes (${temariActual.length})
                </button>
                <button type="button" class="btn-filtre-estat" data-estat="amb_preguntes" style="padding:6px 12px;border-radius:8px;font-size:12.5px;font-weight:800;cursor:pointer;border:1.5px solid ${plFiltreEstat === 'amb_preguntes' ? '#10b981' : 'var(--border-card,#e2e8f0)'};background:${plFiltreEstat === 'amb_preguntes' ? '#10b981' : 'var(--bg-card-subtle,#f8fafc)'};color:${plFiltreEstat === 'amb_preguntes' ? '#fff' : 'var(--text-main,#334155)'};">
                  ✓ Amb preguntes (${temesAmbPreguntes})
                </button>
                <button type="button" class="btn-filtre-estat" data-estat="amb_fallades" style="padding:6px 12px;border-radius:8px;font-size:12.5px;font-weight:800;cursor:pointer;border:1.5px solid ${plFiltreEstat === 'amb_fallades' ? '#ef4444' : 'var(--border-card,#e2e8f0)'};background:${plFiltreEstat === 'amb_fallades' ? '#ef4444' : 'var(--bg-card-subtle,#f8fafc)'};color:${plFiltreEstat === 'amb_fallades' ? '#fff' : 'var(--text-main,#334155)'};">
                  ❌ Amb fallades
                </button>
                <button type="button" class="btn-filtre-estat" data-estat="mai_fetes" style="padding:6px 12px;border-radius:8px;font-size:12.5px;font-weight:800;cursor:pointer;border:1.5px solid ${plFiltreEstat === 'mai_fetes' ? '#0284c7' : 'var(--border-card,#e2e8f0)'};background:${plFiltreEstat === 'mai_fetes' ? '#0284c7' : 'var(--bg-card-subtle,#f8fafc)'};color:${plFiltreEstat === 'mai_fetes' ? '#fff' : 'var(--text-main,#334155)'};">
                  ⏳ Amb mai fetes
                </button>
                <button type="button" class="btn-filtre-estat" data-estat="sense_preguntes" style="padding:6px 12px;border-radius:8px;font-size:12.5px;font-weight:800;cursor:pointer;border:1.5px solid ${plFiltreEstat === 'sense_preguntes' ? '#f59e0b' : 'var(--border-card,#e2e8f0)'};background:${plFiltreEstat === 'sense_preguntes' ? '#f59e0b' : 'var(--bg-card-subtle,#f8fafc)'};color:${plFiltreEstat === 'sense_preguntes' ? '#fff' : 'var(--text-main,#334155)'};">
                  ⚠️ Pendents (${temesSensePreguntes})
                </button>
              </div>

              <div style="flex:1;max-width:320px;min-width:220px;">
                <input type="text" id="filtre-cerca-temes-pl" placeholder="🔍 Cercar tema (ex: Tema 12, Trànsit, Penal)..." value="${escapeHtml(plFiltreCerca)}" style="width:100%;box-sizing:border-box;padding:8px 14px;border:1.5px solid var(--border-card,#e2e8f0);border-radius:9px;font-size:13px;background:var(--bg-card-subtle,#f8fafc);color:var(--text-main,#1e293b);outline:none;">
              </div>
            </div>

            <!-- Si és Cunit: pestanyes dels 4 blocs oficials (A, B, C, D) -->
            ${configOficial && configOficial.blocs ? `
              <div style="display:flex;align-items:center;gap:6px;overflow-x:auto;padding-bottom:10px;margin-bottom:14px;border-bottom:1px solid var(--border-card,#e2e8f0);">
                <span style="font-size:12px;font-weight:800;color:var(--text-muted,#64748b);margin-right:4px;">Blocs:</span>
                ${configOficial.blocs.map(b => {
                  const isActBloc = (plFiltreBlocCunit === b.id);
                  return `
                    <button type="button" class="btn-filtre-bloc-cunit" data-bloc="${b.id}" style="padding:6px 12px;border-radius:8px;font-size:12.5px;font-weight:800;cursor:pointer;white-space:nowrap;border:1.5px solid ${isActBloc ? '#7c3aed' : 'var(--border-card,#e2e8f0)'};background:${isActBloc ? '#7c3aed' : 'var(--bg-card-subtle,#f8fafc)'};color:${isActBloc ? '#fff' : 'var(--text-main,#334155)'};">
                      ${escapeHtml(b.nom)}
                    </button>
                  `;
                }).join('')}
              </div>
            ` : ''}

            <!-- LLISTAT DINÀMIC DELS TEMES EN ORDRE OFICIAL -->
            <div style="display:flex;flex-direction:column;gap:10px;" id="llista-temes-pl-cards">
              ${temariActual.map((tema) => {
                const tData = preguntesPerTemaMap.get(tema.id) || { pl: [], mossos: [], totals: [] };
                const countPL = tData.pl.length;
                const countMossos = tData.mossos.length;
                const countTotals = tData.totals.length;
                const hasQuestions = countTotals > 0;
                
                const estTema = (typeof window.calcularProgresPreguntes === 'function')
                  ? window.calcularProgresPreguntes(tData.totals)
                  : { total: countTotals, encertades: 0, fallades: 0, maiFetes: countTotals, pctProgres: 0 };

                // Filtre d'estat
                if (plFiltreEstat === 'amb_preguntes' && !hasQuestions) return '';
                if (plFiltreEstat === 'sense_preguntes' && hasQuestions) return '';
                if (plFiltreEstat === 'amb_fallades' && (!hasQuestions || estTema.fallades === 0)) return '';
                if ((plFiltreEstat === 'mai_fetes' || plFiltreEstat === 'amb_mai_fetes') && (!hasQuestions || estTema.maiFetes === 0)) return '';
                
                // Filtre de bloc Cunit
                if (municipiActiu === 'Cunit' && plFiltreBlocCunit !== 'Tots' && tema.bloc !== plFiltreBlocCunit) {
                  return '';
                }

                // Filtre de cerca
                if (plFiltreCerca) {
                  const qSearch = plFiltreCerca.toLowerCase();
                  const txtFull = `${tema.codi} ${tema.nom} ${tema.materia || ''}`.toLowerCase();
                  if (!txtFull.includes(qSearch)) return '';
                }

                const etiquetaMateria = tema.especific 
                  ? `🏛️ Específic ${escapeHtml(municipiActiu)}`
                  : tema.materia 
                  ? `${tema.materia.replace(/_/g, ' ')}`
                  : 'comú';

                return `
                  <div class="card-tema-pl" style="background:${hasQuestions ? 'var(--bg-card-subtle,#f8fafc)' : '#fffbeb'};border:1.5px solid ${hasQuestions ? 'var(--border-card,#e2e8f0)' : '#fde68a'};border-radius:12px;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;transition:all .15s ease;">
                    <div style="display:flex;align-items:flex-start;gap:12px;flex:1;min-width:280px;">
                      <div style="flex:none;padding-top:2px;">
                        <span style="background:${tema.especific ? '#e11d48' : '#002B5E'};color:#ffffff;font-weight:900;font-size:12px;padding:4px 9px;border-radius:7px;display:inline-block;min-width:32px;text-align:center;">
                          ${escapeHtml(tema.codi || `T${tema.id}`)}
                        </span>
                      </div>
                      <div>
                        <div style="font-size:14px;font-weight:800;color:var(--text-main,#0f172a);line-height:1.45;">
                          ${escapeHtml(tema.nom)}
                        </div>
                        <div style="display:flex;align-items:center;gap:8px;margin-top:5px;flex-wrap:wrap;">
                          <span style="font-size:11px;font-weight:800;padding:2px 7px;border-radius:5px;background:${tema.especific ? 'rgba(225,29,72,0.1)' : 'rgba(0,43,94,0.08)'};color:${tema.especific ? '#e11d48' : '#002B5E'};text-transform:capitalize;">
                            ${escapeHtml(etiquetaMateria)}
                          </span>
                          ${countPL > 0 ? `
                            <span style="font-size:11.5px;font-weight:800;color:#15803d;display:flex;align-items:center;gap:5px;flex-wrap:wrap;">
                              <span>✓</span> <span>${countPL} preguntes PL</span>
                              ${modeIntegracioMossos && countMossos > 0 ? `<span style="background:rgba(217,119,6,0.12);color:#b45309;padding:1px 6px;border-radius:5px;font-size:11px;font-weight:800;">+${countMossos} Mossos</span>` : ''}
                            </span>
                          ` : (modeIntegracioMossos && countMossos > 0) ? `
                            <span style="font-size:11.5px;font-weight:800;color:#b45309;background:#fef3c7;padding:2px 8px;border-radius:6px;display:flex;align-items:center;gap:5px;">
                              <span>🦁</span> <span>${countMossos} preguntes de Mossos llestes per a test</span>
                            </span>
                          ` : `
                            <span style="font-size:11.5px;font-weight:800;color:#b45309;background:#fef3c7;padding:2px 7px;border-radius:5px;display:flex;align-items:center;gap:4px;">
                              <span>⚠️</span> <span>0 preguntes · Pendent d'afegir</span>
                            </span>
                          `}
                        </div>
                        ${hasQuestions ? `
                          <div style="display:flex;align-items:center;gap:6px;margin-top:6px;flex-wrap:wrap;">
                            <span style="background:rgba(16,185,129,0.12);color:#059669;padding:2px 7px;border-radius:5px;font-size:11px;font-weight:800;">
                              ✅ ${estTema.encertades} encertades
                            </span>
                            <span style="background:rgba(239,68,68,0.12);color:#dc2626;padding:2px 7px;border-radius:5px;font-size:11px;font-weight:800;">
                              ❌ ${estTema.fallades} fallades
                            </span>
                            <span style="background:rgba(100,116,139,0.12);color:#475569;padding:2px 7px;border-radius:5px;font-size:11px;font-weight:800;">
                              ⏳ ${estTema.maiFetes} mai fetes
                            </span>
                            <span style="font-size:11px;font-weight:800;color:#002B5E;margin-left:3px;">
                              ${estTema.pctProgres}% dominat
                            </span>
                          </div>
                          <div style="margin-top:4px;height:4px;background:#e2e8f0;border-radius:999px;overflow:hidden;display:flex;max-width:240px;" title="${estTema.encertades} encertades, ${estTema.fallades} fallades, ${estTema.maiFetes} mai fetes">
                            <div style="width:${countTotals ? (estTema.encertades / countTotals) * 100 : 0}%;background:#10b981;"></div>
                            <div style="width:${countTotals ? (estTema.fallades / countTotals) * 100 : 0}%;background:#ef4444;"></div>
                          </div>
                        ` : ''}
                      </div>
                    </div>

                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;flex:none;">
                      ${(countPL > 0 && modeIntegracioMossos && countMossos > 0) ? `
                        <button type="button" class="btn-test-tema-pl" data-tema-id="${tema.id}" data-titol="${escapeHtml(tema.nom)}" data-font="tots" style="background:#2563eb;color:#ffffff;border:none;padding:8px 15px;border-radius:9px;font-weight:800;font-size:13px;cursor:pointer;transition:all .15s ease;">
                          ▶ Fer Test (${countTotals})
                        </button>
                        <button type="button" class="btn-test-tema-pl" data-tema-id="${tema.id}" data-titol="${escapeHtml(tema.nom)}" data-font="mossos" title="Practicar només les preguntes del banc de Mossos" style="background:#fffbeb;color:#b45309;border:1px solid #fde68a;padding:8px 10px;border-radius:9px;font-weight:800;font-size:12px;cursor:pointer;">
                          🦁 Mossos (${countMossos})
                        </button>
                      ` : (countPL > 0) ? `
                        <button type="button" class="btn-test-tema-pl" data-tema-id="${tema.id}" data-titol="${escapeHtml(tema.nom)}" data-font="pl" style="background:#2563eb;color:#ffffff;border:none;padding:8px 16px;border-radius:9px;font-weight:800;font-size:13px;cursor:pointer;transition:all .15s ease;">
                          ▶ Fer Test (${countPL})
                        </button>
                      ` : (modeIntegracioMossos && countMossos > 0) ? `
                        <button type="button" class="btn-test-tema-pl" data-tema-id="${tema.id}" data-titol="${escapeHtml(tema.nom)}" data-font="mossos" style="background:#d97706;color:#ffffff;border:none;padding:8px 16px;border-radius:9px;font-weight:800;font-size:13px;cursor:pointer;transition:all .15s ease;">
                          ▶ Fer Test Mossos (${countMossos})
                        </button>
                      ` : `
                        <button type="button" onclick="window.obrirModalCrearPregunta('pl', '${escapeHtml(tema.nom)}', '${escapeHtml(municipiActiu)}')" style="background:#fef3c7;color:#92400e;border:1px solid #fcd34d;padding:8px 14px;border-radius:9px;font-weight:800;font-size:12.5px;cursor:pointer;">
                          ➕ Afegir primer test
                        </button>
                      `}
                      <button type="button" onclick="window.obrirModalCrearPregunta('pl', '${escapeHtml(tema.nom)}', '${escapeHtml(municipiActiu)}')" title="Afegir pregunta manual a aquest tema" style="background:var(--bg-card,#fff);color:var(--text-main,#334155);border:1px solid var(--border-card,#cbd5e1);padding:8px 12px;border-radius:9px;font-weight:700;font-size:12.5px;cursor:pointer;">
                        ➕
                      </button>
                      <button type="button" onclick="window.obrirModalImportarLot('pl', '${escapeHtml(tema.nom)}', '${escapeHtml(municipiActiu)}')" title="Importar lot de preguntes d'IA per a aquest tema" style="background:#ecfdf5;color:#059669;border:1px solid #a7f3d0;padding:8px 11px;border-radius:9px;font-weight:800;font-size:12px;cursor:pointer;">
                        ⚡ IA
                      </button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `}

        <!-- APARTAT DE CULTURA GENERAL PER A POLICIA LOCAL -->
        <div style="background:var(--bg-card,#fff);border:1.5px solid var(--border-card,#e2e8f0);border-radius:16px;padding:18px 20px;box-shadow:var(--shadow-card);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px;">
          <div>
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:20px;">🌍</span>
              <h3 style="margin:0;font-size:16.5px;color:var(--text-main,#0f172a);font-weight:800;">
                Cultura General i Actualitat per a Policia Local
              </h3>
            </div>
            <p style="margin:3px 0 0;font-size:13px;color:var(--text-muted,#64748b);">
              Banc de ${totalCultura} preguntes d'història, geografia, societat, ciència i cultura catalana aplicades a oposicions.
            </p>
          </div>
          <div style="display:flex;gap:8px;">
            <button id="pl-btn-cultura" style="background:#10b981;color:#fff;border:none;padding:9px 18px;border-radius:10px;font-weight:800;font-size:13px;cursor:pointer;">
              ▶ Fer Test Cultura General (${totalCultura})
            </button>
          </div>
        </div>

      </div>
      <div id="test-container"></div>
    `;

    // ----------------------------------------------------
    // ESDEVENIMENTS I HANDLERS DE LA VISTA DE POLICIA LOCAL
    // ----------------------------------------------------

    // 1. Canvi de Pestanya Municipi o Temari Compartit
    contenedor.querySelectorAll('.btn-pl-tab-municipi').forEach(btn => {
      btn.addEventListener('click', () => {
        const nouMun = btn.dataset.municipi;
        if (nouMun) {
          if (typeof window.establirMunicipiActiuPL === 'function') {
            window.establirMunicipiActiuPL(nouMun);
          } else {
            localStorage.setItem('agentmedina_pl_municipi_actiu_v1', nouMun);
          }
          plFiltreEstat = 'tots';
          plFiltreCerca = '';
          plFiltreBlocCunit = 'Tots';
          mostrarToast(`Oposició canviada a «${nouMun}»`, 'success');
          refrestarVista();
        }
      });
    });

    // 2. Toggle del Panell de Gestió de Municipis
    const btnTogglePanell = document.getElementById('btn-toggle-panell-municipis');
    const panellGestio = document.getElementById('panell-gestio-municipis');
    const btnTancarGestio = document.getElementById('btn-tancar-gestio-municipis');

    if (btnTogglePanell && panellGestio) {
      btnTogglePanell.addEventListener('click', () => {
        const isHidden = panellGestio.style.display === 'none';
        panellGestio.style.display = isHidden ? 'block' : 'none';
      });
    }
    if (btnTancarGestio && panellGestio) {
      btnTancarGestio.addEventListener('click', () => {
        panellGestio.style.display = 'none';
      });
    }

    // 3. Afegir municipi nou (ràpid o amb bases)
    const btnAfegirMun = document.getElementById('btn-afegir-municipi-pl');
    const inputNouMun = document.getElementById('input-nou-municipi-pl');
    const textareaBases = document.getElementById('textarea-bases-pl');
    const btnAnalitzarBases = document.getElementById('btn-analitzar-bases-pl');
    const btnExempleBases = document.getElementById('btn-carregar-exemple-bases-pl');
    const fileBases = document.getElementById('file-bases-pl');
    const contenidorPrevis = document.getElementById('contenidor-previsualitzacio-bases-pl');

    if (btnExempleBases && textareaBases) {
      btnExempleBases.addEventListener('click', () => {
        if (!inputNouMun.value.trim()) {
          inputNouMun.value = 'Vilafranca del Penedès';
        }
        textareaBases.value = `Tema 1: La Constitució espanyola de 1978: estructura, contingut i principis generals. Drets i deures fonamentals.
Tema 2: L'Estatut d'Autonomia de Catalunya: institucions de la Generalitat, competències i organització.
Tema 3: L'Administració local: el municipi, organització municipal, competències i procediment administratiu (Llei 39/2015 i 7/1985).
Tema 4: La funció pública local: estatut dels empleats públics i règim disciplinari (Decret 179/2015).
Tema 5: Transparència, accés a la informació i protecció de dades de caràcter personal (RGPD i Llei 3/2018).
Tema 6: Llei 16/1991 de les policies locals de Catalunya: funcions, principis bàsics d'actuació i coordinació.
Tema 7: Forces i Cossos de Seguretat (Llei Orgànica 2/1986): estructura i coordinació policial.
Tema 8: Protecció de la seguretat ciutadana (Llei Orgànica 4/2015): identificacions, escorcolls i potestats policials.
Tema 9: El sistema de seguretat pública de Catalunya (Llei 4/2003): juntes locals de seguretat.
Tema 10: Dret Penal: delictes contra les persones, patrimoni, ordre públic i delictes lleus.
Tema 11: La detenció i els drets del detingut. El procediment d'Habeas Corpus.
Tema 12: Normativa de trànsit i seguretat viària: reglament general de circulació i de conductors.
Tema 13: Accidents de trànsit i alcoholèmies: investigació d'accidents i atestats policials.
Tema 14: Codi d'ètica de la Policia de Catalunya i deontologia policial.
Tema 15: Ordenança Municipal de convivència ciutadana i via pública del municipi.
Tema 16: Coneixement del municipi: història, geografia, carrerer i serveis municipals.`;
        mostrarToast('Exemple de bases carregat', 'info');
      });
    }

    if (fileBases && textareaBases) {
      fileBases.addEventListener('change', e => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
          textareaBases.value = ev.target?.result || '';
          mostrarToast(`Arxiu «${file.name}» carregat al formulari`, 'success');
        };
        reader.readAsText(file);
      });
    }

    let darrerAnalisiBases = null;

    if (btnAnalitzarBases && textareaBases && contenidorPrevis) {
      btnAnalitzarBases.addEventListener('click', () => {
        const nom = (inputNouMun ? inputNouMun.value.trim() : '');
        const text = textareaBases.value.trim();
        if (!text) {
          mostrarToast('Enganxa primer el text de les bases de la convocatòria', 'warning');
          textareaBases.focus();
          return;
        }

        if (typeof window.analitzarBasesMunicipi !== 'function') {
          mostrarToast('Funció d\'anàlisi no disponible', 'error');
          return;
        }

        const resultat = window.analitzarBasesMunicipi(text, nom);
        darrerAnalisiBases = { ...resultat, nomMunicipi: nom };

        if (!resultat.temes.length) {
          mostrarToast('No s\'ha pogut identificar cap tema al text facilitat', 'warning');
          return;
        }

        const materiesDisponibles = window.MATERIES_COMPARTIDES || [];

        contenidorPrevis.style.display = 'block';
        contenidorPrevis.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px;">
            <div>
              <div style="font-size:14px;font-weight:900;color:#065f46;display:flex;align-items:center;gap:6px;">
                <span>🎯</span> <span>Anàlisi de bases completat per a «${escapeHtml(nom || 'Nou municipi')}»</span>
              </div>
              <p style="margin:2px 0 0;font-size:12px;color:#047857;">
                S'han detectat <b>${resultat.totalTemes}</b> temes. <b>${resultat.totalCoincidencies}</b> coincideixen amb matèries oficials amb un total de <b>${resultat.preguntesTotalsDisponibles}</b> preguntes compatibles!
              </p>
            </div>
            <button type="button" id="btn-desar-municipi-amb-temari" style="padding:10px 18px;background:#059669;color:#fff;border:none;border-radius:10px;font-weight:900;font-size:13.5px;cursor:pointer;display:flex;align-items:center;gap:6px;box-shadow:0 3px 10px rgba(5,150,105,0.3);">
              <span>💾</span> <span>Desar municipi i activar temari</span>
            </button>
          </div>

          <div style="max-height:260px;overflow-y:auto;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;padding:6px;">
            ${resultat.temes.map((t, i) => `
              <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 10px;background:#ffffff;border:1px solid #e2e8f0;border-radius:6px;margin-bottom:5px;font-size:12px;">
                <div style="flex:1;min-width:0;">
                  <b style="color:#0f172a;">${escapeHtml(t.codi)}:</b> <span style="color:#334155;">${escapeHtml(t.nom.length > 75 ? t.nom.slice(0, 75) + '...' : t.nom)}</span>
                </div>
                <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
                  <select class="select-materia-tema-custom" data-idx="${i}" style="font-size:11.5px;padding:3px 6px;border-radius:6px;border:1px solid #cbd5e1;background:#fff;color:#1e293b;max-width:180px;">
                    <option value="especific_${(nom||'local').toLowerCase()}" ${t.especific ? 'selected' : ''}>📍 Específic local (${escapeHtml(nom||'local')})</option>
                    ${materiesDisponibles.map(m => `
                      <option value="${m.id}" ${t.materia === m.id ? 'selected' : ''}>${escapeHtml(m.nom.slice(0, 30))}</option>
                    `).join('')}
                    <option value="altres" ${t.materia === 'altres' && !t.especific ? 'selected' : ''}>Altres matèries</option>
                  </select>
                  <span style="display:inline-block;padding:2px 8px;border-radius:12px;font-weight:800;font-size:11px;background:${t.totalPreguntes > 0 ? '#dcfce7' : '#f1f5f9'};color:${t.totalPreguntes > 0 ? '#15803d' : '#64748b'};">
                    ${t.totalPreguntes > 0 ? `✨ ${t.totalPreguntes} preg.` : '0 preg.'}
                  </span>
                </div>
              </div>
            `).join('')}
          </div>
        `;

        // Event de desar municipi amb el temari analitzat
        const btnDesarCustom = document.getElementById('btn-desar-municipi-amb-temari');
        if (btnDesarCustom) {
          btnDesarCustom.addEventListener('click', () => {
            const nomFinal = (inputNouMun ? inputNouMun.value.trim() : '') || 'Nou Municipi';
            if (!nomFinal) {
              mostrarToast('Indica el nom del municipi a la casella superior', 'warning');
              inputNouMun?.focus();
              return;
            }

            // Actualitzem les matèries segons els selects de l'usuari
            const selects = contenidorPrevis.querySelectorAll('.select-materia-tema-custom');
            const temesFinals = resultat.temes.map((t, idx) => {
              const sel = selects[idx];
              const novaMateria = sel ? sel.value : t.materia;
              const esEsp = novaMateria.startsWith('especific_');
              return {
                ...t,
                materia: novaMateria,
                especific: esEsp
              };
            });

            if (typeof window.guardarMunicipiAmbTemariPL === 'function') {
              window.guardarMunicipiAmbTemariPL(nomFinal, {
                nom: nomFinal,
                referencia: 'Bases oficials',
                descripcio: `Convocatòria oficial Policia Local de ${nomFinal} (${temesFinals.length} temes)`,
                basesText: text,
                temes: temesFinals
              });
              mostrarToast(`Municipi «${nomFinal}» desat amb ${temesFinals.length} temes!`, 'success');
              refrestarVista();
            }
          });
        }
      });
    }

    if (btnAfegirMun && inputNouMun) {
      const execAfegir = () => {
        const nom = inputNouMun.value.trim();
        if (!nom) {
          mostrarToast('Escriu el nom del municipi', 'warning');
          return;
        }
        if (typeof window.afegirMunicipiPL === 'function') {
          window.afegirMunicipiPL(nom);
          window.establirMunicipiActiuPL(nom);
        }
        mostrarToast(`Municipi «${nom}» afegit correctament`, 'success');
        refrestarVista();
      };
      btnAfegirMun.addEventListener('click', execAfegir);
      inputNouMun.addEventListener('keydown', e => { if (e.key === 'Enter') execAfegir(); });
    }

    // 4. Eliminar municipi
    contenedor.querySelectorAll('.btn-eliminar-mun').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        const mun = btn.dataset.municipi;
        if (!mun) return;
        modalConfirmacio({
          titol: 'Eliminar municipi',
          missatge: `Vols retirar «${mun}» de la llista de municipis actius?\n\n(Les preguntes existents es mantindran al teu banc).`,
          textBoto: 'Eliminar',
          esPerillos: true,
          onAcceptar: () => {
            if (typeof window.eliminarMunicipiPL === 'function') {
              window.eliminarMunicipiPL(mun);
              if (window.obtenirMunicipiActiuPL().toLowerCase() === mun.toLowerCase()) {
                window.establirMunicipiActiuPL('Constantí');
              }
            }
            mostrarToast(`Municipi «${mun}» retirat`, 'success');
            refrestarVista();
          }
        });
      });
    });

    // 5. Filtre d'estat (Tots / Amb preguntes / Sense preguntes)
    contenedor.querySelectorAll('.btn-filtre-estat').forEach(btn => {
      btn.addEventListener('click', () => {
        plFiltreEstat = btn.dataset.estat;
        refrestarVista();
      });
    });

    // 6. Filtre de blocs per a Cunit
    contenedor.querySelectorAll('.btn-filtre-bloc-cunit').forEach(btn => {
      btn.addEventListener('click', () => {
        plFiltreBlocCunit = btn.dataset.bloc;
        refrestarVista();
      });
    });

    // 7. Cerca de temes en temps real
    const inputCerca = document.getElementById('filtre-cerca-temes-pl');
    if (inputCerca) {
      inputCerca.addEventListener('input', e => {
        plFiltreCerca = e.target.value;
        const q = plFiltreCerca.toLowerCase();
        contenedor.querySelectorAll('.card-tema-pl').forEach(card => {
          const text = card.textContent.toLowerCase();
          card.style.display = text.includes(q) ? 'flex' : 'none';
        });
      });
    }

    // 8. Cerca en Temari Compartit
    const inputCercaComp = document.getElementById('filtre-cerca-compartit');
    if (inputCercaComp) {
      inputCercaComp.addEventListener('input', e => {
        const q = e.target.value.toLowerCase();
        contenedor.querySelectorAll('.card-materia-compartida').forEach(card => {
          const text = card.dataset.nom || card.textContent.toLowerCase();
          card.style.display = text.includes(q) ? 'flex' : 'none';
        });
      });
    }

    // 8.5 Toggle integració de Mossos
    const btnToggleMossos = document.getElementById('btn-toggle-integracio-mossos');
    if (btnToggleMossos) {
      btnToggleMossos.addEventListener('click', () => {
        const nouEstat = !modeIntegracioMossos;
        if (typeof window.establirModeIntegracioMossos === 'function') {
          window.establirModeIntegracioMossos(nouEstat);
        }
        mostrarToast(nouEstat ? '🦁 Integració de preguntes de Mossos ACTIVADA' : 'Banc de Mossos desactivat per a Policia Local', 'info');
        refrestarVista();
      });
    }

    // 8.6 Importar preguntes de Mossos a la convocatòria activa
    const btnImportarMossos = document.getElementById('btn-importar-mossos-mun');
    if (btnImportarMossos) {
      btnImportarMossos.addEventListener('click', () => {
        modalConfirmacio({
          titol: `Importar preguntes de Mossos a ${municipiActiu}`,
          missatge: `Aquesta acció buscarà totes les preguntes de Mossos compatibles amb el temari de «${municipiActiu}» (Constitució, Estatut, Seguretat Pública...) i les copiarà de manera permanent al banc de preguntes d'aquest municipi.\n\nVols continuar?`,
          textBoto: 'Importar preguntes',
          esPerillos: false,
          onAcceptar: () => {
            if (typeof window.importarPreguntesMossosAMunicipi === 'function') {
              const res = window.importarPreguntesMossosAMunicipi(municipiActiu, bancoPoliciaLocal);
              if (res.importades > 0) {
                if (typeof window.guardarPreguntas === 'function') {
                  window.guardarPreguntas();
                }
                mostrarToast(`🎉 S'han importat ${res.importades} preguntes oficials de Mossos al banc de «${municipiActiu}»!`, 'success');
              } else {
                mostrarToast(res.missatge || 'Totes les preguntes compatibles ja són presents al banc.', 'info');
              }
              refrestarVista();
            }
          }
        });
      });
    }

    // 9. Test per tema individual d'un municipi (amb suport font PL, Mossos o Tots)
    contenedor.querySelectorAll('.btn-test-tema-pl').forEach(btn => {
      btn.addEventListener('click', () => {
        const temaId = btn.dataset.temaId;
        const titol = btn.dataset.titol;
        const font = btn.dataset.font || 'tots';
        const temaItem = temariActual.find(t => String(t.id) === String(temaId));
        if (!temaItem) return;

        let preguntes = [];
        if (font === 'pl') {
          preguntes = (typeof window.obtenirPreguntesPerTemaPL === 'function')
            ? window.obtenirPreguntesPerTemaPL(municipiActiu, temaItem, bancoPoliciaLocal)
            : [];
        } else if (font === 'mossos') {
          preguntes = (typeof window.obtenirPreguntesMossosPerTemaPL === 'function')
            ? window.obtenirPreguntesMossosPerTemaPL(municipiActiu, temaItem)
            : [];
        } else {
          // 'tots'
          preguntes = (typeof window.obtenirPreguntesTotalsTemaPL === 'function')
            ? window.obtenirPreguntesTotalsTemaPL(municipiActiu, temaItem, bancoPoliciaLocal, modeIntegracioMossos)
            : (typeof window.obtenirPreguntesPerTemaPL === 'function' ? window.obtenirPreguntesPerTemaPL(municipiActiu, temaItem, bancoPoliciaLocal) : []);
        }

        if (!preguntes.length) {
          mostrarToast(`El tema «${titol}» encara no té preguntes. Utilitza el botó ➕ per afegir-ne una!`, 'info');
          return;
        }

        const titolTest = (font === 'mossos')
          ? `[Banc Mossos] ${titol}`
          : `${titol} (${municipiActiu})`;

        mostrarSelectorPreguntas(titolTest, preguntes, false);
      });
    });

    // 10. Test per matèria compartida
    contenedor.querySelectorAll('.btn-test-materia-comp').forEach(btn => {
      btn.addEventListener('click', () => {
        const materiaId = btn.dataset.materia;
        const titol = btn.dataset.titol;
        const preguntes = (typeof window.obtenirPreguntesMateriaCompartida === 'function')
          ? window.obtenirPreguntesMateriaCompartida(materiaId, bancoPoliciaLocal, modeIntegracioMossos)
          : [];
        if (!preguntes.length) {
          mostrarToast(`Aquesta matèria encara no té preguntes associades.`, 'info');
          return;
        }
        mostrarSelectorPreguntas(`Temari Compartit: ${titol}`, preguntes, false);
      });
    });

    // 11. Test barrejat de tot el municipi actiu
    const btnStartPL = document.getElementById('btn-start-pl');
    if (btnStartPL) {
      btnStartPL.addEventListener('click', () => {
        const preguntesMunicipi = (typeof window.obtenirTotesPreguntesMunicipiPL === 'function')
          ? window.obtenirTotesPreguntesMunicipiPL(municipiActiu, bancoPoliciaLocal, modeIntegracioMossos)
          : (typeof window.obtenirTotesPreguntesMunicipiPL === 'function')
          ? window.obtenirTotesPreguntesMunicipiPL(municipiActiu, bancoPoliciaLocal)
          : bancoPoliciaLocal.filter(q => (q.ambit || '').toLowerCase() !== 'cultura general');

        if (!preguntesMunicipi.length) {
          mostrarToast(`Encara no hi ha preguntes disponibles per a «${municipiActiu}».`, 'info');
          return;
        }
        mostrarSelectorPreguntas(`Tots els temes barrejats (${municipiActiu})`, preguntesMunicipi, true);
      });
    }

    // 12. Test barrejat de tot el temari compartit
    const btnStartTotComp = document.getElementById('btn-start-tot-compartit');
    if (btnStartTotComp) {
      btnStartTotComp.addEventListener('click', () => {
        let preguntesTeoria = [];
        if (modeIntegracioMossos && typeof window.obtenirPreguntesMossosPerMateria === 'function') {
          const matIds = (window.MATERIES_COMPARTIDES || []).map(m => m.id);
          const mossosTeoria = matIds.flatMap(id => window.obtenirPreguntesMossosPerMateria(id));
          preguntesTeoria = [...(bancoPoliciaLocal || []).filter(q => (q.ambit || '').toLowerCase() !== 'cultura general'), ...mossosTeoria];
        } else {
          preguntesTeoria = (bancoPoliciaLocal || []).filter(q => (q.ambit || '').toLowerCase() !== 'cultura general');
        }

        if (!preguntesTeoria.length) {
          mostrarToast('Encara no hi ha preguntes de temari compartit disponibles.', 'info');
          return;
        }
        mostrarSelectorPreguntas('Temari Compartit (Totes les matèries troncals)', preguntesTeoria, true);
      });
    }

    // 13. Selector múltiple de temes de l'oposició activa
    const btnMultiplePL = document.getElementById('btn-selector-multiple-pl');
    if (btnMultiplePL) {
      btnMultiplePL.addEventListener('click', () => {
        const preguntesAptes = (typeof window.obtenirTotesPreguntesMunicipiPL === 'function')
          ? window.obtenirTotesPreguntesMunicipiPL(municipiActiu, bancoPoliciaLocal, modeIntegracioMossos)
          : bancoPoliciaLocal;

        mostrarSelectorSeccions(`Selecció de temes (${municipiActiu})`, preguntesAptes, () => refrestarVista());
      });
    }

    // 14. Cultura General
    const btnCultura = document.getElementById('pl-btn-cultura');
    if (btnCultura) {
      btnCultura.addEventListener('click', () => {
        const filtrades = (bancoPoliciaLocal || []).filter(q => {
          const txt = `${q.seccio || ''} ${q.ambit || ''} ${q.tema || ''}`.toLowerCase();
          return txt.includes('cultura');
        });
        if (!filtrades.length) {
          alert('Encara no hi ha preguntes de Cultura General.');
          return;
        }
        mostrarSelectorSeccions('Cultura general (Policia Local)', filtrades, () => refrestarVista());
      });
    }

    actualitzarBotonsRepasErrors();
    actualitzarRatxaUI();
  }

  // Exportar al scope global
  window.renderitzadorTemariPL = renderitzadorTemariPL;

})();

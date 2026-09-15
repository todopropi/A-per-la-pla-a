// ============================================================================
// REPAS D'ERRORS I PREGUNTES GUARDADES (FAVORITS) - AGENT MEDINA
// Sistema complet de repàs de preguntes fallades i guardades per a l'opositor
// amb explicacions pedagògiques enriquides, mnemotècnies i desglossament d'opcions
// ============================================================================

(function () {
  const STORAGE_KEY_GUARDADES = 'opos_preguntes_guardades_v1';
  let preguntesGuardadesCache = null;

  // Carregar preguntes guardades de localStorage
  function carregarGuardades() {
    if (preguntesGuardadesCache !== null) return preguntesGuardadesCache;
    try {
      const raw = localStorage.getItem(STORAGE_KEY_GUARDADES);
      preguntesGuardadesCache = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(preguntesGuardadesCache)) preguntesGuardadesCache = [];
    } catch (e) {
      console.warn('Error llegint preguntes guardades:', e);
      preguntesGuardadesCache = [];
    }
    return preguntesGuardadesCache;
  }

  // Desar preguntes guardades a localStorage
  function desarGuardades(llista) {
    preguntesGuardadesCache = Array.isArray(llista) ? llista : [];
    try {
      localStorage.setItem(STORAGE_KEY_GUARDADES, JSON.stringify(preguntesGuardadesCache));
    } catch (e) {
      console.error('Error desant preguntes guardades:', e);
    }
    actualitzarComptadorsGuardadesUI();
  }

  // Obtenir totes les preguntes guardades
  window.obtenirPreguntesGuardades = function () {
    return carregarGuardades();
  };

  // Comprovar si una pregunta està guardada
  window.esPreguntaGuardada = function (id) {
    if (!id) return false;
    const llista = carregarGuardades();
    return llista.some(q => String(q.id) === String(id));
  };

  // Guardar una pregunta
  window.guardarPregunta = function (preguntaObj) {
    if (!preguntaObj) return false;
    const id = preguntaObj.id || `custom_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const llista = carregarGuardades();
    const existeix = llista.some(q => String(q.id) === String(id));
    if (!existeix) {
      const nova = {
        id: id,
        pregunta: preguntaObj.pregunta || '',
        opcions: Array.isArray(preguntaObj.opcions) ? [...preguntaObj.opcions] : [],
        resposta: typeof preguntaObj.resposta === 'number' ? preguntaObj.resposta : 0,
        explicacio: preguntaObj.explicacio || '',
        ambit: preguntaObj.ambit || '',
        seccio: preguntaObj.seccio || preguntaObj.tema || '',
        _font: preguntaObj._font || (typeof detectarFontPregunta === 'function' ? detectarFontPregunta(preguntaObj) : 'Mossos'),
        dataGuardada: Date.now()
      };
      llista.unshift(nova);
      desarGuardades(llista);
      return true;
    }
    return false;
  };

  // Eliminar una pregunta guardada
  window.eliminarPreguntaGuardada = function (id) {
    if (!id) return false;
    let llista = carregarGuardades();
    const abans = llista.length;
    llista = llista.filter(q => String(q.id) !== String(id));
    if (llista.length !== abans) {
      desarGuardades(llista);
      return true;
    }
    return false;
  };

  // Alternar guardar / desguardar pregunta amb feedback visual
  window.alternarGuardarPregunta = function (preguntaObjOrId, btnEl) {
    let id = null;
    let obj = null;

    if (typeof preguntaObjOrId === 'object' && preguntaObjOrId !== null) {
      obj = preguntaObjOrId;
      id = obj.id;
    } else if (typeof preguntaObjOrId === 'string' || typeof preguntaObjOrId === 'number') {
      id = String(preguntaObjOrId);
      // Buscar objecte a la llista guardada o bancs globals
      obj = carregarGuardades().find(q => String(q.id) === id);
      if (!obj && window.bancoPreguntes) {
        obj = window.bancoPreguntes.find(q => String(q.id) === id);
      }
      if (!obj && window.bancoPoliciaLocal) {
        obj = window.bancoPoliciaLocal.find(q => String(q.id) === id);
      }
      if (!obj && window.bancoActualitat) {
        obj = window.bancoActualitat.find(q => String(q.id) === id);
      }
    }

    if (!id && !obj) {
      console.warn('No s\'ha pogut identificar la pregunta per guardar.');
      return;
    }

    const jaGuardada = window.esPreguntaGuardada(id);
    let estatFinal = false;

    if (jaGuardada) {
      window.eliminarPreguntaGuardada(id);
      estatFinal = false;
      if (typeof window.mostrarToast === 'function') {
        window.mostrarToast('☆ Pregunta eliminada de les teves guardades.', 'info');
      }
    } else {
      if (obj) {
        window.guardarPregunta(obj);
      } else {
        window.guardarPregunta({ id: id, pregunta: 'Pregunta #' + id, opcions: [], resposta: 0 });
      }
      estatFinal = true;
      if (typeof window.mostrarToast === 'function') {
        window.mostrarToast('⭐ Pregunta guardada als teus favorits per repassar!', 'success');
      }
    }

    // Actualitzar tots els botons que facin referència a aquest ID a la pàgina
    sincronitzarBotonsGuardar(id, estatFinal);
    return estatFinal;
  };

  // Sincronitzar estil de tots els botons que controlen aquesta pregunta
  function sincronitzarBotonsGuardar(id, esGuardada) {
    const selectors = [
      `[data-guardar-id="${id}"]`,
      `button.btn-guardar-star[data-id="${id}"]`
    ];
    document.querySelectorAll(selectors.join(',')).forEach(btn => {
      aplicarEstilBotoGuardar(btn, esGuardada);
    });
  }

  function aplicarEstilBotoGuardar(btn, esGuardada) {
    if (!btn) return;
    if (esGuardada) {
      btn.classList.add('guardada');
      btn.innerHTML = '⭐ <span class="lbl-guardar">Guardada</span>';
      btn.style.background = '#fef3c7';
      btn.style.borderColor = '#f59e0b';
      btn.style.color = '#b45309';
      btn.setAttribute('title', 'Eliminar de les preguntes guardades');
    } else {
      btn.classList.remove('guardada');
      btn.innerHTML = '☆ <span class="lbl-guardar">Guardar</span>';
      btn.style.background = 'var(--bg-card-subtle, #f8fafc)';
      btn.style.borderColor = 'var(--border-card, #cbd5e1)';
      btn.style.color = 'var(--text-muted, #475569)';
      btn.setAttribute('title', 'Guardar per revisar quan vulguis');
    }
  }

  // Actualitzar comptadors a la interfície (topbar, targetes d'inici)
  function actualitzarComptadorsGuardadesUI() {
    const total = carregarGuardades().length;
    const badges = document.querySelectorAll('.comptador-preguntes-guardades');
    badges.forEach(el => {
      el.textContent = total;
    });
    const lblTopbar = document.getElementById('lbl-topbar-guardades-count');
    if (lblTopbar) {
      lblTopbar.textContent = `${total} guardad${total === 1 ? 'a' : 'es'}`;
    }
    const cardIniciCount = document.getElementById('card-inici-guardades-count');
    if (cardIniciCount) {
      cardIniciCount.textContent = `${total} pregunt${total === 1 ? 'a' : 'es'}`;
    }
  }

  // ============================================================================
  // GENERADOR D'EXPLICACIONS PEDAGÒGIQUES ENRIQUIDES (Visuals, Mnemotècnies, Opcions)
  // ============================================================================

  const LLETRES = ['A', 'B', 'C', 'D', 'E', 'F'];

  // Base de coneixement de mnemotècnies i desglossaments visuals d'alta freqüència a examen
  function cercarPatroMnemotecnic(preguntaObj) {
    const textComplet = `${preguntaObj.pregunta || ''} ${(preguntaObj.opcions || []).join(' ')} ${preguntaObj.explicacio || ''}`.toLowerCase();

    // 1. Escales de la Policia de la Generalitat - Mossos d'Esquadra
    if (textComplet.includes('escala') && (textComplet.includes('mossos') || textComplet.includes('pg-me') || textComplet.includes('intermèdia') || textComplet.includes('executiva') || textComplet.includes('bàsica') || textComplet.includes('superior'))) {
      return {
        tipus: 'escales_pgme',
        titolQuadre: '🏛️ Escales i Categories de la PG-ME (Llei 10/1994, Art. 19)',
        contingutHtml: `
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:8px;margin-top:8px;">
            <div style="background:#eff6ff;border:1px solid #bfdbfe;padding:8px 10px;border-radius:8px;font-size:12px;">
              <b style="color:#1d4ed8;">🔰 Escala bàsica:</b><br>• Mosso/a<br>• Caporal
            </div>
            <div style="background:#ecfdf5;border:1.5px solid #10b981;padding:8px 10px;border-radius:8px;font-size:12px;">
              <b style="color:#047857;">👮 Escala intermèdia:</b><br>• Sergent/a<br>• Sotsinspector/a
            </div>
            <div style="background:#fef3c7;border:1px solid #fcd34d;padding:8px 10px;border-radius:8px;font-size:12px;">
              <b style="color:#b45309;">👔 Escala executiva:</b><br>• Inspector/a
            </div>
            <div style="background:#fdf2f8;border:1px solid #fbcfe8;padding:8px 10px;border-radius:8px;font-size:12px;">
              <b style="color:#be185d;">🌟 Escala superior:</b><br>• Intendent/a<br>• Comissari/a<br>• Major
            </div>
          </div>
          <div style="font-size:11px;color:#64748b;margin-top:6px;">
            *Nota: L'<b>Escala de suport</b> comprèn les categories de facultatius i tècnics.
          </div>
        `,
        mnemotecnia: 'Regla <b>B-I-E-S</b> (de baix a dalt): <b>B</b>àsica (Agent, Caporal) ➔ <b>I</b>ntermèdia (Sergent, Sotsinspector) ➔ <b>E</b>xecutiva (Inspector) ➔ <b>S</b>uperior (Intendent, Comissari, Major).'
      };
    }

    // 2. Nivells d'estructura organitzativa dels Mossos d'Esquadra (Decret d'estructura)
    if ((textComplet.includes('òrgan') || textComplet.includes('estructura') || textComplet.includes('nivell organitzatiu')) && (textComplet.includes('adscriu') || textComplet.includes('divisió') || textComplet.includes('àrea') || textComplet.includes('unitat') || textComplet.includes('grup'))) {
      return {
        tipus: 'estructura_pgme',
        titolQuadre: '🏢 Jerarquia d\'Òrgans Organitzatius de la PG-ME',
        contingutHtml: `
          <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px;font-size:12px;">
            <div style="background:#f1f5f9;border:1px solid #cbd5e1;padding:6px 10px;border-radius:6px;"><b>1. Prefectura / Comissaries Generals:</b> Òrgan superior de comandament i direcció estratègica.</div>
            <div style="background:#eff6ff;border:1px solid #bfdbfe;padding:6px 10px;border-radius:6px;"><b>2. Divisió:</b> Nivel intermedi superior dels serveis centrals.</div>
            <div style="background:#fef3c7;border:1px solid #fcd34d;padding:6px 10px;border-radius:6px;"><b>3. Àrea:</b> Agrupa diverses unitats policials operatives o de suport (àmbit central o territorial).</div>
            <div style="background:#ecfdf5;border:1.5px solid #10b981;padding:6px 10px;border-radius:6px;"><b>4. Unitat:</b> Cèl·lula operativa bàsica de treball policial.</div>
            <div style="background:#fdf2f8;border:1.5px solid #ec4899;padding:6px 10px;border-radius:6px;"><b>5. Grup / Subgrup:</b> S'adscriu sempre a una <u>Unitat</u> per a tasques específiques.</div>
          </div>
        `,
        mnemotecnia: 'Ordre decreixent d\'òrgans: <b>D-À-U-G</b> ➔ <b>D</b>ivisió > <b>À</b>rea > <b>U</b>nitat > <b>G</b>rup. El <b>Grup</b> sempre "viu" dins de la <b>Unitat</b>.'
      };
    }

    // 3. Terminis legals i de detenció (Constitució Art. 17 i LECrim)
    if (textComplet.includes('detenció') || textComplet.includes('habeas corpus') || textComplet.includes('72 h') || textComplet.includes('72 hores') || textComplet.includes('termini')) {
      return {
        tipus: 'terminis_detencio',
        titolQuadre: '⏱️ Terminis Clau de Detenció i Habeas Corpus',
        contingutHtml: `
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px;margin-top:8px;font-size:12px;">
            <div style="background:#eff6ff;border:1px solid #bfdbfe;padding:8px;border-radius:8px;">
              <b>Detenció preventiva ordinària:</b><br>Temps estrictament necessari, límit màxim <b>72 hores</b> (CE Art. 17.2).
            </div>
            <div style="background:#fef2f2;border:1px solid #fecaca;padding:8px;border-radius:8px;">
              <b>Menors d'edat (LO 5/2000):</b><br>Màxim <b>24 hores</b> per posar a disposició de Fiscalia de Menors.
            </div>
            <div style="background:#ecfdf5;border:1px solid #a7f3d0;padding:8px;border-radius:8px;">
              <b>Habeas Corpus (LO 6/1984):</b><br>El jutge té un termini de <b>24 hores</b> des de l'auto de sol·licitud.
            </div>
            <div style="background:#fef3c7;border:1px solid #fde68a;padding:8px;border-radius:8px;">
              <b>Terrorisme (Art. 520 bis LECrim):</b><br>Pròrroga judicial possible de <b>48 hores addicionals</b> (total 120h).
            </div>
          </div>
        `,
        mnemotecnia: 'Recorda els números clau: <b>72h</b> (detenció màxima general) | <b>24h</b> (menors i resolució Habeas Corpus) | <b>+48h</b> (pròrroga terrorisme).'
      };
    }

    // 4. Taxes d'alcoholèmia (RGC Art. 20 i Codi Penal Art. 379)
    if (textComplet.includes('alcohol') || textComplet.includes('taxa') || textComplet.includes('aire espirat') || textComplet.includes('0,25') || textComplet.includes('0,15')) {
      return {
        tipus: 'taxes_alcohol',
        titolQuadre: '🍺 Taxes d\'Alcoholèmia: Administrativa vs Penal',
        contingutHtml: `
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:8px;margin-top:8px;font-size:12px;">
            <div style="background:#eff6ff;border:1px solid #bfdbfe;padding:8px;border-radius:8px;">
              <b>Condutors Generals:</b><br>• Aire: <b>0,25 mg/l</b><br>• Sang: <b>0,50 g/l</b>
            </div>
            <div style="background:#ecfdf5;border:1px solid #a7f3d0;padding:8px;border-radius:8px;">
              <b>Professionals i Novells (&lt;2 anys):</b><br>• Aire: <b>0,15 mg/l</b><br>• Sang: <b>0,30 g/l</b>
            </div>
            <div style="background:#fee2e2;border:1.5px solid #ef4444;padding:8px;border-radius:8px;">
              <b>Delicte Penal (Art. 379.2 CP):</b><br>• Aire: <b>&gt; 0,60 mg/l</b><br>• Sang: <b>&gt; 1,20 g/l</b>
            </div>
          </div>
        `,
        mnemotecnia: 'Relació aire-sang és sempre <b>x2</b>: 0,25 aire = 0,50 sang | 0,15 aire = 0,30 sang | 0,60 aire (penal) = 1,20 sang.'
      };
    }

    // 5. Delictes contra el patrimoni (Furt vs Robatori)
    if (textComplet.includes('furt') || textComplet.includes('robatori amb força') || textComplet.includes('violència o intimidació') || textComplet.includes('400')) {
      return {
        tipus: 'furt_robatori',
        titolQuadre: '💰 Distinció Jurídica: Furt vs Robatori (Codi Penal)',
        contingutHtml: `
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:8px;margin-top:8px;font-size:12px;">
            <div style="background:#eff6ff;border:1px solid #bfdbfe;padding:8px;border-radius:8px;">
              <b>Furt (Art. 234 CP):</b><br>Prendre coses mobles sense violència ni força.<br>• ≤ 400 €: Delicte lleu.<br>• &gt; 400 €: Delicte menys greu.
            </div>
            <div style="background:#fef3c7;border:1px solid #fde68a;padding:8px;border-radius:8px;">
              <b>Robatori amb Força (Art. 238 CP):</b><br>Escalament, fractura, claus falses o desactivació d'alarmes (importa la forma, no el valor).
            </div>
            <div style="background:#fee2e2;border:1px solid #fca5a5;padding:8px;border-radius:8px;">
              <b>Robatori amb Violència/Intimidació (Art. 242 CP):</b><br>Sempre sobre persones físiques. Absorbirà el furt o l'ús de força.
            </div>
          </div>
        `,
        mnemotecnia: 'La frontera econòmica és <b>400 €</b> (només en el furt!). Si hi ha força en les coses o violència/intimidació a les persones, sempre és <b>Robatori</b> independentment del valor.'
      };
    }

    return null;
  }

  // Generador principal del bloc d'explicació enriquida
  window.generarExplicacioPedagogicaCompleta = function (preguntaObj, nouIndexCorrecte, indexTriat, esCorrecte) {
    if (!preguntaObj) return '';

    const id = preguntaObj.id || '';
    const esGuardada = window.esPreguntaGuardada(id);
    const explicacioBase = (preguntaObj.explicacio || '').trim();
    const opcions = Array.isArray(preguntaObj.opcions) ? preguntaObj.opcions : [];
    const idxCorrecteOriginal = typeof preguntaObj.resposta === 'number' ? preguntaObj.resposta : 0;
    const textRespostaCorrecta = opcions[idxCorrecteOriginal] || '';

    // Patró mnemotècnic especialitzat si coincideix
    const patro = cercarPatroMnemotecnic(preguntaObj);

    // Desglossament d'opcions: per què són correctes o incorrectes
    let llistatOpcionsHtml = '';
    if (opcions.length > 0) {
      llistatOpcionsHtml = `
        <div style="margin-top:10px;background:var(--bg-card-subtle,#f8fafc);border:1px solid var(--border-card,#e2e8f0);border-radius:10px;padding:12px;">
          <div style="font-size:12px;font-weight:800;color:var(--text-main,#1e293b);margin-bottom:8px;display:flex;align-items:center;gap:6px;">
            <span>🔍</span> <span>Desglossament de les opcions:</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;font-size:12.5px;">
            ${opcions.map((op, idx) => {
              const esAquestaCorrecta = idx === idxCorrecteOriginal;
              const esAquestaTriada = indexTriat !== undefined && idx === indexTriat;
              let badge = '';
              let bgItem = 'transparent';
              let colorItem = 'inherit';

              if (esAquestaCorrecta) {
                badge = '<span style="background:#10b981;color:white;padding:1px 6px;border-radius:4px;font-size:10.5px;font-weight:800;margin-left:auto;">✓ RESPOSTA OFICIAL</span>';
                bgItem = 'rgba(16,185,129,0.12)';
                colorItem = 'var(--text-correct, #065f46)';
              } else if (esAquestaTriada && !esAquestaCorrecta) {
                badge = '<span style="background:#ef4444;color:white;padding:1px 6px;border-radius:4px;font-size:10.5px;font-weight:800;margin-left:auto;">✗ La teva tria (incorrecta)</span>';
                bgItem = 'rgba(239,68,68,0.12)';
                colorItem = 'var(--text-incorrect, #991b1b)';
              } else {
                badge = '<span style="color:var(--text-muted,#94a3b8);font-size:11px;margin-left:auto;">Incorrecta</span>';
              }

              return `
                <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:8px;background:${bgItem};color:${colorItem};">
                  <span style="font-weight:800;width:18px;">${LLETRES[idx] || idx + 1})</span>
                  <span style="flex:1;font-weight:600;">${escapeHtml(op)}</span>
                  ${badge}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    // Quadre visual addicional si tenim patró mnemotècnic
    let blocVisualHtml = '';
    if (patro) {
      blocVisualHtml = `
        <div style="margin-top:12px;background:var(--bg-card,#ffffff);border:1.5px solid #007aff;border-radius:12px;padding:14px;box-shadow:0 2px 8px rgba(0,122,255,0.08);">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px;">
            <span style="font-size:13px;font-weight:800;color:var(--text-main,#002B5E);">${patro.titolQuadre}</span>
            <span style="font-size:11px;background:rgba(0,122,255,0.12);color:#38bdf8;padding:2px 8px;border-radius:999px;font-weight:700;">Quadre per memoritzar</span>
          </div>
          ${patro.contingutHtml}
          ${patro.mnemotecnia ? `
            <div style="margin-top:10px;padding:10px 14px;background:var(--bg-card-subtle, #f8fafc);border-left:4px solid #f59e0b;border-radius:6px;font-size:12.5px;color:var(--text-main, #92400e);line-height:1.45;">
              🧠 <b>Com recordar per a l'examen:</b> ${patro.mnemotecnia}
            </div>
          ` : ''}
        </div>
      `;
    }

    // Barra d'accions: Guardar als favorits + Preguntar a la IA
    const accionsHtml = `
      <div style="margin-top:14px;padding-top:12px;border-top:1px dashed ${esCorrecte ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'};display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <button type="button" 
                  class="btn-guardar-star" 
                  data-id="${escapeHtml(id)}"
                  onclick="window.alternarGuardarPregunta(${JSON.stringify(preguntaObj)}, this)"
                  style="border:1.5px solid ${esGuardada ? '#f59e0b' : 'var(--border-card,#cbd5e1)'};background:${esGuardada ? 'rgba(245,158,11,0.15)' : 'var(--bg-card,#ffffff)'};color:${esGuardada ? '#f59e0b' : 'var(--text-main,#475569)'};border-radius:8px;padding:6px 14px;font-size:12.5px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all 0.15s ease;"
                  title="Guarda aquesta pregunta per repassar-la quan vulguis">
            ${esGuardada ? '⭐ <span class="lbl-guardar">Guardada a Repàs</span>' : '☆ <span class="lbl-guardar">Guardar pregunta</span>'}
          </button>
        </div>

        <button type="button" 
                class="btn-ia-feedback-ask" 
                style="background:linear-gradient(135deg, ${esCorrecte ? '#059669, #10b981' : '#dc2626, #ef4444'});color:#fff;border:none;border-radius:8px;padding:7px 14px;font-size:12.5px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:6px;box-shadow:0 2px 8px rgba(0,0,0,0.15);">
          <span>✨</span> <span>Pregunta a la IA (Agent Medina)</span>
        </button>
      </div>
    `;

    return `
      <div class="explicacio-pedagogica-card" style="background:${esCorrecte ? 'rgba(16,185,129,0.10)' : 'rgba(239,68,68,0.10)'};border:1.5px solid ${esCorrecte ? '#10b981' : '#ef4444'};padding:18px 20px;border-radius:14px;color:var(--text-main,#0f172a);margin-bottom:16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:8px;">
          <p style="margin:0;font-weight:800;font-size:15px;color:${esCorrecte ? 'var(--text-correct, #065f46)' : 'var(--text-incorrect, #991b1b)'};display:flex;align-items:center;gap:6px;">
            <span>${esCorrecte ? '✅ Resposta Correcta!' : '❌ Resposta Incorrecta.'}</span>
          </p>
          ${preguntaObj.seccio || preguntaObj.ambit ? `<span style="font-size:11px;color:var(--text-muted,#64748b);font-weight:700;background:rgba(255,255,255,0.06);padding:2px 8px;border-radius:6px;border:1px solid var(--border-card, #e2e8f0);">${escapeHtml(preguntaObj.seccio || preguntaObj.ambit)}</span>` : ''}
        </div>

        ${explicacioBase ? `
          <div style="margin:0 0 10px 0;font-size:14px;line-height:1.55;color:var(--text-main,#1e293b);background:var(--bg-card,#ffffff);border:1px solid var(--border-card,#e2e8f0);padding:10px 14px;border-radius:8px;">
            💡 <b>Justificació oficial:</b> ${escapeHtml(explicacioBase)}
          </div>
        ` : ''}

        ${llistatOpcionsHtml}
        ${blocVisualHtml}
        ${accionsHtml}
      </div>
    `;
  };

  // ============================================================================
  // MODAL / PANTALLA DE REPÀS D'ERRORS I PREGUNTES GUARDADES
  // ============================================================================

  window.obrirModalRepasIGuardades = function (pestanyaActiva = 'guardades') {
    let modal = document.getElementById('modal-repas-guardades');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modal-repas-guardades';
      modal.style.cssText = `
        position: fixed; inset: 0; background: rgba(15,23,42,0.7); backdrop-filter: blur(4px);
        z-index: 99999; display: flex; align-items: center; justify-content: center; padding: 16px;
      `;
      document.body.appendChild(modal);
    }

    renderitzarContingutModalRepas(modal, pestanyaActiva);
    modal.style.display = 'flex';
  };

  window.tancarModalRepasIGuardades = function () {
    const modal = document.getElementById('modal-repas-guardades');
    if (modal) modal.style.display = 'none';
  };

  function renderitzarContingutModalRepas(modal, pestanyaActiva) {
    const guardades = carregarGuardades();
    const errors = (typeof window.obtenirTotesLesPreguntesFallades === 'function') 
      ? window.obtenirTotesLesPreguntesFallades() 
      : [];

    modal.innerHTML = `
      <div style="background: var(--bg-card, #ffffff); border: 1.5px solid var(--border-card, #e2e8f0); border-radius: 20px; width: 100%; max-width: 820px; max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.25);">
        
        <!-- Capçalera del Modal -->
        <div style="padding: 18px 24px; border-bottom: 1.5px solid var(--border-card, #e2e8f0); display: flex; align-items: center; justify-content: space-between; background: var(--bg-card-subtle, #f8fafc);">
          <div>
            <h3 style="margin: 0; font-size: 18px; font-weight: 800; color: var(--text-main, #0f172a); display: flex; align-items: center; gap: 8px;">
              <span>📚</span> <span>Centre de Repàs Personal</span>
            </h3>
            <p style="margin: 3px 0 0; font-size: 12.5px; color: var(--text-muted, #64748b);">
              Gestiona les teves preguntes guardades i posa el focus en els errors pendents.
            </p>
          </div>
          <button onclick="window.tancarModalRepasIGuardades()" style="background: transparent; border: none; font-size: 22px; cursor: pointer; color: var(--text-muted, #94a3b8); width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 8px;">
            ✕
          </button>
        </div>

        <!-- Botons de Pestanya -->
        <div style="display: flex; border-bottom: 1px solid var(--border-card, #e2e8f0); background: var(--bg-card, #ffffff); padding: 0 20px;">
          <button id="tab-btn-guardades" onclick="window.canviarPestanyaRepas('guardades')" style="padding: 12px 18px; background: transparent; border: none; border-bottom: 3px solid ${pestanyaActiva === 'guardades' ? '#f59e0b' : 'transparent'}; color: ${pestanyaActiva === 'guardades' ? '#b45309' : '#64748b'}; font-weight: 800; font-size: 13.5px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
            <span>⭐ Preguntes Guardades</span>
            <span style="background: ${pestanyaActiva === 'guardades' ? '#fef3c7' : '#e2e8f0'}; color: ${pestanyaActiva === 'guardades' ? '#b45309' : '#475569'}; padding: 2px 7px; border-radius: 999px; font-size: 11px;">
              ${guardades.length}
            </span>
          </button>
          <button id="tab-btn-errors" onclick="window.canviarPestanyaRepas('errors')" style="padding: 12px 18px; background: transparent; border: none; border-bottom: 3px solid ${pestanyaActiva === 'errors' ? '#ef4444' : 'transparent'}; color: ${pestanyaActiva === 'errors' ? '#dc2626' : '#64748b'}; font-weight: 800; font-size: 13.5px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
            <span>🔁 Repàs d'Errors</span>
            <span style="background: ${pestanyaActiva === 'errors' ? '#fee2e2' : '#e2e8f0'}; color: ${pestanyaActiva === 'errors' ? '#dc2626' : '#475569'}; padding: 2px 7px; border-radius: 999px; font-size: 11px;">
              ${errors.length}
            </span>
          </button>
        </div>

        <!-- Cos del Modal amb Scroll -->
        <div id="modal-repas-body" style="padding: 20px 24px; overflow-y: auto; flex: 1;">
          ${pestanyaActiva === 'guardades' ? renderitzarSeccioGuardades(guardades) : renderitzarSeccioErrors(errors)}
        </div>
      </div>
    `;
  }

  window.canviarPestanyaRepas = function (pestanya) {
    const modal = document.getElementById('modal-repas-guardades');
    if (modal) renderitzarContingutModalRepas(modal, pestanya);
  };

  // Renderització de la llista de preguntes guardades
  function renderitzarSeccioGuardades(guardades) {
    if (!guardades || guardades.length === 0) {
      return `
        <div style="text-align: center; padding: 40px 20px; color: var(--text-muted, #64748b);">
          <div style="font-size: 46px; margin-bottom: 12px;">⭐</div>
          <h4 style="margin: 0 0 8px; color: var(--text-main, #0f172a); font-size: 17px;">Encara no tens cap pregunta guardada</h4>
          <p style="font-size: 13.5px; max-width: 460px; margin: 0 auto 20px; line-height: 1.5;">
            Quan facis qualsevol test o simulacre, clica el botó <b>☆ Guardar pregunta</b> per afegir les preguntes que vulguis revisar més endavant.
          </p>
          <button onclick="window.tancarModalRepasIGuardades()" style="background: #007aff; color: white; border: none; padding: 10px 20px; border-radius: 10px; font-weight: 700; cursor: pointer;">
            Entesos, anar als tests
          </button>
        </div>
      `;
    }

    return `
      <div>
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
          <div>
            <h4 style="margin: 0; font-size: 15px; color: var(--text-main, #0f172a);">
              Tens <b>${guardades.length}</b> pregunt${guardades.length === 1 ? 'a guardada' : 'es guardades'} per estudiar
            </h4>
            <p style="margin: 2px 0 0; font-size: 12px; color: var(--text-muted, #64748b);">
              Pots practicar-les en mode test o consultar les respostes i explicacions directament.
            </p>
          </div>
          <button onclick="window.iniciarRepasPreguntesGuardades()" style="background: linear-gradient(135deg, #f59e0b, #d97706); color: white; border: none; padding: 10px 18px; border-radius: 10px; font-weight: 800; font-size: 13.5px; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 4px 12px rgba(245,158,11,0.3);">
            <span>🚀 Practicar Test de Guardades</span>
          </button>
        </div>

        <div style="display: flex; flex-direction: column; gap: 12px;">
          ${guardades.map((q, idx) => `
            <div style="background: var(--bg-card-subtle, #f8fafc); border: 1.5px solid var(--border-card, #e2e8f0); border-radius: 12px; padding: 14px 16px;">
              <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin-bottom: 8px;">
                <span style="font-size: 11px; font-weight: 800; color: #b45309; background: #fef3c7; padding: 2px 8px; border-radius: 999px;">
                  ⭐ #${idx + 1} · ${escapeHtml(q.seccio || q.ambit || 'Pregunta guardada')}
                </span>
                <button onclick="window.eliminarPreguntaGuardada('${escapeHtml(q.id)}'); window.canviarPestanyaRepas('guardades');" style="background: transparent; border: 1px solid #cbd5e1; border-radius: 6px; padding: 2px 8px; font-size: 11px; color: #ef4444; cursor: pointer;" title="Eliminar de les guardades">
                  🗑 Desmarcar
                </button>
              </div>

              <div style="font-size: 14px; font-weight: 700; color: var(--text-main, #0f172a); margin-bottom: 8px; line-height: 1.45;">
                ${escapeHtml(q.pregunta)}
              </div>

              ${Array.isArray(q.opcions) && q.opcions.length > 0 ? `
                <div style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px; font-size: 12px;">
                  ${q.opcions.map((op, oIdx) => `
                    <div style="padding: 4px 8px; border-radius: 6px; background: ${oIdx === q.resposta ? 'rgba(16,185,129,0.1)' : 'transparent'}; color: ${oIdx === q.resposta ? '#065f46' : 'var(--text-muted,#475569)'}; font-weight: ${oIdx === q.resposta ? '700' : '400'};">
                      ${LLETRES[oIdx] || oIdx + 1}) ${escapeHtml(op)} ${oIdx === q.resposta ? '✅' : ''}
                    </div>
                  `).join('')}
                </div>
              ` : ''}

              ${q.explicacio ? `
                <div style="font-size: 12px; color: #0284c7; background: #f0f9ff; border: 1px solid #bae6fd; padding: 6px 10px; border-radius: 6px;">
                  💡 ${escapeHtml(q.explicacio)}
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // Renderització de la secció de repàs d'errors
  function renderitzarSeccioErrors(errors) {
    if (!errors || errors.length === 0) {
      return `
        <div style="text-align: center; padding: 40px 20px; color: var(--text-muted, #64748b);">
          <div style="font-size: 46px; margin-bottom: 12px;">🎉</div>
          <h4 style="margin: 0 0 8px; color: var(--text-main, #0f172a); font-size: 17px;">No tens cap error pendent!</h4>
          <p style="font-size: 13.5px; max-width: 460px; margin: 0 auto 20px; line-height: 1.5;">
            Has encertat totes les preguntes o encara no has registrat cap fallada en els tests. Continua així!
          </p>
          <button onclick="window.tancarModalRepasIGuardades()" style="background: #10b981; color: white; border: none; padding: 10px 20px; border-radius: 10px; font-weight: 700; cursor: pointer;">
            Tornar als tests
          </button>
        </div>
      `;
    }

    return `
      <div>
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
          <div>
            <h4 style="margin: 0; font-size: 15px; color: var(--text-main, #0f172a);">
              Tens <b>${errors.length}</b> pregunt${errors.length === 1 ? 'a fallada' : 'es fallades'} pendents de dominar
            </h4>
            <p style="margin: 2px 0 0; font-size: 12px; color: var(--text-muted, #64748b);">
              Aquestes preguntes s'eliminen automàticament de la llista quan les encertes al repàs.
            </p>
          </div>
          <div style="display: flex; gap: 8px;">
            <button onclick="window.tancarModalRepasIGuardades(); if(typeof window.iniciarRepasErrorsTots==='function') window.iniciarRepasErrorsTots();" style="background: linear-gradient(135deg, #ef4444, #dc2626); color: white; border: none; padding: 10px 18px; border-radius: 10px; font-weight: 800; font-size: 13.5px; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 4px 12px rgba(239,68,68,0.3);">
              <span>🚀 Practicar Repàs d'Errors</span>
            </button>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 12px;">
          ${errors.slice(0, 30).map((q, idx) => `
            <div style="background: var(--bg-card-subtle, #f8fafc); border: 1.5px solid var(--border-card, #e2e8f0); border-radius: 12px; padding: 14px 16px;">
              <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin-bottom: 8px;">
                <span style="font-size: 11px; font-weight: 800; color: #b91c1c; background: #fee2e2; padding: 2px 8px; border-radius: 999px;">
                  ❌ #${idx + 1} · ${q.errorCount ? `${q.errorCount} fallades` : 'Error registrat'}
                </span>
                <span style="font-size: 11px; color: #64748b;">${escapeHtml(q.seccio || q.ambit || '')}</span>
              </div>
              <div style="font-size: 14px; font-weight: 700; color: var(--text-main, #0f172a); margin-bottom: 6px; line-height: 1.45;">
                ${escapeHtml(q.pregunta)}
              </div>
              ${q.explicacio ? `
                <div style="font-size: 12px; color: #0284c7; background: #f0f9ff; border: 1px solid #bae6fd; padding: 6px 10px; border-radius: 6px;">
                  💡 ${escapeHtml(q.explicacio)}
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // ============================================================================
  // MOTOR DE PRÀCTICA PER A PREGUNTES GUARDADES
  // ============================================================================

  window.iniciarRepasPreguntesGuardades = function () {
    const preguntes = carregarGuardades();
    if (!preguntes || preguntes.length === 0) {
      if (typeof window.mostrarToast === 'function') {
        window.mostrarToast('No tens cap pregunta guardada per repassar.', 'info');
      } else {
        alert('No tens cap pregunta guardada per repassar.');
      }
      return;
    }

    window.tancarModalRepasIGuardades();

    // Utilitzar el contenidor principal de l'app
    let view = document.getElementById('view-inici');
    if (!view) return;

    // Assegurar pestanya inici activa
    document.querySelectorAll('.view-content').forEach(v => v.style.display = 'none');
    view.style.display = 'block';

    let index = 0;
    let encerts = 0;
    let fallades = 0;

    function render() {
      if (index >= preguntes.length) {
        view.innerHTML = `
          <div style="max-width: 820px; margin: 0 auto; padding: 30px 16px 80px;">
            <div style="background: var(--bg-card, #ffffff); border: 1.5px solid var(--border-card, #e2e8f0); border-radius: 20px; padding: 36px 24px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.06);">
              <div style="font-size: 52px; margin-bottom: 12px;">🏆</div>
              <h2 style="color: var(--text-main, #0f172a); margin: 0 0 8px; font-size: 22px;">
                Repàs de preguntes guardades finalitzat!
              </h2>
              <p style="color: var(--text-muted, #64748b); font-size: 14.5px; margin: 0 0 20px;">
                Has revisat les <b>${preguntes.length}</b> preguntes guardades.
              </p>
              <div style="display: flex; justify-content: center; gap: 18px; margin-bottom: 24px;">
                <div style="background: #ecfdf5; border: 1px solid #a7f3d0; padding: 10px 20px; border-radius: 10px; color: #065f46; font-weight: 800;">
                  ✅ Encertades: ${encerts}
                </div>
                <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 10px 20px; border-radius: 10px; color: #991b1b; font-weight: 800;">
                  ❌ Fallades: ${fallades}
                </div>
              </div>
              <button onclick="if(typeof tornarAInici==='function') tornarAInici(); else location.reload();" style="background: #007aff; color: white; border: none; padding: 12px 28px; border-radius: 10px; font-weight: 800; font-size: 14.5px; cursor: pointer; box-shadow: 0 4px 14px rgba(0,122,255,0.3);">
                🏠 Tornar a Inici
              </button>
            </div>
          </div>
        `;
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      const q = preguntes[index];
      const opcionsCopy = [...q.opcions];
      const respostaText = q.opcions[q.resposta];

      // Barrejar opcions per evitar memorització per posició
      if (typeof barrejarArray === 'function') {
        barrejarArray(opcionsCopy);
      }
      const nouIndexCorrecte = opcionsCopy.indexOf(respostaText);

      view.innerHTML = `
        <div style="max-width: 820px; margin: 0 auto; padding: 16px 16px 80px;">
          <!-- Barra superior del test de guardades -->
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 12.5px; font-weight: 800; color: #b45309; background: #fef3c7; border: 1px solid #fde68a; padding: 4px 12px; border-radius: 999px;">
                ⭐ REPÀS DE GUARDADES · Pregunta ${index + 1} de ${preguntes.length}
              </span>
            </div>
            <button onclick="if(typeof tornarAInici==='function') tornarAInici(); else location.reload();" style="background: var(--bg-card-subtle, #e2e8f0); color: var(--text-main, #334155); border: none; padding: 6px 14px; border-radius: 8px; font-size: 12.5px; font-weight: 700; cursor: pointer;">
              ✕ Sortir
            </button>
          </div>

          <!-- Targeta de la pregunta -->
          <div class="pregunta-box" style="background: var(--bg-card, #ffffff); padding: 26px 24px; border-radius: 18px; border: 1.5px solid var(--border-card, #e2e8f0); box-shadow: var(--shadow-card);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 16px;">
              <h3 style="margin: 0; color: var(--text-main, #0f172a); font-size: 17px; line-height: 1.5; font-weight: 800;">
                ${escapeHtml(q.pregunta)}
              </h3>
              <button type="button" class="btn-ia-dubte-head" onclick="if(typeof window.obrirModalDubteIA==='function') window.obrirModalDubteIA(${JSON.stringify(q)});" style="background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:8px;padding:5px 10px;font-size:12px;font-weight:800;cursor:pointer;flex-shrink:0;">
                🤖 Dubte IA
              </button>
            </div>

            <div id="llista-opcions-guardades" style="display: flex; flex-direction: column; gap: 11px;"></div>
          </div>

          <!-- Feedback Container -->
          <div id="feedback-guardades" style="margin-top: 16px;"></div>
        </div>
      `;

      const llistaEl = document.getElementById('llista-opcions-guardades');
      const feedbackEl = document.getElementById('feedback-guardades');

      opcionsCopy.forEach((opcioText, oIdx) => {
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
            ${LLETRES[oIdx] || '•'}
          </span>
          <span style="flex:1;">${escapeHtml(opcioText)}</span>
        `;

        btn.addEventListener('click', () => {
          llistaEl.querySelectorAll('button').forEach(b => b.style.pointerEvents = 'none');
          const esCorrecte = (oIdx === nouIndexCorrecte);

          if (esCorrecte) {
            encerts++;
            btn.style.background = 'rgba(16,185,129,0.12)';
            btn.style.borderColor = '#10b981';
            btn.style.color = '#065f46';
          } else {
            fallades++;
            btn.style.background = 'rgba(239,68,68,0.12)';
            btn.style.borderColor = '#ef4444';
            btn.style.color = '#991b1b';
            llistaEl.querySelectorAll('button').forEach((b, i) => {
              if (i === nouIndexCorrecte) {
                b.style.background = 'rgba(16,185,129,0.12)';
                b.style.borderColor = '#10b981';
                b.style.color = '#065f46';
              }
            });
          }

          const explicacioHtml = window.generarExplicacioPedagogicaCompleta(q, nouIndexCorrecte, oIdx, esCorrecte);

          feedbackEl.innerHTML = `
            ${explicacioHtml}
            <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap;">
              ${esCorrecte ? `
                <button id="btn-desmarcar-guardada" style="background:#fef3c7;color:#b45309;border:1.5px solid #f59e0b;padding:12px 18px;border-radius:10px;font-weight:800;font-size:13.5px;cursor:pointer;flex:1;">
                  ⭐ Ja me la sé: Desmarcar de guardades
                </button>
              ` : ''}
              <button id="btn-seguent-guardada" style="background:linear-gradient(135deg, #002B5E, #007aff);color:white;border:none;padding:14px 24px;border-radius:12px;font-weight:800;font-size:15px;cursor:pointer;flex:2;box-shadow:0 4px 14px rgba(0,122,255,0.3);">
                ${index + 1 === preguntes.length ? '🏁 Finalitzar Repàs' : 'Següent Pregunta ➔'}
              </button>
            </div>
          `;

          const btnDesmarcar = feedbackEl.querySelector('#btn-desmarcar-guardada');
          if (btnDesmarcar) {
            btnDesmarcar.addEventListener('click', () => {
              window.eliminarPreguntaGuardada(q.id);
              btnDesmarcar.textContent = '✓ Eliminada de les guardades!';
              btnDesmarcar.disabled = true;
              btnDesmarcar.style.opacity = '0.6';
            });
          }

          const btnSeguent = feedbackEl.querySelector('#btn-seguent-guardada');
          if (btnSeguent) {
            btnSeguent.addEventListener('click', () => {
              index++;
              render();
            });
          }

          // Vincular botó de dubte IA dins del feedback
          const btnIA = feedbackEl.querySelector('.btn-ia-feedback-ask');
          if (btnIA) {
            btnIA.addEventListener('click', () => {
              if (typeof window.obrirModalDubteIA === 'function') {
                window.obrirModalDubteIA(q, q.opcions.indexOf(opcioText), esCorrecte);
              }
            });
          }
        });

        llistaEl.appendChild(btn);
      });
    }

    render();
  };

  // Inicialitzar en carregar el document
  document.addEventListener('DOMContentLoaded', () => {
    actualitzarComptadorsGuardadesUI();
  });
})();

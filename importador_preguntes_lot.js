// ============================================================================
// AGENT MEDINA - MÒDUL D'IMPORTACIÓ MASSIVA I GENERACIÓ PER IA DE PREGUNTES
// Suporta text d'IA (ChatGPT, Gemini, Claude), llistats numerats, JSON i CSV.
// ============================================================================

(function () {
  'use strict';

  // Estat intern del lot actual en revisió
  let preguntesLotActual = [];

  // ==========================================================================
  // 1. MOTOR D'ANÀLISI (PARSER) MULTIFORMAT
  // ==========================================================================
  function analitzarTextPreguntes(rawText, defectes = {}) {
    if (!rawText || !rawText.trim()) return [];
    const text = rawText.trim();
    const defecteSeccio = defectes.seccio || '';
    const defecteMunicipi = defectes.municipi || null;
    const defecteAmbit = defectes.ambit || null;

    // --- Format 1: JSON (Directe o dins de blocs markdown ```json ... ```) ---
    let cleanJson = text;
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) cleanJson = jsonMatch[1].trim();

    if ((cleanJson.startsWith('[') && cleanJson.endsWith(']')) || (cleanJson.startsWith('{') && cleanJson.endsWith('}'))) {
      try {
        let parsed = JSON.parse(cleanJson);
        if (!Array.isArray(parsed)) parsed = [parsed];
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((item, idx) => {
            let opcions = [];
            if (Array.isArray(item.opcions)) opcions = item.opcions.map(String);
            else if (Array.isArray(item.options)) opcions = item.options.map(String);
            else if (item.opcions && typeof item.opcions === 'object') {
              opcions = ['a', 'b', 'c', 'd'].map(k => String(item.opcions[k] || item.opcions[k.toUpperCase()] || ''));
            }

            let resposta = 0;
            if (typeof item.resposta === 'number') resposta = item.resposta;
            else if (typeof item.correcta === 'number') resposta = item.correcta;
            else if (typeof item.resposta === 'string') {
              const letter = item.resposta.trim().toLowerCase().replace(/[^a-d0-3]/g, '');
              const map = { a: 0, b: 1, c: 2, d: 3, '0': 0, '1': 1, '2': 2, '3': 3 };
              if (map[letter] !== undefined) resposta = map[letter];
              else {
                const fIdx = opcions.findIndex(o => o.toLowerCase() === item.resposta.toLowerCase());
                if (fIdx !== -1) resposta = fIdx;
              }
            }

            const pregunta = String(item.pregunta || item.question || item.enunciat || '').trim();
            const seccio = String(item.seccio || item.tema || defecteSeccio).trim();
            const municipi = item.municipi ? String(item.municipi).trim() : defecteMunicipi;
            const ambit = item.ambit || defecteAmbit;
            const explicacio = String(item.explicacio || item.explanation || item.justificacio || item.raonament || '').trim();

            return {
              id: item.id || `BULK_${Date.now()}_${idx}`,
              pregunta,
              opcions,
              resposta,
              explicacio,
              seccio,
              municipi,
              ambit,
              valida: Boolean(pregunta.length > 3 && opcions.length >= 2 && resposta >= 0 && resposta < opcions.length)
            };
          }).filter(q => q.pregunta && q.opcions.length > 0);
        }
      } catch (e) {
        // Si falla JSON, continuem amb els altres formats
      }
    }

    // --- Format 2: CSV / TSV (delimitat per ';' o tabulador) ---
    const rawLines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const csvDelim = [';', '\t'].find(delim => {
      return rawLines.length >= 1 && rawLines[0].split(delim).length >= 5;
    });

    if (csvDelim) {
      const csvResults = [];
      rawLines.forEach((line, idx) => {
        if (idx === 0 && line.toLowerCase().includes('pregunta') && line.toLowerCase().includes('opci')) return;
        const parts = line.split(csvDelim).map(p => p.trim());
        if (parts.length >= 5) {
          const pregunta = parts[0];
          const opcions = [parts[1], parts[2], parts[3], parts[4]].filter(Boolean);
          let resposta = 0;
          const ansRaw = (parts[5] || '').toLowerCase().trim();
          const map = { a: 0, b: 1, c: 2, d: 3, '0': 0, '1': 1, '2': 2, '3': 3 };
          if (map[ansRaw] !== undefined) resposta = map[ansRaw];
          const explicacio = parts[6] || '';
          const seccio = parts[7] || defecteSeccio;
          csvResults.push({
            id: `BULK_${Date.now()}_${idx}`,
            pregunta,
            opcions,
            resposta,
            explicacio,
            seccio,
            municipi: defecteMunicipi,
            ambit: defecteAmbit,
            valida: Boolean(pregunta.length > 3 && opcions.length >= 2 && resposta >= 0 && resposta < opcions.length)
          });
        }
      });
      if (csvResults.length > 0) return csvResults;
    }

    // --- Format 3: Text Natural d'IA / Tipus Test (ChatGPT, Gemini, Claude, etc.) ---
    const lines = text.split(/\r?\n/);
    const blocks = [];
    let currentBlock = [];

    const isQuestionStart = (line) => {
      const l = line.trim().replace(/^\*\*|\*\*$/g, '');
      return /^(?:#+\s*)?(?:(?:\*\*|\b)?(?:Pregunta|Q)\s*\d+[:.]?|\d+[\.\)\-:]\s+)/i.test(l) && !/^[a-d][\.\)]/i.test(l);
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (isQuestionStart(line)) {
        if (currentBlock.length > 0) blocks.push(currentBlock);
        currentBlock = [line];
      } else {
        if (currentBlock.length > 0) currentBlock.push(line);
        else if (line.trim()) currentBlock = [line];
      }
    }
    if (currentBlock.length > 0) blocks.push(currentBlock);

    const results = [];
    blocks.forEach((blkLines, bIdx) => {
      let pregunta = '';
      const opcions = [];
      let resposta = -1;
      let explicacio = '';
      let seccio = defecteSeccio;
      let municipi = defecteMunicipi;
      let inExplicacio = false;

      blkLines.forEach(l => {
        const line = l.trim();
        if (!line) return;

        if (inExplicacio) {
          explicacio += (explicacio ? ' ' : '') + line.replace(/^\*\*|\*\*$/g, '').trim();
          return;
        }

        // Resposta correcta (Resposta: B, Solució: B, Correcta: B, etc.)
        const ansMatch = line.match(/^(?:\*\*|\*|#)?\s*(?:Resposta|Soluci[oó]|Correcta|Answer|R)\s*(?:correcta)?\s*[:=\-]?\s*(?:\*\*|\*)?\s*\(?([a-d])/i);
        if (ansMatch) {
          const char = ansMatch[1].toLowerCase();
          const map = { a: 0, b: 1, c: 2, d: 3 };
          resposta = map[char] !== undefined ? map[char] : 0;
          return;
        }

        // Explicació o justificació
        const expMatch = line.match(/^(?:\*\*|\*|#)?\s*(?:Explicaci[oó]|Justificaci[oó]|Motiu|Nota|Raonament)\s*[:=\-]?\s*(?:\*\*|\*)?\s*(.*)$/i);
        if (expMatch) {
          inExplicacio = true;
          explicacio = expMatch[1].replace(/^\*\*|\*\*$/g, '').trim();
          return;
        }

        // Opció a), b), c), d) o A., B., C., D.
        const opMatch = line.match(/^(?:\*\*|\*)?[\[\(]?([a-dA-D])[\]\)\.\-:]\s*(?:\*\*|\*)?(.*)$/);
        if (opMatch) {
          const opClean = opMatch[2].replace(/^\*\*|\*\*$/g, '').trim();
          opcions.push(opClean);
          return;
        }

        // Etiqueta Tema / Secció / Municipi
        const temaMatch = line.match(/^(?:Tema|Secci[oó]|Municipi)\s*[:=\-]?\s*(.*)$/i);
        if (temaMatch) {
          if (line.toLowerCase().startsWith('municipi')) municipi = temaMatch[1].replace(/^\*\*|\*\*$/g, '').trim();
          else seccio = temaMatch[1].replace(/^\*\*|\*\*$/g, '').trim();
          return;
        }

        // Text de la pregunta
        let cleaned = line.replace(/^\*\*|\*\*$/g, '').trim();
        cleaned = cleaned.replace(/^(?:#+\s*)?(?:(?:\*\*|\b)?(?:Pregunta|Q)\s*\d+[:.]?|\d+[\.\)\-:]\s*)/i, '').trim();
        cleaned = cleaned.replace(/^\*\*|\*\*$/g, '').trim();
        if (cleaned) {
          pregunta += (pregunta ? ' ' : '') + cleaned;
        }
      });

      if (pregunta && opcions.length > 0) {
        if (resposta === -1) resposta = 0; // Per defecte a la primera si no s'especifica
        results.push({
          id: `BULK_${Date.now()}_${bIdx}`,
          pregunta,
          opcions,
          resposta,
          explicacio,
          seccio,
          municipi,
          ambit: defecteAmbit,
          valida: Boolean(pregunta.length > 3 && opcions.length >= 2 && resposta >= 0 && resposta < opcions.length)
        });
      }
    });

    return results;
  }
  window.analitzarTextPreguntes = analitzarTextPreguntes;

  // ==========================================================================
  // 2. CANVI DE MODE (MANUAL VS LOT / IA) AL MODAL
  // ==========================================================================
  window.canviarModeCreacio = function (mode) {
    const btnManual = document.getElementById('btn-mode-crear-manual');
    const btnLot = document.getElementById('btn-mode-crear-lot');
    const formManual = document.getElementById('form-crear-pregunta-directa');
    const panellLot = document.getElementById('panell-crear-preguntes-lot');

    if (!btnManual || !btnLot || !formManual || !panellLot) return;

    if (mode === 'lot') {
      btnManual.style.background = 'transparent';
      btnManual.style.color = 'var(--text-main)';
      btnLot.style.background = 'linear-gradient(135deg,#002B5E,#007aff)';
      btnLot.style.color = '#fff';

      formManual.style.display = 'none';
      panellLot.style.display = 'block';

      // Sincronitzar selecció de banc i tema des del manual
      const bancManual = document.querySelector('input[name="cp-banc"]:checked')?.value || 'pl';
      const radioLot = document.querySelector(`input[name="cp-lot-banc"][value="${bancManual}"]`);
      if (radioLot) radioLot.checked = true;

      const munManual = document.getElementById('cp-select-municipi')?.value || 'Constantí';
      const munLot = document.getElementById('cp-lot-select-municipi');
      if (munLot) munLot.value = munManual;

      window.canviarBancLot(bancManual);
    } else {
      btnManual.style.background = 'linear-gradient(135deg,#002B5E,#007aff)';
      btnManual.style.color = '#fff';
      btnLot.style.background = 'transparent';
      btnLot.style.color = 'var(--text-main)';

      formManual.style.display = 'block';
      panellLot.style.display = 'none';
    }
  };

  // Funció pública per obrir directament en mode lot des de qualsevol botó
  window.obrirModalImportarLot = function (bancPref = 'pl', temaPref = null, municipiPref = null) {
    if (typeof window.obrirModalCrearPregunta === 'function') {
      window.obrirModalCrearPregunta(bancPref, temaPref, municipiPref);
    }
    window.canviarModeCreacio('lot');
  };

  // ==========================================================================
  // 3. GESTIÓ DEL BANC I SELECCIÓ DE TEMES AL PANELL DE LOT
  // ==========================================================================
  window.canviarBancLot = function (banc) {
    const blocMun = document.getElementById('cp-lot-bloc-municipi');
    if (blocMun) {
      blocMun.style.display = (banc === 'pl') ? 'block' : 'none';
    }
    window.recarregarTemesLot();
  };

  window.recarregarTemesLot = function () {
    const banc = document.querySelector('input[name="cp-lot-banc"]:checked')?.value || 'pl';
    const select = document.getElementById('cp-lot-select-tema');
    if (!select) return;

    const dataset = (typeof window.obtenirBancActiu === 'function') ? window.obtenirBancActiu(banc) : [];
    const seccionsMap = new Map();
    (dataset || []).forEach(q => {
      const s = q.seccio || q.tema || q.categoria || q.ambit;
      if (s) seccionsMap.set(s, (seccionsMap.get(s) || 0) + 1);
    });

    let temesOficials = [];
    if (banc === 'pl') {
      const mun = document.getElementById('cp-lot-select-municipi')?.value || 'Constantí';
      if (typeof window.obtenirTemariPLPerMunicipi === 'function') {
        temesOficials = window.obtenirTemariPLPerMunicipi(mun);
      }
    }

    let html = `<option value="">-- Assignar tema o deixar que la IA el detecti --</option>`;

    if (temesOficials.length > 0) {
      const munNom = document.getElementById('cp-lot-select-municipi')?.value || 'Constantí';
      html += `<optgroup label="Temari Oficial de ${escapeHtml(munNom)}">`;
      temesOficials.forEach(t => {
        const nomComplet = `${t.codi || 'T' + t.id}. ${t.nom}`;
        const count = seccionsMap.get(nomComplet) || seccionsMap.get(t.nom) || 0;
        html += `<option value="${escapeHtml(nomComplet)}">${escapeHtml(nomComplet)} (${count} preguntes)</option>`;
      });
      html += `</optgroup>`;
    }

    if (seccionsMap.size > 0) {
      html += `<optgroup label="Altres Seccions del Banc">`;
      Array.from(seccionsMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0], 'ca', { numeric: true }))
        .forEach(([nom, count]) => {
          html += `<option value="${escapeHtml(nom)}">${escapeHtml(nom)} (${count} preguntes)</option>`;
        });
      html += `</optgroup>`;
    }

    select.innerHTML = html;
  };

  // ==========================================================================
  // 4. GENERADOR DE PROMPT PER A IA (CHATGPT, GEMINI, CLAUDE)
  // ==========================================================================
  window.copiarPromptIA = function () {
    const banc = document.querySelector('input[name="cp-lot-banc"]:checked')?.value || 'pl';
    const mun = document.getElementById('cp-lot-select-municipi')?.value || 'Constantí';
    const temaSelect = document.getElementById('cp-lot-select-tema');
    const temaNom = (temaSelect && temaSelect.value) ? temaSelect.value : '[INDICA AQUÍ EL TEMA O TEMARI]';

    let cosNom = "Policia Local de Catalunya";
    if (banc === 'mossos') cosNom = "Mossos d'Esquadra (Generalitat de Catalunya)";
    else if (banc === 'act') cosNom = "Actualitat i Notícies Policials de Catalunya";
    else if (mun && mun !== 'Comú') cosNom = `Policia Local de ${mun} (Catalunya)`;

    const promptText = `Actua com a tribunal d'oposicions expert en el cos de ${cosNom}.
Genera 10 preguntes tipus test d'alta qualitat, rigoroses i actualitzades sobre el tema:
"${temaNom}"

Normes de format que has de seguir estrictament perquè el sistema pugui importar-les automàticament:
1. Cada pregunta ha de tenir 4 opcions (a, b, c, d), amb una única resposta correcta.
2. Després de les opcions, indica la resposta correcta amb el format: "Resposta: X" (on X és a, b, c o d).
3. Afegeix una explicació breu citant l'article legal o normativa aplicable: "Explicació: [...]".

Exemple de format requerit per a cada pregunta:
1. Quin és el termini màxim de la detenció preventiva segons la Constitució Espanyola?
a) 24 hores
b) 48 hores
c) 72 hores
d) 5 dies
Resposta: c
Explicació: L'article 17.2 de la CE estableix que la detenció preventiva no pot durar més de 72 hores.

Genera ara les 10 preguntes en aquest format exacte:`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(promptText).then(() => {
        if (typeof mostrarToast === 'function') {
          mostrarToast('📋 Prompt copiat al porta-retalls! Enganxa\'l a ChatGPT o Gemini.', 'success');
        }
      }).catch(() => fallbackCopiar(promptText));
    } else {
      fallbackCopiar(promptText);
    }
  };

  function fallbackCopiar(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      if (typeof mostrarToast === 'function') {
        mostrarToast('📋 Prompt copiat al porta-retalls!', 'success');
      }
    } catch (e) {
      alert('Copia aquest text manualment:\n\n' + text);
    }
    document.body.removeChild(ta);
  }

  // ==========================================================================
  // 5. EXEMPLE I GESTIÓ DEL TEXTAREA
  // ==========================================================================
  window.carregarExempleLot = function () {
    const ta = document.getElementById('cp-lot-textarea');
    if (!ta) return;
    ta.value = `1. Quin és el termini màxim de la detenció preventiva segons la Constitució Espanyola?
a) 24 hores
b) 48 hores
c) 72 hores
d) 5 dies
Resposta: c
Explicació: L'article 17.2 de la CE estableix que la detenció preventiva no podrà durar més de 72 hores.

2. Segons la Llei 16/1991 de les policies locals de Catalunya, les policies locals són:
a) Cossos de caràcter civil amb estructura jerarquitzada
b) Cossos de naturalesa estrictament militar
c) Cossos d'agents privats dependents del Departament d'Interior
d) Unitats auxiliars sense caràcter d'agents de l'autoritat
Resposta: a
Explicació: L'art. 10 de la Llei 16/1991 disposa que els cossos de policia local són instituts armats de naturalesa civil.

3. Quin article de la Constitució Espanyola reconeix el dret a la vida i a la integritat física?
a) Article 14
b) Article 15
c) Article 16
d) Article 18
Resposta: b
Explicació: L'article 15 de la Constitució Espanyola garanteix el dret fonamental a la vida.`;
    window.processarTextLot();
  };

  window.netejarTextareaLot = function () {
    const ta = document.getElementById('cp-lot-textarea');
    if (ta) ta.value = '';
    preguntesLotActual = [];
    actualitzarVistaPreviaLot();
  };

  window.enganxarPortapapersLot = function () {
    if (navigator.clipboard && navigator.clipboard.readText) {
      navigator.clipboard.readText().then(text => {
        const ta = document.getElementById('cp-lot-textarea');
        if (ta && text) {
          ta.value = text;
          window.processarTextLot();
        }
      }).catch(() => {
        if (typeof mostrarToast === 'function') {
          mostrarToast('Prem Ctrl+V o mantén premut per enganxar al requadre.', 'info');
        }
      });
    } else {
      if (typeof mostrarToast === 'function') {
        mostrarToast('Prem Ctrl+V o mantén premut per enganxar al requadre.', 'info');
      }
    }
  };

  // ==========================================================================
  // 6. PROCESSAMENT I PREVISUALITZACIÓ DEL LOT
  // ==========================================================================
  window.processarTextLot = function () {
    const ta = document.getElementById('cp-lot-textarea');
    if (!ta) return;
    const text = ta.value;

    const banc = document.querySelector('input[name="cp-lot-banc"]:checked')?.value || 'pl';
    const mun = (banc === 'pl') ? (document.getElementById('cp-lot-select-municipi')?.value || 'Constantí') : null;
    const seccio = document.getElementById('cp-lot-select-tema')?.value || '';

    preguntesLotActual = analitzarTextPreguntes(text, {
      seccio,
      municipi: mun,
      ambit: (banc === 'mossos') ? 'Àmbit A' : null
    });

    actualitzarVistaPreviaLot();
  };

  function actualitzarVistaPreviaLot() {
    const blocResum = document.getElementById('cp-lot-resum-bloc');
    const badgeRecompte = document.getElementById('cp-lot-badge-recompte');
    const container = document.getElementById('cp-lot-preview-container');
    const btnConfirmar = document.getElementById('btn-confirmar-lot');

    if (!blocResum || !badgeRecompte || !container || !btnConfirmar) return;

    if (preguntesLotActual.length === 0) {
      blocResum.style.display = 'none';
      container.innerHTML = '';
      btnConfirmar.disabled = true;
      btnConfirmar.style.opacity = '0.5';
      btnConfirmar.textContent = '💾 Confirmar i Desar (0 preguntes)';
      return;
    }

    const valides = preguntesLotActual.filter(q => q.valida);
    const invalides = preguntesLotActual.length - valides.length;

    blocResum.style.display = 'block';
    badgeRecompte.innerHTML = invalides === 0
      ? `🟢 S'han detectat <b>${valides.length} preguntes vàlides</b> llestes per importar`
      : `⚠️ <b>${valides.length} correctes</b> | <b>${invalides} amb avisos</b> (revisa les respostes)`;

    btnConfirmar.disabled = valides.length === 0;
    btnConfirmar.style.opacity = valides.length > 0 ? '1' : '0.5';
    btnConfirmar.textContent = `💾 Confirmar i Desar (${valides.length} preguntes)`;

    // Generar targetes de previsualització
    const lletres = ['A', 'B', 'C', 'D'];
    container.innerHTML = preguntesLotActual.map((q, idx) => {
      return `
        <div style="background:var(--bg-card-subtle,#f8fafc);border:1.5px solid ${q.valida ? 'var(--border-card,#e2e8f0)' : '#f87171'};border-radius:12px;padding:12px;font-size:13px;position:relative;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <span style="font-weight:800;color:var(--text-main,#0f172a);font-size:12.5px;">#${idx + 1} ${q.seccio ? `· <span style="color:var(--text-muted);">${escapeHtml(q.seccio)}</span>` : ''}</span>
            <button type="button" onclick="window.eliminarPreguntaDeLot(${idx})" title="Descartar aquesta pregunta" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:14px;padding:2px 6px;">🗑️</button>
          </div>
          <div style="font-weight:700;color:var(--text-main,#0f172a);margin-bottom:8px;line-height:1.4;">
            ${escapeHtml(q.pregunta)}
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px;">
            ${q.opcions.map((op, oIdx) => {
              const esCorrecta = oIdx === q.resposta;
              return `
                <div style="display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:8px;font-size:12px;${esCorrecta ? 'background:rgba(16,185,129,0.15);border:1.5px solid #10b981;font-weight:700;color:#065f46;' : 'background:var(--bg-card,#fff);border:1px solid var(--border-card,#e2e8f0);color:var(--text-muted,#475569);'}">
                  <span style="font-weight:800;width:14px;">${lletres[oIdx] || oIdx + 1})</span>
                  <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(op)}</span>
                  ${esCorrecta ? '<span style="margin-left:auto;color:#10b981;">✓</span>' : ''}
                </div>
              `;
            }).join('')}
          </div>
          ${q.explicacio ? `
            <div style="font-size:11.5px;color:#0369a1;background:#f0f9ff;padding:6px 8px;border-radius:6px;border-left:3px solid #0284c7;line-height:1.35;margin-top:4px;">
              💡 <b>Justificació:</b> ${escapeHtml(q.explicacio)}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  window.eliminarPreguntaDeLot = function (idx) {
    if (idx >= 0 && idx < preguntesLotActual.length) {
      preguntesLotActual.splice(idx, 1);
      actualitzarVistaPreviaLot();
    }
  };

  // ==========================================================================
  // 7. DESAR EL LOT DE PREGUNTES DIRECTAMENT AL TEMARI I FITXER .JS
  // ==========================================================================
  window.desarLotPreguntesDirecte = function () {
    const valides = preguntesLotActual.filter(q => q.valida);
    if (valides.length === 0) {
      if (typeof mostrarToast === 'function') {
        mostrarToast('⚠️ No hi ha cap pregunta vàlida per desar.', 'error');
      }
      return;
    }

    const banc = document.querySelector('input[name="cp-lot-banc"]:checked')?.value || 'pl';
    const mun = (banc === 'pl') ? (document.getElementById('cp-lot-select-municipi')?.value || 'Constantí') : null;
    const seccioDefecte = document.getElementById('cp-lot-select-tema')?.value || '';

    // Assignem secció / municipi a les que no en tinguin
    const preguntesFinals = valides.map(q => {
      return {
        ...q,
        seccio: q.seccio || seccioDefecte || (banc === 'mossos' ? 'Àmbit A' : 'Comú'),
        municipi: (banc === 'pl') ? (q.municipi || mun || 'Comú') : undefined,
        tema: q.seccio || seccioDefecte || undefined
      };
    });

    const btnConfirmar = document.getElementById('btn-confirmar-lot');
    if (btnConfirmar) {
      btnConfirmar.disabled = true;
      btnConfirmar.textContent = '⏳ Desant preguntes...';
    }

    // Guardar mitjançant afegirPreguntesCustom que actualitza memòria, localStorage i sincronitza fitxer .js
    if (typeof window.afegirPreguntesCustom === 'function') {
      window.afegirPreguntesCustom(banc, preguntesFinals);
    }

    const targetBancNom = banc === 'pl' ? `Policia Local (${mun})` : banc === 'mossos' ? "Mossos d'Esquadra" : 'Actualitat';
    if (typeof mostrarToast === 'function') {
      mostrarToast(`🎉 S'han afegit ${preguntesFinals.length} preguntes amb èxit a ${targetBancNom}!`, 'success');
    }

    // Tancar modal i netejar
    window.tancarModalCrearPregunta();
    window.netejarTextareaLot();

    // Refrescar vista actual si cal
    if (banc === 'pl' && typeof window.mostrarTemarioPL === 'function') {
      const viewPL = document.getElementById('view-pl');
      if (viewPL && viewPL.classList.contains('view-activa')) {
        window.mostrarTemarioPL();
      }
    } else if (banc === 'mossos' && typeof window.mostrarTemarioMossos === 'function') {
      const viewMossos = document.getElementById('view-mossos');
      if (viewMossos && viewMossos.classList.contains('view-activa')) {
        window.mostrarTemarioMossos();
      }
    } else if (typeof window.mostrarGestorPreguntes === 'function') {
      const viewEd = document.getElementById('view-editor');
      if (viewEd && viewEd.classList.contains('view-activa')) {
        window.mostrarGestorPreguntes(banc);
      }
    }
  };

  // Helper escapeHtml
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Integració amb el botó "ed-guardar-bulk" del Gestor de preguntes si existeix
  document.addEventListener('DOMContentLoaded', () => {
    const btnGuardarBulk = document.getElementById('ed-guardar-bulk');
    if (btnGuardarBulk) {
      btnGuardarBulk.addEventListener('click', (ev) => {
        const text = document.getElementById('ed-bulk')?.value || '';
        if (!text.trim()) return;
        const banc = document.querySelector('.ed-banc-btn.active')?.dataset?.banc || 'pl';
        const parsed = analitzarTextPreguntes(text);
        if (parsed.length > 0) {
          const valides = parsed.filter(q => q.valida);
          if (valides.length > 0 && typeof window.afegirPreguntesCustom === 'function') {
            window.afegirPreguntesCustom(banc, valides);
            const msg = document.getElementById('ed-missatge-bulk');
            if (msg) {
              msg.style.color = '#15803d';
              msg.textContent = `✅ ${valides.length} preguntes importades directament al fitxer .js!`;
            }
          }
        }
      }, true); // Captura prèvia per donar suport a qualsevol format
    }
  });

})();

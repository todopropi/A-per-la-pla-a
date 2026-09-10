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
  let filtreLotVisual = 'tots';

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

    filtreLotVisual = 'tots';
    actualitzarVistaPreviaLot();
  };

  // Classificació intel·ligent massiva amb Gemini IA
  window.classificarLotAmbIA = async function () {
    const ta = document.getElementById('cp-lot-textarea');
    if (!ta) return;
    const text = ta.value.trim();

    if (!text && preguntesLotActual.length === 0) {
      if (typeof mostrarToast === 'function') {
        mostrarToast('⚠️ Enganxa primer un text o llistat de preguntes abans de classificar.', 'error');
      }
      return;
    }

    if (preguntesLotActual.length === 0) {
      window.processarTextLot();
    }

    const valides = preguntesLotActual.filter(q => q.valida);
    if (valides.length === 0) {
      if (typeof mostrarToast === 'function') {
        mostrarToast('⚠️ No s\'ha detectat cap pregunta amb estructura vàlida per classificar.', 'error');
      }
      return;
    }

    const btnIA = document.getElementById('btn-ia-classificar-lot');
    const textOriginalBtn = btnIA ? btnIA.innerHTML : '';
    if (btnIA) {
      btnIA.disabled = true;
      btnIA.style.opacity = '0.7';
      btnIA.innerHTML = '<span>⏳</span> <span>Classificant per temes i verificant vigència amb Gemini...</span>';
    }

    const banc = document.querySelector('input[name="cp-lot-banc"]:checked')?.value || 'pl';
    const mun = (banc === 'pl') ? (document.getElementById('cp-lot-select-municipi')?.value || 'Constantí') : null;

    // Obtenir catàleg de temes existents
    let temarisDisponibles = [];
    if (banc === 'pl') {
      if (typeof window.obtenirTemariPLPerMunicipi === 'function') {
        const tList = window.obtenirTemariPLPerMunicipi(mun) || [];
        temarisDisponibles = tList.map(t => `${t.codi || ''}: ${t.nom || ''}`.trim());
      }
      if (Array.isArray(window.MATERIES_COMPARTIDES)) {
        window.MATERIES_COMPARTIDES.forEach(m => {
          temarisDisponibles.push(`Matèria Troncal: ${m.nom}`);
        });
      }
    } else if (banc === 'mossos') {
      temarisDisponibles = [
        'Àmbit A: Coneixements de l\'entorn (Història, Institucions, Societat de Catalunya)',
        'Àmbit B: Àmbit institucional (Constitució Espanyola de 1978, Estatut d\'Autonomia, Institucions)',
        'Àmbit C: Seguretat i policia (Llei 10/1994 de Mossos, Codi Penal, LECrim, Seguretat Ciutadana 4/2015, Trànsit)'
      ];
    } else {
      temarisDisponibles = ['Política i Societat Actual', 'Geopolítica i Unió Europea', 'Cultura i Efemèrides'];
    }

    try {
      const res = await fetch('/api/gemini/classificar-lot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preguntes: valides,
          banc,
          municipi: mun,
          temarisDisponibles
        })
      });

      const dades = await res.json();
      if (dades.success && Array.isArray(dades.classificacions)) {
        // Aplicar resultats a preguntesLotActual
        const mapRes = new Map();
        dades.classificacions.forEach(c => {
          if (c && c.id) mapRes.set(String(c.id), c);
        });

        preguntesLotActual.forEach((q, idx) => {
          const match = mapRes.get(String(q.id)) || dades.classificacions[idx];
          if (match) {
            q.iaClassificada = true;
            q.iaCoincideix = Boolean(match.coincideix);
            q.suggerimentNouTema = match.suggerimentNouTema || null;
            q.estatVigencia = match.estatVigencia || 'vigent';
            q.motiuVigencia = match.motiuVigencia || 'Normativa vigent';
            q.confianca = match.confianca || 85;
            q.bancRecomanat = match.bancRecomanat || banc;

            if (match.temaCoincident) {
              q.seccio = match.temaCoincident;
              q.tema = match.temaCoincident;
            }
          }
        });

        if (typeof mostrarToast === 'function') {
          mostrarToast(`✨ S'han analitzat ${valides.length} preguntes amb èxit!`, 'success');
        }
      } else {
        if (typeof mostrarToast === 'function') {
          mostrarToast('⚠️ No s\'ha pogut completar la classificació per IA.', 'error');
        }
      }
    } catch (err) {
      console.error('Error a classificarLotAmbIA:', err);
      if (typeof mostrarToast === 'function') {
        mostrarToast('⚠️ Error contactant amb el servei de classificació.', 'error');
      }
    } finally {
      if (btnIA) {
        btnIA.disabled = false;
        btnIA.style.opacity = '1';
        btnIA.innerHTML = textOriginalBtn || '<span>✨</span> <span>Classificar per temes i verificar vigència amb IA (Gemini)</span>';
      }
      actualitzarVistaPreviaLot();
    }
  };

  // Accions individuals per a cada pregunta
  window.crearTemaPerPregunta = function (idx) {
    if (idx < 0 || idx >= preguntesLotActual.length) return;
    const q = preguntesLotActual[idx];
    const nomNou = prompt('Nom del nou tema que vols afegir al temari:', q.suggerimentNouTema || 'Nou Tema Específic');
    if (!nomNou || !nomNou.trim()) return;

    const banc = document.querySelector('input[name="cp-lot-banc"]:checked')?.value || 'pl';
    const mun = (banc === 'pl') ? (document.getElementById('cp-lot-select-municipi')?.value || 'Constantí') : null;

    if (banc === 'pl' && typeof window.afegirTemaCustomMunicipiPL === 'function') {
      window.afegirTemaCustomMunicipiPL(mun, { nom: nomNou.trim() });
    }

    q.seccio = nomNou.trim();
    q.tema = nomNou.trim();
    q.iaCoincideix = true;
    q.suggerimentNouTema = null;

    if (typeof mostrarToast === 'function') {
      mostrarToast(`✅ Tema "${nomNou.trim()}" creat i assignat a la pregunta #${idx + 1}!`, 'success');
    }

    actualitzarVistaPreviaLot();
  };

  window.assignarTemaAPregunta = function (idx, nomTema) {
    if (idx < 0 || idx >= preguntesLotActual.length) return;
    const q = preguntesLotActual[idx];
    q.seccio = nomTema;
    q.tema = nomTema;
    q.iaCoincideix = true;
    q.suggerimentNouTema = null;
    actualitzarVistaPreviaLot();
  };

  window.triarTemaExistentPregunta = function (idx) {
    if (idx < 0 || idx >= preguntesLotActual.length) return;
    const banc = document.querySelector('input[name="cp-lot-banc"]:checked')?.value || 'pl';
    const mun = (banc === 'pl') ? (document.getElementById('cp-lot-select-municipi')?.value || 'Constantí') : null;

    let opcions = [];
    if (banc === 'pl' && typeof window.obtenirTemariPLPerMunicipi === 'function') {
      opcions = (window.obtenirTemariPLPerMunicipi(mun) || []).map(t => `${t.codi || ''} ${t.nom || ''}`.trim());
    } else {
      opcions = ['Àmbit A', 'Àmbit B', 'Àmbit C', 'General'];
    }

    const tria = prompt(`Tria o enganxa el nom del tema per a la pregunta #${idx + 1}:\n\n${opcions.slice(0, 10).join('\n')}`);
    if (tria && tria.trim()) {
      window.assignarTemaAPregunta(idx, tria.trim());
    }
  };

  // Accions globals del lot
  window.crearTotsElsTemesNousSuggerits = function () {
    const banc = document.querySelector('input[name="cp-lot-banc"]:checked')?.value || 'pl';
    const mun = (banc === 'pl') ? (document.getElementById('cp-lot-select-municipi')?.value || 'Constantí') : null;

    let comptador = 0;
    preguntesLotActual.forEach((q, idx) => {
      if (q.iaClassificada && !q.iaCoincideix && q.suggerimentNouTema) {
        const nomTema = q.suggerimentNouTema;
        if (banc === 'pl' && typeof window.afegirTemaCustomMunicipiPL === 'function') {
          window.afegirTemaCustomMunicipiPL(mun, { nom: nomTema });
        }
        q.seccio = nomTema;
        q.tema = nomTema;
        q.iaCoincideix = true;
        q.suggerimentNouTema = null;
        comptador++;
      }
    });

    if (typeof mostrarToast === 'function') {
      mostrarToast(`✅ S'han creat i assignat ${comptador} temes nous al temari!`, 'success');
    }
    actualitzarVistaPreviaLot();
  };

  window.descartarPreguntesSenseTema = function () {
    const inicial = preguntesLotActual.length;
    preguntesLotActual = preguntesLotActual.filter(q => !(q.iaClassificada && !q.iaCoincideix));
    const descartades = inicial - preguntesLotActual.length;
    if (typeof mostrarToast === 'function') {
      mostrarToast(`🗑️ S'han descartat ${descartades} preguntes sense tema coincident.`, 'info');
    }
    actualitzarVistaPreviaLot();
  };

  window.descartarPreguntesDesactualitzades = function () {
    const inicial = preguntesLotActual.length;
    preguntesLotActual = preguntesLotActual.filter(q => q.estatVigencia !== 'desactualitzada');
    const descartades = inicial - preguntesLotActual.length;
    if (typeof mostrarToast === 'function') {
      mostrarToast(`🗑️ S'han descartat ${descartades} preguntes amb possible desactualització.`, 'info');
    }
    actualitzarVistaPreviaLot();
  };

  window.canviarFiltreLot = function (filtre) {
    filtreLotVisual = filtre;
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

    // Comptadors IA
    const senseTema = preguntesLotActual.filter(q => q.iaClassificada && !q.iaCoincideix);
    const coincidents = preguntesLotActual.filter(q => q.iaClassificada && q.iaCoincideix);
    const desactualitzades = preguntesLotActual.filter(q => q.estatVigencia === 'desactualitzada');
    const vigents = preguntesLotActual.filter(q => q.estatVigencia === 'vigent');
    const teDadesIA = preguntesLotActual.some(q => q.iaClassificada);

    blocResum.style.display = 'block';

    let resumHtml = `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:10px;">
        <span style="font-size:13px;font-weight:700;color:#059669;">
          ${invalides === 0
            ? `🟢 <b>${valides.length} preguntes vàlides</b> llestes per importar`
            : `⚠️ <b>${valides.length} correctes</b> | <b>${invalides} amb avisos</b>`}
        </span>
        ${teDadesIA ? `
          <span style="background:rgba(99,102,241,0.12);color:#4338ca;padding:3px 8px;border-radius:6px;font-size:11.5px;font-weight:800;display:inline-flex;align-items:center;gap:4px;">
            <span>✨</span> <span>Classificades per IA (Gemini)</span>
          </span>
        ` : ''}
      </div>
    `;

    // Alertes i accions ràpides si hi ha preguntes sense tema o desactualitzades
    if (senseTema.length > 0) {
      resumHtml += `
        <div style="background:#fffbeb;border:1.5px solid #f59e0b;padding:10px 14px;border-radius:10px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
          <div>
            <div style="font-size:12.5px;color:#92400e;font-weight:800;display:flex;align-items:center;gap:6px;">
              <span>❓</span> <span>${senseTema.length} preguntes no coincideixen amb cap tema del temari actual:</span>
            </div>
            <p style="margin:2px 0 0;font-size:11.5px;color:#b45309;">
              Pots crear automàticament els temes proposats per la IA o descartar-les abans de desar.
            </p>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button type="button" onclick="window.crearTotsElsTemesNousSuggerits()" style="padding:6px 12px;background:#059669;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:5px;">
              <span>➕</span> <span>Crear tots els temes nous</span>
            </button>
            <button type="button" onclick="window.descartarPreguntesSenseTema()" style="padding:6px 12px;background:#ef4444;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:5px;">
              <span>🗑️</span> <span>Descartar-les</span>
            </button>
          </div>
        </div>
      `;
    }

    if (desactualitzades.length > 0) {
      resumHtml += `
        <div style="background:#fef2f2;border:1.5px solid #ef4444;padding:10px 14px;border-radius:10px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
          <div>
            <div style="font-size:12.5px;color:#991b1b;font-weight:800;display:flex;align-items:center;gap:6px;">
              <span>⚠️</span> <span>S'han detectat ${desactualitzades.length} preguntes amb possible normativa desactualitzada:</span>
            </div>
            <p style="margin:2px 0 0;font-size:11.5px;color:#b91c1c;">
              Revisa les alertes legals abans d'incorporar-les al banc d'estudi.
            </p>
          </div>
          <button type="button" onclick="window.descartarPreguntesDesactualitzades()" style="padding:6px 12px;background:#dc2626;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:5px;">
            <span>🗑️</span> <span>Descartar desactualitzades</span>
          </button>
        </div>
      `;
    }

    // Filtres visuals de la llista
    if (teDadesIA) {
      resumHtml += `
        <div style="display:flex;align-items:center;gap:6px;overflow-x:auto;padding-bottom:6px;margin-bottom:10px;">
          <span style="font-size:12px;font-weight:800;color:var(--text-muted,#64748b);margin-right:2px;">Filtrar vista:</span>
          <button type="button" onclick="window.canviarFiltreLot('tots')" style="padding:4px 10px;border-radius:6px;font-size:11.5px;font-weight:700;cursor:pointer;border:1px solid ${filtreLotVisual === 'tots' ? '#2563eb' : 'var(--border-card,#cbd5e1)'};background:${filtreLotVisual === 'tots' ? '#2563eb' : 'var(--bg-card,#fff)'};color:${filtreLotVisual === 'tots' ? '#fff' : 'var(--text-main,#334155)'};">
            Totes (${preguntesLotActual.length})
          </button>
          <button type="button" onclick="window.canviarFiltreLot('coincidents')" style="padding:4px 10px;border-radius:6px;font-size:11.5px;font-weight:700;cursor:pointer;border:1px solid ${filtreLotVisual === 'coincidents' ? '#059669' : 'var(--border-card,#cbd5e1)'};background:${filtreLotVisual === 'coincidents' ? '#059669' : 'var(--bg-card,#fff)'};color:${filtreLotVisual === 'coincidents' ? '#fff' : 'var(--text-main,#334155)'};">
            🎯 Amb tema (${coincidents.length})
          </button>
          ${senseTema.length > 0 ? `
            <button type="button" onclick="window.canviarFiltreLot('sense_tema')" style="padding:4px 10px;border-radius:6px;font-size:11.5px;font-weight:700;cursor:pointer;border:1px solid ${filtreLotVisual === 'sense_tema' ? '#d97706' : 'var(--border-card,#cbd5e1)'};background:${filtreLotVisual === 'sense_tema' ? '#d97706' : 'var(--bg-card,#fff)'};color:${filtreLotVisual === 'sense_tema' ? '#fff' : 'var(--text-main,#334155)'};">
              ❓ Sense tema (${senseTema.length})
            </button>
          ` : ''}
          ${desactualitzades.length > 0 ? `
            <button type="button" onclick="window.canviarFiltreLot('desactualitzades')" style="padding:4px 10px;border-radius:6px;font-size:11.5px;font-weight:700;cursor:pointer;border:1px solid ${filtreLotVisual === 'desactualitzades' ? '#dc2626' : 'var(--border-card,#cbd5e1)'};background:${filtreLotVisual === 'desactualitzades' ? '#dc2626' : 'var(--bg-card,#fff)'};color:${filtreLotVisual === 'desactualitzades' ? '#fff' : 'var(--text-main,#334155)'};">
              ⚠️ Desactualitzades (${desactualitzades.length})
            </button>
          ` : ''}
        </div>
      `;
    }

    badgeRecompte.innerHTML = resumHtml;

    btnConfirmar.disabled = valides.length === 0;
    btnConfirmar.style.opacity = valides.length > 0 ? '1' : '0.5';
    btnConfirmar.textContent = `💾 Confirmar i Desar (${valides.length} preguntes)`;

    // Filtrar la llista a mostrar
    let llistaAMostrar = preguntesLotActual.map((q, idx) => ({ q, originalIdx: idx }));
    if (filtreLotVisual === 'coincidents') {
      llistaAMostrar = llistaAMostrar.filter(item => item.q.iaClassificada && item.q.iaCoincideix);
    } else if (filtreLotVisual === 'sense_tema') {
      llistaAMostrar = llistaAMostrar.filter(item => item.q.iaClassificada && !item.q.iaCoincideix);
    } else if (filtreLotVisual === 'desactualitzades') {
      llistaAMostrar = llistaAMostrar.filter(item => item.q.estatVigencia === 'desactualitzada');
    }

    // Generar targetes de previsualització
    const lletres = ['A', 'B', 'C', 'D'];
    container.innerHTML = llistaAMostrar.map(({ q, originalIdx }) => {
      const idx = originalIdx;
      const teIA = q.iaClassificada;
      const esVigent = (q.estatVigencia || 'vigent') === 'vigent';
      const esDesact = q.estatVigencia === 'desactualitzada';

      return `
        <div style="background:var(--bg-card-subtle,#f8fafc);border:1.5px solid ${!q.valida ? '#f87171' : esDesact ? '#fca5a5' : teIA && !q.iaCoincideix ? '#fcd34d' : 'var(--border-card,#e2e8f0)'};border-radius:12px;padding:12px;font-size:13px;position:relative;">
          
          <!-- Capçalera de la targeta: Número, Tema assignat i Botó eliminar -->
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px;margin-bottom:8px;">
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
              <span style="font-weight:800;color:var(--text-main,#0f172a);font-size:12.5px;">#${idx + 1}</span>
              
              ${teIA && q.iaCoincideix && (q.seccio || q.tema) ? `
                <span style="background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:800;display:inline-flex;align-items:center;gap:4px;">
                  <span>🎯</span> <span>${escapeHtml(q.seccio || q.tema)}</span>
                </span>
              ` : ''}

              ${teIA && !q.iaCoincideix ? `
                <span style="background:#fffbeb;color:#92400e;border:1px solid #fcd34d;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:800;display:inline-flex;align-items:center;gap:4px;">
                  <span>❓</span> <span>Sense tema al catàleg</span>
                </span>
              ` : ''}

              ${!teIA && q.seccio ? `
                <span style="color:var(--text-muted);font-size:12px;">· ${escapeHtml(q.seccio)}</span>
              ` : ''}
            </div>

            <div style="display:flex;align-items:center;gap:6px;">
              <button type="button" onclick="window.obrirModalDubteIA(window.preguntesLotActual[${idx}])" title="Consultar a Gemini sobre aquesta pregunta" style="background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:6px;cursor:pointer;font-size:11px;font-weight:700;padding:3px 8px;display:inline-flex;align-items:center;gap:4px;">
                <span>🤖</span> <span>Dubte IA</span>
              </button>
              <button type="button" onclick="window.eliminarPreguntaDeLot(${idx})" title="Descartar aquesta pregunta" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:14px;padding:2px 6px;">🗑️</button>
            </div>
          </div>

          <!-- Si la IA ha detectat que no coincideix amb cap tema existent: opcions de creació o descart -->
          ${teIA && !q.iaCoincideix ? `
            <div style="background:#fefce8;border:1px dashed #eab308;border-radius:8px;padding:8px 10px;margin-bottom:8px;display:flex;flex-direction:column;gap:6px;">
              <div style="font-size:12px;color:#713f12;line-height:1.4;">
                💡 <b>Nou tema proposat per la IA:</b> <span style="font-weight:800;color:#854d0e;">«${escapeHtml(q.suggerimentNouTema || 'Tema Específic Addicional')}»</span>
              </div>
              <div style="display:flex;gap:6px;flex-wrap:wrap;">
                <button type="button" onclick="window.crearTemaPerPregunta(${idx})" style="padding:4px 8px;background:#059669;color:#fff;border:none;border-radius:6px;font-size:11px;font-weight:800;cursor:pointer;">
                  ➕ Crear aquest tema i assignar
                </button>
                <button type="button" onclick="window.triarTemaExistentPregunta(${idx})" style="padding:4px 8px;background:var(--bg-card,#fff);color:var(--text-main,#1e293b);border:1px solid var(--border-card,#cbd5e1);border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;">
                  📂 Triar tema existent
                </button>
                <button type="button" onclick="window.eliminarPreguntaDeLot(${idx})" style="padding:4px 8px;background:#fee2e2;color:#b91c1c;border:1px solid #fca5a5;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;">
                  🗑️ Descartar
                </button>
              </div>
            </div>
          ` : ''}

          <!-- Text de la pregunta -->
          <div style="font-weight:700;color:var(--text-main,#0f172a);margin-bottom:8px;line-height:1.4;">
            ${escapeHtml(q.pregunta)}
          </div>

          <!-- Opcions tipus test -->
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

          <!-- Estat de vigència i motiu legal si hi ha IA -->
          ${teIA ? `
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px;margin-top:6px;padding-top:6px;border-top:1px dashed var(--border-card,#e2e8f0);">
              <div style="font-size:11.5px;font-weight:700;display:inline-flex;align-items:center;gap:5px;${esVigent ? 'color:#15803d;' : esDesact ? 'color:#b91c1c;' : 'color:#0369a1;'}">
                <span>${esVigent ? '🟢' : esDesact ? '⚠️' : 'ℹ️'}</span>
                <span>${escapeHtml(q.motiuVigencia || (esVigent ? 'Normativa vigent' : 'Revisar vigència'))}</span>
              </div>
              ${esDesact ? `
                <button type="button" onclick="window.eliminarPreguntaDeLot(${idx})" style="padding:2px 6px;background:#fef2f2;color:#dc2626;border:1px solid #f87171;border-radius:4px;font-size:11px;font-weight:700;cursor:pointer;">
                  Descartar desactualitzada
                </button>
              ` : ''}
            </div>
          ` : ''}

          <!-- Explicació si en té -->
          ${q.explicacio ? `
            <div style="font-size:11.5px;color:#0369a1;background:#f0f9ff;padding:6px 8px;border-radius:6px;border-left:3px solid #0284c7;line-height:1.35;margin-top:6px;">
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

    // Assegurar que qualsevol tema nou creat per la IA està donat d'alta al temari del municipi
    if (banc === 'pl' && typeof window.afegirTemaCustomMunicipiPL === 'function') {
      valides.forEach(q => {
        if (q.seccio && !q.seccio.startsWith('Tema 1:') && !q.seccio.startsWith('T1') && q.seccio !== 'Comú') {
          window.afegirTemaCustomMunicipiPL(mun, { nom: q.seccio });
        }
      });
    }

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

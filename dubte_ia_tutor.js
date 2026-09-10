// ============================================================================
// DUBTE IA TUTOR (GEMINI) - AGENT MEDINA
// Resolució de dubtes jurídics en temps real, explicacions i comprovació de vigència
// ============================================================================

(function () {
  let preguntaActualDubte = null;
  let opcioTriadaActual = null;
  let bancActual = 'pl';

  // Obtenir el banc actiu del context
  function detectarBancActiu() {
    try {
      const viewPL = document.getElementById('view-pl');
      if (viewPL && viewPL.classList.contains('view-activa')) return 'pl';
      const viewMossos = document.getElementById('view-mossos');
      if (viewMossos && viewMossos.classList.contains('view-activa')) return 'mossos';
      const viewAct = document.getElementById('view-actualitat');
      if (viewAct && viewAct.classList.contains('view-activa')) return 'act';
    } catch (e) {}
    return 'pl';
  }

  // Obtenir lletra A, B, C, D
  const lletres = ['A', 'B', 'C', 'D'];

  window.obrirModalDubteIA = function (preguntaObj, opcioTriadaIdx, esCorrecte) {
    if (!preguntaObj || !preguntaObj.pregunta) {
      if (typeof mostrarToast === 'function') {
        mostrarToast('⚠️ No s\'ha trobat la pregunta activa per consultar.', 'error');
      }
      return;
    }

    preguntaActualDubte = preguntaObj;
    opcioTriadaActual = (typeof opcioTriadaIdx === 'number' && opcioTriadaIdx >= 0) ? opcioTriadaIdx : null;
    bancActual = detectarBancActiu();
    window.preguntaActualDubteGlobal = preguntaObj;
    window.opcioTriadaActualGlobal = opcioTriadaActual;

    const modal = document.getElementById('modal-dubte-ia');
    if (!modal) return;

    // Emplenar informació de la pregunta
    const temaEl = document.getElementById('dia-pregunta-tema');
    if (temaEl) {
      const nomTema = preguntaObj.seccio || preguntaObj.tema || preguntaObj.ambit || 'Temari General';
      const municipi = preguntaObj.municipi ? ` · ${preguntaObj.municipi}` : '';
      temaEl.textContent = `📚 ${nomTema}${municipi} ${preguntaObj.id ? `(#${preguntaObj.id})` : ''}`;
    }

    const textEl = document.getElementById('dia-pregunta-text');
    if (textEl) {
      textEl.textContent = preguntaObj.pregunta;
    }

    const opcionsEl = document.getElementById('dia-pregunta-opcions');
    if (opcionsEl && Array.isArray(preguntaObj.opcions)) {
      opcionsEl.innerHTML = preguntaObj.opcions.map((op, idx) => {
        const esRespOficial = idx === preguntaObj.resposta;
        const esTriada = opcioTriadaActual !== null && idx === opcioTriadaActual;

        let bg = 'var(--bg-card,#fff)';
        let border = 'var(--border-card,#e2e8f0)';
        let badge = '';

        if (esRespOficial) {
          bg = '#ecfdf5';
          border = '#10b981';
          badge = '<span style="margin-left:auto;background:#10b981;color:#fff;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:800;">✓ Oficial Correcta</span>';
        } else if (esTriada && !esRespOficial) {
          bg = '#fef2f2';
          border = '#ef4444';
          badge = '<span style="margin-left:auto;background:#ef4444;color:#fff;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:800;">✗ La teva tria</span>';
        }

        return `
          <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:${bg};border:1.5px solid ${border};border-radius:8px;font-size:12.5px;color:var(--text-main,#0f172a);">
            <span style="font-weight:800;width:18px;">${lletres[idx] || idx + 1})</span>
            <span style="flex:1;">${escapeHtml(op)}</span>
            ${badge}
          </div>
        `;
      }).join('');
    }

    // Input de dubte: suggeriment per defecte si ha fallat
    const inputDubte = document.getElementById('dia-input-dubte');
    if (inputDubte) {
      if (opcioTriadaActual !== null && opcioTriadaActual !== preguntaObj.resposta) {
        inputDubte.value = `He triat l'opció ${lletres[opcioTriadaActual]}, per què és incorrecta i per què la correcta és la ${lletres[preguntaObj.resposta]}? Quina és la llei vigent?`;
      } else {
        inputDubte.value = 'Explica\'m per què aquesta és la correcta, la llei vigent exacta i per què són falses les altres opcions.';
      }
    }

    // Netejar resposta anterior
    const blocResp = document.getElementById('dia-resposta-bloc');
    const respContingut = document.getElementById('dia-resposta-contingut');
    if (blocResp) blocResp.style.display = 'none';
    if (respContingut) respContingut.innerHTML = '';

    modal.style.display = 'flex';
  };

  window.tancarModalDubteIA = function () {
    const modal = document.getElementById('modal-dubte-ia');
    if (modal) modal.style.display = 'none';
  };

  window.omplirDubteIA = function (text) {
    const input = document.getElementById('dia-input-dubte');
    if (input) {
      input.value = text;
      input.focus();
    }
  };

  window.enviarDubteIA = async function () {
    if (!preguntaActualDubte) return;

    const inputDubte = document.getElementById('dia-input-dubte');
    const dubte = inputDubte ? inputDubte.value.trim() : '';

    const btnConsultar = document.getElementById('dia-btn-consultar');
    const blocResp = document.getElementById('dia-resposta-bloc');
    const carregant = document.getElementById('dia-resposta-carregant');
    const contingut = document.getElementById('dia-resposta-contingut');

    if (btnConsultar) {
      btnConsultar.disabled = true;
      btnConsultar.style.opacity = '0.6';
      btnConsultar.innerHTML = '<span>⏳</span> <span>Consultant a Gemini IA...</span>';
    }

    if (blocResp) blocResp.style.display = 'flex';
    if (carregant) carregant.style.display = 'flex';
    if (contingut) contingut.innerHTML = '';

    try {
      const res = await fetch('/api/gemini/dubte-pregunta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pregunta: preguntaActualDubte.pregunta,
          opcions: preguntaActualDubte.opcions,
          resposta: preguntaActualDubte.resposta,
          respostaTriada: opcioTriadaActual,
          explicacio: preguntaActualDubte.explicacio,
          banc: bancActual,
          seccio: preguntaActualDubte.seccio || preguntaActualDubte.tema,
          dubte: dubte
        })
      });

      const dades = await res.json();
      if (carregant) carregant.style.display = 'none';

      if (dades.success && dades.respostaIA) {
        renderitzarRespostaIA(dades.respostaIA, dades.font, dades.avisApiKey || dades.avisError);
      } else {
        renderitzarErrorIA(dades.error || 'No s\'ha pogut obtenir la resposta.');
      }
    } catch (err) {
      console.error('Error enviant dubte a la IA:', err);
      if (carregant) carregant.style.display = 'none';
      renderitzarErrorIA(err.message || 'Error de connexió.');
    } finally {
      if (btnConsultar) {
        btnConsultar.disabled = false;
        btnConsultar.style.opacity = '1';
        btnConsultar.innerHTML = '<span>✨</span> <span>Tornar a preguntar o aprofundir</span>';
      }
    }
  };

  function renderitzarRespostaIA(info, font, avis) {
    const contingut = document.getElementById('dia-resposta-contingut');
    if (!contingut) return;

    const esVigent = (info.estatVigencia || 'vigent') === 'vigent';
    const esRevisio = info.estatVigencia === 'revisio' || info.estatVigencia === 'desactualitzada';

    contingut.innerHTML = `
      <!-- Alerta de font o API key si s'aplica -->
      ${avis ? `
        <div style="background:#fffbeb;border:1px solid #fde68a;padding:8px 12px;border-radius:8px;font-size:12px;color:#92400e;">
          ℹ️ ${escapeHtml(avis)}
        </div>
      ` : ''}

      <!-- Targeta d'Explicació Clau -->
      <div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:12px;padding:14px;">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
          <span style="font-size:16px;">🎯</span>
          <span style="font-size:13px;font-weight:900;color:#166534;">Explicació Pedagògica</span>
        </div>
        <div style="font-size:13.5px;color:#14532d;line-height:1.5;white-space:pre-line;">
          ${escapeHtml(info.explicacioClau || '')}
        </div>
      </div>

      <!-- Anàlisi Jurídica i Article Vigent -->
      ${info.perQueEsCorrecta ? `
        <div style="background:var(--bg-card,#fff);border:1.5px solid var(--border-card,#cbd5e1);border-radius:12px;padding:14px;">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:8px;">
            <div style="display:flex;align-items:center;gap:6px;">
              <span style="font-size:16px;">⚖️</span>
              <span style="font-size:13px;font-weight:900;color:var(--text-main,#0f172a);">Fonament Jurídic</span>
            </div>
            ${info.baseLegalVigent ? `
              <span style="background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;padding:3px 8px;border-radius:6px;font-size:11.5px;font-weight:800;">
                📜 ${escapeHtml(info.baseLegalVigent)}
              </span>
            ` : ''}
          </div>
          <div style="font-size:13px;color:var(--text-main,#334155);line-height:1.5;">
            ${escapeHtml(info.perQueEsCorrecta)}
          </div>
        </div>
      ` : ''}

      <!-- Comprovació de Vigència Legal -->
      <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:10px;${esVigent ? 'background:#ecfdf5;border:1.5px solid #10b981;color:#065f46;' : esRevisio ? 'background:#fef2f2;border:1.5px solid #ef4444;color:#991b1b;' : 'background:#f8fafc;border:1px solid #cbd5e1;color:#334155;'}">
        <span style="font-size:18px;">${esVigent ? '🟢' : esRevisio ? '⚠️' : 'ℹ️'}</span>
        <div style="font-size:12.5px;line-height:1.4;">
          <b>Vigència Legal:</b> ${escapeHtml(info.detallVigencia || (esVigent ? 'Normativa vigent' : 'Cal revisar reformes'))}
        </div>
      </div>

      <!-- Per què són falses les altres opcions -->
      ${info.perQueSonFalses ? `
        <div style="background:var(--bg-card-subtle,#f8fafc);border:1px solid var(--border-card,#e2e8f0);border-radius:12px;padding:14px;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
            <span style="font-size:16px;">❌</span>
            <span style="font-size:13px;font-weight:900;color:var(--text-main,#0f172a);">Anàlisi de les Opcions Incorrectes (Paranys)</span>
          </div>
          <div style="font-size:12.5px;color:var(--text-muted,#475569);line-height:1.5;white-space:pre-line;">
            ${escapeHtml(info.perQueSonFalses)}
          </div>
        </div>
      ` : ''}

      <!-- Consell o Mnemotècnia d'Examen -->
      ${info.consellExamen ? `
        <div style="background:linear-gradient(135deg,#fffbeb,#fef3c7);border:1.5px solid #f59e0b;border-radius:12px;padding:12px 14px;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
            <span style="font-size:16px;">💡</span>
            <span style="font-size:12.5px;font-weight:900;color:#92400e;">Clau pràctica per a l'oposició</span>
          </div>
          <div style="font-size:12.5px;color:#78350f;line-height:1.45;">
            ${escapeHtml(info.consellExamen)}
          </div>
        </div>
      ` : ''}

      <!-- Acció per aprofundir amb el Tutor IA -->
      <div style="text-align:center;margin-top:14px;padding-top:10px;border-top:1px solid var(--border-card,#e2e8f0);">
        <button type="button" onclick="window.tancarModalDubteIA(); if (typeof window.obrirTutorAmbPregunta === 'function') window.obrirTutorAmbPregunta(window.preguntaActualDubteGlobal, window.opcioTriadaActualGlobal);" style="background:#002B5E;color:#ffffff;border:none;padding:10px 20px;border-radius:10px;font-size:13px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:8px;box-shadow:0 3px 8px rgba(0,43,94,0.25);transition:all 0.2s;">
          <span>🧠</span> <span>Aprofundir i debatre al Xat del Tutor IA</span> <span>➔</span>
        </button>
      </div>
    `;
  }

  function renderitzarErrorIA(missatge) {
    const contingut = document.getElementById('dia-resposta-contingut');
    if (!contingut) return;
    contingut.innerHTML = `
      <div style="background:#fee2e2;border:1.5px solid #ef4444;border-radius:10px;padding:14px;color:#991b1b;font-size:13px;">
        <p style="margin:0 0 4px;font-weight:800;">⚠️ No s'ha pogut obtenir la resposta de la IA:</p>
        <p style="margin:0;font-size:12px;">${escapeHtml(missatge)}</p>
      </div>
    `;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

})();

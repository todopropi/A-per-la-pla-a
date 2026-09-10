// ==========================================================================
// COMUNITAT & OLD-SCHOOL MSN MESSENGER (Agent Medina)
// Permet veure gent en actiu, xatejar pel xat global i enviar missatges
// privats estil MSN Messenger clàssic (amb Zumbit, emoticones i estat en línia).
// ==========================================================================

(function() {
  'use strict';

  // Perfil d'usuari local
  const DEFAULT_PERFIL = {
    nom: 'Tu (Opositor/a)',
    avatar: '👮‍♂️',
    cos: 'Mossos',
    estat: 'online', // 'online', 'ocupat', 'invisible'
    fraseEstat: '♫ Estudiant el Codi Penal i la Constitució... a per la plaça! ♫'
  };

  function carregarPerfilUsuari() {
    try {
      const p = localStorage.getItem('agentmedina_comunitat_perfil');
      if (p) return { ...DEFAULT_PERFIL, ...JSON.parse(p) };
    } catch (e) {
      console.warn('Error carregant perfil comunitat:', e);
    }
    return { ...DEFAULT_PERFIL };
  }

  function desarPerfilUsuari(perfil) {
    try {
      localStorage.setItem('agentmedina_comunitat_perfil', JSON.stringify(perfil));
    } catch (e) {
      console.warn('Error desant perfil comunitat:', e);
    }
  }

  // Estat global en memòria
  let usuarisActius = [
    {
      id: 'marc_mossos',
      nom: 'Marc V. (Mossos 46/26)',
      cos: 'Mossos d\'Esquadra',
      avatar: '👮‍♂️',
      estat: 'online',
      fraseEstat: 'Repassant Codi Penal (Homicidi i Lesions) 📖',
      ultimTest: 'Àmbit B: 9.2/10',
      temaActual: 'Tema 11 - Dret Penal',
      respostesMock: [
        'Bones! Estic repassant la diferència entre homicidi i assassinat (art. 138 i 139 CP). Com ho portes tu?',
        'Totalment d\'acord, aquest article sempre cau als exàmens de Mossos!',
        'Has provat el test de l\'Àmbit B? Està molt complet, a mi m\'ha ajudat molt.',
        'Ànims amb l\'estudi, la convocatòria 46/26 és nostra! 💪',
        'Recorda que la traïdoria sempre qualifica com a assassinat!'
      ]
    },
    {
      id: 'nuria_gub',
      nom: 'Núria R. (Guàrdia Urbana)',
      cos: 'Policia Local',
      avatar: '👩‍✈️',
      estat: 'online',
      fraseEstat: '♫ Fent test d\'ordenances municipals i trànsit (8) ♫',
      ultimTest: 'Tema 24 PL: 8.8/10',
      temaActual: 'Tema 24 - Trànsit i Seguretat Viària',
      respostesMock: [
        'Hola! Just estic amb les taxes d\'alcoholèmia i els delictes contra la seguretat viària (art. 379 CP).',
        'A les policies locals pregunten moltíssim el Reglament General de Circulació!',
        'Has fet el test del municipi de Constantí? Té preguntes molt específiques.',
        'Molt bona pregunta! Jo ho tinc apuntat a les meves flashcards d\'errors.',
        'Recorda: 0,25 mg/l en aire expirat és la taxa general administrativa!'
      ]
    },
    {
      id: 'jordi_pl',
      nom: 'Jordi M. (PL Reus / Constantí)',
      cos: 'Policia Local',
      avatar: '👨‍✈️',
      estat: 'online',
      fraseEstat: 'Algú sap si la Llei 16/1991 entra sencera? (8)',
      ultimTest: 'Tema 14 PL: 8.0/10',
      temaActual: 'Llei 16/1991 de Policies Locals',
      respostesMock: [
        'Iep! Sí, la Llei 16/1991 de coordinació de les policies locals de Catalunya és fonamental!',
        'Compte amb les funcions de la policia local de l\'article 11, cauen sempre.',
        'Com portes el procediment sancionador de la Llei 39/2015?',
        'Molt bé! Jo intento fer almenys 40 preguntes cada tarda per agafar ritme.'
      ]
    },
    {
      id: 'laura_mosses',
      nom: 'Laura B. (Àmbit C)',
      cos: 'Mossos d\'Esquadra',
      avatar: '👩‍💼',
      estat: 'ocupat',
      fraseEstat: 'Fent Simulacre Oficial 30 minuts... No molestar ⏱️',
      ultimTest: 'Simulacre: 7.8/10',
      temaActual: 'Simulacre 30 preguntes',
      respostesMock: [
        'Hola! Estava acabant el simulacre de 30 preguntes en 30 minuts. El temps vola!',
        'Al simulacre hi ha hagut 3 preguntes de la Llei 10/1994 que eren perilloses.',
        'El truc és no contestar si dubtes molt per no restar el -0.25.',
        'Vas a per totes a la propera convocatòria?'
      ]
    },
    {
      id: 'pol_opositor',
      nom: 'Pol C. (Actualitat 2026)',
      cos: 'Mossos i PL',
      avatar: '🧑‍💻',
      estat: 'online',
      fraseEstat: 'Les fites d\'actualitat 2026 cauen segur a l\'examen! (Y)',
      ultimTest: 'Actualitat 2026: 9.5/10',
      temaActual: 'Actualitat i Notícies 2025-2026',
      respostesMock: [
        'Ei! Has repassat la secció d\'Actualitat de l\'app? Han actualitzat tots els blocs.',
        'Les fites d\'esports i premis culturals catalans de 2025 solen ser preguntes regalades si les saps.',
        'Totalment! Jo faig un test ràpid de 10 preguntes d\'actualitat cada matí amb el cafè.',
        'Qualsevol novetat política o canvis a la cúpula dels Mossos, ho comentem per aquí!'
      ]
    },
    {
      id: 'sergi_girona',
      nom: 'Sergi T. (Policia Municipal)',
      cos: 'Policia Local',
      avatar: '👮',
      estat: 'ocupat',
      fraseEstat: 'Estudiant tema 15 procediment administratiu ⚖️',
      ultimTest: 'Tema 15: 7.0/10',
      temaActual: 'Tema 15 - Procediment Administratiu',
      respostesMock: [
        'Hola! Estava barallant-me amb els terminis del silenci administratiu (positiu vs negatiu).',
        'La Llei 39/2015 és feixuga però clau per guanyar punts a la fase d\'oposició!',
        'T\'has mirat el recurs d\'alçada i de reposició? Recorda el mes de termini!',
        'Ens veiem aviat amb l\'uniforme posat!'
      ]
    }
  ];

  let xatGlobal = [
    {
      id: 'g-1',
      usuariId: 'marc_mossos',
      nom: 'Marc V. (Mossos 46/26)',
      avatar: '👮‍♂️',
      cos: 'Mossos',
      text: 'Hola companys! Com porteu el repàs del Codi Penal per a la convocatòria 46/26?',
      hora: '10:15'
    },
    {
      id: 'g-2',
      usuariId: 'nuria_gub',
      nom: 'Núria R. (Guàrdia Urbana)',
      avatar: '👩‍✈️',
      cos: 'Policia Local',
      text: 'Molt ficada amb ordenances de trànsit! Recomano fer els tests dels temes 23 i 24 de PL!',
      hora: '10:18'
    },
    {
      id: 'g-3',
      usuariId: 'pol_opositor',
      nom: 'Pol C. (Actualitat 2026)',
      avatar: '🧑‍💻',
      cos: 'Mossos',
      text: 'Heu vist les preguntes d\'Actualitat que acaben d\'actualitzar? Molt útils per consolidar política i esports.',
      hora: '10:22'
    }
  ];

  // Historial de xats privats: { [usuariId]: [ { de: 'me'|usuariId, nom, avatar, text, hora, esZumbit } ] }
  let privatsPerUsuari = {};

  // Estat del Messenger antic actiu
  let msnObertAmbId = null;
  let msnMinimitzat = false;
  let msnEstaEscrivint = false;
  let canalGlobalActiu = 'general'; // 'general', 'mossos', 'pl', 'dubtes'

  // Carregar converses guardades a localStorage
  function carregarPrivatsLocals() {
    try {
      const p = localStorage.getItem('agentmedina_msn_privats');
      if (p) privatsPerUsuari = JSON.parse(p);
    } catch (e) {
      console.warn('Error carregar privats:', e);
    }
  }

  function desarPrivatsLocals() {
    try {
      localStorage.setItem('agentmedina_msn_privats', JSON.stringify(privatsPerUsuari));
    } catch (e) {
      console.warn('Error desant privats:', e);
    }
  }

  carregarPrivatsLocals();

  // So retro de Zumbit amb Web Audio API
  function reproduirSoZumbit() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 0.12);
      osc.frequency.setValueAtTime(160, audioCtx.currentTime + 0.16);
      osc.frequency.exponentialRampToValueAtTime(70, audioCtx.currentTime + 0.35);

      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.42);
    } catch (e) {
      // Ignorar si l'àudio està bloquejat pel navegador
    }
  }

  // Obtenir estat del servidor
  async function sincronitzarAmbServidor() {
    try {
      const res = await fetch('/api/comunitat/estat');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.usuaris) && data.usuaris.length) {
          usuarisActius = data.usuaris;
        }
        if (Array.isArray(data.xatGlobal) && data.xatGlobal.length) {
          xatGlobal = data.xatGlobal;
        }
        if (data.privats && typeof data.privats === 'object') {
          privatsPerUsuari = { ...privatsPerUsuari, ...data.privats };
        }
      }
    } catch (e) {
      // Si el servidor falla, funciona amb dades locals
    }
  }

  // Formatador d'emoticones clàssics MSN
  function parsejarEmoticonesMSN(text) {
    if (!text) return '';
    const safe = escapeHtml(text);
    const mapa = {
      ':-)': '😊', ':)': '😊',
      ':-D': '😃', ':D': '😃',
      ':-P': '😛', ':P': '😛', ':p': '😛',
      ';-)': '😉', ';)': '😉',
      ':-O': '😮', ':O': '😮', ':o': '😮',
      ':-(': '🙁', ':(': '🙁',
      ':-S': '😖', ':S': '😖',
      ':-$': '😳', ':$': '😳',
      '(H)': '😎', '(h)': '😎',
      '(A)': '😇', '(a)': '😇',
      '(L)': '❤️', '(l)': '❤️',
      '(U)': '💔', '(u)': '💔',
      '(Y)': '👍', '(y)': '👍',
      '(N)': '👎', '(n)': '👎',
      '(8)': '🎵',
      '(K)': '😘', '(k)': '😘',
      '(G)': '🎁',
      '(B)': '🍺',
      '(D)': '🍸',
      '(X)': '👧',
      '(Z)': '👦',
      '(6)': '😈',
      '(#)': '☀️',
      '(R)': '🌈'
    };

    let resultat = safe;
    for (const [clau, emoji] of Object.entries(mapa)) {
      const reg = new RegExp(clau.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      resultat = resultat.replace(reg, `<span class="msn-emoji" title="${clau}" style="font-size:1.15em;vertical-align:middle;">${emoji}</span>`);
    }
    return resultat;
  }

  // ==========================================================================
  // VISTA PRINCIPAL: COMUNITAT
  // ==========================================================================
  function mostrarComunitat() {
    const contenedor = document.getElementById('view-comunitat');
    if (!contenedor) return;

    contenedor.style.display = 'block';
    contenedor.classList.add('view-activa');

    const perfil = carregarPerfilUsuari();
    const onlineCount = usuarisActius.filter(u => u.estat === 'online').length + (perfil.estat === 'online' ? 1 : 0);

    contenedor.innerHTML = `
      <div style="max-width: 1200px; margin: 0 auto; width: 100%; display: flex; flex-direction: column; gap: 20px;">
        
        <!-- Hero & Barra d'Estat de la Comunitat -->
        <div style="background: linear-gradient(135deg, #0b2545 0%, #133c55 50%, #007aff 100%); color: #ffffff; border-radius: 18px; padding: 22px 26px; box-shadow: 0 10px 30px rgba(11,37,69,0.25); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
          <div style="display: flex; align-items: center; gap: 16px;">
            <div style="width: 54px; height: 54px; border-radius: 14px; background: rgba(255,255,255,0.15); border: 1.5px solid rgba(255,255,255,0.25); display: flex; align-items: center; justify-content: center; font-size: 28px; flex-shrink: 0;">
              💬
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                <h2 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">Comunitat d'Opositors & Medina Messenger</h2>
                <span style="background: rgba(16,185,129,0.2); border: 1px solid #10b981; color: #a7f3d0; font-size: 12px; font-weight: 800; padding: 4px 10px; border-radius: 999px; display: inline-flex; align-items: center; gap: 6px;">
                  <span style="width: 8px; height: 8px; border-radius: 50%; background: #10b981; display: inline-block; animation: pulseDot 2s infinite;"></span>
                  ${onlineCount} opositors en línia
                </span>
              </div>
              <p style="margin: 6px 0 0; font-size: 13.5px; opacity: 0.9; max-width: 650px;">
                Estudia acompanyat: parla pel xat global de l'acadèmia o obre un xat privat estil MSN Messenger clàssic per compartir dubtes de lleis i fer zumbits!
              </p>
            </div>
          </div>

          <!-- Perfil Ràpid de l'usuari -->
          <div id="card-perfil-usuari" style="background: rgba(255,255,255,0.12); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.25); padding: 12px 16px; border-radius: 14px; display: flex; align-items: center; gap: 12px;">
            <div style="font-size: 26px;">${perfil.avatar}</div>
            <div>
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="font-weight: 800; font-size: 14px;">${escapeHtml(perfil.nom)}</span>
                <span style="font-size: 10px; padding: 2px 6px; border-radius: 4px; background: rgba(255,255,255,0.2);">${escapeHtml(perfil.cos)}</span>
              </div>
              <div style="font-size: 11.5px; opacity: 0.85; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                ${escapeHtml(perfil.fraseEstat)}
              </div>
            </div>
            <button id="btn-editar-perfil-comunitat" title="Personalitzar el teu estat estil MSN" style="background: #ffffff; color: #0b2545; border: none; padding: 6px 10px; border-radius: 8px; font-weight: 800; font-size: 11.5px; cursor: pointer; transition: all 0.2s;">
              ✏️ Estat
            </button>
          </div>
        </div>

        <!-- Graella Principal: Xat Global (Esquerra) + Gent en Actiu / Buddy List (Dreta) -->
        <div style="display: grid; grid-template-columns: 1fr 340px; gap: 20px; align-items: start;" class="comunitat-grid-responsive">
          
          <!-- COLUMNA ESQUERRA: XAT GLOBAL -->
          <div style="background: var(--bg-card, #ffffff); border: 1.5px solid var(--border-card, #e2e8f0); border-radius: 18px; box-shadow: var(--shadow-card); display: flex; flex-direction: column; overflow: hidden; height: 680px;">
            
            <!-- Capçalera del Xat Global & Filtre de Canals -->
            <div style="padding: 16px 20px; border-bottom: 1.5px solid var(--border-card, #e2e8f0); background: var(--bg-card-subtle, #f8fafc); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
              <div>
                <div style="font-weight: 800; font-size: 16px; color: var(--text-main, #0f172a); display: flex; align-items: center; gap: 8px;">
                  <span>🌐</span> <span>Xat Global de l'Acadèmia</span>
                </div>
                <div style="font-size: 12px; color: var(--text-muted, #64748b);">Canal obert a tots els aspirants de Mossos i Policia Local</div>
              </div>

              <!-- Píndoles de Canals -->
              <div style="display: flex; gap: 6px;">
                <button class="btn-canal-comunitat active" data-canal="general" style="padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 800; cursor: pointer; border: 1px solid #cbd5e1; background: #007aff; color: #fff;">#General</button>
                <button class="btn-canal-comunitat" data-canal="mossos" style="padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 800; cursor: pointer; border: 1px solid #cbd5e1; background: #fff; color: #475569;">#Mossos-46</button>
                <button class="btn-canal-comunitat" data-canal="pl" style="padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 800; cursor: pointer; border: 1px solid #cbd5e1; background: #fff; color: #475569;">#Policia-Local</button>
              </div>
            </div>

            <!-- Cos del xat: missatges -->
            <div id="comunitat-xat-missatges" style="flex: 1; padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; background: var(--bg-app, #f8fafc);">
              <!-- Renderitzat dinàmicament per pintarXatGlobal() -->
            </div>

            <!-- Barra inferior d'enviament -->
            <form id="form-xat-global" style="padding: 14px 18px; border-top: 1.5px solid var(--border-card, #e2e8f0); background: var(--bg-card, #ffffff); display: flex; align-items: center; gap: 10px;">
              <div style="display: flex; gap: 6px;">
                <button type="button" id="btn-emoji-global" title="Inserir emoticona" style="background: var(--bg-card-subtle, #f1f5f9); border: 1px solid var(--border-card, #cbd5e1); border-radius: 10px; width: 38px; height: 38px; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                  😊
                </button>
              </div>

              <input type="text" id="input-xat-global" placeholder="Escriu un missatge al xat general..." autocomplete="off" style="flex: 1; padding: 10px 14px; border: 1.5px solid var(--border-card, #cbd5e1); border-radius: 10px; font-size: 14px; outline: none; background: var(--bg-card-subtle, #ffffff); color: var(--text-main, #0f172a);">

              <button type="submit" style="background: linear-gradient(135deg, #002B5E, #007aff); color: #ffffff; border: none; padding: 10px 18px; border-radius: 10px; font-weight: 800; font-size: 13.5px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 4px 12px rgba(0,122,255,0.25);">
                <span>Enviar</span> <span>➔</span>
              </button>
            </form>
          </div>

          <!-- COLUMNA DRETA: BUDDY LIST (GENT EN ACTIU) -->
          <div style="background: var(--bg-card, #ffffff); border: 1.5px solid var(--border-card, #e2e8f0); border-radius: 18px; box-shadow: var(--shadow-card); display: flex; flex-direction: column; overflow: hidden; height: 680px;">
            
            <div style="padding: 16px 18px; border-bottom: 1.5px solid var(--border-card, #e2e8f0); background: var(--bg-card-subtle, #f8fafc);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-weight: 800; font-size: 15px; color: var(--text-main, #0f172a); display: flex; align-items: center; gap: 6px;">
                  <span>👥</span> <span>Companys en Actiu</span>
                </span>
                <span style="font-size: 11px; font-weight: 800; color: #007aff; background: rgba(0,122,255,0.1); padding: 3px 8px; border-radius: 999px;">
                  MSN Mode
                </span>
              </div>
              <input type="text" id="filtre-companys-actius" placeholder="🔍 Cerca company o oposició..." style="width: 100%; box-sizing: border-box; padding: 7px 12px; border: 1px solid var(--border-card, #cbd5e1); border-radius: 8px; font-size: 12.5px; outline: none; background: var(--bg-card, #ffffff); color: var(--text-main, #0f172a);">
            </div>

            <!-- Llista d'usuaris amb scroll -->
            <div id="llista-companys-actius" style="flex: 1; padding: 12px 14px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px;">
              <!-- Renderitzat per pintarCompanysActius() -->
            </div>

            <!-- Peu de la Buddy list -->
            <div style="padding: 12px 16px; border-top: 1px solid var(--border-card, #e2e8f0); background: var(--bg-card-subtle, #f8fafc); font-size: 11.5px; color: var(--text-muted, #64748b); text-align: center;">
              💡 Clica a qualsevol company per obrir el <b>Messenger clàssic privat</b> i fer-li consultes o zumbits!
            </div>
          </div>

        </div>

      </div>

      <!-- INJECCIÓ DE LA FINESTRA RETRO MSN MESSENGER (MODAL O DOCKABLE) -->
      <div id="contenidor-msn-messenger" style="display: none;"></div>
    `;

    // Iniciar escoltadors i renderitzats
    pintarXatGlobal();
    pintarCompanysActius();
    activarEsdevenimentsComunitat();
    sincronitzarAmbServidor().then(() => {
      pintarXatGlobal();
      pintarCompanysActius();
    });
  }

  // ==========================================================================
  // RENDERITZAT DEL XAT GLOBAL
  // ==========================================================================
  function pintarXatGlobal() {
    const contenedor = document.getElementById('comunitat-xat-missatges');
    if (!contenedor) return;

    if (!xatGlobal.length) {
      contenedor.innerHTML = `
        <div style="text-align: center; color: var(--text-muted, #64748b); padding: 40px 20px;">
          <p style="font-size: 28px; margin: 0 0 10px 0;">💬</p>
          <p style="font-weight: 700; margin: 0;">Sigues el primer a escriure al xat general de l'acadèmia!</p>
        </div>
      `;
      return;
    }

    const perfil = carregarPerfilUsuari();

    contenedor.innerHTML = xatGlobal.map(msg => {
      const esMeu = msg.usuariId === 'me' || msg.nom === perfil.nom;
      const colorCos = msg.cos && msg.cos.includes('Mossos') ? '#007aff' : '#10b981';

      return `
        <div style="display: flex; gap: 12px; align-items: flex-start; ${esMeu ? 'flex-direction: row-reverse;' : ''}">
          <!-- Avatar -->
          <div style="width: 40px; height: 40px; border-radius: 50%; background: var(--bg-card, #ffffff); border: 1.5px solid var(--border-card, #cbd5e1); display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; box-shadow: 0 2px 6px rgba(0,0,0,0.05);">
            ${msg.avatar || '👤'}
          </div>

          <!-- Bombolla -->
          <div style="max-width: 78%; display: flex; flex-direction: column; ${esMeu ? 'align-items: flex-end;' : 'align-items: flex-start;'}">
            
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px; font-size: 12px;">
              <span style="font-weight: 800; color: var(--text-main, #0f172a);">${escapeHtml(msg.nom)}</span>
              ${msg.cos ? `<span style="font-size: 10px; font-weight: 700; color: ${colorCos}; background: ${colorCos}18; padding: 1px 6px; border-radius: 4px;">${escapeHtml(msg.cos)}</span>` : ''}
              <span style="font-size: 11px; color: var(--text-muted, #94a3b8);">${msg.hora || ''}</span>
              ${!esMeu && msg.usuariId !== 'me' ? `
                <button type="button" class="btn-obrir-msn-des-xat" data-uid="${msg.usuariId}" data-nom="${escapeHtml(msg.nom)}" title="Obrir conversa privada tipus Messenger" style="background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd; border-radius: 6px; font-size: 10.5px; font-weight: 800; padding: 2px 6px; cursor: pointer;">
                  💬 Privat
                </button>
              ` : ''}
            </div>

            <div style="background: ${esMeu ? 'linear-gradient(135deg, #002B5E, #007aff)' : 'var(--bg-card, #ffffff)'}; color: ${esMeu ? '#ffffff' : 'var(--text-main, #0f172a)'}; border: 1.5px solid ${esMeu ? 'transparent' : 'var(--border-card, #e2e8f0)'}; padding: 11px 16px; border-radius: ${esMeu ? '16px 4px 16px 16px' : '4px 16px 16px 16px'}; font-size: 14px; line-height: 1.45; box-shadow: 0 2px 8px rgba(0,0,0,0.04); word-break: break-word;">
              ${parsejarEmoticonesMSN(msg.text)}
            </div>

          </div>
        </div>
      `;
    }).join('');

    // Auto-scroll al final
    contenedor.scrollTop = contenedor.scrollHeight;

    // Connectar botons de "💬 Privat" des del xat
    contenedor.querySelectorAll('.btn-obrir-msn-des-xat').forEach(btn => {
      btn.addEventListener('click', () => {
        const uid = btn.getAttribute('data-uid');
        obrirMessengerAmb(uid);
      });
    });
  }

  // ==========================================================================
  // RENDERITZAT DE LA BUDDY LIST (COMPANYS EN ACTIU)
  // ==========================================================================
  function pintarCompanysActius(filtreText = '') {
    const contenedor = document.getElementById('llista-companys-actius');
    if (!contenedor) return;

    const filtre = (filtreText || '').toLowerCase().trim();
    const llista = usuarisActius.filter(u => {
      if (!filtre) return true;
      return u.nom.toLowerCase().includes(filtre) ||
             (u.cos && u.cos.toLowerCase().includes(filtre)) ||
             (u.fraseEstat && u.fraseEstat.toLowerCase().includes(filtre)) ||
             (u.temaActual && u.temaActual.toLowerCase().includes(filtre));
    });

    if (!llista.length) {
      contenedor.innerHTML = `
        <div style="text-align: center; color: var(--text-muted, #94a3b8); padding: 30px 10px; font-size: 13px;">
          No s'han trobat opositors amb aquest filtre.
        </div>
      `;
      return;
    }

    // Dividim en En línia i Ocupats
    const enLinia = llista.filter(u => u.estat === 'online');
    const ocupats = llista.filter(u => u.estat === 'ocupat');

    let html = '';

    if (enLinia.length) {
      html += `<div style="font-size: 11px; font-weight: 800; color: #10b981; text-transform: uppercase; letter-spacing: 0.5px; margin: 4px 0 2px 4px;">🟢 En línia (${enLinia.length})</div>`;
      html += enLinia.map(u => renderitzarTargetaCompany(u)).join('');
    }

    if (ocupats.length) {
      html += `<div style="font-size: 11px; font-weight: 800; color: #f59e0b; text-transform: uppercase; letter-spacing: 0.5px; margin: 12px 0 2px 4px;">🟡 Fent un Test / Ocupats (${ocupats.length})</div>`;
      html += ocupats.map(u => renderitzarTargetaCompany(u)).join('');
    }

    contenedor.innerHTML = html;

    // Connectar clics als botons de xat privat
    contenedor.querySelectorAll('.card-company-actiu').forEach(card => {
      card.addEventListener('click', (e) => {
        const uid = card.getAttribute('data-uid');
        obrirMessengerAmb(uid);
      });
    });
  }

  function renderitzarTargetaCompany(u) {
    const esOnline = u.estat === 'online';
    const colorPunt = esOnline ? '#10b981' : '#f59e0b';

    return `
      <div class="card-company-actiu" data-uid="${u.id}" style="background: var(--bg-card-subtle, #f8fafc); border: 1.5px solid var(--border-card, #e2e8f0); border-radius: 12px; padding: 10px 12px; display: flex; align-items: center; justify-content: space-between; gap: 10px; cursor: pointer; transition: all 0.18s ease; user-select: none;">
        
        <div style="display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1;">
          <div style="position: relative; flex-shrink: 0;">
            <div style="width: 38px; height: 38px; border-radius: 50%; background: #ffffff; border: 1.5px solid var(--border-card, #cbd5e1); display: flex; align-items: center; justify-content: center; font-size: 20px;">
              ${u.avatar}
            </div>
            <span style="position: absolute; bottom: 0; right: 0; width: 11px; height: 11px; border-radius: 50%; background: ${colorPunt}; border: 2px solid #ffffff;"></span>
          </div>

          <div style="min-width: 0; flex: 1;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-weight: 800; font-size: 13.5px; color: var(--text-main, #0f172a); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(u.nom)}</span>
            </div>
            <div style="font-size: 11.5px; color: var(--text-muted, #64748b); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 1px;" title="${escapeHtml(u.fraseEstat)}">
              ${escapeHtml(u.fraseEstat)}
            </div>
            <div style="font-size: 10.5px; color: #007aff; font-weight: 700; margin-top: 2px;">
              🎯 ${escapeHtml(u.ultimTest || u.temaActual || 'Estudiant')}
            </div>
          </div>
        </div>

        <button type="button" class="btn-iniciar-msn" title="Obrir conversa MSN Messenger" style="background: #007aff; color: #ffffff; border: none; width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 14px; cursor: pointer; flex-shrink: 0; transition: transform 0.15s;">
          💬
        </button>

      </div>
    `;
  }

  // ==========================================================================
  // ESDEVENIMENTS DE LA COMUNITAT
  // ==========================================================================
  function activarEsdevenimentsComunitat() {
    // Formulari d'enviament de missatge al xat global
    const formGlobal = document.getElementById('form-xat-global');
    if (formGlobal) {
      formGlobal.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('input-xat-global');
        if (!input || !input.value.trim()) return;

        const text = input.value.trim();
        input.value = '';

        const perfil = carregarPerfilUsuari();
        const d = new Date();
        const hora = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

        const nouMsg = {
          id: 'g-' + Date.now(),
          usuariId: 'me',
          nom: perfil.nom,
          avatar: perfil.avatar,
          cos: perfil.cos,
          text,
          hora
        };

        xatGlobal.push(nouMsg);
        pintarXatGlobal();

        // Enviar al servidor en segon pla
        try {
          fetch('/api/comunitat/xat-global', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              nom: perfil.nom,
              avatar: perfil.avatar,
              cos: perfil.cos,
              text
            })
          }).catch(() => {});
        } catch (err) {}

        // Resposta dinàmica d'algun opositor per fer el xat viu
        generarRespostaAutomaticaGlobal(text);
      });
    }

    // Filtre de cerca de companys
    const inputFiltre = document.getElementById('filtre-companys-actius');
    if (inputFiltre) {
      inputFiltre.addEventListener('input', (e) => {
        pintarCompanysActius(e.target.value);
      });
    }

    // Botó per editar estat/perfil
    const btnEditar = document.getElementById('btn-editar-perfil-comunitat');
    if (btnEditar) {
      btnEditar.addEventListener('click', obrirModalEditarPerfilMSN);
    }

    // Selector d'emoticones per al xat global
    const btnEmojiGlobal = document.getElementById('btn-emoji-global');
    if (btnEmojiGlobal) {
      btnEmojiGlobal.addEventListener('click', (e) => {
        e.stopPropagation();
        obrirMenuEmojis(btnEmojiGlobal, (emoji) => {
          const input = document.getElementById('input-xat-global');
          if (input) {
            input.value += ' ' + emoji + ' ';
            input.focus();
          }
        });
      });
    }

    // Filtres de canals
    document.querySelectorAll('.btn-canal-comunitat').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-canal-comunitat').forEach(b => {
          b.style.background = '#fff';
          b.style.color = '#475569';
          b.classList.remove('active');
        });
        btn.style.background = '#007aff';
        btn.style.color = '#fff';
        btn.classList.add('active');
        canalGlobalActiu = btn.getAttribute('data-canal') || 'general';
        pintarXatGlobal();
      });
    });
  }

  // Resposta simulada al xat global per mantenir la sensació d'activitat viva
  function generarRespostaAutomaticaGlobal(textEnviat) {
    setTimeout(() => {
      const opositor = usuarisActius[Math.floor(Math.random() * usuarisActius.length)];
      if (!opositor) return;

      const d = new Date();
      const hora = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

      const respostes = [
        `Molt ben vist! Ànims amb aquest bloc.`,
        `Totalment d'acord! Això és pregunta clau a les oposicions.`,
        `Jo just estava repassant el mateix tema fa una estona!`,
        `Algú s'anima a fer un test ràpid d'aquí a una estona?`,
        `Gràcies per la dada! Ho apunto al meu resum de repàs.`
      ];

      const text = respostes[Math.floor(Math.random() * respostes.length)];
      const nouMsg = {
        id: 'g-auto-' + Date.now(),
        usuariId: opositor.id,
        nom: opositor.nom,
        avatar: opositor.avatar,
        cos: opositor.cos,
        text,
        hora
      };

      xatGlobal.push(nouMsg);
      const contenedor = document.getElementById('comunitat-xat-missatges');
      if (contenedor && contenedor.offsetParent !== null) {
        pintarXatGlobal();
      }
    }, 2800);
  }

  // ==========================================================================
  // RETRO OLD-SCHOOL MSN MESSENGER WINDOW
  // ==========================================================================
  function obrirMessengerAmb(usuariId) {
    const target = usuarisActius.find(u => u.id === usuariId);
    if (!target) return;

    msnObertAmbId = usuariId;
    msnMinimitzat = false;

    // Si no hi ha missatges previs, creem una salutació inicial retro
    if (!privatsPerUsuari[usuariId] || !privatsPerUsuari[usuariId].length) {
      const d = new Date();
      const hora = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      privatsPerUsuari[usuariId] = [
        {
          de: usuariId,
          nom: target.nom,
          avatar: target.avatar,
          text: `Hola! Sóc en/la ${target.nom}. Estic per aquí estudiant ${target.temaActual || 'per a les oposicions'}. En què et puc ajudar? (Y)`,
          hora
        }
      ];
      desarPrivatsLocals();
    }

    renderitzarFinestraMSN();
  }
  window.obrirMessengerAmb = obrirMessengerAmb;

  function renderitzarFinestraMSN() {
    let contenidor = document.getElementById('contenidor-msn-messenger');
    if (!contenidor) {
      contenidor = document.createElement('div');
      contenidor.id = 'contenidor-msn-messenger';
      document.body.appendChild(contenidor);
    }

    if (!msnObertAmbId) {
      contenidor.style.display = 'none';
      contenidor.innerHTML = '';
      return;
    }

    contenidor.style.display = 'block';

    const target = usuarisActius.find(u => u.id === msnObertAmbId);
    if (!target) return;

    const perfil = carregarPerfilUsuari();
    const missatges = privatsPerUsuari[msnObertAmbId] || [];

    // Si està minimitzat, mostrem només la pestanyeta flotant retro
    if (msnMinimitzat) {
      contenidor.innerHTML = `
        <div id="msn-dock-minimitat" style="position: fixed; bottom: 16px; right: 24px; z-index: 99999; background: linear-gradient(180deg, #2b74c7 0%, #17529b 100%); color: #ffffff; padding: 10px 18px; border-radius: 12px 12px 0 0; box-shadow: 0 -4px 20px rgba(0,0,0,0.3); border: 2px solid #5aa7ff; border-bottom: none; cursor: pointer; display: flex; align-items: center; gap: 10px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
          <span style="font-size: 18px;">${target.avatar}</span>
          <div>
            <div style="font-weight: 800; font-size: 13px;">${escapeHtml(target.nom)}</div>
            <div style="font-size: 10px; opacity: 0.85;">💬 Clica per restaurar la conversa</div>
          </div>
          <button id="btn-tancar-msn-dock" style="background: transparent; border: none; color: #fff; font-size: 16px; font-weight: bold; cursor: pointer; padding: 0 4px; margin-left: 8px;">✕</button>
        </div>
      `;

      const dock = document.getElementById('msn-dock-minimitat');
      if (dock) {
        dock.addEventListener('click', (e) => {
          if (e.target.id === 'btn-tancar-msn-dock') {
            tancarMessenger();
          } else {
            msnMinimitzat = false;
            renderitzarFinestraMSN();
          }
        });
      }
      return;
    }

    // FINESTRA COMPLETA ESTIL MSN MESSENGER CLÀSSIC
    contenidor.innerHTML = `
      <div id="msn-window-wrapper" style="position: fixed; bottom: 20px; right: 24px; width: 440px; max-width: calc(100vw - 32px); height: 580px; max-height: calc(100vh - 40px); z-index: 99999; background: #eef3fa; border-radius: 10px 10px 6px 6px; box-shadow: 0 15px 45px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.15); display: flex; flex-direction: column; overflow: hidden; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; border: 2px solid #5596e6;">
        
        <!-- BARRA DE TÍTOL MSN VINTAGE -->
        <div style="background: linear-gradient(180deg, #3d88e6 0%, #1e5cb8 45%, #154c9d 100%); color: #ffffff; padding: 7px 12px; display: flex; align-items: center; justify-content: space-between; user-select: none; border-bottom: 1px solid #0f3b7d;">
          
          <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
            <span style="font-size: 16px;">👥</span>
            <span style="font-size: 12.5px; font-weight: 800; text-shadow: 1px 1px 2px rgba(0,0,0,0.5); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              Medina Messenger — Conversa amb ${escapeHtml(target.nom)}
            </span>
          </div>

          <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
            <button id="btn-msn-minimitzar" title="Minimitzar conversa" style="width: 24px; height: 20px; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.4); border-radius: 3px; color: #fff; font-size: 13px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; line-height: 1;">─</button>
            <button id="btn-msn-tancar" title="Tancar conversa" style="width: 24px; height: 20px; background: #d93838; border: 1px solid #b32626; border-radius: 3px; color: #fff; font-size: 12px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; line-height: 1;">✕</button>
          </div>

        </div>

        <!-- CAPÇALERA DEL CONTACTE MSN -->
        <div style="background: linear-gradient(180deg, #f8fbff 0%, #dbe8f7 100%); border-bottom: 1.5px solid #b8d2ee; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; gap: 10px;">
          
          <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
            <div style="position: relative; flex-shrink: 0;">
              <div style="width: 44px; height: 44px; border-radius: 6px; background: #ffffff; border: 2px solid #9bbce6; display: flex; align-items: center; justify-content: center; font-size: 24px; box-shadow: inset 0 0 5px rgba(0,0,0,0.1);">
                ${target.avatar}
              </div>
              <span style="position: absolute; bottom: -2px; right: -2px; width: 12px; height: 12px; border-radius: 50%; background: #10b981; border: 2px solid #ffffff;"></span>
            </div>

            <div style="min-width: 0;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="font-weight: 800; font-size: 14px; color: #0b2545; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                  ${escapeHtml(target.nom)}
                </span>
                <span style="font-size: 10.5px; font-weight: 700; color: #1e5cb8; background: #e3effd; padding: 1px 6px; border-radius: 4px; border: 1px solid #c2dbf8;">
                  &lt;En línia&gt;
                </span>
              </div>
              <div style="font-size: 11.5px; color: #475569; font-style: italic; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 1px;" title="${escapeHtml(target.fraseEstat)}">
                ${escapeHtml(target.fraseEstat)}
              </div>
            </div>
          </div>

          <!-- Avatar propi petit a la dreta -->
          <div style="text-align: right; flex-shrink: 0;">
            <div style="width: 34px; height: 34px; border-radius: 6px; background: #ffffff; border: 1.5px solid #9bbce6; display: flex; align-items: center; justify-content: center; font-size: 18px; margin-left: auto;">
              ${perfil.avatar}
            </div>
            <div style="font-size: 10px; color: #64748b; font-weight: 700; margin-top: 2px;">Tu</div>
          </div>

        </div>

        <!-- BARRA D'ACCIONS RETRO: ZUMBIT, EMOTICONES I DUBTES -->
        <div style="background: #e4eef9; border-bottom: 1px solid #c7daf0; padding: 5px 12px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          
          <button type="button" id="btn-msn-zumbit" style="background: linear-gradient(180deg, #fff 0%, #e8f2fc 100%); border: 1px solid #89b3e6; border-radius: 4px; padding: 3px 8px; font-size: 11.5px; font-weight: 800; color: #114285; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.08);">
            <span>📳</span> <span>ZUMBIT!</span>
          </button>

          <button type="button" id="btn-msn-emoticones" style="background: linear-gradient(180deg, #fff 0%, #e8f2fc 100%); border: 1px solid #89b3e6; border-radius: 4px; padding: 3px 8px; font-size: 11.5px; font-weight: 800; color: #114285; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
            <span>😊</span> <span>Emoticones</span>
          </button>

          <button type="button" id="btn-msn-compartir-dubte" style="background: linear-gradient(180deg, #fff 0%, #e8f2fc 100%); border: 1px solid #89b3e6; border-radius: 4px; padding: 3px 8px; font-size: 11.5px; font-weight: 800; color: #114285; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
            <span>⚖️</span> <span>Consultar Llei</span>
          </button>

          <button type="button" id="btn-msn-netejar" style="background: transparent; border: none; color: #64748b; font-size: 11px; margin-left: auto; cursor: pointer; text-decoration: underline;">
            Netejar
          </button>

        </div>

        <!-- ÀREA DE CONVERSA ESTIL MSN (Lletra Verdana clàssica i format "Nom diu:") -->
        <div id="msn-missatges-historial" style="flex: 1; padding: 14px 16px; overflow-y: auto; background: #ffffff; font-size: 13px; line-height: 1.45; display: flex; flex-direction: column; gap: 10px;">
          <!-- Missatges renderitzats -->
        </div>

        <!-- INDICADOR "ESTÀ ESCRIVINT..." -->
        <div id="msn-typing-indicator" style="height: 22px; padding: 2px 14px; background: #f0f4f9; border-top: 1px solid #e1eaf3; font-size: 11px; color: #475569; display: ${msnEstaEscrivint ? 'flex' : 'none'}; align-items: center; gap: 6px;">
          <span style="display: inline-block; animation: msnPulse 1.2s infinite;">✍️</span>
          <span>${escapeHtml(target.nom)} està escrivint un missatge...</span>
        </div>

        <!-- CAIXA D'ENTRADA DE TEXT INFERIOR -->
        <form id="form-msn-enviar" style="background: #eef4fc; border-top: 1.5px solid #b8d2ee; padding: 10px 14px; display: flex; flex-direction: column; gap: 8px;">
          
          <textarea id="msn-input-text" rows="2" placeholder="Escriu un missatge per a ${escapeHtml(target.nom)}..." style="width: 100%; box-sizing: border-box; resize: none; border: 1.5px solid #9cbfe8; border-radius: 4px; padding: 8px 10px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 13px; outline: none; background: #ffffff;"></textarea>

          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="font-size: 11px; color: #64748b;">
              Prem <b>Enter</b> per enviar
            </div>

            <button type="submit" style="background: linear-gradient(180deg, #3d88e6 0%, #1b53a4 100%); color: #ffffff; border: 1px solid #134080; border-radius: 4px; padding: 6px 18px; font-weight: 800; font-size: 12.5px; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.15);">
              Enviar
            </button>
          </div>

        </form>

      </div>
    `;

    pintarHistorialMSN();
    activarEsdevenimentsMSN(target);
  }

  function pintarHistorialMSN() {
    const contenedor = document.getElementById('msn-missatges-historial');
    if (!contenedor || !msnObertAmbId) return;

    const target = usuarisActius.find(u => u.id === msnObertAmbId);
    const perfil = carregarPerfilUsuari();
    const llista = privatsPerUsuari[msnObertAmbId] || [];

    contenedor.innerHTML = llista.map(msg => {
      if (msg.esZumbit) {
        return `
          <div style="background: #fee2e2; border: 1.5px solid #f87171; border-radius: 6px; padding: 6px 12px; margin: 4px 0; color: #991b1b; font-weight: 800; font-size: 12px; text-align: center; box-shadow: 0 1px 4px rgba(239,68,68,0.15);">
            📳 ${escapeHtml(msg.text)} 📳
          </div>
        `;
      }

      const esMeu = msg.de === 'me' || msg.nom === perfil.nom;
      const colorNom = esMeu ? '#002B5E' : '#c2410c';

      return `
        <div style="margin-bottom: 2px;">
          <div style="font-size: 11.5px; font-weight: 800; color: ${colorNom}; margin-bottom: 2px;">
            ${escapeHtml(msg.nom || (esMeu ? perfil.nom : target.nom))} diu (${msg.hora || ''}):
          </div>
          <div style="padding-left: 6px; color: #1e293b; font-size: 13.5px; word-break: break-word;">
            ${parsejarEmoticonesMSN(msg.text)}
          </div>
        </div>
      `;
    }).join('');

    contenedor.scrollTop = contenedor.scrollHeight;
  }

  function activarEsdevenimentsMSN(target) {
    // Tancar
    const btnTancar = document.getElementById('btn-msn-tancar');
    if (btnTancar) btnTancar.addEventListener('click', tancarMessenger);

    // Minimitzar
    const btnMinimitzar = document.getElementById('btn-msn-minimitzar');
    if (btnMinimitzar) {
      btnMinimitzar.addEventListener('click', () => {
        msnMinimitzat = true;
        renderitzarFinestraMSN();
      });
    }

    // Formulari d'enviament
    const form = document.getElementById('form-msn-enviar');
    const input = document.getElementById('msn-input-text');
    if (form && input) {
      input.focus();

      // Enviar amb Enter (sense Shift)
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          form.dispatchEvent(new Event('submit'));
        }
      });

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) return;
        input.value = '';

        enviarMissatgeMSN(text, false);
      });
    }

    // Botó ZUMBIT!
    const btnZumbit = document.getElementById('btn-msn-zumbit');
    if (btnZumbit) {
      btnZumbit.addEventListener('click', () => {
        ferZumbitMSN(true);
      });
    }

    // Botó Emoticones
    const btnEmoticones = document.getElementById('btn-msn-emoticones');
    if (btnEmoticones) {
      btnEmoticones.addEventListener('click', (e) => {
        e.stopPropagation();
        obrirMenuEmojis(btnEmoticones, (emoji) => {
          if (input) {
            input.value += emoji;
            input.focus();
          }
        });
      });
    }

    // Botó Compartir Dubte
    const btnCompartir = document.getElementById('btn-msn-compartir-dubte');
    if (btnCompartir) {
      btnCompartir.addEventListener('click', () => {
        const dubtes = [
          'Tens clar l\'art. 17 CE sobre el límit màxim de detenció preventiva de 72 hores?',
          'Com distingeixes l\'atemptat contra l\'autoritat de la resistència o desobediència greu (art. 550 i 556 CP)?',
          'En quin article de la Llei 10/1994 s\'estableixen les funcions de la policia de la Generalitat?',
          'Recorda que l\'art. 138 CP castiga l\'homicidi amb pena de 10 a 15 anys!',
          'Com portes el procediment d\'Habeas Corpus de la Llei Orgànica 6/1984?'
        ];
        const triat = dubtes[Math.floor(Math.random() * dubtes.length)];
        if (input) {
          input.value = triat;
          input.focus();
        }
      });
    }

    // Botó Netejar
    const btnNetejar = document.getElementById('btn-msn-netejar');
    if (btnNetejar) {
      btnNetejar.addEventListener('click', () => {
        if (msnObertAmbId && privatsPerUsuari[msnObertAmbId]) {
          privatsPerUsuari[msnObertAmbId] = [];
          desarPrivatsLocals();
          pintarHistorialMSN();
        }
      });
    }
  }

  function enviarMissatgeMSN(text, esZumbit = false) {
    if (!msnObertAmbId) return;

    const perfil = carregarPerfilUsuari();
    const d = new Date();
    const hora = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

    if (!privatsPerUsuari[msnObertAmbId]) privatsPerUsuari[msnObertAmbId] = [];

    const nouMsg = {
      de: 'me',
      nom: perfil.nom,
      avatar: perfil.avatar,
      text,
      esZumbit: !!esZumbit,
      hora
    };

    privatsPerUsuari[msnObertAmbId].push(nouMsg);
    desarPrivatsLocals();
    pintarHistorialMSN();

    // Enviar al servidor en segon pla
    try {
      fetch('/api/comunitat/privats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destId: msnObertAmbId,
          text,
          esZumbit: !!esZumbit,
          deNom: perfil.nom,
          deAvatar: perfil.avatar
        })
      }).catch(() => {});
    } catch (e) {}

    // Resposta de l'estudiant company
    simularRespostaCompany(text, esZumbit);
  }

  function ferZumbitMSN(iniciatPerMi = true) {
    const wrapper = document.getElementById('msn-window-wrapper');
    if (wrapper) {
      wrapper.classList.remove('msn-window-shaking');
      void wrapper.offsetWidth; // Forçar re-càlcul CSS
      wrapper.classList.add('msn-window-shaking');
      setTimeout(() => wrapper.classList.remove('msn-window-shaking'), 600);
    }

    reproduirSoZumbit();

    const target = usuarisActius.find(u => u.id === msnObertAmbId);
    const nomTarget = target ? target.nom : 'el company';

    const text = iniciatPerMi
      ? `Has enviat un ZUMBIT!`
      : `${nomTarget} t'ha enviat un ZUMBIT!`;

    if (iniciatPerMi) {
      enviarMissatgeMSN(text, true);
    } else {
      const d = new Date();
      const hora = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      privatsPerUsuari[msnObertAmbId].push({
        de: msnObertAmbId,
        nom: nomTarget,
        avatar: target.avatar,
        text,
        esZumbit: true,
        hora
      });
      desarPrivatsLocals();
      pintarHistorialMSN();
    }
  }

  function simularRespostaCompany(textEnviat, eraZumbit) {
    const target = usuarisActius.find(u => u.id === msnObertAmbId);
    if (!target) return;

    // Mostrar indicador d'escriure
    const indicator = document.getElementById('msn-typing-indicator');
    if (indicator) indicator.style.display = 'flex';
    msnEstaEscrivint = true;

    const tempsEspera = eraZumbit ? 2000 : 1500 + Math.random() * 1800;

    setTimeout(() => {
      if (indicator) indicator.style.display = 'none';
      msnEstaEscrivint = false;

      if (!privatsPerUsuari[msnObertAmbId]) return;

      const d = new Date();
      const hora = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

      if (eraZumbit) {
        // El company pot tornar el zumbit o respondre amb sorpresa
        if (Math.random() > 0.4) {
          ferZumbitMSN(false);
          return;
        } else {
          privatsPerUsuari[msnObertAmbId].push({
            de: target.id,
            nom: target.nom,
            avatar: target.avatar,
            text: 'M\'has fet saltar de la cadira amb el zumbit! Jajaja :D Estava molt concentrat!',
            esZumbit: false,
            hora
          });
        }
      } else {
        const pool = target.respostesMock || [
          'Entès! Ho miro i et dic alguna cosa.',
          'Molt bona pregunta, ho repassaré a fons!',
          'Completament d\'acord company/a!'
        ];
        const resposta = pool[Math.floor(Math.random() * pool.length)];

        privatsPerUsuari[msnObertAmbId].push({
          de: target.id,
          nom: target.nom,
          avatar: target.avatar,
          text: resposta,
          esZumbit: false,
          hora
        });
      }

      desarPrivatsLocals();
      pintarHistorialMSN();
    }, tempsEspera);
  }

  function tancarMessenger() {
    msnObertAmbId = null;
    msnMinimitzat = false;
    const contenidor = document.getElementById('contenidor-msn-messenger');
    if (contenidor) {
      contenidor.style.display = 'none';
      contenidor.innerHTML = '';
    }
  }

  // ==========================================================================
  // MODAL PER PERSONALITZAR EL TEU ESTAT (ESTIL MSN)
  // ==========================================================================
  function obrirModalEditarPerfilMSN() {
    const perfil = carregarPerfilUsuari();

    const overlay = document.createElement('div');
    overlay.id = 'modal-perfil-msn-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 100000;
      display: flex; align-items: center; justify-content: center; padding: 20px;
      backdrop-filter: blur(4px); animation: fadeIn 0.2s ease;
    `;

    overlay.innerHTML = `
      <div style="background: #ffffff; border-radius: 16px; border: 1.5px solid #cbd5e1; max-width: 480px; width: 100%; box-shadow: 0 20px 40px rgba(0,0,0,0.25); overflow: hidden; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        
        <div style="background: linear-gradient(135deg, #0b2545, #007aff); color: #ffffff; padding: 18px 22px; display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 24px;">👤</span>
            <div>
              <h3 style="margin: 0; font-size: 17px; font-weight: 800;">El teu estat a Medina Messenger</h3>
              <p style="margin: 3px 0 0; font-size: 12px; opacity: 0.85;">Així és com et veuran els altres opositors en actiu</p>
            </div>
          </div>
          <button type="button" id="btn-tancar-modal-perfil" style="background: transparent; border: none; color: #fff; font-size: 18px; cursor: pointer;">✕</button>
        </div>

        <form id="form-guardar-perfil-msn" style="padding: 22px; display: flex; flex-direction: column; gap: 16px;">
          
          <div>
            <label style="display: block; font-size: 13px; font-weight: 800; color: #1e293b; margin-bottom: 6px;">Nom o Nick de l'Opositor/a:</label>
            <input type="text" id="input-perfil-nom" value="${escapeHtml(perfil.nom)}" required style="width: 100%; box-sizing: border-box; padding: 9px 12px; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 14px;">
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
              <label style="display: block; font-size: 13px; font-weight: 800; color: #1e293b; margin-bottom: 6px;">Avatar:</label>
              <select id="input-perfil-avatar" style="width: 100%; padding: 9px 12px; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 14px; background: #fff;">
                <option value="👮‍♂️" ${perfil.avatar === '👮‍♂️' ? 'selected' : ''}>👮‍♂️ Policia (Noi)</option>
                <option value="👮‍♀️" ${perfil.avatar === '👮‍♀️' ? 'selected' : ''}>👮‍♀️ Policia (Noia)</option>
                <option value="👩‍✈️" ${perfil.avatar === '👩‍✈️' ? 'selected' : ''}>👩‍✈️ Agent Urbana</option>
                <option value="👨‍✈️" ${perfil.avatar === '👨‍✈️' ? 'selected' : ''}>👨‍✈️ Agent Mossos</option>
                <option value="🧑‍💻" ${perfil.avatar === '🧑‍💻' ? 'selected' : ''}>🧑‍💻 Opositor Tech</option>
                <option value="📚" ${perfil.avatar === '📚' ? 'selected' : ''}>📚 Llibres i Lleis</option>
                <option value="🦁" ${perfil.avatar === '🦁' ? 'selected' : ''}>🦁 Lleó</option>
                <option value="⚡" ${perfil.avatar === '⚡' ? 'selected' : ''}>⚡ Energia</option>
              </select>
            </div>

            <div>
              <label style="display: block; font-size: 13px; font-weight: 800; color: #1e293b; margin-bottom: 6px;">Cos Policial:</label>
              <select id="input-perfil-cos" style="width: 100%; padding: 9px 12px; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 14px; background: #fff;">
                <option value="Mossos d'Esquadra" ${perfil.cos && perfil.cos.includes('Mossos') ? 'selected' : ''}>Mossos d'Esquadra</option>
                <option value="Policia Local" ${perfil.cos && perfil.cos.includes('Policia Local') ? 'selected' : ''}>Policia Local</option>
                <option value="Guàrdia Urbana" ${perfil.cos && perfil.cos.includes('Urbana') ? 'selected' : ''}>Guàrdia Urbana</option>
              </select>
            </div>
          </div>

          <div>
            <label style="display: block; font-size: 13px; font-weight: 800; color: #1e293b; margin-bottom: 6px;">Estat de connexió:</label>
            <div style="display: flex; gap: 10px;">
              <label style="flex: 1; border: 1.5px solid #cbd5e1; padding: 8px; border-radius: 8px; display: flex; align-items: center; gap: 6px; font-size: 12.5px; cursor: pointer;">
                <input type="radio" name="perfil-estat" value="online" ${perfil.estat === 'online' ? 'checked' : ''}>
                <span>🟢 En línia</span>
              </label>
              <label style="flex: 1; border: 1.5px solid #cbd5e1; padding: 8px; border-radius: 8px; display: flex; align-items: center; gap: 6px; font-size: 12.5px; cursor: pointer;">
                <input type="radio" name="perfil-estat" value="ocupat" ${perfil.estat === 'ocupat' ? 'checked' : ''}>
                <span>🟡 Ocupat</span>
              </label>
            </div>
          </div>

          <div>
            <label style="display: block; font-size: 13px; font-weight: 800; color: #1e293b; margin-bottom: 6px;">
              Frase d'estat personal (estil MSN clàssic):
            </label>
            <input type="text" id="input-perfil-frase" value="${escapeHtml(perfil.fraseEstat)}" placeholder="Ex: ♫ Estudiant el Codi Penal a tope (8) ♫" style="width: 100%; box-sizing: border-box; padding: 9px 12px; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 13.5px;">
            <span style="font-size: 11px; color: #64748b; margin-top: 4px; display: block;">Pots utilitzar (8) per a notes musicals, (Y) per polze amunt o emoticones!</span>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px;">
            <button type="button" id="btn-cancelar-perfil" style="background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; padding: 10px 18px; border-radius: 8px; font-weight: 700; font-size: 13.5px; cursor: pointer;">Cancel·lar</button>
            <button type="submit" style="background: linear-gradient(135deg, #002B5E, #007aff); color: #fff; border: none; padding: 10px 22px; border-radius: 8px; font-weight: 800; font-size: 13.5px; cursor: pointer;">Guardar Canvis</button>
          </div>

        </form>

      </div>
    `;

    document.body.appendChild(overlay);

    const tancar = () => overlay.remove();
    overlay.querySelector('#btn-tancar-modal-perfil').onclick = tancar;
    overlay.querySelector('#btn-cancelar-perfil').onclick = tancar;

    overlay.querySelector('#form-guardar-perfil-msn').onsubmit = (e) => {
      e.preventDefault();
      const nouNom = document.getElementById('input-perfil-nom').value.trim();
      const nouAvatar = document.getElementById('input-perfil-avatar').value;
      const nouCos = document.getElementById('input-perfil-cos').value;
      const nouFrase = document.getElementById('input-perfil-frase').value.trim();
      const estatEl = overlay.querySelector('input[name="perfil-estat"]:checked');
      const nouEstat = estatEl ? estatEl.value : 'online';

      desarPerfilUsuari({
        nom: nouNom || 'Tu (Opositor/a)',
        avatar: nouAvatar || '👮‍♂️',
        cos: nouCos || 'Mossos',
        estat: nouEstat,
        fraseEstat: nouFrase || 'Estudiant a fons per a les oposicions!'
      });

      tancar();
      mostrarComunitat();
    };
  }

  // ==========================================================================
  // PALETA D'EMOTICONES FLOTANT (ESTIL MSN RETRO)
  // ==========================================================================
  function obrirMenuEmojis(anchorEl, onSelect) {
    const existent = document.getElementById('menu-emojis-flotant');
    if (existent) {
      existent.remove();
      return;
    }

    const emojis = [
      '😊', '😃', '😛', '😉', '😮', '🙁', '😖', '😳', '😎', '😇',
      '❤️', '💔', '👍', '👎', '🎵', '😘', '🎁', '🍺', '🍸', '😈',
      '👮‍♂️', '👮‍♀️', '🚔', '⚖️', '📖', '⏱️', '🔥', '💪', '🎯', '💯'
    ];

    const rect = anchorEl.getBoundingClientRect();

    const menu = document.createElement('div');
    menu.id = 'menu-emojis-flotant';
    menu.style.cssText = `
      position: fixed;
      bottom: ${window.innerHeight - rect.top + 8}px;
      left: ${Math.max(10, rect.left - 80)}px;
      background: #ffffff;
      border: 1.5px solid #94a3b8;
      border-radius: 12px;
      padding: 12px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.2);
      z-index: 100002;
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 8px;
      width: 240px;
    `;

    emojis.forEach(em => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = em;
      b.style.cssText = `
        background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;
        padding: 6px; font-size: 20px; cursor: pointer; display: flex;
        align-items: center; justify-content: center; transition: transform 0.1s;
      `;
      b.onmouseover = () => b.style.transform = 'scale(1.2)';
      b.onmouseout = () => b.style.transform = 'scale(1)';
      b.onclick = (e) => {
        e.stopPropagation();
        onSelect(em);
        menu.remove();
      };
      menu.appendChild(b);
    });

    document.body.appendChild(menu);

    const clickFora = (e) => {
      if (!menu.contains(e.target) && e.target !== anchorEl) {
        menu.remove();
        document.removeEventListener('click', clickFora);
      }
    };
    setTimeout(() => document.addEventListener('click', clickFora), 50);
  }

  // ==========================================================================
  // INJECCIÓ D'ESTILS CSS (ANIMACIONS MSN SHAKE, DOTS, ETC.)
  // ==========================================================================
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    @keyframes msnShake {
      0% { transform: translate(0, 0) rotate(0deg); }
      15% { transform: translate(-10px, 8px) rotate(-2deg); }
      30% { transform: translate(9px, -8px) rotate(2deg); }
      45% { transform: translate(-8px, -6px) rotate(-1.5deg); }
      60% { transform: translate(8px, 6px) rotate(1.5deg); }
      75% { transform: translate(-5px, 4px) rotate(-1deg); }
      90% { transform: translate(4px, -3px) rotate(0.5deg); }
      100% { transform: translate(0, 0) rotate(0deg); }
    }
    .msn-window-shaking {
      animation: msnShake 0.55s ease-in-out !important;
    }
    @keyframes pulseDot {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(1.3); }
    }
    @keyframes msnPulse {
      0%, 100% { opacity: 0.4; }
      50% { opacity: 1; }
    }
    @media (max-width: 860px) {
      .comunitat-grid-responsive {
        grid-template-columns: 1fr !important;
      }
    }
  `;
  document.head.appendChild(styleEl);

  // Exportar al window
  window.mostrarComunitat = mostrarComunitat;

})();

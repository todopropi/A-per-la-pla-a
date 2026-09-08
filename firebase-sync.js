// firebase-sync.js — Sincronització entre dispositius (Agent Medina)
// ---------------------------------------------------------------
// Idea general: localStorage segueix sent la font de veritat local (i el
// cau offline, tal com ja fa sw.js). Aquest fitxer afegeix per sobre:
//   1) Login amb Google (Firebase Authentication)
//   2) Un únic document a Firestore per usuari, amb TOT el contingut de
//      localStorage (mateix format que ja fa servir exportarProgresJSON /
//      importarProgresJSON a app.js), perquè viatgi entre dispositius.
//
// No cal tocar cap funció existent de l'app: interceptem
// Storage.prototype.setItem per detectar canvis automàticament i pujar-los
// al núvol amb un petit "debounce".

(function () {
  const firebaseConfig = {
    apiKey: "AIzaSyDgByBYlfUHP6vIPMrZE_jBLUdZeapAxfY",
    authDomain: "a-per-la-plaa.firebaseapp.com",
    projectId: "a-per-la-plaa",
    storageBucket: "a-per-la-plaa.firebasestorage.app",
    messagingSenderId: "1001718261139",
    appId: "1:1001718261139:web:05eb0c5cb28735aa20b466",
    measurementId: "G-KG2MWDECNC"
  };

  if (typeof firebase === 'undefined') {
    console.warn('[firebase-sync] SDK de Firebase no carregat: la sincronització queda desactivada, però l\'app segueix funcionant amb localStorage.');
    return;
  }

  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();

  // Perquè funcioni bé offline (sw.js ja fa de cau per als fitxers de l'app;
  // això és el cau intern de Firestore per a les seves pròpies dades).
  db.enablePersistence({ synchronizeTabs: true }).catch(() => { /* no crític si falla */ });

  let usuariActual = null;
  let sincronitzant = false;
  let hiHaCanvisPendents = false;
  let timeoutSincronitzacio = null;
  let carregaInicialFeta = false;

  // ---------- Helpers de localStorage (mateix format que exportarProgresJSON) ----------
  function llegirTotLocalStorage() {
    const dades = {};
    for (let i = 0; i < localStorage.length; i++) {
      const clau = localStorage.key(i);
      dades[clau] = localStorage.getItem(clau);
    }
    return dades;
  }

  function escriureTotLocalStorage(dades) {
    Object.keys(dades || {}).forEach((clau) => {
      try {
        const valor = dades[clau];
        setItemOriginal.call(localStorage, clau, typeof valor === 'string' ? valor : JSON.stringify(valor));
      } catch (e) { /* clau individual corrupta: la ignorem i seguim amb la resta */ }
    });
  }

  // ---------- UI d'estat del botó i xip de perfil ----------
  function actualitzarBotoLogin() {
    const btn = document.getElementById('btn-firebase-login');
    const chipName = document.getElementById('user-name-display');
    const chipAvatar = document.getElementById('user-avatar-text');
    const chipDot = document.getElementById('user-sync-dot');

    const modalAvatar = document.getElementById('modal-user-avatar');
    const modalName = document.getElementById('modal-user-name');
    const modalEmail = document.getElementById('modal-user-email');
    const modalSyncBadge = document.getElementById('modal-sync-badge');
    const btnLoginModal = document.getElementById('btn-login-google-text');

    if (usuariActual) {
      const nomComplet = usuariActual.displayName || usuariActual.email || 'Usuari';
      const nomPila = nomComplet.split(' ')[0];
      const inicial = (nomComplet[0] || 'U').toUpperCase();

      if (btn) {
        btn.textContent = `☁️ ${nomPila}`;
        btn.title = `Sessió iniciada com ${usuariActual.email}.`;
        btn.classList.add('sincronitzat');
      }

      if (chipName) chipName.textContent = nomPila;
      if (chipAvatar) chipAvatar.textContent = inicial;
      if (chipDot) {
        chipDot.className = 'sync-status-indicator';
        chipDot.title = 'Sincronitzat al núvol amb Google';
      }

      if (modalAvatar) {
        if (usuariActual.photoURL) {
          modalAvatar.innerHTML = `<img src="${usuariActual.photoURL}" alt="Avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
        } else {
          modalAvatar.textContent = inicial;
        }
      }
      if (modalName) modalName.textContent = nomComplet;
      if (modalEmail) modalEmail.textContent = usuariActual.email || '';
      if (modalSyncBadge) {
        modalSyncBadge.innerHTML = '🟢 Sincronitzat al núvol (Google)';
        modalSyncBadge.style.background = '#dcfce7';
        modalSyncBadge.style.color = '#166534';
      }
      if (btnLoginModal) btnLoginModal.textContent = 'Tancar sessió';
    } else {
      if (btn) {
        btn.textContent = '🔑 Sincronitzar';
        btn.title = 'Inicia sessió amb Google per sincronitzar el progrés';
        btn.classList.remove('sincronitzat');
      }

      if (chipName) chipName.textContent = 'Iniciar sessió';
      if (chipAvatar) chipAvatar.textContent = '👤';
      if (chipDot) {
        chipDot.className = 'sync-status-indicator offline';
        chipDot.title = 'Mode local (clica per iniciar sessió)';
      }

      if (modalAvatar) modalAvatar.textContent = '👤';
      if (modalName) modalName.textContent = 'Mode Local (Sense compte)';
      if (modalEmail) modalEmail.textContent = 'El progrés es guarda al navegador';
      if (modalSyncBadge) {
        modalSyncBadge.innerHTML = '🟡 Guardat al navegador (Local)';
        modalSyncBadge.style.background = '#fef3c7';
        modalSyncBadge.style.color = '#92400e';
      }
      if (btnLoginModal) btnLoginModal.textContent = 'Iniciar sessió amb Google';
    }
  }

  async function alternarSessioFirebase() {
    if (usuariActual) {
      if (confirm('Vols tancar la sessió de sincronització en aquest dispositiu?\n\nEl teu progrés es quedarà guardat localment igualment.')) {
        await auth.signOut();
        actualitzarBotoLogin();
        if (window.mostrarToast) window.mostrarToast('Sessió tancada correctament', 'info');
      }
      return;
    }
    try {
      const proveidor = new firebase.auth.GoogleAuthProvider();
      await auth.signInWithPopup(proveidor);
      actualitzarBotoLogin();
      if (window.mostrarToast) window.mostrarToast('✅ Sessió iniciada i sincronitzada amb èxit!', 'success');
    } catch (e) {
      alert('❌ No s\'ha pogut iniciar sessió: ' + (e && e.message ? e.message : e));
    }
  }
  window.alternarSessioFirebase = alternarSessioFirebase;
  window.actualitzarBotoLogin = actualitzarBotoLogin;
  window.obtenirUsuariFirebase = () => usuariActual;

  // ---------- Pujar / baixar dades ----------
  async function pujarDadesANucol() {
    if (!usuariActual || sincronitzant) return;
    sincronitzant = true;
    try {
      const dades = llegirTotLocalStorage();
      await db.collection('usuaris').doc(usuariActual.uid).set(
        { dades, actualitzatEl: firebase.firestore.FieldValue.serverTimestamp() },
        { merge: false }
      );
      hiHaCanvisPendents = false;
    } catch (e) {
      console.warn('[firebase-sync] No s\'ha pogut pujar el progrés al núvol:', e && e.message ? e.message : e);
    } finally {
      sincronitzant = false;
    }
  }

  async function baixarDadesDelNucol() {
    if (!usuariActual) return;
    try {
      const snap = await db.collection('usuaris').doc(usuariActual.uid).get();

      if (!snap.exists) {
        // Primer cop que aquest usuari sincronitza: pugem el que ja hi ha en local.
        await pujarDadesANucol();
        return;
      }

      const remot = snap.data();
      if (!remot || !remot.dades) return;

      const numClaus = Object.keys(remot.dades).length;
      const missatge =
        `S'ha trobat progrés guardat al núvol (${numClaus} claus).\n\n` +
        `Vols carregar-lo en aquest dispositiu?\n` +
        `Es sobreescriuran les dades locals que coincideixin (progrés, ratxa, convocatòries, preguntes pròpies...).`;

      if (!confirm(missatge)) return;

      escriureTotLocalStorage(remot.dades);
      alert('✅ Progrés carregat des del núvol. Es recarregarà la pàgina per aplicar els canvis.');
      window.location.reload();
    } catch (e) {
      console.warn('[firebase-sync] No s\'han pogut baixar les dades del núvol:', e && e.message ? e.message : e);
    }
  }

  // Es crida automàticament cada cop que canvia alguna cosa a localStorage
  // (amb un petit retard per no escriure a Firestore en cada clic).
  function programarSincronitzacio() {
    if (!usuariActual) return;
    hiHaCanvisPendents = true;
    clearTimeout(timeoutSincronitzacio);
    timeoutSincronitzacio = setTimeout(pujarDadesANucol, 4000);
  }

  // Pugem també quan l'usuari canvia de pestanya o tanca l'app, per no
  // perdre l'últim canvi si encara no havia passat el "debounce".
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && hiHaCanvisPendents) pujarDadesANucol();
  });
  window.addEventListener('beforeunload', () => {
    if (hiHaCanvisPendents) pujarDadesANucol();
  });

  // Interceptem localStorage.setItem per detectar canvis sense haver de
  // tocar cap funció existent de l'app (convocatòries, progrés, ratxa,
  // preguntes pròpies, etc. ja fan servir totes localStorage.setItem).
  const setItemOriginal = Storage.prototype.setItem;
  Storage.prototype.setItem = function (clau, valor) {
    setItemOriginal.apply(this, arguments);
    if (usuariActual && carregaInicialFeta) programarSincronitzacio();
  };

  // ---------- Estat d'autenticació ----------
  auth.onAuthStateChanged((user) => {
    usuariActual = user;
    actualitzarBotoLogin();
    carregaInicialFeta = false;
    if (user) {
      baixarDadesDelNucol().finally(() => { carregaInicialFeta = true; });
    } else {
      carregaInicialFeta = true;
    }
  });
})();

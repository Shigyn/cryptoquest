'use strict';
// Lot C — comptes et sauvegarde en ligne (Supabase). Inactif tant que js/cloud-config.js n'est pas rempli.
// Connexion par lien magique e-mail. Sauvegarde toutes les 30 s et à la fermeture ; au chargement,
// la sauvegarde la plus récente l'emporte (locale ou en ligne), et l'autre reste récupérable.
CQ.cloud = { on: !!(window.CQ_CLOUD && window.CQ_CLOUD.url), sb: null, user: null, status: 'local', lastSync: 0, remote: null };

CQ.cloudInit = async () => {
  const C = CQ.cloud;
  if (!C.on) return;
  await new Promise((ok, ko) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js';
    s.onload = ok; s.onerror = ko; document.head.appendChild(s);
  }).catch(() => { C.status = 'erreur'; });
  if (!window.supabase) return;
  C.sb = window.supabase.createClient(window.CQ_CLOUD.url, window.CQ_CLOUD.anonKey);
  const { data } = await C.sb.auth.getSession();
  C.user = data.session ? data.session.user : null;
  C.sb.auth.onAuthStateChange((ev, session) => { C.user = session ? session.user : null; if (C.user) CQ.cloudPull(); CQ.refresh(); });
  if (C.user) await CQ.cloudPull();
  C.status = C.user ? 'connecté' : 'déconnecté';
  setInterval(() => CQ.cloudPush(), 30000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) CQ.cloudPush(); });
};

CQ.cloudLogin = async (email) => {
  const C = CQ.cloud;
  if (!C.sb) return false;
  const { error } = await C.sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
  if (error) { CQ.toast(`Connexion impossible : ${CQ.esc(error.message)}`, 'red'); return false; }
  CQ.toast('📧 Lien de connexion envoyé. Ouvrez-le depuis cet appareil.', 'green');
  return true;
};
CQ.cloudLogout = async () => { const C = CQ.cloud; if (C.sb) { await CQ.cloudPush(); await C.sb.auth.signOut(); C.user = null; CQ.refresh(); } };

CQ.cloudPush = async () => {
  const C = CQ.cloud;
  if (!C.sb || !C.user) return;
  CQ.save();
  const { error } = await C.sb.from('saves').upsert({ player_id: C.user.id, data: CQ.state, version: CQ.SAVE_VERSION, device: navigator.userAgent.slice(0, 120), updated_at: new Date().toISOString() });
  C.status = error ? 'erreur' : 'synchronisé';
  if (!error) C.lastSync = Date.now();
};
CQ.cloudPull = async () => {
  const C = CQ.cloud;
  if (!C.sb || !C.user) return;
  const { data, error } = await C.sb.from('saves').select('data, updated_at, version').eq('player_id', C.user.id).maybeSingle();
  if (error) { C.status = 'erreur'; return; }
  if (!data || localStorage.getItem('cq_force_local')) { localStorage.removeItem('cq_force_local'); await CQ.cloudPush(); return; } // première connexion, ou partie locale reprise volontairement
  const remoteAt = new Date(data.updated_at).getTime(), localAt = CQ.state.lastSeen || 0, r = data.data, l = CQ.state;
  C.remote = { at: remoteAt, level: r.level };
  // même partie (même progression) : la plus récente l'emporte sans rien demander
  const same = r.level === l.level && (r.stats && r.stats.kills) === l.stats.kills;
  if (same) { if (remoteAt > localAt + 5000) CQ.cloudUseRemote(r); else await CQ.cloudPush(); return; }
  // deux parties différentes : on ne remplace jamais rien sans demander
  CQ.cloudConflict(r, remoteAt);
};
CQ.cloudUseRemote = (r) => {
  localStorage.setItem('cryptoquest_local_avant_sync', JSON.stringify(CQ.state)); // la partie locale reste récupérable
  localStorage.setItem(CQ.SAVE_KEY, JSON.stringify(r));
  CQ.save = () => {};
  location.reload();
};
CQ.cloudConflict = (r, remoteAt) => {
  const l = CQ.state, best = r.level > l.level ? 'remote' : 'local';
  const card = (who, d, at) => `<div class="card ${best === who ? 'gold' : ''}"><b>${who === 'local' ? '💻 Partie de cet appareil' : '☁️ Partie en ligne'}</b>
    <div class="kv mt"><span>Niveau</span><span><b>${d.level}</b></span><span>CQ</span><span>${CQ.fmt(d.cq)}</span><span>FP</span><span>${CQ.fmt(d.fp)}</span><span>Monstres vaincus</span><span>${CQ.fmt((d.stats && d.stats.kills) || 0)}</span><span>Dernière partie</span><span>${CQ.fmtDate(at)}</span></div>
    <button class="btn ${best === who ? 'primary' : ''} block mt" data-act="${who === 'local' ? 'cloudKeepLocal' : 'cloudKeepRemote'}">Garder celle-ci</button></div>`;
  CQ.ui.cloudRemote = r;
  CQ.openModal(`<h2>Deux parties différentes</h2><div class="muted">Votre compte contient déjà une partie, différente de celle de cet appareil. Laquelle garder ? L’autre reste récupérable depuis le Profil.</div>
    <div class="grid g2 mt">${card('local', l, l.lastSeen)}${card('remote', r, remoteAt)}</div>`, { wide: true, locked: true });
};
CQ.A.cloudKeepLocal = async () => {
  localStorage.setItem('cryptoquest_local_avant_sync', JSON.stringify(CQ.ui.cloudRemote)); // la partie en ligne écartée reste récupérable
  CQ.closeModal(); await CQ.cloudPush(); CQ.toast('☁️ Partie de cet appareil enregistrée en ligne.', 'green'); CQ.refresh();
};
CQ.A.cloudKeepRemote = () => CQ.cloudUseRemote(CQ.ui.cloudRemote);
// récupérer la partie locale écartée lors d'une synchronisation
CQ.cloudRestoreLocal = () => {
  const raw = localStorage.getItem('cryptoquest_local_avant_sync');
  if (!raw) return;
  localStorage.setItem(CQ.SAVE_KEY, raw);
  localStorage.removeItem('cryptoquest_local_avant_sync');
  localStorage.setItem('cq_force_local', '1');
  CQ.save = () => {};
  location.reload();
};

// carte « Compte en ligne » sur le Profil
(() => {
  const r = P.profile.render;
  P.profile.render = () => {
    const C = CQ.cloud, kept = localStorage.getItem('cryptoquest_local_avant_sync');
    const card = !C.on
      ? `<div class="card mt"><h3>☁️ Compte en ligne</h3><div class="small muted">Pas encore branché : la partie reste dans ce navigateur. Le serveur est prêt (dossier <code>server/</code>) ; il suffit de créer le projet Supabase et de remplir <code>js/cloud-config.js</code>.</div></div>`
      : C.user
        ? `<div class="card mt"><h3>☁️ Compte en ligne<span class="right chip green">${C.status}</span></h3><div class="kv"><span>Connecté</span><span>${CQ.esc(C.user.email || '')}</span><span>Dernière synchronisation</span><span>${C.lastSync ? CQ.fmtDate(C.lastSync) : '—'}</span></div>
          <div class="row wrap mt"><button class="btn" data-act="cloudPush">Synchroniser maintenant</button><button class="btn ghost" data-act="cloudLogout">Se déconnecter</button>
          ${kept ? '<button class="btn ghost" data-act="cloudRestore">Reprendre la partie locale écartée</button>' : ''}</div></div>`
        : `<div class="card mt"><h3>☁️ Compte en ligne</h3><div class="small muted mb">Connectez-vous pour retrouver votre partie sur tous vos appareils. Pas de mot de passe : un lien arrive par e-mail.</div>
          <div class="row"><input class="input" id="cloudMail" type="email" placeholder="vous@exemple.fr" autocomplete="email"><button class="btn gold" data-act="cloudLogin">Recevoir le lien</button></div></div>`;
    return r() + card;
  };
})();
A.cloudLogin = () => { const v = (CQ.$('#cloudMail') || {}).value || ''; if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) CQ.cloudLogin(v); else CQ.toast('Adresse e-mail invalide.', 'red'); };
A.cloudLogout = () => CQ.cloudLogout();
A.cloudPush = async () => { await CQ.cloudPush(); CQ.toast(CQ.cloud.status === 'synchronisé' ? '☁️ Partie synchronisée.' : 'Échec de la synchronisation.', CQ.cloud.status === 'synchronisé' ? 'green' : 'red'); CQ.refresh(); };
A.cloudRestore = () => CQ.confirm('Reprendre la partie locale ?', 'La partie de ce navigateur, écartée lors de la connexion, remplacera la partie actuelle (qui sera envoyée en ligne ensuite).', 'Reprendre', CQ.cloudRestoreLocal, true);

/* PayFollow : données communes à toutes les pages (prototype 03).
   Les données sont lues dans le navigateur (cache pf_data) et synchronisées avec Supabase en arrière-plan. */
(function () {
  var KEY = "pf_data", ANCHOR = "2026-11-04";
  var MS = ["Janv.", "Févr.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."];
  var ML = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
  var db = null;

  function iso(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function today() { return iso(new Date()); }
  function dt(s) { return new Date(s + "T12:00:00"); }
  function addDays(s, n) { var d = dt(s); d.setDate(d.getDate() + n); return iso(d); }
  function daysBetween(a, b) { return Math.round((dt(b) - dt(a)) / 864e5); }
  function norm(t) { return String(t).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim(); }
  function uid() { return "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function sum(v) { return v.reduce(function (t, x) { return t + x.a; }, 0); }

  /* ---------- Données d'exemple (dates décalées pour être toujours d'actualité) ---------- */
  function seed() {
    var shift = daysBetween(ANCHOR, today()), D = function (s) { return addDays(s, shift); };
    var names = ["Agence Nafa", "Atelier Sahel", "Boutique Lumière", "Café Zaka", "Kandé Conseil", "Maison Bissa", "Studio Kora", "Studio Okapi"];
    var P = [];
    function add(c, l, a, e, v) {
      e = D(e);
      P.push({ id: uid(), c: c, l: l, a: a, e: e, k: addDays(e, -30), x: 1, v: (v || []).map(function (y) { return { a: y[0], d: D(y[1]) }; }) });
    }
    function paid(c, l, a, e) { add(c, l, a, e, [[a, e]]); }
    /* historique : payés */
    paid("Maison Bissa", "Brochure", 2600, "2025-12-12"); paid("Studio Okapi", "Affiches", 2000, "2025-12-19");
    paid("Kandé Conseil", "Conseil mensuel", 2100, "2026-01-15"); paid("Café Zaka", "Menu", 2000, "2026-01-27");
    paid("Agence Nafa", "Maintenance", 2300, "2026-02-10"); paid("Atelier Sahel", "Logo", 2500, "2026-02-24");
    paid("Boutique Lumière", "Catalogue", 3100, "2026-03-09"); paid("Studio Kora", "Retouches", 2200, "2026-03-26");
    paid("Maison Bissa", "Newsletter", 2400, "2026-04-14"); paid("Studio Okapi", "Packaging", 2500, "2026-04-28");
    paid("Kandé Conseil", "Formation", 2700, "2026-05-11"); paid("Agence Nafa", "Site vitrine", 2500, "2026-05-22");
    paid("Studio Kora", "Identité visuelle", 3400, "2026-06-08"); paid("Café Zaka", "Affiches", 2700, "2026-06-25");
    paid("Atelier Sahel", "Catalogue", 2900, "2026-07-13"); paid("Maison Bissa", "Photos", 2900, "2026-07-29");
    paid("Atelier Sahel", "Affiches", 1200, "2026-08-08"); paid("Agence Nafa", "Campagne été", 5000, "2026-08-20");
    paid("Maison Bissa", "Site e-commerce", 2000, "2026-09-01"); paid("Kandé Conseil", "Coaching", 600, "2026-09-18");
    paid("Studio Okapi", "Logo", 2000, "2026-09-28"); paid("Boutique Lumière", "Catalogue", 1800, "2026-09-28");
    paid("Kandé Conseil", "Audit", 2700, "2026-10-03"); paid("Maison Bissa", "Campagne réseaux", 2200, "2026-10-17");
    paid("Studio Okapi", "Photos produits", 800, "2026-10-20"); paid("Studio Kora", "Charte graphique", 800, "2026-10-25");
    paid("Agence Nafa", "Site vitrine", 2400, "2026-10-28");
    /* en retard */
    add("Studio Kora", "Refonte du site", 1800, "2026-10-19", [[600, "2026-09-30"]]);
    add("Boutique Lumière", "Photos boutique", 650, "2026-10-18");
    add("Agence Nafa", "Maintenance", 900, "2026-10-14");
    add("Atelier Sahel", "Flyers", 450, "2026-10-12");
    /* en attente */
    add("Kandé Conseil", "Formation", 1350, "2026-11-20");
    add("Maison Bissa", "Newsletter", 2400, "2026-11-15", [[400, "2026-09-15"]]);
    add("Studio Kora", "Vidéo promo", 1800, "2026-11-12", [[1000, "2026-11-03"]]);
    add("Café Zaka", "Menu et affiches", 1500, "2026-11-08");
    add("Agence Nafa", "Application mobile", 2600, "2026-11-05", [[1400, "2026-11-02"]]);
    var rel = {};
    P.forEach(function (p) { if (p.c === "Atelier Sahel" && p.l === "Flyers") rel[p.id] = [D("2026-10-26")]; });
    return { v: 1, demo: true, clients: names.map(function (n) { return { n: n, e: "", t: "", x: 1 }; }), payments: P, rel: rel };
  }

  /* ---------- Identifiants ---------- */
  function uuid() {
    try { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 3 | 8)).toString(16);
    });
  }
  var LIMIT = 5;

  /* ---------- Stockage local (cache) : l'affichage lit ici, la base est mise à jour en arrière-plan ---------- */
  function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} }
  function find(n) { var q = norm(n); return db.clients.filter(function (c) { return norm(c.n) === q; })[0]; }
  function demoOff() { try { return localStorage.getItem("pf_demooff") === "1"; } catch (e) { return false; } }
  function empty() { return { v: 1, demo: false, clients: [], payments: [], rel: {} }; }
  function load() {
    if (db) return db;
    try { var r = localStorage.getItem(KEY); if (r) db = JSON.parse(r); } catch (e) {}
    if (!db || !db.payments || !db.clients) db = demoOff() ? empty() : seed();
    if (!db.rel) db.rel = {};
    save();
    return db;
  }

  /* ---------- Offre et limite de clients (la base fait foi : cette vérification évite juste un aller-retour) ---------- */
  function plan() { try { return JSON.parse(localStorage.getItem("pf_plan") || "null") || {}; } catch (e) { return {}; } }
  function limited() { var p = plan(); return p.plan === "gratuit" && !(p.fin && p.fin >= today()); }
  function realCount() { return db.clients.filter(function (c) { return !c.x; }).length; }
  function canAdd() { return !limited() || realCount() < LIMIT; }
  function showLimit() {
    if (document.getElementById("pf-lim")) return;
    var o = document.createElement("div"); o.id = "pf-lim";
    o.setAttribute("role", "dialog"); o.setAttribute("aria-modal", "true"); o.setAttribute("aria-labelledby", "pf-lim-t");
    o.setAttribute("style", "position:fixed;inset:0;z-index:99999;display:grid;place-items:center;padding:20px;background:rgba(16,25,58,.45)");
    o.innerHTML = '<div style="background:#fff;color:#10193a;border-radius:20px;padding:22px;max-width:380px;width:100%;box-shadow:0 20px 60px rgba(16,25,58,.3)">' +
      '<h2 id="pf-lim-t" style="margin:0 0 8px;font-size:19px">Limite de ' + LIMIT + ' clients atteinte</h2>' +
      '<p style="margin:0 0 18px;color:#5b6478;line-height:1.5;font-size:15px">Avec l’offre Gratuit, vous pouvez suivre jusqu’à ' + LIMIT + ' clients. Passez au Pack Pro pour en ajouter autant que vous voulez.</p>' +
      '<a id="pf-lim-a" href="payfollow-tarifs.html" style="display:grid;place-items:center;height:48px;border-radius:99px;background:#1f7a3d;color:#fff;font-weight:700;text-decoration:none;font-size:15px">Voir les offres</a>' +
      '<button type="button" id="pf-lim-x" style="display:block;width:100%;margin-top:6px;padding:14px;border:0;background:none;color:#5b6478;font:inherit;font-weight:600;font-size:15px">Fermer</button></div>';
    function shut() { if (o.parentNode) o.parentNode.removeChild(o); document.removeEventListener("keydown", esc); }
    function esc(e) { if (e.key === "Escape") shut(); }
    o.addEventListener("click", function (e) { if (e.target === o) shut(); });
    document.body.appendChild(o);
    o.querySelector("#pf-lim-x").addEventListener("click", shut);
    document.addEventListener("keydown", esc);
    o.querySelector("#pf-lim-a").focus();
  }

  /* ---------- File d'envoi vers la base : conservée dans le navigateur, rejouée si le réseau coupe ---------- */
  var QK = "pf_q";
  function qGet() { try { var a = JSON.parse(localStorage.getItem(QK) || "[]"); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function qSet(a) { try { localStorage.setItem(QK, JSON.stringify(a)); } catch (e) {} }
  function enqueue(op) { var a = qGet(); a.push(op); qSet(a); flushSoon(); }
  function money(x) { return Math.round(Number(x) * 100) / 100; }
  function syncClient(c) {
    if (c.x || !c.id) return;
    enqueue({ k: "cl", d: { id: c.id, nom: c.n, email: c.e || "", telephone: c.t || "", cree_le: c.k || today() } });
  }
  function syncPayment(p) {
    if (p.x) return;
    var c = find(p.c); if (!c || !c.id) return;
    enqueue({ k: "pa", d: { id: p.id, client_id: c.id, libelle: p.l || "Paiement", montant: money(p.a), echeance: p.e, cree_le: p.k || today() } });
  }
  /* Un client d'exemple qu'on utilise devient un vrai client (donc compté dans la limite). */
  function makeReal(c) {
    if (!c.x) return true;
    if (!canAdd()) { showLimit(); return false; }
    delete c.x; c.id = uuid(); c.k = c.k || today(); syncClient(c); return true;
  }

  function addClient(n, e, t) {
    n = String(n || "").trim(); if (!n) return "";
    var c = find(n); if (c) return c.n;
    if (!canAdd()) { showLimit(); return ""; }
    c = { id: uuid(), n: n, e: e || "", t: t || "", k: today() };
    db.clients.push(c); syncClient(c);
    return n;
  }
  /* Modifier un client : nom, e-mail, téléphone. Un changement de nom suit dans tous ses paiements. */
  function updateClient(old, o) {
    load(); o = o || {};
    var c = find(old); if (!c) return { ok: false, err: "absent" };
    var n = String(o.n || "").trim(); if (!n) return { ok: false, err: "nom" };
    var other = find(n); if (other && other !== c) return { ok: false, err: "existe" };
    var wasDemo = !!c.x;
    if (wasDemo && !canAdd()) { showLimit(); return { ok: false, err: "limite" }; }
    var from = c.n;
    c.n = n; c.e = String(o.e || "").trim(); c.t = String(o.t || "").trim();
    if (wasDemo) { delete c.x; c.id = uuid(); c.k = c.k || today(); }
    db.payments.forEach(function (p) { if (norm(p.c) === norm(from)) p.c = n; });
    syncClient(c);
    save(); return { ok: true, n: n };
  }
  /* Supprimer un client : sa fiche et tous ses paiements (avec versements et relances). Retourne le nombre de paiements effacés. */
  function deleteClient(name) {
    load(); var c = find(name); if (!c) return -1;
    var q = norm(c.n), gone = db.payments.filter(function (p) { return norm(p.c) === q; });
    db.clients = db.clients.filter(function (x) { return x !== c; });
    db.payments = db.payments.filter(function (p) { return norm(p.c) !== q; });
    gone.forEach(function (p) { if (db.rel) delete db.rel[p.id]; });
    if (!c.x && c.id) enqueue({ k: "dc", id: c.id });   /* la base efface aussi ses paiements, versements et relances */
    save(); return gone.length;
  }

  /* ---------- Lecture ---------- */
  function view(p) {
    var g = sum(p.v), r = Math.max(0, p.a - g), done = r <= 0.005 && p.a > 0, last = p.e;
    if (p.v.length) last = p.v.reduce(function (m, x) { return x.d > m ? x.d : m; }, p.v[0].d);
    return {
      id: p.id, c: p.c, l: p.l, a: p.a, e: p.e, k: p.k || p.e,
      d: done ? last : p.e, lastV: p.v.length ? last : "",
      s: done ? "paid" : (p.e < today() ? "late" : "wait"),
      x: p.x ? 1 : 0,
      v: p.v.map(function (x) { return { a: x.a, d: x.d, r: x.r ? 1 : 0 }; })
    };
  }
  function payments() { return load().payments.map(view); }
  function clients() { return load().clients.map(function (c) { return { n: c.n, e: c.e || "", t: c.t || "", k: c.k || "" }; }); }
  function clientNames() { return load().clients.map(function (c) { return c.n; }); }

  /* ---------- Écriture ---------- */
  function byId(id) { return load().payments.filter(function (p) { return p.id === id; })[0]; }
  function addPayment(o) {
    load(); var cn = addClient(o.c); if (!cn) return null;
    var c = find(cn); if (!makeReal(c)) return null;
    var p = { id: uuid(), c: c.n, l: (o.l || "").trim() || "Paiement", a: +o.a, e: o.e, k: today(), v: [] };
    db.payments.push(p); syncPayment(p); save(); return p.id;
  }
  function updatePayment(id, o) {
    var p = byId(id); if (!p) return false;
    if (o.c != null && String(o.c).trim()) {
      var cn = addClient(o.c); if (!cn) return false;
      var c = find(cn);
      if (!p.x && !makeReal(c)) return false;
      p.c = cn;
    }
    if (o.l != null) p.l = String(o.l).trim() || "Paiement";
    if (o.a != null) p.a = +o.a;
    if (o.e != null) p.e = o.e;
    syncPayment(p); save(); return true;
  }
  function addVersement(id, a, d) {
    var p = byId(id); if (!p) return false;
    var v = { i: uuid(), a: +a, d: d, r: 1 }; p.v.push(v);
    if (!p.x) enqueue({ k: "ve", d: { id: v.i, paiement_id: p.id, montant: money(a), date_verse: d } });
    save(); return true;
  }
  function deletePayment(id) {
    load(); var p = byId(id);
    db.payments = db.payments.filter(function (x) { return x.id !== id; });
    if (db.rel) delete db.rel[id];
    if (p && !p.x) enqueue({ k: "dp", id: id });
    save();
  }

  /* ---------- Relances faites : dates par paiement ---------- */
  function rdate(e) { return typeof e === "string" ? e : e.d; }
  function relances(id) { load(); return ((db.rel || {})[id] || []).map(rdate); }
  function allRelances() {
    load(); var out = [];
    db.payments.forEach(function (p) {
      ((db.rel || {})[p.id] || []).map(rdate).forEach(function (d, i) { out.push({ id: p.id, c: p.c, l: p.l, d: d, n: Math.min(2, i) }); });
    });
    return out.sort(function (a, b) { return a.d < b.d ? 1 : -1; });
  }
  function addRelance(id, d) {
    load(); var p = byId(id); if (!p) return false;
    if (!db.rel) db.rel = {};
    var r = { i: uuid(), d: d || today() };
    (db.rel[id] = db.rel[id] || []).push(r);
    if (!p.x) enqueue({ k: "re", d: { id: r.i, paiement_id: id, date_relance: r.d } });
    save(); return true;
  }

  /* ---------- Chiffres par mois : reçu (versements) et attendu (échéances) ---------- */
  function monthly(n) {
    load(); var now = new Date(), out = [];
    for (var i = n - 1; i >= 0; i--) {
      var d = new Date(now.getFullYear(), now.getMonth() - i, 1), key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"), rec = 0, att = 0;
      db.payments.forEach(function (p) {
        if (p.e.slice(0, 7) === key) att += p.a;
        p.v.forEach(function (x) { if (x.d.slice(0, 7) === key) rec += x.a; });
      });
      out.push([MS[d.getMonth()], rec, att]);
    }
    return out;
  }
  function monthName() { return ML[new Date().getMonth()]; }

  /* ---------- Données d'exemple : bandeau et bouton « Vider les exemples » ---------- */
  function isDemo() { return !!load().demo; }
  function clearDemo() {
    load();
    db.payments = db.payments.filter(function (p) { return !p.x; });
    var used = {}; db.payments.forEach(function (p) { used[norm(p.c)] = 1; });
    db.clients = db.clients.filter(function (c) { return !c.x || used[norm(c.n)]; });
    var ids = {}; db.payments.forEach(function (p) { ids[p.id] = 1; });
    Object.keys(db.rel || {}).forEach(function (k) { if (!ids[k]) delete db.rel[k]; });
    db.demo = false; save();
    try { localStorage.setItem("pf_demooff", "1"); } catch (e) {}
  }
  /* ---------- Profil : prénom, nom, e-mail, téléphone, activité, entreprise, pays, photo ---------- */
  var PKEY = "pf_profile";
  function getProfile() {
    try { var o = JSON.parse(localStorage.getItem(PKEY) || "null"); return o && typeof o === "object" ? o : {}; } catch (e) { return {}; }
  }
  function initial() { var p = getProfile(), s = String(p.p || p.e || "").trim(); return s ? s.charAt(0).toUpperCase() : ""; }
  /* La pastille du menu (#avatar) montre la photo, ou à défaut l'initiale du prénom, sur toutes les pages. */
  function paintAvatar() {
    var a = document.getElementById("avatar"); if (!a) return;
    var p = getProfile();
    if (p.ph) {
      a.textContent = "";
      a.style.backgroundImage = 'url("' + p.ph + '")'; a.style.backgroundSize = "cover"; a.style.backgroundPosition = "center";
    } else {
      a.style.backgroundImage = "";
      var i = initial(); if (i) a.textContent = i;
    }
  }
  /* Le prénom suit sur toutes les pages : [data-pf-name], ou le titre « Bonjour … » du tableau de bord. */
  function paintName() {
    var p = getProfile(), n = String(p.p || "").trim(); if (!n) return;
    document.querySelectorAll("[data-pf-name]").forEach(function (e) { e.textContent = n; });
    var scope = document.querySelector("main") || document.body; if (!scope) return;
    var w = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, null), t, done = false;
    while (!done && (t = w.nextNode())) {
      var par = t.parentNode, tag = par && par.nodeName;
      var m = /^(\s*Bonjour\s+)(\S[^!,.\n]*?)(\s*[!,.]?\s*)$/.exec(t.nodeValue);
      if (m && (tag === "H1" || tag === "H2")) { t.nodeValue = m[1] + n + m[3]; done = true; }
      else if (/^\s*Bonjour\s*$/.test(t.nodeValue) && (tag === "H1" || tag === "H2") && t.nextSibling && t.nextSibling.nodeType === 1) { t.nextSibling.textContent = n; done = true; }
    }
  }
  /* ---------- Supabase : session, synchronisation du profil, déconnexion ---------- */
  var sbP = null;
  function getSb() {
    if (sbP) return sbP;
    if (window.pfSb) return (sbP = window.pfSb);
    sbP = new Promise(function (res) {
      var s = document.createElement("script"); s.src = "payfollow-supabase.js";
      s.onload = function () { res(window.pfSb || null); }; s.onerror = function () { res(null); };
      document.head.appendChild(s);
    });
    return sbP;
  }
  function clearLocal() {
    /* efface les données PayFollow ET la session Supabase (sb-…-auth-token) de cet appareil */
    try { Object.keys(localStorage).filter(function (k) { return k.indexOf("pf_") === 0 || /^sb-.*-auth-token/.test(k); }).forEach(function (k) { localStorage.removeItem(k); }); } catch (e) {}
    db = null;
  }
  /* Déconnexion de CET appareil : fermée localement sans attendre le réseau, puis tout est effacé (le compte et ses données restent dans la base). */
  function signOut() {
    var wait = function (ms) { return new Promise(function (res) { setTimeout(res, ms); }); };
    return Promise.race([flush(), wait(4000)]).then(function () { return getSb(); })
      .then(function (sb) { return sb ? Promise.race([sb.auth.signOut({ scope: "local" }), wait(3000)]) : null; })
      .catch(function () {}).then(clearLocal);
  }
  /* Supprime le compte de l'utilisateur connecté (fonction SQL supprimer_mon_compte) puis ferme la session ici.
     Chaque étape a un délai maximum : l'écran ne reste jamais bloqué. */
  function after(p, ms) {
    return Promise.race([Promise.resolve(p), new Promise(function (res) { setTimeout(function () { res({ timeout: true }); }, ms); })]);
  }
  function storedToken() {
    try {
      var k = Object.keys(localStorage).filter(function (x) { return /^sb-.*-auth-token$/.test(x); })[0]; if (!k) return "";
      var o = JSON.parse(localStorage.getItem(k) || "null");
      return (o && (o.access_token || (o.currentSession && o.currentSession.access_token))) || "";
    } catch (e) { return ""; }
  }
  /* Appel direct à la base (sans passer par le verrou de session de la bibliothèque) */
  function rpcDirect(sb, T) {
    var tok = storedToken(), url = sb.supabaseUrl, key = sb.supabaseKey;
    if (!tok || !url || !key) return Promise.resolve({ skip: true });
    var ctl = window.AbortController ? new AbortController() : null, t = setTimeout(function () { if (ctl) ctl.abort(); }, T);
    return fetch(url + "/rest/v1/rpc/supprimer_mon_compte", {
      method: "POST", signal: ctl ? ctl.signal : undefined, body: "{}",
      headers: { apikey: key, Authorization: "Bearer " + tok, "Content-Type": "application/json" }
    }).then(function (r) {
      clearTimeout(t);
      if (r.ok) return { ok: true };
      return r.text().then(function (txt) {
        var low = String(txt || "").toLowerCase();
        if (r.status === 404 || low.indexOf("pgrst202") > -1 || low.indexOf("could not find") > -1) return { err: "absent" };
        if (r.status === 401 || r.status === 403) return { skip: true };   /* jeton expiré : on réessaie par la bibliothèque */
        return { err: "reseau" };
      });
    }, function () { clearTimeout(t); return { err: "reseau" }; });
  }
  function rpcLib(sb, T) {
    return after(sb.rpc("supprimer_mon_compte"), T).then(function (res) {
      if (res && res.timeout) return { err: "reseau" };
      if (res && res.error) {
        var m = String(res.error.message || "").toLowerCase(), c = String(res.error.code || "");
        return { err: (c === "PGRST202" || m.indexOf("could not find") > -1 || m.indexOf("schema cache") > -1) ? "absent" : "reseau" };
      }
      return { ok: true };
    }, function () { return { err: "reseau" }; });
  }
  /* Quand la réponse n'arrive pas : on vérifie auprès du serveur si le compte existe encore. */
  function gone(sb) {
    return after(sb.auth.getUser(), 8000).then(function (r) {
      if (!r || r.timeout) return false;
      var e = r.error; if (!e) return false;
      var m = String(e.message || "").toLowerCase(), s = e.status;
      return s === 403 || s === 404 || m.indexOf("does not exist") > -1 || m.indexOf("user_not_found") > -1 || m.indexOf("not found") > -1;
    }, function () { return false; });
  }
  function deleteAccount() {
    var T = window.__pfDelT || 20000;
    return after(getSb(), 8000).then(function (sb) {
      if (!sb || sb.timeout) return { ok: false, err: "reseau" };
      if (!storedToken()) {
        return after(sb.auth.getSession(), 8000).then(function (r) {
          var s = r && r.data && r.data.session; return s ? null : { ok: false, err: "session" };
        }).then(function (stop) { return stop || go(sb); });
      }
      return go(sb);
    }).catch(function () { return { ok: false, err: "reseau" }; });
    function go(sb) {
      return rpcDirect(sb, T).then(function (r) { return r.skip ? rpcLib(sb, T) : r; }).then(function (r) {
        if (r.ok) return finish();
        if (r.err === "absent") return { ok: false, err: "absent" };
        return gone(sb).then(function (g) { return g ? finish() : { ok: false, err: "reseau" }; });
      });
    }
    function finish() {
      qSet([]);   /* plus rien à envoyer : le compte n'existe plus */
      return signOut().then(function () { return { ok: true }; });
    }
  }
  /* Pages privées : sans session, retour à la page de connexion. */
  function guard() {
    if (/payfollow-(accueil|tarifs|conditions|confidentialite|connexion)/.test(location.pathname)) return;
    getSb().then(function (sb) {
      if (!sb) return null;
      return sb.auth.getSession().then(function (r) {
        if (!(r && r.data && r.data.session)) { location.replace("payfollow-connexion-v2.html"); return; }
        flush(); pull().then(function (ch) { if (ch) reloadOnce(); });
      });
    }).catch(function () {});
  }
  /* ---------- Envoi vers la base (flush) ---------- */
  var flushing = null, fT, retryT, dropped = false;
  function flushSoon() { clearTimeout(fT); fT = setTimeout(flush, 60); }
  function run(sb, uid, op) {
    var d = op.d, T = { cl: "clients", pa: "paiements", ve: "versements", re: "relances" };
    if (op.k === "dc") return sb.from("clients").delete().eq("id", op.id);
    if (op.k === "dp") return sb.from("paiements").delete().eq("id", op.id);
    if (T[op.k]) return sb.from(T[op.k]).upsert(Object.assign({ user_id: uid }, d));
    return Promise.resolve({});
  }
  function step(sb, uid) {
    var q = qGet(); if (!q.length) return Promise.resolve();
    return Promise.resolve(run(sb, uid, q[0])).then(function (res) {
      var err = res && res.error;
      if (err) {
        var code = String(err.code || ""), m = String(err.message || "").toLowerCase();
        /* pas de code = réseau coupé ; jeton expiré : on garde l'envoi pour plus tard */
        if (!code || code === "PGRST301" || m.indexOf("jwt") > -1) return;
        /* refus définitif (limite, doublon, droit refusé…) : on abandonne cette ligne et on resynchronise */
        if (m.indexOf("limite_clients") > -1) showLimit();
        dropped = true;
      }
      var a = qGet(); a.shift(); qSet(a);
      return step(sb, uid);
    });
  }
  function flush() {
    if (flushing) return flushing;
    if (!qGet().length) return Promise.resolve();
    flushing = getSb().then(function (sb) {
      if (!sb) return;
      return sb.auth.getSession().then(function (r) {
        var s = r && r.data && r.data.session; if (!s) return;
        return step(sb, s.user.id);
      });
    }).catch(function () {}).then(function () {
      flushing = null;
      if (qGet().length) { clearTimeout(retryT); retryT = setTimeout(flush, 15000); }
      else if (dropped) { dropped = false; pull().then(function (ch) { if (ch) reloadOnce(); }); }
    });
    return flushing;
  }
  window.addEventListener("online", function () { flush(); });

  /* ---------- Lecture depuis la base (pull) ---------- */
  function canon(cl, pa, rel) {
    return JSON.stringify({
      c: cl.map(function (c) { return [c.id, c.n, c.e || "", c.t || "", c.k || ""]; }).sort(),
      p: pa.map(function (p) {
        return [p.id, p.c, p.l, Number(p.a), p.e, p.k || "", (p.v || []).map(function (v) { return [v.i || "", Number(v.a), v.d]; }).sort(),
          ((rel || {})[p.id] || []).map(function (r) { return [r.i || "", r.d]; }).sort()];
      }).sort()
    });
  }
  function byD(a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : 0; }
  function applyPull(R, opt) {
    load();
    var byC = {}, cl = (R[0].data || []).map(function (x) {
      var c = { id: x.id, n: x.nom, e: x.email || "", t: x.telephone || "", k: x.cree_le || "" }; byC[x.id] = c; return c;
    });
    var vs = {}, rs = {};
    (R[2].data || []).forEach(function (x) { (vs[x.paiement_id] = vs[x.paiement_id] || []).push({ i: x.id, a: Number(x.montant), d: x.date_verse, r: 1 }); });
    (R[3].data || []).forEach(function (x) { (rs[x.paiement_id] = rs[x.paiement_id] || []).push({ i: x.id, d: x.date_relance }); });
    var pa = [], rel = {};
    (R[1].data || []).forEach(function (x) {
      var c = byC[x.client_id]; if (!c) return;
      pa.push({ id: x.id, c: c.n, l: x.libelle || "Paiement", a: Number(x.montant), e: x.echeance, k: x.cree_le || x.echeance, v: (vs[x.id] || []).sort(byD) });
      if (rs[x.id]) rel[x.id] = rs[x.id].sort(byD);
    });
    var ab = R[4] && R[4].data;
    if (ab) { try { localStorage.setItem("pf_plan", JSON.stringify({ plan: ab.plan, fin: ab.essai_fin || "" })); } catch (e) {} }

    var realC = db.clients.filter(function (c) { return !c.x; }), realP = db.payments.filter(function (p) { return !p.x; });
    var realRel = {}; realP.forEach(function (p) { if (db.rel[p.id]) realRel[p.id] = db.rel[p.id].map(function (r) { return typeof r === "string" ? { i: "", d: r } : r; }); });
    var same = canon(realC, realP, realRel) === canon(cl, pa, rel);
    /* Appareil sans données propres mais compte déjà rempli : on retire les exemples et on charge les vraies données. */
    var firstReal = !!((cl.length || pa.length) && !realC.length && !realP.length);
    if (same && !firstReal) return false;

    var keepDemo = db.demo && !firstReal, dc = [], dp = [], names = {};
    cl.forEach(function (c) { names[norm(c.n)] = 1; });
    if (keepDemo) {
      dc = db.clients.filter(function (c) { return c.x && !names[norm(c.n)]; });
      dp = db.payments.filter(function (p) { return p.x && !names[norm(p.c)]; });
    }
    var nrel = {}; dp.forEach(function (p) { if (db.rel[p.id]) nrel[p.id] = db.rel[p.id]; });
    Object.keys(rel).forEach(function (k) { nrel[k] = rel[k]; });
    db.clients = dc.concat(cl); db.payments = dp.concat(pa); db.rel = nrel;
    if (firstReal || (!dc.length && !dp.length)) { db.demo = false; if (firstReal) { try { localStorage.setItem("pf_demooff", "1"); } catch (e) {} } }
    save();
    return !same;
  }
  function pull(opt) {
    opt = opt || {};
    return getSb().then(function (sb) {
      if (!sb) return false;
      return sb.auth.getSession().then(function (r) {
        var s = r && r.data && r.data.session; if (!s) return false;
        return flush().then(function () {
          if (qGet().length) return false;   /* des modifications attendent encore d'être envoyées : on ne remplace rien */
          return Promise.all([
            sb.from("clients").select("*").limit(5000), sb.from("paiements").select("*").limit(5000),
            sb.from("versements").select("*").limit(5000), sb.from("relances").select("*").limit(5000),
            sb.from("abonnements").select("plan,essai_fin").maybeSingle()
          ]).then(function (R) {
            for (var i = 0; i < 4; i++) if (R[i].error) throw R[i].error;
            return applyPull(R, opt);
          });
        });
      });
    }).catch(function () { return false; });
  }
  /* Recharge la page une seule fois quand la base a apporté du nouveau (évite les boucles). */
  function reloadOnce() {
    try { var t = +sessionStorage.getItem("pf_rl") || 0; if (Date.now() - t < 15000) return; sessionStorage.setItem("pf_rl", String(Date.now())); } catch (e) {}
    location.reload();
  }

  var syncT;
  /* Envoie le profil (et la devise) dans la base, peu après chaque modification. */
  function syncProfile() {
    clearTimeout(syncT);
    syncT = setTimeout(function () {
      getSb().then(function (sb) {
        if (!sb) return null;
        return sb.auth.getSession().then(function (r) {
          var s = r && r.data && r.data.session; if (!s) return null;
          var p = getProfile(), dev = "EUR"; try { dev = localStorage.getItem("pf_devise") || "EUR"; } catch (e) {}
          return sb.from("profiles").upsert({
            id: s.user.id, prenom: p.p || "", nom: p.n || "", email: p.e || "", telephone: p.t || "",
            activite: p.a || "", entreprise: p.o || "", pays: p.y || "", photo: p.ph || "", devise: dev === "XOF" ? "XOF" : "EUR"
          });
        });
      }).then(function (res) { if (res && res.error) console.warn("PayFollow : profil non enregistré dans la base.", res.error.message); }).catch(function () {});
    }, 400);
  }
  /* Tout lien vers la page de connexion depuis l'application (« Se déconnecter ») ferme d'abord la session. */
  document.addEventListener("click", function (ev) {
    var a = ev.target.closest && ev.target.closest('a[data-logout]'); if (!a) return;
    ev.preventDefault();
    var href = a.getAttribute("href");
    signOut().then(function () { location.href = href; });
  });

  function setProfile(o) {
    var cur = getProfile(); Object.keys(o || {}).forEach(function (k) { cur[k] = o[k]; });
    try { localStorage.setItem(PKEY, JSON.stringify(cur)); } catch (e) { return false; }
    paintAvatar(); paintName(); syncProfile(); return true;
  }

  function banner() {
    if (document.body && document.body.hasAttribute("data-nobanner")) return;
    if (!isDemo() || document.getElementById("pf-demo")) return;
    var host = document.querySelector("main") || document.body, b = document.createElement("div");
    b.id = "pf-demo";
    b.setAttribute("style", "display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:0 0 14px;padding:10px 14px;border-radius:14px;background:#e8f3ec;color:#176330;font-size:13.5px;font-weight:600;line-height:1.4");
    b.innerHTML = '<span>Vous voyez des données d’exemple.</span><button type="button" style="border:1.5px solid #1f7a3d;background:#fff;color:#1f7a3d;border-radius:99px;padding:6px 14px;font:inherit;font-size:13px;font-weight:700;cursor:pointer">Vider les exemples</button>';
    host.insertBefore(b, host.firstChild);
    b.querySelector("button").addEventListener("click", function () {
      if (!confirm("Supprimer les données d’exemple ? Vos propres ajouts sont conservés.")) return;
      clearDemo(); location.reload();
    });
  }
  var PUBLIC = /payfollow-(accueil|tarifs|conditions|confidentialite|connexion)|\/(index\.html)?$/;
  function boot() { if (PUBLIC.test(location.pathname)) return; banner(); paintAvatar(); paintName(); guard(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();

  window.PF = {
    today: today, addDays: addDays, daysBetween: daysBetween, iso: iso,
    payments: payments, clients: clients, clientNames: clientNames,
    addClient: function (n, e, t) { load(); var r = addClient(n, e, t); save(); return r; },
    updateClient: updateClient, deleteClient: deleteClient,
    relances: relances, allRelances: allRelances, addRelance: addRelance,
    addPayment: addPayment, updatePayment: updatePayment, addVersement: addVersement, deletePayment: deletePayment,
    monthly: monthly, monthName: monthName, isDemo: isDemo, clearDemo: clearDemo, norm: norm,
    profile: getProfile, setProfile: setProfile, initial: initial, syncProfile: syncProfile, signOut: signOut, deleteAccount: deleteAccount, pull: pull, flush: flush
  };
})();

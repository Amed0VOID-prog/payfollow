/* PayFollow : données communes à toutes les pages (prototype 03).
   Tout est gardé dans le navigateur (localStorage, clé pf_data). */
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

  /* ---------- Stockage ---------- */
  function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} }
  function find(n) { var q = norm(n); return db.clients.filter(function (c) { return norm(c.n) === q; })[0]; }
  function addClient(n, e, t) {
    n = String(n || "").trim(); if (!n) return "";
    var c = find(n); if (c) return c.n;
    db.clients.push({ n: n, e: e || "", t: t || "", k: today() });
    try { var a = JSON.parse(localStorage.getItem("pf_nc") || "[]"); a.push({ n: n, e: e || "", t: t || "" }); localStorage.setItem("pf_nc", JSON.stringify(a)); } catch (x) {}
    return n;
  }
  /* Modifier un client : nom, e-mail, téléphone. Un changement de nom suit dans tous ses paiements. */
  function updateClient(old, o) {
    load(); o = o || {};
    var c = find(old); if (!c) return { ok: false, err: "absent" };
    var n = String(o.n || "").trim(); if (!n) return { ok: false, err: "nom" };
    var other = find(n); if (other && other !== c) return { ok: false, err: "existe" };
    var from = c.n;
    c.n = n; c.e = String(o.e || "").trim(); c.t = String(o.t || "").trim(); delete c.x;
    db.payments.forEach(function (p) { if (norm(p.c) === norm(from)) p.c = n; });
    try {
      var a = JSON.parse(localStorage.getItem("pf_nc") || "[]").filter(function (x) { return !x || norm(x.n) !== norm(from); });
      localStorage.setItem("pf_nc", JSON.stringify(a));
    } catch (e) {}
    save(); return { ok: true, n: n };
  }
  /* Supprimer un client : sa fiche et tous ses paiements (avec versements et relances). Retourne le nombre de paiements effacés. */
  function deleteClient(name) {
    load(); var c = find(name); if (!c) return -1;
    var q = norm(c.n), gone = db.payments.filter(function (p) { return norm(p.c) === q; });
    db.clients = db.clients.filter(function (x) { return x !== c; });
    db.payments = db.payments.filter(function (p) { return norm(p.c) !== q; });
    gone.forEach(function (p) { if (db.rel) delete db.rel[p.id]; });
    try {
      var a = JSON.parse(localStorage.getItem("pf_nc") || "[]").filter(function (x) { return !x || norm(x.n) !== q; });
      localStorage.setItem("pf_nc", JSON.stringify(a));
    } catch (e) {}
    save(); return gone.length;
  }
  function load() {
    if (db) return db;
    try { var r = localStorage.getItem(KEY); if (r) db = JSON.parse(r); } catch (e) {}
    if (!db || !db.payments || !db.clients) db = seed();
    if (!db.rel) {
      db.rel = {};
      if (db.demo) db.payments.forEach(function (p) { if (p.x && p.c === "Atelier Sahel" && p.l === "Flyers") db.rel[p.id] = [addDays(p.e, 14)]; });
    }
    /* reprise des anciennes clés (pages pas encore mises à jour) */
    try {
      JSON.parse(localStorage.getItem("pf_nc") || "[]").forEach(function (c) { if (c && c.n && !find(c.n)) db.clients.push({ n: c.n, e: c.e || "", t: c.t || "" }); });
      var old = JSON.parse(localStorage.getItem("pf_np") || "[]");
      if (old.length) {
        old.forEach(function (p) { if (p && p.c) { addClient(p.c); db.payments.push({ id: uid(), c: p.c, l: p.l || "Paiement", a: +p.a || 0, e: p.d || today(), k: today(), v: [] }); } });
        localStorage.setItem("pf_np", "[]");
      }
    } catch (e) {}
    save();
    return db;
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
    load(); var c = addClient(o.c); if (!c) return null;
    var p = { id: uid(), c: c, l: (o.l || "").trim() || "Paiement", a: +o.a, e: o.e, k: today(), v: [] };
    db.payments.push(p); save(); return p.id;
  }
  function updatePayment(id, o) {
    var p = byId(id); if (!p) return false;
    if (o.c != null) p.c = addClient(o.c) || p.c;
    if (o.l != null) p.l = String(o.l).trim() || "Paiement";
    if (o.a != null) p.a = +o.a;
    if (o.e != null) p.e = o.e;
    save(); return true;
  }
  function addVersement(id, a, d) { var p = byId(id); if (!p) return false; p.v.push({ a: +a, d: d, r: 1 }); save(); return true; }
  function deletePayment(id) { load(); db.payments = db.payments.filter(function (p) { return p.id !== id; }); if (db.rel) delete db.rel[id]; save(); }

  /* ---------- Relances faites : dates par paiement ---------- */
  function relances(id) { load(); return ((db.rel || {})[id] || []).slice(); }
  function allRelances() {
    load(); var out = [];
    db.payments.forEach(function (p) {
      ((db.rel || {})[p.id] || []).forEach(function (d, i) { out.push({ id: p.id, c: p.c, l: p.l, d: d, n: Math.min(2, i) }); });
    });
    return out.sort(function (a, b) { return a.d < b.d ? 1 : -1; });
  }
  function addRelance(id, d) {
    load(); if (!byId(id)) return false;
    if (!db.rel) db.rel = {};
    (db.rel[id] = db.rel[id] || []).push(d || today()); save(); return true;
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
    try { var keep = JSON.parse(localStorage.getItem("pf_nc") || "[]").filter(function (c) { return db.clients.some(function (k) { return norm(k.n) === norm(c.n); }); }); localStorage.setItem("pf_nc", JSON.stringify(keep)); } catch (e) {}
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
    try { Object.keys(localStorage).filter(function (k) { return k.indexOf("pf_") === 0; }).forEach(function (k) { localStorage.removeItem(k); }); } catch (e) {}
    db = null;
  }
  function signOut() {
    return getSb().then(function (sb) { return sb ? sb.auth.signOut() : null; }).catch(function () {}).then(clearLocal);
  }
  /* Pages privées : sans session, retour à la page de connexion. */
  function guard() {
    if (/payfollow-(accueil|tarifs|conditions|confidentialite|connexion)/.test(location.pathname)) return;
    getSb().then(function (sb) {
      if (!sb) return null;
      return sb.auth.getSession().then(function (r) {
        if (!(r && r.data && r.data.session)) location.replace("payfollow-connexion-v2.html");
      });
    }).catch(function () {});
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
    if (/payfollow-connexion/.test(location.pathname)) return;
    var a = ev.target.closest && ev.target.closest('a[href*="payfollow-connexion"]'); if (!a) return;
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
  function boot() { banner(); paintAvatar(); paintName(); guard(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();

  window.PF = {
    today: today, addDays: addDays, daysBetween: daysBetween, iso: iso,
    payments: payments, clients: clients, clientNames: clientNames,
    addClient: function (n, e, t) { load(); var r = addClient(n, e, t); save(); return r; },
    updateClient: updateClient, deleteClient: deleteClient,
    relances: relances, allRelances: allRelances, addRelance: addRelance,
    addPayment: addPayment, updatePayment: updatePayment, addVersement: addVersement, deletePayment: deletePayment,
    monthly: monthly, monthName: monthName, isDemo: isDemo, clearDemo: clearDemo, norm: norm,
    profile: getProfile, setProfile: setProfile, initial: initial, syncProfile: syncProfile, signOut: signOut
  };
})();

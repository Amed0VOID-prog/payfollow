/* PayFollow : import de clients et de paiements depuis un fichier Excel (.xlsx, .xls) ou CSV.
   Une ligne du fichier = un paiement. Les clients sont créés d'après leur nom.
   Aperçu gratuit pour tous ; l'import réel est réservé au Pack Pro (et à l'essai Pro).
   Utilisation : PFImport.open()   (nécessite payfollow-data.js) */
(function () {
  var MAXROWS = 500, MAXBYTES = 5 * 1024 * 1024;
  var XLSX_URLS = [
    "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
    "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"
  ];

  /* ---------- Colonnes reconnues (noms sans accents, en minuscules) ---------- */
  var FIELDS = [
    { k: "c", label: "Client", req: true,
      syn: ["client", "nom du client", "nom client", "nom", "customer", "name", "societe", "entreprise", "raison sociale", "destinataire", "debiteur"] },
    { k: "a", label: "Montant", req: true,
      syn: ["montant", "somme", "total", "prix", "amount", "tarif", "valeur", "a payer", "reste a payer", "creance", "dette"] },
    { k: "d", label: "Échéance", req: true,
      syn: ["echeance", "date limite", "date d echeance", "date echeance", "date de paiement", "date paiement", "due date", "due", "limite", "delai", "date"] },
    { k: "l", label: "Description", req: false,
      syn: ["description", "libelle", "objet", "prestation", "service", "motif", "designation", "detail", "produit", "projet", "mission", "reference"] },
    { k: "e", label: "E-mail", req: false,
      syn: ["email", "e mail", "mail", "courriel", "adresse mail", "adresse email"] },
    { k: "t", label: "Téléphone", req: false,
      syn: ["telephone", "tel", "phone", "mobile", "whatsapp", "numero", "portable", "gsm"] }
  ];
  var MONTHS = { janv: 1, jan: 1, fevr: 2, fev: 2, mars: 3, mar: 3, avr: 4, mai: 5, juin: 6, juil: 7, aout: 8, sept: 9, sep: 9, oct: 10, nov: 11, dec: 12 };

  function norm(t) {
    return String(t == null ? "" : t).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
      .replace(/[^a-z0-9]+/g, " ").trim();
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function two(n) { return (n < 10 ? "0" : "") + n; }
  function cell(v) { return typeof v === "string" ? v.replace(/[\u00a0\u202f]/g, " ").trim() : v; }

  /* ---------- Lecture d'un fichier ---------- */
  function splitCSV(text, delim) {
    var rows = [], row = [], cur = "", q = false, i, ch;
    for (i = 0; i < text.length; i++) {
      ch = text.charAt(i);
      if (q) {
        if (ch === '"') { if (text.charAt(i + 1) === '"') { cur += '"'; i++; } else q = false; }
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === delim) { row.push(cur); cur = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text.charAt(i + 1) === "\n") i++;
        row.push(cur); cur = ""; rows.push(row); row = [];
      } else cur += ch;
    }
    if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
    return rows;
  }
  function detectDelim(text) {
    var lines = text.split(/\r\n|\r|\n/).filter(function (l) { return l.trim(); }).slice(0, 5), best = ";", bestN = -1;
    [";", ",", "\t"].forEach(function (d) {
      var n = 0; lines.forEach(function (l) { var q = false; for (var i = 0; i < l.length; i++) { if (l.charAt(i) === '"') q = !q; else if (!q && l.charAt(i) === d) n++; } });
      if (n > bestN) { bestN = n; best = d; }
    });
    return best;
  }
  function parseCSV(buf) {
    var text;
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(buf); }
    catch (e) { try { text = new TextDecoder("windows-1252").decode(buf); } catch (e2) { text = new TextDecoder().decode(buf); } }
    text = text.replace(/^\uFEFF/, "");
    return splitCSV(text, detectDelim(text));
  }
  function loadXLSX() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    var i = 0;
    return new Promise(function (resolve, reject) {
      (function next() {
        if (i >= XLSX_URLS.length) return reject(new Error("xlsx"));
        var s = document.createElement("script"); s.src = XLSX_URLS[i++];
        s.onload = function () { window.XLSX ? resolve(window.XLSX) : next(); };
        s.onerror = function () { if (s.parentNode) s.parentNode.removeChild(s); next(); };
        document.head.appendChild(s);
      })();
    });
  }
  function parseExcel(buf) {
    return loadXLSX().then(function (X) {
      var wb = X.read(buf, { type: "array" }), out = null, i, rows;
      for (i = 0; i < wb.SheetNames.length; i++) {
        rows = X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[i]], { header: 1, raw: true, defval: "" });
        if (nonEmpty(rows).length >= 2) { out = rows; break; }
        if (!out) out = rows;
      }
      return out || [];
    });
  }
  function nonEmpty(rows) {
    return rows.map(function (r) { return (r || []).map(cell); }).filter(function (r) { return r.some(function (v) { return v !== "" && v != null; }); });
  }
  function readFile(file) {
    return new Promise(function (resolve, reject) {
      var rd = new FileReader();
      rd.onerror = function () { reject(new Error("lecture")); };
      rd.onload = function () {
        var buf = rd.result, name = String(file.name || "").toLowerCase();
        var p = /\.(xlsx|xlsm|xls)$/.test(name) ? parseExcel(buf) : Promise.resolve(parseCSV(buf));
        p.then(function (rows) { resolve(nonEmpty(rows)); }, function (e) { reject(e); });
      };
      rd.readAsArrayBuffer(file);
    });
  }

  /* ---------- Colonnes ---------- */
  function matches(h, syn) { return h === syn || (syn.length >= 4 && h.indexOf(syn) > -1) || h.split(" ").indexOf(syn) > -1; }
  function autoMap(hdr) {
    var map = {}, used = {}, H = hdr.map(norm);
    [true, false].forEach(function (exact) {
      FIELDS.forEach(function (f) {
        if (map[f.k] != null) return;
        for (var i = 0; i < H.length; i++) {
          if (used[i] || !H[i]) continue;
          var ok = f.syn.some(function (s) { return exact ? H[i] === s : matches(H[i], s); });
          if (ok) { map[f.k] = i; used[i] = 1; return; }
        }
      });
    });
    return map;
  }
  function findHeader(rows) {
    var best = 0, bestN = -1, i, n;
    for (i = 0; i < Math.min(10, rows.length); i++) {
      n = Object.keys(autoMap(rows[i].map(function (v) { return typeof v === "string" ? v : ""; }))).length;
      if (n > bestN) { bestN = n; best = i; }
    }
    return bestN >= 2 ? best : 0;
  }

  /* ---------- Montants et dates ---------- */
  function parseAmount(v) {
    var s, n, a, b, sep, parts, last;
    if (typeof v === "number") return isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null;
    s = String(v == null ? "" : v).replace(/[\u00a0\u202f\s]/g, "");
    if (!s || /^-/.test(s) || /^\(.*\)$/.test(s)) return null;
    s = s.replace(/[^\d.,]/g, "");
    if (!/\d/.test(s)) return null;
    a = s.lastIndexOf(","); b = s.lastIndexOf(".");
    if (a > -1 && b > -1) {
      sep = a > b ? "," : ".";
      s = s.split(sep === "," ? "." : ",").join("").replace(sep, ".");
    } else if (a > -1 || b > -1) {
      sep = a > -1 ? "," : ".";
      parts = s.split(sep);
      if (parts.length > 2) s = parts.join("");
      else {
        last = parts[1];
        if (last.length === 3 && parts[0].length >= 1 && parts[0].length <= 3 && parts[0] !== "0") s = parts.join("");
        else s = parts[0] + "." + last;
      }
    }
    n = parseFloat(s);
    return isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
  }
  function mkDate(y, m, d) {
    var dt;
    if (y < 100) y += 2000;
    if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
    dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
    return y + "-" + two(m) + "-" + two(d);
  }
  function parseDate(v) {
    var s, m, dt, mon;
    if (typeof v === "number") {
      if (v < 20000 || v > 80000) return null;
      dt = new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 864e5);
      return mkDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
    }
    s = String(v == null ? "" : v).replace(/[\u00a0\u202f]/g, " ").trim();
    if (!s) return null;
    if (/^\d{5}$/.test(s)) return parseDate(+s);
    s = s.replace(/[T\s]+\d{1,2}:\d{2}(:\d{2})?.*$/, "");
    if ((m = /^(\d{4})[-/. ](\d{1,2})[-/. ](\d{1,2})$/.exec(s))) return mkDate(+m[1], +m[2], +m[3]);
    if ((m = /^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{2}|\d{4})$/.exec(s))) return mkDate(+m[3], +m[2], +m[1]);
    if ((m = /^(\d{1,2})(?:er)?\s+([a-zA-Zéèêûôîùç.]+)\s+(\d{2}|\d{4})$/.exec(s))) {
      mon = MONTHS[norm(m[2]).replace(/\s/g, "").slice(0, 4)] || MONTHS[norm(m[2]).replace(/\s/g, "").slice(0, 3)];
      return mon ? mkDate(+m[3], mon, +m[1]) : null;
    }
    return null;
  }

  /* ---------- Construction des lignes à importer ---------- */
  function build(S, info) {
    var map = S.map, items = [], seen = {}, have = {}, skipped = 0, rows = S.rows.slice(S.hdr + 1), truncated = false;
    info.keys.forEach(function (k) { have[k] = 1; });
    if (rows.length > MAXROWS) { rows = rows.slice(0, MAXROWS); truncated = true; }
    function get(r, k) { var i = map[k]; return i == null || i < 0 ? "" : r[i]; }
    rows.forEach(function (r, idx) {
      var c = String(get(r, "c") == null ? "" : get(r, "c")).trim(), rawA = get(r, "a"), rawD = get(r, "d"),
          a = parseAmount(rawA), d = parseDate(rawD), why = [], l, e, t, key;
      if (!r.some(function (v) { return v !== "" && v != null; })) return;
      if (!c) why.push("client manquant");
      if (a == null) why.push(rawA === "" || rawA == null ? "montant manquant" : "montant illisible (« " + String(rawA).slice(0, 20) + " »)");
      if (d == null) why.push(rawD === "" || rawD == null ? "échéance manquante" : "échéance illisible (« " + String(rawD).slice(0, 20) + " »)");
      l = String(get(r, "l") == null ? "" : get(r, "l")).trim().slice(0, 120) || "Paiement";
      e = String(get(r, "e") == null ? "" : get(r, "e")).trim();
      if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) e = "";
      t = get(r, "t"); t = typeof t === "number" ? String(Math.round(t)) : String(t == null ? "" : t).trim().slice(0, 30);
      var it = { line: S.hdr + 2 + idx, c: c.slice(0, 80), e: e, t: t, l: l, a: a, d: d, why: why, dup: false };
      if (!why.length) {
        key = norm(c) + "|" + norm(l) + "|" + a + "|" + d;
        if (have[key] || seen[key]) { it.dup = true; skipped++; }
        seen[key] = 1;
      }
      items.push(it);
    });
    var ok = items.filter(function (i) { return !i.why.length && !i.dup; });
    var names = {}, known = {}, newC = 0, all = 0;
    info.clients.forEach(function (n) { known[norm(n)] = 1; });
    ok.forEach(function (i) { var q = norm(i.c); if (!names[q]) { names[q] = 1; all++; if (!known[q]) newC++; } });
    return { items: items, ok: ok, dup: skipped, bad: items.filter(function (i) { return i.why.length; }), clients: all, newClients: newC, truncated: truncated };
  }

  /* ---------- Modèle à télécharger ---------- */
  function downloadTemplate() {
    var csv = "\uFEFFClient;E-mail;Téléphone;Description;Montant;Échéance\r\n" +
      "Studio Kora;contact@studiokora.com;+226 70 00 00 00;Logo et charte graphique;150000;15/12/2026\r\n" +
      "Café Zaka;;;Menu du mois;45000;20/12/2026\r\n";
    var blob = new Blob([csv], { type: "text/csv;charset=utf-8" }), a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "modele-import-payfollow.csv";
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); if (a.parentNode) a.parentNode.removeChild(a); }, 1500);
  }

  /* ---------- Interface ---------- */
  var CSS = ".pfi{position:fixed;inset:0;z-index:99998;display:grid;place-items:end center;background:rgba(16,25,58,.5);padding:0}" +
    "@media(min-width:600px){.pfi{place-items:center;padding:20px}}" +
    ".pfi-b{background:#fff;color:#10193a;width:100%;max-width:460px;max-height:92vh;overflow:auto;border-radius:22px 22px 0 0;padding:20px 20px 24px;box-shadow:0 20px 60px rgba(16,25,58,.3);font-family:inherit}" +
    "@media(min-width:600px){.pfi-b{border-radius:22px}}" +
    ".pfi h2{margin:0 0 6px;font-size:19px}.pfi p{margin:0 0 12px;color:#5d6a64;line-height:1.5;font-size:15px}" +
    ".pfi-btn{display:grid;place-items:center;width:100%;min-height:50px;border:0;border-radius:99px;background:#1f7a3d;color:#fff;font:inherit;font-weight:700;font-size:16px;text-decoration:none;cursor:pointer;margin-top:8px}" +
    ".pfi-btn[disabled]{opacity:.45;cursor:default}" +
    ".pfi-alt{display:block;width:100%;min-height:44px;margin-top:4px;padding:12px;border:0;background:none;color:#5d6a64;font:inherit;font-weight:600;font-size:15px;cursor:pointer;text-align:center;text-decoration:none}" +
    ".pfi-g{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0}" +
    ".pfi-s{background:#f3f6f4;border-radius:14px;padding:10px 12px}.pfi-s b{display:block;font-size:22px;line-height:1.15}.pfi-s span{font-size:13px;color:#5d6a64}" +
    ".pfi-s.ok b{color:#176330}.pfi-s.ko b{color:#c62828}" +
    ".pfi-note{background:#e8f3ec;border-radius:14px;padding:10px 12px;font-size:14px;color:#176330;margin:8px 0}" +
    ".pfi-err{margin:8px 0;padding:10px 12px;border-radius:14px;background:#fdeceb;color:#a32020;font-size:14px;line-height:1.45}" +
    ".pfi-err ul{margin:4px 0 0;padding-left:18px}" +
    ".pfi details{margin:8px 0;border:1.5px solid #e1e7e4;border-radius:14px;padding:4px 12px}.pfi summary{min-height:44px;display:flex;align-items:center;font-weight:700;font-size:14px;cursor:pointer}" +
    ".pfi label{display:block;font-size:13px;font-weight:700;margin:8px 0 4px}" +
    ".pfi select{width:100%;height:46px;border:1.5px solid #e1e7e4;border-radius:12px;padding:0 10px;font:inherit;font-size:15px;background:#fff;color:#10193a}" +
    ".pfi small{display:block;color:#5d6a64;font-size:13px;line-height:1.45;margin-top:6px}";

  var S = null, overlay = null, onKey = null;

  function info() {
    var i = (window.PF && PF.importInfo) ? PF.importInfo() : { demo: false, clients: [], keys: [], pro: false };
    return i;
  }
  function shut() {
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    overlay = null; S = null;
    if (onKey) { document.removeEventListener("keydown", onKey); onKey = null; }
  }
  function shell(html) {
    overlay.querySelector(".pfi-b").innerHTML = html;
    var f = overlay.querySelector("[data-focus]"); if (f) f.focus();
  }

  function stepChoose(msg) {
    var inf = info();
    shell('<h2 id="pfi-t">Importer vos clients et paiements</h2>' +
      '<p>Choisissez un fichier Excel (.xlsx) ou CSV. Une ligne du fichier correspond à un paiement.</p>' +
      (msg ? '<div class="pfi-err" role="alert">' + msg + "</div>" : "") +
      '<button type="button" class="pfi-btn" id="pfi-pick" data-focus>Choisir un fichier</button>' +
      '<button type="button" class="pfi-alt" id="pfi-tpl">Télécharger le modèle</button>' +
      "<small>Colonnes : Client, E-mail, Téléphone, Description, Montant, Échéance. 500 lignes maximum. Les colonnes avec d’autres noms sont reconnues automatiquement." +
      (inf.pro ? "" : " L’aperçu est gratuit ; l’import demande le Pack Pro.") + "</small>" +
      '<button type="button" class="pfi-alt" id="pfi-x">Annuler</button>' +
      '<input type="file" id="pfi-file" accept=".csv,.xlsx,.xls,.txt,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden>');
    var inp = overlay.querySelector("#pfi-file");
    overlay.querySelector("#pfi-pick").addEventListener("click", function () { inp.click(); });
    overlay.querySelector("#pfi-tpl").addEventListener("click", downloadTemplate);
    overlay.querySelector("#pfi-x").addEventListener("click", shut);
    inp.addEventListener("change", function () { var f = inp.files && inp.files[0]; inp.value = ""; if (f) onFile(f); });
  }

  function onFile(f) {
    if (f.size > MAXBYTES) return stepChoose("Ce fichier est trop lourd (5 Mo maximum).");
    shell('<h2 id="pfi-t">Lecture du fichier…</h2><p>Un instant.</p>');
    readFile(f).then(function (rows) {
      if (!overlay) return;
      if (rows.length < 2) return stepChoose("Le fichier ne contient pas de lignes à importer. Il faut une ligne de titres, puis au moins une ligne de données.");
      var hdr = findHeader(rows);
      S = { name: f.name, rows: rows, hdr: hdr, map: autoMap(rows[hdr].map(function (v) { return typeof v === "string" ? v : ""; })) };
      stepPreview();
    }, function (e) {
      if (!overlay) return;
      stepChoose(e && e.message === "xlsx"
        ? "Impossible de lire ce fichier Excel (connexion trop faible ou bloquée). Enregistrez-le au format CSV depuis Excel, puis réessayez."
        : "Ce fichier ne peut pas être lu. Utilisez un fichier Excel (.xlsx) ou CSV.");
    });
  }

  function colLabel(i) {
    var h = S.rows[S.hdr][i], t = typeof h === "string" ? h.trim() : "";
    return (t ? t.slice(0, 26) : "Colonne " + (i + 1));
  }

  function stepPreview() {
    var inf = info(), R = build(S, inf), missing = FIELDS.filter(function (f) { return f.req && (S.map[f.k] == null || S.map[f.k] < 0); });
    var ncols = S.rows.slice(S.hdr, S.hdr + 51).reduce(function (m, r) { return Math.max(m, r.length); }, 0);
    var sel = FIELDS.map(function (f) {
      var o = '<option value="-1">— Aucune —</option>', i;
      for (i = 0; i < ncols; i++) o += '<option value="' + i + '"' + (S.map[f.k] === i ? " selected" : "") + ">" + esc(colLabel(i)) + "</option>";
      return '<label for="pfi-m-' + f.k + '">' + f.label + (f.req ? " *" : "") + '</label><select id="pfi-m-' + f.k + '" data-k="' + f.k + '">' + o + "</select>";
    }).join("");
    var h = '<h2 id="pfi-t">Aperçu de l’import</h2><p style="margin-bottom:4px">' + esc(S.name) + "</p>";
    if (S.okMsg) h += '<div class="pfi-note" role="status">' + esc(S.okMsg) + "</div>";
    if (S.err) h += '<div class="pfi-err" role="alert">' + esc(S.err) + "</div>";
    if (missing.length) {
      h += '<div class="pfi-err" role="alert">Je ne trouve pas la colonne : <b>' + missing.map(function (f) { return f.label; }).join(", ") + "</b>. Choisissez-la ci-dessous.</div>";
    } else {
      h += '<div class="pfi-g">' +
        '<div class="pfi-s ok"><b>' + R.ok.length + "</b><span>paiement" + (R.ok.length > 1 ? "s" : "") + " à importer</span></div>" +
        '<div class="pfi-s"><b>' + R.clients + "</b><span>client" + (R.clients > 1 ? "s" : "") + " dont " + R.newClients + " nouveau" + (R.newClients > 1 ? "x" : "") + "</span></div>" +
        (R.dup ? '<div class="pfi-s"><b>' + R.dup + "</b><span>déjà présent" + (R.dup > 1 ? "s" : "") + " (ignoré" + (R.dup > 1 ? "s" : "") + ")</span></div>" : "") +
        (R.bad.length ? '<div class="pfi-s ko"><b>' + R.bad.length + "</b><span>ligne" + (R.bad.length > 1 ? "s" : "") + " à corriger (ignorée" + (R.bad.length > 1 ? "s" : "") + ")</span></div>" : "") +
        "</div>";
      if (R.truncated) h += '<div class="pfi-note">Seules les ' + MAXROWS + " premières lignes sont prises en compte.</div>";
      if (R.bad.length) {
        h += '<div class="pfi-err"><b>Lignes ignorées</b><ul>' + R.bad.slice(0, 6).map(function (i) { return "<li>Ligne " + i.line + " : " + esc(i.why.join(", ")) + "</li>"; }).join("") +
          (R.bad.length > 6 ? "<li>… et " + (R.bad.length - 6) + " autre" + (R.bad.length - 6 > 1 ? "s" : "") + "</li>" : "") + "</ul></div>";
      }
      if (inf.demo && R.ok.length) h += '<div class="pfi-note">Les données d’exemple seront retirées pour laisser place à vos vraies données.</div>';
    }
    h += '<details' + (missing.length ? " open" : "") + "><summary>Colonnes détectées</summary>" + sel + "<small>* obligatoire</small></details>";
    if (!missing.length) {
      if (inf.pro) h += '<button type="button" class="pfi-btn" id="pfi-go"' + (R.ok.length ? "" : " disabled") + ' data-focus>Importer ' + R.ok.length + " paiement" + (R.ok.length > 1 ? "s" : "") + "</button>";
      else {
        var pi = PF.planInfo ? PF.planInfo() : {};
        if (pi.trialAvailable) {
          h += '<div class="pfi-note">L’import fait partie du Pack Pro. Activez vos 3 mois offerts, sans carte bancaire, pour l’importer tout de suite.</div>' +
            '<button type="button" class="pfi-btn" id="pfi-trial" data-focus>Activer mes 3 mois offerts</button>' +
            '<a class="pfi-alt" href="payfollow-tarifs.html">Voir les offres</a>';
        } else {
          h += '<div class="pfi-note">L’import des fichiers fait partie du Pack Pro. Votre aperçu est prêt : il suffit de passer au Pack Pro pour l’importer.</div>' +
            '<a class="pfi-btn" href="payfollow-tarifs.html" data-focus>Voir les offres</a>';
        }
      }
    }
    h += '<button type="button" class="pfi-alt" id="pfi-re">Choisir un autre fichier</button><button type="button" class="pfi-alt" id="pfi-x">Annuler</button>';
    shell(h);
    overlay.querySelectorAll("select[data-k]").forEach(function (s) {
      s.addEventListener("change", function () { S.map[s.dataset.k] = +s.value; stepPreview(); });
    });
    overlay.querySelector("#pfi-re").addEventListener("click", function () { S = null; stepChoose(); });
    overlay.querySelector("#pfi-x").addEventListener("click", shut);
    var tr = overlay.querySelector("#pfi-trial");
    if (tr) tr.addEventListener("click", function () {
      tr.disabled = true; tr.textContent = "Activation…"; S.err = "";
      PF.startTrial().then(function (r) {
        if (!overlay || !S) return;
        if (r && r.ok) { S.okMsg = "Essai Pro activé jusqu’au " + PF.fmtFr(r.fin) + ". Vous pouvez importer."; S.err = ""; }
        else S.err = r && r.err === "deja" ? "Votre essai gratuit a déjà été utilisé. Voyez les offres pour continuer."
          : r && r.err === "pro" ? "Votre compte est déjà en Pack Pro."
          : r && r.err === "absent" ? "L’activation n’est pas encore disponible. Réessayez plus tard."
          : r && r.err === "session" ? "Votre session a expiré. Reconnectez-vous, puis réessayez."
          : "Activation impossible. Vérifiez votre connexion et réessayez.";
        stepPreview();
      });
    });
    var go = overlay.querySelector("#pfi-go");
    if (go) go.addEventListener("click", function () {
      go.disabled = true; go.textContent = "Import en cours…";
      var res = PF.importBatch(R.ok.map(function (i) { return { c: i.c, e: i.e, t: i.t, l: i.l, a: i.a, d: i.d }; }));
      if (!res || !res.ok) {
        return stepChoose(res && res.err === "pro" ? "L’import fait partie du Pack Pro." : "L’import n’a pas pu se faire. Réessayez dans un instant.");
      }
      stepDone(res);
    });
  }

  function stepDone(res) {
    shell('<h2 id="pfi-t">Import terminé ✔</h2>' +
      "<p><b>" + res.payments + "</b> paiement" + (res.payments > 1 ? "s" : "") + " ajouté" + (res.payments > 1 ? "s" : "") + ", dont <b>" + res.clients + "</b> nouveau" + (res.clients > 1 ? "x" : "") + " client" + (res.clients > 1 ? "s" : "") + ".</p>" +
      '<small style="margin:0 0 6px">Vos données sont envoyées en arrière-plan et seront disponibles sur tous vos appareils.</small>' +
      '<button type="button" class="pfi-btn" id="pfi-ok" data-focus>Voir mes clients</button>');
    overlay.querySelector("#pfi-ok").addEventListener("click", function () {
      if (/payfollow-clients\.html/.test(location.pathname)) location.reload(); else location.href = "payfollow-clients.html";
    });
  }

  function open() {
    if (overlay) return;
    if (!document.getElementById("pfi-css")) { var st = document.createElement("style"); st.id = "pfi-css"; st.textContent = CSS; document.head.appendChild(st); }
    overlay = document.createElement("div"); overlay.className = "pfi";
    overlay.setAttribute("role", "dialog"); overlay.setAttribute("aria-modal", "true"); overlay.setAttribute("aria-labelledby", "pfi-t");
    overlay.innerHTML = '<div class="pfi-b"></div>';
    overlay.addEventListener("click", function (e) { if (e.target === overlay) shut(); });
    onKey = function (e) { if (e.key === "Escape") shut(); };
    document.addEventListener("keydown", onKey);
    document.body.appendChild(overlay);
    stepChoose();
  }

  window.PFImport = { open: open, _t: { parseAmount: parseAmount, parseDate: parseDate, autoMap: autoMap, findHeader: findHeader, parseCSV: parseCSV } };
})();

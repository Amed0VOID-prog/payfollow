/* PayFollow : connexion à Supabase (projet payfollow-prod).
   L'adresse du projet et la clé « publishable » sont publiques : elles peuvent être dans le site.
   La sécurité vient des règles de la base (RLS), pas du secret de cette clé.
   NE JAMAIS mettre ici la clé « secret » ou « service_role ». */
(function () {
  if (window.pfSb) return;
  var URL = "https://bgrcjzvcpvtboatqvzwu.supabase.co";
  var KEY = "sb_publishable_C4GKbYyRh5zU5stfkiwQdw_JF55E6Wb";
  var LIB = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.50.0/dist/umd/supabase.js";

  /* window.pfSb : promesse qui donne le client Supabase (ou null si la bibliothèque n'a pas pu se charger) */
  window.pfSb = new Promise(function (resolve) {
    function make() {
      try {
        window.sb = window.supabase.createClient(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
        resolve(window.sb);
      } catch (e) { resolve(null); }
    }
    if (window.supabase && window.supabase.createClient) return make();
    var s = document.createElement("script");
    s.src = LIB; s.onload = make; s.onerror = function () { resolve(null); };
    document.head.appendChild(s);
  });
})();

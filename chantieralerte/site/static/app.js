// ChantierAlerte — script unique, sans dépendance.
(function () {
  "use strict";
  var C = window.CA || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var params = new URLSearchParams(location.search);
  var token = params.get("t");

  function msg(el, text, ok) { if (!el) return; el.className = "msg " + (ok ? "ok" : "err"); el.textContent = text; }
  function rpc(fn, args, authToken) {
    return fetch(C.supabaseUrl + "/rest/v1/rpc/" + fn, {
      method: "POST",
      headers: { apikey: C.anonKey, Authorization: "Bearer " + (authToken || C.anonKey), "Content-Type": "application/json" },
      body: JSON.stringify(args || {})
    }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.message || "Erreur"); return j; }); });
  }
  function payUrl(id, email) {
    if (!C.paymentLink) return null;
    var u = new URL(C.paymentLink);
    if (id) u.searchParams.set("client_reference_id", id);
    if (email && email.indexOf("•") === -1) u.searchParams.set("prefilled_email", email);
    return u.toString();
  }

  // ---- Sélecteur de départements (recherche + compteur) --------------------
  function deptPicker() {
    var box = $("#depts"); if (!box) return;
    var search = $("#dept-search"), count = $("#dept-count");
    function update() {
      var n = $$("input:checked", box).length;
      count.textContent = n ? n + " département" + (n > 1 ? "s" : "") + " choisi" + (n > 1 ? "s" : "") : "Aucun département choisi";
    }
    if (search) search.addEventListener("input", function () {
      var q = search.value.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      $$("label", box).forEach(function (l) {
        var k = l.getAttribute("data-k").normalize("NFD").replace(/[̀-ͯ]/g, "");
        l.hidden = q && k.indexOf(q) === -1 && !l.querySelector("input").checked;
      });
    });
    box.addEventListener("change", update); update();
  }
  function setChecked(form, name, values) {
    $$('input[name="' + name + '"]', form).forEach(function (i) { i.checked = values.indexOf(i.value) !== -1; });
  }
  function values(form, name) { return $$('input[name="' + name + '"]:checked', form).map(function (i) { return i.value; }); }

  // ---- Inscription (page d'accueil) ---------------------------------------
  var sub = $("#subscribe");
  if (sub) {
    deptPicker();
    if (params.get("metier")) setChecked(sub, "trades", [params.get("metier")]);
    if (params.get("dep")) { setChecked(sub, "departments", [params.get("dep")]); $("#depts").dispatchEvent(new Event("change")); }
    sub.addEventListener("submit", function (e) {
      e.preventDefault();
      var out = $("#sub-msg"), btn = $("button[type=submit]", sub);
      out.className = ""; out.textContent = "";
      var data = { email: sub.email.value.trim(), trades: values(sub, "trades"), departments: values(sub, "departments"), website: sub.website.value };
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) return msg(out, "Indiquez une adresse email valide.");
      if (!data.trades.length) return msg(out, "Choisissez au moins un métier.");
      if (!data.departments.length) return msg(out, "Choisissez au moins un département.");
      btn.disabled = true; btn.textContent = "Envoi…";
      fetch(C.functionsUrl + "/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (res.ok) { msg(out, res.j.message, true); sub.reset(); $("#depts").dispatchEvent(new Event("change")); }
          else msg(out, res.j.error || "Une erreur est survenue.");
        })
        .catch(function () { msg(out, "Connexion impossible. Vérifiez votre réseau et réessayez."); })
        .finally(function () { btn.disabled = false; btn.textContent = "Démarrer mon essai gratuit"; });
    });
  }

  var page = $("#page"); if (!page) return;
  var kind = page.getAttribute("data-page");
  var noToken = function (el) { el.textContent = "Lien incomplet. Utilisez le lien reçu par email."; };

  // ---- Confirmation (double opt-in) --------------------------------------
  if (kind === "confirm") {
    if (!token) return noToken($("#state"));
    rpc("confirm_subscription", { p_token: token }).then(function (status) {
      var h = $("h1", page);
      if (status === "trial") { h.textContent = "C'est confirmé !"; $("#state").textContent = "Votre essai gratuit de " + C.trialDays + " jours a commencé."; }
      else if (status === "active") { h.textContent = "Déjà actif"; $("#state").textContent = "Votre abonnement est actif."; }
      else if (status) { h.textContent = "Adresse déjà confirmée"; $("#state").textContent = "Gérez vos alertes depuis votre espace."; }
      else { h.textContent = "Lien invalide"; $("#state").textContent = "Ce lien n'est plus valable. Réinscrivez-vous depuis la page d'accueil."; return; }
      $("#next").hidden = false; $("#prefs-link").href = "preferences.html?t=" + encodeURIComponent(token);
    }).catch(function () { $("#state").textContent = "Connexion impossible. Réessayez dans un instant."; });
  }

  // ---- Préférences -------------------------------------------------------
  if (kind === "prefs") {
    var form = $("#prefs-form");
    if (!token) return noToken($("#who"));
    var labels = { pending: "inscription non confirmée", trial: "essai gratuit", active: "abonnement actif", expired: "essai terminé", unsubscribed: "désinscrit" };
    var load = function () {
      return rpc("get_preferences", { p_token: token }).then(function (rows) {
        var p = rows[0];
        if (!p) { $("#who").textContent = "Lien invalide ou compte supprimé."; return; }
        $("#who").textContent = "Compte : " + p.email;
        setChecked(form, "trades", p.trades); setChecked(form, "departments", p.departments);
        form.hidden = false; deptPicker(); $("#account").hidden = false;
        var line = "Statut : " + labels[p.status];
        if (p.status === "trial" && p.trial_ends_at) line += " jusqu'au " + new Date(p.trial_ends_at).toLocaleDateString("fr-FR");
        $("#status-line").textContent = line;
        var url = payUrl(p.id, p.email), zone = $("#pay-zone"); zone.textContent = "";
        if (p.status !== "active" && url) { var a = document.createElement("a"); a.className = "btn"; a.href = url; a.textContent = "S'abonner — " + C.price + " €/mois"; zone.appendChild(a); }
        $("#unsub-btn").hidden = p.status === "unsubscribed"; $("#resub-btn").hidden = p.status !== "unsubscribed";
      });
    };
    load().catch(function () { $("#who").textContent = "Connexion impossible. Réessayez."; });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var t = values(form, "trades"), d = values(form, "departments"), out = $("#prefs-msg");
      if (!t.length || !d.length) return msg(out, "Choisissez au moins un métier et un département.");
      rpc("update_preferences", { p_token: token, p_trades: t, p_departments: d })
        .then(function (ok) { msg(out, ok ? "Préférences enregistrées." : "Lien invalide.", ok); })
        .catch(function () { msg(out, "Enregistrement impossible. Réessayez."); });
    });
    $("#unsub-btn").addEventListener("click", function () { rpc("unsubscribe", { p_token: token }).then(load).then(function () { msg($("#acct-msg"), "Vous êtes désinscrit. Vous ne recevrez plus d'alertes.", true); }); });
    $("#resub-btn").addEventListener("click", function () { rpc("resubscribe", { p_token: token }).then(load).then(function () { msg($("#acct-msg"), "Alertes réactivées.", true); }); });
    $("#delete-btn").addEventListener("click", function () {
      if (!confirm("Supprimer définitivement votre compte et toutes vos données ? Cette action est irréversible.")) return;
      rpc("delete_my_data", { p_token: token }).then(function () { page.innerHTML = "<h1>Données supprimées</h1><p class='lead'>Votre compte et vos données ont été définitivement supprimés.</p>"; });
    });
  }

  // ---- Désinscription en un clic ----------------------------------------
  if (kind === "unsub") {
    if (!token) return noToken($("#state"));
    var done = function () {
      $("#title").textContent = "Vous êtes désinscrit";
      $("#state").textContent = "Vous ne recevrez plus d'alertes ChantierAlerte.";
      $("#actions").hidden = false; $("#prefs-link").href = "preferences.html?t=" + encodeURIComponent(token);
    };
    (params.get("ok") ? Promise.resolve() : rpc("unsubscribe", { p_token: token })).then(done).catch(function () { $("#state").textContent = "Connexion impossible. Réessayez."; });
    $("#resub-btn").addEventListener("click", function () {
      rpc("resubscribe", { p_token: token }).then(function () { $("#title").textContent = "Alertes réactivées"; $("#state").textContent = "Vous recevrez de nouveau vos alertes."; $("#resub-btn").hidden = true; });
    });
  }

  // ---- Abonnement ---------------------------------------------------------
  if (kind === "pay") {
    var zone = $("#pay-zone");
    if (!C.paymentLink) { zone.textContent = "Le paiement en ligne sera disponible très prochainement. Contact : " + C.contactEmail; return; }
    var go = function (id, email) { var a = document.createElement("a"); a.className = "btn"; a.href = payUrl(id, email); a.textContent = "Payer " + C.price + " €/mois avec Stripe"; zone.appendChild(a); };
    if (token) rpc("get_preferences", { p_token: token }).then(function (r) { go(r[0] && r[0].id, r[0] && r[0].email); }).catch(function () { go(); });
    else go();
  }

  // ---- Tableau de bord (connexion par lien email Supabase) ----------------
  if (kind === "admin") {
    var hash = new URLSearchParams(location.hash.slice(1));
    if (hash.get("access_token")) { sessionStorage.setItem("ca_admin", hash.get("access_token")); history.replaceState(null, "", location.pathname); }
    var jwt = sessionStorage.getItem("ca_admin");
    var login = $("#login");
    var showLogin = function (text) { login.hidden = false; if (text) msg($("#login-msg"), text); };
    login.addEventListener("submit", function (e) {
      e.preventDefault();
      fetch(C.supabaseUrl + "/auth/v1/otp?redirect_to=" + encodeURIComponent(location.origin + location.pathname), {
        method: "POST", headers: { apikey: C.anonKey, "Content-Type": "application/json" },
        body: JSON.stringify({ email: login.email.value.trim(), create_user: false }) })
        .then(function (r) { msg($("#login-msg"), r.ok ? "Si cette adresse est administratrice, un lien vient d'être envoyé." : "Envoi impossible.", r.ok); });
    });
    $("#logout").addEventListener("click", function () { sessionStorage.removeItem("ca_admin"); location.reload(); });
    if (!jwt) return showLogin();
    rpc("admin_stats", {}, jwt).then(function (s) {
      $("#dash").hidden = false;
      var set = function (id, v) { $(id).textContent = v; };
      set("#k-total", s.total); set("#k-trial", s.trial); set("#k-active", s.active); set("#k-mrr", s.mrr_eur + " €");
      set("#k-pending", s.pending); set("#k-expired", s.expired); set("#k-unsub", s.unsubscribed); set("#k-new", s.new_7d);
      var tb = $("#runs tbody");
      (s.last_runs || []).forEach(function (r) {
        var st = r.stats || {}, tr = document.createElement("tr");
        [new Date(r.started_at).toLocaleString("fr-FR"), r.status + (r.error ? " — " + r.error : ""), (st.boamp && st.boamp.with_trade) || "–", (st.alerts && st.alerts.emails) || 0]
          .forEach(function (v) { var td = document.createElement("td"); td.textContent = v; tr.appendChild(td); });
        tb.appendChild(tr);
      });
      var tt = $("#trades tbody");
      Object.keys(s.top_trades || {}).forEach(function (k) { var tr = document.createElement("tr"); tr.innerHTML = "<td></td><td></td>"; tr.cells[0].textContent = (C.tradeLabels || {})[k] || k; tr.cells[1].textContent = s.top_trades[k]; tt.appendChild(tr); });
    }).catch(function () { sessionStorage.removeItem("ca_admin"); showLogin("Accès refusé ou session expirée. Reconnectez-vous."); });
  }
})();

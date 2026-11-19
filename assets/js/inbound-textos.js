/* Textos das inbound pages (guias) editáveis no CMS: admin > "Inbound Page" (content/inbound-pages.json).
   O HTML de cada página já traz o texto original; este script só troca pelo do CMS quando existir.
   Marcas: data-ip="eyebrow" | "h1" | "lead". Título da aba e descrição são trocados direto. Sem fetch = o HTML segue como está. */
(function () {
  'use strict';
  var slug = (location.pathname.match(/\/guias\/([^\/]+)\/?/) || [])[1];
  if (!slug) return;
  fetch('/content/inbound-pages.json', { cache: 'no-cache' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      var it = d && (d.items || []).filter(function (x) { return x.slug === slug; })[0];
      if (!it) return;
      if (it.titulo_aba) document.title = it.titulo_aba;
      var m = document.querySelector('meta[name="description"]');
      if (m && it.descricao) m.setAttribute('content', it.descricao);
      ['eyebrow', 'h1', 'lead'].forEach(function (k) {
        var el = document.querySelector('[data-ip="' + k + '"]');
        if (el && it[k]) el.textContent = it[k];
      });
    })
    .catch(function () {});
})();

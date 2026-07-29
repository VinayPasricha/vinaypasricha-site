/* Hide the legacy preparation chrome when it is embedded in the unified Studio. */
(function () {
  'use strict';
  function attach() {
    var frame = document.querySelector('.preparation-frame');
    if (!frame || frame.dataset.embedWired === 'true') return;
    frame.dataset.embedWired = 'true';
    frame.addEventListener('load', function () {
      try {
        var doc = frame.contentDocument;
        if (!doc) return;
        var style = doc.createElement('style');
        style.textContent = '.studio-topbar{display:none!important}.abl-wrap{max-width:none!important;padding:18px 20px 48px!important}body{background:transparent!important}#login{margin:28px auto!important}';
        doc.head.appendChild(style);
      } catch (e) {}
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(attach, 0); });
  else setTimeout(attach, 0);
})();

/* Make the existing preparation room sit cleanly inside the unified Studio. */
(function () {
  'use strict';
  var params = new URLSearchParams(location.search);
  if (params.get('embedded') !== '1') return;
  document.documentElement.classList.add('abl-preparation-embedded');
  var style = document.createElement('style');
  style.textContent = [
    'html.abl-preparation-embedded body{background:transparent}',
    'html.abl-preparation-embedded .studio-topbar{display:none!important}',
    'html.abl-preparation-embedded .abl-wrap{max-width:none;padding:18px 20px 48px}',
    'html.abl-preparation-embedded #login{margin:28px auto}',
    'html.abl-preparation-embedded .abl-sec:first-child{margin-top:0}',
    'html.abl-preparation-embedded .detail{scroll-margin-top:16px}'
  ].join('');
  document.head.appendChild(style);
})();

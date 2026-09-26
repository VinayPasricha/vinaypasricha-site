/* Click-to-load YouTube. The iframe is created only after a click,
   so the page ships no player. Without JavaScript the link still
   opens the privacy-enhanced embed. */
(function () {
  document.addEventListener('click', function (event) {
    if (event.defaultPrevented) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    var link = event.target && event.target.closest && event.target.closest('a.wl-lite');
    if (!link) return;
    event.preventDefault();
    var frame = document.createElement('iframe');
    frame.className = 'wl-iframe';
    frame.src = link.getAttribute('data-embed') || link.href;
    frame.title = link.getAttribute('data-title') || 'Video';
    frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    frame.setAttribute('allowfullscreen', '');
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    link.replaceWith(frame);
  });
})();

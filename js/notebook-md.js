/* =============================================================
   notebook-md.js — minimal markdown renderer shared between the
   Studio Notebook editor (live preview) and the public essay reader.
   Same subset on both sides so previews match reality.
   ============================================================= */
(function () {
  function renderMarkdown(md) {
    if (!md) return '';
    let html = String(md).trim();

    html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    html = html.replace(/&lt;(\/?(?:em|strong|i|b|br))&gt;/g, '<$1>');
    html = html.replace(/&lt;(\/?(?:em|strong|i|b|br))\s*\/?&gt;/g, '<$1>');

    html = html.replace(/^### +(.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## +(.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# +(.+)$/gm, '<h1>$1</h1>');
    html = html.replace(/^&gt; +(.+)$/gm, '<blockquote>$1</blockquote>');
    html = html.replace(/^---+\s*$/gm, '<hr>');

    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    html = html.replace(/(^|[^_])_([^_\n]+)_/g, '$1<em>$2</em>');
    html = html.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');

    const blocks = html.split(/\n\s*\n/);
    html = blocks.map(b => {
      const t = b.trim();
      if (!t) return '';
      if (/^<(h\d|blockquote|hr|ul|ol|pre)/.test(t)) return t;
      return '<p>' + t.replace(/\n/g, '<br>') + '</p>';
    }).join('\n');

    return html;
  }
  window.notebookMarkdown = renderMarkdown;
})();

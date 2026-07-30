/* Direct assignment uploads for the signed-in participant workspace. */
(function () {
  'use strict';
  var parts = location.pathname.split('/').filter(Boolean);
  var slug = decodeURIComponent(parts[parts.length - 1] || '');
  if (!slug || slug === 'workspace') return;

  function esc(v) {
    return String(v == null ? '' : v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function headers(extra) {
    return window.AblAuth && window.AblAuth.headers ? window.AblAuth.headers(extra || {}) : (extra || {});
  }
  async function getData() {
    var r = await fetch('/api/abl/workspace/' + encodeURIComponent(slug), { headers: headers({ Accept:'application/json' }) });
    var b = await r.json().catch(function(){ return {}; });
    if (!r.ok || b.ok === false) throw new Error(b.error || 'Could not load assignments.');
    return b.data || {};
  }
  function size(bytes) {
    return bytes < 1048576 ? Math.max(1, Math.round(bytes / 1024)) + ' KB' : (bytes / 1048576).toFixed(1) + ' MB';
  }
  async function download(card, name) {
    var note = card.querySelector('[data-upload-note]');
    note.textContent = 'Preparing download…';
    try {
      var id = card.getAttribute('data-assignment');
      var r = await fetch('/api/abl/workspace/' + encodeURIComponent(slug) + '/submissions/' + encodeURIComponent(id) + '/file', { headers: headers({ Accept:'application/octet-stream' }) });
      if (!r.ok) {
        var b = await r.json().catch(function(){ return {}; });
        throw new Error(b.error || 'Could not open this file.');
      }
      var blob = await r.blob();
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url; link.download = name || 'assignment-file';
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
      note.textContent = '';
    } catch (e) { note.textContent = e.message || 'Could not open this file.'; }
  }
  function wireDownload(card) {
    var button = card.querySelector('[data-download-file]');
    if (button) button.onclick = function(){ download(card, button.getAttribute('data-file-name')); };
  }
  async function upload(card, file) {
    var note = card.querySelector('[data-upload-note]');
    if (!file) return;
    if (file.size > 15728640) { note.textContent = 'The file must be 15 MB or smaller.'; return; }
    note.textContent = 'Uploading ' + file.name + '…';
    try {
      var id = card.getAttribute('data-assignment');
      var r = await fetch('/api/abl/workspace/' + encodeURIComponent(slug) + '/submissions/' + encodeURIComponent(id) + '/upload', {
        method:'POST', body:file,
        headers:headers({ 'Content-Type':file.type || 'application/octet-stream', 'X-File-Name':file.name, Accept:'application/json' })
      });
      var b = await r.json().catch(function(){ return {}; });
      if (!r.ok || b.ok === false) throw new Error(b.error || 'Could not upload this file.');
      var saved = b.data || {};
      card.setAttribute('data-stored-file-url', saved.file_url || '');
      var current = card.querySelector('[data-uploaded-file]');
      current.hidden = false;
      current.innerHTML = '<strong>' + esc(saved.uploaded_file_name) + '</strong><span>' + esc(size(saved.uploaded_file_size)) + '</span><button type="button" data-download-file data-file-name="' + esc(saved.uploaded_file_name) + '">Open file ↗</button>';
      wireDownload(card);
      note.textContent = 'File uploaded. Save the draft or submit when ready.';
    } catch (e) { note.textContent = e.message || 'Could not upload this file.'; }
  }
  function enhance(card, assignment) {
    if (card.dataset.uploadReady) return;
    card.dataset.uploadReady = '1';
    var s = assignment.submission || {};
    card.setAttribute('data-stored-file-url', s.file_url || '');
    var link = card.querySelector('[data-field="file_url"]');
    if (!link) return;
    if (s.uploaded_file_name && /^\/api\/abl\/workspace\/admin\//.test(link.value || '')) link.value = '';
    link.placeholder = 'Optional Google Drive or file link';
    var uploaded = s.uploaded_file_name ? '<strong>' + esc(s.uploaded_file_name) + '</strong><span>' + esc(size(s.uploaded_file_size || 0)) + '</span><button type="button" data-download-file data-file-name="' + esc(s.uploaded_file_name) + '">Open file ↗</button>' : '';
    link.insertAdjacentHTML('beforebegin', '<div class="lw-upload-box" data-drop-zone><label>Upload assignment</label><div class="lw-upload-prompt">Choose a file or drag it here</div><input type="file" data-upload-input accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png,.webp"><small>PDF, Word, PowerPoint or image · Maximum 15 MB</small><div class="lw-uploaded-file" data-uploaded-file' + (uploaded ? '' : ' hidden') + '>' + uploaded + '</div><div class="lw-upload-note" data-upload-note></div><div class="lw-upload-or">Or paste a Drive/file link below</div></div>');
    var input = card.querySelector('[data-upload-input]');
    var drop = card.querySelector('[data-drop-zone]');
    input.onchange = function(){ upload(card, input.files && input.files[0]); };
    ['dragenter','dragover'].forEach(function(name){ drop.addEventListener(name,function(e){ e.preventDefault(); drop.classList.add('dragging'); }); });
    ['dragleave','drop'].forEach(function(name){ drop.addEventListener(name,function(e){ e.preventDefault(); drop.classList.remove('dragging'); }); });
    drop.addEventListener('drop',function(e){ upload(card,e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]); });
    wireDownload(card);
    Array.prototype.forEach.call(card.querySelectorAll('[data-save]'), function(button){
      var original = button.onclick;
      if (typeof original !== 'function') return;
      button.onclick = async function(event){
        var stored = card.getAttribute('data-stored-file-url') || '';
        var restore = stored && !link.value;
        if (restore) link.value = stored;
        try { await original.call(button, event); }
        finally { if (restore) link.value = ''; }
      };
    });
  }
  getData().then(function(data){
    (function wait(){
      var list = document.querySelector('.lw-assignment-list');
      if (!list) return requestAnimationFrame(wait);
      var assignments = data.assignments || [];
      if (!assignments.length) {
        list.innerHTML = '<div class="lw-assignment-empty"><strong>No assignment is available yet.</strong><p>Your assignment will appear here after it is published by Vinay' + (data.participant && !data.participant.cohort_id ? ' and your cohort is assigned' : '') + '.</p></div>';
        return;
      }
      assignments.forEach(function(a){ var card = list.querySelector('[data-assignment="' + CSS.escape(a.id) + '"]'); if (card) enhance(card,a); });
    })();
  }).catch(function(e){ console.error('[assignment-upload-ui]', e); });
})();

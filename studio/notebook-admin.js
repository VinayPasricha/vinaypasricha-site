/* Simple, direct Notebook publishing. */
(function () {
  'use strict';

  var state = { essays: [], images: [], originalSlug: '', booted: false };
  var $ = function (id) { return document.getElementById(id); };

  function esc(value) {
    return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function slugify(value) {
    return String(value || '').toLowerCase().replace(/<[^>]+>/g, '').replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 64) || 'untitled';
  }
  function today() { return new Date().toISOString().slice(0, 10); }
  function setStatus(id, message, error) {
    var node = $(id); if (!node) return;
    node.textContent = message || '';
    node.classList.toggle('error', !!error);
  }
  async function api(path, init) {
    var response = await fetch(path, Object.assign({ headers: { 'Content-Type': 'application/json', Accept: 'application/json' } }, init || {}));
    var body = await response.json().catch(function () { return {}; });
    if (response.status === 401) { location.replace('/studio/login'); throw new Error('Studio login required.'); }
    if (!response.ok || body.ok === false) throw new Error(body.detail || body.error || 'The request did not complete.');
    return body;
  }

  async function loadEssays() {
    try {
      var result = await api('/api/studio/notebook');
      state.essays = Array.isArray(result.essays) ? result.essays : [];
    } catch (error) {
      setStatus('count', error.message, true);
      try {
        var fallback = await fetch('../assets/data/notebook.json', { cache: 'no-cache' });
        var data = fallback.ok ? await fallback.json() : {};
        state.essays = Array.isArray(data.essays) ? data.essays : [];
      } catch (ignored) { state.essays = []; }
    }
    recoverOldDrafts();
    renderList();
  }

  function recoverOldDrafts() {
    try {
      var legacy = JSON.parse(localStorage.getItem('studio.notebook') || 'null');
      var recovered = 0;
      (legacy && Array.isArray(legacy.essays) ? legacy.essays : []).forEach(function (essay) {
        if (!state.essays.some(function (item) { return item.slug === essay.slug; })) {
          state.essays.push(Object.assign({}, essay, { status: 'draft', recovered: true }));
          recovered += 1;
        }
      });
      if (recovered) {
        $('recovery').style.display = 'block';
        $('recovery').textContent = 'Recovered ' + recovered + ' draft' + (recovered === 1 ? '' : 's') + ' from the old Notebook. Open a recovered draft below, then save or publish it normally.';
      }
    } catch (ignored) {}
  }

  function renderList() {
    var ordered = state.essays.slice().sort(function (a, b) {
      if (a.status !== b.status) return a.status === 'draft' ? -1 : 1;
      return String(b.date || '').localeCompare(String(a.date || ''));
    });
    var published = ordered.filter(function (item) { return item.status === 'published'; }).length;
    $('count').textContent = ordered.length + ' essay' + (ordered.length === 1 ? '' : 's') + ' · ' + published + ' live';
    if (!ordered.length) {
      $('postList').innerHTML = '<div class="empty">No essays yet. Paste the first one above.</div>';
      return;
    }
    $('postList').innerHTML = ordered.map(function (essay) {
      var live = essay.status === 'published';
      return '<article class="post-row" data-slug="' + esc(essay.slug) + '">' +
        '<div class="date">' + esc(essay.monthLabel || essay.date || '') + '</div>' +
        '<div><h3>' + esc(essay.title || 'Untitled') + '</h3><div class="meta">' + (live ? 'Live on website' : (essay.recovered ? 'Recovered draft' : 'Draft')) + ' · ' + esc((essay.tags || []).join(' · ')) + '</div></div>' +
        '<div class="post-actions"><button type="button" data-edit>Edit</button>' +
        (live ? '<a href="/paths/essay/' + encodeURIComponent(essay.slug) + '" target="_blank" rel="noopener">View live</a><button type="button" data-hide>Hide</button>' : '') + '</div></article>';
    }).join('');
    Array.prototype.forEach.call($('postList').querySelectorAll('[data-edit]'), function (button) {
      button.onclick = function () { editEssay(button.closest('[data-slug]').getAttribute('data-slug')); };
    });
    Array.prototype.forEach.call($('postList').querySelectorAll('[data-hide]'), function (button) {
      button.onclick = function () { hideEssay(button.closest('[data-slug]').getAttribute('data-slug')); };
    });
  }

  function showPrepared() {
    $('prepared').style.display = 'block';
    $('prepared').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function continueWithoutAI() {
    var source = $('sourceText').value.trim();
    if (source.length < 20) return setStatus('prepareStatus', 'Paste the article first.', true);
    $('postBody').value = source;
    $('postDate').value = $('postDate').value || today();
    showPrepared();
  }

  async function prepareWithAI() {
    var source = $('sourceText').value.trim();
    if (source.length < 40) return setStatus('prepareStatus', 'Paste a little more of the article first.', true);
    var button = $('prepareButton'); button.disabled = true;
    setStatus('prepareStatus', 'Preparing the page…');
    try {
      var result = await api('/api/studio/notebook/assist', { method: 'POST', body: JSON.stringify({ text: source }) });
      var prepared = result.prepared || {};
      $('postTitle').value = prepared.title || '';
      $('postDek').value = prepared.dek || '';
      $('postTags').value = (prepared.tags || []).join(', ');
      $('postBody').value = prepared.body || source;
      $('postDate').value = $('postDate').value || today();
      setStatus('prepareStatus', 'Ready for your review.');
      showPrepared();
      renderPreview();
    } catch (error) { setStatus('prepareStatus', error.message, true); }
    button.disabled = false;
  }

  function renderImages() {
    $('images').innerHTML = state.images.map(function (image, index) {
      return '<div class="image-card" data-image="' + esc(image.id) + '"><img src="' + esc(image.url) + '" alt=""><span class="badge">' + (index === 0 ? 'Lead image' : 'In article') + '</span><button type="button" aria-label="Remove image">×</button><input value="' + esc(image.alt || '') + '" placeholder="Short caption or description"></div>';
    }).join('');
    Array.prototype.forEach.call($('images').querySelectorAll('.image-card'), function (card) {
      var image = state.images.find(function (item) { return item.id === card.getAttribute('data-image'); });
      card.querySelector('button').onclick = function () { state.images = state.images.filter(function (item) { return item !== image; }); renderImages(); renderPreview(); };
      card.querySelector('input').oninput = function () { image.alt = this.value; renderPreview(); };
    });
  }

  function fileData(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader(); reader.onload = function () { resolve(String(reader.result)); }; reader.onerror = function () { reject(new Error('The image could not be read.')); }; reader.readAsDataURL(file);
    });
  }

  async function uploadFiles(files) {
    var list = Array.prototype.slice.call(files || []);
    if (!list.length) return;
    if (state.images.length + list.length > 8) {
      setStatus('prepareStatus', 'Use up to 8 images in one article.', true);
      list = list.slice(0, Math.max(0, 8 - state.images.length));
    }
    if (!list.length) return;
    setStatus('prepareStatus', 'Uploading ' + list.length + ' image' + (list.length === 1 ? '' : 's') + '…');
    try {
      for (var i = 0; i < list.length; i += 1) {
        var file = list[i];
        var data = await fileData(file);
        var result = await api('/api/studio/notebook/images', { method: 'POST', body: JSON.stringify({ data: data, alt: file.name.replace(/\.[^.]+$/, '') }) });
        state.images.push(result.image);
      }
      renderImages(); setStatus('prepareStatus', 'Images ready. The first will lead the article; others will be spaced through it.');
    } catch (error) { setStatus('prepareStatus', error.message, true); }
  }

  function figure(image) {
    var fig = document.createElement('figure');
    var img = document.createElement('img'); img.src = image.url; img.alt = image.alt || 'Essay image'; fig.appendChild(img);
    if (image.alt) { var cap = document.createElement('figcaption'); cap.textContent = image.alt; fig.appendChild(cap); }
    return fig;
  }

  function arrangeBody(host, body, images) {
    host.innerHTML = window.notebookMarkdown(body || '');
    if (!images.length) return;
    host.insertBefore(figure(images[0]), host.firstChild);
    var remaining = images.slice(1);
    if (!remaining.length) return;
    var blocks = Array.prototype.slice.call(host.children).filter(function (node) { return node.tagName !== 'FIGURE'; });
    remaining.forEach(function (image, index) {
      var target = blocks[Math.min(blocks.length - 1, Math.max(0, Math.round((index + 1) * blocks.length / (remaining.length + 1)) - 1))];
      if (target) target.insertAdjacentElement('afterend', figure(image)); else host.appendChild(figure(image));
    });
  }

  function renderPreview() {
    $('previewTitle').textContent = $('postTitle').value.trim() || 'Untitled';
    $('previewDek').textContent = $('postDek').value.trim();
    arrangeBody($('previewBody'), $('postBody').value, state.images);
    $('preview').style.display = 'block';
    $('preview').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function essayPayload(status) {
    return {
      original_slug: state.originalSlug || undefined,
      slug: slugify($('postTitle').value),
      title: $('postTitle').value.trim(),
      dek: $('postDek').value.trim(),
      tags: $('postTags').value.split(',').map(function (tag) { return tag.trim(); }).filter(Boolean),
      date: $('postDate').value || today(),
      body: $('postBody').value.trim(),
      images: state.images,
      status: status,
    };
  }

  async function save(status) {
    var button = status === 'published' ? $('publishButton') : $('saveButton'); button.disabled = true;
    setStatus('publishStatus', status === 'published' ? 'Publishing…' : 'Saving…');
    try {
      var result = await api('/api/studio/notebook/essays', { method: 'POST', body: JSON.stringify(essayPayload(status)) });
      localStorage.removeItem('studio.notebook');
      state.originalSlug = result.essay.slug;
      setStatus('publishStatus', status === 'published' ? 'Published. It is live now.' : 'Draft saved.');
      await loadEssays();
      if (status === 'published') {
        $('publishStatus').innerHTML = 'Published. <a href="' + esc(result.live_url) + '" target="_blank" rel="noopener">Open it on the website ↗</a>';
      }
    } catch (error) { setStatus('publishStatus', error.message, true); }
    button.disabled = false;
  }

  function editEssay(slug) {
    var essay = state.essays.find(function (item) { return item.slug === slug; }); if (!essay) return;
    state.originalSlug = essay.slug; state.images = (essay.images || []).map(function (image) { return Object.assign({}, image); });
    $('sourceText').value = essay.body || '';
    $('postTitle').value = essay.title || '';
    $('postDek').value = essay.dek || '';
    $('postTags').value = (essay.tags || []).join(', ');
    $('postDate').value = essay.date || today();
    $('postBody').value = essay.body || '';
    renderImages(); showPrepared(); renderPreview();
  }

  async function hideEssay(slug) {
    var essay = state.essays.find(function (item) { return item.slug === slug; }); if (!essay) return;
    if (!confirm('Hide “' + essay.title + '” from the website? The draft will remain in Studio.')) return;
    try {
      await api('/api/studio/notebook/essays', { method: 'POST', body: JSON.stringify(Object.assign({}, essay, { original_slug: essay.slug, status: 'draft' })) });
      await loadEssays();
    } catch (error) { setStatus('count', error.message, true); }
  }

  function resetComposer() {
    state.originalSlug = ''; state.images = [];
    ['sourceText','postTitle','postDek','postTags','postBody'].forEach(function (id) { $(id).value = ''; });
    $('postDate').value = today();
    $('prepared').style.display = 'none'; $('preview').style.display = 'none';
    setStatus('prepareStatus', ''); setStatus('publishStatus', '');
    renderImages(); $('sourceText').focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function wire() {
    $('newButton').onclick = resetComposer;
    $('prepareButton').onclick = prepareWithAI;
    $('continueButton').onclick = continueWithoutAI;
    $('previewButton').onclick = renderPreview;
    $('saveButton').onclick = function () { save('draft'); };
    $('publishButton').onclick = function () { save('published'); };
    $('imageDrop').onclick = function () { $('imageInput').click(); };
    $('imageDrop').onkeydown = function (event) { if (event.key === 'Enter' || event.key === ' ') $('imageInput').click(); };
    $('imageInput').onchange = function () { uploadFiles(this.files); this.value = ''; };
    ['dragenter','dragover'].forEach(function (name) { $('imageDrop').addEventListener(name, function (event) { event.preventDefault(); $('imageDrop').classList.add('dragover'); }); });
    ['dragleave','drop'].forEach(function (name) { $('imageDrop').addEventListener(name, function (event) { event.preventDefault(); $('imageDrop').classList.remove('dragover'); }); });
    $('imageDrop').addEventListener('drop', function (event) { uploadFiles(event.dataTransfer.files); });
    $('sourceText').addEventListener('paste', function (event) {
      var files = [];
      Array.prototype.forEach.call(event.clipboardData && event.clipboardData.items || [], function (item) { if (item.kind === 'file' && /^image\//.test(item.type)) files.push(item.getAsFile()); });
      if (files.length) uploadFiles(files);
    });
  }

  async function boot() {
    if (state.booted) return; state.booted = true;
    $('postDate').value = today(); wire(); await loadEssays();
  }

  document.addEventListener('studio:authed', boot);
  if (window.studioAuth && window.studioAuth.isAuthed && window.studioAuth.isAuthed()) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  }
})();

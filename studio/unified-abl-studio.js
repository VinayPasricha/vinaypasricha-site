/* One AI for Business Leaders Studio: preparation + cohorts + workspace operations. */
(function () {
  'use strict';

  function addStyle() {
    var style = document.createElement('style');
    style.textContent = [
      '.quick-grid{grid-template-columns:repeat(3,minmax(0,1fr))}',
      '.preparation-shell{padding:0;overflow:hidden}',
      '.preparation-frame{display:block;width:100%;height:calc(100vh - 170px);min-height:760px;border:0;background:var(--s-paper)}',
      '.unified-note{margin:0 0 18px;padding:12px 14px;border-left:3px solid var(--s-accent);background:rgba(251,248,241,.72);color:var(--s-muted);font:400 11px/1.5 var(--s-sans)}',
      '@media(max-width:820px){.quick-grid{grid-template-columns:1fr}.preparation-frame{height:calc(100vh - 210px);min-height:680px}}'
    ].join('');
    document.head.appendChild(style);
    if (!document.querySelector('link[href="/studio/abl-intelligence.css"]')) {
      var link = document.createElement('link'); link.rel = 'stylesheet'; link.href = '/studio/abl-intelligence.css'; document.head.appendChild(link);
    }
  }

  function showPage(name) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-page-view]'), function (page) {
      page.hidden = page.getAttribute('data-page-view') !== name;
    });
    Array.prototype.forEach.call(document.querySelectorAll('.studio-nav [data-page]'), function (button) {
      button.classList.toggle('active', button.getAttribute('data-page') === name);
    });
    document.body.classList.remove('menu-open');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function pageButton(page, number, title, description) {
    var button = document.createElement('button');
    button.className = 'quick-card';
    button.setAttribute('data-page', page);
    button.innerHTML = '<b>' + number + '</b><strong>' + title + '</strong><span>' + description + '</span>';
    button.addEventListener('click', function () { showPage(page); });
    return button;
  }

  function addPreparationPage() {
    var main = document.querySelector('.studio-main');
    if (!main || document.querySelector('[data-page-view="preparation"]')) return;
    var section = document.createElement('section');
    section.className = 'studio-page';
    section.setAttribute('data-page-view', 'preparation');
    section.hidden = true;
    section.innerHTML =
      '<div class="page-head"><div><small>Company research, preparation conversation and meeting brief</small><h1>Participant preparation</h1></div>' +
      '<p>This is the preparation layer of the same participant record. Research, cohort, workspace and assignments are no longer separate systems.</p></div>' +
      '<p class="unified-note"><strong>One participant record:</strong> create the person once, then manage preparation, cohort membership, course materials, assignments and the 90-day initiative from this Studio.</p>' +
      '<div class="panel preparation-shell"><iframe class="preparation-frame" title="Participant preparation" src="/studio/ai-business-leaders?embedded=1"></iframe></div>';
    main.appendChild(section);
  }

  function addPreparationNavigation() {
    var firstNav = document.querySelector('.studio-nav');
    var participantButton = firstNav && firstNav.querySelector('[data-page="participants"]');
    if (!firstNav || !participantButton || firstNav.querySelector('[data-page="preparation"]')) return;
    var button = document.createElement('button');
    button.setAttribute('data-page', 'preparation');
    button.innerHTML = '<b>02</b>Participant preparation';
    button.addEventListener('click', function () { showPage('preparation'); });
    participantButton.insertAdjacentElement('afterend', button);

    var labels = [
      ['cohorts', '03'], ['materials', '04'], ['assignments', '05'], ['announcements', '06']
    ];
    labels.forEach(function (entry) {
      var item = firstNav.querySelector('[data-page="' + entry[0] + '"] b');
      if (item) item.textContent = entry[1];
    });
  }

  function updateHome() {
    var brandStrong = document.querySelector('.studio-brand strong');
    var brandSpan = document.querySelector('.studio-brand span');
    if (brandStrong) brandStrong.textContent = 'AI for Business Leaders Studio';
    if (brandSpan) brandSpan.textContent = 'One participant record from preparation to lifelong workspace.';

    var pageHead = document.querySelector('[data-page-view="home"] .page-head');
    if (pageHead) {
      var h1 = pageHead.querySelector('h1');
      var p = pageHead.querySelector('p');
      if (h1) h1.textContent = 'AI for Business Leaders Studio';
      if (p) p.textContent = 'One place to manage participant preparation, cohorts, materials, assignments, communication and continuing AI initiatives.';
    }

    var quick = document.querySelector('.quick-grid');
    if (quick && !quick.querySelector('[data-page="preparation"]')) {
      var participantCard = quick.querySelector('[data-page="participants"]');
      var prep = pageButton('preparation', '02', 'Participant preparation', 'Research, guided preparation and Vinay meeting brief.');
      if (participantCard) participantCard.insertAdjacentElement('afterend', prep); else quick.appendChild(prep);
      var numbering = [['cohorts','03'],['materials','04'],['assignments','05'],['announcements','06']];
      numbering.forEach(function (entry) {
        var b = quick.querySelector('[data-page="' + entry[0] + '"] b');
        if (b) b.textContent = entry[1];
      });
    }
  }

  function removeCompetingLink() {
    var old = document.getElementById('openOldStudio');
    if (old) old.remove();
  }

  function enhanceParticipantRows() {
    var rows = document.getElementById('participantRows');
    if (!rows) return;
    function apply() {
      Array.prototype.forEach.call(rows.querySelectorAll('tr[data-participant]'), function (row) {
        if (row.querySelector('[data-open-preparation]')) return;
        var actions = row.querySelector('td:last-child > div');
        if (!actions) return;
        var button = document.createElement('button');
        button.className = 'btn small ghost';
        button.type = 'button';
        button.setAttribute('data-open-preparation', 'true');
        button.textContent = 'Preparation';
        button.addEventListener('click', function () { showPage('preparation'); });
        actions.insertBefore(button, actions.firstChild);
      });
    }
    apply();
    new MutationObserver(apply).observe(rows, { childList: true, subtree: true });
  }

  function loadCourseIntelligence() {
    if (document.querySelector('script[src="/studio/course-intelligence.js"]')) return;
    var script = document.createElement('script'); script.src = '/studio/course-intelligence.js'; script.defer = true; document.body.appendChild(script);
  }

  function init() {
    addStyle();
    addPreparationPage();
    addPreparationNavigation();
    updateHome();
    removeCompetingLink();
    enhanceParticipantRows();
    loadCourseIntelligence();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

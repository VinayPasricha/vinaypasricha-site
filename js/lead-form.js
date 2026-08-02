/* Vinay Pasricha — lead-form.js
   The high-intent lead form, built once and mounted anywhere.

   Usage: drop a placeholder on any page (including inside book runtimes):

     <div data-lead-form="ai-implementation" data-context="paths/ai-for-business"></div>
     <script src="../js/lead-form.js" defer></script>

   `data-lead-form` picks the variant (copy + fields), `data-context` tags the
   placement so Studio can tell chapter 3 of the book from the Path 01 page.
   Submissions POST to /api/leads/priority, which stores the lead and alerts
   Vinay by email + Slack immediately. */
(function () {
  'use strict';

  var VARIANTS = {
    'ai-implementation': {
      label: 'Begin inside your company',
      heading: 'Ready to implement AI <em>in your company?</em>',
      sub: 'Tell Vinay where you are. This is not a mailing list — it lands directly with him, flagged for urgent attention, and he replies personally.',
      messageLabel: 'What should AI do for your business?',
      messagePlaceholder: 'The constraint you want to shift, the decision you are weighing, or simply where you are stuck…',
      button: 'Send it to Vinay',
      success: 'Received — and already on Vinay’s phone. Expect a personal reply at the email you gave, usually within a day.',
    },
    'decision-support': {
      label: 'Bring the decision to Vinay',
      heading: 'Some decisions deserve <em>a second mind.</em>',
      sub: 'SIV works alone. It works better with someone examining the ground with you. Describe the decision in front of you — it reaches Vinay directly, flagged for urgent attention.',
      messageLabel: 'What decision are you sitting with?',
      messagePlaceholder: 'The decision, the tension inside it, and what makes it hard to settle…',
      button: 'Send the decision',
      success: 'Received — and already on Vinay’s phone. He reads these himself and replies personally, usually within a day.',
    },
  };

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html !== undefined) n.innerHTML = html;
    return n;
  }

  function field(name, label, type, required, placeholder) {
    var wrap = el('div', 'lf-field' + (type === 'textarea' ? ' lf-field-full' : ''));
    var id = 'lf-' + name + '-' + Math.random().toString(36).slice(2, 7);
    var lab = el('label', 'lf-label', label + (required ? '' : ' <span class="lf-opt">optional</span>'));
    lab.setAttribute('for', id);
    var input = el(type === 'textarea' ? 'textarea' : 'input', 'lf-input');
    if (type !== 'textarea') input.type = type;
    input.name = name;
    input.id = id;
    if (required) input.required = true;
    if (placeholder) input.placeholder = placeholder;
    if (type === 'textarea') input.rows = 5;
    wrap.appendChild(lab);
    wrap.appendChild(input);
    return wrap;
  }

  function mount(host) {
    var variant = VARIANTS[host.getAttribute('data-lead-form')] || VARIANTS['ai-implementation'];
    var context = host.getAttribute('data-context') || '';

    var section = el('section', 'lead-form-block');
    section.appendChild(el('p', 'lf-kicker', '— ' + variant.label));
    section.appendChild(el('h2', 'lf-heading', variant.heading));

    var grid = el('div', 'lf-grid');
    var aside = el('div', 'lf-aside');
    aside.appendChild(el('p', 'lf-sub', variant.sub));
    aside.appendChild(el('p', 'lf-promise',
      '<span class="lf-dot" aria-hidden="true"></span> Delivered to Vinay’s inbox and Slack <em>the moment you press send.</em>'));
    grid.appendChild(aside);

    var form = el('form', 'lf-form');
    form.setAttribute('novalidate', '');
    var row = el('div', 'lf-row');
    row.appendChild(field('name', 'Your name', 'text', true));
    row.appendChild(field('email', 'Work email', 'email', true));
    form.appendChild(row);
    var row2 = el('div', 'lf-row');
    row2.appendChild(field('company', 'Company', 'text', false));
    row2.appendChild(field('role', 'Your role', 'text', false));
    form.appendChild(row2);
    form.appendChild(field('message', variant.messageLabel, 'textarea', true, variant.messagePlaceholder));

    // Honeypot — hidden from humans, irresistible to bots.
    var hp = el('input');
    hp.type = 'text'; hp.name = 'website'; hp.tabIndex = -1; hp.autocomplete = 'off';
    hp.setAttribute('aria-hidden', 'true');
    hp.style.cssText = 'position:absolute;left:-9999px;height:0;width:0;opacity:0';
    form.appendChild(hp);

    var actions = el('div', 'lf-actions');
    var btn = el('button', 'lf-submit', variant.button + ' <span class="lf-arrow">→</span>');
    btn.type = 'submit';
    actions.appendChild(btn);
    var status = el('p', 'lf-status');
    status.setAttribute('role', 'status');
    actions.appendChild(status);
    form.appendChild(actions);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      status.textContent = '';
      var data = {
        form: host.getAttribute('data-lead-form') || 'general',
        context: context,
        path: window.location.pathname,
        hp: hp.value,
        name: form.elements.name.value.trim(),
        email: form.elements.email.value.trim(),
        company: form.elements.company.value.trim(),
        role: form.elements.role.value.trim(),
        message: form.elements.message.value.trim(),
      };
      if (!data.name || !data.message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        status.className = 'lf-status lf-error';
        status.textContent = 'Please add your name, a valid work email, and a few lines about what you need.';
        return;
      }
      btn.disabled = true;
      btn.classList.add('lf-sending');
      btn.innerHTML = 'Sending…';
      fetch('/api/leads/priority', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function () {
          try { if (window.vpTrack) window.vpTrack.identify(data.email, { name: data.name, company: data.company, role: data.role, source: 'lead-form:' + data.form }); } catch (err) {}
          var done = el('div', 'lf-success');
          done.appendChild(el('p', 'lf-success-mark', '✓'));
          done.appendChild(el('p', 'lf-success-copy', variant.success));
          form.replaceWith(done);
        })
        .catch(function () {
          btn.disabled = false;
          btn.classList.remove('lf-sending');
          btn.innerHTML = variant.button + ' <span class="lf-arrow">→</span>';
          status.className = 'lf-status lf-error';
          status.innerHTML = 'That didn’t go through. Try once more, or write directly: <a href="mailto:vinay@goodspace.ai">vinay@goodspace.ai</a>';
        });
    });

    grid.appendChild(form);
    section.appendChild(grid);
    host.appendChild(section);
  }

  document.querySelectorAll('[data-lead-form]').forEach(mount);
})();

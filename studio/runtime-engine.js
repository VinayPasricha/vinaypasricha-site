/* =============================================================
   runtime-engine.js — The Hand, as a pure function of The Model.

   decideReachout(user, todayISO) reads ONLY the layers + pointer
   + open questions + chase state and returns a decision. No hidden
   state: given the same user record and the same date, it always
   returns the same thing. This is the orchestrator the architecture
   treatise describes — auditable, vetoable, overridable.

   Daily logic, asked strictly in order:
     1  Left a chamber mid-way and not returned for 2 weeks?
     2  Transformation just verified, opening a clear next step?
     3  Open question dormant for 4+ weeks?
     4  Silent for 2 weeks with no other trigger?  (heartbeat)

   Composition draws tone from Essence, approach from Method, the
   place-left-off from Pointer, and acknowledges the gap if the last
   contact is more than a month old.
   ============================================================= */
(function () {
  'use strict';

  function parse(d) { return d ? new Date(d + 'T00:00:00') : null; }
  function days(fromISO, toISO) {
    var a = parse(fromISO), b = parse(toISO);
    if (!a || !b) return null;
    return Math.floor((b - a) / 86400000);
  }
  function weeks(fromISO, toISO) {
    var d = days(fromISO, toISO);
    return d == null ? null : Math.floor(d / 7);
  }
  function yearsAndMonths(fromISO, toISO) {
    var d = days(fromISO, toISO);
    if (d == null) return '';
    var y = Math.floor(d / 365);
    var m = Math.floor((d % 365) / 30);
    var out = [];
    if (y) out.push(y + (y === 1 ? ' year' : ' years'));
    if (m) out.push(m + (m === 1 ? ' month' : ' months'));
    if (!out.length) out.push(d + ' days');
    return out.join(' and ');
  }

  /* Essence → tone. Derived from the essence's own attributes — not
     stored, computed. The system reads what it knows about how the
     person receives things and shapes the register accordingly. */
  function essenceTone(essence) {
    if (!essence) return 'plain and unhurried';
    var attrs = (essence.core_attributes || []).map(function (a) {
      return (a.value || '').toLowerCase();
    }).join(' | ');
    if (/evasive|hiding|armor|avoid/.test(attrs)) return 'direct, but without pressure';
    if (/cost|measurement|measure/.test(attrs)) return 'plain, anchored in what it costs';
    if (/gentle|permission|fear|wrong/.test(attrs)) return 'gentle, room to not-know';
    if (/burst|busy|provisional|early/.test(attrs)) return 'light, low-demand';
    return 'measured and unhurried';
  }

  /* Method → approach: how this particular person prefers to evolve. */
  function approach(method) {
    if (!method || !method.evolution_modes || !method.evolution_modes.length) return 'a single concrete next step';
    return method.evolution_modes[0];
  }

  /* The channel ladder, in days. */
  var LADDER = [
    { day: 0,  channel: 'email',    label: 'Email · link to chat' },
    { day: 7,  channel: 'email',    label: 'Email · second' },
    { day: 14, channel: 'whatsapp', label: 'WhatsApp · link' },
    { day: 21, channel: 'whatsapp', label: 'WhatsApp · second' },
    { day: 30, channel: 'email',    label: 'Monthly email · then silence' }
  ];

  function ladderStateForDay(chaseDay) {
    // returns the index of the "now" rung given how far into a chase we are
    var idx = 0;
    for (var i = 0; i < LADDER.length; i++) {
      if (chaseDay >= LADDER[i].day) idx = i;
    }
    return idx;
  }

  function decideReachout(user, todayISO) {
    var out = {
      user_id: user.user_id,
      name: user.name,
      today: todayISO,
      status: user.status,
      fires: false,
      triggerIndex: 0,
      triggerLabel: 'no trigger — hold silence',
      rungs: [],
      composed: null,
      chase: null
    };

    // Erased → the system must not chase. Tombstone only.
    if (user.status === 'erased' || user.erased_tombstone) {
      out.erased = true;
      out.triggerLabel = 'erased — tombstone, never chase';
      return out;
    }

    var p = user.pointer || {};
    var tone = essenceTone(user.essence);
    var how = approach(user.method);
    var leftOff = p.current_chamber ? (p.current_chamber + (p.current_concept ? ' — ' + p.current_concept : '')) : 'where they last were';
    var nextStep = p.next_natural_step || 'the next small step';
    var lastContact = (user.chase && user.chase.last_contact_date) || p.last_touched;
    var gapDays = days(lastContact, todayISO);
    var gapAck = (gapDays != null && gapDays > 31)
      ? 'It has been ' + yearsAndMonths(lastContact, todayISO) + ' since we last spoke — no need to account for it.'
      : '';

    // Returned-from-silence → Return Ritual takes precedence over normal triggers.
    if (user.status === 'silenced' && user.returned) {
      out.fires = true;
      out.triggerIndex = 0;
      out.triggerLabel = 'return ritual — silenced reader has come back';
      out.isReturn = true;
      out.composed = {
        channel: 'web',
        channelLabel: 'Website · they are here now',
        tone: tone,
        approach: how,
        leftOff: leftOff,
        gapAck: yearsAndMonths(p.last_touched, todayISO),
        message:
          'It has been ' + yearsAndMonths(p.last_touched, todayISO) + '. You left off in the ' + (p.current_chamber || 'field') +
          (p.current_concept ? ', at ' + p.current_concept : '') + ' — it is exactly where you left it.\n\n' +
          'Your essence is preserved in our system permanently — even after you are gone, even a thousand years from now. If you ever want it erased, just say the word and it is gone.\n\n' +
          'When you are ready, we pick up from ' + lc(nextStep) + '.'
      };
      out.rungs = [{ n: '—', q: 'A reader marked silenced has returned.', why: 'Reactivate warmly; do not re-threshold. Acknowledge the gap, restate the permanence promise, resume from the pointer.', status: 'fire' }];
      return out;
    }

    // Build the four rungs, evaluated strictly in order.
    var fired = false;

    // 1 — left a chamber mid-way, no return for 2 weeks
    var r1 = { n: '1', q: 'Did they leave a chamber mid-way and not return for 2 weeks?', status: 'no', why: '' };
    var sinceTouch = days(p.last_touched, todayISO);
    if (!fired && p.chamber_status === 'mid' && sinceTouch != null && sinceTouch >= 14) {
      r1.status = 'fire';
      r1.why = 'Mid-way through ' + p.current_chamber + '; ' + sinceTouch + ' days since last touched. Trigger.';
      fired = true; out.fires = true; out.triggerIndex = 1; out.triggerLabel = 'left a chamber mid-way';
    } else {
      r1.why = p.chamber_status === 'mid'
        ? 'Mid-chamber, but only ' + sinceTouch + ' days — under the 2-week threshold.'
        : 'No chamber left mid-way (status: ' + (p.chamber_status || 'unknown') + ').';
    }
    out.rungs.push(r1);

    // 2 — transformation just verified, clear next step
    var r2 = { n: '2', q: 'Was a transformation just verified, opening a clear next step?', status: fired ? 'skip' : 'no', why: '' };
    var freshT = (user.transformations || []).filter(function (t) {
      var d = days(t.date, todayISO);
      return t.just_verified && d != null && d >= 0 && d <= 7;
    })[0];
    if (!fired) {
      if (freshT && p.next_natural_step) {
        r2.status = 'fire';
        r2.why = 'Transformation verified ' + days(freshT.date, todayISO) + ' day(s) ago (confidence ' + freshT.confidence + '); clear next step on the pointer. Trigger.';
        fired = true; out.fires = true; out.triggerIndex = 2; out.triggerLabel = 'transformation just verified';
        out._freshT = freshT;
      } else {
        r2.why = freshT ? 'Fresh transformation, but no clear next step on the pointer.' : 'No transformation verified in the last week.';
      }
    } else {
      r2.why = 'Not evaluated — an earlier trigger already fired.';
    }
    out.rungs.push(r2);

    // 3 — open question dormant 4+ weeks
    var r3 = { n: '3', q: 'Has an open question been dormant for 4+ weeks?', status: fired ? 'skip' : 'no', why: '' };
    var dormant = (user.open_questions || []).filter(function (q) {
      var d = days(q.last_touched || q.opened_date, todayISO);
      return q.status === 'open' && d != null && d >= 28;
    }).sort(function (a, b) {
      return days(b.last_touched || b.opened_date, todayISO) - days(a.last_touched || a.opened_date, todayISO);
    })[0];
    if (!fired) {
      if (dormant) {
        var wk = weeks(dormant.last_touched || dormant.opened_date, todayISO);
        r3.status = 'fire';
        r3.why = 'Open question dormant ' + wk + ' weeks. Trigger.';
        fired = true; out.fires = true; out.triggerIndex = 3; out.triggerLabel = 'open question dormant';
        out._dormant = dormant;
      } else {
        r3.why = 'No open question past the 4-week dormancy line.';
      }
    } else {
      r3.why = 'Not evaluated — an earlier trigger already fired.';
    }
    out.rungs.push(r3);

    // 4 — silent 2 weeks, no other trigger (heartbeat)
    var r4 = { n: '4', q: 'Silent for 2 weeks with no other trigger?', status: fired ? 'skip' : 'no', why: '' };
    if (!fired) {
      if (sinceTouch != null && sinceTouch >= 14) {
        r4.status = 'fire';
        r4.why = 'Silent ' + sinceTouch + ' days, nothing structural pending. Heartbeat — not a chase.';
        fired = true; out.fires = true; out.triggerIndex = 4; out.triggerLabel = 'silence — heartbeat'; out.isHeartbeat = true;
      } else {
        r4.why = sinceTouch != null ? 'Only ' + sinceTouch + ' days of silence — under the 2-week line. Hold.' : 'Active enough; hold silence.';
      }
    } else {
      r4.why = 'Not evaluated — an earlier trigger already fired.';
    }
    out.rungs.push(r4);

    if (!out.fires) {
      out.triggerLabel = 'no trigger today — the field stays silent';
      return out;
    }

    // Compose the message from the layers.
    var msg = '';
    var first = (user.name || '').split(' ')[0];
    switch (out.triggerIndex) {
      case 1:
        msg = first + ' — you stepped out of the ' + p.current_chamber + ' mid-way, at ' + lc(p.current_concept) + '. ' +
              'Nothing to make up for. When it is time, the next thing is small: ' + lc(nextStep) + '.';
        break;
      case 2:
        msg = first + ' — something shifted, and it is worth not letting it cool. ' +
              '“' + freshT.description.replace(/\.$/, '') + '.” ' +
              'While it is warm, the next move is clear: ' + lc(nextStep) + '.';
        break;
      case 3:
        var dq = out._dormant;
        var wk2 = weeks(dq.last_touched || dq.opened_date, todayISO);
        msg = first + ' — there is a question we left open and have not returned to:\n\n' +
              '“' + dq.question + '”\n\n' +
              'It has been sitting ' + wk2 + ' weeks. No rush — but it is still the live one.';
        break;
      case 4:
        msg = first + ' — no agenda here. Only a marker that the field is holding where you left off: ' +
              p.current_chamber + (p.current_concept ? ', ' + lc(p.current_concept) : '') + '. Come back when it is time.';
        break;
    }
    if (gapAck) msg += '\n\n' + gapAck;

    // chase: a fresh trigger opens a new chase at Day 0 (email).
    var existing = user.chase && user.chase.active;
    var chaseDay = existing ? (days(user.chase.last_contact_date, todayISO) || 0) : 0;
    var nowIdx = ladderStateForDay(chaseDay);

    out.composed = {
      channel: LADDER[nowIdx].channel,
      channelLabel: LADDER[nowIdx].label,
      tone: tone,
      approach: how,
      leftOff: leftOff,
      gapAck: gapAck,
      message: msg
    };
    out.chase = {
      currentDay: chaseDay,
      nowIndex: nowIdx,
      steps: LADDER.map(function (s, i) {
        return { day: s.day, channel: s.channel, label: s.label, state: i < nowIdx ? 'done' : (i === nowIdx ? 'now' : 'pending') };
      })
    };
    return out;
  }

  function lc(s) { return s ? s.charAt(0).toLowerCase() + s.slice(1) : s; }

  window.RM_ENGINE = {
    decideReachout: decideReachout,
    essenceTone: essenceTone,
    days: days,
    weeks: weeks,
    yearsAndMonths: yearsAndMonths,
    LADDER: LADDER
  };
})();

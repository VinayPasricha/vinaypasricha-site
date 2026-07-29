(function () {
  'use strict';
  var KEY = 'abl_participant_access_v1';

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); }
    catch (e) { return null; }
  }

  function token() {
    var value = read();
    return value && value.token ? value.token : '';
  }

  function headers(base) {
    var out = Object.assign({}, base || {});
    if (token()) out.Authorization = 'Bearer ' + token();
    return out;
  }

  function login() {
    var next = location.pathname + location.search;
    location.replace('/ai-business-leaders/login?next=' + encodeURIComponent(next));
  }

  function clear() {
    localStorage.removeItem(KEY);
  }

  window.AblAuth = { key: KEY, read: read, token: token, headers: headers, login: login, clear: clear };
}());

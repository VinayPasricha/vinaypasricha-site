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

  function isProtectedCourseRequest(input) {
    try {
      var raw = typeof input === 'string' ? input : (input && input.url) || '';
      var url = new URL(raw, location.origin);
      if (url.origin !== location.origin) return false;
      var path = url.pathname;
      if (path.indexOf('/api/abl/auth/') === 0) return false;
      if (path.indexOf('/api/abl/workspace/admin/') === 0) return false;
      return /^\/api\/abl\/(session|course|workspace)\//.test(path);
    } catch (e) {
      return false;
    }
  }

  // Older course pages use their own fetch helpers. Wrapping same-origin private
  // course requests here means every one of them now carries the verified token
  // without duplicating security code in each page.
  var nativeFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var options = Object.assign({}, init || {});
    var protectedRequest = isProtectedCourseRequest(input);
    if (protectedRequest) {
      var h = new Headers(options.headers || {});
      if (token()) h.set('Authorization', 'Bearer ' + token());
      options.headers = h;
    }
    return nativeFetch(input, options).then(function (response) {
      if (protectedRequest && response.status === 401) {
        clear();
        setTimeout(login, 0);
      }
      return response;
    });
  };

  window.AblAuth = { key: KEY, read: read, token: token, headers: headers, login: login, clear: clear };
}());

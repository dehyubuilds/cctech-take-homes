(function () {
  // Set via window.API_BASE, or ?api=https://xxx in URL. Never put API keys here.
  var params = new URLSearchParams(window.location.search);
  var API_BASE = window.API_BASE || params.get('api') || '';

  function setApiBase(url) {
    if (url) API_BASE = url.replace(/\/$/, '');
    updateApiHint();
  }

  function updateApiHint() {
    var el = document.getElementById('api-hint');
    if (!el) return;
    if (API_BASE) {
      el.textContent = 'API: ' + API_BASE;
      el.style.color = '';
    } else {
      el.textContent = 'API not set. Add ?api=http://localhost:8000 to the URL (or your server).';
      el.style.color = '#f59e0b';
    }
  }

  function request(method, path, body) {
    if (!API_BASE) {
      return Promise.reject(new Error('No API URL. Add ?api=http://localhost:8000 (or your server URL) to the address bar and ensure the March Madness backend is running.'));
    }
    var url = API_BASE + path;
    var opts = { method: method, headers: { 'Content-Type': 'application/json' } };
    if (body && (method === 'POST' || method === 'PUT')) opts.body = JSON.stringify(body);
    return fetch(url, opts).then(function (r) {
      return r.json().catch(function () { return { error: 'Invalid response' }; });
    });
  }

  function networkErrorMessage(url, err) {
    var msg = err && err.message;
    if (msg === 'Failed to fetch' || (msg && msg.indexOf('fetch') !== -1)) {
      return 'Cannot reach API at ' + url + '. Is the server running? Use ?api=http://localhost:8000 for local.';
    }
    return msg || 'Failed to load';
  }

  function renderPicks(data) {
    var el = document.getElementById('picks-content');
    if (data.error) {
      el.textContent = 'Error: ' + data.error;
      return;
    }
    if (data.message) {
      el.textContent = data.message;
      return;
    }
    el.textContent = data.pick_date ? 'No picks for ' + data.pick_date : 'No picks';
  }

  function renderNumbers(data) {
    var el = document.getElementById('numbers-content');
    if (data.error) {
      el.textContent = 'Error: ' + data.error;
      return;
    }
    var list = data.numbers || [];
    el.textContent = list.length ? list.join('\n') : 'No allowed numbers';
  }

  function loadTodayPicks() {
    var el = document.getElementById('picks-content');
    el.textContent = 'Loading…';
    request('GET', '/today-picks').then(renderPicks).catch(function (e) {
      el.textContent = 'Error: ' + networkErrorMessage(API_BASE + '/today-picks', e);
    });
  }

  function loadAllowedNumbers() {
    var el = document.getElementById('numbers-content');
    el.textContent = 'Loading…';
    request('GET', '/allowed-numbers').then(renderNumbers).catch(function (e) {
      el.textContent = 'Error: ' + networkErrorMessage(API_BASE + '/allowed-numbers', e);
    });
  }

  function setStatus(msg, isError) {
    var el = document.getElementById('action-status');
    el.textContent = msg;
    el.className = isError ? 'error' : 'success';
  }

  document.getElementById('refresh-picks').addEventListener('click', loadTodayPicks);
  document.getElementById('run-daily').addEventListener('click', function () {
    var btn = this;
    btn.disabled = true;
    setStatus('Running…', false);
    request('POST', '/run-daily-picks').then(function (data) {
      btn.disabled = false;
      if (data.error) {
        setStatus('Error: ' + data.error, true);
        return;
      }
      setStatus('Done. Sent: ' + (data.sent_count || 0) + ', stored: ' + (data.stored ? 'yes' : 'no'), false);
      loadTodayPicks();
    }).catch(function (e) {
      btn.disabled = false;
      setStatus('Error: ' + (e.message || 'Request failed'), true);
    });
  });
  document.getElementById('send-sample').addEventListener('click', function () {
    var btn = this;
    btn.disabled = true;
    setStatus('Sending sample to all subscribers…', false);
    request('POST', '/send-sample').then(function (data) {
      btn.disabled = false;
      if (data.error) {
        setStatus('Error: ' + data.error, true);
        return;
      }
      setStatus('Sample sent to ' + (data.sent_count || 0) + ' of ' + (data.numbers_count || 0) + ' subscribers.', false);
    }).catch(function (e) {
      btn.disabled = false;
      setStatus('Error: ' + (e.message || 'Request failed'), true);
    });
  });
  document.getElementById('send-test').addEventListener('click', function () {
    var phone = document.getElementById('test-phone').value.trim();
    if (!phone) {
      setStatus('Enter a phone number', true);
      return;
    }
    var btn = this;
    btn.disabled = true;
    setStatus('Sending…', false);
    request('POST', '/send-test', { phone_number: phone }).then(function (data) {
      btn.disabled = false;
      if (data.error) {
        setStatus('Error: ' + data.error, true);
        return;
      }
      setStatus('Test sent. SID: ' + (data.sid || 'ok'), false);
    }).catch(function (e) {
      btn.disabled = false;
      setStatus('Error: ' + (e.message || 'Request failed'), true);
    });
  });

  updateApiHint();
  loadTodayPicks();
  loadAllowedNumbers();
})();

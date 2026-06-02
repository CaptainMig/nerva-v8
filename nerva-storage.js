// nerva-storage.js — local-first decision log
// Loaded as a plain <script> before the React app.
// Uses Capacitor Preferences when running in a native container;
// falls back to localStorage on web.
// Nothing leaves the device unless the user explicitly opts into cloud sync
// via NervaSync (see nerva-sync-stub.js).

(function () {
  'use strict';

  var DECISIONS_KEY = 'nerva_decisions_v1';
  var CONSENT_KEY   = 'nerva_sync_consent_v1'; // 'granted' | 'denied' | null
  var MAX_ENTRIES   = 500;

  function capPrefs() {
    return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Preferences) || null;
  }

  async function storageGet(key) {
    var p = capPrefs();
    if (p) { var r = await p.get({ key: key }); return r.value; }
    return localStorage.getItem(key);
  }

  async function storageSet(key, value) {
    var p = capPrefs();
    if (p) { await p.set({ key: key, value: value }); }
    else    { localStorage.setItem(key, value); }
  }

  async function loadLog() {
    try {
      var raw = await storageGet(DECISIONS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.warn('[nerva-storage] loadLog error', e);
      return [];
    }
  }

  async function appendDecisionLog(entry) {
    try {
      var log = await loadLog();
      var id  = Date.now().toString(36) + Math.random().toString(36).slice(2);
      log.unshift(Object.assign({ id: id }, entry));
      if (log.length > MAX_ENTRIES) log.length = MAX_ENTRIES;
      await storageSet(DECISIONS_KEY, JSON.stringify(log));
    } catch (e) {
      console.warn('[nerva-storage] appendDecisionLog error', e);
    }
  }

  async function clearLog() {
    try { await storageSet(DECISIONS_KEY, '[]'); }
    catch (e) { console.warn('[nerva-storage] clearLog error', e); }
  }

  // Cloud-sync consent (stored in localStorage — intentionally not in Preferences
  // so the web and native surfaces share the same consent record)
  function getSyncConsent() {
    return localStorage.getItem(CONSENT_KEY); // 'granted' | 'denied' | null
  }

  function setSyncConsent(choice) {
    localStorage.setItem(CONSENT_KEY, choice);
    // If granted, trigger a sync of any pending log entries
    if (choice === 'granted' && window.NervaSync && window.NervaSync.SYNC_ENABLED) {
      loadLog().then(function(log) { window.NervaSync.syncDecisionLog(log); });
    }
  }

  window.NervaStorage = {
    loadLog: loadLog,
    appendDecisionLog: appendDecisionLog,
    clearLog: clearLog,
    getSyncConsent: getSyncConsent,
    setSyncConsent: setSyncConsent,
  };
})();

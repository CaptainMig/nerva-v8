// nerva-sync-stub.js — STUB: cloud sync backend (OFF, not wired)
//
// This module is intentionally inert. Replace it when you are ready to
// wire a live backend. Steps to activate:
//
//   1. Install: npm install @supabase/supabase-js
//   2. Set SUPABASE_URL and SUPABASE_ANON_KEY (env vars or build-time config)
//   3. Uncomment the real syncDecisionLog implementation below
//   4. Set SYNC_ENABLED = true
//   5. Ensure the user has granted sync consent (NervaStorage.getSyncConsent() === 'granted')
//
// Privacy contract:
//   • scenario text is STRIPPED before any transmission — see anonymize()
//   • only verdict + numeric values + timestamp are sent
//   • no device ID, no user ID unless auth is added

(function () {
  'use strict';

  var SYNC_ENABLED = false; // DO NOT flip without Supabase config + consent gate

  function anonymize(entry) {
    // Strip scenario text — never transmit user-typed content
    var safe = Object.assign({}, entry);
    delete safe.text;
    return safe;
  }

  async function syncDecisionLog(entries) {
    if (!SYNC_ENABLED) {
      console.log('[nerva-sync] STUB — sync disabled. Would sync', entries.length, 'entries.');
      return;
    }
    // TODO: Replace stub with real Supabase call:
    // var { createClient } = await import('@supabase/supabase-js');
    // var sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    // await sb.from('decision_logs').upsert(entries.map(anonymize));
  }

  window.NervaSync = {
    SYNC_ENABLED: SYNC_ENABLED,
    syncDecisionLog: syncDecisionLog,
  };
})();

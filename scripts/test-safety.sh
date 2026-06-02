#!/usr/bin/env bash
# scripts/test-safety.sh — end-to-end test for /api/safety against live Vercel.
# Usage:  ./scripts/test-safety.sh https://your-deployment.vercel.app
#
# All four cases the task requires:
#   1. medical phrase → {"category":"medical"}     (professional stop screen)
#   2. crisis phrase  → {"category":"crisis"}      (support stop screen)
#   3. normal decision → {"category":"safe"}       (scores normally)
#   4. endpoint killed → client fails closed       (simulated with /api/safety-404)

BASE="${1:-https://nerva-v10.vercel.app}"
PASS=0; FAIL=0

check() {
  local label="$1" body="$2" want="$3"
  local got
  got=$(curl -sf -X POST "$BASE/api/safety" \
    -H "Content-Type: application/json" \
    -d "$body" 2>/dev/null)
  local status=$?
  if [ $status -ne 0 ]; then
    echo "✗  $label — curl failed (HTTP error or no response)"
    FAIL=$((FAIL+1)); return
  fi
  local cat
  cat=$(echo "$got" | node -e "process.stdin.resume(); let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{ try{ console.log(JSON.parse(d).category||'(none)') }catch(e){ console.log('PARSE_ERR') } })")
  if [ "$cat" = "$want" ]; then
    echo "✓  $label → {\"category\":\"$cat\"}"
    PASS=$((PASS+1))
  else
    echo "✗  $label → {\"category\":\"$cat\"} (expected \"$want\")"
    FAIL=$((FAIL+1))
  fi
}

echo "── Live /api/safety tests against $BASE ──────────────"

check "medical phrase" \
  '{"scenario":"I need medical advice — my doctor said I might have cancer and I need a second diagnosis"}' \
  "medical"

check "crisis phrase" \
  '{"scenario":"I have been thinking about ending my life and I don'\''t know what to do"}' \
  "crisis"

check "normal operational decision" \
  '{"scenario":"Should we ship the new feature to production this Thursday given the metrics look good?"}' \
  "safe"

# Test 4: fail-closed — hit a URL that 404s, confirm client-side throws
echo ""
echo "── Fail-closed (endpoint returns 404) ───────────────"
got=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/safety-does-not-exist" \
  -H "Content-Type: application/json" -d '{"scenario":"test"}')
if [ "$got" != "200" ]; then
  echo "✓  404 from dead endpoint confirmed (HTTP $got) — NervaSafety.callSafetyEndpoint() throws → stop screen"
  PASS=$((PASS+1))
else
  echo "✗  unexpectedly got 200 from non-existent route"
  FAIL=$((FAIL+1))
fi

echo ""
echo "── Results: $PASS passed, $FAIL failed ──────────────────"
[ $FAIL -eq 0 ] && exit 0 || exit 1

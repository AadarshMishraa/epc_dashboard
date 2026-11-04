#!/usr/bin/env bash
# Exit 0 when "now" is inside the allowed production deploy window, 1 otherwise.
# Configure with repo variables (all optional):
#   DEPLOY_TZ             IANA zone the window is expressed in      (default Asia/Kolkata)
#   DEPLOY_DAYS           comma list of weekdays                    (default Mon,Tue,Wed,Thu)
#   DEPLOY_START_HOUR     first allowed hour, 0-23, inclusive       (default 10)
#   DEPLOY_END_HOUR       hour deploys must be finished by, exclusive (default 17)
#   DEPLOY_BLOCKED_DATES  comma list of YYYY-MM-DD in DEPLOY_TZ     (default none; festivals, customer peaks, audits)
# Test hook: DEPLOY_NOW="2026-11-02 11:00 UTC" overrides the clock.
set -euo pipefail

TZ_NAME="${DEPLOY_TZ:-Asia/Kolkata}"
DAYS="${DEPLOY_DAYS:-Mon,Tue,Wed,Thu}"
START="${DEPLOY_START_HOUR:-10}"
END="${DEPLOY_END_HOUR:-17}"
BLOCKED="${DEPLOY_BLOCKED_DATES:-}"
NOW="${DEPLOY_NOW:-now}"

dow="$(TZ="$TZ_NAME" date -d "$NOW" +%a)"
day="$(TZ="$TZ_NAME" date -d "$NOW" +%F)"
hour="$((10#$(TZ="$TZ_NAME" date -d "$NOW" +%H)))"

fail() { echo "Outside deploy window: $1 (now: $dow $day ${hour}h $TZ_NAME)"; exit 1; }

case ",$DAYS," in *",$dow,"*) ;; *) fail "$dow is not one of $DAYS" ;; esac
case ",$BLOCKED," in *",$day,"*) fail "$day is a blocked date" ;; esac
if [ "$hour" -lt "$START" ] || [ "$hour" -ge "$END" ]; then fail "allowed hours are ${START}:00-${END}:00"; fi

echo "Inside deploy window: $dow $day ${hour}h $TZ_NAME"

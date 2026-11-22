#!/usr/bin/env bash
API=${API:-https://yinko.vercel.app}
run() { printf "%-22s" "$1"; curl -s -m 30 -X POST $API/check -H 'content-type: application/json' -d "$2" | grep -o '"verdict":"[a-z]*"'; }
SP=0xabababababababababababababababababababab
CD="0x095ea7b3000000000000000000000000${SP:2}$(printf 'f%.0s' {1..64})"
run "poisoned address" '{"from":"0x9444a989DB863d256de4F5395f9b10CBE425Ad1D","to":"0xA1b2000000000000000000000000000000005678","kind":"transfer","knownAddresses":["0xA1b2c3d4e5f60718293a4b5c6d7e8f9012345678"]}'
run "unlimited approval" "{\"from\":\"0x9444a989DB863d256de4F5395f9b10CBE425Ad1D\",\"to\":\"$SP\",\"kind\":\"approval\",\"calldata\":\"$CD\"}"
run "fake agent name" '{"from":"0x9444a989DB863d256de4F5395f9b10CBE425Ad1D","to":"0x5555555555555555555555555555555555555555","kind":"transfer","agentName":"y1nko"}'
run "verified agent" '{"from":"0x1111111111111111111111111111111111111111","to":"0xd21f31b9cdfd1a943fd990022d0e87006543d6b2","kind":"transfer","agentName":"yinko","knownAddresses":["0xd21f31b9cdfd1a943fd990022d0e87006543d6b2"]}'
printf "%-22s" "health"; curl -s $API/health; echo

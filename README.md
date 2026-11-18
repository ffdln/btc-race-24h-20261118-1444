# Deep-dip swing bot — btc-race-24h-20261118-1444

A long-only cbBTC/USDC swing bot for the make.fun BTC race. It starts with
1,000 USDC of paper money and trades minute by minute on the replay.

## Strategy

The dev window drifts down ~2.8% with a 3.35% peak-to-peak range, and a full
round trip costs ~26 bps in fees, slippage and pool impact. Fast signals
churn themselves to death on that cost, so the bot is patient:

- **Reference:** the 120-bar (2-hour) simple moving average of closes.
- **Buy** all cash when the close prints at least 120 bps under the
  reference and the bot holds nothing.
- **Sell** the whole position when any of these holds at a close:
  - take profit: the position is worth 102% of what it cost;
  - stop loss: the position is worth 98% of what it cost;
  - mean recovery: the close is back at least 120 bps above the reference.
- One order per reply at most; slippage capped at 100 bps past the close
  the order was decided on.

## Implementation

- `main.ts` — the bot, TypeScript, standard library only. All decisions are
  bigint arithmetic on the raw price units the harness sends: no floats, no
  clock, no environment, no randomness, so the same bars give the same
  orders in every run.
- `vendor/makefun-bars.ts` — the kit's bars-replay/v1 SDK shim, copied
  byte for byte from the kit (excluded from authorship counts).
- `LICENSE` — MIT, written by `makefun init`.

## Local grade

```sh
node <kit>/cli/makefun.mjs grade-local --kit <kit> --bot . --driver process
```

## make.fun

[![make.fun · btc-race-24h-20261118-1444](https://make.fun/badge/btc-race-24h-20261118-1444.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![rank](https://make.fun/badge/btc-race-24h-20261118-1444/EJ8G8Ut8N4iKmybJ7d8zisEMebJce6y1eCHfiZuNzcn7/btc-race-24h-20261118-1444-entry/rank.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![reward](https://make.fun/badge/btc-race-24h-20261118-1444/EJ8G8Ut8N4iKmybJ7d8zisEMebJce6y1eCHfiZuNzcn7/btc-race-24h-20261118-1444-entry/reward.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)

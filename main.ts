// Deep-dip swing bot for cbBTC/USDC on the btc-race-24h-20261118-1444 dev window.
// Long only, one position at a time, all-in / all-out.
//
// What the dev window (1,440 one-minute bars) actually does: it drifts DOWN
// about 2.8% end to end, with a 3.35% peak-to-peak range and only a handful
// of real swings. Fast signals churn themselves to death on the ~26 bps
// round-trip cost (4 bps fee + pool fee + 2 bps slippage + pool impact), so
// this bot waits for a genuine capitulation dip and banks a real swing:
//
//   - Reference: the simple moving average of the last 120 closes (2 hours).
//     A slow reference keeps the bot from chasing every 1-minute wobble.
//   - Buy, all cash, when the close prints at least 120 bps under that
//     reference and the bot holds nothing. 120 bps is deep enough that the
//     dip is a real pullback in this window, not noise.
//   - Sell the whole position when any of these holds at a close:
//       * take profit: the position is worth 102% of what it cost;
//       * stop loss: the position is worth 98% of what it cost;
//       * mean recovery: the close is back at least 120 bps above the
//         reference, so the dip has fully reversed.
//     The stop caps the damage of a dip that keeps falling; the take profit
//     banks a swing before it rolls over.
//   - One order per reply at most, slippage capped at 100 bps (1%) past the
//     close the order was decided on, so a fill into a gap is refused and
//     the signal is simply re-read on the next bar.
//
// Everything is bigint arithmetic on the raw price units the harness sends,
// so the same bars give the same orders in every run: no floats, no clock,
// no environment, no randomness. Warm-up bars (if any) seed the reference
// but never trade; a batch with no CBBTC bar adds nothing to the history.

import { runBars, type BarsState, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
/** The reference looks back two hours of one-minute closes. */
const REF_BARS = 120;
/** A dip (or a recovery) must clear this many bps from the reference. */
const BAND_BPS = 120n;
/** Take profit: worth 1025/1000 of cost. Stop loss: worth 980/1000 of cost. */
const TAKE_NUM = 1025n;
const STOP_NUM = 980n;
const RATIO_DEN = 1000n;
/** bps in a unit, for the band comparisons. */
const BPS = 10000n;
/** Slippage cap on every order, past the close it was decided on. */
const MAX_SLIP_BPS = 100;

/** The closes seen so far, oldest first, raw price units (price_scale 5). */
const history: bigint[] = [];
/** Rolling sum of the last REF_BARS closes, so the reference is O(1). */
let windowSum = 0n;

/** The reference (120-bar SMA) of closes, or null before there are that many. */
function reference(): bigint | null {
  if (history.length < REF_BARS) return null;
  return windowSum / BigInt(REF_BARS);
}

/**
 * Why a held position exits on this close, or null to keep holding.
 * Take profit first, then stop loss, then mean recovery: the ratio exits
 * are the sharper of the three, the recovery exit is the patient one.
 */
function exitReason(state: BarsState, ref: bigint, close: bigint): 'take' | 'stop' | 'recovery' | null {
  const held = state.positions.get(SYMBOL);
  if (held === undefined) return null;
  const worth = state.value(SYMBOL, held.qty);
  if (worth * RATIO_DEN >= held.cost * TAKE_NUM) return 'take';
  if (worth * RATIO_DEN <= held.cost * STOP_NUM) return 'stop';
  if (close * BPS > ref * (BPS + BAND_BPS)) return 'recovery';
  return null;
}

await runBars({
  onBatch(state: BarsState, batch) {
    for (const bar of batch.bars) {
      if (bar.symbol !== SYMBOL) continue;
      const c = BigInt(bar.c);
      history.push(c);
      windowSum += c;
      if (history.length > REF_BARS) windowSum -= history[history.length - REF_BARS - 1]!;
    }
    if (state.warmingUp) return [];
    const ref = reference();
    if (ref === null) return [];
    const close = state.close(SYMBOL);
    if (close === null) return [];

    const held = state.positions.get(SYMBOL);
    if (held !== undefined) {
      const why = exitReason(state, ref, close);
      if (why === null) return [];
      const sell: SellInput = {
        side: 'sell',
        symbol: SYMBOL,
        qty: held.qty,
        max_slippage_bps: MAX_SLIP_BPS,
      };
      return [sell];
    }

    // Flat: buy the dip, all cash, when the close clears the band below ref.
    if (close * BPS < ref * (BPS - BAND_BPS)) {
      const room = state.weightRoom(SYMBOL);
      const spend = state.cash < room ? state.cash : room;
      if (spend <= 0n) return [];
      const buy: BuyInput = {
        side: 'buy',
        symbol: SYMBOL,
        notional_quote_units: spend,
        max_slippage_bps: MAX_SLIP_BPS,
      };
      return [buy];
    }
    return [];
  },
});

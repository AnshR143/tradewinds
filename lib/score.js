const LINK_STRENGTH = { strong: 70, likely: 50, guess: 25 };
const LINK_WORDS = { strong: 'a direct effect', likely: 'one step removed', guess: 'two or more steps removed' };

export function eventStrength(event) {
  if (event.kind === 'storm' && event.windMph) {
    const wind = event.windMph >= 111 ? 1.3 : event.windMph >= 74 ? 1.15 : event.windMph >= 39 ? 0.9 : 0.6;
    return event.near?.length ? wind + 0.1 : wind;
  }
  if (event.kind === 'weather') return event.count >= 10 ? 1.1 : event.count >= 3 ? 0.95 : 0.8;
  if (event.kind === 'commodity') return Math.min(1.4, Math.max(1, Math.abs(event.monthPct) / 5));
  return 1;
}

const round2 = (n) => Math.round(n * 100) / 100;

export function scoreSignal({ direction, confidence, events = 0, strength = 1, price, analysts }) {
  const bullish = direction === 'tailwind';
  const factors = [];

  const base = LINK_STRENGTH[confidence] || LINK_STRENGTH.guess;
  factors.push({ name: 'Link strength', value: base, why: `The impact map rates this link as ${LINK_WORDS[confidence] || LINK_WORDS.guess}.` });

  factors.push({
    name: 'Event strength',
    value: round2(strength),
    why: strength !== 1 ? 'Based on the size of the live event, such as wind speed or the size of the price move.' : 'No size is measured for this one, so it counts as typical.',
  });

  const breadth = events >= 3 ? 1.2 : events === 2 ? 1.1 : 1;
  factors.push({ name: 'Supporting events', value: breadth, why: `${events || 'No'} live ${events === 1 ? 'event points' : 'events point'} the same way.` });

  let room = 1;
  let roomWhy = 'No price data, so nothing is taken off.';
  if (price?.status === 'ok') {
    const movedWith = bullish ? price.weekPct : -price.weekPct;
    room = movedWith > 0 ? Math.max(0.5, 1 - movedWith / 10) : 1;
    roomWhy = movedWith > 0
      ? `The price already moved ${movedWith.toFixed(1)}% this way this week, so part of it is in the price.`
      : 'The price has not moved this way this week, so nothing is taken off.';
  }
  factors.push({ name: 'Room left', value: round2(room), why: roomWhy });

  let analystFactor = 1;
  let analystWhy = 'No analyst ratings for this company on our plan.';
  if (analysts) {
    const buyShare = analysts.buy / (analysts.buy + analysts.hold + analysts.sell);
    const agrees = bullish ? buyShare >= 0.6 : buyShare < 0.4;
    const disagrees = bullish ? buyShare < 0.4 : buyShare >= 0.6;
    analystFactor = agrees ? 1.1 : disagrees ? 0.9 : 1;
    analystWhy = `${Math.round(buyShare * 100)}% of analysts say buy, which ${agrees ? 'agrees with' : disagrees ? 'goes against' : 'neither backs nor opposes'} this signal.`;
  }
  factors.push({ name: 'Analysts', value: analystFactor, why: analystWhy });

  const size = Math.min(100, Math.round(factors.reduce((product, f) => product * f.value, 1)));
  return {
    value: bullish ? size : -size,
    band: size >= 60 ? 'Strong' : size >= 35 ? 'Medium' : 'Weak',
    factors,
  };
}

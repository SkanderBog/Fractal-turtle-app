export const ACTIONS = {
  F: 'Forward', L: 'Turn left', R: 'Turn right',
  LF: 'Left + forward', RF: 'Right + forward', N: 'Do nothing',
};
export const DEFAULTS = Object.freeze({
  base: 2, start: 0, stride: 1, count: 16384, sequence: 'integers',
  metric: 'sum', digit: 1, modulus: 2, angle: 60, actions: ['F', 'L'],
  initialHeading: 0, stepLength: 1, ruleAngles: null, ruleSteps: null,
});
export function numberAt(index, c) {
  const n = c.start + index * c.stride;
  if (c.sequence === 'squares') return n * n;
  if (c.sequence === 'triangular') return n % 2 === 0 ? (n / 2) * (n + 1) : n * ((n + 1) / 2);
  return n;
}
export function validateConfig(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || ![Object.prototype,null].includes(Object.getPrototypeOf(input))) throw new Error('Settings must be a plain object.');
  if (Object.keys(input).some(key => !Object.hasOwn(DEFAULTS,key))) throw new Error('Unknown experiment setting.');
  const c = { ...DEFAULTS, ...input };
  for (const [key, min, max] of [['base',2,36],['start',0,Number.MAX_SAFE_INTEGER],['stride',1,1000000],['count',1,1000000],['modulus',2,8],['digit',0,35]]) {
    if (!Number.isSafeInteger(c[key]) || c[key] < min || c[key] > max) throw new Error(`${key} must be a whole number from ${min.toLocaleString()} to ${max.toLocaleString()}.`);
  }
  if (!['integers','squares','triangular'].includes(c.sequence)) throw new Error('Choose a supported number sequence.');
  if (!['sum','last','nonzero','count'].includes(c.metric)) throw new Error('Choose a supported digit rule.');
  if (!Number.isFinite(c.angle) || c.angle < 0 || c.angle > 360) throw new Error('Turn angle must be between 0° and 360°.');
  if (c.metric === 'count' && c.digit >= c.base) throw new Error('The counted digit must be smaller than the base.');
  if (!Array.isArray(c.actions) || c.actions.length !== c.modulus || Array.from(c.actions).some(a => typeof a !== 'string' || !Object.hasOwn(ACTIONS,a))) throw new Error('Choose one action for every remainder.');
  c.actions = [...c.actions];
  for (const [key,min,max] of [['initialHeading',0,360],['stepLength',0.01,1000]]) {
    if (!Number.isFinite(c[key]) || c[key] < min || c[key] > max) throw new Error(`${key === 'initialHeading' ? 'Starting direction' : 'Step length'} must be from ${min} to ${max}.`);
  }
  for (const [key,max] of [['ruleAngles',360],['ruleSteps',1000]]) {
    if (c[key] === null) c[key] = Array(c.modulus).fill(null);
    if (!Array.isArray(c[key]) || c[key].length !== c.modulus || Array.from(c[key]).some(value => value !== null && (!Number.isFinite(value) || value < 0 || value > max))) throw new Error(`${key === 'ruleAngles' ? 'Rule angles' : 'Rule distances'} must match the remainders and be from 0 to ${max}, or blank for the default.`);
    c[key] = [...c[key]];
  }
  if (!Number.isSafeInteger(c.start + (c.count - 1) * c.stride) || !Number.isSafeInteger(numberAt(c.count - 1,c))) throw new Error('This sequence exceeds exact integer precision. Reduce its start, interval, or length.');
  return c;
}
export function digitValue(n, base, metric = 'sum', digit = 1) {
  if (metric === 'last') return n % base;
  let value = 0;
  do {
    const d = n % base;
    value += metric === 'count' ? Number(d === digit) : metric === 'nonzero' ? Number(d !== 0) : d;
    n = Math.floor(n / base);
  } while (n > 0);
  return value;
}
export function describeStep(index, c) {
  const n = numberAt(index,c), value = digitValue(n,c.base,c.metric,c.digit), remainder = value % c.modulus;
  return {index, n, digits:n.toString(c.base).toUpperCase(),value,remainder,action:c.actions[remainder]};
}
export function generatePath(input) {
  const c = validateConfig(input);
  const points = new Float64Array((c.count + 1) * 2);
  const steps = new Uint32Array(c.count);
  const headings = new Float64Array(c.count + 1);
  const moved = new Uint32Array(c.count + 1);
  const turnPrefix = new Uint32Array(c.count + 1);
  const remainders = new Uint8Array(c.count);
  let x = 0, y = 0, heading = c.initialHeading % 360, segments = 0, turns = 0;
  headings[0] = heading;
  let minX = 0, maxX = 0, minY = 0, maxY = 0;
  for (let i = 0; i < c.count; i++) {
    const remainder = digitValue(numberAt(i,c),c.base,c.metric,c.digit) % c.modulus;
    const action = c.actions[remainder];
    const angle = c.ruleAngles[remainder] ?? c.angle;
    const distance = c.ruleSteps[remainder] ?? c.stepLength;
    if (action.includes('L') || action.includes('R')) {
      heading = ((heading + (action.includes('L') ? angle : -angle)) % 360 + 360) % 360;
      turns++;
    }
    if (action.includes('F')) {
      x += distance * Math.cos(heading * Math.PI / 180);
      y += distance * Math.sin(heading * Math.PI / 180);
      segments++;
      points[segments * 2] = x;
      points[segments * 2 + 1] = y;
      steps[segments - 1] = i;
      remainders[segments - 1] = remainder;
      minX = Math.min(minX,x); maxX = Math.max(maxX,x);
      minY = Math.min(minY,y); maxY = Math.max(maxY,y);
    }
    headings[i + 1] = heading;
    moved[i + 1] = segments;
    turnPrefix[i + 1] = turns;
  }
  return {points:points.slice(0,(segments+1)*2),steps:steps.slice(0,segments),remainders:remainders.slice(0,segments),headings,moved,turnPrefix,segments,turns,bounds:{minX,maxX,minY,maxY},count:c.count};
}
export function fitBounds(bounds, width, height, padding = 60) {
  const spanX = bounds.maxX - bounds.minX, spanY = bounds.maxY - bounds.minY;
  return {x:(bounds.minX+bounds.maxX)/2,y:(bounds.minY+bounds.maxY)/2,
    scale:Math.max(1e-9,Math.min(Math.max(1,width-2*padding)/Math.max(spanX,1),Math.max(1,height-2*padding)/Math.max(spanY,1)))};
}

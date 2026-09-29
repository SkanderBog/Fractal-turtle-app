// Exact triangular-lattice geometry. The number clock is supplied by core.mjs.
export const DIRECTIONS = Object.freeze([[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]].map(Object.freeze));
export const MAX_SEED_EDGES = 512;
export function canonicalEdge(q,r,d) {
  if (![q,r,d].every(Number.isSafeInteger) || Math.abs(q)>100000 || Math.abs(r)>100000 || d<0 || d>5) throw new Error('Each initial edge needs integer q, r (−100,000 to 100,000), and direction 0–5.');
  if (d>=3) { q+=DIRECTIONS[d][0];r+=DIRECTIONS[d][1];d-=3; }
  if (Math.abs(q)>100000 || Math.abs(r)>100000 || Math.abs(q+DIRECTIONS[d][0])>100000 || Math.abs(r+DIRECTIONS[d][1])>100000) throw new Error('Initial edge is outside the coordinate limit.');
  return [q,r,d];
}
export function validateEdges(input) {
  if (!Array.isArray(input) || input.length>MAX_SEED_EDGES) throw new Error(`Use at most ${MAX_SEED_EDGES} initial edges.`);
  const edges=new Map();
  for (const e of input) {
    if (!Array.isArray(e) || e.length!==3) throw new Error('An initial edge must be [q, r, direction].');
    const value=canonicalEdge(...e);edges.set(value.join(','),value);
  }
  return [...edges.values()].sort((a,b)=>a[0]-b[0]||a[1]-b[1]||a[2]-b[2]);
}
export function randomEdges(seed,radius,count) {
  if (!Number.isSafeInteger(seed)||seed<0||seed>4294967295||!Number.isInteger(radius)||radius<1||radius>20||!Number.isInteger(count)||count<0||count>MAX_SEED_EDGES) throw new Error('Use a random seed from 0 to 4,294,967,295, radius 1–20, and 0–512 edges.');
  const candidates=[];
  const inside=(q,r)=>Math.max(Math.abs(q),Math.abs(r),Math.abs(q+r))<=radius;
  for(let q=-radius;q<=radius;q++)for(let r=-radius;r<=radius;r++)if(inside(q,r))for(let d=0;d<3;d++)if(inside(q+DIRECTIONS[d][0],r+DIRECTIONS[d][1]))candidates.push([q,r,d]);
  if(count>candidates.length)throw new Error(`This radius contains only ${candidates.length} edges. Increase the radius or reduce the count.`);
  // A defined 32-bit LCG and partial Fisher–Yates shuffle; exact edges are saved.
  let state=seed>>>0;
  for(let i=0;i<count;i++){state=(Math.imul(state,1664525)+1013904223)>>>0;const j=i+Math.floor(state/4294967296*(candidates.length-i));[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}
  return validateEdges(candidates.slice(0,count));
}
export function nearestEdge(x,y,tolerance) {
  const r0=Math.round(y/(Math.sqrt(3)/2)),q0=Math.round(x-r0/2);let best=null,distance=tolerance;
  for(let q=q0-2;q<=q0+2;q++)for(let r=r0-2;r<=r0+2;r++)for(let d=0;d<3;d++){
    const [dq,dr]=DIRECTIONS[d],ax=q+r/2,ay=r*Math.sqrt(3)/2,dx=dq+dr/2,dy=dr*Math.sqrt(3)/2;
    const t=Math.max(0,Math.min(1,(x-ax)*dx+(y-ay)*dy)),gap=Math.hypot(x-ax-t*dx,y-ay-t*dy);
    if(gap<distance){distance=gap;best=[q,r,d];}
  }
  return best;
}
export function generateEdgePath(c,remainderAt) {
  const points=new Float64Array((c.count+1)*2),steps=new Uint32Array(c.count),remainders=new Uint8Array(c.count);
  const headings=new Float64Array(c.count+1),moved=new Uint32Array(c.count+1),turnPrefix=new Uint32Array(c.count+1);
  const outcomes=new Uint8Array(c.count),searches=new Uint8Array(c.count),blockedPrefix=new Uint32Array(c.count+1),uniquePrefix=new Uint32Array(c.count+1),incidentMasks=new Uint8Array(c.count+1);
  const field=new Map(),seen=new Set(['0,0']);
  const mask=(q,r)=>field.get(`${q},${r}`)||0;
  const mark=(q,r,d)=>{const [dq,dr]=DIRECTIONS[d],key=`${q},${r}`,other=`${q+dq},${r+dr}`;field.set(key,mask(q,r)|(1<<d));field.set(other,mask(q+dq,r+dr)|(1<<((d+3)%6)));};
  for(const edge of c.seedEdges)mark(...edge);
  let q=0,r=0,h=c.initialHeading/60%6,n=0,segments=0,turns=0,blocked=0,searchTurns=0;
  let minX=0,maxX=0,minY=0,maxY=0;
  // A sufficient invariant certificate, independent of the number clock:
  // all turn increments preserve the heading's additive subgroup modulo six.
  const gcd=(a,b)=>b?gcd(b,a%b):a;
  let headingDivisor=6,hasForward=false,stationaryCertificate=null;
  for(let i=0;i<c.modulus;i++){
    hasForward ||= c.actions[i].includes('F');
    if(c.actions[i].includes('L')||c.actions[i].includes('R'))headingDivisor=gcd(headingDivisor,(c.ruleAngles[i]??c.angle)/60);
  }
  const certify=term=>{
    if(stationaryCertificate||mask(q,r)===63)return;
    if(!hasForward){stationaryCertificate={fromTerm:term,reason:'no-forward-action',directions:[]};return;}
    if(c.blocked!=='stay')return;
    const directions=[];for(let d=0;d<6;d+=headingDivisor)directions.push((h+d)%6);
    if(directions.every(d=>mask(q,r)&(1<<d)))stationaryCertificate={fromTerm:term,reason:'heading-orbit-blocked',directions};
  };
  headings[0]=h*60;uniquePrefix[0]=1;incidentMasks[0]=mask(0,0);certify(0);
  for(;n<c.count&&mask(q,r)!==63;n++){
    const remainder=remainderAt(n),a=c.actions[remainder];
    if(a.includes('L')||a.includes('R')){h=(h+(a.includes('L')?1:-1)*(c.ruleAngles[remainder]??c.angle)/60+6)%6;turns++;}
    let outcome=a==='N'?4:3;
    if(a.includes('F')){
      if(mask(q,r)&(1<<h)){
        blocked++;
        if(c.blocked==='turn')while(mask(q,r)&(1<<h)){h=(h+1)%6;searches[n]++;searchTurns++;turns++;}
        else outcome=2;
      }
      if(outcome!==2){mark(q,r,h);q+=DIRECTIONS[h][0];r+=DIRECTIONS[h][1];seen.add(`${q},${r}`);segments++;
        const x=q+r/2,y=r*Math.sqrt(3)/2;points[segments*2]=x;points[segments*2+1]=y;steps[segments-1]=n;remainders[segments-1]=remainder;
        minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);outcome=1;
      }
    }
    outcomes[n]=outcome;headings[n+1]=h*60;moved[n+1]=segments;turnPrefix[n+1]=turns;blockedPrefix[n+1]=blocked;uniquePrefix[n+1]=seen.size;incidentMasks[n+1]=mask(q,r);certify(n+1);
  }
  return {points:points.slice(0,(segments+1)*2),steps:steps.slice(0,segments),remainders:remainders.slice(0,segments),headings:headings.slice(0,n+1),moved:moved.slice(0,n+1),turnPrefix:turnPrefix.slice(0,n+1),outcomes:outcomes.slice(0,n),searches:searches.slice(0,n),blockedPrefix:blockedPrefix.slice(0,n+1),uniquePrefix:uniquePrefix.slice(0,n+1),incidentMasks:incidentMasks.slice(0,n+1),segments,turns,blocked,searchTurns,stationaryCertificate,unique:seen.size,bounds:{minX,maxX,minY,maxY},count:n,requestedCount:c.count,stopReason:mask(q,r)===63?'trap':'cutoff',end:{q,r,heading:h}};
}
export function cageEdges(radius) {
  if(!Number.isInteger(radius)||radius<1||radius>20)throw new Error('Use a cage radius from 1 to 20.');
  const inside=(q,r)=>Math.max(Math.abs(q),Math.abs(r),Math.abs(q+r))<=radius,edges=[];
  for(let q=-radius;q<=radius;q++)for(let r=-radius;r<=radius;r++)if(inside(q,r))for(let d=0;d<6;d++)if(!inside(q+DIRECTIONS[d][0],r+DIRECTIONS[d][1]))edges.push(canonicalEdge(q,r,d));
  return validateEdges(edges);
}
export function trapCandidates(edges) {
  const odd=new Set();
  for(const [q,r,d] of validateEdges(edges))for(const [x,y] of [[q,r],[q+DIRECTIONS[d][0],r+DIRECTIONS[d][1]]]){const key=`${x},${y}`;if(odd.has(key))odd.delete(key);else odd.add(key);}
  if(odd.has('0,0'))odd.delete('0,0');else odd.add('0,0');
  return [...odd].map(key=>key.split(',').map(Number));
}

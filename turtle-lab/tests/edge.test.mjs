import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS,generatePath,validateConfig,describeStep} from '../dist/core.mjs';
import {DIRECTIONS as D,validateEdges,canonicalEdge,randomEdges,cageEdges,trapCandidates,nearestEdge} from '../dist/edge.mjs';
import {APPEARANCE,parseSetup,serializeSetup} from '../dist/setup.mjs';
function ref(input){
 const c=validateConfig(input),edges=new Set(),seen=new Set(['0,0']),key=(q,r,d)=>[[q,r],[q+D[d][0],r+D[d][1]]].map(p=>p.join(',')).sort().join(';');
 for(const e of c.seedEdges)edges.add(key(...e));
 let q=0,r=0,h=c.initialHeading/60%6,n=0,m=0,t=0,b=0,search=0;const positions=[[0,0]],heads=[h*60],outcomes=[],counts=[0];
 for(;n<c.count;n++){
  if(D.every((_,d)=>edges.has(key(q,r,d))))break;
  const z=describeStep(n,c),a=z.action,angle=(c.ruleAngles[z.remainder]??c.angle)/60;
  if(a==='L'||a==='LF'){h=(h+angle)%6;t++;}if(a==='R'||a==='RF'){h=(h-angle+6)%6;t++;}
  let out=a==='N'?4:3;
  if(a.includes('F')){
   if(edges.has(key(q,r,h))){b++;if(c.blocked==='stay')out=2;else while(edges.has(key(q,r,h))){h=(h+1)%6;t++;search++;}}
   if(out!==2){edges.add(key(q,r,h));q+=D[h][0];r+=D[h][1];m++;positions.push([q+r/2,r*Math.sqrt(3)/2]);seen.add(`${q},${r}`);out=1;}
  }
  heads.push(h*60);outcomes.push(out);counts.push(m);
 }
 return {n,m,t,b,search,positions,heads,outcomes,counts,unique:seen.size,reason:D.every((_,d)=>edges.has(key(q,r,d)))?'trap':'cutoff'};
}
test('edge engine: 160 independent endpoint-set comparisons, early traps and both policies',()=>{
 let state=418;const rand=n=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state%n;};
 for(let i=0;i<160;i++){
  const modulus=2+rand(7),actions=Array.from({length:modulus},()=>['F','L','R','LF','RF','N'][rand(6)]);
  const c={...DEFAULTS,geometry:'edge',blocked:i%2?'stay':'turn',count:512+rand(1024),modulus,actions,angle:60*rand(7),initialHeading:60*rand(6),base:2+rand(7),sequence:['integers','squares','triangular'][rand(3)],seedEdges:randomEdges(i,3,rand(15))};
  const a=generatePath(c),b=ref(c);
  assert.deepEqual([a.count,a.segments,a.turns,a.blocked,a.searchTurns,a.unique,a.stopReason],[b.n,b.m,b.t,b.b,b.search,b.unique,b.reason]);
  assert.deepEqual([...a.points],b.positions.flat());assert.deepEqual([...a.headings],b.heads);assert.deepEqual([...a.outcomes],b.outcomes);assert.deepEqual([...a.moved],b.counts);
 }
});
test('initial trap consumes no instructions and retains valid replay arrays',()=>{
 const p=generatePath({...DEFAULTS,geometry:'edge',seedEdges:D.map((_,d)=>[0,0,d])});
 assert.equal(p.count,0);assert.equal(p.stopReason,'trap');assert.deepEqual([...p.moved],[0]);assert.deepEqual([...p.points],[0,0]);assert.equal(p.incidentMasks[0],63);
});
test('invariant-certified motion lock remains distinct from a six-edge trap',()=>{
 const p=generatePath({...DEFAULTS,geometry:'edge',angle:120,count:4096,seedEdges:[0,2,4].map(d=>[0,0,d])});
 assert.equal(p.stopReason,'cutoff');assert.equal(p.segments,0);assert.equal(p.unique,1);assert.equal(p.blocked,2048);assert.equal(p.stationaryCertificate.fromTerm,0);assert.deepEqual(p.stationaryCertificate.directions,[0,2,4]);assert(p.outcomes.includes(2));assert(!p.outcomes.includes(1));
});
test('reverse-edge identity and trap on the exact requested limit',()=>{
 const p=generatePath({...DEFAULTS,geometry:'edge',blocked:'turn',count:79});assert.equal(p.stopReason,'trap');assert.equal(p.count,79);assert.equal(p.segments,40);assert.equal(p.incidentMasks[79],63);
 const a=generatePath({...DEFAULTS,geometry:'edge',blocked:'turn',seedEdges:[[0,0,0]],count:10});
 const b=generatePath({...DEFAULTS,geometry:'edge',blocked:'turn',seedEdges:[[1,0,3]],count:10});assert.deepEqual(a,b);assert.equal(a.searches[0],1);
});
test('lattice restrictions apply only to edge mode',()=>{
 for(const patch of [{angle:61},{initialHeading:30},{stepLength:2},{ruleSteps:[0,null]},{ruleAngles:[null,90]},{seedEdges:[[0,0,6]]},{seedEdges:[[0.5,0,0]]},{seedEdges:[[0,0,'0']]},{seedEdges:Array(513).fill([0,0,0])}])assert.throws(()=>validateConfig({...DEFAULTS,geometry:'edge',...patch}));
 assert.doesNotThrow(()=>generatePath({...DEFAULTS,angle:61,initialHeading:30,stepLength:2,ruleSteps:[0,null],count:100}));
});
test('seed copies, v2 round-trip, v1 migration and the largest setup import',()=>{
 assert.deepEqual(validateEdges([[1,0,3],[0,0,0]]),[[0,0,0]]);
 const seeds=[[0,0,0]],c=validateConfig({...DEFAULTS,geometry:'edge',seedEdges:seeds});seeds[0][0]=9;assert.equal(c.seedEdges[0][0],0);
 const setup=parseSetup(serializeSetup(c,{...APPEARANCE,trapSites:true},'Edges'));assert.equal(setup.version,2);assert.deepEqual(setup.config,c);
 const legacy={...DEFAULTS};delete legacy.geometry;delete legacy.blocked;delete legacy.seedEdges;
 const old=parseSetup(JSON.stringify({version:1,name:'Legacy',config:legacy,appearance:{}}));assert.equal(old.config.geometry,'free');assert.deepEqual(generatePath(old.config),generatePath(DEFAULTS));
 const largest=serializeSetup({...c,seedEdges:randomEdges(4,20,512)},APPEARANCE,'Maximum seeds');assert(new TextEncoder().encode(largest).length<65536);assert.equal(parseSetup(largest).config.seedEdges.length,512);
});
test('random marks, cages, trap candidates and canvas hit testing',()=>{
 assert.deepEqual(randomEdges(17,3,10),randomEdges(17,3,10));assert.notDeepEqual(randomEdges(18,3,10),randomEdges(17,3,10));assert.throws(()=>randomEdges(1,1,50));
 for(const radius of [1,2,5,20]){const edges=cageEdges(radius);assert.equal(edges.length,12*radius+6);assert.equal(trapCandidates(edges).filter(([q,r])=>Math.max(Math.abs(q),Math.abs(r),Math.abs(q+r))<=radius).length,7);}
 assert.deepEqual(trapCandidates([]),[[0,0]]);assert.deepEqual(trapCandidates([[0,0,0]]),[[1,0]]);assert.deepEqual(trapCandidates([[0,0,0],[1,0,0],[2,0,0]]),[[3,0]]);
 assert.deepEqual(nearestEdge(.5,.02,.1),[0,0,0]);assert.equal(nearestEdge(.5,.3,.05),null);
 for(let d=0;d<6;d++)assert.deepEqual(canonicalEdge(0,0,d),canonicalEdge(...D[d],(d+3)%6));
});

test('stationary certificates are sufficient invariants, including a lock reached after moving',()=>{
 const locked=generatePath({...DEFAULTS,geometry:'edge',angle:180,seedEdges:[[2,0,0]],count:512});
 assert.equal(locked.stationaryCertificate.fromTerm,4);assert.equal(locked.segments,2);assert.equal(locked.stopReason,'cutoff');
 for(let i=4;i<=locked.count;i++)assert.equal(locked.moved[i],2);
 const ordinary=generatePath({...DEFAULTS,geometry:'edge',angle:120,seedEdges:[[0,0,0]],count:4096});assert.equal(ordinary.stationaryCertificate,null);
 const search=generatePath({...DEFAULTS,geometry:'edge',angle:120,blocked:'turn',seedEdges:[0,2,4].map(d=>[0,0,d]),count:100});assert.equal(search.stationaryCertificate,null);
 const pause=generatePath({...DEFAULTS,geometry:'edge',actions:['L','R'],count:100});assert.equal(pause.stationaryCertificate.reason,'no-forward-action');
});

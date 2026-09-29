import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS,digitValue,describeStep,generatePath,validateConfig,fitBounds,numberAt} from '../dist/core.mjs';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} ≠ ${b}`);
test('the requested rule starts at zero and turns without drawing',()=>{
  const c={...DEFAULTS,count:4};
  assert.deepEqual(Array.from({length:4},(_,i)=>describeStep(i,c).action),['F','L','L','F']);
  const p=generatePath(c);assert.equal(p.segments,2);assert.equal(p.turns,2);
  assert.deepEqual([...p.moved],[0,1,1,1,2]);assert.deepEqual([...p.headings],[0,0,60,120,120]);
  assert.deepEqual([...p.turnPrefix],[0,0,1,2,2]);
  close(p.points[2],1);close(p.points[3],0);close(p.points[4],.5);close(p.points[5],Math.sqrt(3)/2);
});
test('all supported bases agree with independent string digit calculations',()=>{
  for(let base=2;base<=36;base++)for(const n of [0,1,2,19,63,1000,65537,Number.MAX_SAFE_INTEGER]){
    const digits=n.toString(base).split('').map(d=>parseInt(d,36));
    assert.equal(digitValue(n,base,'sum'),digits.reduce((a,b)=>a+b,0));
    assert.equal(digitValue(n,base,'last'),digits.at(-1));
    assert.equal(digitValue(n,base,'nonzero'),digits.filter(d=>d!==0).length);
    assert.equal(digitValue(n,base,'count',0),digits.filter(d=>d===0).length);
  }
});
test('combined actions turn first, and left is counterclockwise',()=>{
  const p=generatePath({...DEFAULTS,count:2,angle:90,actions:['LF','LF']});
  close(p.points[2],0);close(p.points[3],1);close(p.points[4],-1);close(p.points[5],1);
  const q=generatePath({...DEFAULTS,count:1,angle:90,actions:['RF','RF']});close(q.points[3],-1);
});
test('turn-only and zero-degree-turn experiments remain meaningful',()=>{
  const p=generatePath({...DEFAULTS,count:10,actions:['L','L']});assert.equal(p.segments,0);assert.equal(p.turns,10);
  const q=generatePath({...DEFAULTS,count:10,angle:0,actions:['LF','LF']});assert.equal(q.segments,10);assert.equal(q.turns,10);close(q.points[20],10);
});
test('sequence transformations use the selected start and interval',()=>{
  assert.deepEqual(Array.from({length:3},(_,i)=>numberAt(i,{...DEFAULTS,start:2,stride:3,sequence:'squares'})),[4,25,64]);
  assert.equal(numberAt(2,{...DEFAULTS,start:2,stride:3,sequence:'triangular'}),36);
});
test('rejects invalid inputs and unsafe sequence arithmetic',()=>{
  for(const patch of [{base:1},{count:0},{start:-1},{count:1.5},{angle:NaN},{angle:361},{actions:['X','L']},{modulus:3},{metric:'count',digit:2},{sequence:'squares',start:100000000},{start:Number.MAX_SAFE_INTEGER}])assert.throws(()=>validateConfig({...DEFAULTS,...patch}));
  assert.equal(validateConfig({...DEFAULTS,start:Number.MAX_SAFE_INTEGER,count:1}).start,Number.MAX_SAFE_INTEGER);
});
test('full bounds fit inside the viewport for flat, empty, and general paths',()=>{
  for(const b of [{minX:-100,maxX:200,minY:-50,maxY:10},{minX:0,maxX:1000,minY:0,maxY:0},{minX:0,maxX:0,minY:0,maxY:0}]){
    const v=fitBounds(b,600,400,50);assert.ok(Number.isFinite(v.scale)&&v.scale>0);
    for(const x of [b.minX,b.maxX])for(const y of [b.minY,b.maxY]){
      const sx=(x-v.x)*v.scale+300,sy=200-(y-v.y)*v.scale;assert.ok(sx>=49.999&&sx<=550.001&&sy>=49.999&&sy<=350.001);
    }
  }
});
test('a million binary terms are bounded and preserve the action count',()=>{
  const p=generatePath({...DEFAULTS,count:1000000});assert.equal(p.segments,500000);assert.equal(p.turns,500000);assert.equal(p.steps.length,500000);assert.ok(Object.values(p.bounds).every(Number.isFinite));
});

test('starting direction rotates the path and step length scales it',()=>{
  const p=generatePath({...DEFAULTS,count:4,initialHeading:90,stepLength:2});
  close(p.headings[0],90);close(p.points[2],0);close(p.points[3],2);
  close(p.points[4],-Math.sqrt(3));close(p.points[5],1);
});
test('per-rule angles and distances override defaults, including zero',()=>{
  const p=generatePath({...DEFAULTS,count:4,ruleAngles:[null,90],ruleSteps:[2,null]});
  close(p.points[2],2);close(p.points[4],0);close(p.points[5],0);
  assert.deepEqual([...p.remainders],[0,0]);
  const q=generatePath({...DEFAULTS,count:2,actions:['LF','LF'],ruleAngles:[0,90],ruleSteps:[0,3]});
  close(q.points[2],0);close(q.points[3],0);close(q.points[4],0);close(q.points[5],3);
});
test('randomized configurations match an independent string-based turtle',()=>{
  let seed=812;
  const rand=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
  const actions=['F','L','R','LF','RF','N'];
  for(let trial=0;trial<100;trial++){
    const modulus=2+rand(7),c=validateConfig({...DEFAULTS,base:2+rand(35),start:rand(200),stride:1+rand(7),count:150,modulus,angle:rand(361),initialHeading:rand(361),stepLength:(1+rand(10))/2,actions:Array.from({length:modulus},()=>actions[rand(6)]),ruleAngles:Array.from({length:modulus},()=>rand(2)?null:rand(361)),ruleSteps:Array.from({length:modulus},()=>rand(2)?null:rand(6))});
    const p=generatePath(c);let x=0,y=0,h=c.initialHeading%360,moves=0,turns=0;
    for(let i=0;i<c.count;i++){
      const n=c.start+i*c.stride;
      const sum=n.toString(c.base).split('').reduce((total,d)=>total+parseInt(d,36),0),r=sum%modulus,a=c.actions[r];
      if(['L','LF','R','RF'].includes(a)){h=(h+(['L','LF'].includes(a)?1:-1)*(c.ruleAngles[r]??c.angle)+360)%360;turns++;}
      if(['F','LF','RF'].includes(a)){const d=c.ruleSteps[r]??c.stepLength;x+=d*Math.cos(h*Math.PI/180);y+=d*Math.sin(h*Math.PI/180);moves++;close(p.points[moves*2],x);close(p.points[moves*2+1],y);assert.equal(p.remainders[moves-1],r);}
      assert.equal(p.moved[i+1],moves);assert.equal(p.turnPrefix[i+1],turns);close(p.headings[i+1],h);
    }
  }
});
test('validation returns independent arrays and does not mutate caller settings',()=>{
  const source={...DEFAULTS,ruleAngles:[0,null],ruleSteps:[1,null]};const c=validateConfig(source);
  c.actions[0]='N';c.ruleAngles[0]=90;c.ruleSteps[0]=8;
  assert.equal(source.actions[0],'F');assert.equal(source.ruleAngles[0],0);assert.equal(source.ruleSteps[0],1);
});

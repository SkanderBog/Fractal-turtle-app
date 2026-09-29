import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {DEFAULTS,validateConfig,generatePath} from '../dist/core.mjs';
import {APPEARANCE,parseSetup,serializeSetup,validateAppearance} from '../dist/setup.mjs';
const setup=()=>({version:1,name:'A saved experiment',config:{...DEFAULTS},appearance:{...APPEARANCE}});

test('JSON setup round-trip preserves all customized rules and appearance',()=>{
  const c=validateConfig({...DEFAULTS,initialHeading:120,stepLength:2,ruleAngles:[30,null],ruleSteps:[0,4]});
  const a=validateAppearance({...APPEARANCE,colorMode:'remainder',background:'paper',grid:false,speed:4});
  const restored=parseSetup(serializeSetup(c,a,'My setup'));
  assert.deepEqual(restored.config,c);assert.deepEqual(restored.appearance,a);assert.equal(restored.name,'My setup');
  assert.deepEqual([...generatePath(restored.config).points],[...generatePath(c).points]);
});
test('weighted setups round-trip all 36 weights and old files keep their meaning',()=>{
  const weights=Array.from({length:36},(_,d)=>d*2-35);
  const c=validateConfig({...DEFAULTS,metric:'weighted',digitWeights:weights});
  assert.deepEqual(parseSetup(serializeSetup(c,APPEARANCE,'Weights')).config,c);
  const old=setup();delete old.config.digitWeights;
  const restored=parseSetup(JSON.stringify(old));
  assert.equal(restored.config.metric,'sum');assert.deepEqual(restored.config.digitWeights,Array.from({length:36},(_,d)=>d));
});
test('JSON imports reject malformed weights and unsupported weighted expressions',()=>{
  for(const digitWeights of [[null,1],[0,'alert(1)'],[0,1.5],Array(37).fill(0),{'0':0,'1':1},[0,1e99]]){
    const data=setup();data.config.metric='weighted';data.config.digitWeights=digitWeights;
    assert.throws(()=>parseSetup(JSON.stringify(data)));
  }
});
test('malformed and oversized JSON is rejected before configuration is used',()=>{
  for(const text of ['', '{', 'null','[]','"hello"',' '.repeat(65537)])assert.throws(()=>parseSetup(text));
  const huge=setup();huge.name='x'.repeat(70000);assert.throws(()=>parseSetup(JSON.stringify(huge)));
});
test('unknown and prototype-related keys are rejected at each boundary',()=>{
  for(const key of ['__proto__','prototype','constructor','url','script']){
    const root=setup();Object.defineProperty(root,key,{value:{polluted:true},enumerable:true});assert.throws(()=>parseSetup(JSON.stringify(root)));
    const config=setup();Object.defineProperty(config.config,key,{value:{polluted:true},enumerable:true});assert.throws(()=>parseSetup(JSON.stringify(config)));
    const style=setup();Object.defineProperty(style.appearance,key,{value:'x',enumerable:true});assert.throws(()=>parseSetup(JSON.stringify(style)));
  }
  assert.equal({}.polluted,undefined);
});
test('rejects malformed objects, inherited settings, sparse arrays and wrong types',()=>{
  for(const value of [null,[],true,'x',Object.create({count:2})])assert.throws(()=>validateConfig(value));
  for(const patch of [{count:'16'},{base:true},{angle:Infinity},{stepLength:0},{stepLength:1001},{initialHeading:-1},{actions:'FL'},{actions:[null,'F']},{actions:Array(2)},{ruleAngles:[]},{ruleAngles:[undefined,2]},{ruleSteps:[-1,null]},{ruleSteps:[1001,null]}])assert.throws(()=>validateConfig({...DEFAULTS,...patch}));
});
test('resource limits reject enormous, fractional, and inexact sequences',()=>{
  for(const patch of [{count:1000001},{count:Number.MAX_SAFE_INTEGER},{modulus:1000000},{stride:1000001},{count:1.1},{sequence:'squares',start:100000000},{sequence:'triangular',start:Number.MAX_SAFE_INTEGER}])assert.throws(()=>generatePath({...DEFAULTS,...patch}));
});
test('appearance accepts only bounded values and literal hex colors',()=>{
  for(const patch of [{solidColor:'url(https://example.com)'},{solidColor:'#fff;display:none'},{palette:'__proto__'},{lineWidth:Infinity},{lineWidth:100},{speed:0},{background:'javascript:alert(1)'},{grid:'false'},{markers:1}])assert.throws(()=>validateAppearance(patch));
});
test('setup names are bounded plain text, never interpreted as HTML',()=>{
  const safe=setup();safe.name='<img src=x onerror=alert(1)>';assert.equal(parseSetup(JSON.stringify(safe)).name,safe.name);
  for(const name of ['', ' '.repeat(5),'x'.repeat(61),'bad\nname']){const data=setup();data.name=name;assert.throws(()=>parseSetup(JSON.stringify(data)));}
});
test('unsupported setup versions and missing required data are rejected',()=>{
  for(const patch of [{version:0},{version:2},{version:'1'},{config:null},{appearance:null},{name:42}])assert.throws(()=>parseSetup(JSON.stringify({...setup(),...patch})));
});
test('application sources have no script evaluation, HTML injection sinks, or external dependencies',()=>{
  const root=new URL('../dist/',import.meta.url);
  const sources=readdirSync(root).filter(name=>/\.(mjs|html|css)$/.test(name));
  for(const name of sources){
    const text=readFileSync(new URL(name,root),'utf8');
    assert.doesNotMatch(text,/\beval\s*\(|new\s+Function\s*\(|\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML|document\.write\s*\(/,name);
    assert.doesNotMatch(text,/https?:\/\/|@import|\bfetch\s*\(|XMLHttpRequest|WebSocket/,name);
  }
  const html=readFileSync(new URL('index.html',root),'utf8');
  assert.match(html,/connect-src 'none'/);assert.match(html,/worker-src 'self'/);assert.doesNotMatch(html,/unsafe-eval|unsafe-inline|<script\b[^>]*>\s*[^<\s]/);
});

import {validateConfig} from './core.mjs';
export const APPEARANCE = Object.freeze({palette:'spectrum',colorMode:'sequence',lineWidth:1.25,solidColor:'#9ef7c4',background:'midnight',grid:true,markers:true,autoFit:true,speed:1});
export const MAX_SETUP_BYTES = 65536;
export function validateAppearance(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || ![Object.prototype,null].includes(Object.getPrototypeOf(input)) || Object.keys(input).some(k=>!Object.hasOwn(APPEARANCE,k))) throw new Error('Unknown appearance setting.');
  const a = {...APPEARANCE,...input};
  for (const [key,values] of [['palette',['spectrum','lagoon','ember','ice']],['colorMode',['sequence','direction','remainder','solid']],['background',['midnight','paper','ink']]]) if (!values.includes(a[key])) throw new Error(`Invalid ${key}.`);
  for (const [key,min,max] of [['lineWidth',0.5,6],['speed',0.25,8]]) if (!Number.isFinite(a[key]) || a[key]<min || a[key]>max) throw new Error(`Invalid ${key}.`);
  for (const key of ['grid','markers','autoFit']) if (typeof a[key]!=='boolean') throw new Error(`Invalid ${key}.`);
  if (typeof a.solidColor!=='string' || !/^#[0-9a-f]{6}$/i.test(a.solidColor)) throw new Error('Choose a six-digit hex color.');
  return a;
}
export function validateSetup(input) {
  if (!input || typeof input!=='object' || Array.isArray(input) || ![Object.prototype,null].includes(Object.getPrototypeOf(input)) || Object.keys(input).some(k=>!['version','name','config','appearance'].includes(k)) || input.version!==1) throw new Error('This is not a supported Turtle Lab setup.');
  if (typeof input.name!=='string' || !input.name.trim() || input.name.length>60 || /[\u0000-\u001f\u007f]/.test(input.name)) throw new Error('Give the setup a name of 1–60 characters.');
  return {version:1,name:input.name.trim(),config:validateConfig(input.config),appearance:validateAppearance(input.appearance)};
}
export function parseSetup(text) {
  if (typeof text!=='string' || new TextEncoder().encode(text).length>MAX_SETUP_BYTES) throw new Error('Setup files must be smaller than 64 KB.');
  let data;try{data=JSON.parse(text);}catch{throw new Error('This file is not valid JSON.');}
  return validateSetup(data);
}
export function serializeSetup(config,appearance,name='My experiment') {
  return JSON.stringify(validateSetup({version:1,name,config,appearance}),null,2);
}

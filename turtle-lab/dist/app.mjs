import {ACTIONS, DEFAULTS, validateConfig, describeStep, fitBounds, numberAt} from './core.mjs';
import {APPEARANCE, MAX_SETUP_BYTES, validateAppearance, validateSetup, parseSetup, serializeSetup} from './setup.mjs';

const $ = id => document.getElementById(id);
const number = value => new Intl.NumberFormat('en', {maximumFractionDigits: 2}).format(value);
const presets = {
  original: {...DEFAULTS},
  ternary: {...DEFAULTS, base: 3, count: 19683, modulus: 4, actions: ['F','L','RF','LF']},
  binary: {...DEFAULTS, modulus: 3, angle: 90, actions: ['F','L','RF']},
  square: {...DEFAULTS, sequence: 'squares', base: 5, count: 8192, modulus: 3, actions: ['F','L','RF']},
};
const actionLabels = {F:'Forward', L:'Left turn', R:'Right turn', LF:'Left + step', RF:'Right + step', N:'No action'};
const metricLabels = {sum:'sum', last:'last', nonzero:'nonzero', count:'count'};
const numericFields = ['base','start','stride','count','modulus','digit','angle','initialHeading','stepLength'];
const storageKey = 'turtle-lab.setups.v1';
let config = validateConfig(DEFAULTS), appearance = {...APPEARANCE}, path = null;
let worker = null, generation = 0, pendingReject = null, busy = false, debounce = 0;
let view = {x:0,y:0,scale:1}, fittedScale = 1, width = 0, height = 0, dpr = 1;
let position = config.count, playing = false, lastTick = 0, playPosition = 0, frame = 0;
let renderPending = false, toastTimer = 0, cachedPaths = null, palette = [], setups = [];
const canvas = $('drawing'), ctx = canvas.getContext('2d');

function toast(message) {
  clearTimeout(toastTimer);
  $('toast').textContent = message;
  $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4500);
}
function showError(message) {
  $('error').textContent = message;
  $('error').hidden = !message;
  $('update-state').textContent = message ? 'Check settings' : busy ? 'Drawing…' : 'Up to date';
}
function color(t) {
  if (appearance.colorMode === 'solid') return appearance.solidColor;
  const light = appearance.background === 'paper' ? 36 : 69;
  if (appearance.palette === 'lagoon') return `hsl(${155 + t*90} 85% ${light}%)`;
  if (appearance.palette === 'ember') return `hsl(${345 + t*70} 95% ${light}%)`;
  if (appearance.palette === 'ice') return `hsl(${205 + t*70} 80% ${light}%)`;
  return `hsl(${155 + t*300} 90% ${light}%)`;
}
function refreshAppearance() {
  palette = Array.from({length:256}, (_,i) => color(i/255));
  $('stage').classList.toggle('no-grid', !appearance.grid);
  $('stage').classList.toggle('paper', appearance.background === 'paper');
  $('stage').classList.toggle('ink', appearance.background === 'ink');
  $('palette-field').hidden = appearance.colorMode === 'solid';
  $('solid-field').hidden = appearance.colorMode !== 'solid';
  $('line-width-label').textContent = `${appearance.lineWidth} px`;
  $('color-key').style.background = `linear-gradient(90deg,${Array.from({length:9}, (_,i) => color(i/8)).join(',')})`;
  const labels = {sequence:['First','Last'], direction:['0°','360°'], remainder:['Rule 0',`Rule ${config.modulus-1}`], solid:['Solid','']};
  [$('key-start').textContent, $('key-end').textContent] = labels[appearance.colorMode];
  queueRender();
}
function readAppearance() {
  return validateAppearance({palette:$('palette').value, colorMode:$('color-mode').value,
    lineWidth:Number($('line-width').value), solidColor:$('solid-color').value,
    background:$('background').value, grid:$('grid').checked, markers:$('markers').checked,
    autoFit:$('auto-fit').checked, speed:Number($('speed').value)});
}
function writeAppearance(value) {
  appearance = validateAppearance(value);
  for (const [id,key] of [['palette','palette'],['color-mode','colorMode'],['line-width','lineWidth'],['solid-color','solidColor'],['background','background'],['speed','speed']]) $(id).value = appearance[key];
  for (const [id,key] of [['grid','grid'],['markers','markers'],['auto-fit','autoFit']]) $(id).checked = appearance[key];
  cachedPaths = null;
  refreshAppearance();
}
function queueRender() {
  if (renderPending) return;
  renderPending = true;
  requestAnimationFrame(() => { renderPending = false; render(); });
}
function pathsForPosition() {
  if (cachedPaths) return cachedPaths;
  const paths = Array.from({length:256}, () => new Path2D());
  const ends = new Int32Array(256).fill(-1);
  for (let i=0; i<path.moved[position]; i++) {
    let t = path.steps[i] / Math.max(1,path.count-1);
    if (appearance.colorMode === 'direction') t = path.headings[path.steps[i]+1] / 360;
    else if (appearance.colorMode === 'remainder') t = path.remainders[i] / (config.modulus-1);
    else if (appearance.colorMode === 'solid') t = 0;
    const bucket = Math.min(255,Math.floor(t*255));
    if (ends[bucket] !== i) paths[bucket].moveTo(path.points[2*i], -path.points[2*i+1]);
    paths[bucket].lineTo(path.points[2*i+2], -path.points[2*i+3]);
    ends[bucket] = i+1;
  }
  cachedPaths = paths;
  return paths;
}
function render() {
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,width,height);
  if (!path || !width || !height) return;
  const ox = width/2-view.x*view.scale, oy = height/2+view.y*view.scale;
  ctx.save(); ctx.translate(ox,oy); ctx.scale(view.scale,view.scale);
  ctx.lineWidth = appearance.lineWidth/view.scale;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const paths = pathsForPosition();
  for (let i=0; i<256; i++) { ctx.strokeStyle=palette[i]; ctx.stroke(paths[i]); }
  ctx.restore();
  if (appearance.markers) {
    const foreground = appearance.background === 'paper' ? '#153d2c' : '#e4ffef';
    const background = appearance.background === 'paper' ? '#edf1ef' : '#0b1116';
    ctx.beginPath(); ctx.arc(ox,oy,4,0,Math.PI*2); ctx.fillStyle=background; ctx.fill();
    ctx.strokeStyle=foreground; ctx.lineWidth=1.4; ctx.stroke();
    const end = path.moved[position];
    ctx.save(); ctx.translate(path.points[2*end]*view.scale+ox,-path.points[2*end+1]*view.scale+oy);
    ctx.rotate(-path.headings[position]*Math.PI/180);
    ctx.beginPath(); ctx.moveTo(8,0); ctx.lineTo(-5,-4.5); ctx.lineTo(-3,0); ctx.lineTo(-5,4.5); ctx.closePath();
    ctx.fillStyle=foreground; ctx.strokeStyle=background; ctx.lineWidth=1.2; ctx.fill(); ctx.stroke(); ctx.restore();
  }
  $('zoom-label').textContent = `${number(view.scale/fittedScale*100)}%`;
}
function fit() {
  if (!path) return;
  view = fitBounds(path.bounds,width,height,width<500 ? 38 : 55);
  fittedScale = view.scale;
  queueRender();
}
function resize() {
  const rect = $('stage').getBoundingClientRect();
  width=rect.width; height=rect.height;
  dpr=Math.min(window.devicePixelRatio||1,2);
  canvas.width=Math.round(width*dpr); canvas.height=Math.round(height*dpr);
  if (appearance.autoFit) fit(); else queueRender();
}
function setPosition(value) {
  const next = Math.max(0,Math.min(path?.count??config.count,Math.round(value)));
  if (next !== position) cachedPaths = null;
  position = next;
  $('progress').value=position;
  $('progress-label').textContent=`${number(position)} / ${number(path?.count??config.count)}`;
  if (path) {
    $('segments').textContent=number(path.moved[position]);
    $('turns').textContent=number(path.turnPrefix[position]);
  }
  $('step-back').disabled=busy||!path||position===0;
  $('step-forward').disabled=busy||!path||position===path.count;
  updateInspector(); queueRender();
}
function stopPlayback() {
  playing=false; cancelAnimationFrame(frame);
  const partial = position>0 && position<(path?.count??0);
  $('play-icon').textContent='▶'; $('play-label').textContent=partial?'Play':'Replay';
  $('play').setAttribute('aria-label',partial?'Continue drawing':'Replay drawing');
}
function tick(now) {
  if (!playing) return;
  const elapsed = now-lastTick;
  if (elapsed>=40) {
    playPosition += Math.min(elapsed,250)/12000*path.count*appearance.speed;
    lastTick=now;
    setPosition(playPosition);
  }
  if (position>=path.count) stopPlayback(); else frame=requestAnimationFrame(tick);
}
function togglePlay() {
  if (!path||busy) return;
  if (playing) { stopPlayback(); return; }
  if (position>=path.count) setPosition(0);
  playing=true; playPosition=position; lastTick=performance.now();
  $('play-icon').textContent='Ⅱ'; $('play-label').textContent='Pause'; $('play').setAttribute('aria-label','Pause drawing');
  frame=requestAnimationFrame(tick);
}
function readNumber(id) { return $(id).value.trim()==='' ? NaN : Number($(id).value); }
function readOverrides(selector) {
  return [...$('rule-rows').querySelectorAll(selector)].map(input => input.value.trim()==='' ? null : Number(input.value));
}
function renderRuleRows(c) {
  const modulus=Number($('modulus').value);
  if (!Number.isInteger(modulus)||modulus<2||modulus>8) return;
  const actions=c?.actions??[...$('rule-rows').querySelectorAll('select')].map(s=>s.value);
  const angles=c?.ruleAngles??readOverrides('[data-angle]');
  const steps=c?.ruleSteps??readOverrides('[data-step]');
  $('rule-rows').replaceChildren();
  for (let i=0; i<modulus; i++) {
    const card=document.createElement('div'); card.className='rule-card';
    const row=document.createElement('div'); row.className='rule-action';
    const badge=document.createElement('span'); badge.className='remainder-badge';
    const caption=document.createElement('span'); caption.textContent='IF';
    const value=document.createElement('strong'); value.textContent=i; badge.append(caption,value);
    const label=document.createElement('label'), select=document.createElement('select');
    select.setAttribute('aria-label',`Action for remainder ${i}`); select.dataset.remainder=i;
    for (const [value,text] of Object.entries(ACTIONS)) { const option=document.createElement('option'); option.value=value; option.textContent=text; select.append(option); }
    select.value=actions[i]??(i===0?'F':'L'); label.append(select); row.append(badge,label);
    const overrides=document.createElement('div'); overrides.className='rule-overrides';
    for (const [key,text,max,values] of [['angle','Turn (°)',360,angles],['step','Step (units)',1000,steps]]) {
      const field=document.createElement('label'); field.className='field'; field.textContent=text;
      const input=document.createElement('input'); input.type='number'; input.min=0; input.max=max; input.step='any'; input.dataset[key]=i;
      input.setAttribute('aria-label',`${key==='angle'?'Turn angle':'Step distance'} for remainder ${i}`);
      input.value=values?.[i]??''; field.append(input); overrides.append(field);
    }
    card.append(row,overrides); $('rule-rows').append(card);
  }
  updateRuleInputs();
}
function updateRuleInputs() {
  for (const card of $('rule-rows').children) {
    const action=card.querySelector('select').value;
    const angle=card.querySelector('[data-angle]'), step=card.querySelector('[data-step]');
    angle.disabled=!action.includes('L')&&!action.includes('R'); step.disabled=!action.includes('F');
    angle.placeholder=$('angle').value; step.placeholder=$('stepLength').value;
  }
}
function readConfig() {
  const next={};
  for (const key of numericFields) next[key]=readNumber(key);
  next.sequence=$('sequence').value; next.metric=$('metric').value;
  next.actions=[...$('rule-rows').querySelectorAll('select')].map(s=>s.value);
  next.ruleAngles=readOverrides('[data-angle]'); next.ruleSteps=readOverrides('[data-step]');
  return validateConfig(next);
}
function writeConfig(c) {
  for (const key of [...numericFields,'sequence','metric']) $(key).value=c[key];
  $('digit-field').hidden=c.metric!=='count'; renderRuleRows(c);
}
function updateSummary() {
  $('number-preview').textContent=Array.from({length:Math.min(6,config.count)},(_,i)=>numberAt(i,config).toString()).join(', ')+(config.count>6?' …':'');
  $('base-badge').textContent=`BASE ${config.base}`;
  $('rule-summary').textContent=config.metric==='sum'&&config.modulus===2
    ? `Even sum: ${ACTIONS[config.actions[0]].toLowerCase()}. Odd: ${ACTIONS[config.actions[1]].toLowerCase()}.`
    : `${$('metric').selectedOptions[0].textContent} · remainder ÷ ${config.modulus}`;
  $('drawing-title').textContent=$('preset').value==='custom'?'Your experiment':$('preset').selectedOptions[0].textContent;
  for (const button of document.querySelectorAll('[data-count]')) button.classList.toggle('active',Number(button.dataset.count)===config.count);
  for (const button of document.querySelectorAll('button[data-angle]')) button.classList.toggle('active',Number(button.dataset.angle)===config.angle);
  refreshAppearance();
}
function updateInspector() {
  const current=position>0&&position<config.count?position-1:-1;
  $('current-step').textContent=current>=0?`Term ${number(position)} · ${actionLabels[describeStep(current,config).action]}`:position===0?'At the starting point':'Inspect the first eight terms';
  if (!$('inspector').open) return;
  const start=current<0?0:Math.max(0,Math.min(current-3,config.count-8));
  $('sequence-cards').replaceChildren();
  for (let i=start; i<Math.min(start+8,config.count); i++) {
    const step=describeStep(i,config), card=document.createElement('div');
    card.className=`sequence-card ${step.action.includes('F')?'':'turn'} ${i===current?'current':''}`;
    for (const [className,text] of [['decimal',`value ${step.n}`],['digits',step.digits],['calculation',`${metricLabels[config.metric]} ${step.value} · r ${step.remainder}`],['action',actionLabels[step.action]]]) {
      const element=document.createElement('span'); element.className=className; element.textContent=text;
      if (className==='digits') element.title=`${step.digits} in base ${config.base}`;
      if (className==='decimal') element.title=`Term ${i+1}: decimal ${step.n}`;
      card.append(element);
    }
    $('sequence-cards').append(card);
  }
  $('inspector-note').textContent=`Start: (0, 0), heading ${config.initialHeading}°. Defaults: ${config.stepLength} unit steps, ${config.angle}° turns. Combined actions turn before moving.`;
}
function setBusy(value) {
  busy=value; $('play').disabled=value||!path; $('progress').disabled=value||!path; $('export-image').disabled=value||!path;
  $('step-back').disabled=value||!path||position===0; $('step-forward').disabled=value||!path||position===path?.count;
  $('update-state').textContent=value?'Drawing…':'Up to date';
  $('drawing').setAttribute('aria-busy',String(value));
}
function regenerate(input) {
  const next=validateConfig(input);
  stopPlayback(); worker?.terminate(); pendingReject?.(new Error('Replaced by a newer drawing.')); pendingReject=null;
  const id=++generation;
  setBusy(true); showError(''); $('generation-status').textContent='Drawing the sequence…'; $('generation-status').hidden=false;
  return new Promise((resolve,reject) => {
    pendingReject=reject;
    const fail=message => {
      if (id!==generation) return;
      worker?.terminate(); worker=null; pendingReject=null; setBusy(false); $('generation-status').hidden=true;
      showError(`${message} Your last valid drawing is still available.`); reject(new Error(message));
    };
    try { worker=new Worker(new URL('./worker.mjs',import.meta.url),{type:'module'}); } catch { fail('The drawing worker could not start.'); return; }
    worker.onerror=()=>fail('The drawing could not load. Refresh and try again.');
    worker.onmessage=({data}) => {
      if (id!==generation) return;
      if (data.error) { fail(data.error); return; }
      path=data.result; config=next; cachedPaths=null;
      worker.terminate(); worker=null; pendingReject=null; setBusy(false);
      $('progress').max=path.count; setPosition(path.count); stopPlayback(); updateSummary();
      $('extent').textContent=`${number(path.bounds.maxX-path.bounds.minX)} × ${number(path.bounds.maxY-path.bounds.minY)} units`;
      $('generation-status').hidden=path.segments>0;
      if (!path.segments) $('generation-status').textContent='Only turns or pauses. Choose a forward action to draw.';
      if (appearance.autoFit||id===1) fit(); else queueRender();
      requestAnimationFrame(()=>resolve(readState()));
    };
    worker.postMessage(next);
  });
}
function fromForm() {
  try { regenerate(readConfig()).catch(()=>{}); } catch (error) { showError(`${error.message} Showing the last valid drawing.`); }
}
function scheduleUpdate(event) {
  if (event.target.id==='modulus') renderRuleRows();
  if (event.target.id==='metric') $('digit-field').hidden=$('metric').value!=='count';
  updateRuleInputs(); $('preset').value='custom'; clearTimeout(debounce); debounce=setTimeout(fromForm,220);
}
$('settings').addEventListener('input',scheduleUpdate);
$('settings').addEventListener('submit',event=>{event.preventDefault();clearTimeout(debounce);fromForm();});
$('preset').addEventListener('change',()=>{clearTimeout(debounce);const c=validateConfig(presets[$('preset').value]);writeConfig(c);regenerate(c).catch(()=>{});});
$('reset').addEventListener('click',()=>{clearTimeout(debounce);$('preset').value='original';writeConfig(validateConfig(DEFAULTS));writeAppearance(APPEARANCE);regenerate(DEFAULTS).catch(()=>{});});
for (const button of document.querySelectorAll('[data-count],button[data-angle]')) button.addEventListener('click',()=>{
  $(button.dataset.count?'count':'angle').value=button.dataset.count??button.dataset.angle;
  $('preset').value='custom'; updateRuleInputs(); clearTimeout(debounce); fromForm();
});
for (const id of ['palette','color-mode','line-width','solid-color','background','grid','markers','auto-fit','speed']) $(id).addEventListener('input',()=>{
  const oldMode=appearance.colorMode;
  appearance=readAppearance();
  if (oldMode!==appearance.colorMode) cachedPaths=null;
  refreshAppearance(); if (id==='auto-fit'&&appearance.autoFit) fit();
});
$('fit').addEventListener('click',fit); $('play').addEventListener('click',togglePlay);
$('progress').addEventListener('input',()=>{stopPlayback();setPosition(Number($('progress').value));stopPlayback();});
for (const [id,offset] of [['step-back',-1],['step-forward',1]]) $(id).addEventListener('click',()=>{stopPlayback();setPosition(position+offset);stopPlayback();});
$('inspector').addEventListener('toggle',()=>{updateInspector();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopPlayback();});

function activateTab(name,focus=false) {
  for (const button of document.querySelectorAll('[data-tab]')) {
    const selected=button.dataset.tab===name;
    button.setAttribute('aria-selected',String(selected)); button.tabIndex=selected?0:-1;
    $(`panel-${button.dataset.tab}`).hidden=!selected;
    if (selected&&focus) button.focus();
  }
}
for (const button of document.querySelectorAll('[data-tab]')) {
  button.addEventListener('click',()=>activateTab(button.dataset.tab));
  button.addEventListener('keydown',event=>{
    const names=['sequence','rules','style'], index=names.indexOf(button.dataset.tab);
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault();
    activateTab(event.key==='Home'?'sequence':event.key==='End'?'style':names[(index+(event.key==='ArrowRight'?1:2))%3],true);
  });
}
function updateSettingsToggle() {
  const hidden=document.body.classList.contains('settings-hidden');
  $('toggle-settings').setAttribute('aria-expanded',String(!hidden));
  $('toggle-settings').textContent=hidden?'Show settings':window.innerWidth<=850?'Customize':'Hide settings';
}
$('toggle-settings').addEventListener('click',()=>{
  if (window.innerWidth<=850) {
    document.body.classList.remove('settings-hidden'); $('controls').scrollIntoView({block:'start'}); $('tab-sequence').focus({preventScroll:true});
  } else document.body.classList.toggle('settings-hidden');
  updateSettingsToggle();
});
window.addEventListener('resize',updateSettingsToggle);
let resizing=false;
function setPanelWidth(value) {
  const max=Math.min(540,window.innerWidth-390), bounded=Math.max(320,Math.min(max,value));
  document.documentElement.style.setProperty('--panel-width',`${bounded}px`);
  $('panel-resizer').setAttribute('aria-valuenow',Math.round(bounded));
}
$('panel-resizer').addEventListener('pointerdown',event=>{if(event.button!==0)return;resizing=true;$('panel-resizer').setPointerCapture(event.pointerId);});
$('panel-resizer').addEventListener('pointermove',event=>{if(resizing)setPanelWidth(event.clientX);});
for (const type of ['pointerup','pointercancel','lostpointercapture']) $('panel-resizer').addEventListener(type,()=>{resizing=false;});
$('panel-resizer').addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home'].includes(event.key))return;event.preventDefault();setPanelWidth(event.key==='Home'?380:Number($('panel-resizer').getAttribute('aria-valuenow'))+(event.key==='ArrowRight'?20:-20));});
function zoom(factor,x=width/2,y=height/2) {
  const before=view.scale; view.scale=Math.min(fittedScale*10000,Math.max(fittedScale/100,view.scale*factor));
  view.x+=(x-width/2)/before-(x-width/2)/view.scale;
  view.y-=(y-height/2)/before-(y-height/2)/view.scale; queueRender();
}
$('zoom-in').addEventListener('click',()=>zoom(1.5)); $('zoom-out').addEventListener('click',()=>zoom(1/1.5));
canvas.addEventListener('wheel',event=>{event.preventDefault();const rect=canvas.getBoundingClientRect();zoom(Math.exp(-Math.max(-200,Math.min(200,event.deltaY))*.004),event.clientX-rect.left,event.clientY-rect.top);},{passive:false});
const pointers=new Map(); let pinch=null;
canvas.addEventListener('pointerdown',event=>{if(event.button!==0)return;canvas.setPointerCapture(event.pointerId);pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});canvas.classList.add('dragging');pinch=null;});
canvas.addEventListener('pointermove',event=>{
  const previous=pointers.get(event.pointerId); if(!previous)return;
  if(pointers.size===1){view.x-=(event.clientX-previous.x)/view.scale;view.y+=(event.clientY-previous.y)/view.scale;}
  pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
  if(pointers.size===2){
    const [a,b]=[...pointers.values()],distance=Math.hypot(a.x-b.x,a.y-b.y),rect=canvas.getBoundingClientRect();
    if(pinch&&distance>0)zoom(distance/pinch,(a.x+b.x)/2-rect.left,(a.y+b.y)/2-rect.top);
    pinch=distance;
  }
  queueRender();
});
function finishPointer(event){pointers.delete(event.pointerId);pinch=null;if(!pointers.size)canvas.classList.remove('dragging');}
for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,finishPointer);
canvas.addEventListener('dblclick',fit);
canvas.addEventListener('keydown',event=>{
  if(event.key.toLowerCase()==='f'){event.preventDefault();fit();}
  else if(event.key===' '){event.preventDefault();togglePlay();}
  else if(event.key==='+'||event.key==='='){event.preventDefault();zoom(1.5);}
  else if(event.key==='-'){event.preventDefault();zoom(1/1.5);}
  else if(['ArrowLeft','ArrowRight'].includes(event.key)&&!busy&&path){event.preventDefault();stopPlayback();setPosition(position+(event.key==='ArrowRight'?1:-1));stopPlayback();}
});
new ResizeObserver(resize).observe($('stage'));

function refreshSavedList() {
  $('saved-list').replaceChildren(new Option('Choose a saved setup…',''));
  setups.forEach((setup,i)=>$('saved-list').append(new Option(setup.name,String(i))));
  $('load-setup').disabled=true; $('remove-setup').disabled=true;
}
function readSavedSetups() {
  try {
    const raw=localStorage.getItem(storageKey);
    if(raw){if(raw.length>131072)throw new Error();const data=JSON.parse(raw);if(!Array.isArray(data)||data.length>12)throw new Error();setups=data.map(validateSetup);}
  } catch {setups=[];toast('Saved setups could not be read. You can still import a JSON setup.');}
  refreshSavedList();
}
function saveStored(next) {
  localStorage.setItem(storageKey,JSON.stringify(next)); setups=next; refreshSavedList();
}
function currentSetup() { return validateSetup({version:1,name:$('setup-name').value,config:readConfig(),appearance:readAppearance()}); }
function applySetup(setup) {
  const valid=validateSetup(setup); clearTimeout(debounce); $('preset').value='custom'; $('setup-name').value=valid.name;
  writeConfig(valid.config); writeAppearance(valid.appearance);
  return regenerate(valid.config);
}
$('save-setup').addEventListener('click',()=>{
  try {
    const setup=currentSetup(),next=[...setups],index=next.findIndex(s=>s.name===setup.name);
    if(index>=0)next[index]=setup;else{if(next.length>=12)throw new Error('You have 12 saved setups. Remove one or download a JSON file.');next.push(setup);}
    saveStored(next);toast(`Saved “${setup.name}” in this browser.`);
  }catch(error){toast(error.message||'Browser storage is unavailable. Download a JSON setup instead.');}
});
$('saved-list').addEventListener('change',()=>{const selected=$('saved-list').value!=='';$('load-setup').disabled=!selected;$('remove-setup').disabled=!selected;});
function selectedSetupIndex(){const value=$('saved-list').value,index=Number(value);if(value===''||!Number.isInteger(index)||index<0||index>=setups.length)throw new Error('Choose a saved setup first.');return index;}
$('load-setup').addEventListener('click',()=>{try{applySetup(setups[selectedSetupIndex()]).then(()=>toast('Saved setup loaded.')).catch(error=>toast(error.message));}catch(error){toast(error.message);}});
$('remove-setup').addEventListener('click',()=>{try{const index=selectedSetupIndex();saveStored(setups.filter((_,i)=>i!==index));toast('Saved setup removed. The current drawing is unchanged.');}catch(error){toast(error.message);}});
function download(blob,filename){
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
$('download-setup').addEventListener('click',()=>{try{const setup=currentSetup();download(new Blob([serializeSetup(setup.config,setup.appearance,setup.name)],{type:'application/json'}),'turtle-lab-setup.json');toast('Setup download requested.');}catch(error){toast(error.message);}});
$('import-setup').addEventListener('click',()=>$('setup-file').click());
$('setup-file').addEventListener('change',async()=>{
  const file=$('setup-file').files[0];if(!file)return;
  try{if(file.size>MAX_SETUP_BYTES)throw new Error('Setup files must be smaller than 64 KB.');const setup=parseSetup(await file.text());await applySetup(setup);toast(`Loaded “${setup.name}”.`);}catch(error){toast(error.message);}finally{$('setup-file').value='';}
});
$('export-image').addEventListener('click',()=>{
  if(!path||busy)return;
  render();const output=document.createElement('canvas');output.width=canvas.width;output.height=canvas.height;const context=output.getContext('2d');
  context.fillStyle={midnight:'#0b1116',ink:'#000000',paper:'#edf1ef'}[appearance.background];context.fillRect(0,0,output.width,output.height);context.drawImage(canvas,0,0);
  output.toBlob(blob=>{if(blob){download(blob,'turtle-lab.png');toast('PNG download requested with the current view and background.');}else toast('The image could not be created.');},'image/png');
});
function readState(){return {config:{...config,actions:[...config.actions],ruleAngles:[...config.ruleAngles],ruleSteps:[...config.ruleSteps]},appearance:{...appearance},segments:path?.segments??0,turns:path?.turns??0,bounds:path?.bounds??null,visibleTerms:position,busy};}
function registerTools(){
  if(!document.modelContext?.registerTool)return;
  const lifecycle=new AbortController();window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
  const properties={base:{type:'integer',minimum:2,maximum:36},count:{type:'integer',minimum:1,maximum:1000000},start:{type:'integer',minimum:0},stride:{type:'integer',minimum:1,maximum:1000000},sequence:{enum:['integers','squares','triangular']},metric:{enum:['sum','last','nonzero','count']},digit:{type:'integer',minimum:0,maximum:35},modulus:{type:'integer',minimum:2,maximum:8},angle:{type:'number',minimum:0,maximum:360},initialHeading:{type:'number',minimum:0,maximum:360},stepLength:{type:'number',minimum:0.01,maximum:1000},actions:{type:'array',items:{enum:Object.keys(ACTIONS)},minItems:2,maxItems:8},ruleAngles:{type:'array',items:{type:['number','null'],minimum:0,maximum:360},minItems:2,maxItems:8},ruleSteps:{type:'array',items:{type:['number','null'],minimum:0,maximum:1000},minItems:2,maxItems:8}};
  const tools=[{name:'read_turtle_experiment',title:'Read turtle experiment',description:'Read the current completed experiment, appearance, bounds, playback position, and loading state.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:readState},
    {name:'configure_turtle_experiment',title:'Configure turtle experiment',description:'Change turtle rules and generate the visible drawing. When changing modulus, supply matching actions and optional angle/distance arrays.',inputSchema:{type:'object',properties,additionalProperties:false},annotations:{readOnlyHint:false},execute:async input=>{
      if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!Object.hasOwn(properties,key)))throw new Error('Use supported experiment settings.');
      const patch={...input};if(patch.modulus!==undefined&&patch.modulus!==config.modulus){patch.ruleAngles??=null;patch.ruleSteps??=null;}
      const next=validateConfig({...config,...patch});clearTimeout(debounce);$('preset').value='custom';writeConfig(next);return regenerate(next);
    }}];
  for(const tool of tools){try{Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{/* Optional API; the visible interface works without it. */}}
}
writeConfig(config);writeAppearance(APPEARANCE);readSavedSetups();updateSettingsToggle();resize();regenerate(config).catch(()=>{});registerTools();

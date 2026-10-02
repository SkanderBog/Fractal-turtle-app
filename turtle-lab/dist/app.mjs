import {translate} from './zh-CN.mjs';
import {DIRECTIONS,canonicalEdge,randomEdges,nearestEdge,cageEdges,trapCandidates} from './edge.mjs';
import {ACTIONS, DEFAULTS, validateConfig, describeStep, fitBounds, numberAt} from './core.mjs';
import {APPEARANCE, MAX_SETUP_BYTES, validateAppearance, validateSetup, parseSetup, serializeSetup} from './setup.mjs';

const $ = id => document.getElementById(id);
const number = value => new Intl.NumberFormat('zh-CN', {maximumFractionDigits: 2}).format(value);
const presets = {
  original: {...DEFAULTS},
  'edge-quad': {...DEFAULTS,geometry:'edge',blocked:'turn',modulus:4,actions:['F','L','F','R']},
  'edge-m3': {...DEFAULTS,geometry:'edge',blocked:'turn',modulus:3,actions:['F','L','R']},
  'edge-parity': {...DEFAULTS,geometry:'edge',blocked:'turn'},
  'edge-koch': {...DEFAULTS,geometry:'edge',blocked:'turn',angle:120},
  ternary: {...DEFAULTS, base: 3, count: 19683, modulus: 4, actions: ['F','L','RF','LF']},
  binary: {...DEFAULTS, modulus: 3, angle: 90, actions: ['F','L','RF']},
  square: {...DEFAULTS, sequence: 'squares', base: 5, count: 8192, modulus: 3, actions: ['F','L','RF']},
};
const actionLabels = {F:'前进', L:'左转', R:'右转', LF:'左转并前进', RF:'右转并前进', N:'不动作'};
const metricLabels = {sum:'数字和', weighted:'权重和', last:'末位', nonzero:'非零个数', count:'出现次数'};
const numericFields = ['base','start','stride','count','modulus','digit','angle','initialHeading','stepLength'];
const storageKey = 'turtle-lab.setups.v1';
let config = validateConfig(DEFAULTS), appearance = {...APPEARANCE}, path = null;
let draftWeights = [...config.digitWeights], draftEdges = [], editingEdges = false;
let worker = null, generation = 0, pendingReject = null, busy = false, debounce = 0;
let view = {x:0,y:0,scale:1}, fittedScale = 1, width = 0, height = 0, dpr = 1;
let position = config.count, playing = false, lastTick = 0, playPosition = 0, frame = 0;
let renderPending = false, toastTimer = 0, cachedPaths = null, palette = [], setups = [];
const canvas = $('drawing'), ctx = canvas.getContext('2d');

function toast(message) {
  clearTimeout(toastTimer);
  $('toast').textContent = translate(message);
  $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4500);
}
function showError(message) {
  $('error').textContent = translate(message);
  $('error').hidden = !message;
  $('update-state').textContent = message ? '请检查设置' : busy ? '正在绘制…' : '已更新';
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
  $('color-key').style.background = appearance.colorMode==='collision'?`linear-gradient(90deg,${color(0)} 0% 50%,${color(1)} 50% 100%)`:`linear-gradient(90deg,${Array.from({length:9}, (_,i) => color(i/8)).join(',')})`;
  const labels = {sequence:['起始','末尾'], direction:['0°','360°'], remainder:['规则 0',`规则 ${config.modulus-1}`], solid:['单色',''], collision:['直接通过','搜索后通过']};
  [$('key-start').textContent, $('key-end').textContent] = labels[appearance.colorMode];
  queueRender();
}
function readAppearance() {
  return validateAppearance({palette:$('palette').value, colorMode:$('color-mode').value,
    lineWidth:Number($('line-width').value), solidColor:$('solid-color').value,
    background:$('background').value, grid:$('grid').checked, markers:$('markers').checked,
    autoFit:$('auto-fit').checked, trapSites:$('trap-sites').checked, speed:Number($('speed').value)});
}
function writeAppearance(value) {
  appearance = validateAppearance(value);
  for (const [id,key] of [['palette','palette'],['color-mode','colorMode'],['line-width','lineWidth'],['solid-color','solidColor'],['background','background'],['speed','speed']]) $(id).value = appearance[key];
  for (const [id,key] of [['grid','grid'],['markers','markers'],['auto-fit','autoFit'],['trap-sites','trapSites']]) $(id).checked = appearance[key];
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
    else if (appearance.colorMode === 'collision') t = path.searches?.[path.steps[i]] ? 1 : 0;
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
  if (config.geometry==='edge') drawInitialEdges();
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
  const bounds={...path.bounds};
  if(config.geometry==='edge')for(const [q,r,d] of config.seedEdges)for(const [a,b] of [[q,r],[q+DIRECTIONS[d][0],r+DIRECTIONS[d][1]]]){
    const x=a+b/2,y=b*Math.sqrt(3)/2;bounds.minX=Math.min(bounds.minX,x);bounds.maxX=Math.max(bounds.maxX,x);bounds.minY=Math.min(bounds.minY,y);bounds.maxY=Math.max(bounds.maxY,y);
  }
  view = fitBounds(bounds,width,height,width<500 ? 38 : 55);
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
  updateInspector(); updateEdgeStatus(); queueRender();
}
function stopPlayback() {
  playing=false; cancelAnimationFrame(frame);
  const partial = position>0 && position<(path?.count??0);
  $('play-icon').textContent='▶'; $('play-label').textContent=partial?'播放':'重放';
  $('play').setAttribute('aria-label',partial?'继续绘制':'重放轨迹');
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
  $('play-icon').textContent='Ⅱ'; $('play-label').textContent='暂停'; $('play').setAttribute('aria-label','暂停绘制');
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
    const caption=document.createElement('span'); caption.textContent='余数';
    const value=document.createElement('strong'); value.textContent=i; badge.append(caption,value);
    const label=document.createElement('label'), select=document.createElement('select');
    select.setAttribute('aria-label',`余数 ${i} 的动作`); select.dataset.remainder=i;
    for (const [value,text] of Object.entries(ACTIONS)) { const option=document.createElement('option'); option.value=value; option.textContent=translate(text); select.append(option); }
    select.value=actions[i]??(i===0?'F':'L'); label.append(select); row.append(badge,label);
    const overrides=document.createElement('div'); overrides.className='rule-overrides';
    for (const [key,text,max,values] of [['angle','转角（°）',360,angles],['step','步长（单位）',1000,steps]]) {
      const field=document.createElement('label'); field.className='field'; field.textContent=text;
      const input=document.createElement('input'); input.type='number'; input.min=0; input.max=max; input.step='any'; input.dataset[key]=i;
      input.setAttribute('aria-label',`余数 ${i} 的${key==='angle'?'转角':'步长'}`);
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
function readDigitWeights() {
  const weights = [...draftWeights];
  for (const input of $('weight-grid').querySelectorAll('input')) weights[Number(input.dataset.weight)] = input.value.trim() === '' ? NaN : Number(input.value);
  return weights;
}
function renderDigitWeights(weights = readDigitWeights()) {
  draftWeights = [...weights];
  const base = Number($('base').value);
  if (!Number.isInteger(base) || base < 2 || base > 36) return;
  // A hidden unfinished edit must not prevent fixing the visible experiment.
  for (let digit=base;digit<36;digit++) if (!Number.isSafeInteger(draftWeights[digit]) || Math.abs(draftWeights[digit])>1000000) draftWeights[digit]=config.digitWeights[digit];
  $('weight-grid').replaceChildren();
  for (let digit = 0; digit < base; digit++) {
    const label = document.createElement('label');
    const symbol = document.createElement('span'); symbol.textContent = digit.toString(36).toUpperCase();
    symbol.title = `Digit value ${digit}`;
    const input = document.createElement('input'); input.type = 'number'; input.min = -1000000; input.max = 1000000; input.step = 1;
    input.dataset.weight = digit; input.setAttribute('aria-label', `数字 ${symbol.textContent} 的权重`);
    input.value = Number.isFinite(weights[digit]) ? weights[digit] : '';
    label.append(symbol,input); $('weight-grid').append(label);
  }
}
function updateWeightExample() {
  if (config.metric !== 'weighted') return;
  const step = describeStep(Math.min(3,config.count-1),config);
  const sum = [...step.digits].map(digit => config.digitWeights[parseInt(digit,36)]).map(weight => weight < 0 ? `(${weight})` : String(weight)).join(' + ');
  $('weight-example').textContent = `${step.n} → ${config.base} 进制的 ${step.digits}：${sum} = ${step.value}；余数 ${step.remainder}。`;
}
function readConfig() {
  const next={};
  for (const key of numericFields) next[key]=readNumber(key);
  next.geometry=$('geometry').value;next.blocked=$('blocked').value;next.seedEdges=draftEdges;
  next.sequence=$('sequence').value; next.metric=$('metric').value;
  next.digitWeights=next.metric==='weighted'?readDigitWeights():[...config.digitWeights];
  next.actions=[...$('rule-rows').querySelectorAll('select')].map(s=>s.value);
  next.ruleAngles=readOverrides('[data-angle]'); next.ruleSteps=readOverrides('[data-step]');
  return validateConfig(next);
}
function writeConfig(c) {
  for (const key of [...numericFields,'sequence','metric','geometry','blocked']) $(key).value=c[key];
  draftEdges=c.seedEdges.map(e=>[...e]);updateEdgeControls();
  $('digit-field').hidden=c.metric!=='count'; $('weights-field').hidden=c.metric!=='weighted'; renderDigitWeights(c.digitWeights); renderRuleRows(c);
}
function updateSummary() {
  updateWeightExample();
  $('number-preview').textContent=Array.from({length:Math.min(6,config.count)},(_,i)=>numberAt(i,config).toString()).join(', ')+(config.count>6?' …':'');
  $('base-badge').textContent=`${config.base} 进制`;
  $('rule-summary').textContent=config.metric==='sum'&&config.modulus===2
    ? `数字和为偶数：${translate(ACTIONS[config.actions[0]])}；奇数：${translate(ACTIONS[config.actions[1]])}。`
    : `${$('metric').selectedOptions[0].textContent} · 除以 ${config.modulus} 取余`;
  $('drawing-title').textContent=$('preset').value==='custom'?'你的实验':$('preset').selectedOptions[0].textContent;
  for (const button of document.querySelectorAll('[data-count]')) button.classList.toggle('active',Number(button.dataset.count)===config.count);
  for (const button of document.querySelectorAll('button[data-angle]')) button.classList.toggle('active',Number(button.dataset.angle)===config.angle);
  refreshAppearance();
}
function updateInspector() {
  const total=path?.count??config.count,current=position>0?Math.min(position-1,total-1):-1;
  $('current-step').textContent=current>=0?`第 ${number(position)} 项 · ${actionLabels[describeStep(current,config).action]}`:position===0?'位于起点':'查看前八项';
  if (!$('inspector').open) return;
  const start=current<0?0:Math.max(0,Math.min(current-3,total-8));
  $('sequence-cards').replaceChildren();
  for (let i=start; i<Math.min(start+8,total); i++) {
    const step=describeStep(i,config), card=document.createElement('div');
    card.className=`sequence-card ${step.action.includes('F')?'':'turn'} ${i===current?'current':''}`;
    for (const [className,text] of [['decimal',`数值 ${step.n}`],['digits',step.digits],['calculation',`${metricLabels[config.metric]} ${step.value} · r ${step.remainder}`],['action',actionLabels[step.action]+(path?.outcomes?' → '+outcomeLabel(i):'')]]) {
      const element=document.createElement('span'); element.className=className; element.textContent=text;
      if (className==='digits') element.title=`${config.base} 进制：${step.digits}`;
      if (className==='decimal') element.title=`第 ${i+1} 项：十进制 ${step.n}`;
      card.append(element);
    }
    $('sequence-cards').append(card);
  }
  $('inspector-note').textContent=`起点：(0, 0)，朝向 ${config.initialHeading}°。默认步长 ${config.stepLength}，转角 ${config.angle}°。组合动作先转向再前进。`;
}
function setBusy(value) {
  busy=value; $('play').disabled=value||!path||path.count===0; $('progress').disabled=value||!path||path.count===0; $('export-image').disabled=value||!path;
  $('step-back').disabled=value||!path||position===0; $('step-forward').disabled=value||!path||position===path?.count;
  $('update-state').textContent=value?'正在绘制…':'已更新';
  $('drawing').setAttribute('aria-busy',String(value));
}
function regenerate(input,preserveView=false) {
  const next=validateConfig(input);
  stopPlayback(); worker?.terminate(); pendingReject?.(new Error('Replaced by a newer drawing.')); pendingReject=null;
  const id=++generation;
  setBusy(true); showError(''); $('generation-status').textContent='正在绘制数列…'; $('generation-status').hidden=false;
  return new Promise((resolve,reject) => {
    pendingReject=reject;
    const fail=message => {
      if (id!==generation) return;
      worker?.terminate(); worker=null; pendingReject=null; setBusy(false); $('generation-status').hidden=true;
      showError(`${translate(message)} 上一次有效绘图仍可使用。`); reject(new Error(message));
    };
    try { worker=new Worker(new URL('./worker.mjs',import.meta.url),{type:'module'}); } catch { fail('无法启动绘图后台任务。'); return; }
    worker.onerror=()=>fail('无法加载绘图，请刷新后重试。');
    worker.onmessage=({data}) => {
      if (id!==generation) return;
      if (data.error) { fail(data.error); return; }
      path=data.result; config=next; cachedPaths=null;
      worker.terminate(); worker=null; pendingReject=null; setBusy(false);
      $('progress').max=path.count; setPosition(path.count); stopPlayback(); updateSummary();
      $('extent').textContent=`${number(path.bounds.maxX-path.bounds.minX)} × ${number(path.bounds.maxY-path.bounds.minY)} 单位`;
      $('generation-status').hidden=path.segments>0;
      if (!path.segments) $('generation-status').textContent=config.geometry==='edge'?(path.stopReason==='trap'?'原点的六条邻边均已标记。':path.stationaryCertificate?'规则与初始标记使位置锁定，但指令仍可改变方向。':'当前指令前缀中没有成功移动，请检查指令或修改初始边。'):'当前只有转向或暂停，请添加前进动作。';
      if (!preserveView&&(appearance.autoFit||id===1)) fit(); else queueRender();
      requestAnimationFrame(()=>resolve(readState()));
    };
    worker.postMessage(next);
  });
}
function fromForm() {
  try { regenerate(readConfig()).catch(()=>{}); } catch (error) { showError(`${translate(error.message)} 当前显示上一次有效绘图。`); }
}
function scheduleUpdate(event) {
  if(event.target.closest('#seed-controls'))return;
  if(event.target.id==='geometry')updateEdgeControls();
  if (event.target.id==='modulus') renderRuleRows();
  if (event.target.id==='metric') { $('digit-field').hidden=$('metric').value!=='count'; $('weights-field').hidden=$('metric').value!=='weighted'; }
  if (event.target.id==='base') renderDigitWeights();
  updateRuleInputs(); $('preset').value='custom'; clearTimeout(debounce); debounce=setTimeout(fromForm,220);
}
function updateEdgeControls(){
  const enabled=$('geometry').value==='edge';$('edge-controls').hidden=!enabled;
  $('seed-count').textContent=String(draftEdges.length);
  if(!enabled){editingEdges=false;$('edit-edges').checked=false;}
  canvas.classList.toggle('editing-edges',editingEdges);queueRender();
}
function outcomeLabel(i){
  if(!path?.outcomes||i>=path.count)return '';
  return path.outcomes[i]===1?(path.searches[i]?`搜索 ${path.searches[i]} 个方向后移动`:'已移动'):path.outcomes[i]===2?'受阻，原地等待':path.outcomes[i]===3?'已转向':'已暂停';
}
function updateEdgeStatus(){
  const enabled=config.geometry==='edge'&&path?.outcomes;$('edge-status').hidden=!enabled;if(!enabled)return;
  const locked=path.stationaryCertificate&&position>=path.stationaryCertificate.fromTerm;
  const terminal=locked?`从第 ${number(path.stationaryCertificate.fromTerm)} 项起位置锁定 · 指令继续`:position===path.count?(path.stopReason==='trap'?`执行 ${number(path.count)} 项后陷住`:`达到项数上限（${number(path.requestedCount)}）· 尚未观察到陷阱`):`重放第 ${number(position)} 项`;
  const mask=path.incidentMasks[position],degree=mask.toString(2).replaceAll('0','').length;
  $('edge-status').textContent=`${terminal} · 访问 ${number(path.uniquePrefix[position])} 个顶点 · ${number(path.blockedPrefix[position])} 次受阻请求 · 当前位置 ${degree}/6 条边已标记`;
}
function drawInitialEdges(){
  const line=(q,r,d)=>{const [dq,dr]=DIRECTIONS[d];ctx.moveTo(q+r/2,-r*Math.sqrt(3)/2);ctx.lineTo(q+dq+(r+dr)/2,-(r+dr)*Math.sqrt(3)/2);};
  if(editingEdges&&view.scale>=14){
    const r0=Math.floor((view.y-height/(2*view.scale))/(Math.sqrt(3)/2))-1,r1=Math.ceil((view.y+height/(2*view.scale))/(Math.sqrt(3)/2))+1;
    ctx.beginPath();
    for(let r=r0;r<=r1;r++){const q0=Math.floor(view.x-width/(2*view.scale)-r/2)-1,q1=Math.ceil(view.x+width/(2*view.scale)-r/2)+1;for(let q=q0;q<=q1;q++)for(let d=0;d<3;d++)line(q,r,d);}
    ctx.strokeStyle=appearance.background==='paper'?'#cad5ce':'#233932';ctx.lineWidth=.6/view.scale;ctx.stroke();
  }
  ctx.beginPath();for(const edge of config.seedEdges)line(...edge);ctx.strokeStyle=appearance.background==='paper'?'#b64d05':'#ffae64';ctx.lineWidth=3/view.scale;ctx.stroke();
  if(appearance.trapSites){ctx.beginPath();for(const [q,r] of trapCandidates(config.seedEdges)){ctx.moveTo(q+r/2+7/view.scale,-r*Math.sqrt(3)/2);ctx.arc(q+r/2,-r*Math.sqrt(3)/2,7/view.scale,0,Math.PI*2);}ctx.strokeStyle=appearance.background==='paper'?'#8c2678':'#f4a9e3';ctx.lineWidth=1.5/view.scale;ctx.stroke();}
  ctx.lineWidth=appearance.lineWidth/view.scale;
}
function replaceSeeds(edges){
  try{const next=validateConfig({...readConfig(),seedEdges:edges});draftEdges=next.seedEdges;updateEdgeControls();clearTimeout(debounce);$('preset').value='custom';regenerate(next,true).catch(()=>{});}catch(error){toast(error.message);}
}
function toggleSeed(edge){
  try{const value=canonicalEdge(...edge),key=value.join(','),exists=draftEdges.some(e=>e.join(',')===key);replaceSeeds(exists?draftEdges.filter(e=>e.join(',')!==key):[...draftEdges,value]);}catch(error){toast(error.message);}
}
$('edit-edges').addEventListener('change',()=>{editingEdges=$('edit-edges').checked;if(editingEdges){stopPlayback();view={x:0,y:0,scale:40};}updateEdgeControls();});
$('toggle-edge').addEventListener('click',()=>toggleSeed([readNumber('seed-q'),readNumber('seed-r'),readNumber('seed-d')]));
$('clear-edges').addEventListener('click',()=>replaceSeeds([]));
$('cage-edges').addEventListener('click',()=>{try{replaceSeeds(cageEdges(readNumber('seed-radius')));}catch(error){toast(error.message);}});
$('random-edges').addEventListener('click',()=>{try{replaceSeeds(randomEdges(readNumber('random-seed'),readNumber('seed-radius'),readNumber('random-count')));}catch(error){toast(error.message);}});
$('settings').addEventListener('input',scheduleUpdate);
for (const button of document.querySelectorAll('[data-weights]')) button.addEventListener('click',()=>{
  renderDigitWeights(Array.from({length:36},(_,digit)=>button.dataset.weights==='ones'?1:button.dataset.weights==='zeros'?0:digit));
  $('preset').value='custom'; clearTimeout(debounce); fromForm();
});
$('settings').addEventListener('submit',event=>{event.preventDefault();clearTimeout(debounce);fromForm();});
$('preset').addEventListener('change',()=>{clearTimeout(debounce);const c=validateConfig(presets[$('preset').value]);writeConfig(c);regenerate(c).catch(()=>{});});
$('reset').addEventListener('click',()=>{clearTimeout(debounce);$('preset').value='original';writeConfig(validateConfig(DEFAULTS));writeAppearance(APPEARANCE);regenerate(DEFAULTS).catch(()=>{});});
for (const button of document.querySelectorAll('[data-count],button[data-angle]')) button.addEventListener('click',()=>{
  $(button.dataset.count?'count':'angle').value=button.dataset.count??button.dataset.angle;
  $('preset').value='custom'; updateRuleInputs(); clearTimeout(debounce); fromForm();
});
for (const id of ['palette','color-mode','line-width','solid-color','background','grid','markers','auto-fit','trap-sites','speed']) $(id).addEventListener('input',()=>{
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
  $('toggle-settings').textContent=hidden?'显示设置':window.innerWidth<=850?'调整设置':'隐藏设置';
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
const pointers=new Map(); let pinch=null,editClick=null;
canvas.addEventListener('pointerdown',event=>{if(event.button!==0)return;canvas.setPointerCapture(event.pointerId);pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});editClick=editingEdges&&pointers.size===1?{id:event.pointerId,x:event.clientX,y:event.clientY}:null;canvas.classList.add('dragging');pinch=null;});
canvas.addEventListener('pointermove',event=>{
  const previous=pointers.get(event.pointerId); if(!previous)return;
  if(editClick&&Math.hypot(event.clientX-editClick.x,event.clientY-editClick.y)>5)editClick=null;
  if(pointers.size===1){view.x-=(event.clientX-previous.x)/view.scale;view.y+=(event.clientY-previous.y)/view.scale;}
  pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
  if(pointers.size===2){
    const [a,b]=[...pointers.values()],distance=Math.hypot(a.x-b.x,a.y-b.y),rect=canvas.getBoundingClientRect();
    if(pinch&&distance>0)zoom(distance/pinch,(a.x+b.x)/2-rect.left,(a.y+b.y)/2-rect.top);
    pinch=distance;
  }
  queueRender();
});
function finishPointer(event){
  if(event.type==='pointerup'&&editClick?.id===event.pointerId&&pointers.size===1){
    if(view.scale<14)toast('放大后可编辑单条边。');
    else {const rect=canvas.getBoundingClientRect(),x=(event.clientX-rect.left-width/2)/view.scale+view.x,y=-(event.clientY-rect.top-height/2)/view.scale+view.y;const edge=nearestEdge(x,y,Math.min(.25,10/view.scale));if(edge)toggleSeed(edge);}
  }
  editClick=null;pointers.delete(event.pointerId);pinch=null;if(!pointers.size)canvas.classList.remove('dragging');}
for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,finishPointer);
canvas.addEventListener('dblclick',()=>{if(!editingEdges)fit();});
canvas.addEventListener('keydown',event=>{
  if(event.key.toLowerCase()==='f'){event.preventDefault();fit();}
  else if(event.key===' '){event.preventDefault();togglePlay();}
  else if(event.key==='+'||event.key==='='){event.preventDefault();zoom(1.5);}
  else if(event.key==='-'){event.preventDefault();zoom(1/1.5);}
  else if(['ArrowLeft','ArrowRight'].includes(event.key)&&!busy&&path){event.preventDefault();stopPlayback();setPosition(position+(event.key==='ArrowRight'?1:-1));stopPlayback();}
});
new ResizeObserver(resize).observe($('stage'));

function refreshSavedList() {
  $('saved-list').replaceChildren(new Option('选择已保存的配置…',''));
  setups.forEach((setup,i)=>$('saved-list').append(new Option(setup.name,String(i))));
  $('load-setup').disabled=true; $('remove-setup').disabled=true;
}
function readSavedSetups() {
  try {
    const raw=localStorage.getItem(storageKey);
    if(raw){if(raw.length>1048576)throw new Error();const data=JSON.parse(raw);if(!Array.isArray(data)||data.length>12)throw new Error();setups=data.map(validateSetup);}
  } catch {setups=[];toast('无法读取已保存配置，仍可导入 JSON 配置。');}
  refreshSavedList();
}
function saveStored(next) {
  const json=JSON.stringify(next);if(json.length>1048576)throw new Error('配置超过本浏览器存储上限，请下载 JSON 文件。');
  localStorage.setItem(storageKey,json); setups=next; refreshSavedList();
}
function currentSetup() { return validateSetup({version:2,name:$('setup-name').value,config:readConfig(),appearance:readAppearance()}); }
function applySetup(setup) {
  const valid=validateSetup(setup); clearTimeout(debounce); $('preset').value='custom'; $('setup-name').value=valid.name;
  writeConfig(valid.config); writeAppearance(valid.appearance);
  return regenerate(valid.config);
}
$('save-setup').addEventListener('click',()=>{
  try {
    const setup=currentSetup(),next=[...setups],index=next.findIndex(s=>s.name===setup.name);
    if(index>=0)next[index]=setup;else{if(next.length>=12)throw new Error('已保存 12 个配置，请删除一个或下载 JSON 文件。');next.push(setup);}
    saveStored(next);toast(`已在本浏览器保存“${setup.name}”。`);
  }catch(error){toast(error.message||'浏览器存储不可用，请下载 JSON 配置。');}
});
$('saved-list').addEventListener('change',()=>{const selected=$('saved-list').value!=='';$('load-setup').disabled=!selected;$('remove-setup').disabled=!selected;});
function selectedSetupIndex(){const value=$('saved-list').value,index=Number(value);if(value===''||!Number.isInteger(index)||index<0||index>=setups.length)throw new Error('请先选择已保存的配置。');return index;}
$('load-setup').addEventListener('click',()=>{try{applySetup(setups[selectedSetupIndex()]).then(()=>toast('已加载配置。')).catch(error=>toast(error.message));}catch(error){toast(error.message);}});
$('remove-setup').addEventListener('click',()=>{try{const index=selectedSetupIndex();saveStored(setups.filter((_,i)=>i!==index));toast('已删除保存的配置，当前绘图未改变。');}catch(error){toast(error.message);}});
function download(blob,filename){
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
$('download-setup').addEventListener('click',()=>{try{const setup=currentSetup();download(new Blob([serializeSetup(setup.config,setup.appearance,setup.name)],{type:'application/json'}),'turtle-lab-setup.json');toast('已请求下载配置。');}catch(error){toast(error.message);}});
$('import-setup').addEventListener('click',()=>$('setup-file').click());
$('setup-file').addEventListener('change',async()=>{
  const file=$('setup-file').files[0];if(!file)return;
  try{if(file.size>MAX_SETUP_BYTES)throw new Error('配置文件必须小于 64 KB。');const setup=parseSetup(await file.text());await applySetup(setup);toast(`已加载“${setup.name}”。`);}catch(error){toast(error.message);}finally{$('setup-file').value='';}
});
$('export-image').addEventListener('click',()=>{
  if(!path||busy)return;
  render();const output=document.createElement('canvas');output.width=canvas.width;output.height=canvas.height;const context=output.getContext('2d');
  context.fillStyle={midnight:'#0b1116',ink:'#000000',paper:'#edf1ef'}[appearance.background];context.fillRect(0,0,output.width,output.height);context.drawImage(canvas,0,0);
  output.toBlob(blob=>{if(blob){download(blob,'turtle-lab.png');toast('已请求下载当前视图和背景的 PNG。');}else toast('无法生成图片。');},'image/png');
});
function readState(){return {config:{...config,actions:[...config.actions],ruleAngles:[...config.ruleAngles],ruleSteps:[...config.ruleSteps],digitWeights:[...config.digitWeights],seedEdges:config.seedEdges.map(e=>[...e])},stopReason:path?.stopReason??null,consumedTerms:path?.count??0,stationaryCertificate:path?.stationaryCertificate??null,blocked:path?.blocked??0,uniqueVertices:path?.unique??null,appearance:{...appearance},segments:path?.segments??0,turns:path?.turns??0,bounds:path?.bounds??null,visibleTerms:position,busy};}
function registerTools(){
  if(!document.modelContext?.registerTool)return;
  const lifecycle=new AbortController();window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
  const properties={geometry:{enum:['free','edge']},blocked:{enum:['stay','turn']},seedEdges:{type:'array',maxItems:512,items:{type:'array',minItems:3,maxItems:3,items:{type:'integer'}}},base:{type:'integer',minimum:2,maximum:36},count:{type:'integer',minimum:1,maximum:1000000},start:{type:'integer',minimum:0},stride:{type:'integer',minimum:1,maximum:1000000},sequence:{enum:['integers','squares','triangular']},metric:{enum:['sum','weighted','last','nonzero','count']},digitWeights:{type:'array',items:{type:'integer',minimum:-1000000,maximum:1000000},minItems:2,maxItems:36},digit:{type:'integer',minimum:0,maximum:35},modulus:{type:'integer',minimum:2,maximum:8},angle:{type:'number',minimum:0,maximum:360},initialHeading:{type:'number',minimum:0,maximum:360},stepLength:{type:'number',minimum:0.01,maximum:1000},actions:{type:'array',items:{enum:Object.keys(ACTIONS)},minItems:2,maxItems:8},ruleAngles:{type:'array',items:{type:['number','null'],minimum:0,maximum:360},minItems:2,maxItems:8},ruleSteps:{type:'array',items:{type:['number','null'],minimum:0,maximum:1000},minItems:2,maxItems:8}};
  const tools=[{name:'read_turtle_experiment',title:'读取海龟实验',description:'读取当前完整实验、外观、边界、播放位置和加载状态。',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:readState},
    {name:'configure_turtle_experiment',title:'配置海龟实验',description:'修改海龟规则并生成可见图案。改变取余除数时，须提供对应动作，以及可选的转角和距离数组。',inputSchema:{type:'object',properties,additionalProperties:false},annotations:{readOnlyHint:false},execute:async input=>{
      if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!Object.hasOwn(properties,key)))throw new Error('Use supported experiment settings.');
      const patch={...input};if(patch.modulus!==undefined&&patch.modulus!==config.modulus){patch.ruleAngles??=null;patch.ruleSteps??=null;}
      const next=validateConfig({...config,...patch});clearTimeout(debounce);$('preset').value='custom';writeConfig(next);return regenerate(next);
    }}];
  for(const tool of tools){try{Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{/* Optional API; the visible interface works without it. */}}
}
writeConfig(config);writeAppearance(APPEARANCE);readSavedSetups();updateSettingsToggle();resize();regenerate(config).catch(()=>{});registerTools();

'use strict';
const $ = id => document.getElementById(id);
const icons = {
  panel:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
  'collapse-left':'<path d="M4 4v16m12-14-6 6 6 6"/>',
  'expand-right':'<path d="M4 4v16m6-14 6 6-6 6"/>',
  'collapse-up':'<path d="M4 4h16M6 16l6-6 6 6"/>',
  'expand-down':'<path d="M4 4h16m-14 6 6 6 6-6"/>',
  sliders:'<path d="M4 7h16M4 17h16"/><circle cx="8" cy="7" r="2"/><circle cx="16" cy="17" r="2"/>',
  download:'<path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M19 5l-1.5 1.5m-11 11L5 19"/>',
  moon:'<path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11z"/>',search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',book:'<path d="M12 5v15M3 5c3-2 6-2 9 0 3-2 6-2 9 0v14c-3-2-6-2-9 0-3-2-6-2-9 0z"/>',
  bulb:'<path d="M9 18h6m-5 3h4M8 14a6 6 0 1 1 8 0l-1 2H9z"/>',file:'<path d="M13 3H5v18h14V9zM13 3v6h6M8 13h8m-8 4h5"/>',play:'<path d="m8 4 12 8-12 8z"/>',check:'<path d="m5 12 4 4L19 6"/>',terminal:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m6 8 4 4-4 4m7 0h5"/>',cpu:'<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v4m6-4v4m-6 12v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4"/>',
  pause:'<path d="M8 5v14M16 5v14"/>',reset:'<path d="M4 8a8 8 0 1 1 0 8M4 3v5h5"/>',stop:'<rect x="6" y="6" width="12" height="12" rx="1"/>',mouse:'<rect x="6" y="2" width="12" height="20" rx="6"/><path d="M12 3v6"/>',
  mentor:'<path d="m2 8 10-5 10 5-10 5zM6 10v7c4 3 8 3 12 0v-7m4-2v8"/>',spark:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z"/>',send:'<path d="m3 3 18 9-18 9 4-9zM7 12h14"/>',
  'volume-off':'<path d="M11 5 6 9H3v6h3l5 4zM16 9l5 6m0-6-5 6"/>',volume:'<path d="M11 5 6 9H3v6h3l5 4zM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',x:'<path d="m6 6 12 12M18 6 6 18"/>'
};
const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.file}</svg>`;
function installIcons(root=document){root.querySelectorAll('[data-icon]').forEach(node=>node.innerHTML=icon(node.dataset.icon));}
installIcons();
const FILES=['main.c','MCU_init.h','Scankey.c','Seven_Segment.c','lab_config.h'];
const DESCRIPTIONS={'main.c':'主要程式','MCU_init.h':'晶片時脈與周邊設定','Scankey.c':'原始九宮格掃描驅動','Seven_Segment.c':'原始七段顯示器驅動','lab_config.h':'練習設定 · 由設定面板管理'};
let labs=[],lab=null,work=null,activeFile='main.c',simulation=null,playing=false,stepping=false;
let generation=0,runBusy=false,judgeBusy=false,mentorBusy=false,currentFrame=null;
let keys=new Set(),events=[],lastBoardSignature='',saveTimer,toastTimer,loopTimer;
let audioEnabled=false,audioContext=null,oscillator=null,gain=null;
let codeEditor=null;
function readStorage(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
function writeStorage(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true}catch{toast('瀏覽器儲存空間不足，請匯出專案備份。');return false}}
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),4500)}
async function api(path,data,method){const response=await fetch(path,{method:method||(data?'POST':'GET'),headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined});const result=await response.json();if(!response.ok||result.error)throw Error(result.error||'操作未完成');return result}
function payload(){return {labId:lab.id,sampleId:work.loadedSample,config:work.config,files:work.files}}
function savedFingerprint(id,saved){return JSON.stringify({labId:id,sampleId:saved.loadedSample,config:saved.config,files:saved.files})}
function currentResult(){return work?.result && work.resultHash===fingerprint()}
function fingerprint(){return JSON.stringify(payload())}
function capture(){if(work&&codeEditor&&activeFile!=='lab_config.h')work.files[activeFile]=codeEditor.getValue()}
function persist(){if(!work)return;capture();work.updatedAt=Date.now();if(writeStorage(`nuc140:work:${lab.id}`,work))$('save-status').textContent=`已儲存 ${new Date().toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'})}`;if(work.result&&(!currentResult()!==!!$('console-results').querySelector('.stale-result')))renderResults(work.result);buildLabList()}
function scheduleSave(){clearTimeout(saveTimer);$('save-status').textContent='儲存中…';saveTimer=setTimeout(persist,600);if(simulation)$('run-status').textContent='程式已修改，重新執行以套用'}
function configHeader(c){return `/* Portable practice settings; include this file in main.c. */\n#ifndef LAB_CONFIG_H\n#define LAB_CONFIG_H\n#define LAB_STUDENT_DIGIT ${c.studentDigit}\n#define LAB_DATE_DIGITS {${c.date.split('').join(', ')}}\n#define LAB_DIRECTION (${c.direction})\n#define LAB_INITIAL_SECONDS ${c.initialSeconds}\n#endif\n`}
function cursorPosition(){const position=codeEditor?.getPosition();if(position)$('cursor-position').textContent=`Ln ${position.lineNumber}, Col ${position.column}`}
function showFile(name,captureCurrent=true){
  if(captureCurrent)capture();activeFile=name;
  document.querySelectorAll('[data-file]').forEach(button=>{button.classList.toggle('active',button.dataset.file===name);button.setAttribute('aria-selected',button.dataset.file===name)});
  codeEditor.open(lab.id,name,work.files[name]||'',name==='lab_config.h');
  $('reindent-button').disabled=name==='lab_config.h';
  $('file-description').textContent=DESCRIPTIONS[name];cursorPosition();
}
function renderOriginalSlides(){
  $('original-slides').replaceChildren();
  for(const slide of lab.originalSlides||[]){
    const figure=document.createElement('figure'),button=document.createElement('button'),image=document.createElement('img'),caption=document.createElement('figcaption');
    const source=`${slide.source} · 第 ${slide.slide} 張 · ${slide.title}`;
    button.className='original-slide-button';button.type='button';button.setAttribute('aria-label','放大原題：'+slide.title);
    image.src=slide.image;image.alt=slide.title+'，原始簡報題目截圖';image.loading='lazy';
    caption.textContent=source;
    button.onclick=()=>{$('original-title').textContent=source;$('original-image').src=slide.image;$('original-image').alt=image.alt;$('original-dialog').showModal()};
    button.append(image);figure.append(button,caption);$('original-slides').append(figure);
  }
  $('grading-coverage').textContent=lab.gradingCoverage||'';
}
function buildFileTabs(){$('file-tabs').replaceChildren();for(const name of FILES){const button=document.createElement('button');button.dataset.file=name;button.setAttribute('role','tab');button.innerHTML=`<span class="file-symbol">${name.endsWith('.c')?'C':'H'}</span> ${name}`;button.addEventListener('click',()=>showFile(name));$('file-tabs').append(button)}}
function buildLabList(){const query=$('search').value.trim().toLowerCase();$('lab-list').replaceChildren();for(const number of [1,2,3]){const list=labs.filter(item=>item.lab===number&&(`${item.title} ${item.topic} ${item.id}`.toLowerCase().includes(query)));if(!list.length)continue;const group=document.createElement('div');group.className='lab-group';const title=document.createElement('div');title.className='lab-group-title';title.innerHTML=`<span>LAB ${String(number).padStart(2,'0')}</span><span>${['GPIO','KEYPAD','7-SEG'][number-1]}</span>`;group.append(title);for(const item of list){const button=document.createElement('button');button.className='lab-item'+(lab?.id===item.id?' active':'');const saved=readStorage(`nuc140:work:${item.id}`,null);const passed=saved?.result?.verdict==='AC'&&saved.resultHash===savedFingerprint(item.id,saved);button.innerHTML=`<span class="lab-num">${number}.${item.number}</span><div><div class="lab-title">${item.title}</div><div class="lab-topic">${item.topic}${passed?' <span class="lab-verdict">· AC</span>':''}</div></div>`;button.addEventListener('click',()=>selectLab(item.id));group.append(button)}$('lab-list').append(group)}}
function renderProblem(){$('problem-label').textContent=`LAB ${lab.lab}.${lab.number}`;$('problem-meta').innerHTML=`<span>Lab ${lab.lab}.${lab.number}</span><span>${lab.topic}</span>`;$('problem-title').textContent=lab.title;$('problem-description').textContent=lab.description;$('source').textContent=lab.source;for(const [id,items] of [['requirements',lab.requirements],['tips',lab.tips]]){$(id).replaceChildren();for(const text of items){const li=document.createElement('li');li.textContent=text;$(id).append(li)}}$('checks').replaceChildren();for(const text of lab.checks){const node=document.createElement('div');node.innerHTML=icon('check');const label=document.createElement('span');label.textContent=text;node.append(label);$('checks').append(node)}renderOriginalSlides()}
async function selectLab(id){if(lab?.id===id)return;persist();await stopSimulation();lab=labs.find(item=>item.id===id);work=readStorage(`nuc140:work:${id}`,null);if(!work?.files||!FILES.every(name=>typeof work.files[name]==='string')||!lab.samples.includes(work.loadedSample)){const template=await api(`/api/template?labId=${id}&sample=${readStorage('nuc140:sampleEnabled',true)}`);work={files:template.files,loadedSample:template.sampleId,preferredSample:template.sampleId,sampleEnabled:readStorage('nuc140:sampleEnabled',true),config:{studentDigit:9,date:'1150921',direction:1,initialSeconds:55},versions:[],chat:[],result:null}}
  work.versions=work.versions||[];work.chat=work.chat||[];work.files['lab_config.h']=configHeader(work.config);events=[];lastBoardSignature='';renderProblem();buildLabList();buildFileTabs();$('sample-toggle').checked=work.sampleEnabled;$('sample-select').replaceChildren();for(const sample of lab.samples){const option=document.createElement('option');option.value=sample;option.textContent=sample;$('sample-select').append(option)}$('sample-select').value=work.preferredSample||work.loadedSample;showFile('main.c',false);renderKeypad();renderChat();renderResults(work.result);setOutput('此題使用 '+work.loadedSample+' 作為專案基礎。\n編輯後可操作右上角板子，或執行自動評測。');renderEvents();resetBoard();writeStorage('nuc140:lastLab',id);persist()}
function snapshot(label='手動版本'){capture();work.versions.unshift({label,time:Date.now(),files:structuredClone(work.files),config:structuredClone(work.config),loadedSample:work.loadedSample});work.versions=work.versions.slice(0,15);persist()}
async function loadTemplate(){try{snapshot('載入起始碼前');await stopSimulation();const sample=$('sample-select').value;const template=await api(`/api/template?labId=${lab.id}&sample=${$('sample-toggle').checked}&sampleId=${sample}`);work.files=template.files;work.files['lab_config.h']=configHeader(work.config);work.loadedSample=sample;work.preferredSample=sample;work.sampleEnabled=$('sample-toggle').checked;work.result=null;showFile('main.c',false);renderResults(null);persist();toast('已載入起始碼，原作答已保留為版本。')}catch(error){toast(error.message)}}
function showVersions(){$('version-list').replaceChildren();if(!work.versions.length){$('version-list').textContent='尚未儲存版本。'}for(const [index,version] of work.versions.entries()){const row=document.createElement('div');row.className='version-row';const text=document.createElement('div');text.textContent=version.label;const date=document.createElement('small');date.textContent=new Date(version.time).toLocaleString('zh-TW');text.append(date);const button=document.createElement('button');button.className='button';button.textContent='開啟';button.onclick=async()=>{const selected=structuredClone(work.versions[index]);snapshot('還原版本前');await stopSimulation();work.files=selected.files;work.config=selected.config;work.loadedSample=selected.loadedSample;work.preferredSample=selected.loadedSample;$('sample-select').value=selected.loadedSample;work.result=null;showFile('main.c',false);renderResults(null);persist();$('versions-dialog').close();toast('已開啟版本，原作答也已保留。')};row.append(text,button);$('version-list').append(row)}$('versions-dialog').showModal()}
const segmentPaths=['M7 2h24l4 4-4 4H7L3 6z','M32 9l4-3 3 4v21l-4 4-3-4z','M32 38l3-4 4 4v21l-3 4-4-4z','M7 59h24l4 4-4 4H7l-4-4z','M0 38l3-4 4 4v21l-4 4-3-4z','M0 10l3-4 4 3v22l-4 4-3-4z','M7 30h24l4 4-4 4H7l-4-4z'];
function buildBoard(){$('seven-segments').innerHTML=Array.from({length:4},(_,digit)=>`<svg viewBox="-1 0 47 70" aria-hidden="true">${segmentPaths.map((path,segment)=>`<path id="seg-${digit}-${segment}" d="${path}"/>`).join('')}<circle id="seg-${digit}-7" cx="43" cy="63" r="3"/></svg>`).join('');$('led-bank').innerHTML=Array.from({length:4},(_,i)=>`<span id="led-${i}" class="board-led" title="PC${12+i}"></span>`).join('');$('led-readout').innerHTML=Array.from({length:4},(_,i)=>`<span id="pin-${i}"><i></i>PC${12+i}</span>`).join('')}
function renderKeypad(){$('keypad').replaceChildren();for(let key=1;key<=9;key++){const button=document.createElement('button');button.dataset.key=key;const label=lab.keyLabels?.[key]||String(key);button.setAttribute('aria-label',`按鍵 ${key}${label!==String(key)?' '+label:''}`);button.title=`ScanKey() = ${key}`;if(label!==String(key)){const number=document.createElement('small');number.textContent=key;button.append(number)}const text=document.createElement('span');text.textContent=label;button.append(text);button.addEventListener('pointerdown',event=>{event.preventDefault();button.setPointerCapture(event.pointerId);pressKey(key)});button.addEventListener('pointerup',()=>releaseKey(key));button.addEventListener('pointercancel',()=>releaseKey(key));button.addEventListener('lostpointercapture',()=>releaseKey(key));$('keypad').append(button)}}
function pressKey(key){if(keys.has(key))return;keys.add(key);$(`keypad`).querySelector(`[data-key="${key}"]`)?.classList.add('pressed');addEvent(`按下 ${lab.keyLabels?.[key]||key}（${key}）`)}
function releaseKey(key){if(!keys.has(key))return;keys.delete(key);$('keypad').querySelector(`[data-key="${key}"]`)?.classList.remove('pressed');addEvent(`放開按鍵 ${key}`)}
function releaseKeys(){for(const key of [...keys])releaseKey(key)}
function resetBoard(){currentFrame={timeUs:0,leds:[0,0,0,0],ledMask:0,segments:Array.from({length:4},()=>({mask:0,duty:Array(8).fill(0)})),buzzer:{active:false,frequency:0},display:'    '};drawFrame(currentFrame)}
function drawFrame(frame){currentFrame=frame;frame.leds.forEach((value,i)=>{$(`led-${i}`).classList.toggle('on',!!value);$(`pin-${i}`).classList.toggle('on',!!value)});frame.segments.forEach((digit,i)=>{for(let seg=0;seg<8;seg++){const node=$(`seg-${i}-${seg}`);const lit=!!(digit.mask&(1<<seg));node.classList.toggle('lit',lit);node.style.opacity=lit?Math.min(1,.5+digit.duty[seg]*1.5):1}});$('buzzer-device').classList.toggle('active',!!frame.buzzer.active);$('sim-time').textContent=(frame.timeUs/1e6).toFixed(2)+' s';$('seven-segments').setAttribute('aria-label',`七段顯示器 ${frame.display||'全暗'}`);updateAudio();const signature=`${frame.ledMask}|${frame.display}|${frame.buzzer.active}`;if(simulation&&signature!==lastBoardSignature){addEvent(`LED ${frame.leds.map(v=>v?'1':'0').join('')} · 顯示 ${frame.display.trim()||'全暗'}${frame.buzzer.active?' · 蜂鳴器啟動':''}`);lastBoardSignature=signature}}
function addEvent(message){events.push({timeUs:currentFrame?.timeUs||0,message});events=events.slice(-160);renderEvents()}
function renderEvents(){$('console-events').replaceChildren();if(!events.length){$('console-events').textContent='執行程式後，會記錄按鍵與板子反應。';return}for(const event of events.slice().reverse()){const row=document.createElement('div');row.className='event-row';const time=document.createElement('time');time.textContent=(event.timeUs/1e6).toFixed(2)+'s';const label=document.createElement('span');label.textContent=event.message;row.append(time,label);$('console-events').append(row)}}
function boardStatus(text,type='muted'){$('simulation-status').textContent=text;$('simulation-status').className='badge panel-heading-meta '+type}
function setOutput(message,type=''){$('console-output').replaceChildren();const pre=document.createElement('div');pre.className=type;pre.textContent=message;$('console-output').append(pre)}
function selectConsole(name){document.querySelectorAll('[data-console]').forEach(button=>button.classList.toggle('active',button.dataset.console===name));for(const id of ['output','results','events'])$(`console-${id}`).hidden=id!==name}
async function stopSimulation(){++generation;playing=false;clearTimeout(loopTimer);releaseKeys();updateAudio();const previous=simulation;simulation=null;$('pause-button').disabled=true;$('stop-button').disabled=true;$('reset-button').disabled=true;$('pause-button').innerHTML=icon('pause');boardStatus('待執行');if(previous){try{await api(`/api/simulations/${previous}`,null,'DELETE')}catch{}}}
async function runSimulation(){if(runBusy||judgeBusy)return;capture();persist();runBusy=true;$('run-button').disabled=true;await stopSimulation();const token=++generation;boardStatus('編譯中','running');$('run-status').textContent='正在編譯…';selectConsole('output');try{const result=await api('/api/simulations',payload());if(token!==generation){if(result.id)await api(`/api/simulations/${result.id}`,null,'DELETE');return}if(result.verdict==='CE'){codeEditor.setDiagnostics(result.message,lab.id,work.files);setOutput(result.message,'error');boardStatus('編譯錯誤','error');$('run-status').textContent='編譯未通過';return}codeEditor.setDiagnostics(result.warnings,lab.id,work.files);simulation=result.id;playing=true;events=[];lastBoardSignature='';drawFrame(result.frame);setOutput(result.warnings||'C 程式編譯通過。\n在模擬板按住／放開按鍵，觀察你的程式反應。',result.warnings?'warning':'');boardStatus('執行中','running');$('run-status').textContent='模擬執行中';$('pause-button').disabled=false;$('stop-button').disabled=false;$('reset-button').disabled=false;loop(token)}catch(error){setOutput(error.message,'error');boardStatus('未完成','error');$('run-status').textContent='執行未完成'}finally{runBusy=false;$('run-button').disabled=false}}
async function loop(token){if(!playing||!simulation||token!==generation)return;const id=simulation;stepping=true;try{const result=await api(`/api/simulations/${id}/step`,{keys:[...keys],durationUs:Math.max(1000,Math.round(33333*Number($('speed').value)))});if(token!==generation)return;drawFrame(result.frame);if(result.logs?.length)setOutput(result.logs.join('\n'));if(result.frame.finished){playing=false;boardStatus('程式結束');$('run-status').textContent='程式已結束';$('pause-button').disabled=true;updateAudio();return}}catch(error){if(token!==generation)return;setOutput(error.message,'error');await stopSimulation();boardStatus('執行錯誤','error');$('run-status').textContent='執行未完成'}finally{stepping=false}if(playing&&token===generation)loopTimer=setTimeout(()=>loop(token),33)}
async function pollJob(id,progress){while(true){const job=await api(`/api/jobs/${id}`);if(job.status==='error')throw Error(job.error);if(job.status==='done')return job.result;progress?.(job.progress);await new Promise(resolve=>setTimeout(resolve,650))}}
function renderResults(result){$('console-results').replaceChildren();$('result-count').textContent='';if(!result){$('console-results').textContent='自動評測會操作按鍵，逐項檢查題目要求。';return}if(result.verdict==='CE'){setOutput(result.message,'error');$('console-results').textContent='請先修正編譯錯誤。';return}if(work.result===result&&!currentResult()){const note=document.createElement('p');note.className='stale-result warning';note.textContent='程式或設定已修改，下列為舊版本的結果，請重新評測。';$('console-results').append(note)}const summary=document.createElement('div');summary.className='result-summary'+(result.verdict==='AC'?'':' failed');const verdict=document.createElement('strong');verdict.textContent=result.verdict==='AC'?'全部通過':'需要再調整';const count=document.createElement('span');count.textContent=`${result.passedCases} / ${result.totalCases} 通過`;summary.append(verdict,count);$('console-results').append(summary);$('result-count').textContent=` ${result.passedCases}/${result.totalCases}`;for(const item of result.cases||[]){const row=document.createElement('div');row.className='case-row'+(item.passed?'':' failed');const mark=document.createElement('span');mark.className='case-icon';mark.innerHTML=icon(item.passed?'check':'x');const body=document.createElement('div');body.textContent=item.name;if(!item.passed){const detail=document.createElement('p');detail.textContent=`預期：${item.expected}\n實際：${item.actual}`;body.append(detail)}row.append(mark,body);$('console-results').append(row)}}
async function grade(){
  if(judgeBusy||runBusy)return;
  capture();persist();await stopSimulation();judgeBusy=true;
  const origin=lab.id,originWork=work,hash=fingerprint();
  $('judge-button').disabled=true;boardStatus('評測中','running');
  $('run-status').textContent='正在準備測試…';selectConsole('results');
  $('console-results').textContent='評測會使用虛擬時間操作按鍵，請稍候。';
  try{
    const job=await api('/api/judge',payload());
    const result=await pollJob(job.jobId,message=>{if(lab.id===origin)$('run-status').textContent=message});
    const destination=lab.id===origin?work:readStorage(`nuc140:work:${origin}`,originWork);
    destination.result=result;destination.resultHash=hash;
    writeStorage(`nuc140:work:${origin}`,destination);buildLabList();
    if(lab.id!==origin)return;
    codeEditor.setDiagnostics(result.message||result.warnings,lab.id,work.files);renderResults(result);if(result.verdict==='CE')selectConsole('output');
    if(result.lastFrame)drawFrame(result.lastFrame);
    boardStatus(result.verdict==='AC'?'通過':result.verdict==='CE'?'編譯錯誤':'待調整',result.verdict==='AC'?'good':'error');
    $('run-status').textContent=currentResult()?'評測完成':'結果屬於評測開始時的程式版本';persist();
  }catch(error){
    if(lab.id===origin){$('console-results').textContent=error.message;boardStatus('評測未完成','error');$('run-status').textContent='評測未完成'}
  }finally{judgeBusy=false;$('judge-button').disabled=false}
}
async function exportKeil(){capture();persist();try{const response=await fetch('/api/export',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload())});if(!response.ok)throw Error((await response.json()).error);const url=URL.createObjectURL(await response.blob());const anchor=document.createElement('a');anchor.href=url;anchor.download=`nuc140-${lab.id}-keil.zip`;document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);toast('Keil 專案已匯出，包含你的程式與必要 BSP。')}catch(error){toast(error.message)}}
function renderMarkdown(container,text){MentorMarkdown.renderMarkdown(container,text)}
function renderChat(){const chat=$('chat-messages');if(!work.chat.length){chat.innerHTML='<div class="mentor-welcome"><div class="mentor-avatar">'+icon('mentor')+'</div><h3>一起看懂板子的反應</h3><p>可以問我程式怎麼運作、按鍵為什麼重複觸發，或請我分析評測沒有通過的原因。</p><button id="analyze-button" class="button">'+icon('spark')+'分析目前程式</button></div>';$('analyze-button').onclick=()=>sendMentor('請分析我的程式思路，並根據目前模擬與評測紀錄指出需要調整的地方。先給提示，讓我自己修改。');return}chat.replaceChildren();for(const message of work.chat){const article=document.createElement('article');article.className='chat-message '+message.role;const role=document.createElement('div');role.className='chat-role';role.innerHTML=icon(message.role==='user'?'file':'mentor')+(message.role==='user'?'你':'AI 導師');const body=document.createElement('div');body.className='chat-body';renderMarkdown(body,message.content);article.append(role,body);chat.append(article)}if(mentorBusy){const pending=document.createElement('p');pending.className='small muted';pending.textContent='導師正在閱讀程式與板子紀錄…';chat.append(pending)}chat.scrollTop=chat.scrollHeight}
async function sendMentor(message){
  if(mentorBusy)return;
  message=message.trim();if(!message)return;
  if(message.length>4000){toast('提問請控制在 4000 字內。');return}
  capture();
  const origin=lab.id,originWork=work,history=work.chat.filter(m=>m.role!=='error').slice(-8);
  const project=payload();let responseMessage;
  mentorBusy=true;work.chat.push({role:'user',content:message});work.chat=work.chat.slice(-40);
  $('chat-input').value='';$('send-chat').disabled=true;renderChat();persist();
  try{
    const job=await api('/api/mentor',{...project,message,history,context:{frame:currentFrame,events:events.slice(-35),result:work.result,resultCurrent:!!currentResult()}});
    const result=await pollJob(job.jobId);responseMessage={role:'assistant',content:result.reply};
  }catch(error){responseMessage={role:'error',content:error.message}}
  finally{
    mentorBusy=false;
    const destination=lab.id===origin?work:readStorage(`nuc140:work:${origin}`,originWork);
    destination.chat.push(responseMessage);destination.chat=destination.chat.slice(-40);
    writeStorage(`nuc140:work:${origin}`,destination);
    $('send-chat').disabled=false;if(lab.id===origin)renderChat();
  }
}
function updateAudio(){if(!gain)return;const buzzer=currentFrame?.buzzer;const active=audioEnabled&&playing&&buzzer?.active;gain.gain.setTargetAtTime(active ? .025 : 0,audioContext.currentTime,.025);if(active)oscillator.frequency.setTargetAtTime(Math.max(100,Math.min(3000,buzzer.frequency||800)),audioContext.currentTime,.015)}
async function toggleAudio(){if(!audioContext){audioContext=new (window.AudioContext||window.webkitAudioContext)();oscillator=audioContext.createOscillator();oscillator.type='square';gain=audioContext.createGain();gain.gain.value=0;oscillator.connect(gain);gain.connect(audioContext.destination);oscillator.start()}await audioContext.resume();audioEnabled=!audioEnabled;$('audio-button').innerHTML=icon(audioEnabled?'volume':'volume-off');$('audio-button').title=audioEnabled?'關閉蜂鳴器聲音':'開啟蜂鳴器聲音';$('audio-button').setAttribute('aria-label',$('audio-button').title);updateAudio()}
function setTheme(theme){document.documentElement.dataset.theme=theme;codeEditor?.setTheme(theme);try{localStorage.setItem('nuc140:theme',theme)}catch{}$('theme-button').innerHTML=icon(theme==='dark'?'sun':'moon');const label=theme==='dark'?'切換淺色模式':'切換深色模式';$('theme-button').title=label;$('theme-button').setAttribute('aria-label',label)}
const workPanels={
  sidebar:{panel:'lab-sidebar',body:'sidebar-content',divider:'sidebar-divider',toggle:'sidebar-toggle',label:'實驗題庫',storage:'nuc140:sidebarHidden',horizontal:true},
  problem:{panel:'problem-panel',body:'problem-content',divider:'problem-divider',toggle:'problem-toggle',label:'題目說明',storage:'nuc140:problemHidden',horizontal:true},
  simulator:{panel:'simulator-panel',body:'simulator-content',toggle:'simulator-toggle',label:'模擬開發板',storage:'nuc140:simulatorHidden'},
  mentor:{panel:'mentor-panel',body:'mentor-content',toggle:'mentor-toggle',label:' AI 程式導師',storage:'nuc140:mentorHidden'},
};
const isMobileWorkspace=()=>matchMedia('(max-width:1130px)').matches;
const isWorkPanelCollapsed=name=>$(workPanels[name].panel).classList.contains('is-collapsed');
function syncWorkPanelControls(){
  for(const [name,settings] of Object.entries(workPanels)){
    const collapsed=isWorkPanelCollapsed(name),button=$(settings.toggle);
    const label=(collapsed?'展開':'收合')+settings.label;
    button.title=label;button.setAttribute('aria-label',label);button.setAttribute('aria-expanded',String(!collapsed));
    button.innerHTML=icon(settings.horizontal?(collapsed?'expand-right':'collapse-left'):(collapsed?'expand-down':'collapse-up'));
  }
}
function selectMobilePanel(name){
  document.querySelector('.workspace').dataset.mobilePanel=name;
  document.querySelectorAll('[data-mobile]').forEach(button=>button.classList.toggle('active',button.dataset.mobile===name));
  if(name==='problem')setWorkPanelCollapsed('problem',false);
  if(name==='right'&&isWorkPanelCollapsed('simulator')&&isWorkPanelCollapsed('mentor'))setWorkPanelCollapsed('simulator',false);
  syncWorkPanelControls();
}
function setWorkPanelCollapsed(name,collapsed,save=true){
  const settings=workPanels[name],body=$(settings.body),focusInside=body.contains(document.activeElement);
  $(settings.panel).classList.toggle('is-collapsed',collapsed);body.hidden=collapsed;
  if(settings.divider)$(settings.divider).hidden=collapsed;
  const simulatorCollapsed=isWorkPanelCollapsed('simulator'),mentorCollapsed=isWorkPanelCollapsed('mentor');
  $('right-panel').classList.toggle('simulator-collapsed',simulatorCollapsed);
  $('right-panel').classList.toggle('mentor-collapsed',mentorCollapsed);
  $('right-panel').classList.toggle('all-collapsed',simulatorCollapsed&&mentorCollapsed);
  $('right-divider').hidden=simulatorCollapsed&&mentorCollapsed;
  const active=document.querySelector('.workspace').dataset.mobilePanel;
  if(isMobileWorkspace()&&((name==='problem'&&collapsed&&active==='problem')||(simulatorCollapsed&&mentorCollapsed&&active==='right')))selectMobilePanel('editor');
  if(save)writeStorage(settings.storage,collapsed);
  syncWorkPanelControls();
  if(collapsed&&focusInside)$(settings.toggle).focus({preventScroll:true});
}
function toggleWorkPanel(name){
  const collapsed=!isWorkPanelCollapsed(name);
  setWorkPanelCollapsed(name,collapsed);
  if(!collapsed&&isMobileWorkspace()){
    if(name==='problem')selectMobilePanel('problem');
    else if(name==='simulator'||name==='mentor')selectMobilePanel('right');
  }
}
function restoreWorkPanels(){
  for(const [name,settings] of Object.entries(workPanels))setWorkPanelCollapsed(name,readStorage(settings.storage,false)===true,false);
}
$('reindent-button').onclick=()=>codeEditor.reindent();$('editor-help-button').onclick=()=>$('editor-help-dialog').showModal();
$('theme-button').onclick=()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');$('run-button').onclick=runSimulation;$('judge-button').onclick=grade;$('export-button').onclick=exportKeil;$('stop-button').onclick=()=>stopSimulation().then(()=>$('run-status').textContent='模擬已停止');$('reset-button').onclick=runSimulation;
$('pause-button').onclick=()=>{if(!simulation)return;playing=!playing;$('pause-button').innerHTML=icon(playing?'pause':'play');$('pause-button').title=playing?'暫停模擬':'繼續模擬';$('pause-button').setAttribute('aria-label',$('pause-button').title);boardStatus(playing?'執行中':'已暫停',playing?'running':'muted');updateAudio();if(playing&&!stepping)loop(generation)};
$('audio-button').onclick=()=>toggleAudio().catch(error=>toast(error.message));$('load-template').onclick=loadTemplate;$('save-version').onclick=()=>{snapshot();toast('已儲存全部檔案的版本。')};$('versions-button').onclick=showVersions;$('search').addEventListener('input',buildLabList);
$('sample-toggle').addEventListener('change',()=>{work.sampleEnabled=$('sample-toggle').checked;writeStorage('nuc140:sampleEnabled',work.sampleEnabled);persist();toast('已變更起始碼選擇；按「載入起始碼」建立新版本。')});$('sample-select').onchange=()=>{work.preferredSample=$('sample-select').value;persist();toast('範例已選擇；載入起始碼後才會套用。')};
$('import-file').onchange=async()=>{const file=$('import-file').files[0];if(!file)return;if(file.size>120000){toast('單一檔案請控制在 120KB 內。');return}snapshot('匯入檔案前');const name=FILES.includes(file.name)&&file.name!=='lab_config.h'?file.name:'main.c';work.files[name]=await file.text();showFile(name,false);persist();$('import-file').value='';toast(`已匯入 ${name}。`)};
document.querySelectorAll('[data-panel-toggle]').forEach(button=>button.onclick=()=>toggleWorkPanel(button.dataset.panelToggle));
window.addEventListener('resize',syncWorkPanelControls);
document.querySelectorAll('[data-console]').forEach(button=>button.onclick=()=>selectConsole(button.dataset.console));document.querySelectorAll('[data-mobile]').forEach(button=>button.onclick=()=>selectMobilePanel(button.dataset.mobile));
$('settings-button').onclick=()=>{for(const [name,value] of Object.entries(work.config))$('settings-form').elements[name].value=value;$('settings-dialog').showModal()};$('settings-form').onsubmit=event=>{event.preventDefault();capture();const values=new FormData(event.target);work.config={studentDigit:Number(values.get('studentDigit')),date:values.get('date'),direction:Number(values.get('direction')),initialSeconds:Number(values.get('initialSeconds'))};work.files['lab_config.h']=configHeader(work.config);if(activeFile==='lab_config.h')showFile(activeFile);persist();$('settings-dialog').close();toast('設定已儲存；重新執行程式後套用。')};document.querySelectorAll('.close-dialog').forEach(button=>button.onclick=()=>button.closest('dialog').close());
$('chat-form').onsubmit=event=>{event.preventDefault();sendMentor($('chat-input').value)};$('chat-input').onkeydown=event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();sendMentor(event.target.value)}};$('clear-chat').onclick=()=>{if(mentorBusy)return;work.chat=[];persist();renderChat()};
window.addEventListener('keydown',event=>{if(/^[1-9]$/.test(event.key)&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.target.matches('input,textarea,select')&&!event.target.closest('.monaco-editor')&&!event.repeat&&!document.querySelector('dialog[open]')){event.preventDefault();pressKey(Number(event.key))}});window.addEventListener('keyup',event=>{if(/^[1-9]$/.test(event.key))releaseKey(Number(event.key))});window.addEventListener('blur',releaseKeys);window.addEventListener('beforeunload',persist);
document.querySelectorAll('[data-resize]').forEach(divider=>divider.addEventListener('pointerdown',event=>{event.preventDefault();const panel=divider.dataset.resize==='sidebar'?document.querySelector('.sidebar'):$(divider.dataset.resize),start=event.clientX,width=panel.getBoundingClientRect().width,reverse=divider.dataset.resize==='right-panel';divider.setPointerCapture(event.pointerId);divider.classList.add('dragging');const move=moveEvent=>{const next=Math.max(reverse?310:135,Math.min(reverse?600:520,width+(moveEvent.clientX-start)*(reverse?-1:1)));panel.style.width=next+'px'};const end=()=>{divider.classList.remove('dragging');divider.removeEventListener('pointermove',move);divider.removeEventListener('pointerup',end);divider.removeEventListener('pointercancel',end);writeStorage(`nuc140:width:${divider.dataset.resize}`,panel.style.width)};divider.addEventListener('pointermove',move);divider.addEventListener('pointerup',end);divider.addEventListener('pointercancel',end)}));
async function init(){setTheme(document.documentElement.dataset.theme);buildBoard();restoreWorkPanels();try{codeEditor=ArenaEditor.createWorkbench($('editor-host'),{onChange:()=>{capture();cursorPosition();scheduleSave()},onCursor:cursorPosition,onSave:()=>{persist();toast('作答已儲存。')},onRun:runSimulation});[labs]=await Promise.all([api('/api/labs')]);const selected=readStorage('nuc140:lastLab','lab1-1');await selectLab(labs.some(item=>item.id===selected)?selected:'lab1-1');const env=await api('/api/environment');$('compiler-status').textContent=env.gcc?'GCC '+(env.gccVersion.match(/\d+\.\d+(?:\.\d+)?/)?.[0]||'就緒'):'GCC 未找到';$('compiler-status').className='badge '+(env.gcc?'good':'error');$('agy-status').textContent=env.agy?'agy 已找到':'agy 未找到';$('agy-status').title='AI 呼叫仍需本機 CLI 登入與網路';for(const name of ['sidebar','problem-panel','right-panel']){const width=readStorage(`nuc140:width:${name}`,null);if(width)(name==='sidebar'?document.querySelector('.sidebar'):$(name)).style.width=width}}catch(error){setOutput('平台載入失敗：'+error.message,'error');toast(error.message)}}
function initConsoleResize(){
  const divider=$('console-divider'),panel=$('console-panel'),editor=$('code-editor');
  const storageKey='nuc140:height:console';
  let preferredHeight=readStorage(storageKey,null),drag=null;
  if(!Number.isFinite(preferredHeight)||preferredHeight<=0)preferredHeight=null;
  const bounds=()=>{
    const min=parseFloat(getComputedStyle(panel).minHeight)||104;
    const codeMin=parseFloat(getComputedStyle(editor).minHeight)||120;
    const available=panel.getBoundingClientRect().height+editor.getBoundingClientRect().height;
    return {min,max:Math.max(min,Math.floor(available-codeMin))};
  };
  const setHeight=value=>{
    const {min,max}=bounds(),height=Math.round(Math.max(min,Math.min(max,value)));
    panel.style.height=height+'px';
    divider.setAttribute('aria-valuemin',min);
    divider.setAttribute('aria-valuemax',max);
    divider.setAttribute('aria-valuenow',height);
    divider.setAttribute('aria-valuetext',`輸出區高度 ${height} 像素`);
    return height;
  };
  const refresh=()=>{
    if(!editor.getBoundingClientRect().height)return;
    if(preferredHeight===null)panel.style.height='';
    setHeight(preferredHeight??panel.getBoundingClientRect().height);
  };
  divider.addEventListener('pointerdown',event=>{
    if(event.button!==0||!event.isPrimary||drag)return;
    event.preventDefault();
    drag={pointerId:event.pointerId,y:event.clientY,height:panel.getBoundingClientRect().height};
    divider.setPointerCapture(event.pointerId);
    divider.classList.add('dragging');
    document.body.classList.add('resizing-console');
  });
  divider.addEventListener('pointermove',event=>{
    if(drag?.pointerId===event.pointerId)preferredHeight=setHeight(drag.height+drag.y-event.clientY);
  });
  const finish=event=>{
    if(drag?.pointerId!==event.pointerId)return;
    drag=null;
    divider.classList.remove('dragging');
    document.body.classList.remove('resizing-console');
    if(divider.hasPointerCapture(event.pointerId))divider.releasePointerCapture(event.pointerId);
    preferredHeight=panel.getBoundingClientRect().height;
    writeStorage(storageKey,preferredHeight);
  };
  for(const type of ['pointerup','pointercancel','lostpointercapture'])divider.addEventListener(type,finish);
  divider.addEventListener('keydown',event=>{
    const {min,max}=bounds(),height=panel.getBoundingClientRect().height;
    const next={ArrowUp:height+20,ArrowDown:height-20,Home:min,End:max}[event.key];
    if(next===undefined)return;
    event.preventDefault();
    preferredHeight=setHeight(next);
    writeStorage(storageKey,preferredHeight);
  });
  new ResizeObserver(refresh).observe(document.querySelector('.editor-panel'));
  refresh();
}
initConsoleResize();
initMentorResize();
init();

// Real-time production combat: retain particles, text, lightning and all rendering.
// Timing depends on the recorded renderer/hardware; this is not a universal FPS claim.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';

const label=process.argv[2] || 'mech';
const root=process.argv[3] || resolve('.');
const {startServer}=await import(pathToFileURL(resolve(root,'tools/serve.mjs')));
const {server,url}=await startServer(0);
const browser=await chromium.launch({args:['--ignore-gpu-blocklist']});
try {
  const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    const raf=window.requestAnimationFrame.bind(window);
    window.__combatPerf={frames:[],longTasks:[],samples:[],last:0,active:false};
    window.requestAnimationFrame=callback=>raf(ts=>{
      const p=window.__combatPerf,start=performance.now();callback(ts);
      if(p.active) {if(p.last)p.frames.push({interval:ts-p.last,cpu:performance.now()-start});p.last=ts;}
    });
    new PerformanceObserver(list=>{
      if(window.__combatPerf.active) for(const task of list.getEntries())window.__combatPerf.longTasks.push(task.duration);
    }).observe({type:'longtask',buffered:true});
  });
  await page.goto(url+'/stand.html');await page.locator('[data-act="play"]').click();
  await page.waitForFunction(()=>window.__stand?.game.state?.phase==='play');
  await page.evaluate(()=>{
    const g=window.__stand.game,p=window.__combatPerf;
    p.active=true;let decisionAt=0,lastSecond=-1,left=false,right=false;
    const key=(name,down)=>window.dispatchEvent(new KeyboardEvent(down?'keydown':'keyup',{key:name,bubbles:true}));
    const priorities=(id,levels)=>{
      const n=levels[id]||0;
      if(id==='NDR'&&!n)return 22;if(id==='XDR'&&!n)return 21;if(id==='HCI'&&n<2)return 18-n;
      return ({EDR:3,MDR:3,AF:2,NDR:2,XDR:2,IAG:1,HCI:3,ASTOR:1,AI:2}[id]-n)*3+
        ({EDR:2,MDR:3,AF:1,NDR:2,XDR:0,IAG:0,HCI:1,ASTOR:0,AI:0}[id]||0);
    };
    const timer=setInterval(()=>{
      const s=g.state;
      if(s.choices.length) g.chooseUpgrade([...s.choices].sort((a,b)=>priorities(b.id,s.levels)-priorities(a.id,s.levels))[0].id);
      if(s.elapsed>=decisionAt && s.phase==='play') {
        decisionAt=s.elapsed+.2;
        const lead=[...s.enemies].filter(e=>e.spec.dmg&&e.y>0).sort((a,b)=>b.y-a.y)[0];
        let x=lead?.x??s.op.x;const strike=s.enemies.find(e=>e.attack);
        const w=document.querySelector('#stCanvas').clientWidth,field=Math.min(440,Math.max(340,w*.92));
        if(strike)x=strike.attack.x<w/2?w/2+field/2-50:w/2-field/2+50;
        const l=x<s.op.x-8,r=x>s.op.x+8;
        if(l!==left){key('ArrowLeft',l);left=l;}if(r!==right){key('ArrowRight',r);right=r;}
        g.useAbility('pt');g.useAbility('rt');
        if(s.enemies.length>=3||s.base<8000)g.useAbility('wf');
        if(s.enemies.some(e=>e.spec.boss&&e.hp<e.maxhp*.65)||s.enemies.length>14||s.base<1500)g.useAbility('ir');
      }
      if(Math.floor(s.elapsed)!==lastSecond) {
        lastSecond=Math.floor(s.elapsed);
        p.samples.push({second:s.elapsed,enemies:s.enemies.length,shots:s.shots.length,parts:s.parts.length,texts:s.texts.length,effects:s.fxr.length,
          heap:performance.memory?.usedJSHeapSize,diagnostics:structuredClone(g.diagnostics)});
      }
      if(s.phase==='over') {p.active=false;clearInterval(timer);}
    },50);
  });
  // Progress is streamed so a complete two-minute run is visible to the caller.
  for(let i=0;i<24;i++) {
    await page.waitForTimeout(10000);
    const state=await page.evaluate(()=>({seconds:window.__stand.game.state.elapsed,phase:window.__stand.game.phase}));
    if(i%3===0)console.log(JSON.stringify({label,...state}));
    if(state.phase==='over')break;
  }
  const data=await page.evaluate(()=>{
    const p=window.__combatPerf,s=window.__stand.game.state;
    const gl=document.querySelector('#stCanvas').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');
    return {...p,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),
      seconds:s.elapsed,phase:s.phase,bosses:s.bossesKilled,health:s.base,levels:s.levels,diagnostics:window.__stand.game.diagnostics};
  });
  const percentile=(values,p)=>[...values].sort((a,b)=>a-b)[Math.min(values.length-1,Math.floor(values.length*p))]||0;
  const intervals=data.frames.map(f=>f.interval),cpu=data.frames.map(f=>f.cpu);
  const result={label,renderer:data.renderer,seconds:data.seconds,phase:data.phase,bosses:data.bosses,health:data.health,levels:data.levels,
    frames:data.frames.length,p50Frame:percentile(intervals,.5),p95Frame:percentile(intervals,.95),p99Frame:percentile(intervals,.99),
    p95CallbackCPU:percentile(cpu,.95),framesOver50ms:intervals.filter(x=>x>50).length,longTasks:data.longTasks,
    peak:Object.fromEntries(['enemies','shots','parts','texts','effects'].map(key=>[key,Math.max(...data.samples.map(s=>s[key]))])),samples:data.samples,errors};
  assert.equal(data.phase,'over');assert.deepEqual(errors,[]);
  assert.ok(result.peak.parts>0&&result.peak.texts>0&&result.peak.effects>0,'Actual combat effects must be present');
  await mkdir('tools/shots',{recursive:true});
  await writeFile(`tools/shots/stand-active-${label}.json`,JSON.stringify(result,null,2));
  await page.screenshot({path:`tools/shots/stand-active-${label}.png`});
  console.log(JSON.stringify({...result,samples:undefined,longTasks:undefined,longTaskCount:result.longTasks.length},null,2));
} finally {await browser.close();server.close();}

// Explicit visual fixtures, not natural-play or performance evidence.
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {startServer} from './serve.mjs';
// "before" routes only the original render files from the immutable base commit.
const label=process.argv[2]==='before'?'before':'after',dir='tools/shots/stand-matte';
await mkdir(dir,{recursive:true});
const {server,url}=await startServer(0),browser=await chromium.launch({args:['--ignore-gpu-blocklist']});
try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  if(label==='before') await page.route('**/src/stand/**',route=>{
    const file=new URL(route.request().url()).pathname.slice(1);
    if(['src/stand/engine.js','src/stand/sangfor-art.js','src/stand/mech-art.js','src/stand/stand.css'].includes(file))
      return route.fulfill({body:execFileSync('git',['show','04e9560:'+file],{encoding:'utf8'}),contentType:file.endsWith('.css')?'text/css':'text/javascript'});
    return route.continue();
  });
  await page.goto(url+'/stand.html');await page.locator('[data-act="play"]').click();
  const stage=async()=>{
    await page.evaluate(async()=>{
    const g=window.__stand.game;g.start();g.chooseUpgrade('HCI');
    for(const id of ['EDR','EDR','MDR','MDR','AF','NDR','XDR','IAG','HCI','ASTOR','AI','EDR','NDR'])g.applyUpgrade(id);
    const s=g.state,{ENEMIES}=await import('/src/stand/model.js');s.spawnAcc=-1e6;s.xpNeed=1e9;
    s.parts=[];s.fxr=[];s.texts=[];s.shake=0;s.flash=0;s.shots=[];
    s.enemies=['malware','apt','worm','ransom','exfil'].map((type,i)=>({id:97000+i,type,spec:ENEMIES[type],
      x:s.op.x+(i%3-1)*90,y:160+Math.floor(i/3)*150,r:ENEMIES[type].r,hp:100000,maxhp:100000,slow:0,hit:0,wob:0,marked:false}));
    });
    await page.waitForFunction(()=>document.querySelectorAll('.st-rail-item').length===9);
    await page.evaluate(()=>{const g=window.__stand.game;g.pause();g.state.parts=[];g.state.fxr=[];g.state.texts=[];g.state.shots=[];g.state.shake=0;g.state.flash=0;});
  };
  await stage();
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  await settle();await page.screenshot({path:`${dir}/${label}-desktop-FIXTURE.png`});
  await page.setViewportSize({width:390,height:844});await stage();await settle();
  await page.screenshot({path:`${dir}/${label}-phone-FIXTURE.png`});
  await page.setViewportSize({width:1000,height:900});
  await page.evaluate(async()=>{
    window.__stand.game.stop();
    const THREE=await import('/vendor/three/three.module.min.js');
    const {createSangforArt}=await import('/src/stand/sangfor-art.js');
    const {PRODUCT_MARKS}=await import('/src/ui/product-marks.js');
    const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1000,900);
    renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    document.body.replaceChildren(renderer.domElement);
    const style=document.createElement('style');style.textContent='body::before{display:none}body{margin:0}';document.head.append(style);
    const scene=new THREE.Scene();scene.background=new THREE.Color('#142826');
    scene.add(new THREE.HemisphereLight(0xe6eee5,0x20352e,1.6));
    const key=new THREE.DirectionalLight(0xfff3df,3);key.position.set(-4,8,-4);key.castShadow=true;scene.add(key);
    const rim=new THREE.DirectionalLight(0xa9d9cf,1.3);rim.position.set(4,4,3);scene.add(rim);
    const camera=new THREE.PerspectiveCamera(37,1000/900,.1,100);camera.position.set(4.6,3.8,-9.1);camera.lookAt(0,1.9,0);
    const loader=new THREE.TextureLoader(),load=async path=>{const t=await loader.loadAsync(path);t.colorSpace=THREE.SRGBColorSpace;return t;};
    const markTex=Object.fromEntries(await Promise.all(Object.entries(PRODUCT_MARKS).map(async([id,m])=>[id,await load('/assets/brand/products/sangfor-'+m[0])])));
    markTex.AI=markTex.AICP;
    const brandTex=await load('/assets/brand/sangfor-logo-white.png');
    const art=createSangforArt({scene,laneFrame:new THREE.Group(),renderer,markTex,brandTex,laneW:18,length:34,integrated:true});
    const op=art.operator();scene.add(op);
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshStandardMaterial({color:0x213b34,roughness:.9,metalness:0}));
    floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;floor.position.y=-.01;scene.add(floor);
    const s={elapsed:0,levels:{},shooters:[],workflow:null};
    const render=()=>{art.sync(s,{});renderer.render(scene,camera);};
    window.__matteFixture={s,render,art,renderer};render();
  });
  await page.screenshot({path:`${dir}/${label}-bare-close-FIXTURE.png`});
  await page.evaluate(()=>{const f=window.__matteFixture;f.s.levels={EDR:3,MDR:2,AF:1,NDR:2,XDR:2,HCI:2,ASTOR:1,IAG:1,AI:2};f.s.workflow={stage:0};f.render();});
  await page.screenshot({path:`${dir}/${label}-full-close-FIXTURE.png`});
  console.log(label+' visual fixtures captured');
} finally {await browser.close();server.close();}

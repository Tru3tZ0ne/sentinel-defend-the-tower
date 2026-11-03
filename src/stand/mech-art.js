// Original modular Sentinel chassis. Product marks remain official artwork.
import * as THREE from 'three';

export function createMechFactory({kit,instantiate,decal,labelTexture,markTex,brandTex,flash,networkChassis,serverChassis}) {
  let root=null, stage=0, moduleBuilds=0;
  const modules=new Map(), armor=new Map();
  function build() {
    if(root) return root;
    root=instantiate('sentinel-mech',()=>{
      const k=kit();
      for(const side of [-1,1]) {
        k.box(.47,.28,.86,side*.34,.16,.14,'black',.07);
        k.box(.42,.12,.63,side*.34,.35,.12,'metal',.035);
        k.rod([side*.34,.38,0],[side*.36,1.13,0],.16,.2,'metal',12);
        k.box(.33,.37,.3,side*.36,.72,-.08,'dark',.06);
        k.sphere(.2,side*.36,1.15,0,'black');
        k.sphere(.23,side*.65,2.04,0,'metal');
        k.rod([side*.68,1.96,0],[side*.8,1.38,.16],.14,.17,'dark',12);
        k.box(.27,.36,.35,side*.8,1.2,.19,'metal',.04);
      }
      k.box(.94,.41,.6,0,1.16,0,'dark',.07);
      k.box(1.05,.74,.65,0,1.81,0,'metal',.09);
      k.box(.78,.52,.11,0,1.87,-.37,'dark',.04);
      k.box(.47,.055,.025,0,2.01,-.44,'green',.008);
      k.rod([0,2.16,0],[0,2.4,0],.18,.14,'black');
      k.box(.6,.49,.54,0,2.63,0,'dark',.1);
      k.box(.5,.1,.075,0,2.68,.29,'cyan',.025);
      k.box(.19,.12,.09,0,2.4,.29,'metal',.015);
      k.box(.17,.15,.96,.8,1.3,.63,'dark',.025);
      return k.finish('sentinel:base-frame');
    });
    decal(root,brandTex,.62,.16,0,1.81,-.438);
    flash(root,.8,1.3,1.2); root.name='sentinel:mech';return root;
  }
  function armorFrame(tier) {
    return instantiate('sentinel-armor:'+tier,()=>{
      const k=kit();
      for(const s of [-1,1]) {
        if(tier===1) {
          k.box(.48,.52,.44,s*.37,.78,-.02,'armor',.075);
          k.box(.67,.52,.72,s*.78,2.17,0,'armor',.08,[0,0,s*.12]);
          k.box(.47,.085,.03,s*.78,2.25,-.39,'green',.01);
        } else if(tier===2) {
          k.box(.43,.49,.52,s*.86,1.37,.11,'armor',.08);
          k.box(.31,.37,.13,s*.36,1.18,-.37,'armor',.05,[0,0,s*.12]);
          k.box(.22,.65,.23,s*.43,1.94,.36,'dark',.04);
          k.rod([s*.43,1.61,.42],[s*.43,2.26,.42],.11,.14,'cyan');
        } else {
          k.box(.35,1.1,.22,s*.96,2.15,-.58,'armor',.05,[0,0,-s*.28]);
          k.box(.06,.86,.04,s*.98,2.18,-.71,'cyan',.008,[0,0,-s*.28]);
          k.box(.36,.23,.68,s*.37,.23,.24,'armor',.06);
          k.rod([s*.23,2.85,0],[s*.56,3.12,.04],.045,.015,'metal');
        }
      }
      if(tier===1) k.box(.86,.4,.16,0,1.9,.4,'armor',.07);
      if(tier===2) {k.box(.43,.36,.17,0,1.93,.5,'dark',.05);k.sphere(.12,0,1.95,.61,'green');}
      return k.finish('sentinel:armor:'+tier);
    });
  }
  const anchors={EDR:[.94,2.35,.18],MDR:[-.85,1.42,.3],AF:[-1.08,1.58,-.05],NDR:[0,3.03,0],
    HCI:[-.6,1.94,-.53],XDR:[0,2.05,-.72],ASTOR:[.54,1.07,-.45],IAG:[-.48,.62,-.3],AI:[.58,2.33,-.47],AGENT:[.85,1.32,-.12]};
  function module(id) {
    const g=new THREE.Group(),k=kit();
    if(id==='EDR') {
      networkChassis(k,.25,.94,.78);
      for(const s of [-1,1]) {k.rod([s*.22,.37,.12],[s*.22,.37,1.35],.1,.07,'metal',12);k.ring(.1,.02,s*.22,.37,1.27,'cyan',[Math.PI/2,0,0]);}
    } else if(id==='MDR') {
      k.box(.44,.42,.65,0,0,0,'dark',.06);k.rod([0,.02,.25],[0,.02,1.1],.13,.08,'metal',12);
      k.box(.04,.27,.12,-.25,0,.03,'green',.008);
    } else if(id==='AF') {
      k.box(.12,.95,.69,0,0,0,'white',.06);k.box(.07,.72,.47,-.1,0,0,'dark',.04);
      for(const y of [-.26,0,.26]) k.rod([-.17,y,-.27],[-.17,y,.27],.035,.035,'green');
    } else if(id==='NDR') {
      k.rod([0,-.28,0],[0,.1,0],.075,.06,'metal');
      k.box(.79,.32,.18,0,.13,0,'dark',.045);k.box(.67,.12,.03,0,.16,-.12,'cyan',.01);
      for(const s of [-1,1]) k.rod([s*.3,.25,0],[s*.38,.61,0],.025,.012,'metal');
    } else if(id==='HCI'||id==='ASTOR') {
      serverChassis(k,id==='ASTOR');
    } else if(id==='XDR') {
      networkChassis(k,.03,1.13,.54);
      k.box(1.05,.7,.48,0,.46,.01,'dark',.065);
      k.box(.94,.68,.04,0,.48,-.38,'black',.025);
      for(const s of [-1,1]) {k.rod([s*.48,.3,.12],[s*.56,.92,.16],.07,.045,'metal');k.ring(.1,.025,s*.48,.2,-.04,'green');}
    } else if(id==='AI') {
      k.box(.43,.57,.4,0,0,0,'white',.055);k.sphere(.15,0,.03,-.24,'cyan');
      for(let i=0;i<4;i++) k.box(.3,.025,.025,0,-.19+i*.11,-.23,'dark',.003);
    } else if(id==='AGENT') {
      k.box(.53,.4,.16,0,0,0,'dark',.05);
      for(const x of [-.16,0,.16]) k.box(.09,.12,.02,x,.02,-.1,'cyan',.008);
      k.box(.37,.02,.015,0,.02,-.12,'metal',.002);
    } else {
      k.box(.37,.49,.35,0,0,0,'dark',.06);k.box(.27,.05,.025,0,.09,-.21,'amber',.006);
    }
    g.add(k.finish('sentinel:module:'+id));
    if(id==='HCI'||id==='ASTOR') g.children[0].scale.setScalar(.36);
    const logo=markTex[id];
    const logoY=id==='XDR'?.61:id==='EDR'?.24:id==='HCI'||id==='ASTOR'?.35:0;
    const logoZ=id==='XDR'?-.41:id==='EDR'?-.43:id==='HCI'||id==='ASTOR'?-.34:-.28;
    if(logo) decal(g,logo,id==='XDR'?.3:.23,id==='XDR'?.3:.23,0,logoY,logoZ);
    decal(g,labelTexture(id==='NDR'?'CC':id),id==='XDR'?.76:.37,id==='XDR'?.19:.1,0,logoY-.29,logoZ-.01);
    g.position.set(...anchors[id]);g.name='sentinel:module:'+id;
    if(id==='EDR'||id==='MDR') flash(g,0,id==='EDR'?.37:.02,id==='EDR'?1.4:1.15);
    return g;
  }
  function sync(S) {
    if(!root) return;
    const total=Object.values(S.levels).reduce((a,b)=>a+b,0);
    stage=total>=14?3:total>=7?2:total>=3?1:0;
    for(let tier=1;tier<=stage;tier++) if(!armor.has(tier)) {const g=armorFrame(tier);armor.set(tier,g);root.add(g);moduleBuilds++;}
    for(const [tier,g]of armor) g.visible=tier<=stage;
    for(const [id,anchor]of Object.entries(anchors)) {
      const level=S.levels[id]||0;
      if(level&&!modules.has(id)) {const g=module(id);modules.set(id,g);root.add(g);moduleBuilds++;}
      const g=modules.get(id);if(!g)continue;g.visible=level>0;
      if(level) {
        const scale=id==='XDR'?1:1+Math.min(4,level-1)*.045;
        g.scale.setScalar(scale);g.position.set(...anchor);
        if(g.userData.flash) {const kind=id==='EDR'?'edr':'mdr';let muzzle=0;for(const sh of S.shooters)if(sh.kind===kind)muzzle=Math.max(muzzle,sh.muzzle||0);g.userData.flash.visible=muzzle>.05;g.userData.flash.material.opacity=muzzle*.85;}
      }
    }
    root.rotation.y=Math.sin(S.elapsed*.7)*.025;
    root.scale.setScalar(1+stage*.065);
  }
  return {build,sync,get diagnostics(){return {stage,moduleBuilds,modules:[...modules].filter(([,g])=>g.visible).map(([id])=>id),groundDevices:0};}};
}

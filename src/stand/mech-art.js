// Original modular Sentinel chassis. Product marks remain official artwork.
import * as THREE from 'three';

export function createMechFactory({kit,instantiate,decal,labelTexture,markTex,brandTex,flash}) {
  let root=null, stage=0, moduleBuilds=0;
  const modules=new Map(), armor=new Map();
  function build() {
    if(root) return root;
    root=instantiate('sentinel-mech',()=>{
      const k=kit();
      for(const side of [-1,1]) {
        k.box(.4,.2,.83,side*.34,.13,.15,'black',.08);
        k.box(.35,.14,.51,side*.34,.26,.25,'armor',.06,[.12,0,0]);
        k.rod([side*.34,.33,0],[side*.36,.77,.03],.13,.17,'dark');
        k.sphere(.22,side*.36,.8,.01,'metal',[1,.9,.9]);
        k.rod([side*.36,.85,0],[side*.3,1.28,0],.19,.24,'armor');
        k.rod([side*.23,.39,-.14],[side*.23,.78,-.16],.035,.035,'metal');
        k.rod([side*.46,.9,-.12],[side*.4,1.26,-.13],.045,.03,'metal');
        k.ring(.18,.025,side*.36,.8,-.17,'black',[Math.PI/2,0,0]);
        k.sphere(.23,side*.3,1.32,0,'black');
        k.sphere(.26,side*.64,2.12,0,'dark',[1,.9,1]);
        k.rod([side*.67,2.04,0],[side*.78,1.7,.05],.15,.19,'armor');
        k.sphere(.17,side*.79,1.67,.07,'black');
        k.rod([side*.8,1.61,.08],[side*.85,1.28,.23],.16,.12,'armor');
        k.rod([side*.67,1.93,-.14],[side*.78,1.62,-.1],.03,.025,'metal');
        k.box(.24,.23,.28,side*.85,1.21,.23,'dark',.07);
      }
      k.sphere(.43,0,1.34,0,'armor',[1.1,.5,.75]);
      k.rod([0,1.45,0],[0,1.67,0],.22,.28,'black');
      k.sphere(.63,0,1.92,0,'armor',[.86,.67,.6]);
      k.sphere(.43,0,1.94,-.3,'dark',[.9,.62,.32]);
      for(const side of [-1,1]) {
        k.box(.14,.48,.12,side*.39,1.91,-.3,'white',.045,[0,0,side*.18]);
        for(let j=0;j<3;j++)k.box(.12,.025,.025,side*.39,1.84+j*.07,-.38,'black',.005);
      }
      k.box(.39,.035,.025,0,2.06,-.44,'green',.006);
      k.rod([0,2.16,0],[0,2.4,0],.18,.14,'black');
      k.sphere(.34,0,2.63,0,'armor',[.9,.85,.85]);
      k.sphere(.31,0,2.64,-.095,'dark',[.91,.45,.73]);
      for(const side of [-1,1]) k.box(.075,.025,.025,side*.105,2.65,-.326,'cyan',.006);
      k.box(.5,.1,.075,0,2.68,.29,'black',.025);
      k.box(.31,.025,.08,0,2.69,.294,'green',.006);
      k.box(.19,.12,.09,0,2.4,.29,'dark',.015);
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
          k.box(.39,.45,.41,s*.37,.57,-.02,'armor',.09,[.1,0,s*.08]);
          k.sphere(.4,s*.73,2.14,0,'armor',[1,.72,.9]);
          k.box(.53,.12,.61,s*.77,2.31,0,'white',.055,[0,0,s*.2]);
          k.box(.47,.085,.03,s*.78,2.25,-.39,'green',.01);
        } else if(tier===2) {
          k.box(.37,.49,.48,s*.86,1.37,.11,'armor',.1,[.1,0,-s*.1]);
          k.box(.31,.37,.13,s*.36,1.18,-.37,'armor',.05,[0,0,s*.12]);
          k.box(.22,.65,.23,s*.43,1.94,.36,'dark',.04);
          k.rod([s*.43,1.61,.42],[s*.43,2.26,.42],.11,.14,'dark');
        } else {
          k.box(.35,1.1,.22,s*.96,2.15,-.58,'armor',.1,[0,0,-s*.28]);
          k.box(.04,.76,.04,s*.98,2.18,-.71,'green',.008,[0,0,-s*.28]);
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
      k.box(.9,.46,.78,0,.25,0,'white',.12);
      k.box(.67,.27,.065,0,.25,-.41,'dark',.04);
      for(const s of [-1,1]) {
        k.rod([s*.22,.37,.12],[s*.22,.37,.98],.11,.09,'dark',12);
        k.rod([s*.22,.37,.96],[s*.22,.37,1.35],.09,.07,'metal',12);
        k.ring(.1,.02,s*.22,.37,1.27,'cyan',[Math.PI/2,0,0]);
      }
    } else if(id==='MDR') {
      k.box(.44,.42,.65,0,0,0,'armor',.1);k.rod([0,.02,.25],[0,.02,1.1],.13,.08,'metal',12);
      k.box(.04,.27,.12,-.25,0,.03,'green',.008);
    } else if(id==='AF') {
      k.box(.65,.95,.16,0,0,0,'white',.075);k.box(.47,.72,.07,0,0,-.12,'dark',.04);
      for(const y of [-.26,.26]) k.box(.35,.025,.025,0,y,-.17,'green',.005);
    } else if(id==='NDR') {
      k.rod([0,-.28,0],[0,.1,0],.075,.06,'metal');
      k.box(.79,.32,.18,0,.13,0,'white',.06);k.box(.67,.12,.03,0,.16,-.12,'dark',.01);
      k.box(.5,.025,.025,0,.16,-.14,'cyan',.004);
      for(const s of [-1,1]) k.rod([s*.3,.25,0],[s*.38,.61,0],.025,.012,'metal');
    } else if(id==='HCI'||id==='ASTOR') {
      // Integrated blade/storage pods retain their device face without carrying
      // miniature rack ears and a complete server cabinet on the shoulder.
      k.box(.68,.8,.54,0,.28,0,'white',.12);
      k.box(.53,.62,.035,0,.29,-.29,'dark',.035);
      const rows=id==='ASTOR'?5:3;
      for(let i=0;i<rows;i++) {
        const y=.08+i*(.43/(rows-1));
        k.box(.38,.065,.022,.025,y,-.318,'black',.01);
        k.box(.025,.043,.026,-.21,y,-.32,id==='ASTOR'?'cyan':'green',.004);
      }
    } else if(id==='XDR') {
      k.box(1.05,.88,.6,0,.38,.01,'white',.14);
      k.box(.86,.66,.055,0,.48,-.32,'dark',.045);
      for(const s of [-1,1]) {
        k.box(.14,.62,.37,s*.51,.42,.03,'dark',.05);
        k.box(.035,.43,.08,s*.57,.45,-.1,'green',.01);
      }
    } else if(id==='AI') {
      k.box(.43,.57,.4,0,0,0,'white',.055);
      k.box(.32,.44,.025,0,0,-.218,'dark',.025);
      k.box(.13,.025,.025,0,.17,-.24,'cyan',.004);
    } else if(id==='AGENT') {
      k.box(.53,.4,.16,0,0,0,'white',.055);
      k.box(.45,.3,.025,0,0,-.09,'dark',.025);
      for(const x of [-.16,0,.16]) k.box(.09,.12,.02,x,.02,-.1,'cyan',.008);
      k.box(.37,.02,.015,0,.02,-.12,'metal',.002);
    } else {
      k.box(.37,.49,.35,0,0,0,'armor',.08);k.box(.27,.05,.025,0,.09,-.21,'amber',.006);
    }
    g.add(k.finish('sentinel:module:'+id));
    const logo=markTex[id];
    // Marks and names sit on the actual inset faces, never on hanging label boards.
    const faceZ={EDR:-.452,MDR:-.337,AF:-.19,NDR:-.16,HCI:-.34,ASTOR:-.34,XDR:-.356,AI:-.25,AGENT:-.125,IAG:-.19}[id];
    const logoY={EDR:.27,MDR:.045,AF:.065,NDR:.16,HCI:.35,ASTOR:.35,XDR:.61,AI:.035,IAG:0}[id]||0;
    const nameY={EDR:.07,MDR:-.145,AF:-.2,NDR:.16,HCI:.035,ASTOR:.035,XDR:.32,AI:-.16,AGENT:-.12,IAG:-.16}[id];
    const markSize=id==='XDR'?.3:id==='NDR'?.13:id==='AI'?.16:.21;
    if(logo) decal(g,logo,markSize,markSize,id==='NDR'?.22:0,logoY,faceZ);
    decal(g,labelTexture(id==='NDR'?'CC':id),id==='XDR'?.76:id==='NDR'?.23:id==='AI'?.28:.37,
      id==='XDR'?.19:.08,id==='NDR'?-.19:0,nameY,faceZ-.01);
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
      const level=id==='AGENT'?(S.workflow?1:0):(S.levels[id]||0);
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

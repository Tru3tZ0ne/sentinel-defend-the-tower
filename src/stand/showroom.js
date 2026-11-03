import * as THREE from 'three';
import { createSangforArt } from './sangfor-art.js?art=matte-arena-v1';
import { PRODUCT_MARKS } from '../ui/product-marks.js';

const official = 'https://www.sangfor.com/';
const profiles = {
  AF: ['Athena NGFW', 'Network protection', 'Silver front panel, recessed network ports and dark rack chassis. Barrier emitters are game attachments.', '银色前面板、凹入式网口与深色机架机身；屏障发射器为游戏附加结构。', 'cybersecurity/sangfor-athena-foundation/next-generation-firewall-ngfw', 'ngfw'],
  EDR: ['Endpoint Secure', 'Endpoint protection', 'A terminal with endpoint status and the official EPP mark identifies this game turret. EPP is endpoint software.', '终端状态屏与官方 EPP 标识用于识别这座游戏炮台。EPP 本身是终端保护软件。', 'cybersecurity/sangfor-athena-foundation/endpoint-protection-platform-epp'],
  NDR: ['Cyber Command', 'Network detection', 'A network appliance and directional sensor visualize visibility, threat marking and detection.', '网络设备与定向传感器表现网络可视化、威胁标记与检测能力。', 'cybersecurity/sangfor-athena-foundation/network-detection-and-response-ndr'],
  IAG: ['Secure Web Gateway', 'Web access protection', 'A wired gateway with copper ports, optical uplinks and link indicators supports the checkpoint effect.', '有线网关的铜缆网口、光纤上联与链路灯，对应游戏中的出口检查带。', 'cybersecurity/sangfor-athena-foundation/secure-web-gateway-swg'],
  HCI: ['aServer HCI', 'Cloud infrastructure', 'Rack handles, drive carriers, cyan release tabs and front ventilation follow the official aServer product image.', '机架把手、硬盘托架、青色释放卡扣与前部通风结构参考官网 aServer 产品图。', 'cloud-and-infrastructure/products/hci-hyper-converged-infrastructure', 'hci'],
  XDR: ['Athena XDR', 'Security operations', 'A correlation console and network appliance visualize sensor collaboration. The display is a game interface.', '关联控制台与网络设备表现传感器协同。屏幕内容为游戏界面。', 'cybersecurity/sangfor-athena-security-operations/extended-detection-and-response-xdr'],
  ASTOR: ['aStor', 'Enterprise storage', 'A dense storage chassis with twenty drive bays represents snapshots, resilience and recovery.', '高密度存储机箱与二十个硬盘托架表现快照、韧性和恢复。', 'cloud-and-infrastructure/products/astor-hybrid-flash-enterprise-data-storage-solution'],
  MDR: ['Athena MDR', 'Managed defense', 'A field specialist wears the Sangfor wordmark and MDR insignia. The operative represents a managed service.', '支援队员佩戴深信服标识与 MDR 徽章，表现托管安全服务。', 'cybersecurity/sangfor-athena-security-operations/managed-detection-and-response-mdr'],
};
let language = 'en'; try { language = localStorage.getItem('sentinel.lang') === 'zh' ? 'zh' : 'en'; } catch {}
let selected = 'AF';
const $ = id => document.getElementById(id), canvas = $('model');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x101b26); scene.fog = new THREE.Fog(0x101b26, 11, 30);
scene.add(new THREE.HemisphereLight(0xd7e7f9, 0x243140, 1.8));
const key = new THREE.DirectionalLight(0xffffff, 2.8); key.position.set(-3, 7, -4); key.castShadow = true;
key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -6; key.shadow.camera.right = 6;
key.shadow.camera.top = 6; key.shadow.camera.bottom = -6; key.shadow.bias = -.0005; scene.add(key);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: 0x060b11, roughness: .7, metalness: .15 }));
floor.rotation.x = -Math.PI / 2; floor.position.y = -.015; floor.receiveShadow = true; scene.add(floor);
const camera = new THREE.PerspectiveCamera(36, 1, .1, 100);
const loader = new THREE.TextureLoader(), markTex = {};
const load = async src => { const t = await loader.loadAsync(src); t.colorSpace = THREE.SRGBColorSpace; return t; };
await Promise.all(Object.entries(PRODUCT_MARKS).map(async ([id, mark]) => {
  markTex[id] = await load('assets/brand/products/sangfor-' + mark[0]);
}));
const brandTex = await load('assets/brand/sangfor-logo-white.png');
const art = createSangforArt({ scene, renderer, laneFrame: new THREE.Group(), markTex, brandTex, laneW: 18, length: 34 });
let model, yaw = 2.68, pitch = 1.03, zoom = 1, distance = 6;
const target = new THREE.Vector3();
const fitDecals = () => art.sync({ levels: {} }, { wX: x => x, wZ: y => y, fieldL: -9, fieldR: 9, baseY: 0, bandY: 0 });
function draw() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  const r = distance * zoom;
  camera.position.set(target.x + r * Math.sin(pitch) * Math.sin(yaw), target.y + r * Math.cos(pitch), target.z + r * Math.sin(pitch) * Math.cos(yaw));
  camera.lookAt(target); renderer.render(scene, camera);
}
function reset() {
  yaw = 2.68; pitch = 1.03; zoom = 1;
  const bounds = new THREE.Box3().setFromObject(model), size = bounds.getSize(new THREE.Vector3());
  bounds.getCenter(target);
  const vertical = Math.tan(camera.fov * Math.PI / 360), aspect = canvas.clientWidth / canvas.clientHeight;
  distance = Math.max(size.y / vertical, size.x / (vertical * aspect)) * .76 + size.z * .5;
  camera.aspect = aspect; camera.updateProjectionMatrix();
  const corners = [];
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y])
    for (const z of [bounds.min.z, bounds.max.z]) corners.push(new THREE.Vector3(x, y, z));
  for (let i = 0; i < 24; i++) {
    camera.position.set(target.x + distance * Math.sin(pitch) * Math.sin(yaw), target.y + distance * Math.cos(pitch), target.z + distance * Math.sin(pitch) * Math.cos(yaw));
    camera.lookAt(target); camera.updateMatrixWorld();
    if (corners.every(v => { const p = v.clone().project(camera); return Math.abs(p.x) < .88 && Math.abs(p.y) < .8 && p.z < 1; })) break;
    distance *= 1.08;
  }
  draw();
}
function relabel() {
  const zh = language === 'zh', p = profiles[selected]; document.documentElement.lang = language;
  $('title').textContent = zh ? '从产品出发，重新设计。' : 'Built around the product.';
  $('subtitle').textContent = zh ? '近距离检查机箱、接口与产品标识。' : 'Inspect the chassis, ports and product identity up close.';
  $('language').textContent = zh ? 'EN' : '中文'; $('back').textContent = zh ? '返回游戏' : 'Back to Last Stand';
  $('hint').textContent = zh ? '拖动旋转 · 滚轮缩放' : 'Drag to rotate · Scroll to zoom';
  $('reset').textContent = zh ? '重置视角' : 'Reset view';
  const categories = { 'Network protection': '网络防护', 'Endpoint protection': '终端保护', 'Network detection': '网络检测', 'Web access protection': '上网安全', 'Cloud infrastructure': '云基础设施', 'Security operations': '安全运营', 'Enterprise storage': '企业存储', 'Managed defense': '托管安全' };
  $('name').textContent = p[0]; $('category').textContent = zh ? categories[p[1]] : p[1].toUpperCase();
  canvas.setAttribute('aria-label', zh ? '拖动旋转装备；方向键旋转，加减键缩放。' : 'Drag to rotate equipment. Arrow keys rotate; plus and minus zoom.');
  $('products').setAttribute('aria-label', zh ? '选择装备' : 'Select equipment');
  $('description').textContent = p[zh ? 3 : 2];
  $('features').innerHTML = `<dt>${zh ? '产品' : 'Product'}</dt><dd>Sangfor ${p[0]}</dd><dt>${zh ? '游戏角色' : 'Game role'}</dt><dd>${selected}</dd>`;
  $('reference').innerHTML = p[5] ? `<span>${zh ? '官网产品参考图' : 'OFFICIAL PRODUCT REFERENCE'}</span><img src="assets/stand-sangfor/reference-${p[5]}.webp" alt="Sangfor ${p[0]} official product reference" />` : '';
  $('source').textContent = zh ? '查看官网产品页 ↗' : 'Official product page ↗'; $('source').href = official + p[4];
  $('concept').textContent = zh ? '基于产品特征创作的游戏装备。武器附加结构用于表现游戏机制。' : 'Product-inspired game equipment. Weapon attachments illustrate arcade mechanics.';
  $('products').innerHTML = Object.entries(profiles).map(([id, info]) => `<button type="button" data-model="${id}" aria-pressed="${id === selected}"><img src="assets/stand-sangfor/${id.toLowerCase()}.webp?art=matte-v1" alt="" /><b>${id === 'ASTOR' ? 'aStor' : id}</b><span>${info[0]}</span></button>`).join('');
}
function select(id) {
  if (model) {
    scene.remove(model); const materials = new Set();
    model.traverse(o => { if (o.geometry && !o.userData.sharedStandGeometry) o.geometry.dispose(); if (o.material) materials.add(o.material); });
    materials.forEach(m => m.dispose());
  }
  selected = id; model = art.product(id); model.visible = true; scene.add(model);
  if (id === 'AF') { model.userData.wall.scale.x = 2.7; model.userData.top.scale.x = 2.7; model.userData.posts.forEach(p => p.grp.position.x = p.side * 1.35); }
  fitDecals(); relabel(); reset();
}
$('products').onclick = e => { const id = e.target.closest('[data-model]')?.dataset.model; if (id) select(id); };
$('language').onclick = () => { language = language === 'en' ? 'zh' : 'en'; try { localStorage.setItem('sentinel.lang', language); } catch {} relabel(); };
$('reset').onclick = reset;
let drag;
canvas.onpointerdown = e => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); };
canvas.onpointermove = e => { if (!drag) return; yaw -= (e.clientX - drag.x) * .009; pitch = THREE.MathUtils.clamp(pitch + (e.clientY - drag.y) * .007, .3, 1.45); drag = { x: e.clientX, y: e.clientY }; draw(); };
canvas.onpointerup = canvas.onpointercancel = () => { drag = null; };
canvas.addEventListener('wheel', e => { e.preventDefault(); zoom = THREE.MathUtils.clamp(zoom * Math.exp(e.deltaY * .001), .6, 1.7); draw(); }, { passive: false });
canvas.onkeydown = e => {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '0'].includes(e.key)) return;
  e.preventDefault(); if (e.key === 'ArrowLeft') yaw += .15; if (e.key === 'ArrowRight') yaw -= .15;
  if (e.key === 'ArrowUp') pitch = Math.max(.3, pitch - .1); if (e.key === 'ArrowDown') pitch = Math.min(1.45, pitch + .1);
  if (e.key === '+' || e.key === '=') zoom = Math.max(.6, zoom * .9); if (e.key === '-') zoom = Math.min(1.7, zoom * 1.1);
  if (e.key === '0') reset(); else draw();
};
const resize = new ResizeObserver(() => { if (model) reset(); }); resize.observe(canvas.parentNode);
select('AF');
window.__showroom = { get selected() { return selected; }, get diagnostics() { return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries }; } };
addEventListener('pagehide', event => { if (event.persisted) return; resize.disconnect(); art.dispose(); Object.values(markTex).forEach(t => t.dispose()); brandTex.dispose(); renderer.dispose(); });

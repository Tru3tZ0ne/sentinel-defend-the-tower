// Official product artwork. Exact sources and legacy/current naming are recorded
// in assets/brand/ASSETS.md. Keep semantic action icons separate from these marks.
export const PRODUCT_MARKS = {
  AF: ['ngfw.png', 'Sangfor NGFW'],
  EDR: ['epp.png', 'Sangfor EPP'],
  NDR: ['ndr.png', 'Sangfor NDR / Cyber Command'],
  IAG: ['swg.png', 'Sangfor SWG / IAG'],
  XDR: ['xdr.jpg', 'Sangfor XDR'],
  MDR: ['mdr.png', 'Sangfor Cyber Guardian MDR'],
  ASTOR: ['astor.png', 'Sangfor aStor'],
  HCI: ['hci.png', 'Sangfor HCI'],
  ADC: ['adc.png', 'Sangfor Application Delivery'],
  SASE: ['sase.png', 'Sangfor Access Secure / SASE'],
  AICP: ['aicp.png', 'Sangfor AI Application Innovation Platform'],
};

export function productMark(id) {
  const mark = PRODUCT_MARKS[id];
  if (!mark) return '';
  return `<img class="product-mark" data-product-mark="${id}" src="assets/brand/products/sangfor-${mark[0]}" alt="${mark[1]}" width="44" height="44" />`;
}

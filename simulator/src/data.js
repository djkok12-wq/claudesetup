// ============================================================
//  DATA : 평면 · 마감재 카탈로그 · 컨셉 프리셋 · 견적 기준
//  단위: 평면 좌표 mm (x: 좌→우, z: 북(상)→남(하)), 높이 mm
// ============================================================

const PLAN_META = {
  name: '화정마을4단지 아이파크가야 413동 · 84㎡ (33평형)',
  supply: 112.1, exclusive: 84.96, pyeong: 33,
  ceiling: 2300, doorH: 2100, wallT: 200,
};

// ---------- 공간 (중심선 기준 사각형) ----------
function getRooms(s) {
  const BAL = { floor: 'floor_balcony', wall: 'wall_balcony', kind: 'bal' };
  const E = s.exp || {};
  const bal = (id, name, xname, x1, z1, x2, z2, key, wall) => E[key]
    ? { id, name: xname, x1, z1, x2, z2, floor: 'floor_main', wall, kind: 'dry', expanded: key, lights: 2 }
    : { id, name, x1, z1, x2, z2, ...BAL, floorY: -60, lights: 1, expKey: key };
  return [
    { id: 'living', name: '거실', x1: 4090, z1: 8800, x2: 8780, z2: 13515, floor: 'floor_main', wall: 'wall_living', kind: 'dry', feature: { edge: 'left', slot: 'wall_feature' }, lights: 6 },
    { id: 'kitchen', name: '주방·식당', x1: 4090, z1: 5085, x2: 8010, z2: 8800, floor: 'floor_main', wall: 'wall_kitchen', kind: 'dry', lights: 4 },
    { id: 'hallL', name: '침실 복도', x1: 2600, z1: 7755, x2: 4090, z2: 9690, floor: 'floor_main', wall: 'wall_living', kind: 'dry', lights: 1, nolabel: true },
    { id: 'hallA', name: '복도', x1: 8010, z1: 7225, x2: 9700, z2: 8800, floor: 'floor_main', wall: 'wall_living', kind: 'dry', lights: 1, nolabel: true },
    { id: 'hallB', name: '복도', x1: 8780, z1: 8800, x2: 9700, z2: 10280, floor: 'floor_main', wall: 'wall_living', kind: 'dry', lights: 1, nolabel: true },
    { id: 'hallC', name: '복도 수납', x1: 9700, z1: 9620, x2: 11970, z2: 10280, floor: 'floor_main', wall: 'wall_living', kind: 'dry', lights: 1, nolabel: true },
    { id: 'entry', name: '현관', x1: 8010, z1: 4800, x2: 9700, z2: 7225, floor: 'floor_entry', wall: 'wall_living', kind: 'entry', floorY: -120, lights: 1 },
    { id: 'master', name: '안방', x1: 0, z1: 9690, x2: 4090, z2: 13515, floor: 'floor_main', wall: 'wall_master', kind: 'dry', lights: 4 },
    { id: 'dress', name: s.dress ? '안방 드레스룸' : '안방 앞 전실', x1: 0, z1: 7755, x2: 2600, z2: 9690, floor: 'floor_main', wall: 'wall_master', kind: 'dry', lights: 2 },
    { id: 'mbath', name: '욕실1', x1: 0, z1: 5085, x2: 1745, z2: 7755, floor: 'bath_floor', wall: 'bath_wall', kind: 'wet', lights: 2 },
    { id: 'bed3', name: '침실3·서재', x1: 1745, z1: 5085, x2: 4090, z2: 7755, floor: 'floor_main', wall: 'wall_bed3', kind: 'dry', lights: 2 },
    { id: 'bed2', name: '침실2·자녀방', x1: 8780, z1: 10280, x2: 11970, z2: 13515, floor: 'floor_main', wall: 'wall_bed2', kind: 'dry', lights: 4 },
    { id: 'cbath', name: '욕실2(공용)', x1: 9700, z1: 7225, x2: 11970, z2: 9620, floor: 'bath_floor', wall: 'bath_wall', kind: 'wet', lights: 2 },
    { id: 'utility', name: '다용도실', x1: 4090, z1: 3185, x2: 8010, z2: 5085, ...BAL, floorY: -60, lights: 1 },
    { id: 'nbal1', name: '욕실 앞 발코니', x1: 0, z1: 3485, x2: 1745, z2: 5085, ...BAL, floorY: -60, lights: 1, nolabel: true },
    bal('nbal2', '침실3 발코니', '침실3 확장부', 1745, 3485, 4090, 5085, 'bed3', 'wall_bed3'),
    bal('mbal', '안방 발코니', '안방 확장부', 0, 13515, 4090, 15015, 'master', 'wall_master'),
    bal('lbal', '거실 발코니', '거실 확장부', 4090, 13515, 8780, 15015, 'living', 'wall_living'),
    bal('bbal', '침실2 발코니', '침실2 확장부', 8780, 13515, 11970, 14700, 'bed2', 'wall_bed2'),
  ];
}

// ---------- 개구부 ----------
// line 'h' = z 고정 수평선(x a..b), 'v' = x 고정 수직선(z a..b)
// type: open | door | arch | window | slidewin | entry | slide(중문)
// swing: 문짝이 열리는 방향(+1: 좌표 증가 방향), hinge: 'a' | 'b'
function getOpenings(s) {
  const O = [
    { line: 'h', at: 8800, a: 4090, b: 9700, type: 'open' },
    { line: 'v', at: 4090, a: 7755, b: 9690, type: 'open' },
    { line: 'v', at: 8010, a: 7225, b: 8800, type: 'open' },
    { line: 'v', at: 8780, a: 8800, b: 10280, type: 'open' },
    { line: 'v', at: 9700, a: 9620, b: 10280, type: 'open' },
    { line: 'h', at: 7755, a: 3150, b: 3950, type: 'door', swing: -1, hinge: 'b' },   // 침실3
    { line: 'h', at: 9690, a: 3150, b: 3950, type: 'door', swing: 1, hinge: 'b' },    // 안방
    { line: 'h', at: 7755, a: 450, b: 1250, type: 'door', swing: -1, hinge: 'a', bath: true }, // 욕실1
    { line: 'v', at: 9700, a: 7650, b: 8450, type: 'door', swing: 1, hinge: 'b', bath: true }, // 욕실2
    { line: 'h', at: 10280, a: 8900, b: 9700, type: 'door', swing: 1, hinge: 'a' },   // 침실2
    { line: 'h', at: 5085, a: 4300, b: 5100, type: 'door', swing: -1, hinge: 'a', glass: true }, // 다용도실
    { line: 'v', at: 9700, a: 5300, b: 6300, type: 'entry' },                          // 현관문
    { line: 'h', at: 7225, a: 8110, b: 9600, type: 'slide' },                          // 중문
    // 창호
    { line: 'h', at: 5085, a: 5600, b: 7400, type: 'window', sill: 1000, head: 2100 },  // 주방창
    { line: 'h', at: 5085, a: 500, b: 1200, type: 'window', sill: 1500, head: 2100 },   // 욕실1 창
    { line: 'h', at: 3185, a: 4300, b: 7800, type: 'window', sill: 900, head: 2200, ext: true },
    { line: 'h', at: 3485, a: 200, b: 1545, type: 'window', sill: 900, head: 2200, ext: true },
  ];
  const E = s.exp || {}, xs = k => E[k] ? 450 : 900;
  // 발코니 외부 창 (확장 시 이중창·창대 낮춤)
  O.push({ line: 'h', at: 15015, a: 200, b: 3900, type: 'window', sill: xs('master'), head: 2200, ext: true });
  O.push({ line: 'h', at: 15015, a: 4290, b: 8580, type: 'window', sill: xs('living'), head: 2200, ext: true });
  O.push({ line: 'h', at: 14700, a: 8980, b: 11770, type: 'window', sill: xs('bed2'), head: 2200, ext: true });
  O.push({ line: 'h', at: 3485, a: 1945, b: 3900, type: 'window', sill: xs('bed3'), head: 2200, ext: true });
  // 실 ↔ 발코니 경계: 확장 시 창호 철거(상부 보 150mm 잔존), 비확장 시 미닫이 창
  const edge = (k, at, a, b, wa, wb) => O.push(E[k] ? { line: 'h', at, a, b, type: 'open', beam: true } : { line: 'h', at, a: wa, b: wb, type: 'slidewin', sill: 0, head: 2100 });
  edge('living', 13515, 4090, 8780, 4300, 8600);
  edge('master', 13515, 0, 4090, 300, 3800);
  edge('bed2', 13515, 8780, 11970, 9000, 11800);
  edge('bed3', 5085, 1745, 4090, 2100, 3800);
  if (!E.bed3) O.push({ line: 'v', at: 1745, a: 3485, b: 5085, type: 'open' });
  // 안방 드레스룸 구획(제안안) vs 원평면(복도형 전실)
  if (s.dress) O.push({ line: 'h', at: 9690, a: 200, b: 1000, type: 'arch' });
  else O.push({ line: 'v', at: 2600, a: 7755, b: 9690, type: 'open' });
  return O;
}

// ---------- 마감재 카탈로그 ----------
// price: 시공비 포함 개략 단가(원) / unit 기준. 2026 시세 '추정치' — 실측 견적으로 대체 필요
const WALL_ITEMS = [
  { id: 'w_cloud', name: '클라우드 댄서 친환경 도장', spec: 'Pantone 11-4201 · 저VOC 수성 · 무광', color: '#F0EEE9', tex: { k: 'paint' }, rough: .92, price: 38000, tag: 'Pantone 2026' },
  { id: 'w_warmsilk', name: '웜화이트 실크벽지', spec: '무지 초극세 엠보 · 광폭 106cm', color: '#ECE7DF', tex: { k: 'paper', p: 'silk' }, rough: .7, price: 22000, tag: '스테디' },
  { id: 'w_greige', name: '그레이지 실크벽지', spec: '무지 실크 · 웜그레이 베이지', color: '#D9D2C6', tex: { k: 'paper', p: 'silk' }, rough: .7, price: 22000 },
  { id: 'w_linen', name: '린넨 텍스처 벽지', spec: '패브릭 질감 프린트 실크', color: '#E3DBCD', tex: { k: 'paper', p: 'linen' }, rough: .85, price: 25000, tag: '소프트 미니멀' },
  { id: 'w_khaki', name: '유니버설 카키 도장', spec: 'SW 6150 계열 · 무광', color: '#B8A992', tex: { k: 'paint' }, rough: .9, price: 38000, tag: 'SW 2026' },
  { id: 'w_limewash', name: '라임워시 도장', spec: '석회 텍스처 · 붓자국 마감', color: '#D8CDBE', tex: { k: 'lime' }, rough: .95, price: 65000, tag: '질감 트렌드' },
  { id: 'w_sage', name: '세이지 그린 도장', spec: '무광 · 포인트 1면 권장', color: '#A9B19E', tex: { k: 'paint' }, rough: .9, price: 38000 },
  { id: 'w_dustyblue', name: '더스티 블루 도장', spec: '무광 · 자녀방 추천', color: '#A7B4BF', tex: { k: 'paint' }, rough: .9, price: 38000 },
  { id: 'w_butter', name: '버터 크림 실크벽지', spec: '웜 옐로우 베이지', color: '#EFE2C4', tex: { k: 'paper', p: 'silk' }, rough: .7, price: 22000 },
];

const CATALOG = {
  floor_main: {
    label: '바닥재', zone: '공용부', where: '거실·주방·복도·침실 (전 실 통일)', unit: '㎡', qty: 'floor',
    items: [
      { id: 'f_oak165', name: '내추럴 오크 광폭 강마루', spec: '강마루 · 폭 165mm × 1200 · 무광 브러시드', color: '#C49E72', tex: { k: 'wood', w: 165, l: 1200, v: .07 }, rough: .55, price: 95000, tag: '2026 최다 선호' },
      { id: 'f_oakmax', name: '라이트 오크 초광폭 강마루', spec: '강마루 · 폭 240mm × 1800 · 무광', color: '#D3B58E', tex: { k: 'wood', w: 240, l: 1800, v: .06 }, rough: .55, price: 115000, tag: '초광폭' },
      { id: 'f_herring', name: '오크 헤링본 원목마루', spec: '원목마루 3mm 무늬목 · 100×600 헤링본', color: '#C8A273', tex: { k: 'herring', w: 100, l: 600, v: .09 }, rough: .5, price: 165000, tag: '프리미엄' },
      { id: 'f_greige', name: '그레이지 워시드 오크 강마루', spec: '강마루 · 폭 165mm · 화이트워시', color: '#BDB09C', tex: { k: 'wood', w: 165, l: 1200, v: .05 }, rough: .6, price: 95000 },
      { id: 'f_walnut', name: '모던 월넛 원목마루', spec: '원목마루 · 폭 190mm · 오일 마감', color: '#6F4C35', tex: { k: 'wood', w: 190, l: 1500, v: .09 }, rough: .5, price: 150000, tag: '다크우드 회귀' },
      { id: 'f_porc', name: '웜그레이 포세린 타일', spec: '포세린 600×1200 · 무광 · 바닥난방 대응', color: '#CDC5B9', tex: { k: 'tile', w: 600, h: 1200, g: '#B9B1A5', vein: 'stone' }, rough: .45, price: 140000, tag: '호텔라이크' },
    ],
  },
  wall_living: { label: '거실·복도 벽', zone: '공용부', where: '거실·복도·현관 벽면', unit: '㎡', qty: 'wall', items: WALL_ITEMS },
  wall_feature: {
    label: '거실 아트월', zone: '공용부', where: 'TV 벽 1면 (W 3.8m)', unit: '㎡', qty: 'wall',
    items: [
      { id: 'a_trav', name: '트래버틴 포세린 슬랩', spec: '포세린 800×1600 · 트래버틴 패턴 · 무광', color: '#D6C9B5', tex: { k: 'tile', w: 800, h: 1600, g: '#C9BBA6', vein: 'trav' }, rough: .5, price: 210000, tag: '빅슬랩' },
      { id: 'a_tambour', name: '오크 템바보드', spec: '반원 리브 15mm · 천연 무늬목', color: '#C29B6E', tex: { k: 'tambour', r: 22 }, rough: .6, price: 160000, tag: '질감' },
      { id: 'a_walnut', name: '월넛 무늬목 패널', spec: '천연 무늬목 · 600mm 분할 V홈', color: '#6D4A33', tex: { k: 'veneer', w: 600 }, rough: .5, price: 180000 },
      { id: 'a_lime', name: '라임워시 텍스처 도장', spec: '석회 도장 · 수작업 질감', color: '#CFC3B2', tex: { k: 'lime' }, rough: .95, price: 70000 },
      { id: 'a_calacatta', name: '칼라카타 포세린 슬랩', spec: '포세린 1200×2400 · 유광 대리석 패턴', color: '#EEEBE6', tex: { k: 'tile', w: 1200, h: 2400, g: '#E2DED8', vein: 'marble' }, rough: .2, price: 260000 },
      { id: 'a_plain', name: '아트월 없음 (벽과 동일 도장)', spec: '원톤 · 3무 인테리어', color: '#F0EEE9', tex: { k: 'paint' }, rough: .92, price: 38000, tag: '원톤' },
    ],
  },
  baseboard: {
    label: '걸레받이·몰딩', zone: '공용부', where: '전 실 (건식 공간)', unit: 'm', qty: 'base',
    items: [
      { id: 'b_minus', name: '무걸레받이 · 마이너스 몰딩', spec: '3무 디테일 · 10mm 섀도우 갭', color: '#2B2826', h: 12, inset: true, rough: .8, price: 32000, tag: '3무 인테리어' },
      { id: 'b_tone', name: '벽 동색 걸레받이 60mm', spec: '원톤 · 도장 마감', color: 'wall', h: 60, rough: .8, price: 12000 },
      { id: 'b_white', name: '슬림 화이트 걸레받이 40mm', spec: 'PVC 슬림', color: '#F2F0EC', h: 40, rough: .5, price: 9000 },
      { id: 'b_wood', name: '마루 동색 걸레받이 60mm', spec: '마루 톤 매칭', color: 'floor', h: 60, rough: .6, price: 10000 },
    ],
  },
  door: {
    label: '실내 도어', zone: '공용부', where: '침실·욕실·다용도실 도어 6짝', unit: '짝', qty: 'doors',
    items: [
      { id: 'd_hidden', name: '화이트 히든도어 (무문선)', spec: '문선 없는 매립 문틀 · 마그네틱 도어락', color: '#F1EFEA', hidden: true, handle: '#2A2A2A', rough: .5, price: 950000, tag: '3무 인테리어' },
      { id: 'd_abs', name: '화이트 ABS 도어', spec: 'ABS 도어 + 슬림 문선 · 레버 핸들', color: '#EFEDE8', handle: '#B9B9B9', rough: .45, price: 480000, tag: '가성비' },
      { id: 'd_greige', name: '캐시미어 그레이지 ABS 도어', spec: 'ABS · 웜그레이', color: '#CFC7BB', handle: '#3A3A3A', rough: .5, price: 520000 },
      { id: 'd_oak', name: '내추럴 오크 무늬목 도어', spec: '천연 무늬목 · 무광 우레탄', color: '#C29D72', tex: { k: 'veneer', w: 900 }, handle: '#2A2A2A', rough: .5, price: 750000 },
      { id: 'd_film', name: '화이트 필름 리폼 도어', spec: '기존 문짝·문틀 필름 시공 + 핸들 교체', color: '#EEECE7', handle: '#9A9A9A', rough: .5, price: 250000, tag: '예산 절감' },
      { id: 'd_walnut', name: '월넛 필름 리폼 도어', spec: '기존 문짝 필름 시공', color: '#6E4D37', tex: { k: 'veneer', w: 900 }, handle: '#B8975A', rough: .5, price: 280000, tag: '예산 절감' },
    ],
  },
  kitchen_lower: {
    label: '주방 하부장', zone: '주방', where: 'ㄱ자 하부장 + 키큰장', unit: 'm', qty: 'klower',
    items: [
      { id: 'kl_cash', name: '캐시미어 그레이지 무광', spec: 'PET 무광 · 핸들리스 (J-그립)', color: '#CEC5B7', rough: .75, price: 1100000 },
      { id: 'kl_oak', name: '내추럴 오크 무늬목', spec: '천연 무늬목 도어 · 핸들리스', color: '#BC9369', tex: { k: 'veneer', w: 600 }, rough: .6, price: 1450000, tag: '리얼 텍스처' },
      { id: 'kl_sage', name: '세이지 그린 무광', spec: 'PET 무광 · 핸들리스', color: '#98A190', rough: .75, price: 1100000 },
      { id: 'kl_espresso', name: '에스프레소 브라운', spec: 'PET 무광 · BM Silhouette 계열', color: '#57504C', rough: .7, price: 1100000, tag: 'BM 2026' },
      { id: 'kl_navy', name: '딥 네이비 무광', spec: 'PET 무광', color: '#2F3A4A', rough: .7, price: 1100000 },
      { id: 'kl_white', name: '화이트 무광 PET', spec: 'PET 무광 · 원톤', color: '#F0EEE9', rough: .7, price: 1000000, tag: '원톤' },
    ],
  },
  kitchen_upper: {
    label: '주방 상부장·키큰장', zone: '주방', where: '상부장 · 냉장고장', unit: 'm', qty: 'kupper',
    items: [
      { id: 'ku_white', name: '화이트 무광 PET', spec: '벽 동색 원톤 상부장', color: '#F0EEE9', rough: .7, price: 650000, tag: '원톤' },
      { id: 'ku_cash', name: '캐시미어 그레이지 무광', spec: 'PET 무광', color: '#CEC5B7', rough: .75, price: 650000 },
      { id: 'ku_oak', name: '내추럴 오크 무늬목', spec: '천연 무늬목', color: '#BC9369', tex: { k: 'veneer', w: 600 }, rough: .6, price: 850000 },
      { id: 'ku_espresso', name: '에스프레소 브라운', spec: 'PET 무광', color: '#57504C', rough: .7, price: 650000 },
    ],
  },
  countertop: {
    label: '주방 상판', zone: '주방', where: 'ㄱ자 상판 (12T)', unit: 'm', qty: 'ctop',
    items: [
      { id: 'c_calacatta', name: '세라믹 · 칼라카타 화이트', spec: '세라믹 12T · 대리석 패턴', color: '#EDEBE6', tex: { k: 'tile', w: 1600, h: 3200, g: '#EDEBE6', vein: 'marble', nogrout: true }, rough: .25, price: 750000, tag: '세라믹 상판' },
      { id: 'c_concrete', name: '세라믹 · 콘크리트 그레이', spec: '세라믹 12T · 무광', color: '#A9A6A0', tex: { k: 'tile', w: 1600, h: 3200, g: '#A9A6A0', vein: 'concrete', nogrout: true }, rough: .6, price: 700000 },
      { id: 'c_trav', name: '세라믹 · 트래버틴 베이지', spec: '세라믹 12T · 석재 패턴', color: '#D4C5AE', tex: { k: 'tile', w: 1600, h: 3200, g: '#D4C5AE', vein: 'trav', nogrout: true }, rough: .45, price: 750000 },
      { id: 'c_quartz', name: '엔지니어드 스톤 스노우', spec: '쿼츠 20T · 화이트', color: '#F2F1EE', tex: { k: 'tile', w: 1600, h: 3200, g: '#F2F1EE', vein: 'speck', nogrout: true }, rough: .3, price: 480000 },
      { id: 'c_solid', name: '인조대리석 화이트', spec: '인조대리석 12T', color: '#F4F3F0', rough: .35, price: 280000, tag: '예산 절감' },
    ],
  },
  backsplash: {
    label: '주방 벽(백스플래시)', zone: '주방', where: '상·하부장 사이 벽', unit: '㎡', qty: 'wall',
    items: [
      { id: 'bs_slab', name: '상판 동일 세라믹 슬랩', spec: '상판과 일체 연출 · 줄눈 없음', color: 'ctop', rough: .3, price: 320000, tag: '슬랩 백스플래시' },
      { id: 'bs_zellige', name: '젤리지 타일 화이트', spec: '수제 질감 65×200 · 유광', color: '#EEEAE2', tex: { k: 'brick', w: 65, h: 200, g: '#D8D2C8', vertical: false }, rough: .15, price: 190000 },
      { id: 'bs_subway', name: '롱 서브웨이 그레이지', spec: '75×300 · 무광 · 스택본드', color: '#CFC6B8', tex: { k: 'brick', w: 75, h: 300, g: '#BDB4A6', stack: true }, rough: .5, price: 150000 },
      { id: 'bs_glass', name: '백페인트 유리 (스노우)', spec: '5T 강화 · 무광 에칭', color: '#E9E7E2', rough: .25, price: 180000 },
    ],
  },
  wall_kitchen: { label: '주방 벽', zone: '주방', where: '주방 기타 벽면', unit: '㎡', qty: 'wall', items: WALL_ITEMS },
  floor_entry: {
    label: '현관 바닥', zone: '현관', where: '현관 (단차 120mm)', unit: '㎡', qty: 'floor',
    items: [
      { id: 'e_terrazzo', name: '테라조 포세린 600×600', spec: '무광 · 미끄럼방지', color: '#D8D2C9', tex: { k: 'tile', w: 600, h: 600, g: '#C6BFB5', vein: 'terrazzo' }, rough: .55, price: 160000, tag: '테라조' },
      { id: 'e_charcoal', name: '차콜 포세린 600×600', spec: '무광 · 오염 강함', color: '#4E4C4A', tex: { k: 'tile', w: 600, h: 600, g: '#3E3C3A', vein: 'stone' }, rough: .6, price: 140000 },
      { id: 'e_hex', name: '헥사곤 타일 그레이지', spec: '200mm 헥사곤 · 무광', color: '#CFC8BD', tex: { k: 'hex', r: 115, g: '#B5AEA3' }, rough: .6, price: 150000 },
      { id: 'e_trav', name: '트래버틴 포세린 600×1200', spec: '거실 아트월 연계', color: '#D6C9B5', tex: { k: 'tile', w: 600, h: 1200, g: '#C9BBA6', vein: 'trav' }, rough: .5, price: 160000 },
    ],
  },
  shoe: {
    label: '현관 신발장', zone: '현관', where: '키큰장 W 2.2m + 오픈 니치', unit: 'm', qty: 'shoe',
    items: [
      { id: 's_white', name: '화이트 플랫 (핸들리스)', spec: 'PET 무광 · 푸시 오픈 · 니치 LED', color: '#F0EEE9', rough: .7, price: 850000, tag: '원톤' },
      { id: 's_oak', name: '내추럴 오크 무늬목', spec: '천연 무늬목 · 니치 LED', color: '#C29D72', tex: { k: 'veneer', w: 450 }, rough: .6, price: 1050000 },
      { id: 's_tambour', name: '오크 템바 도어', spec: '템바 리브 도어 · 니치 LED', color: '#C29B6E', tex: { k: 'tambour', r: 22 }, rough: .6, price: 1150000 },
      { id: 's_greige', name: '캐시미어 그레이지', spec: 'PET 무광', color: '#CEC5B7', rough: .75, price: 850000 },
    ],
  },
  jungmun: {
    label: '현관 중문', zone: '현관', where: 'W 1.5m', unit: '식', qty: 'one',
    items: [
      { id: 'j_slim3', name: '슬림 3연동 · 블랙 + 브론즈 유리', spec: '슬림 프레임 · 3연동 슬라이딩 · 무타공', color: '#1F1F1F', glass: '#8A7360', panels: 3, price: 2100000, tag: '개방감' },
      { id: 'j_one', name: '원슬라이딩 · 화이트 + 투명', spec: '원슬라이딩 · 상부 레일', color: '#F2F0EC', glass: '#DCE3E6', panels: 1, price: 1650000, tag: '가성비' },
      { id: 'j_swing', name: '스윙 중문 · 샴페인골드 + 플루티드', spec: '스윙 도어 · 단열·차음 유리', color: '#B59B6A', glass: '#E8E4DC', panels: 2, fluted: true, price: 2400000, tag: '단열' },
      { id: 'j_none', name: '중문 없음', spec: '—', color: '#000', panels: 0, price: 0 },
    ],
  },
  curtain: {
    label: '커튼·블라인드', zone: '침실', where: '거실·안방·침실2 창 (확장 시 외부창)', unit: 'm', qty: 'curtain',
    items: [
      { id: 'cu_double', name: '쉬어 + 암막 이중 커튼 · 오트밀', spec: '린넨 쉬어 + 암막 · 커튼박스 매립 레일', color: '#CDBFA8', sheer: '#F3F0EA', price: 170000, tag: '호텔식' },
      { id: 'cu_sheer', name: '린넨 쉬어 커튼 · 화이트', spec: '쉬어 단독 · 2배 주름', color: '#F3F0EA', sheer: '#F3F0EA', only: 'sheer', price: 90000, tag: '소프트 미니멀' },
      { id: 'cu_grey', name: '쉬어 + 암막 · 웜그레이', spec: '암막 3중직 · 매립 레일', color: '#8F8A83', sheer: '#EEEBE5', price: 170000 },
      { id: 'cu_blind', name: '우드 블라인드 · 오크', spec: '50mm 슬랫 · 커튼박스 매립', color: '#B88E60', blind: true, price: 130000 },
      { id: 'cu_none', name: '없음', spec: '—', color: '#ffffff', none: true, price: 0 },
    ],
  },
  wall_master: { label: '안방 벽', zone: '침실', where: '안방·드레스룸', unit: '㎡', qty: 'wall', items: WALL_ITEMS },
  wall_bed2: { label: '침실2 벽', zone: '침실', where: '자녀방', unit: '㎡', qty: 'wall', items: WALL_ITEMS },
  wall_bed3: { label: '침실3 벽', zone: '침실', where: '서재·게스트룸', unit: '㎡', qty: 'wall', items: WALL_ITEMS },
  closet: {
    label: '붙박이장', zone: '침실', where: '안방·드레스룸·침실2·복도', unit: 'm', qty: 'closet',
    items: [
      { id: 'cl_white', name: '화이트 플랫 붙박이장', spec: '천장 일체 · 푸시 오픈 · 무손잡이', color: '#F0EEE9', rough: .7, price: 950000, tag: '원톤' },
      { id: 'cl_cash', name: '캐시미어 그레이지', spec: 'PET 무광 · 슬림 바 핸들', color: '#CEC5B7', rough: .75, price: 950000 },
      { id: 'cl_oak', name: '내추럴 오크 무늬목', spec: '천연 무늬목', color: '#BC9369', tex: { k: 'veneer', w: 450 }, rough: .6, price: 1250000 },
      { id: 'cl_bronze', name: '브론즈 유리 도어', spec: '알루미늄 프레임 + 브론즈 유리 · 내부 LED', color: '#6E5A48', glassy: true, rough: .15, price: 1400000, tag: '쇼룸형' },
      { id: 'cl_walnut', name: '월넛 무늬목', spec: '천연 무늬목', color: '#6E4D37', tex: { k: 'veneer', w: 450 }, rough: .55, price: 1250000 },
    ],
  },
  bath_wall: {
    label: '욕실 벽타일', zone: '욕실', where: '욕실 2개소 벽 전체', unit: '㎡', qty: 'wall',
    items: [
      { id: 'bw_warm', name: '웜화이트 포세린 600×1200', spec: '무광 · 덧방 불가 시 철거 후 시공', color: '#E9E4DB', tex: { k: 'tile', w: 600, h: 1200, g: '#D9D2C6', vein: 'stone' }, rough: .5, price: 115000, tag: '대형 포세린' },
      { id: 'bw_trav', name: '베이지 트래버틴 600×1200', spec: '무광 · 석재 질감', color: '#D7C8B2', tex: { k: 'tile', w: 600, h: 1200, g: '#C8B9A2', vein: 'trav' }, rough: .5, price: 125000, tag: '베이지 트렌드' },
      { id: 'bw_marble', name: '칼라카타 포세린 600×1200', spec: '유광 · 대리석 패턴', color: '#EEEBE6', tex: { k: 'tile', w: 600, h: 1200, g: '#DDD8D1', vein: 'marble' }, rough: .2, price: 125000 },
      { id: 'bw_concrete', name: '웜그레이 콘크리트 600×1200', spec: '무광 · 호텔라이크', color: '#B6B0A7', tex: { k: 'tile', w: 600, h: 1200, g: '#A49E95', vein: 'concrete' }, rough: .6, price: 115000 },
      { id: 'bw_mushroom', name: '머쉬룸 포세린 600×600', spec: '무광 · 웜 그레이 브라운', color: '#B9AA9A', tex: { k: 'tile', w: 600, h: 600, g: '#A8998A', vein: 'stone' }, rough: .55, price: 105000 },
    ],
  },
  bath_floor: {
    label: '욕실 바닥타일', zone: '욕실', where: '욕실 2개소 바닥', unit: '㎡', qty: 'floor',
    items: [
      { id: 'bf_greige', name: '그레이지 포세린 300×600', spec: '무광 논슬립 R11', color: '#B9B2A7', tex: { k: 'tile', w: 300, h: 600, g: '#A39C91', vein: 'stone' }, rough: .7, price: 130000 },
      { id: 'bf_terrazzo', name: '테라조 300×300', spec: '무광 논슬립', color: '#D2CCC3', tex: { k: 'tile', w: 300, h: 300, g: '#BEB7AD', vein: 'terrazzo' }, rough: .7, price: 140000, tag: '테라조' },
      { id: 'bf_charcoal', name: '차콜 포세린 300×600', spec: '무광 논슬립', color: '#4B4A48', tex: { k: 'tile', w: 300, h: 600, g: '#3B3A38', vein: 'stone' }, rough: .7, price: 130000 },
      { id: 'bf_hex', name: '헥사곤 모자이크 화이트', spec: '논슬립 모자이크', color: '#E6E2DB', tex: { k: 'hex', r: 60, g: '#C9C3B9' }, rough: .6, price: 150000 },
    ],
  },
  bath_fixture: {
    label: '수전·액세서리', zone: '욕실', where: '수전·샤워·악세서리 컬러', unit: '식', qty: 'baths',
    items: [
      { id: 'fx_gun', name: '건메탈', spec: 'PVD 코팅 · 매립 수전', color: '#4A4A4C', metal: .9, rough: .35, price: 1300000, tag: '트렌드' },
      { id: 'fx_gold', name: '브러시드 골드', spec: 'PVD 코팅 · 매립 수전', color: '#C2A26B', metal: 1, rough: .35, price: 1500000 },
      { id: 'fx_black', name: '매트 블랙', spec: '분체 도장 · 노출 수전', color: '#1E1E1E', metal: .3, rough: .6, price: 1100000 },
      { id: 'fx_chrome', name: '크롬', spec: '스탠다드 · 노출 수전', color: '#D9DCDF', metal: 1, rough: .12, price: 700000, tag: '가성비' },
    ],
  },
  floor_balcony: {
    label: '발코니 바닥', zone: '발코니', where: '발코니·다용도실', unit: '㎡', qty: 'floor',
    items: [
      { id: 'fb_grey', name: '웜그레이 포세린 300×600', spec: '무광 논슬립', color: '#A7A29A', tex: { k: 'tile', w: 300, h: 600, g: '#918C84', vein: 'concrete' }, rough: .7, price: 60000 },
      { id: 'fb_terrazzo', name: '테라조 600×600', spec: '무광 논슬립', color: '#D2CCC3', tex: { k: 'tile', w: 600, h: 600, g: '#BEB7AD', vein: 'terrazzo' }, rough: .7, price: 75000 },
      { id: 'fb_deck', name: '우드 패턴 포세린 200×1200', spec: '데크 연출 · 무광', color: '#A58462', tex: { k: 'wood', w: 200, l: 1200, v: .08, gap: 3 }, rough: .7, price: 70000 },
    ],
  },
  wall_balcony: {
    label: '발코니 벽', zone: '발코니', where: '발코니·다용도실 벽', unit: '㎡', qty: 'wall',
    items: [
      { id: 'wb_white', name: '탄성코트 화이트', spec: '결로·곰팡이 방지 탄성코트', color: '#F1F0EC', tex: { k: 'paper', p: 'orange' }, rough: .95, price: 15000 },
      { id: 'wb_greige', name: '탄성코트 그레이지', spec: '결로·곰팡이 방지 탄성코트', color: '#D3CCC0', tex: { k: 'paper', p: 'orange' }, rough: .95, price: 15000 },
    ],
  },
};

const ZONES = ['공용부', '주방', '현관', '침실', '욕실', '발코니'];

// ---------- 컨셉 프리셋 ----------
const CONCEPTS = [
  {
    id: 'warm', name: '웜 미니멀 · 클라우드 댄서', en: 'Soft Minimal',
    desc: 'Pantone 2026 클라우드 댄서를 바탕색으로 쓰고, 광폭 오크와 트래버틴으로 온기를 더한 컨셉. 무몰딩·무문선·무걸레받이의 "3무" 디테일로 선을 정리해 면이 넓어 보입니다.',
    keys: ['Cloud Dancer', '광폭 오크', '3무 디테일', '트래버틴'],
    pick: { floor_main: 'f_oak165', wall_living: 'w_cloud', wall_feature: 'a_trav', baseboard: 'b_minus', door: 'd_hidden', kitchen_lower: 'kl_cash', kitchen_upper: 'ku_white', countertop: 'c_calacatta', backsplash: 'bs_slab', wall_kitchen: 'w_cloud', floor_entry: 'e_trav', shoe: 's_white', jungmun: 'j_slim3', wall_master: 'w_linen', wall_bed2: 'w_warmsilk', wall_bed3: 'w_warmsilk', closet: 'cl_white', bath_wall: 'bw_warm', bath_floor: 'bf_greige', bath_fixture: 'fx_gun', floor_balcony: 'fb_grey', wall_balcony: 'wb_white', curtain: 'cu_double' },
    light: { k: 3000 },
  },
  {
    id: 'japandi', name: '내추럴 재패니디', en: 'Natural Japandi',
    desc: '라이트 오크 초광폭 마루에 템바보드와 오크 무늬목을 반복해 쓴 컨셉. 세이지 그린 주방과 라임워시 질감으로 차분한 휴식형 공간을 만듭니다.',
    keys: ['초광폭 오크', '템바보드', '세이지 그린', '라임워시'],
    pick: { floor_main: 'f_oakmax', wall_living: 'w_warmsilk', wall_feature: 'a_tambour', baseboard: 'b_tone', door: 'd_oak', kitchen_lower: 'kl_sage', kitchen_upper: 'ku_oak', countertop: 'c_trav', backsplash: 'bs_zellige', wall_kitchen: 'w_warmsilk', floor_entry: 'e_terrazzo', shoe: 's_tambour', jungmun: 'j_one', wall_master: 'w_limewash', wall_bed2: 'w_sage', wall_bed3: 'w_linen', closet: 'cl_oak', bath_wall: 'bw_trav', bath_floor: 'bf_terrazzo', bath_fixture: 'fx_black', floor_balcony: 'fb_deck', wall_balcony: 'wb_greige', curtain: 'cu_sheer' },
    light: { k: 2700 },
  },
  {
    id: 'mid', name: '모던 미드센추리 · 실루엣', en: 'Modern Mid-Century',
    desc: '월넛 헤링본과 BM 2026 실루엣(딥 브라운)을 묶은 컨셉. 다크 우드 쪽으로 옮겨가는 흐름을 반영했고, 브러시드 골드와 카키로 깊이를 더합니다.',
    keys: ['헤링본', 'Silhouette', '월넛', 'Universal Khaki'],
    pick: { floor_main: 'f_herring', wall_living: 'w_warmsilk', wall_feature: 'a_walnut', baseboard: 'b_wood', door: 'd_walnut', kitchen_lower: 'kl_espresso', kitchen_upper: 'ku_white', countertop: 'c_calacatta', backsplash: 'bs_subway', wall_kitchen: 'w_warmsilk', floor_entry: 'e_charcoal', shoe: 's_oak', jungmun: 'j_swing', wall_master: 'w_khaki', wall_bed2: 'w_dustyblue', wall_bed3: 'w_butter', closet: 'cl_walnut', bath_wall: 'bw_mushroom', bath_floor: 'bf_charcoal', bath_fixture: 'fx_gold', floor_balcony: 'fb_terrazzo', wall_balcony: 'wb_white', curtain: 'cu_blind' },
    light: { k: 2700 },
  },
  {
    id: 'hotel', name: '호텔라이크 그레이지', en: 'Hotel-like Greige',
    desc: '전 실 600×1200 포세린 바닥과 칼라카타 슬랩 아트월로 호텔 라운지 분위기를 낸 컨셉. 콘크리트 그레이 욕실과 브론즈 유리 붙박이장으로 대비를 줍니다.',
    keys: ['포세린 바닥', '칼라카타', '브론즈 유리', '건메탈'],
    pick: { floor_main: 'f_porc', wall_living: 'w_greige', wall_feature: 'a_calacatta', baseboard: 'b_minus', door: 'd_greige', kitchen_lower: 'kl_navy', kitchen_upper: 'ku_cash', countertop: 'c_concrete', backsplash: 'bs_slab', wall_kitchen: 'w_greige', floor_entry: 'e_charcoal', shoe: 's_greige', jungmun: 'j_slim3', wall_master: 'w_greige', wall_bed2: 'w_warmsilk', wall_bed3: 'w_greige', closet: 'cl_bronze', bath_wall: 'bw_concrete', bath_floor: 'bf_charcoal', bath_fixture: 'fx_gun', floor_balcony: 'fb_grey', wall_balcony: 'wb_greige', curtain: 'cu_grey' },
    light: { k: 3500 },
  },
  {
    id: 'value', name: '실속 화이트 (예산형)', en: 'Value White',
    desc: '바꾸기 어려운 공정(욕실·주방·바닥)은 제대로 하고, 도어는 필름 리폼, 벽은 실크벽지, 상판은 인조대리석으로 단가를 낮춘 컨셉. 샷시 교체를 빼면 시장 평균 범위에 들어옵니다.',
    keys: ['필름 리폼', '실크벽지', '인조대리석', '화이트 원톤'],
    pick: { floor_main: 'f_oak165', wall_living: 'w_warmsilk', wall_feature: 'a_plain', baseboard: 'b_white', door: 'd_film', kitchen_lower: 'kl_white', kitchen_upper: 'ku_white', countertop: 'c_solid', backsplash: 'bs_subway', wall_kitchen: 'w_warmsilk', floor_entry: 'e_hex', shoe: 's_white', jungmun: 'j_one', wall_master: 'w_warmsilk', wall_bed2: 'w_warmsilk', wall_bed3: 'w_warmsilk', closet: 'cl_white', bath_wall: 'bw_warm', bath_floor: 'bf_greige', bath_fixture: 'fx_chrome', floor_balcony: 'fb_grey', wall_balcony: 'wb_white', curtain: 'cu_sheer' },
    light: { k: 3000 },
  },
];

// ---------- 견적: 고정 공정 (추정) ----------
const FIXED_COSTS = [
  { k: 'demo', name: '가설·보양·철거·폐기물', amt: 4200000, note: '전체 철거(마루·욕실·주방·도어) 기준' },
  { k: 'mep', name: '설비·방수 (욕실 제외)', amt: 1800000, note: '급배수 일부 교체, 발코니 방수' },
  { k: 'elec', name: '전기·조명 기본', amt: 5200000, note: '매립등 교체, 스위치·콘센트 전면 교체' },
  { k: 'wood', name: '목공 (천장 평탄화·커튼박스·문틀)', amt: 6500000, note: '3무 디테일 시 난이도 상승분은 걸레받이·도어 단가에 반영' },
  { k: 'ceiling', name: '천장 도배', amt: 0, perM2: 15000, note: '실크 화이트 · 천장 면적 × 단가' },
  { k: 'bathpkg', name: '욕실 기본 (방수·도기·천장재·젠다이)', amt: 0, perBath: 3000000, note: '1개소당 · 타일·수전은 별도 항목' },
  { k: 'clean', name: '입주청소·후드/배관 청소', amt: 700000, note: '' },
];
const OPTION_COSTS = {
  sash: { name: '샷시 전체 교체 (하이샷시·로이유리)', amt: 12000000, note: '노후도·브랜드에 따라 500만~1,500만 원' },
  exp_living: { name: '거실 발코니 확장 (+7.0㎡)', amt: 4800000, note: '창호 철거·단열·바닥난방 연장·이중창' },
  exp_master: { name: '안방 발코니 확장 (+6.1㎡)', amt: 3800000, note: '단열·바닥난방 연장·이중창' },
  exp_bed2: { name: '침실2 발코니 확장 (+3.8㎡)', amt: 2900000, note: '단열·바닥난방 연장·이중창' },
  exp_bed3: { name: '침실3 발코니 확장 (+3.8㎡)', amt: 2700000, note: '북측 · 결로 대책 필수' },
  dress: { name: '드레스룸 구획 가벽·아치 개구부', amt: 1400000, note: '' },
  cove: { name: '간접조명 (거실 우물천장·라인조명·니치)', amt: 1800000, note: '' },
};
const MGMT_RATE = 0.08;

// ---------- 출처 ----------
const SOURCES = [
  ['Pantone 2026 Cloud Dancer (11-4201)', 'https://hospitalitydesign.com/news/pantone-color-of-the-year-2026/186006'],
  ['Benjamin Moore 2026 Silhouette', 'https://www.homesandgardens.com/interior-design/paint/benjamin-moore-color-of-the-year-2026'],
  ['2026 Paint Color of the Year 종합 (SW Universal Khaki 등)', 'https://paintdb.com/blog/2026-paint-color-of-the-year-roundup'],
  ['Dulux 2026 Rhythm of Blues', 'https://www.dezeen.com/2025/09/09/rhythm-of-blues-dulux-colour-of-the-year-2026/'],
  ['3무(무몰딩·무문선·무걸레받이) 인테리어 — 세계일보 2026.06', 'https://www.segye.com/newsView/20260608518470'],
  ['동화자연마루 2026 광폭 강마루 리뉴얼 — 헤럴드경제', 'https://www.heraldk.com/article/2026040923275446998'],
  ['한샘 165 프리미엄 강마루 매출 98% 증가 — 한국경제 2026.07', 'https://www.hankyung.com/article/202607243312P'],
  ['현대리바트 원톤 인테리어 — 뉴스1 2026.08', 'https://www.news1.kr/amp/industry/sb-founded/6248163'],
  ['LX Z:IN 플래그십 구축 리모델링 전시 — MTN 2026.09', 'https://news.mtn.co.kr/news-detail/2026090113231925540'],
  ['2026 소프트 미니멀리즘 트렌드 — VOGUE Korea', 'https://www.vogue.co.kr/?p=741022'],
  ['아파트 리모델링 평당 비용 (2026.06 갱신) — 아정당', 'https://www.ajd.co.kr/contents/basic-tip/detail/%ED%98%84%EC%9E%A5_%EC%97%85%EC%9E%90%EA%B0%80_%EC%95%8C%EB%A0%A4%EB%93%9C%EB%A6%AC%EB%8A%94_%EC%95%84%ED%8C%8C%ED%8A%B8_%EB%A6%AC%EB%AA%A8%EB%8D%B8%EB%A7%81_%EB%B9%84%EC%9A%A9_%ED%8F%89%EB%8B%B9_%EA%B0%80%EA%B2%A9!-50541'],
  ['중문 원슬라이딩 vs 3연동 비용', 'https://glasswallet.com/calculate/middle-door-cost/one-slide-vs-three-slide'],
  ['Flooring trends 2026 — Livingetc', 'https://www.livingetc.com/ideas/flooring-trends-for-2026'],
  ['Lighting trends 2026 — Livingetc', 'https://www.livingetc.com/ideas/lighting-trends-2026'],
];

/**
 * Smart Combo / Ammo Pairing Engine for Game-Style Inventory
 * Pairs serialized tools/equipment (asset) with matching consumables/reusables
 * e.g. Glue Gun -> Glue Sticks, Utility Cutter -> Blades, Tape Dispenser -> Tape
 */

export const COMBO_PAIRING_RULES = [
  {
    id: 'glue-gun-sticks',
    toolKeywords: ['ปืนกาว', 'ปืนยิงกาว', 'glue gun'],
    ammoKeywords: ['แท่งกาว', 'กาวแท่ง', 'กาวซิลิโคน', 'ไส้กาว', 'ซิลิโคนแท่ง'],
    promptLabel: 'หยิบแท่งกาวซิลิโคนเพิ่มไหม?',
    defaultSuggestQty: 10
  },
  {
    id: 'cutter-blades',
    toolKeywords: ['คัตเตอร์', 'มีดคัตเตอร์', 'มีดแกะ', 'cutter'],
    ammoKeywords: ['ใบมีด', 'ใบคัตเตอร์', 'blade'],
    promptLabel: 'หยิบใบมีดคัตเตอร์สำรองไหม?',
    defaultSuggestQty: 5
  },
  {
    id: 'tape-dispenser-rolls',
    toolKeywords: ['ตัดเทป', 'แท่นตัดเทป', 'ที่ตัดเทป', 'ตัวตัดเทป'],
    ammoKeywords: ['เทปกาว', 'เทปใส', 'เทปขุ่น', 'เทปสองหน้า', 'สก๊อตเทป', 'เทปพันก้าน'],
    promptLabel: 'หยิบม้วนเทปกาวเพิ่มไหม?',
    defaultSuggestQty: 3
  },
  {
    id: 'gas-tank-balloons',
    toolKeywords: ['ถังแก๊ส', 'ถังฮีเลียม', 'เป่าลูกโป่ง', 'เครื่องสูบลม', 'ปั๊มลม'],
    ammoKeywords: ['ลูกโป่ง', 'ริบบิ้นผูก', 'ก้านลูกโป่ง'],
    promptLabel: 'หยิบลูกโป่ง/ริบบิ้นติดไปด้วยไหม?',
    defaultSuggestQty: 20
  },
  {
    id: 'stapler-staples',
    toolKeywords: ['แม็ก', 'เครื่องยิงบอร์ด', 'ปืนยิงแม็ก', 'ที่เย็บกระดาษ'],
    ammoKeywords: ['ลูกแม็ก', 'ลวดเย็บ'],
    promptLabel: 'หยิบลูกแม็กสำรองไปด้วยไหม?',
    defaultSuggestQty: 2
  },
  {
    id: 'drill-screws',
    toolKeywords: ['สว่าน', 'ไขควงไฟฟ้า'],
    ammoKeywords: ['สกรู', 'น็อต', 'พุก', 'เคเบิ้ลไทร์', 'สายรัด'],
    promptLabel: 'หยิบสกรู/เคเบิ้ลไทร์ติดกระเป๋าไหม?',
    defaultSuggestQty: 10
  }
];

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

/**
 * Given a list of picked items (or a single picked item) and the full catalog,
 * returns recommended companion items that are not yet in the picked list.
 */
export function getRecommendedCombos(pickedItems = [], catalogItems = [], extraExcludedIds = []) {
  const pickedList = Array.isArray(pickedItems) ? pickedItems : [pickedItems].filter(Boolean);
  if (pickedList.length === 0 || !Array.isArray(catalogItems) || catalogItems.length === 0) {
    return [];
  }

  const excludedIds = new Set([
    ...pickedList.map((it) => String(it.item_id || it.id || '')),
    ...extraExcludedIds.map((id) => String(id || ''))
  ]);

  const suggestions = [];
  const seenItemIds = new Set();

  for (const picked of pickedList) {
    const pickedName = normalizeText(picked.name || picked.item_name);
    if (!pickedName) continue;

    for (const rule of COMBO_PAIRING_RULES) {
      const matchesTool = rule.toolKeywords.some((kw) => pickedName.includes(normalizeText(kw)));
      if (!matchesTool) continue;

      for (const candidate of catalogItems) {
        if (!candidate || candidate.is_active === false) continue;
        const candId = String(candidate.id || '');
        if (!candId || excludedIds.has(candId) || seenItemIds.has(candId)) continue;

        const candType = normalizeText(candidate.item_type);
        if (candType === 'asset' || candType === 'tool' || candType === 'banknote' || candType === 'task') {
          continue;
        }

        const candName = normalizeText(candidate.name);
        const matchesAmmo = rule.ammoKeywords.some((kw) => candName.includes(normalizeText(kw)));
        if (!matchesAmmo) continue;

        seenItemIds.add(candId);
        suggestions.push({
          ruleId: rule.id,
          sourceToolName: picked.name || picked.item_name,
          promptLabel: rule.promptLabel,
          suggestQty: Math.max(1, Math.min(rule.defaultSuggestQty, Number(candidate.current_stock) || rule.defaultSuggestQty)),
          item: candidate,
          isOutOfStock: (Number(candidate.current_stock) || 0) <= 0
        });
      }
    }
  }

  return suggestions;
}

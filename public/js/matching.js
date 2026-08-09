/* ============ PURE HELPERS — no DOM, no globals, fully unit-testable ============ */

export const NUM_WORDS = { zero:0, one:1, a:1, an:1, two:2, to:2, too:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10, couple:2 };

const THUMB_PALETTE = [
  'linear-gradient(135deg,#FFE3C2,#FFC98A)', 'linear-gradient(135deg,#FFD6D6,#FF9E9E)',
  'linear-gradient(135deg,#FFF0B8,#FFD966)', 'linear-gradient(135deg,#DFF3D8,#B9E6A8)',
  'linear-gradient(135deg,#D9E8FF,#A9C8FF)', 'linear-gradient(135deg,#F0DBFF,#D3A9FF)',
];

export function thumbColor(id){
  let hash = 0;
  for(let i=0;i<id.length;i++) hash = (hash*31 + id.charCodeAt(i)) % THUMB_PALETTE.length;
  return THUMB_PALETTE[Math.abs(hash)];
}

export function findRestaurant(restaurants, id){ return restaurants.find(r=>r.id===id); }
export function findItem(restaurants, restaurantId, itemId){ return findRestaurant(restaurants, restaurantId).menu.find(i=>i.id===itemId); }
export function itemPrice(item, size){ return item.hasSize ? item.sizePrices[size||'M'] : item.price; }
export function cartKey(item, size){ return item.hasSize ? `${item.id}::${size||'M'}` : item.id; }

export function extractQuantity(text){
  const trimmed = text.trim();
  if(!trimmed) return null;
  const words = trimmed.split(/\s+/);
  const lastWord = words[words.length-1];
  if(/^\d+$/.test(lastWord)) return parseInt(lastWord,10);
  if(lastWord in NUM_WORDS) return NUM_WORDS[lastWord];
  return null;
}

export function extractSize(text){
  if(/\blarge\b/.test(text)) return 'L';
  if(/\bsmall\b/.test(text)) return 'S';
  if(/\bmedium\b/.test(text)) return 'M';
  return null;
}

// Builds a lookup: alias string -> [{restaurant,item}], plus aliases sorted longest-first
// so multi-word aliases ("veg burger basic") are matched before shorter ones ("veg burger").
export function buildAliasIndex(restaurants){
  const aliasIndex = new Map();
  for(const r of restaurants){
    for(const item of r.menu){
      for(const alias of item.aliases){
        if(!aliasIndex.has(alias)) aliasIndex.set(alias, []);
        aliasIndex.get(alias).push({ restaurant:r, item });
      }
    }
  }
  const aliasKeysSorted = [...aliasIndex.keys()].sort((a,b)=>b.length-a.length);
  return { aliasIndex, aliasKeysSorted };
}

// Finds the first occurrence of `alias` in `text` that isn't a false-positive substring
// match of a veg item sitting right after the word "non" (e.g. "veg burger" inside "non veg burger").
export function findSafeAliasIndex(text, alias, matches){
  const allVeg = matches.every(m => m.item.veg);
  const startsWithNon = /^non[- ]?veg\b/.test(alias);
  if(!allVeg || startsWithNon) return text.indexOf(alias);
  let from = 0;
  while(true){
    const idx = text.indexOf(alias, from);
    if(idx === -1) return -1;
    const precedingWord = text.slice(Math.max(0, idx-5), idx).trim();
    if(!/non[- ]?$/.test(precedingWord)) return idx;
    from = idx + 1; // this occurrence is "non veg <alias>" — skip it, look further ahead
  }
}

export function extractGlobalMentions(text, aliasIndex, aliasKeysSorted){
  if(!text || !text.trim()) return [];
  let working = ` ${text} `;
  const mentions = [];
  for(const alias of aliasKeysSorted){
    const matches = aliasIndex.get(alias);
    const idx = findSafeAliasIndex(working, alias, matches);
    if(idx===-1) continue;
    const context = working.slice(Math.max(0, idx-18), idx+alias.length+12);
    const before = working.slice(Math.max(0, idx-18), idx);
    const qty = extractQuantity(before) ?? 1;
    const size = extractSize(context);
    mentions.push({ alias, matches, qty, idx, size });
    working = working.slice(0, idx) + ' '.repeat(alias.length) + working.slice(idx+alias.length);
  }
  mentions.sort((a,b)=>a.idx-b.idx);
  return mentions;
}

// Resolves a mention to a single {restaurant,item} using context (open restaurant page / active cart).
// Returns null when truly ambiguous — caller should show the disambiguation modal.
export function resolveMentionSync(mention, activeCartRestaurantId, currentView){
  if(mention.matches.length===1) return mention.matches[0];
  if(activeCartRestaurantId){
    const inCart = mention.matches.find(m=>m.restaurant.id===activeCartRestaurantId);
    if(inCart) return inCart;
  }
  if(currentView && currentView.type==='restaurant'){
    const inView = mention.matches.find(m=>m.restaurant.id===currentView.id);
    if(inView) return inView;
  }
  return null;
}

// Builds the flat catalog payload the backend/LLM needs to resolve dish names to items.
export function buildCatalogForLLM(restaurants){
  return restaurants.flatMap(r => r.menu.map(item => ({
    item_id: item.id, item_name: item.name,
    restaurant_id: r.id, restaurant_name: r.name,
    veg: item.veg, has_size: !!item.hasSize,
  })));
}

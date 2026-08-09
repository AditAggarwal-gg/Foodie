import { RESTAURANTS } from './data.js';
import { findRestaurant, findItem, itemPrice, cartKey, thumbColor } from './matching.js';
import { currentView, selectedSizes, setCurrentView, setSelectedSize } from './state.js';
import { cart, requestAddToCart, decrementCartItem, registerRenderRestaurant } from './cart.js';

/* ============ RENDER: LIST ============ */
export function renderList(filter=''){
  setCurrentView({ type:'list' });
  const wrap = document.getElementById('mainWrap');
  const f = filter.toLowerCase().trim();
  const results = RESTAURANTS.filter(r=>{
    if(!f) return true;
    if(r.name.toLowerCase().includes(f) || r.cuisine.toLowerCase().includes(f)) return true;
    return r.menu.some(i=> i.name.toLowerCase().includes(f) || i.aliases.some(a=>a.includes(f)));
  });
  let html = `<div class="section-title">Restaurants near you</div><div class="section-sub">${results.length} place${results.length!==1?'s':''} delivering to Sector 12</div>`;
  if(results.length===0){ html += `<div class="cart-empty">No matches. Try another search.</div>`; }
  for(const r of results){
    html += `<div class="r-card" data-open="${r.id}">
      <div class="r-thumb" style="background:${r.color || thumbColor(r.id)}">${r.emoji || '🍽️'}</div>
      <div class="r-info">
        <div class="r-top">
          <div class="r-name">${r.name}</div>
          <div class="r-rating">★ ${r.rating}</div>
        </div>
        <div class="r-cuisine">${r.cuisine} · ${r.area}</div>
        <div class="r-meta"><span>⏱ ${r.time}</span><span>₹${r.p4t} for two</span></div>
      </div>
    </div>`;
  }
  wrap.innerHTML = html;
  wrap.querySelectorAll('[data-open]').forEach(el=>{
    el.addEventListener('click', ()=> renderRestaurant(el.dataset.open));
  });
}

/* ============ RENDER: RESTAURANT DETAIL ============ */
export function renderRestaurant(id, filter=''){
  const r = findRestaurant(RESTAURANTS, id);
  setCurrentView({ type:'restaurant', id });
  const wrap = document.getElementById('mainWrap');
  const f = filter.toLowerCase().trim();
  const items = r.menu.filter(i=> !f || i.name.toLowerCase().includes(f) || i.aliases.some(a=>a.includes(f)));

  let html = `<div class="back-row" id="backToList">‹ All restaurants</div>
  <div class="r-banner">
    <div>
      <div class="r-banner-name">${r.emoji} ${r.name}</div>
      <div class="r-banner-meta">${r.cuisine} · ${r.area} · ⏱ ${r.time}</div>
    </div>
    <div class="r-banner-rating">★ ${r.rating}</div>
  </div>`;

  if(items.length===0){ html += `<div class="cart-empty">No dishes match your search here.</div>`; }

  for(const item of items){
    const qtyKey = cartKey(item, selectedSizes[item.id]);
    const qty = cart.restaurantId===r.id ? (cart.items[qtyKey]?.qty || 0) : 0;
    const size = selectedSizes[item.id] || 'M';
    html += `<div class="menu-item" data-item-card="${item.id}">
      <div class="mi-left">
        <div class="mi-top"><div class="veg-dot ${item.veg?'':'nonveg'}"></div><div class="mi-name">${item.name}</div></div>
        <div class="mi-price">₹${itemPrice(item, size)}</div>
        ${item.hasSize ? `<div class="size-pills">
          ${['S','M','L'].map(s=>`<div class="size-pill ${s===size?'active':''}" data-size-select="${item.id}" data-size="${s}">${s} · ₹${item.sizePrices[s]}</div>`).join('')}
        </div>` : ''}
      </div>
      <div class="mi-right">
        ${qty>0 ? `<div class="qty-stepper">
            <button data-dec="${item.id}">−</button><span>${qty}</span><button data-inc="${item.id}">+</button>
          </div>` : `<button class="add-btn" data-add="${item.id}">ADD</button>`}
      </div>
    </div>`;
  }
  wrap.innerHTML = html;

  document.getElementById('backToList').addEventListener('click', ()=> renderList());
  wrap.querySelectorAll('[data-add]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const item = findItem(RESTAURANTS, r.id, btn.dataset.add);
      requestAddToCart(r.id, item.id, 1, selectedSizes[item.id] || 'M');
    });
  });
  wrap.querySelectorAll('[data-inc]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const item = findItem(RESTAURANTS, r.id, btn.dataset.inc);
      requestAddToCart(r.id, item.id, 1, selectedSizes[item.id] || 'M');
    });
  });
  wrap.querySelectorAll('[data-dec]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const item = findItem(RESTAURANTS, r.id, btn.dataset.dec);
      decrementCartItem(cartKey(item, selectedSizes[item.id] || 'M'));
      renderRestaurant(r.id, document.getElementById('searchInput').value);
    });
  });
  wrap.querySelectorAll('[data-size-select]').forEach(pill=>{
    pill.addEventListener('click', ()=>{
      setSelectedSize(pill.dataset.sizeSelect, pill.dataset.size);
      renderRestaurant(r.id, document.getElementById('searchInput').value);
    });
  });
}

export function wireSearch(){
  document.getElementById('searchInput').addEventListener('input', (e)=>{
    if(currentView.type==='list') renderList(e.target.value);
    else renderRestaurant(currentView.id, e.target.value);
  });
}

// Break the circular import with cart.js: cart.js calls this instead of importing renderRestaurant directly.
registerRenderRestaurant(renderRestaurant);

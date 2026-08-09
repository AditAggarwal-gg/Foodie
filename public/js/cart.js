import { RESTAURANTS, supabaseConfigured, supabaseClient } from './data.js';
import { findRestaurant, findItem, itemPrice, cartKey } from './matching.js';
import { currentView, currentUser } from './state.js';
import { showToast, confirmCartReplace, openOverlay, closeOverlay } from './overlays.js';

/* ============ STATE ============ */
export let cart = { restaurantId:null, items:{} }; // items: key -> {itemId,name,qty,size,unitPrice}

export function commitAdd(restaurantId, itemId, qty, size){
  const item = findItem(RESTAURANTS, restaurantId, itemId);
  const key = cartKey(item, size);
  cart.restaurantId = restaurantId;
  if(!cart.items[key]){
    cart.items[key] = { itemId, name: item.name + (item.hasSize ? ` (${size})` : ''), qty:0, unitPrice: itemPrice(item, size), size };
  }
  cart.items[key].qty += qty;
  refreshCartUI();
  flashItemCard(itemId);
}

export function decrementCartItem(key){
  if(!cart.items[key]) return;
  cart.items[key].qty -= 1;
  if(cart.items[key].qty <= 0) delete cart.items[key];
  if(Object.keys(cart.items).length===0) cart.restaurantId = null;
  refreshCartUI();
}

export function clearCartState(){ cart = { restaurantId:null, items:{} }; refreshCartUI(); }

// Handles the "cart already has items from another restaurant" conflict
export async function requestAddToCart(restaurantId, itemId, qty, size){
  if(cart.restaurantId && cart.restaurantId !== restaurantId && Object.keys(cart.items).length>0){
    const otherR = findRestaurant(RESTAURANTS, cart.restaurantId);
    const newR = findRestaurant(RESTAURANTS, restaurantId);
    const proceed = await confirmCartReplace(otherR.name, newR.name);
    if(!proceed) return;
    clearCartState();
    commitAdd(restaurantId, itemId, qty, size);
    showToast(`Added ${findItem(RESTAURANTS, restaurantId,itemId).name} from ${newR.name}`);
    return;
  }
  commitAdd(restaurantId, itemId, qty, size);
}

function flashItemCard(itemId){
  const el = document.querySelector(`[data-item-card="${itemId}"]`);
  if(!el) return;
  el.classList.add('flash');
  setTimeout(()=>el.classList.remove('flash'), 650);
}

// Set by app.js after render.js is initialized, to avoid a circular import at module-eval time.
let renderRestaurantFn = null;
export function registerRenderRestaurant(fn){ renderRestaurantFn = fn; }

export function refreshCartUI(){
  const totalQty = Object.values(cart.items).reduce((s,i)=>s+i.qty,0);
  const totalVal = Object.values(cart.items).reduce((s,i)=>s+i.qty*i.unitPrice,0);

  // header badge
  const badge = document.getElementById('cartBadge');
  if(totalQty>0){ badge.textContent = totalQty; badge.classList.remove('hidden'); } else { badge.classList.add('hidden'); }

  // sticky bar
  const bar = document.getElementById('cartBar');
  if(totalQty>0){
    bar.classList.add('show');
    document.getElementById('cartBarCount').textContent = `${totalQty} item${totalQty!==1?'s':''}`;
    document.getElementById('cartBarRestaurant').textContent = findRestaurant(RESTAURANTS, cart.restaurantId)?.name || '';
    document.getElementById('cartBarTotal').textContent = `₹${totalVal}`;
  } else {
    bar.classList.remove('show');
  }

  // cart sheet
  const body = document.getElementById('cartBody');
  const totalRow = document.getElementById('cartTotalRow');
  const placeBtn = document.getElementById('placeOrderBtn');
  const tag = document.getElementById('cartRestaurantTag');
  const keys = Object.keys(cart.items);

  if(keys.length===0){
    body.innerHTML = `<div class="cart-empty">Nothing added yet — try the mic or tap ADD</div>`;
    totalRow.classList.add('hidden');
    placeBtn.disabled = true;
    tag.textContent = '';
  } else {
    tag.textContent = `From ${findRestaurant(RESTAURANTS, cart.restaurantId).name}`;
    body.innerHTML = keys.map(key=>{
      const line = cart.items[key];
      return `<div class="cart-line">
        <div>
          <div class="cl-name">${line.name}</div>
          <div class="cl-sub">₹${line.unitPrice} × ${line.qty}</div>
        </div>
        <div class="cl-right">
          <button class="cl-qty-btn" data-cart-dec="${key}">−</button>
          <button class="cl-qty-btn" data-cart-inc="${key}">+</button>
          <span class="cl-price">₹${line.unitPrice*line.qty}</span>
        </div>
      </div>`;
    }).join('');
    totalRow.classList.remove('hidden');
    document.getElementById('cartTotalVal').textContent = `₹${totalVal}`;
    placeBtn.disabled = false;

    body.querySelectorAll('[data-cart-inc]').forEach(b=>b.addEventListener('click', ()=>{
      cart.items[b.dataset.cartInc].qty += 1;
      refreshCartUI();
    }));
    body.querySelectorAll('[data-cart-dec]').forEach(b=>b.addEventListener('click', ()=>{
      decrementCartItem(b.dataset.cartDec);
    }));
  }

  // re-render current restaurant view steppers if open
  if(currentView.type==='restaurant' && renderRestaurantFn){
    renderRestaurantFn(currentView.id, document.getElementById('searchInput').value);
  }
}

export function wireCartControls(){
  document.getElementById('cartIconBtn').addEventListener('click', ()=>{ refreshCartUI(); openOverlay('cartOverlay'); });
  document.getElementById('cartBar').addEventListener('click', ()=>{ refreshCartUI(); openOverlay('cartOverlay'); });
  document.getElementById('placeOrderBtn').addEventListener('click', async ()=>{
    const totalVal = Object.values(cart.items).reduce((s,i)=>s+i.qty*i.unitPrice,0);
    if(supabaseConfigured && cart.restaurantId){
      try{
        const orderPayload = { restaurant_id: cart.restaurantId, total: totalVal, status: 'placed' };
        if(currentUser) orderPayload.user_id = currentUser.id;
        const { data: orderRow, error: oErr } = await supabaseClient
          .from('orders')
          .insert(orderPayload)
          .select().single();
        if(oErr) throw oErr;
        const lines = Object.values(cart.items).map(line => ({
          order_id: orderRow.id, item_id: line.itemId, item_name: line.name,
          size: line.size || null, qty: line.qty, unit_price: line.unitPrice,
        }));
        const { error: liErr } = await supabaseClient.from('order_items').insert(lines);
        if(liErr) throw liErr;
        showToast(currentUser
          ? `Order placed! #${orderRow.id.slice(0,8)} — saved to your history`
          : `Order placed! #${orderRow.id.slice(0,8)} — sign in to save order history`);
      } catch(err){
        console.error('Order write failed:', err);
        showToast('Order placed! (could not save to database)');
      }
    } else {
      showToast('Order placed! (demo — connect Supabase to save real orders)');
    }
    clearCartState();
    closeOverlay('cartOverlay');
  });
}

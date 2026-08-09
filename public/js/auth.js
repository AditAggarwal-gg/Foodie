import { RESTAURANTS, supabaseConfigured, supabaseClient } from './data.js';
import { findRestaurant } from './matching.js';
import { currentUser, setCurrentUser } from './state.js';
import { openOverlay, closeOverlay, showToast } from './overlays.js';

function updateAccountUI(){
  const dot = document.getElementById('accountDot');
  const loggedOutView = document.getElementById('accountLoggedOut');
  const loggedInView = document.getElementById('accountLoggedIn');
  if(currentUser){
    dot.classList.remove('hidden');
    loggedOutView.classList.add('hidden');
    loggedInView.classList.remove('hidden');
    document.getElementById('accountEmail').textContent = `Signed in as ${currentUser.email}`;
  } else {
    dot.classList.add('hidden');
    loggedOutView.classList.remove('hidden');
    loggedInView.classList.add('hidden');
  }
}

export async function initAuth(){
  if(!supabaseConfigured) return;
  const { data: { session } } = await supabaseClient.auth.getSession();
  setCurrentUser(session?.user ? { id: session.user.id, email: session.user.email } : null);
  updateAccountUI();
  supabaseClient.auth.onAuthStateChange((_event, session)=>{
    setCurrentUser(session?.user ? { id: session.user.id, email: session.user.email } : null);
    updateAccountUI();
  });
}

async function renderOrderHistory(){
  const body = document.getElementById('ordersBody');
  if(!currentUser){
    body.innerHTML = `<div class="cart-empty">Sign in to see your order history.</div>`;
    return;
  }
  body.innerHTML = `<div class="cart-empty">Loading…</div>`;
  try{
    const { data: orders, error } = await supabaseClient
      .from('orders')
      .select('id, restaurant_id, total, status, created_at, order_items(item_name, size, qty, unit_price)')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if(error) throw error;
    if(!orders || orders.length === 0){
      body.innerHTML = `<div class="cart-empty">No orders yet — place one and it'll show up here.</div>`;
      return;
    }
    body.innerHTML = orders.map(o=>{
      const r = findRestaurant(RESTAURANTS, o.restaurant_id);
      const dateStr = new Date(o.created_at).toLocaleString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
      const itemsStr = (o.order_items||[]).map(li => `${li.qty}× ${li.item_name}`).join(', ');
      return `<div class="cart-line" style="align-items:flex-start;">
        <div>
          <div class="cl-name">${r ? r.emoji+' '+r.name : 'Order'} <span style="font-weight:500;color:var(--mute);">#${o.id.slice(0,8)}</span></div>
          <div class="cl-sub" style="margin-top:3px;">${itemsStr}</div>
          <div class="cl-sub">${dateStr} · ${o.status}</div>
        </div>
        <div class="cl-price">₹${o.total}</div>
      </div>`;
    }).join('');
  } catch(err){
    console.error('Order history load failed:', err);
    body.innerHTML = `<div class="cart-empty">Couldn't load order history.</div>`;
  }
}

export function wireAuthControls(){
  document.getElementById('accountBtn').addEventListener('click', ()=>{ updateAccountUI(); openOverlay('accountOverlay'); });

  document.getElementById('sendMagicLinkBtn').addEventListener('click', async ()=>{
    const email = document.getElementById('loginEmail').value.trim();
    const statusEl = document.getElementById('loginStatus');
    if(!email || !email.includes('@')){ statusEl.textContent = 'Enter a valid email first.'; return; }
    if(!supabaseConfigured){ statusEl.textContent = 'Supabase isn\'t connected yet.'; return; }
    statusEl.textContent = 'Sending…';
    try{
      const { error } = await supabaseClient.auth.signInWithOtp({
        email, options: { emailRedirectTo: window.location.href },
      });
      if(error) throw error;
      statusEl.textContent = `Magic link sent to ${email} — check your inbox and click it.`;
    } catch(err){
      statusEl.textContent = `Couldn't send link: ${err.message}`;
    }
  });

  document.getElementById('signOutBtn').addEventListener('click', async ()=>{
    if(supabaseConfigured) await supabaseClient.auth.signOut();
    setCurrentUser(null);
    updateAccountUI();
    closeOverlay('accountOverlay');
    showToast('Signed out');
  });

  document.querySelector('[data-open-orders]').addEventListener('click', async ()=>{
    closeOverlay('accountOverlay');
    await renderOrderHistory();
    openOverlay('ordersOverlay');
  });
}

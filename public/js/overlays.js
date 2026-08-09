import { itemPrice } from './matching.js';

export function openOverlay(id){ document.getElementById(id).classList.add('show'); }
export function closeOverlay(id){ document.getElementById(id).classList.remove('show'); }

export function wireOverlayCloseButtons(){
  document.querySelectorAll('[data-close]').forEach(b=> b.addEventListener('click', ()=> closeOverlay(b.dataset.close)));
  document.getElementById('cartOverlay').addEventListener('click', (e)=>{ if(e.target.id==='cartOverlay') closeOverlay('cartOverlay'); });
}

export function showToast(msg){
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(()=>t.classList.add('show'));
  setTimeout(()=>{ t.classList.remove('show'); setTimeout(()=>t.remove(), 350); }, 2400);
}

// Returns a Promise<boolean> — true if the person confirms clearing the cart to add the new item
export function confirmCartReplace(oldName, newName){
  return new Promise((resolve)=>{
    document.getElementById('conflictSub').textContent =
      `Your cart has items from ${oldName}. Adding from ${newName} will clear your current cart.`;
    openOverlay('conflictOverlay');
    let resolved = false;
    const confirmBtn = document.getElementById('conflictConfirm');
    const cancelBtn = document.getElementById('conflictCancel');
    confirmBtn.addEventListener('click', function h(){
      if(resolved) return; resolved = true;
      closeOverlay('conflictOverlay'); confirmBtn.removeEventListener('click', h); resolve(true);
    });
    cancelBtn.addEventListener('click', function h(){
      if(resolved) return; resolved = true;
      closeOverlay('conflictOverlay'); cancelBtn.removeEventListener('click', h); resolve(false);
    });
  });
}

// Returns a Promise<restaurantId|null> — resolves null if user dismisses without choosing
export function showDisambiguationModal(itemLabel, matches){
  return new Promise((resolve)=>{
    document.getElementById('disambigTitle').textContent = `Which restaurant for "${itemLabel}"?`;
    document.getElementById('disambigSub').textContent = `This dish is on ${matches.length} menus near you — tap one to add it.`;
    const choicesEl = document.getElementById('disambigChoices');
    choicesEl.innerHTML = matches.map((m,idx)=>`
      <div class="choice-row" data-choice="${idx}">
        <div>
          <div class="choice-name">${m.restaurant.emoji} ${m.restaurant.name}</div>
          <div class="choice-sub">${m.restaurant.area} · ${m.restaurant.cuisine}</div>
        </div>
        <div class="choice-price">₹${itemPrice(m.item, 'M')}</div>
      </div>`).join('');
    openOverlay('disambigOverlay');
    let resolved = false;
    choicesEl.querySelectorAll('[data-choice]').forEach(row=>{
      row.addEventListener('click', ()=>{
        if(resolved) return; resolved = true;
        closeOverlay('disambigOverlay');
        resolve(matches[parseInt(row.dataset.choice,10)].restaurant.id);
      });
    });
    // dismiss without choosing = cancel this item
    document.getElementById('disambigOverlay').addEventListener('click', function handler(e){
      if(e.target.id==='disambigOverlay' && !resolved){
        resolved = true; closeOverlay('disambigOverlay'); resolve(null);
        this.removeEventListener('click', handler);
      }
    });
  });
}

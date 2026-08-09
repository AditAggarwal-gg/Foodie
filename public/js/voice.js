import { RESTAURANTS } from './data.js';
import { findRestaurant, buildAliasIndex, extractGlobalMentions, resolveMentionSync, buildCatalogForLLM } from './matching.js';
import { currentView } from './state.js';
import { cart, commitAdd, clearCartState, requestAddToCart, refreshCartUI } from './cart.js';
import { showToast, confirmCartReplace, showDisambiguationModal } from './overlays.js';

let aliasIndex = new Map();
let aliasKeysSorted = [];

export function buildAliasIndexFromCatalog(){
  const built = buildAliasIndex(RESTAURANTS);
  aliasIndex = built.aliasIndex;
  aliasKeysSorted = built.aliasKeysSorted;
}

async function processAddMentions(mentions){
  const addedNames = [];
  for(const mention of mentions){
    let resolved = resolveMentionSync(mention, cart.restaurantId, currentView);
    if(!resolved){
      const chosenRestaurantId = await showDisambiguationModal(mention.matches[0].item.name, mention.matches);
      if(!chosenRestaurantId) continue; // user dismissed, skip this item
      resolved = mention.matches.find(m=>m.restaurant.id===chosenRestaurantId);
    }
    const { restaurant, item } = resolved;
    if(cart.restaurantId && cart.restaurantId !== restaurant.id && Object.keys(cart.items).length>0){
      const proceed = await confirmCartReplace(findRestaurant(RESTAURANTS, cart.restaurantId).name, restaurant.name);
      if(!proceed) continue;
      clearCartState();
    }
    commitAdd(restaurant.id, item.id, mention.qty, mention.size || 'M');
    addedNames.push(`${mention.qty>1?mention.qty+'x ':''}${item.name}`);
  }
  if(addedNames.length) showToast(`Added: ${addedNames.join(', ')}`);
  else showToast(`Didn't add anything — try again`);
}

function processRemoveMentions(mentions){
  const removedNames = [];
  for(const mention of mentions){
    let resolved = mention.matches.find(m=> cart.restaurantId && m.restaurant.id===cart.restaurantId);
    if(!resolved) continue; // nothing to remove if it's not the active cart's restaurant
    const anyKey = Object.keys(cart.items).find(k=>k.startsWith(resolved.item.id));
    if(anyKey){
      delete cart.items[anyKey];
      removedNames.push(resolved.item.name);
    }
  }
  if(Object.keys(cart.items).length===0) cart.restaurantId = null;
  refreshCartUI();
  if(removedNames.length) showToast(`Removed: ${removedNames.join(', ')}`);
}

// Fallback path: fast local regex/substring parsing, used only if the LLM backend is unreachable.
async function handleVoiceCommandLocal(rawText){
  const text = rawText.toLowerCase().trim();
  if(/clear (my )?cart|empty (my )?cart/.test(text)){
    clearCartState();
    showToast('Cart cleared');
    return;
  }
  const removeMatch = text.match(/\bremove\b|\bdelete\b|\btake out\b/);
  let addText = text, removeText = '';
  if(removeMatch){
    addText = text.slice(0, removeMatch.index);
    removeText = text.slice(removeMatch.index).replace(/\bremove\b|\bdelete\b|\btake out\b/, ' ');
  }
  addText = addText.replace(/\b(add|order|i want|get me|please)\b/g, ' ');

  const addMentions = extractGlobalMentions(addText, aliasIndex, aliasKeysSorted);
  const removeMentions = extractGlobalMentions(removeText, aliasIndex, aliasKeysSorted);

  if(removeMentions.length) processRemoveMentions(removeMentions);
  if(addMentions.length) await processAddMentions(addMentions);
  if(!addMentions.length && !removeMentions.length) showToast(`Didn't catch a dish — try again`);
}

async function callLLMParse(transcript){
  const activeRestaurantId = cart.restaurantId || (currentView.type==='restaurant' ? currentView.id : null);
  const res = await fetch('/api/parse-voice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript, catalog: buildCatalogForLLM(RESTAURANTS), activeRestaurantId }),
  });
  if(!res.ok) throw new Error(`Backend error ${res.status}`);
  return await res.json();
}

// Turns LLM-returned {item_id, restaurant_id} candidates back into the same
// {restaurant, item} match objects the existing disambiguation/conflict logic already expects.
async function applyLLMActions(actions){
  const addMentions = [], removeMentions = [];
  let sawClear = false;
  for(const action of actions){
    if(action.type === 'clear_cart'){ clearCartState(); showToast('Cart cleared'); sawClear = true; continue; }
    const matches = (action.candidates || []).map(c => {
      const restaurant = findRestaurant(RESTAURANTS, c.restaurant_id);
      const item = restaurant && restaurant.menu.find(i=>i.id===c.item_id);
      return (restaurant && item) ? { restaurant, item } : null;
    }).filter(Boolean);
    if(matches.length === 0) continue;
    const mention = { matches, qty: action.quantity || 1, size: action.size || null };
    if(action.type === 'add') addMentions.push(mention);
    else if(action.type === 'remove') removeMentions.push(mention);
  }
  if(removeMentions.length) processRemoveMentions(removeMentions);
  if(addMentions.length) await processAddMentions(addMentions);
  if(!addMentions.length && !removeMentions.length && !sawClear) showToast(`Didn't catch a dish — try again`);
}

export async function handleVoiceCommand(rawText){
  try{
    const result = await callLLMParse(rawText);
    await applyLLMActions(result.actions || []);
  } catch(err){
    console.warn('LLM parse unavailable, using local parser:', err);
    await handleVoiceCommandLocal(rawText);
  }
}

/* ============ VOICE: recognition wiring ============ */
export function wireVoiceRecognition(){
  const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let listening = false;
  const fabMic = document.getElementById('fabMic');
  const headerMic = document.getElementById('headerMic');
  const voiceBubble = document.getElementById('voiceBubble');
  const vbLabel = document.getElementById('vbLabel');
  const vbText = document.getElementById('vbText');

  function setListeningUI(on){
    listening = on;
    fabMic.classList.toggle('listening', on);
    headerMic.classList.toggle('listening', on);
    voiceBubble.classList.toggle('show', on);
    if(on){ vbLabel.textContent = 'Listening'; vbText.textContent = ''; }
  }

  if(SpeechRecognitionCtor){
    recognition = new SpeechRecognitionCtor();
    recognition.lang = 'en-IN';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = ()=> setListeningUI(true);
    recognition.onresult = (e)=>{
      let text='';
      for(let i=0;i<e.results.length;i++) text += e.results[i][0].transcript;
      vbText.textContent = text;
    };
    recognition.onerror = (e)=>{
      listening = false;
      fabMic.classList.remove('listening'); headerMic.classList.remove('listening');
      vbLabel.textContent = 'Mic error';
      vbText.textContent = e.error === 'not-allowed' ? 'Microphone permission blocked.' : `Error: ${e.error}`;
    };
    recognition.onend = async ()=>{
      listening = false;
      const finalText = vbText.textContent.trim();
      fabMic.classList.remove('listening'); headerMic.classList.remove('listening');
      if(finalText){
        vbLabel.textContent = 'Heard';
        await handleVoiceCommand(finalText);
      }
      setTimeout(()=> voiceBubble.classList.remove('show'), 1400);
    };

    const toggleMic = ()=>{ if(listening){ recognition.stop(); } else { try{ recognition.start(); } catch(e){} } };
    fabMic.addEventListener('click', toggleMic);
    headerMic.addEventListener('click', toggleMic);
  } else {
    fabMic.addEventListener('click', ()=> showToast('Voice not supported — try Chrome or Edge'));
    headerMic.addEventListener('click', ()=> showToast('Voice not supported — try Chrome or Edge'));
  }
}

import { supabaseConfigured, loadRestaurantsFromSupabase } from './data.js';
import { renderList, wireSearch } from './render.js';
import { wireCartControls, refreshCartUI } from './cart.js';
import { wireOverlayCloseButtons } from './overlays.js';
import { wireAuthControls, initAuth } from './auth.js';
import { buildAliasIndexFromCatalog, wireVoiceRecognition } from './voice.js';
import { showToast } from './overlays.js';

/* ============ INIT ============ */
(async function init(){
  wireSearch();
  wireCartControls();
  wireOverlayCloseButtons();
  wireAuthControls();
  wireVoiceRecognition();

  const live = await loadRestaurantsFromSupabase();
  buildAliasIndexFromCatalog();
  renderList();
  refreshCartUI();
  await initAuth();
  if(supabaseConfigured && !live) showToast('Could not load live data — showing demo menu');
})();

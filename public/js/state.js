/* ============ SHARED UI STATE ============ */
export let currentView = { type:'list' };
export let selectedSizes = {}; // itemId -> 'S'/'M'/'L' for the currently rendered card
export let currentUser = null; // {id, email} when signed in

export function setCurrentView(view){ currentView = view; }
export function setSelectedSize(itemId, size){ selectedSizes[itemId] = size; }
export function setCurrentUser(user){ currentUser = user; }

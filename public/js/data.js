/* ============ SUPABASE CONFIG ============ */
// Fill these in from your Supabase project → Settings → API.
// Leave as-is to run entirely on the built-in demo data below.
const SUPABASE_URL = 'https://gxcfbjusfjphwhnymmgo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4Y2ZianVzZmpwaHdobnltbWdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2NDQxODQsImV4cCI6MjEwMTIyMDE4NH0.BoJy4FTMeluQNLTng19pvbiNSTyqB-S3N-VrB8b3Wv0';

export const supabaseConfigured = SUPABASE_URL.startsWith('http') && SUPABASE_ANON_KEY.length > 10;
export const supabaseClient = supabaseConfigured ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

/* ============ DATA (fallback demo data — used if Supabase isn't configured, or the fetch fails) ============ */
export let RESTAURANTS = [
  { id:'milan', name:'Milan', area:'Sector 10', cuisine:'North Indian, Mithai', rating:4.3, time:'28-33 min', p4t:400, emoji:'🍛', color:'linear-gradient(135deg,#FFE3C2,#FFC98A)',
    menu:[
      { id:'milan_dal_makhani', name:'Dal Makhani', price:220, veg:true, aliases:['dal makhani','daal makhani','dal makhni'] },
      { id:'milan_paneer_bhurji', name:'Paneer Bhurji', price:210, veg:true, aliases:['paneer bhurji','paneer burji'] },
      { id:'milan_kadhai_paneer', name:'Kadhai Paneer', price:240, veg:true, aliases:['kadhai paneer','kadai paneer','karahi paneer'] },
      { id:'milan_naan', name:'Naan', price:45, veg:true, aliases:['naan','plain naan'] },
      { id:'milan_tandoori_roti', name:'Tandoori Roti', price:30, veg:true, aliases:['tandoori roti'] },
      { id:'milan_rasgulla', name:'Rasgulla', price:90, veg:true, aliases:['rasgulla','rosogolla'] },
    ]},
  { id:'aashirwaad', name:'Aashirwaad', area:'Sector 14', cuisine:'North Indian, Arabian', rating:4.1, time:'25-30 min', p4t:450, emoji:'🍢', color:'linear-gradient(135deg,#FFD6D6,#FF9E9E)',
    menu:[
      { id:'aash_mix_veg', name:'Mix Veg', price:200, veg:true, aliases:['mix veg','mixed veg','mixed vegetable'] },
      { id:'aash_chicken_shawarma', name:'Chicken Shawarma', price:180, veg:false, aliases:['chicken shawarma','shawarma'] },
      { id:'aash_butter_chicken', name:'Butter Chicken', price:320, veg:false, aliases:['butter chicken'] },
      { id:'aash_chilli_chicken', name:'Chilli Chicken', price:260, veg:false, aliases:['chilli chicken','chili chicken'] },
      { id:'aash_kadhai_paneer', name:'Kadhai Paneer', price:230, veg:true, aliases:['kadhai paneer','kadai paneer','karahi paneer'] },
      { id:'aash_khamiri_roti', name:'Khamiri Roti', price:35, veg:true, aliases:['khamiri roti'] },
    ]},
  { id:'burgerclub', name:'Burger Club', area:'Sector 15', cuisine:'Burgers, Fast Food', rating:4.0, time:'20-25 min', p4t:350, emoji:'🍔', color:'linear-gradient(135deg,#FFF0B8,#FFD966)',
    menu:[
      { id:'bc_veg_basic', name:'Veg Burger Basic', price:99, veg:true, aliases:['veg burger basic','basic veg burger','veg burger'] },
      { id:'bc_nonveg_basic', name:'Non-Veg Burger Basic', price:139, veg:false, aliases:['non veg burger basic','basic non veg burger','nonveg burger basic','chicken burger basic','non veg burger','nonveg burger','non-veg burger'] },
      { id:'bc_veg_supreme', name:'Veg Supreme Burger', price:159, veg:true, aliases:['veg supreme burger','supreme veg burger'] },
      { id:'bc_nonveg_supreme', name:'Non-Veg Supreme Burger', price:199, veg:false, aliases:['non veg supreme burger','supreme non veg burger','nonveg supreme burger','non veg supreme','nonveg supreme'] },
      { id:'bc_fries', name:'Fries', veg:true, hasSize:true, sizePrices:{S:99,M:129,L:159}, aliases:['fries','french fries'] },
      { id:'bc_coke', name:'Coke', price:60, veg:true, aliases:['coke','coca cola','cola'] },
      { id:'bc_pepsi', name:'Pepsi', price:60, veg:true, aliases:['pepsi'] },
    ]},
  { id:'bennedosa', name:'Benne Dosa', area:'Sector 7', cuisine:'South Indian', rating:4.4, time:'22-28 min', p4t:300, emoji:'🥞', color:'linear-gradient(135deg,#DFF3D8,#B9E6A8)',
    menu:[
      { id:'bd_plain_dosa', name:'Dosa Plain', price:110, veg:true, aliases:['dosa plain','plain dosa'] },
      { id:'bd_masala_dosa', name:'Masala Dosa', price:140, veg:true, aliases:['masala dosa'] },
      { id:'bd_rawa_idli', name:'Rawa Idli', price:120, veg:true, aliases:['rawa idli'] },
      { id:'bd_ghee_podi_idli', name:'Ghee Podi Idli', price:130, veg:true, aliases:['ghee podi idli','podi idli'] },
      { id:'bd_coconut_water', name:'Coconut Water', price:70, veg:true, aliases:['coconut water','nariyal pani'] },
    ]},
];

/* ============ SUPABASE: load live data ============ */
export async function loadRestaurantsFromSupabase(){
  if(!supabaseConfigured) return false;
  try{
    const [{ data: rRows, error: rErr }, { data: mRows, error: mErr }] = await Promise.all([
      supabaseClient.from('restaurants').select('*'),
      supabaseClient.from('menu_items').select('*'),
    ]);
    if(rErr || mErr || !rRows || rRows.length===0) throw rErr || mErr || new Error('No restaurants found');

    const byRestaurant = {};
    for(const row of rRows){
      byRestaurant[row.id] = {
        id: row.id, name: row.name, area: row.area, cuisine: row.cuisine,
        rating: row.rating, time: row.delivery_time, p4t: row.price_for_two,
        emoji: row.emoji, menu: [],
      };
    }
    for(const row of mRows){
      const r = byRestaurant[row.restaurant_id];
      if(!r) continue;
      r.menu.push({
        id: row.id, name: row.name, price: row.price, veg: row.veg,
        hasSize: row.has_size, sizePrices: row.size_prices || null,
        aliases: row.aliases || [],
      });
    }
    RESTAURANTS = Object.values(byRestaurant);
    return true;
  } catch(err){
    console.warn('Supabase load failed, using demo data:', err);
    return false;
  }
}

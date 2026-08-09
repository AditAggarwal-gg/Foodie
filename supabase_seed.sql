-- ============================================================
-- foodie: seed data — run after supabase_schema.sql
-- ============================================================

insert into restaurants (id, name, area, cuisine, rating, delivery_time, price_for_two, emoji) values
  ('milan', 'Milan', 'Sector 10', 'North Indian, Mithai', 4.3, '28-33 min', 400, '🍛'),
  ('aashirwaad', 'Aashirwaad', 'Sector 14', 'North Indian, Arabian', 4.1, '25-30 min', 450, '🍢'),
  ('burgerclub', 'Burger Club', 'Sector 15', 'Burgers, Fast Food', 4.0, '20-25 min', 350, '🍔'),
  ('bennedosa', 'Benne Dosa', 'Sector 7', 'South Indian', 4.4, '22-28 min', 300, '🥞'),
  ('punjabdadhaba', 'Punjab Da Dhaba', 'Sector 22', 'Punjabi, North Indian', 4.2, '30-35 min', 420, '🫓'),
  ('wokthisway', 'Wok This Way', 'Sector 18', 'Chinese, Indo-Chinese', 3.9, '25-30 min', 380, '🥡'),
  ('pizzamania', 'Pizza Mania', 'Sector 9', 'Pizza, Italian', 4.0, '25-30 min', 400, '🍕'),
  ('chaipointcafe', 'Chai Point Cafe', 'Sector 20', 'Cafe, Snacks', 4.3, '15-20 min', 250, '☕')
on conflict (id) do nothing;

-- ---------- Milan ----------
insert into menu_items (id, restaurant_id, name, price, veg, aliases) values
  ('milan_dal_makhani', 'milan', 'Dal Makhani', 220, true, array['dal makhani','daal makhani','dal makhni']),
  ('milan_paneer_bhurji', 'milan', 'Paneer Bhurji', 210, true, array['paneer bhurji','paneer burji']),
  ('milan_kadhai_paneer', 'milan', 'Kadhai Paneer', 240, true, array['kadhai paneer','kadai paneer','karahi paneer']),
  ('milan_naan', 'milan', 'Naan', 45, true, array['naan','plain naan']),
  ('milan_tandoori_roti', 'milan', 'Tandoori Roti', 30, true, array['tandoori roti']),
  ('milan_rasgulla', 'milan', 'Rasgulla', 90, true, array['rasgulla','rosogolla'])
on conflict (id) do nothing;

-- ---------- Aashirwaad ----------
insert into menu_items (id, restaurant_id, name, price, veg, aliases) values
  ('aash_mix_veg', 'aashirwaad', 'Mix Veg', 200, true, array['mix veg','mixed veg','mixed vegetable']),
  ('aash_chicken_shawarma', 'aashirwaad', 'Chicken Shawarma', 180, false, array['chicken shawarma','shawarma']),
  ('aash_butter_chicken', 'aashirwaad', 'Butter Chicken', 320, false, array['butter chicken']),
  ('aash_chilli_chicken', 'aashirwaad', 'Chilli Chicken', 260, false, array['chilli chicken','chili chicken']),
  ('aash_kadhai_paneer', 'aashirwaad', 'Kadhai Paneer', 230, true, array['kadhai paneer','kadai paneer','karahi paneer']),
  ('aash_khamiri_roti', 'aashirwaad', 'Khamiri Roti', 35, true, array['khamiri roti'])
on conflict (id) do nothing;

-- ---------- Burger Club ----------
insert into menu_items (id, restaurant_id, name, price, veg, aliases) values
  ('bc_veg_basic', 'burgerclub', 'Veg Burger Basic', 99, true, array['veg burger basic','basic veg burger','veg burger']),
  ('bc_nonveg_basic', 'burgerclub', 'Non-Veg Burger Basic', 139, false, array['non veg burger basic','basic non veg burger','nonveg burger basic','chicken burger basic','non veg burger','nonveg burger','non-veg burger']),
  ('bc_veg_supreme', 'burgerclub', 'Veg Supreme Burger', 159, true, array['veg supreme burger','supreme veg burger']),
  ('bc_nonveg_supreme', 'burgerclub', 'Non-Veg Supreme Burger', 199, false, array['non veg supreme burger','supreme non veg burger','nonveg supreme burger','non veg supreme','nonveg supreme']),
  ('bc_coke', 'burgerclub', 'Coke', 60, true, array['coke','coca cola','cola']),
  ('bc_pepsi', 'burgerclub', 'Pepsi', 60, true, array['pepsi'])
on conflict (id) do nothing;

insert into menu_items (id, restaurant_id, name, veg, has_size, size_prices, aliases) values
  ('bc_fries', 'burgerclub', 'Fries', true, true, '{"S":99,"M":129,"L":159}', array['fries','french fries'])
on conflict (id) do nothing;

-- ---------- Benne Dosa ----------
insert into menu_items (id, restaurant_id, name, price, veg, aliases) values
  ('bd_plain_dosa', 'bennedosa', 'Dosa Plain', 110, true, array['dosa plain','plain dosa']),
  ('bd_masala_dosa', 'bennedosa', 'Masala Dosa', 140, true, array['masala dosa']),
  ('bd_rawa_idli', 'bennedosa', 'Rawa Idli', 120, true, array['rawa idli']),
  ('bd_ghee_podi_idli', 'bennedosa', 'Ghee Podi Idli', 130, true, array['ghee podi idli','podi idli']),
  ('bd_coconut_water', 'bennedosa', 'Coconut Water', 70, true, array['coconut water','nariyal pani'])
on conflict (id) do nothing;

-- ---------- Punjab Da Dhaba ----------
insert into menu_items (id, restaurant_id, name, price, veg, aliases) values
  ('pdd_chole_bhature', 'punjabdadhaba', 'Chole Bhature', 160, true, array['chole bhature','chhole bhature']),
  ('pdd_amritsari_kulcha', 'punjabdadhaba', 'Amritsari Kulcha', 150, true, array['amritsari kulcha','kulcha']),
  ('pdd_paneer_lababdar', 'punjabdadhaba', 'Paneer Lababdar', 250, true, array['paneer lababdar']),
  ('pdd_rajma_chawal', 'punjabdadhaba', 'Rajma Chawal', 180, true, array['rajma chawal','rajma rice']),
  ('pdd_lassi', 'punjabdadhaba', 'Sweet Lassi', 80, true, array['lassi','sweet lassi']),
  ('pdd_gulab_jamun', 'punjabdadhaba', 'Gulab Jamun', 80, true, array['gulab jamun'])
on conflict (id) do nothing;

-- ---------- Wok This Way ----------
insert into menu_items (id, restaurant_id, name, price, veg, aliases) values
  ('wtw_veg_manchurian', 'wokthisway', 'Veg Manchurian', 190, true, array['veg manchurian','vegetable manchurian']),
  ('wtw_chicken_manchurian', 'wokthisway', 'Chicken Manchurian', 240, false, array['chicken manchurian']),
  ('wtw_hakka_noodles', 'wokthisway', 'Hakka Noodles', 170, true, array['hakka noodles','noodles']),
  ('wtw_fried_rice', 'wokthisway', 'Veg Fried Rice', 160, true, array['fried rice','veg fried rice']),
  ('wtw_spring_rolls', 'wokthisway', 'Spring Rolls', 150, true, array['spring rolls','spring roll']),
  ('wtw_chilli_paneer', 'wokthisway', 'Chilli Paneer', 220, true, array['chilli paneer','chili paneer'])
on conflict (id) do nothing;

-- ---------- Pizza Mania ----------
insert into menu_items (id, restaurant_id, name, price, veg, aliases) values
  ('pm_margherita', 'pizzamania', 'Margherita Pizza', 250, true, array['margherita pizza','margherita','pizza']),
  ('pm_farmhouse', 'pizzamania', 'Farmhouse Pizza', 290, true, array['farmhouse pizza','farmhouse']),
  ('pm_peppy_paneer', 'pizzamania', 'Peppy Paneer Pizza', 300, true, array['peppy paneer pizza','peppy paneer']),
  ('pm_chicken_tikka', 'pizzamania', 'Chicken Tikka Pizza', 340, false, array['chicken tikka pizza']),
  ('pm_garlic_bread', 'pizzamania', 'Garlic Bread', 130, true, array['garlic bread']),
  ('pm_cold_drink', 'pizzamania', 'Cold Drink', 50, true, array['cold drink','soft drink'])
on conflict (id) do nothing;

-- ---------- Chai Point Cafe ----------
insert into menu_items (id, restaurant_id, name, price, veg, aliases) values
  ('cpc_masala_chai', 'chaipointcafe', 'Masala Chai', 40, true, array['masala chai','chai']),
  ('cpc_cold_coffee', 'chaipointcafe', 'Cold Coffee', 90, true, array['cold coffee']),
  ('cpc_veg_sandwich', 'chaipointcafe', 'Veg Sandwich', 120, true, array['veg sandwich']),
  ('cpc_grilled_cheese', 'chaipointcafe', 'Grilled Cheese Sandwich', 140, true, array['grilled cheese sandwich','grilled cheese']),
  ('cpc_maggi', 'chaipointcafe', 'Maggi', 90, true, array['maggi']),
  ('cpc_brownie', 'chaipointcafe', 'Brownie', 110, true, array['brownie'])
on conflict (id) do nothing;

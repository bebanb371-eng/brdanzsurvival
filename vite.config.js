import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  server:{proxy:{'/api':'http://localhost:3001','/ws':{target:'ws://localhost:3001',ws:true}}},
  build: { rollupOptions: { input: ['index.html','lobby.html','loading.html','survival.html','character.html','inventory.html','shop.html','skins.html','missions.html','events.html','rank.html','settings.html','crafting.html','map.html','pause.html','gameover.html','login.html','register.html','profile.html','friends.html','multiplayer.html','room.html','house.html','spin.html'] } }
});

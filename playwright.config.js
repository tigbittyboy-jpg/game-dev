import {defineConfig} from '@playwright/test';
import {existsSync} from 'node:fs';
export default defineConfig({
 testDir:'./test/browser',timeout:90000,workers:1,
 expect:{timeout:15000},
 use:{baseURL:'http://127.0.0.1:5173',viewport:{width:1440,height:900},trace:'retain-on-failure',screenshot:'only-on-failure',launchOptions:{...(existsSync('/usr/bin/chromium')?{executablePath:'/usr/bin/chromium'}:{}),args:['--enable-unsafe-swiftshader']}},
 webServer:{command:'npm run dev -- --port 5173 --strictPort',url:'http://127.0.0.1:5173',reuseExistingServer:true},
});

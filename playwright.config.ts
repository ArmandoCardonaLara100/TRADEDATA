import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests/e2e',fullyParallel:false,workers:1,retries:0,timeout:60000,expect:{timeout:15000},reporter:'list',use:{baseURL:process.env.TEST_BASE_URL||'http://localhost:3000',headless:true,viewport:{width:1440,height:1000},trace:'retain-on-failure',screenshot:'only-on-failure'},outputDir:'test-results'});

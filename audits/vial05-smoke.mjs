import { chromium } from '@playwright/test';
const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--no-proxy-server','--disable-features=BlockInsecurePrivateNetworkRequests,PrivateNetworkAccessSendPreflights']});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const base='http://172.26.36.7:3110';
for(const [path,name] of [['/sell','sell'],['/seller','seller'],['/cart','cart-empty']]){
  await page.goto(base+path,{waitUntil:'networkidle'});
  await page.screenshot({path:`audits/screenshots-v0.5/${name}.png`,fullPage:true});
}
await page.goto(base+'/products/arcwell-kpv-10mg',{waitUntil:'networkidle'});
await page.getByRole('button',{name:/Add to sandbox cart/i}).click();
await page.getByText(/Added to the test-mode cart/i).waitFor();
await page.goto(base+'/cart',{waitUntil:'networkidle'});
await page.getByText('Order summary').waitFor();
await page.screenshot({path:'audits/screenshots-v0.5/cart-filled.png',fullPage:true});
await page.getByRole('link',{name:/Continue to sandbox checkout/i}).click();
await page.getByText('Mock Connect Payment Element').waitFor();
await page.screenshot({path:'audits/screenshots-v0.5/checkout.png',fullPage:true});
await page.getByRole('button',{name:/Place sandbox order/i}).click();
await page.waitForURL(/\/orders\/.*\/confirmation/,{timeout:20000});
await page.getByText('Order created exactly once.').waitFor({timeout:20000});
await page.screenshot({path:'audits/screenshots-v0.5/confirmation.png',fullPage:true});
console.log('commerce browser flow passed',page.url());
await browser.close();

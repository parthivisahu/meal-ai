import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { chromium } from 'playwright';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

dotenv.config();
puppeteer.use(StealthPlugin());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const USER_DATA_DIR = path.join(__dirname, '../../chrome-profile');

/* =====================================================
   CART AUTOMATION SERVICE
   Adds items to cart and facilitates checkout
===================================================== */

const PLATFORM_CONFIGS = {
  blinkit: {
    baseUrl: 'https://blinkit.com',
    searchUrl: (item) => `https://blinkit.com/s/?q=${encodeURIComponent(item)}`,
    selectors: {
      productCard: '[class*="Product__"]',
      productName: '[class*="Product__ProductName"]',
      addToCart: '[class*="AddToCart"]',
      cartIcon: '[class*="CartIcon"]',
      cartCount: '[class*="CartCount"]',
      checkoutButton: 'button:has-text("Proceed to Checkout")',
    }
  },
  bigbasket: {
    baseUrl: 'https://www.bigbasket.com',
    searchUrl: (item) => `https://www.bigbasket.com/ps/?q=${encodeURIComponent(item)}`,
    selectors: {
      productCard: '[qa="product_name"]',
      productName: '[qa="product_name"]',
      addToCart: 'button[qa="add"]',
      cartIcon: '[class*="CartIcon"]',
      cartCount: '[class*="CartCount"]',
      checkoutButton: 'button:has-text("Checkout")',
    }
  },
  zepto: {
    baseUrl: 'https://www.zeptonow.com', 
    searchUrl: (item) => `https://www.zeptonow.com/search?query=${encodeURIComponent(item)}`,
    selectors: {
      productCard: '[data-testid="product-card"]',
      productName: '[data-testid="product-card-name"]',
      addToCart: '[data-testid="add-to-cart-button"]',
      cartIcon: '[data-testid="cart-icon"]',
      cartCount: '[data-testid="cart-count"]',
      checkoutButton: 'button:has-text("View Cart")',
    }
  },
  instamart: {
    baseUrl: 'https://www.swiggy.com/instamart',
    searchUrl: (item) => `https://www.swiggy.com/instamart/search?query=${encodeURIComponent(item)}`,
    selectors: {
      productCard: '[data-testid="item-card-container"]',
      productName: '[data-testid="item-name"]',
      addToCart: '[data-testid="item-add-button"]',
      cartIcon: '[data-testid="cart-icon"]',
      cartCount: '[data-testid="cart-count"]',
      checkoutButton: 'button:has-text("View Cart")',
    }
  }
};

let activeBrowser = null;

export class CartAutomation {
  constructor(platform, userCredentials = null) {
    this.platform = platform;
    this.config = PLATFORM_CONFIGS[platform];
    this.browser = null;
    this.page = null;
    this.credentials = userCredentials; // { email, password } for auto-login
    this.cartItems = [];
    this.hasPausedForLocation = false;
  }

  async _scrollIntoView(handle) {
    try {
      await handle.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    } catch (e) {}
  }

  async _clickByTextOnPage(regex) {
    try {
      return await this.page.evaluate((regexSource, regexFlags) => {
        const regex = new RegExp(regexSource, regexFlags);
        const candidates = Array.from(document.querySelectorAll('button, a, div, span'));
        const target = candidates.find(el => {
          const label = (el.innerText || '').trim() || el.getAttribute('aria-label') || el.getAttribute('title') || '';
          return regex.test(label);
        });
        if (target) {
          target.click();
          return true;
        }
        return false;
      }, regex.source, regex.flags);
    } catch (e) {
      return false;
    }
  }

  async _clickByTextInHandle(handle, regex) {
    try {
      return await handle.evaluate((root, regexSource, regexFlags) => {
        const regex = new RegExp(regexSource, regexFlags);
        const candidates = Array.from(root.querySelectorAll('button, a, div, span'));
        const target = candidates.find(el => {
          const label = (el.innerText || '').trim() || el.getAttribute('aria-label') || el.getAttribute('title') || '';
          return regex.test(label);
        });
        if (target) {
          target.click();
          return true;
        }
        return false;
      }, regex.source, regex.flags);
    } catch (e) {
      return false;
    }
  }

  _normalizeTokens(text) {
    return (text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t && !['the', 'and', 'fresh', 'pure', 'pack', 'pkt'].includes(t));
  }

  async _pickBestProductCard(itemName, productCards) {
    if (!productCards || productCards.length === 0) return null;
    if (productCards.length === 1) return productCards[0];

    const tokens = this._normalizeTokens(itemName);
    const results = [];

    for (const handle of productCards.slice(0, 12)) {
      try {
        const data = await handle.evaluate((el) => {
          const text = (el.innerText || '').replace(/\s+/g, ' ').trim();
          const priceMatch = text.match(/₹\s*([0-9]+(?:\.[0-9]+)?)|Rs\.?\s*([0-9]+(?:\.[0-9]+)?)/i);
          const price = priceMatch ? parseFloat(priceMatch[1] || priceMatch[2]) : null;
          return { text, price };
        });
        results.push({ handle, text: data.text || '', price: data.price });
      } catch (e) {}
    }

    let best = null;
    let bestScore = -Infinity;

    for (const r of results) {
      const textTokens = this._normalizeTokens(r.text);
      const matchCount = tokens.filter(t => textTokens.includes(t)).length;
      if (matchCount === 0) continue;
      const price = Number.isFinite(r.price) ? r.price : 999999;
      const score = matchCount * 100000 - price;
      if (score > bestScore) {
        bestScore = score;
        best = r.handle;
      }
    }

    return best || productCards[0];
  }

  async initialize() {
    console.log(`[Cart] Initializing browser for ${this.platform}...`);
    
    const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER;

    try {
        if (isProduction) {
            console.log('[Cart] Production detected: Using Playwright (headless).');
            this.browser = await chromium.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            this.context = await this.browser.newContext({
                viewport: { width: 1920, height: 1080 },
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                geolocation: { latitude: 17.385044, longitude: 78.486671 },
                permissions: ['geolocation', 'notifications']
            });
            this.page = await this.context.newPage();
        } else {
            console.log('[Cart] Local detected: Using Puppeteer (headed).');
            this.browser = await puppeteer.launch({
                headless: false,
                userDataDir: USER_DATA_DIR,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-blink-features=AutomationControlled',
                    '--window-size=1920,1080'
                ]
            });
            this.page = await this.browser.newPage();
            await this.page.setViewport({ width: 1920, height: 1080 });
            await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        }
    } catch (err) {
        console.error('[Cart] Fatal browser launch error:', err.message);
        throw err;
    }
    
    activeBrowser = this.browser;

    try {
      if (isProduction) {
          // Playwright style permissions
          await this.context.grantPermissions(['geolocation', 'notifications'], { origin: this.config.baseUrl });
      } else {
          // Puppeteer style permissions
          const context = this.browser.defaultBrowserContext();
          await context.overridePermissions(this.config.baseUrl, ['geolocation', 'notifications']);
          
          await this.page.setGeolocation({ latitude: 17.385044, longitude: 78.486671 });
          await this.page.evaluateOnNewDocument(() => {
              const originalQuery = window.navigator.permissions.query;
              window.navigator.permissions.query = (parameters) => (
                  parameters.name === 'notifications' ?
                  Promise.resolve({ state: 'granted' }) :
                  originalQuery(parameters)
              );
          });
      }
    } catch (e) {
      console.warn('[Cart] Failed to set browser permissions:', e.message);
    }
    
    console.log(`[Cart] Browser ready for ${this.platform}`);
  }

  async login() {
    if (!this.credentials) {
      console.log('[Cart] Checking session status...');
      try {
          await this.page.goto(this.config.baseUrl);
          await new Promise(r => setTimeout(r, 3000));
      } catch (e) {
          console.log('[Cart] Navigation warning:', e.message);
      }
      return;
    }
  }

  async searchAndAddToCart(itemName, quantity = 1) {
    try {
      console.log(`[Cart] Searching for: ${itemName}`);
      
      const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER;

      const searchUrl = this.config.searchUrl(itemName);
      // Better waiting strategy for SPAs
      try {
        await this.page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 45000 });
        
        // Handle Location Overlays for Zepto/BigBasket
        if (isProduction) {
            if (this.platform === 'zepto') {
                // Try to click "Confirm Location" or "Locate Me" if it exists
                await this.page.locator('button:has-text("Confirm Location"), button:text("Confirm")').first().click({ force: true, timeout: 3000 }).catch(() => {});
            } else if (this.platform === 'bigbasket') {
                // Try to click "Use my current location"
                await this.page.locator('button:has-text("Use my current location")').first().click({ force: true, timeout: 3000 }).catch(() => {});
            }
        }
      } catch (e) {
        console.warn(`[Cart] Navigation failed for ${this.platform} search. Retrying base URL first.`);
        await this.page.goto(this.config.baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
        await this.page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
      }

      if (this.platform === 'instamart') {
        try {
          const blocked = await this.page.evaluate(() =>
            document.body?.innerText?.includes('Something went wrong') || false
          );
          if (blocked) {
            console.warn('[Cart] Instamart blocked automation (403). Please add items manually.');
            return { success: false, item: itemName, reason: 'instamart_blocked' };
          }
        } catch (e) {}
      }

      // Scroll to trigger lazy loading
      await this.page.evaluate(() => window.scrollBy(0, 300));
      await new Promise(r => setTimeout(r, 2000));

      // Specific wait for product cards
      try {
          if (isProduction) {
              // Playwright style waiting
              const waitOptions = { timeout: 10000 };
              if (this.platform === 'blinkit') {
                  await this.page.waitForSelector('div[class*="AddToCart"], a[href*="/prn/"]', waitOptions);
              } else if (this.platform === 'zepto') {
                  await this.page.waitForSelector('[data-testid="product-card"], [data-testid="product-card-name"]', waitOptions);
              } else if (this.platform === 'bigbasket') {
                  await this.page.waitForSelector('[qa="product_name"], [class*="ProductDeckStory"], .sku-card', waitOptions);
              } else if (this.platform === 'instamart') {
                  await this.page.waitForSelector('[data-testid="item-card-container"], [data-testid="item-name"]', waitOptions);
              }
          } else {
              // Puppeteer style waiting
              if (this.platform === 'blinkit') {
                  await this.page.waitForSelector('div[class*="AddToCart"], a[href*="/prn/"]', { timeout: 8000 });
              } else if (this.platform === 'zepto') {
                  await this.page.waitForSelector('[data-testid="product-card"], [data-testid="product-card-name"]', { timeout: 8000 });
              } else if (this.platform === 'instamart') {
                  await this.page.waitForSelector('[data-testid="item-card-container"], [data-testid="item-name"]', { timeout: 8000 });
              } else {
                  await this.page.waitForSelector('[qa="product_name"], [class*="ProductDeckStory"]', { timeout: 8000 });
              }
          }
      } catch (e) {}

      // Find first matching product
      let productCards = [];
      if (this.platform === 'blinkit') {
          // Robust Blinkit Selectors: Links first
          const productLinks = await this.page.$$('a[href*="/prn/"]');
          if (productLinks.length > 0) {
              productCards = productLinks;
              console.log(`[Cart] Found ${productLinks.length} product links via href strategy.`);
          } else {
              productCards = await this.page.$$('[data-test-id="product-card"]');
          }
          // Fallback: Text-based ADD button search
          if (productCards.length === 0) {
              if (isProduction) {
                  const addButtons = await this.page.locator('text=ADD').all();
                  if (addButtons.length > 0) productCards = [addButtons[0]];
              } else {
                  const addButtons = await this.page.$$("xpath///div[contains(text(), 'ADD')] | //button[contains(text(), 'ADD')]");
                  if (addButtons.length > 0) productCards = [addButtons[0]];
              }
          }
      } else if (this.platform === 'zepto') {
          productCards = isProduction 
              ? await this.page.locator('[data-testid="product-card"]').all()
              : await this.page.$$('[data-testid="product-card"]');
      } else if (this.platform === 'instamart') {
          productCards = isProduction
              ? await this.page.locator('[data-testid="item-card-container"]').all()
              : await this.page.$$('[data-testid="item-card-container"]');
      } else {
          // BigBasket Selectors
          productCards = isProduction
              ? await this.page.locator('[qa="product_name"], [class*="ProductDeckStory"], .sku-card').all()
              : await this.page.$$('[class*="ProductDeckStory"], [qa="product_name"]');
      }

      if (productCards.length === 0) {
        console.log(`[Cart] ?? No products found for: ${itemName}`);
        return { success: false, item: itemName, reason: 'Not found' };
      }

      const firstProduct = await this._pickBestProductCard(itemName, productCards) || productCards[0];

      // BLINKIT SPECIFIC ADD LOGIC
      if (this.platform === 'blinkit') {
          const isProductionLocal = isProduction; // Capture for inner scope
          const getBlinkitAddButton = async () => {
              if (isProductionLocal) {
                  // Playwright: use a cleaner comma-separated selector without nested quotes
                  const btn = this.page.locator('div[class*="AddToCart"], :text("ADD")').first();
                  return (await btn.count()) > 0 ? btn : null;
              }
              let btn = await this.page.$('div[class*="AddToCart"]');
              if (btn) return btn;
              const xpathButtons = await this.page.$$("xpath///div[contains(text(),'ADD')] | //button[contains(text(),'ADD')]");
              if (xpathButtons && xpathButtons.length > 0) return xpathButtons[0];
              return null;
          };

          let addButton = await getBlinkitAddButton();
          if (addButton) {
              for (let i = 0; i < quantity; i++) {
                if (isProduction) {
                    // Use force: true to bypass the "LocationOverlay" interception
                    await addButton.click({ force: true, timeout: 5000 }).catch(async () => {
                        console.log('[Cart] Standard click failed, attempting dispatchEvent click...');
                        await addButton.evaluate(node => node.click());
                    });
                } else {
                    await this.page.evaluate(el => el.click(), addButton);
                }
                console.log(`[Cart] Clicked Add (${i + 1}/${quantity})`);
                await new Promise(r => setTimeout(r, 1200));
              }
              console.log(`[Cart] ? Added ${quantity}x ${itemName}`);
              this.cartItems.push({ name: itemName, quantity, originalSearch: itemName });
              return { success: true, item: itemName, quantity };
          }
      } else if (this.platform === 'zepto') {
          let addButton = await firstProduct.$('[data-testid="add-to-cart-button"]');
          if (addButton) await this._scrollIntoView(addButton);

          for (let i = 0; i < quantity; i++) {
            let clicked = false;
            if (i === 0) {
              if (addButton) {
                try {
                  if (isProduction) await addButton.click({ force: true });
                  else await addButton.click();
                  clicked = true;
                } catch (e) {}
              }
              if (!clicked) clicked = await this._clickByTextInHandle(firstProduct, /add/i);
              if (!clicked) clicked = await this._clickByTextOnPage(/add/i);
            } else {
              const incButton = await firstProduct.$('[data-testid="increment-button"]');
              if (incButton) {
                await this._scrollIntoView(incButton);
                try {
                  await incButton.click();
                  clicked = true;
                } catch (e) {}
              }
              if (!clicked) clicked = await this._clickByTextInHandle(firstProduct, /increase|increment|\+/i);
            }

            if (!clicked) {
              console.log(`[Cart] ?? Zepto add/increment failed for: ${itemName}`);
              break;
            }

            console.log(`[Cart] Clicked Add (${i + 1}/${quantity})`);
            await new Promise(r => setTimeout(r, 1500));
          }

          console.log(`[Cart] ? Added ${quantity}x ${itemName}`);
          this.cartItems.push({ name: itemName, quantity, originalSearch: itemName });
          return { success: true, item: itemName, quantity };
      } else if (this.platform === 'instamart') {
          let addButton = await firstProduct.$('[data-testid="item-add-button"]');
          if (!addButton && isProduction) {
              const loc = this.page.locator('button:has-text("Add"), button:has-text("ADD")').first();
              if (await loc.count() > 0) addButton = loc;
          }
          if (!addButton && !isProduction) {
            const [xpathBtn] = await this.page.$$("xpath///button[contains(text(),\"Add\")] | //button[contains(text(),\"ADD\")]");
            if (xpathBtn) addButton = xpathBtn;
          }
          if (addButton) {
              for (let i = 0; i < quantity; i++) {
                await addButton.click();
                console.log(`[Cart] Clicked Add (${i + 1}/${quantity})`);
                await new Promise(r => setTimeout(r, 1500));
                const incButton = await firstProduct.$('[data-testid="item-increment-button"]');
                if (incButton) addButton = incButton;
              }
              console.log(`[Cart] ? Added ${quantity}x ${itemName}`);
              this.cartItems.push({ name: itemName, quantity, originalSearch: itemName });
              return { success: true, item: itemName, quantity };
          }
      }

      // Standard Logic for BigBasket
      const counterWidget = await firstProduct.$('[class*="Counter"]');
      if (counterWidget) {
          console.log(`[Cart] Item '${itemName}' already in cart. Skipping.`);
          return { success: true, item: itemName, quantity: 0, status: 'already_in_cart' };
      }

      let addButton = await firstProduct.$('button[qa="add"]');
      if (!addButton && isProduction) {
          const loc = this.page.locator('button:has-text("Add"), button:has-text("ADD")').first();
          if (await loc.count() > 0) addButton = loc;
      }
      if (!addButton && !isProduction) {
        const [xpathBtn] = await this.page.$$("xpath///button[contains(text(),\"Add\")] | //button[contains(text(),\"ADD\")]");
        if (xpathBtn) addButton = xpathBtn;
      }

      if (!addButton) {
        const clicked = await this._clickByTextInHandle(firstProduct, /add/i) || await this._clickByTextOnPage(/add/i);
        if (clicked) {
          console.log(`[Cart] ? Added 1x ${itemName}`);
          this.cartItems.push({ name: itemName, quantity: 1, originalSearch: itemName });
          return { success: true, item: itemName, quantity: 1 };
        }
        console.log(`[Cart] ?? Add button missing for: ${itemName}`);
        return { success: false, item: itemName, reason: 'Button not found / OOS' };
      }

      await this._scrollIntoView(addButton);
      for (let i = 0; i < quantity; i++) {
        await addButton.click();
        console.log(`[Cart] Clicked Add (${i + 1}/${quantity})`);
        await new Promise(r => setTimeout(r, 2000));
      }

      console.log(`[Cart] ? Added ${quantity}x ${itemName}`);
      this.cartItems.push({ name: itemName, quantity, originalSearch: itemName });
      return { success: true, item: itemName, quantity };

    } catch (error) {
      console.error(`[Cart] Error adding ${itemName}:`, error.message);
      return { success: false, item: itemName, reason: error.message };
    }
  }

  async addMultipleItems(shoppingList) {
    console.log(`[Cart] Adding ${shoppingList.length} items to cart...`);
    
    const results = [];

    for (const item of shoppingList) {
      let qty = 1;
      if (item.qty) {
        const qtyText = String(item.qty).toLowerCase();
        const numeric = parseFloat(qtyText);
        const isWeightOrVolume = /(kg|g|gm|gram|grams|l|ml|litre|liter)/.test(qtyText);
        const isCount = /(unit|units|pc|pcs|piece|pieces|pack|packs|packet|packets|dozen)/.test(qtyText);
        const isLooseProduce = /(onion|onions|tomato|tomatoes|potato|potatoes)/.test((item.item || '').toLowerCase());

        if (isLooseProduce && !isWeightOrVolume && !isNaN(numeric)) {
          // Treat loose produce numeric qty as kg (single add in cart)
          qty = 1;
        } else if (isCount && !isNaN(numeric)) {
          qty = Math.max(1, Math.min(Math.round(numeric), 5));
        } else if (!isWeightOrVolume && !isNaN(numeric)) {
          qty = Math.max(1, Math.min(Math.round(numeric), 5));
        } else {
          qty = 1;
        }
      }

      const result = await this.searchAndAddToCart(item.item, qty);
      results.push(result);
      await new Promise(r => setTimeout(r, 2000));
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`[Cart] Cart populated: ${successCount}/${shoppingList.length} items added`);

    return {
      total: shoppingList.length,
      added: successCount,
      failed: shoppingList.length - successCount,
      details: results
    };
  }

  async viewCart() {
    console.log('[Cart] Opening cart...');
    try {
      if (this.platform === 'bigbasket') await this.page.goto('https://www.bigbasket.com/basket/?ver=1');
      if (this.platform === 'blinkit') {
        await this.page.goto('https://blinkit.com', { waitUntil: 'networkidle2', timeout: 45000 });
        const selectors = [
          this.config?.selectors?.cartIcon,
          '[class*="CartIcon"]',
          '[aria-label*="Cart"]',
          'a[href*="/cart"]',
        ].filter(Boolean);

        let clicked = false;
        for (const sel of selectors) {
          try {
            const handle = await this.page.$(sel);
            if (handle) {
              await this.page.evaluate(el => el.click(), handle);
              clicked = true;
              break;
            }
          } catch (e) {}
        }

        if (!clicked) {
          // Text-based fallback for SPA headers
          try {
            clicked = await this.page.evaluate(() => {
              const candidates = Array.from(document.querySelectorAll('button,a,div,span'));
              const target = candidates.find(el => /cart/i.test(el.innerText || ''));
              if (target) {
                target.click();
                return true;
              }
              return false;
            });
          } catch (e) {}
        }

        if (!clicked) {
          console.warn('[Cart] Blinkit cart icon not found. Please open the cart manually.');
        }
      }
      if (this.platform === 'zepto') {
        await this.page.goto('https://www.zeptonow.com', { waitUntil: 'networkidle2', timeout: 45000 });
        const selectors = [
          this.config?.selectors?.cartIcon,
          '[data-testid="cart-icon"]',
          '[aria-label*="Cart"]',
          'a[href*="cart"]',
          'button',
          'a'
        ].filter(Boolean);

        let clicked = false;
        for (const sel of selectors) {
          try {
            const handle = await this.page.$(sel);
            if (handle) {
              await this.page.evaluate(el => el.click(), handle);
              clicked = true;
              break;
            }
          } catch (e) {}
        }

        if (!clicked) {
          try {
            clicked = await this.page.evaluate(() => {
              const candidates = Array.from(document.querySelectorAll('button,a,div,span'));
              const target = candidates.find(el => /cart/i.test(el.innerText || el.getAttribute('aria-label') || ''));
              if (target) {
                target.click();
                return true;
              }
              return false;
            });
          } catch (e) {}
        }

        if (!clicked) {
          console.warn('[Cart] Zepto cart icon not found. Please open the cart manually.');
        }
      }
      if (this.platform === 'instamart') await this.page.goto('https://www.swiggy.com/checkout');

      console.log('[Cart] Cart opened - Ready for review');
      return { success: true };
    } catch (error) {
      console.error('[Cart] Error opening cart:', error.message);
      return { success: false, error: error.message };
    }
  }

  async proceedToCheckout() {
    console.log('[Cart] Proceeding to checkout...');
    try {
      await this.viewCart();
      console.log('[Cart] ✅ Navigated to checkout page');
      console.log('[Cart] 🛑 PAUSED - Complete order manually');
      return { 
        success: true, 
        message: 'Please complete payment and address details manually',
        browserOpen: true
      };
    } catch (error) {
      console.error('[Cart] Checkout error:', error.message);
      return { success: false, error: error.message };
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log('[Cart] Browser closed');
    }
  }

  async keepBrowserOpen() {
    console.log('[Cart] Browser will remain open for manual checkout');
  }
}

export const addItemsToCart = async (platform, shoppingList, credentials = null) => {
  const cart = new CartAutomation(platform, credentials);
  try {
    await cart.initialize();
    const result = await cart.addMultipleItems(shoppingList);
    if (result.added > 0) {
      await cart.viewCart();
      console.log('\n[Cart] ✅ Items added to cart successfully!');
    } else {
      console.log('\n[Cart] ❌ No items were added to cart');
      await cart.close();
    }
    return result;
  } catch (error) {
    console.error('[Cart] Fatal error:', error);
    await cart.close();
    throw error;
  }
};

export const checkoutCart = async (platform, shoppingList, credentials = null) => {
  const cart = new CartAutomation(platform, credentials);
  try {
    await cart.initialize();
    const addResult = await cart.addMultipleItems(shoppingList);
    if (addResult.added === 0) {
      console.log('[Cart] No items added - Cannot checkout');
      await cart.close();
      return { success: false, reason: 'No items added' };
    }
    const checkoutResult = await cart.proceedToCheckout();
    return { itemsAdded: addResult.added, itemsFailed: addResult.failed, checkout: checkoutResult };
  } catch (error) {
    console.error('[Cart] Fatal error:', error);
    await cart.close();
    throw error;
  }
};

export const stopActiveAutomation = async () => {
    if (activeBrowser) {
        console.log('[Cart] 🛑 Force stopping automation...');
        await activeBrowser.close();
        activeBrowser = null;
        return true;
    }
    return false;
};








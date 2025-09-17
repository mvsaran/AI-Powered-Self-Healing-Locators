import { Page, Locator } from 'playwright';
import fs from 'fs';
import path from 'path';

interface LocatorMap {
  [key: string]: string[];
}

export class LocatorHelper {
  private locators: LocatorMap;
  private locatorsFilePath: string;

  constructor() {
    this.locatorsFilePath = path.join(process.cwd(), 'locators', 'amazon-locators.json');
    this.locators = JSON.parse(fs.readFileSync(this.locatorsFilePath, 'utf8'));
  }

  private async tryBasicHeuristics(page: Page, elementType: string): Promise<string | null> {
    const heuristics: { [key: string]: string[] } = {
      'searchBar': [
        'input[type="search"]',
        'input[role="searchbox"]',
        'input[placeholder*="search" i]',
        '//input[contains(@placeholder, "search") or contains(@aria-label, "search")]'
      ],
      'searchButton': [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:has-text("Search")',
        '//button[contains(., "Search")]'
      ],
      'productTitle': [
        '[data-component-type="s-search-result"] h2',
        '.s-result-item h2',
        '.s-search-results h2',
        '//div[contains(@class, "s-result-item")]//h2'
      ],
      'price': [
        '.a-price',
        '[data-a-color="price"]',
        '.s-price',
        '//span[contains(@class, "a-price")]'
      ]
    };

    const selectors = heuristics[elementType] || [];
    for (const selector of selectors) {
      try {
        const count = await page.locator(selector).count();
        if (count > 0) {
          // Add discovered selector to locators file
          this.locators[elementType].unshift(selector);
          fs.writeFileSync(this.locatorsFilePath, JSON.stringify(this.locators, null, 2));
          console.log(`Discovered new selector for ${elementType}: ${selector}`);
          return selector;
        }
      } catch (e) {
        continue;
      }
    }
    return null;
  }

  async findElement(page: Page, key: string, description: string): Promise<Locator> {
    const selectors = this.locators[key];
    if (!selectors) {
      throw new Error(`No locators found for element "${key}"`);
    }

    console.log(`Looking for ${description} using ${selectors.length} selectors...`);

    // Wait for any load states and dynamic content
    await Promise.all([
      page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {}),
      page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {}),
      page.waitForTimeout(2000)
    ]);

    // Try each selector in order with auto-retry
    for (const selector of selectors) {
      try {
        console.log(`Trying selector: ${selector}`);
        
        // First check if the element exists at all
        const count = await page.locator(selector).count();
        if (count === 0) {
          console.log(`No elements found for selector: ${selector}`);
          continue;
        }
        console.log(`Found ${count} elements for selector: ${selector}`);

        // Create locator and check visibility
        const locator = page.locator(selector).first();
        
        // Wait for element to be visible
        const isVisible = await locator.isVisible()
          .catch(e => {
            console.log(`Visibility check failed for ${selector}:`, e.message);
            return false;
          });

        if (isVisible) {
          // Check if it's an input element
          const tagName = await locator.evaluate(el => el.tagName.toLowerCase())
            .catch(() => '');
          
          // For input elements, we don't need to check text content
          if (tagName === 'input') {
            console.log(`Successfully found input element ${description}`);
            return locator;
          }
          
          // For other elements, verify they have content
          const content = await locator.textContent()
            .catch(() => null);
          
          console.log(`Found visible element with content: "${content}"`);
          
          if (content && content.trim()) {
            console.log(`Successfully found ${description} using selector: ${selector}`);
            return locator;
          } else {
            console.log(`Element found but has no text content`);
          }
        }
      } catch (e: any) {
        console.log(`Error trying selector ${selector}:`, e.message);
        continue;
      }
    }

    // If no selector worked, try auto-discovery
    console.log(`Trying heuristics for ${description}...`);
    const discoveredSelector = await this.tryBasicHeuristics(page, key);
    if (discoveredSelector) {
      console.log(`Found potential selector through heuristics: ${discoveredSelector}`);
      const locator = page.locator(discoveredSelector);
      await locator.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
      return locator;
    }

    // Take a screenshot and log page content for debugging
    console.log('Taking error screenshot and capturing debug info...');
    await page.screenshot({ path: `error-${key}-${Date.now()}.png` }).catch(() => {});
    
    // Log the current page URL for debugging
    console.log('Current page URL:', page.url());
    
    throw new Error(`Unable to find element "${description}" with any known selector. Check the error screenshot.`);
  }
}
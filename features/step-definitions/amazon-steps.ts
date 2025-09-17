import { Given, When, Then } from '@cucumber/cucumber';
import { CustomWorld } from '../support/world';
import { LocatorHelper } from '../support/locatorHelper';
import { expect } from '@playwright/test';

const locatorHelper = new LocatorHelper();

Given('I am on Amazon.com homepage', async function(this: CustomWorld) {
  await this.openBrowser();
  try {
    await this.page!.goto('https://www.amazon.com/', { timeout: 30000 });
    await this.page!.waitForLoadState('networkidle', { timeout: 30000 });
    const title = await this.page!.title();
    expect(title).toContain('Amazon.com');
  } catch (error) {
    console.error('Failed to load Amazon.com:', error);
    throw error;
  }
});

When('I search for {string}', async function(this: CustomWorld, searchTerm: string) {
  try {
    // Maximum retries for the search
    const maxRetries = 3;
    let attempt = 0;
    
    while (attempt < maxRetries) {
      attempt++;
      console.log(`Search attempt ${attempt} of ${maxRetries}`);
      
      try {
        // Wait for search bar and fill it
        const searchBar = await locatorHelper.findElement(this.page!, 'searchBar', 'Search input field');
        await searchBar.waitFor({ state: 'visible', timeout: 5000 });
        await searchBar.fill(searchTerm);
        
        // Use submit button
        const submitButton = await locatorHelper.findElement(this.page!, 'searchButton', 'Search button');
        await submitButton.waitFor({ state: 'visible', timeout: 5000 });
        await submitButton.click();
        
        console.log('Waiting for navigation...');
        await this.page!.waitForNavigation({ waitUntil: 'networkidle', timeout: 20000 })
          .catch(() => console.log('Navigation timeout, but continuing...'));
        
        // Additional load state waits
        await Promise.all([
          this.page!.waitForLoadState('domcontentloaded', { timeout: 10000 }),
          this.page!.waitForLoadState('networkidle', { timeout: 10000 })
        ]).catch(() => console.log('Load state wait timed out, but continuing...'));
        
        // Check URL to confirm search happened
        const currentUrl = this.page!.url();
        if (!currentUrl.includes('s?k=')) {
          console.log('Search URL not detected, retrying...');
          continue;
        }
        
        // Wait for any of these result indicators
        const resultIndicators = [
          '.s-result-list',
          '.s-search-results',
          '[data-component-type="s-search-results"]',
          '.s-main-slot',
          '.s-result-item'
        ];
        
        await Promise.any([
          ...resultIndicators.map(selector => 
            this.page!.waitForSelector(selector, { timeout: 10000 })
          ),
          this.page!.waitForSelector('.s-no-result-result', { timeout: 10000 })
        ]);
        
        // If we got here, break the retry loop
        break;
      } catch (searchError: any) {
        console.log(`Search attempt ${attempt} failed:`, searchError.message);
        if (attempt === maxRetries) {
          throw searchError;
        }
        // Brief pause before retry
        await this.page!.waitForTimeout(1000);
      }
    }
    
    // Final verification
    const url = this.page!.url();
    console.log('Current URL after search:', url);
    
    if (!url.includes('/s?k=') && !url.includes('search')) {
      throw new Error('Failed to reach search results page');
    }
  } catch (error) {
    console.error('Error during search:', error);
    throw error;
  }
});

Then('I should see product results for {string}', async function(this: CustomWorld, expectedTerm: string) {
  try {
    // Wait for search results to be present
    console.log('Waiting for search results container...');
    await this.page!.waitForSelector('.s-result-list, .s-search-results', {
      state: 'visible',
      timeout: 20000
    });

    // Check for no results first
    const noResultsText = await this.page!.$eval('.s-no-results-result', 
      el => el.textContent?.trim() ?? null
    ).catch(() => null);

    if (noResultsText) {
      throw new Error(`Amazon returned no results: ${noResultsText}`);
    }

    console.log('Looking for product title containing:', expectedTerm);

    // Try multiple ways to find product titles
    const titleSelectors = [
      '.s-search-results h2 .a-text-normal',
      '.s-result-item h2 .a-link-normal',
      '.s-card-container h2 a',
      '[data-cel-widget*="search_result_"] h2 span'
    ];

    let foundTitle = null;
    let allTitles: string[] = [];

    for (const selector of titleSelectors) {
      try {
        allTitles = await this.page!.$$eval(selector, 
          elements => elements.map(el => el.textContent?.trim()).filter(Boolean)
        );

        console.log(`Found ${allTitles.length} titles with selector: ${selector}`);
        
        if (allTitles.length > 0) {
          // Look for a title containing our search term
          foundTitle = allTitles.find(title => 
            title.toLowerCase().includes(expectedTerm.toLowerCase())
          );
          
          if (foundTitle) {
            console.log('Found matching title:', foundTitle);
            break;
          }
        }
      } catch (e) {
        continue;
      }
    }

    if (!foundTitle) {
      console.log('All found titles:', allTitles);
      throw new Error(`Could not find any product title containing "${expectedTerm}". Available titles: ${allTitles.slice(0, 3).join(', ')}...`);
    }

    expect(foundTitle.toLowerCase()).toContain(expectedTerm.toLowerCase());
  } catch (error) {
    console.error('Error verifying search results:', error);
    await this.page!.screenshot({ path: `search-results-error-${Date.now()}.png` });
    throw error;
  }
});

Then('the price should be displayed correctly', async function(this: CustomWorld) {
  try {
    const priceElement = await locatorHelper.findElement(this.page!, 'firstProductPrice', 'First product price');
    await priceElement.waitFor({ state: 'visible', timeout: 10000 });
    
    const priceText = await priceElement.textContent();
    if (!priceText) {
      throw new Error('Price element is empty');
    }
    
    // Verify the price format (should start with $ for Amazon.com)
    const trimmedPrice = priceText.trim();
    if (!trimmedPrice.startsWith('$')) {
      throw new Error(`Invalid price format: ${trimmedPrice}. Expected price to start with $`);
    }

    // Normalize price (remove currency symbol and commas)
    const numericPrice = trimmedPrice.replace(/[^0-9.]/g, '');
    const priceValue = parseFloat(numericPrice);

    // Verify it's a valid number greater than 0
    if (isNaN(priceValue) || priceValue <= 0) {
      throw new Error(`Invalid price value: ${trimmedPrice}`);
    }

    console.log(`Verified price: ${trimmedPrice} (numeric value: ${priceValue})`);
  } catch (error) {
    console.error('Error verifying product price:', error);
    throw error;
  }
});
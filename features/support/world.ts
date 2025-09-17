import { setWorldConstructor, setDefaultTimeout } from "@cucumber/cucumber";
import { chromium, Page, Browser } from "playwright";

// Set timeout for steps to 30 seconds
setDefaultTimeout(30 * 1000);

export class CustomWorld {
  browser: Browser | undefined;
  page: Page | undefined;

  async openBrowser() {
    this.browser = await chromium.launch({ headless: false });
    this.page = await this.browser.newPage();
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = undefined;
      this.page = undefined;
    }
  }
}

setWorldConstructor(CustomWorld);
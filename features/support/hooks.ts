import { After, Before } from '@cucumber/cucumber';
import { CustomWorld } from './world';

Before(async function(this: CustomWorld) {
  // This will be executed before each scenario
  console.log('Starting scenario...');
});

After(async function(this: CustomWorld) {
  // This will be executed after each scenario
  await this.closeBrowser();
  console.log('Finished scenario.');
});
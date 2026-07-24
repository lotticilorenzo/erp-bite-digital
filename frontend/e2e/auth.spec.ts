import { test, expect } from '@playwright/test';
import { setupPageWatchers, performLogin } from './helpers';

test.describe('Authentication & Navigation', () => {
  test('Successful Login', async ({ page }) => {
    const watchers = setupPageWatchers(page);
    await performLogin(page);
    watchers.verifyNoErrors();
  });

  test('Navigation through all sidebar routes', async ({ page }) => {
    test.setTimeout(120000);
    const watchers = setupPageWatchers(page);
    await performLogin(page);

    const routes = [
      '/',
      '/analytics',
      '/report',
      '/pricing-floor',
      '/proiezione-cassa',
      '/pl-gestionale',
      '/scadenzario-fiscale',
      '/costi-variabili',
      '/impostazioni-finanza',
      '/clienti',
      '/progetti',
      '/commesse',
      '/preventivi',
      '/crm',
      '/timesheet',
      '/planning',
      '/contenuti',
      '/task-templates',
      '/collaboratori',
      '/fatture',
      '/fornitori',
      '/cassa',
      '/tesoreria',
      '/cassa/regole',
      '/budget',
      '/budget-forecast',
      '/wiki',
      '/studio-os',
      '/settings/profile',
    ];

    for (const route of routes) {
      await page.goto(route);
      // Wait for page transition and content loading
      await page.waitForTimeout(500); 
      // Verify no console/network errors after navigating
      watchers.verifyNoErrors();
    }
  });
});

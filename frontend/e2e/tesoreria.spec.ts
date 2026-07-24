import { test, expect } from '@playwright/test';
import { setupPageWatchers, performLogin } from './helpers';

test.describe('Tesoreria Management', () => {
  test('Create Scadenza and Ricorrenza', async ({ page }) => {
    test.setTimeout(90000);
    const watchers = setupPageWatchers(page);
    await performLogin(page);

    // 1. Navigate to Tesoreria
    await page.goto('/tesoreria');
    await expect(page.locator('h1:has-text("Tesoreria")')).toBeVisible();

    // 2. Create Scadenza
    await page.click('button:has-text("Nuova scadenza")');
    await expect(page.locator('h2:has-text("Nuova scadenza")')).toBeVisible();

    // Select Type
    await page.locator('label:has-text("Tipo *") + button[role="combobox"]').click();
    await page.click('[role="option"]:has-text("Attiva (incasso)")');

    // Fill Date
    const today = new Date().toISOString().split('T')[0];
    await page.fill('label:has-text("Data attesa *") + input', today);

    // Fill Amount
    await page.fill('label:has-text("Importo € *") + input', '1250.50');

    // Document reference
    const docRef = `E2E-FT-${Date.now()}`;
    await page.fill('label:has-text("Rif. documento") + input', docRef);

    // Save
    await page.click('button:has-text("Salva")');
    await expect(page.locator('h2:has-text("Nuova scadenza")')).not.toBeVisible({ timeout: 15000 });

    // Verify created scadenza exists in the table
    await expect(page.locator(`tr:has-text("${docRef}")`)).toBeVisible({ timeout: 15000 });

    // 3. Create Ricorrenza
    // Click Ricorrenze Tab
    await page.click('button[role="tab"]:has-text("Ricorrenze")');

    // Open "Nuova ricorrenza" dialog
    await page.click('button:has-text("Nuova ricorrenza")');
    await expect(page.locator('h2:has-text("Nuova ricorrenza")')).toBeVisible();

    // Fill Description
    const recurrenceDesc = `E2E Recurrence ${Date.now()}`;
    await page.fill('label:has-text("Descrizione *") + input', recurrenceDesc);

    // Select Type
    await page.locator('label:has-text("Tipo scadenza *") + button[role="combobox"]').click();
    await page.click('[role="option"]:has-text("Passiva (pagamento)")');

    // Fill Amount
    await page.fill('label:has-text("Importo € *") + input', '85.00');

    // Select Periodicity
    await page.locator('label:has-text("Periodicità *") + button[role="combobox"]').click();
    await page.click('[role="option"]:has-text("Mensile")');

    // Fill Start Date
    await page.fill('label:has-text("Data inizio *") + input', today);

    // Save Ricorrenza
    await page.click('button:has-text("Salva")');
    await expect(page.locator('h2:has-text("Nuova ricorrenza")')).not.toBeVisible({ timeout: 15000 });

    // Verify it is listed in the table
    await expect(page.locator(`tr:has-text("${recurrenceDesc}")`)).toBeVisible({ timeout: 15000 });

    watchers.verifyNoErrors();
  });
});

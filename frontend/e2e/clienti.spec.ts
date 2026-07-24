import { test, expect } from '@playwright/test';
import { setupPageWatchers, performLogin } from './helpers';

test.describe('Clienti Management', () => {
  test('Create, View details, and Edit a client', async ({ page }) => {
    test.setTimeout(90000);
    const watchers = setupPageWatchers(page);
    await performLogin(page);

    // 1. Go to Clienti page
    await page.goto('/clienti');
    await expect(page.locator('h1:has-text("Clienti")')).toBeVisible({ timeout: 15000 });

    // 2. Open "Nuovo Cliente" dialog
    await page.click('button:has-text("Nuovo Cliente")');
    await expect(page.locator('h2:has-text("Nuovo cliente")')).toBeVisible();

    // 3. Fill "Ragione Sociale" and submit
    const clientName = `Test Client E2E ${Date.now()}`;
    await page.fill('[placeholder="Nome Azienda S.r.l."]', clientName);
    
    // Fill "Sigla Cliente" (codice_cliente)
    const clientCode = `TST${Math.floor(Math.random() * 1000)}`;
    await page.fill('[placeholder="BEC"]', clientCode);

    // Submit
    await page.click('button[type="submit"]:has-text("Crea Cliente")');
    
    // Verify toast or that the dialog closed
    await expect(page.locator('h2:has-text("Nuovo cliente")')).not.toBeVisible();
    
    // Verify it appears in the table
    const tableRow = page.locator(`tr:has-text("${clientName}")`);
    await expect(tableRow).toBeVisible();

    // 4. Open Detail Page by clicking actions -> Vedi Dettagli
    await tableRow.first().locator('button').click();
    await page.click('text=Vedi Dettagli');
    await expect(page).toHaveURL(/.*clienti\/.*/);
    await expect(page.locator('h1').first()).toContainText(clientName);

    // 5. Go back to Clienti and edit the client
    await page.goto('/clienti');
    const newTableRow = page.locator(`tr:has-text("${clientName}")`);
    
    // Click dropdown actions button
    await newTableRow.first().locator('button').click();
    // Click "Modifica"
    await page.click('text=Modifica');
    await expect(page.locator('h2:has-text("Modifica cliente")')).toBeVisible();

    // Update name
    const updatedClientName = `${clientName} UPDATED`;
    await page.fill('[placeholder="Nome Azienda S.r.l."]', updatedClientName);
    await page.click('button[type="submit"]:has-text("Salva Modifiche")');

    // Wait for dialog to disappear
    await expect(page.locator('h2:has-text("Modifica cliente")')).not.toBeVisible({ timeout: 15000 });

    // Verify it updated in the table
    await expect(page.locator(`tr:has-text("${updatedClientName}")`)).toBeVisible({ timeout: 15000 });

    watchers.verifyNoErrors();
  });
});

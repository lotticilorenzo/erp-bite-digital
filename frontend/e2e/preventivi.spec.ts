import { test, expect } from '@playwright/test';
import { setupPageWatchers, performLogin } from './helpers';

test.describe('Preventivi Management', () => {
  test('Create a preventivo with different nature rows and verify calculations', async ({ page }) => {
    test.setTimeout(90000);
    const watchers = setupPageWatchers(page);
    await performLogin(page);

    // 1. Navigate to Preventivi
    await page.goto('/preventivi');
    await expect(page.locator('h1:has-text("Preventivi")')).toBeVisible({ timeout: 15000 });

    // 2. Open "Nuova Offerta" modal
    await page.click('button:has-text("Nuova Offerta")');
    await expect(page.locator('h2:has-text("Nuova Proposta Commerciale")')).toBeVisible();

    // 3. Select Cliente
    await page.waitForTimeout(2000);
    await page.click('button:has-text("Seleziona Partner...")');
    await page.locator('[role="option"]').first().click();

    // 4. Fill Oggetto/Titolo
    const preventivoTitle = `E2E Preventivo ${Date.now()}`;
    await page.fill('[placeholder="Es. Sviluppo E-commerce 2024 - Fase 1"]', preventivoTitle);

    // Set Method to Cost-up (markup sui costi)
    await page.click('button:has-text("Prezzo a corpo (righe)")');
    await page.click('[role="option"]:has-text("Cost-up")');
    
    // Fill markup %
    await page.fill('label:has-text("Markup %") + input', '20');

    // 5. Setup different nature rows
    // Row 1: Servizio a corpo (already present by default, but let's check or fill it)
    await page.fill('[placeholder="Descrizione della prestazione..."]', 'Servizio Corpo Test');
    
    // Row 2: Lavoro Interno
    await page.click('button:has-text("Aggiungi Riga")');
    await page.waitForTimeout(500);
    // Change second row type to Lavoro Interno
    // The second row select trigger will be the second button in the list of nature selects
    await page.locator('button:has-text("Servizio a corpo")').last().click();
    await page.click('[role="option"]:has-text("Lavoro interno")');
    await page.locator('[placeholder="Descrizione della prestazione..."]').nth(1).fill('Lavoro Interno Test');
    await page.locator('label:has-text("Ore") + input').nth(0).fill('10');
    await page.locator('label:has-text("Tariffa oraria") + input').nth(0).fill('50');

    // Row 3: Socio
    await page.click('button:has-text("Aggiungi Riga")');
    await page.waitForTimeout(500);
    await page.locator('button:has-text("Servizio a corpo")').last().click();
    await page.click('[role="option"]:has-text("Socio")');
    await page.locator('[placeholder="Descrizione della prestazione..."]').nth(2).fill('Socio Test');
    await page.locator('label:has-text("Ore stimate") + input').nth(0).fill('5');
    await page.locator('label:has-text("Tariffa figurativa") + input').nth(0).fill('80');

    // Row 4: Fornitore Esterno
    await page.click('button:has-text("Aggiungi Riga")');
    await page.waitForTimeout(500);
    await page.locator('button:has-text("Servizio a corpo")').last().click();
    await page.click('[role="option"]:has-text("Fornitore esterno")');
    await page.locator('[placeholder="Descrizione della prestazione..."]').nth(3).fill('Esterno Test');
    await page.locator('label:has-text("Costo vivo") + input').nth(0).fill('200');
    await page.locator('label:has-text("Ricarico %") + input').nth(0).fill('10');

    // Row 5: Overhead
    await page.click('button:has-text("Aggiungi Riga")');
    await page.waitForTimeout(500);
    await page.locator('button:has-text("Servizio a corpo")').last().click();
    await page.click('[role="option"]:has-text("Overhead")');
    await page.locator('[placeholder="Descrizione della prestazione..."]').nth(4).fill('Overhead Test');

    // Verify Economy section shows without error and totals are calculated
    await expect(page.locator('text=Economia')).toBeVisible();
    await expect(page.locator('text=Costo pieno')).toBeVisible();
    await expect(page.locator('text=Budget interno lavoro')).toBeVisible();

    // 6. Submit the preventivo
    // 6. Submit the preventivo
    await page.click('button[type="submit"]:has-text("Genera Proposta")');

    // Verify modal closes
    await expect(page.locator('h2:has-text("Nuova Proposta Commerciale")')).not.toBeVisible();

    // Verify new preventivo is in table
    await expect(page.locator(`tr:has-text("${preventivoTitle}")`)).toBeVisible();

    watchers.verifyNoErrors();
  });
});

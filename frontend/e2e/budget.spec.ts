import { test, expect } from '@playwright/test';
import { setupPageWatchers, performLogin } from './helpers';

test.describe('Budget & Forecast', () => {
  test('Create budget version, edit rows, and approve', async ({ page }) => {
    test.setTimeout(90000);
    const watchers = setupPageWatchers(page);
    
    // Automatically accept the confirmation dialogs
    page.on('dialog', dialog => dialog.accept());

    await performLogin(page);

    // 1. Navigate to Budget & Forecast
    await page.goto('/budget-forecast');
    await expect(page.locator('h1:has-text("Budget & Forecast")')).toBeVisible({ timeout: 15000 });

    // 2. Create a new version
    await page.click('button:has-text("Nuova versione")');
    await expect(page.locator('h2:has-text("Nuova versione budget")')).toBeVisible();

    const budgetYear = String(new Date().getFullYear()); // current year to match default filter
    await page.fill('label:has-text("Anno *") + input', budgetYear);

    // Choose type "budget"
    await page.click('button[role="combobox"]');
    await page.click('[role="option"]:has-text("Budget")');

    // Fill note
    const budgetNotes = `E2E Budget Notes ${Date.now()}`;
    await page.fill('label:has-text("Note") + input', budgetNotes);

    // Submit dialog
    await page.click('button:has-text("Crea")');

    // Wait for dialog to disappear
    await expect(page.locator('h2:has-text("Nuova versione budget")')).not.toBeVisible({ timeout: 15000 });

    // 3. Locate the created version in the table and click "Apri righe"
    // The version is on the row with budgetYear and budgetNotes
    const row = page.locator(`tr:has-text("${budgetNotes}")`);
    await expect(row).toBeVisible({ timeout: 15000 });
    await row.locator('button:has-text("Apri righe")').click();

    // 4. Edit rows
    // Check that Righe table is visible
    await expect(page.locator('h3:has-text("Righe —")')).toBeVisible();
    
    // Select the first input under Gen (January) for Ricavo (Row 1)
    const ricavoJanInput = page.locator('tr:has-text("Ricavo") >> input').first();
    await expect(ricavoJanInput).toBeVisible();
    await ricavoJanInput.fill('15000');
    await ricavoJanInput.blur(); // Triggers onChangeCella saving

    // 5. Approve the version
    // Click the checkmark icon in the row action buttons
    await row.locator('button[title="Approva"]').click();

    // Verify it is approved (state badge changes to 'approvato')
    await expect(row.locator('text=approvato')).toBeVisible({ timeout: 10000 });

    watchers.verifyNoErrors();
  });
});

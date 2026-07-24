import { test, expect, Page } from '@playwright/test';

export function setupPageWatchers(page: Page) {
  const consoleErrors: string[] = [];
  const networkErrors: string[] = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (text.includes('401') || text.includes('Unauthorized')) {
        return;
      }
      consoleErrors.push(`[Console Error] ${text}`);
    }
  });

  page.on('response', async response => {
    const status = response.status();
    const url = response.url();
    if (url.includes('/api/') && status >= 400) {
      // Exclude expected 401 when verifying login or checking current session
      if (url.endsWith('/api/v1/auth/me') && status === 401) {
        return;
      }
      if (url.endsWith('/api/v1/auth/login') && status === 401) {
        return;
      }
      let bodyText = '';
      try {
        bodyText = await response.text();
      } catch (err) {}
      networkErrors.push(`[Network Error] ${response.request().method()} ${url} -> Status ${status} | Body: ${bodyText}`);
    }
  });

  return {
    verifyNoErrors() {
      expect(consoleErrors).toEqual([]);
      expect(networkErrors).toEqual([]);
    },
    consoleErrors,
    networkErrors,
  };
}

export async function performLogin(page: Page) {
  await page.goto('/login');
  
  // Accept certificate or check if we are on login page
  await expect(page).toHaveURL(/.*login/);
  
  // Fill credentials
  await page.fill('input[autoComplete="username"], input[placeholder*="Email"]', 'lorenzo@biteagency.com');
  await page.fill('input[type="password"]', '#biuXh*R%gy*yxQjaI^&');
  
  // Click login
  await page.click('button[type="submit"], button:has-text("Accedi")');
  
  // Wait for redirect to dashboard
  await page.waitForURL('https://localhost/');
  await expect(page.locator('h1:has-text("Dashboard")').first()).toBeVisible({ timeout: 15000 });
}

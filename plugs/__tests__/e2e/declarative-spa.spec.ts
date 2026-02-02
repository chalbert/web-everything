/**
 * E2E Tests for Declarative SPA Demo
 * 
 * Tests the complete single-page application demonstrating:
 * - webstates (state management)
 * - webbehaviors (custom attributes for binding and events)
 * - webinjectors (dependency injection)
 * - webcontexts (context propagation)
 */

import { test, expect } from '@playwright/test';

test.describe('Declarative SPA Demo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173/demos/declarative-spa.html');
    await page.waitForFunction(() => window.demoReady === true, { timeout: 10000 });
  });

  test.describe('Navigation', () => {
    test('should start on counter view', async ({ page }) => {
      const counterView = page.locator('.view[data-view="counter"]');
      const todosView = page.locator('.view[data-view="todos"]');
      const formView = page.locator('.view[data-view="form"]');
      
      await expect(counterView).toHaveAttribute('data-active', 'true');
      await expect(todosView).toHaveAttribute('data-active', 'false');
      await expect(formView).toHaveAttribute('data-active', 'false');
      
      await expect(counterView).toBeVisible();
      await expect(todosView).not.toBeVisible();
      await expect(formView).not.toBeVisible();
    });

    test('should navigate to todos view', async ({ page }) => {
      const todosButton = page.locator('nav button[data-view="todos"]');
      const todosView = page.locator('.view[data-view="todos"]');
      const counterView = page.locator('.view[data-view="counter"]');
      
      await todosButton.click();
      
      await expect(todosButton).toHaveAttribute('data-active', 'true');
      await expect(todosView).toHaveAttribute('data-active', 'true');
      await expect(counterView).toHaveAttribute('data-active', 'false');
      
      await expect(todosView).toBeVisible();
      await expect(counterView).not.toBeVisible();
    });

    test('should navigate to form view', async ({ page }) => {
      const formButton = page.locator('nav button[data-view="form"]');
      const formView = page.locator('.view[data-view="form"]');
      
      await formButton.click();
      
      await expect(formButton).toHaveAttribute('data-active', 'true');
      await expect(formView).toHaveAttribute('data-active', 'true');
      await expect(formView).toBeVisible();
    });

    test('should maintain active state on navigation', async ({ page }) => {
      const todosButton = page.locator('nav button[data-view="todos"]');
      const counterButton = page.locator('nav button[data-view="counter"]');
      
      await todosButton.click();
      await expect(counterButton).toHaveAttribute('data-active', 'false');
      await expect(todosButton).toHaveAttribute('data-active', 'true');
      
      await counterButton.click();
      await expect(counterButton).toHaveAttribute('data-active', 'true');
      await expect(todosButton).toHaveAttribute('data-active', 'false');
    });
  });

  test.describe('Counter View', () => {
    test('should start at zero', async ({ page }) => {
      const counterValue = page.locator('.counter-value');
      await expect(counterValue).toHaveText('0');
    });

    test('should increment counter', async ({ page }) => {
      const incrementBtn = page.locator('button:has-text("Increment")');
      const counterValue = page.locator('.counter-value');
      
      await incrementBtn.click();
      await expect(counterValue).toHaveText('1');
      
      await incrementBtn.click();
      await expect(counterValue).toHaveText('2');
    });

    test('should decrement counter', async ({ page }) => {
      const decrementBtn = page.locator('button:has-text("Decrement")');
      const counterValue = page.locator('.counter-value');
      
      await decrementBtn.click();
      await expect(counterValue).toHaveText('-1');
      
      await decrementBtn.click();
      await expect(counterValue).toHaveText('-2');
    });

    test('should reset counter', async ({ page }) => {
      const incrementBtn = page.locator('button:has-text("Increment")');
      const resetBtn = page.locator('button:has-text("Reset")');
      const counterValue = page.locator('.counter-value');
      
      await incrementBtn.click();
      await incrementBtn.click();
      await incrementBtn.click();
      await expect(counterValue).toHaveText('3');
      
      await resetBtn.click();
      await expect(counterValue).toHaveText('0');
    });

    test('should handle multiple operations', async ({ page }) => {
      const incrementBtn = page.locator('button:has-text("Increment")');
      const decrementBtn = page.locator('button:has-text("Decrement")');
      const counterValue = page.locator('.counter-value');
      
      await incrementBtn.click();
      await incrementBtn.click();
      await decrementBtn.click();
      await incrementBtn.click();
      
      await expect(counterValue).toHaveText('2');
    });

    test('should maintain counter state across navigation', async ({ page }) => {
      const incrementBtn = page.locator('button:has-text("Increment")');
      const counterValue = page.locator('.counter-value');
      const todosButton = page.locator('nav button[data-view="todos"]');
      const counterButton = page.locator('nav button[data-view="counter"]');
      
      // Increment and navigate away
      await incrementBtn.click();
      await incrementBtn.click();
      await todosButton.click();
      
      // Navigate back
      await counterButton.click();
      
      // Should still show 2
      await expect(counterValue).toHaveText('2');
    });
  });

  test.describe('Todo List View', () => {
    test.beforeEach(async ({ page }) => {
      const todosButton = page.locator('nav button[data-view="todos"]');
      await todosButton.click();
    });

    test('should start with empty list', async ({ page }) => {
      const todoItems = page.locator('.todo-item');
      await expect(todoItems).toHaveCount(0);
      
      const totalStat = page.locator('.stat-value').first();
      await expect(totalStat).toHaveText('0');
    });

    test('should add a todo', async ({ page }) => {
      const input = page.locator('.todo-form input[type="text"]');
      const addButton = page.locator('button[type="submit"]');
      
      await input.fill('Buy groceries');
      await addButton.click();
      
      const todoItems = page.locator('.todo-item');
      await expect(todoItems).toHaveCount(1);
      await expect(todoItems.first().locator('.todo-text')).toHaveText('Buy groceries');
    });

    test('should add multiple todos', async ({ page }) => {
      const input = page.locator('.todo-form input[type="text"]');
      const addButton = page.locator('button[type="submit"]');
      
      await input.fill('First todo');
      await addButton.click();
      
      await input.fill('Second todo');
      await addButton.click();
      
      await input.fill('Third todo');
      await addButton.click();
      
      const todoItems = page.locator('.todo-item');
      await expect(todoItems).toHaveCount(3);
    });

    test('should clear input after adding todo', async ({ page }) => {
      const input = page.locator('.todo-form input[type="text"]');
      const addButton = page.locator('button[type="submit"]');
      
      await input.fill('Test todo');
      await addButton.click();
      
      await expect(input).toHaveValue('');
    });

    test('should update stats when adding todos', async ({ page }) => {
      const input = page.locator('.todo-form input[type="text"]');
      const addButton = page.locator('button[type="submit"]');
      const stats = page.locator('.stat-value');
      
      await input.fill('First todo');
      await addButton.click();
      
      await expect(stats.nth(0)).toHaveText('1'); // Total
      await expect(stats.nth(1)).toHaveText('1'); // Active
      await expect(stats.nth(2)).toHaveText('0'); // Completed
    });

    test('should complete a todo', async ({ page }) => {
      const input = page.locator('.todo-form input[type="text"]');
      const addButton = page.locator('button[type="submit"]');
      
      await input.fill('Complete me');
      await addButton.click();
      
      const checkbox = page.locator('.todo-checkbox');
      const todoItem = page.locator('.todo-item');
      const stats = page.locator('.stat-value');
      
      await checkbox.click();
      
      await expect(todoItem).toHaveAttribute('data-completed', 'true');
      await expect(stats.nth(1)).toHaveText('0'); // Active
      await expect(stats.nth(2)).toHaveText('1'); // Completed
    });

    test('should uncomplete a todo', async ({ page }) => {
      const input = page.locator('.todo-form input[type="text"]');
      const addButton = page.locator('button[type="submit"]');
      
      await input.fill('Toggle me');
      await addButton.click();
      
      const checkbox = page.locator('.todo-checkbox');
      const todoItem = page.locator('.todo-item');
      
      await checkbox.click();
      await expect(todoItem).toHaveAttribute('data-completed', 'true');
      
      await checkbox.click();
      await expect(todoItem).toHaveAttribute('data-completed', 'false');
    });

    test('should delete a todo', async ({ page }) => {
      const input = page.locator('.todo-form input[type="text"]');
      const addButton = page.locator('button[type="submit"]');
      
      await input.fill('Delete me');
      await addButton.click();
      
      const deleteButton = page.locator('.todo-delete');
      await deleteButton.click();
      
      const todoItems = page.locator('.todo-item');
      await expect(todoItems).toHaveCount(0);
    });

    test('should update stats correctly with multiple operations', async ({ page }) => {
      const input = page.locator('.todo-form input[type="text"]');
      const addButton = page.locator('button[type="submit"]');
      const stats = page.locator('.stat-value');
      
      // Add 3 todos
      await input.fill('Todo 1');
      await addButton.click();
      await input.fill('Todo 2');
      await addButton.click();
      await input.fill('Todo 3');
      await addButton.click();
      
      // Complete 2 todos
      await page.locator('.todo-checkbox').nth(0).click();
      await page.locator('.todo-checkbox').nth(1).click();
      
      await expect(stats.nth(0)).toHaveText('3'); // Total
      await expect(stats.nth(1)).toHaveText('1'); // Active
      await expect(stats.nth(2)).toHaveText('2'); // Completed
      
      // Delete one completed todo
      await page.locator('.todo-delete').first().click();
      
      await expect(stats.nth(0)).toHaveText('2'); // Total
      await expect(stats.nth(2)).toHaveText('1'); // Completed
    });

    test('should maintain todo state across navigation', async ({ page }) => {
      const input = page.locator('.todo-form input[type="text"]');
      const addButton = page.locator('button[type="submit"]');
      const counterButton = page.locator('nav button[data-view="counter"]');
      const todosButton = page.locator('nav button[data-view="todos"]');
      
      // Add todos
      await input.fill('Persistent todo');
      await addButton.click();
      
      // Navigate away and back
      await counterButton.click();
      await todosButton.click();
      
      // Should still have the todo
      const todoItems = page.locator('.todo-item');
      await expect(todoItems).toHaveCount(1);
      await expect(todoItems.first().locator('.todo-text')).toHaveText('Persistent todo');
    });
  });

  test.describe('Form View', () => {
    test.beforeEach(async ({ page }) => {
      const formButton = page.locator('nav button[data-view="form"]');
      await formButton.click();
    });

    test('should start with empty form', async ({ page }) => {
      const nameInput = page.locator('#name');
      const emailInput = page.locator('#email');
      const roleSelect = page.locator('#role');
      
      await expect(nameInput).toHaveValue('');
      await expect(emailInput).toHaveValue('');
      await expect(roleSelect).toHaveValue('');
    });

    test('should update preview when name is entered', async ({ page }) => {
      const nameInput = page.locator('#name');
      const namePreview = page.locator('.preview-item').first().locator('.preview-value');
      
      await nameInput.fill('John Doe');
      
      await expect(namePreview).toHaveText('John Doe');
    });

    test('should update preview when email is entered', async ({ page }) => {
      const emailInput = page.locator('#email');
      const emailPreview = page.locator('.preview-item').nth(1).locator('.preview-value');
      
      await emailInput.fill('john@example.com');
      
      await expect(emailPreview).toHaveText('john@example.com');
    });

    test('should update preview when role is selected', async ({ page }) => {
      const roleSelect = page.locator('#role');
      const rolePreview = page.locator('.preview-item').nth(2).locator('.preview-value');
      
      await roleSelect.selectOption('developer');
      
      await expect(rolePreview).toHaveText('developer');
    });

    test('should update all fields and preview together', async ({ page }) => {
      const nameInput = page.locator('#name');
      const emailInput = page.locator('#email');
      const roleSelect = page.locator('#role');
      
      const namePreview = page.locator('.preview-item').first().locator('.preview-value');
      const emailPreview = page.locator('.preview-item').nth(1).locator('.preview-value');
      const rolePreview = page.locator('.preview-item').nth(2).locator('.preview-value');
      
      await nameInput.fill('Jane Smith');
      await emailInput.fill('jane@example.com');
      await roleSelect.selectOption('designer');
      
      await expect(namePreview).toHaveText('Jane Smith');
      await expect(emailPreview).toHaveText('jane@example.com');
      await expect(rolePreview).toHaveText('designer');
    });

    test('should update preview in real-time as user types', async ({ page }) => {
      const nameInput = page.locator('#name');
      const namePreview = page.locator('.preview-item').first().locator('.preview-value');
      
      await nameInput.type('A');
      await expect(namePreview).toHaveText('A');
      
      await nameInput.type('lice');
      await expect(namePreview).toHaveText('Alice');
    });

    test('should maintain form state across navigation', async ({ page }) => {
      const nameInput = page.locator('#name');
      const counterButton = page.locator('nav button[data-view="counter"]');
      const formButton = page.locator('nav button[data-view="form"]');
      
      // Fill form
      await nameInput.fill('Persistent User');
      
      // Navigate away and back
      await counterButton.click();
      await formButton.click();
      
      // Should still have the value
      await expect(nameInput).toHaveValue('Persistent User');
    });
  });

  test.describe('Cross-View State Integration', () => {
    test('should maintain all state when switching between views', async ({ page }) => {
      const counterButton = page.locator('nav button[data-view="counter"]');
      const todosButton = page.locator('nav button[data-view="todos"]');
      const formButton = page.locator('nav button[data-view="form"]');
      
      // Set counter
      const incrementBtn = page.locator('button:has-text("Increment")');
      await incrementBtn.click();
      await incrementBtn.click();
      
      // Add todo
      await todosButton.click();
      const todoInput = page.locator('.todo-form input[type="text"]');
      await todoInput.fill('Test todo');
      await page.locator('button[type="submit"]').click();
      
      // Fill form
      await formButton.click();
      await page.locator('#name').fill('Test User');
      
      // Verify all states
      await counterButton.click();
      await expect(page.locator('.counter-value')).toHaveText('2');
      
      await todosButton.click();
      await expect(page.locator('.todo-item')).toHaveCount(1);
      
      await formButton.click();
      await expect(page.locator('#name')).toHaveValue('Test User');
    });
  });
});

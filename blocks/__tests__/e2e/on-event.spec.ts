/**
 * E2E tests for on-event attribute block
 *
 * Tests the attribute in a real browser environment via Playwright.
 */

import { test, expect } from '@playwright/test';

test.describe('on-event attribute e2e', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demos/declarative-spa.html');

    // Wait for demo to be ready
    await page.waitForFunction(
      () => (window as any).demoReady === true,
      { timeout: 10000 }
    );
  });

  test.describe('counter demo', () => {
    test('increment button increases counter', async ({ page }) => {
      const counterValue = page.locator('.counter-value');
      const incrementBtn = page.locator('button:has-text("Increment")');

      // Initial value
      await expect(counterValue).toHaveText('0');

      // Click increment
      await incrementBtn.click();
      await expect(counterValue).toHaveText('1');

      // Click again
      await incrementBtn.click();
      await expect(counterValue).toHaveText('2');
    });

    test('decrement button decreases counter', async ({ page }) => {
      const counterValue = page.locator('.counter-value');
      const decrementBtn = page.locator('button:has-text("Decrement")');
      const incrementBtn = page.locator('button:has-text("Increment")');

      // Start by incrementing
      await incrementBtn.click();
      await incrementBtn.click();
      await expect(counterValue).toHaveText('2');

      // Decrement
      await decrementBtn.click();
      await expect(counterValue).toHaveText('1');
    });

    test('reset button sets counter to zero', async ({ page }) => {
      const counterValue = page.locator('.counter-value');
      const incrementBtn = page.locator('button:has-text("Increment")');
      const resetBtn = page.locator('button:has-text("Reset")');

      // Increment several times
      await incrementBtn.click();
      await incrementBtn.click();
      await incrementBtn.click();
      await expect(counterValue).toHaveText('3');

      // Reset
      await resetBtn.click();
      await expect(counterValue).toHaveText('0');
    });
  });

  test.describe('navigation', () => {
    test('navigate buttons switch views', async ({ page }) => {
      const counterView = page.locator('.view[data-view="counter"]');
      const todosView = page.locator('.view[data-view="todos"]');
      const formView = page.locator('.view[data-view="form"]');

      const counterBtn = page.locator('nav button:has-text("Counter")');
      const todosBtn = page.locator('nav button:has-text("Todo List")');
      const formBtn = page.locator('nav button:has-text("Form")');

      // Initially counter is visible
      await expect(counterView).toHaveAttribute('data-active', 'true');
      await expect(todosView).toHaveAttribute('data-active', 'false');

      // Navigate to todos
      await todosBtn.click();
      await expect(counterView).toHaveAttribute('data-active', 'false');
      await expect(todosView).toHaveAttribute('data-active', 'true');
      await expect(todosBtn).toHaveAttribute('data-active', 'true');

      // Navigate to form
      await formBtn.click();
      await expect(todosView).toHaveAttribute('data-active', 'false');
      await expect(formView).toHaveAttribute('data-active', 'true');
      await expect(formBtn).toHaveAttribute('data-active', 'true');

      // Navigate back to counter
      await counterBtn.click();
      await expect(formView).toHaveAttribute('data-active', 'false');
      await expect(counterView).toHaveAttribute('data-active', 'true');
    });
  });

  test.describe('todo list', () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to todos
      await page.locator('nav button:has-text("Todo List")').click();
    });

    test('add todo via form submit', async ({ page }) => {
      const input = page.locator('.todo-form input');
      const addBtn = page.locator('.todo-form button[type="submit"]');
      const todoList = page.locator('.todo-list');

      // Add a todo
      await input.fill('Buy groceries');
      await addBtn.click();

      // Verify todo appears
      await expect(todoList.locator('.todo-item')).toHaveCount(1);
      await expect(todoList.locator('.todo-text')).toHaveText('Buy groceries');

      // Input should be cleared
      await expect(input).toHaveValue('');
    });

    test('toggle todo completion', async ({ page }) => {
      const input = page.locator('.todo-form input');
      const addBtn = page.locator('.todo-form button[type="submit"]');
      const todoList = page.locator('.todo-list');

      // Add a todo
      await input.fill('Test todo');
      await addBtn.click();

      // Get the checkbox
      const checkbox = todoList.locator('.todo-checkbox').first();
      const todoItem = todoList.locator('.todo-item').first();

      // Initially unchecked
      await expect(checkbox).not.toBeChecked();
      await expect(todoItem).toHaveAttribute('data-completed', 'false');

      // Toggle
      await checkbox.click();
      await expect(checkbox).toBeChecked();
      await expect(todoItem).toHaveAttribute('data-completed', 'true');

      // Toggle back
      await checkbox.click();
      await expect(checkbox).not.toBeChecked();
      await expect(todoItem).toHaveAttribute('data-completed', 'false');
    });

    test('delete todo', async ({ page }) => {
      const input = page.locator('.todo-form input');
      const addBtn = page.locator('.todo-form button[type="submit"]');
      const todoList = page.locator('.todo-list');

      // Add two todos
      await input.fill('First todo');
      await addBtn.click();
      await input.fill('Second todo');
      await addBtn.click();

      await expect(todoList.locator('.todo-item')).toHaveCount(2);

      // Delete the first one
      await todoList.locator('.todo-delete').first().click();

      await expect(todoList.locator('.todo-item')).toHaveCount(1);
      await expect(todoList.locator('.todo-text')).toHaveText('Second todo');
    });

    test('todo stats update correctly', async ({ page }) => {
      const input = page.locator('.todo-form input');
      const addBtn = page.locator('.todo-form button[type="submit"]');
      const todoList = page.locator('.todo-list');

      const totalStat = page.locator('.stat:has(.stat-label:has-text("Total")) .stat-value');
      const activeStat = page.locator('.stat:has(.stat-label:has-text("Active")) .stat-value');
      const completedStat = page.locator('.stat:has(.stat-label:has-text("Completed")) .stat-value');

      // Initially all zeros
      await expect(totalStat).toHaveText('0');
      await expect(activeStat).toHaveText('0');
      await expect(completedStat).toHaveText('0');

      // Add todos
      await input.fill('Todo 1');
      await addBtn.click();
      await input.fill('Todo 2');
      await addBtn.click();
      await input.fill('Todo 3');
      await addBtn.click();

      await expect(totalStat).toHaveText('3');
      await expect(activeStat).toHaveText('3');
      await expect(completedStat).toHaveText('0');

      // Complete one
      await todoList.locator('.todo-checkbox').first().click();

      await expect(totalStat).toHaveText('3');
      await expect(activeStat).toHaveText('2');
      await expect(completedStat).toHaveText('1');

      // Delete one active
      await todoList.locator('.todo-item[data-completed="false"] .todo-delete').first().click();

      await expect(totalStat).toHaveText('2');
      await expect(activeStat).toHaveText('1');
      await expect(completedStat).toHaveText('1');
    });
  });

  test.describe('expression syntax', () => {
    test('$event is properly passed', async ({ page }) => {
      // The counter handlers use $event to call preventDefault
      // We can verify this works by checking the counter updates
      const incrementBtn = page.locator('button:has-text("Increment")');
      const counterValue = page.locator('.counter-value');

      await incrementBtn.click();
      await expect(counterValue).toHaveText('1');
    });

    test('@context values are resolved', async ({ page }) => {
      // Navigate to todos and add items
      await page.locator('nav button:has-text("Todo List")').click();

      const input = page.locator('.todo-form input');
      const addBtn = page.locator('.todo-form button[type="submit"]');

      await input.fill('Context test');
      await addBtn.click();

      // The delete button uses @item.id - clicking it should delete the correct item
      await page.locator('.todo-delete').click();
      await expect(page.locator('.todo-item')).toHaveCount(0);
    });

    test('literal values work in expressions', async ({ page }) => {
      // The reset button uses a literal 0 value via state
      const counterValue = page.locator('.counter-value');
      const incrementBtn = page.locator('button:has-text("Increment")');
      const resetBtn = page.locator('button:has-text("Reset")');

      await incrementBtn.click();
      await incrementBtn.click();
      await expect(counterValue).toHaveText('2');

      await resetBtn.click();
      await expect(counterValue).toHaveText('0');
    });
  });
});

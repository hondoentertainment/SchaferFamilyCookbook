# 🧪 Testing Guide - Schafer Family Cookbook

## Overview

This project uses **Vitest** with **React Testing Library** to ensure code quality and reliability. An intelligent test agent is included to make testing easier and more efficient.

## 🚀 Quick Start

### Run Tests Immediately

```bash
# Run all tests once
npm run test:run

# Run tests in watch mode (recommended for development)
npm run test

# Open interactive UI
npm run test:ui

# Generate coverage report
npm run test:coverage
```

### Use the Test Agent (Recommended)

The test agent provides an interactive CLI for managing tests:

```bash
# Interactive mode
node test-agent.js

# Direct command
node test-agent.js 1    # Run all tests
node test-agent.js 3    # Open UI mode
```

## 📁 Test Structure

```
e2e/                        # Playwright E2E tests
├── fixtures.ts             # Login helpers (loginAs, loginAsAdmin)
├── auth.spec.ts            # Login flow
├── navigation.spec.ts      # Tab navigation
├── recipes.spec.ts         # Recipe filters, search
├── recipe-modal.spec.ts    # Recipe modal, deep link, share, print
├── gallery.spec.ts         # Gallery, text-to-archive, lightbox
├── trivia.spec.ts          # Trivia quiz flow
├── profile.spec.ts         # Profile edit
└── admin.spec.ts           # Admin panel, Twilio config

src/
├── test/
│   ├── setup.ts          # Global test configuration
│   └── utils.tsx         # Test helpers and mock factories
├── App.test.tsx          # App integration tests (login, tabs)
├── services/
│   └── db.test.ts        # Database service tests (18 tests)
└── components/
    ├── AlphabeticalIndex.test.tsx  # Index grouping & selection (5 tests)
    ├── ContributorsView.test.tsx  # Contributor stats & actions (3 tests)
    ├── Header.test.tsx            # Navigation & auth display (7 tests)
    ├── HistoryView.test.tsx       # Family story content (6 tests)
    ├── ProfileView.test.tsx       # Profile, recipes, history (8 tests)
    ├── RecipeModal.test.tsx       # Recipe details & lightbox (14 tests)
    └── TriviaView.test.tsx        # Quiz flow & scoring (7 tests)
```

## 🛠️ Available Commands

| Command | Description |
|---------|-------------|
| `npm run test` | Watch mode - auto-reruns on file changes |
| `npm run test:run` | Single test run (CI/CD friendly) |
| `npm run test:ui` | Interactive browser UI |
| `npm run test:coverage` | Generate coverage report |
| `npm run test:e2e` | Playwright E2E tests (Chromium + Firefox) |
| `npm run test:e2e:ui` | Playwright E2E with interactive UI |
| `npm run test:e2e:desktop` | E2E Chromium only |

## 📝 Writing Tests

### Test a Service

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { CloudArchive } from './db';
import { setupLocalStorage } from '../test/utils';

describe('MyService', () => {
    beforeEach(() => {
        setupLocalStorage();
        localStorage.clear();
    });

    it('should do something', async () => {
        const result = await CloudArchive.getRecipes();
        expect(result).toBeDefined();
    });
});
```

### Test a Component

```typescript
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { MyComponent } from './MyComponent';
import { renderWithProviders, createMockRecipe } from '../test/utils';

describe('MyComponent', () => {
    it('should render correctly', () => {
        const mockData = createMockRecipe();
        renderWithProviders(<MyComponent recipe={mockData} />);
        
        expect(screen.getByText('Test Recipe')).toBeInTheDocument();
    });

    it('should handle clicks', () => {
        const mockHandler = vi.fn();
        renderWithProviders(<MyComponent onClick={mockHandler} />);
        
        fireEvent.click(screen.getByRole('button'));
        expect(mockHandler).toHaveBeenCalled();
    });
});
```

## 🏭 Mock Data Factories

Use the provided factories to create test data:

```typescript
import { 
    createMockRecipe, 
    createMockTrivia, 
    createMockGalleryItem,
    createMockContributor,
    createMockHistoryEntry 
} from '../test/utils';

// Create with defaults
const recipe = createMockRecipe();

// Override specific fields
const customRecipe = createMockRecipe({
    title: 'Custom Title',
    category: 'Dessert'
});
```

## 🎯 What to Test

### Priority 1: Critical Paths
- ✅ Database operations (CRUD)
- ✅ Data persistence (localStorage/Firebase)
- ✅ User authentication flows
- ✅ Form submissions

### Priority 2: User Interactions
- ✅ Button clicks
- ✅ Form inputs
- ✅ Modal open/close
- ✅ Navigation

### Priority 3: Edge Cases
- ✅ Empty states
- ✅ Error handling
- ✅ Loading states
- ✅ Null/undefined values

## 📊 Coverage Goals

| Area | Target Coverage |
|------|----------------|
| Services (db.ts) | 90%+ |
| Critical Components | 80%+ |
| Utilities | 85%+ |
| Overall | 75%+ |

## 🔧 Configuration

### Vitest Config (`vitest.config.ts`)

```typescript
export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        environment: 'happy-dom',
        setupFiles: ['./src/test/setup.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
        },
    },
});
```

### Test Setup (`src/test/setup.ts`)

- Mocks Firebase automatically
- Mocks Google GenAI
- Configures localStorage
- Imports jest-dom matchers

## 🐛 Debugging Tests

### Use the UI Mode

```bash
npm run test:ui
```

The UI provides:
- Visual test runner
- Source code viewing
- Console output
- Execution timeline

### Add Debug Statements

```typescript
import { screen, debug } from '@testing-library/react';

it('debugs component', () => {
    renderWithProviders(<MyComponent />);
    screen.debug(); // Prints DOM to console
});
```

### Run Specific Tests

```bash
# By file
npx vitest run src/services/db.test.ts

# By pattern
npx vitest run -t "Recipe"
```

## 🚨 Common Issues

### Issue: Tests fail with "localStorage is not defined"

**Solution:** Use `setupLocalStorage()` in your test:

```typescript
import { setupLocalStorage } from '../test/utils';

beforeEach(() => {
    setupLocalStorage();
});
```

### Issue: Firebase errors in tests

**Solution:** Firebase is already mocked in `setup.ts`. Ensure you're importing from the mocked modules.

### Issue: Component doesn't render

**Solution:** Use `renderWithProviders()` instead of plain `render()`:

```typescript
import { renderWithProviders } from '../test/utils';

renderWithProviders(<MyComponent />);
```

## 📚 Best Practices

1. **Test Behavior, Not Implementation**
   - Focus on what users see and do
   - Avoid testing internal state

2. **Keep Tests Independent**
   - Each test should run in isolation
   - Use `beforeEach` to reset state

3. **Use Descriptive Names**
   ```typescript
   it('should display error message when form is invalid')
   ```

4. **Mock External Dependencies**
   - Firebase is already mocked
   - Mock API calls
   - Mock timers when needed

5. **Test Accessibility**
   ```typescript
   expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
   ```

## 🎓 Learning Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

## 🤖 Test Agent Features

The intelligent test agent (`test-agent.js`) provides:

1. **Interactive Menu** - Easy command selection
2. **Watch Mode** - Auto-rerun on changes
3. **UI Mode** - Browser-based test runner
4. **Coverage Reports** - See what's tested
5. **Pattern Matching** - Run specific tests
6. **Health Checks** - Verify setup

Run it with:
```bash
node test-agent.js
```

## 📈 Next Steps

1. **Add More Tests**
   - Test remaining components
   - Add integration tests
   - Test error scenarios

2. **Improve Coverage**
   - Run `npm run test:coverage`
   - Identify untested code
   - Add missing tests

3. **Automate**
   - Add to CI/CD pipeline
   - Run on pre-commit hooks
   - Generate coverage badges

## 💡 Tips

- Run tests frequently during development
- Use watch mode for instant feedback
- Check coverage to find gaps
- Keep tests fast (<1s each)
- Update tests when changing features

---

**Happy Testing! 🎉**

For questions or issues, check the test-agent help menu or review existing tests for examples.

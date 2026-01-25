#!/usr/bin/env node

/**
 * Intelligent Test Agent for Schafer Family Cookbook
 * 
 * This agent helps you run, monitor, and analyze your test suite.
 * It provides an interactive CLI for managing your tests.
 */

import { spawn } from 'child_process';
import readline from 'readline';

const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    red: '\x1b[31m',
};

const banner = `
${colors.cyan}╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║        🧪 Schafer Family Cookbook Test Agent 🧪          ║
║                                                           ║
║           Your Intelligent Testing Companion             ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝${colors.reset}
`;

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function runCommand(command, args = [], options = {}) {
    return new Promise((resolve, reject) => {
        log(`\n▶ Running: ${command} ${args.join(' ')}\n`, 'cyan');

        const proc = spawn(command, args, {
            stdio: 'inherit',
            shell: true,
            ...options
        });

        proc.on('close', (code) => {
            if (code === 0) {
                log(`\n✓ Command completed successfully\n`, 'green');
                resolve(code);
            } else {
                log(`\n✗ Command failed with code ${code}\n`, 'red');
                resolve(code);
            }
        });

        proc.on('error', (err) => {
            log(`\n✗ Error: ${err.message}\n`, 'red');
            reject(err);
        });
    });
}

const commands = {
    '1': {
        name: 'Run All Tests',
        description: 'Execute the complete test suite',
        action: async () => {
            await runCommand('npm', ['run', 'test:run']);
        }
    },
    '2': {
        name: 'Watch Mode',
        description: 'Run tests in watch mode (auto-rerun on changes)',
        action: async () => {
            log('Starting watch mode... Press Ctrl+C to stop\n', 'yellow');
            await runCommand('npm', ['run', 'test']);
        }
    },
    '3': {
        name: 'UI Mode',
        description: 'Open interactive Vitest UI in browser',
        action: async () => {
            log('Opening Vitest UI... Check your browser!\n', 'yellow');
            await runCommand('npm', ['run', 'test:ui']);
        }
    },
    '4': {
        name: 'Coverage Report',
        description: 'Generate and display code coverage report',
        action: async () => {
            await runCommand('npm', ['run', 'test:coverage']);
            log('\n📊 Coverage report generated in ./coverage directory\n', 'green');
        }
    },
    '5': {
        name: 'Test Specific File',
        description: 'Run tests for a specific file',
        action: async () => {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            return new Promise((resolve) => {
                rl.question('Enter file path (e.g., src/services/db.test.ts): ', async (filePath) => {
                    rl.close();
                    if (filePath.trim()) {
                        await runCommand('npx', ['vitest', 'run', filePath.trim()]);
                    }
                    resolve();
                });
            });
        }
    },
    '6': {
        name: 'Test by Pattern',
        description: 'Run tests matching a specific pattern',
        action: async () => {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            return new Promise((resolve) => {
                rl.question('Enter test name pattern (e.g., "Recipe"): ', async (pattern) => {
                    rl.close();
                    if (pattern.trim()) {
                        await runCommand('npx', ['vitest', 'run', '-t', pattern.trim()]);
                    }
                    resolve();
                });
            });
        }
    },
    '7': {
        name: 'Show Test Summary',
        description: 'Display overview of all test files',
        action: async () => {
            log('\n📝 Test Files in Project:\n', 'bright');
            log('  • src/services/db.test.ts - Database service tests', 'cyan');
            log('  • src/components/RecipeModal.test.tsx - RecipeModal component tests', 'cyan');
            log('\n💡 Tip: Add more test files following the pattern: *.test.ts or *.test.tsx\n', 'yellow');
        }
    },
    '8': {
        name: 'Quick Health Check',
        description: 'Run a quick test to verify setup',
        action: async () => {
            log('\n🏥 Running health check...\n', 'yellow');
            await runCommand('npx', ['vitest', 'run', '--reporter=verbose', '--bail', '1']);
        }
    },
    'h': {
        name: 'Help',
        description: 'Show testing best practices and tips',
        action: () => {
            log('\n📚 Testing Best Practices:\n', 'bright');
            log('  1. Write tests as you develop features', 'cyan');
            log('  2. Aim for high coverage on critical paths (db, services)', 'cyan');
            log('  3. Test user interactions in components', 'cyan');
            log('  4. Mock external dependencies (Firebase, APIs)', 'cyan');
            log('  5. Keep tests fast and independent', 'cyan');
            log('\n🔧 Available Scripts:', 'bright');
            log('  • npm run test - Watch mode', 'yellow');
            log('  • npm run test:run - Single run', 'yellow');
            log('  • npm run test:ui - Interactive UI', 'yellow');
            log('  • npm run test:coverage - Coverage report', 'yellow');
            log('');
        }
    }
};

function showMenu() {
    console.clear();
    console.log(banner);

    log('\n🎯 Available Commands:\n', 'bright');

    Object.entries(commands).forEach(([key, cmd]) => {
        log(`  [${key}] ${cmd.name}`, 'green');
        log(`      ${cmd.description}`, 'reset');
    });

    log('\n  [q] Quit\n', 'red');
}

async function runInteractive() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const promptUser = () => {
        return new Promise((resolve) => {
            rl.question(`${colors.yellow}➜ Select option: ${colors.reset}`, (answer) => {
                resolve(answer.trim().toLowerCase());
            });
        });
    };

    let running = true;

    while (running) {
        showMenu();
        const choice = await promptUser();

        if (choice === 'q') {
            log('\n👋 Thanks for testing! Goodbye!\n', 'cyan');
            running = false;
        } else if (commands[choice]) {
            await commands[choice].action();
            log('\nPress Enter to continue...', 'yellow');
            await new Promise((resolve) => {
                rl.once('line', resolve);
            });
        } else {
            log('\n❌ Invalid option. Please try again.\n', 'red');
            await new Promise((resolve) => setTimeout(resolve, 1500));
        }
    }

    rl.close();
}

// Handle command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
    // Interactive mode
    runInteractive();
} else {
    // Direct command mode
    const command = args[0];
    if (commands[command]) {
        commands[command].action().then(() => process.exit(0));
    } else {
        log(`Unknown command: ${command}`, 'red');
        log('Available commands: ' + Object.keys(commands).join(', '), 'yellow');
        process.exit(1);
    }
}

// @ts-check
/**
 * fix4-team-scoreboard.spec.js
 *
 * Tests for Fix 4: Team kumite scoreboard with match context bar on TV display.
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'https://www.taikaiapp.com';

test.describe('Fix 4: Team Kumite Scoreboard', () => {
    test('TV display shows team match context bar when teamMatchContext is in state', async ({ page }) => {
        const token = process.env.TEST_AUTH_TOKEN;
        const tid = process.env.TEST_TOURNAMENT_ID;
        if (!token || !tid) { test.skip(); return; }

        // Navigate to TV display
        await page.goto(`${BASE_URL}/tv-display.html`);

        // Inject a kumite scoreboard state with team match context
        await page.evaluate(({ tid }) => {
            const state = {
                scoreboardType: 'kumite',
                ring: 1,
                matName: 'Mat 1',
                divisionName: 'Team Kumite Open',
                matchInfo: 'Round 1 - Match 1',
                corner1Name: 'RED', corner2Name: 'BLUE',
                corner1Color: '#ff453a', corner2Color: '#0a84ff',
                redName: 'DRAGON DOJO',
                blueScore: 0, redScore: 0,
                redPenalties: 0, bluePenalties: 0,
                timer: '3:00',
                teamMatchContext: {
                    teamAName: 'Dragon Dojo',
                    teamBName: 'Tiger Elite',
                    teamAWins: 1,
                    teamBWins: 0,
                    currentBout: 2,
                    teamMatchStatus: 'pending',
                    boutResults: [{ boutNumber: 1, winner: 'teamA' }],
                },
            };
            // Trigger the updateDisplay function
            if (typeof updateDisplay === 'function') {
                updateDisplay(state);
            }
        }, { tid });

        // Wait for render
        await page.waitForTimeout(500);

        // Check that team context bar is visible
        const contextBar = page.locator('#team-match-context');
        await expect(contextBar).toBeVisible();

        // Check team names
        const barText = await contextBar.textContent();
        expect(barText).toContain('Dragon Dojo');
        expect(barText).toContain('Tiger Elite');
        expect(barText).toContain('1 —');
        expect(barText).toContain('Bout 2 of 3');
    });

    test('TV display hides team context bar for individual kumite', async ({ page }) => {
        const token = process.env.TEST_AUTH_TOKEN;
        const tid = process.env.TEST_TOURNAMENT_ID;
        if (!token || !tid) { test.skip(); return; }

        await page.goto(`${BASE_URL}/tv-display.html`);

        // Inject individual kumite state (no teamMatchContext)
        await page.evaluate(() => {
            const state = {
                scoreboardType: 'kumite',
                ring: 1,
                matName: 'Mat 1',
                divisionName: 'Adult Male Intermediate',
                matchInfo: 'Round 1 - Match 1',
                corner1Name: 'RED', corner2Name: 'BLUE',
                corner1Color: '#ff453a', corner2Color: '#0a84ff',
                redName: 'JOHN DOE',
                blueName: 'JANE SMITH',
                redScore: 0, blueScore: 0,
                redPenalties: 0, bluePenalties: 0,
                timer: '3:00',
                // No teamMatchContext
            };
            if (typeof updateDisplay === 'function') {
                updateDisplay(state);
            }
        });

        await page.waitForTimeout(500);

        // Context bar should be hidden (display: none)
        const contextBar = page.locator('#team-match-context');
        const isVisible = await contextBar.isVisible().catch(() => false);
        expect(isVisible).toBe(false);
    });

    test('teamMatchStatus decided shows Match Decided label', async ({ page }) => {
        const token = process.env.TEST_AUTH_TOKEN;
        const tid = process.env.TEST_TOURNAMENT_ID;
        if (!token || !tid) { test.skip(); return; }

        await page.goto(`${BASE_URL}/tv-display.html`);

        await page.evaluate(() => {
            const state = {
                scoreboardType: 'kumite',
                ring: 1,
                matName: 'Mat 1',
                divisionName: 'Team Kumite',
                matchInfo: 'Final',
                corner1Name: 'RED', corner2Name: 'BLUE',
                corner1Color: '#ff453a', corner2Color: '#0a84ff',
                redName: 'PHOENIX WARRIORS',
                blueName: 'SAMURAI SCHOOL',
                redScore: 0, blueScore: 0,
                redPenalties: 0, bluePenalties: 0,
                timer: '0:00',
                teamMatchContext: {
                    teamAName: 'Phoenix Warriors',
                    teamBName: 'Samurai School',
                    teamAWins: 2,
                    teamBWins: 0,
                    currentBout: 3,
                    teamMatchStatus: 'decided',
                    boutResults: [
                        { boutNumber: 1, winner: 'teamA' },
                        { boutNumber: 2, winner: 'teamA' },
                    ],
                },
            };
            if (typeof updateDisplay === 'function') {
                updateDisplay(state);
            }
        });

        await page.waitForTimeout(500);

        const contextBar = page.locator('#team-match-context');
        const barText = await contextBar.textContent();
        expect(barText).toContain('Match Decided');
        expect(barText).toContain('2 —');
    });
});

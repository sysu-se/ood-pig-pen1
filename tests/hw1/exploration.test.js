import { describe, test, expect } from 'vitest';
import Sudoku from '../../src/domain/Sudoku.js';
import Game from '../../src/domain/Game.js';

describe('Exploration Mode Tests', () => {
    test('Sudoku conflict detection', () => {
        const gridWithConflict = [
            [5, 3, 0, 0, 7, 0, 0, 0, 0],
            [6, 0, 0, 1, 9, 5, 0, 0, 0],
            [0, 9, 8, 0, 0, 0, 0, 6, 0],
            [8, 0, 0, 0, 6, 0, 0, 0, 3],
            [4, 0, 0, 8, 0, 3, 0, 0, 1],
            [7, 0, 0, 0, 2, 0, 0, 0, 6],
            [0, 6, 0, 0, 0, 0, 2, 8, 0],
            [0, 0, 0, 4, 1, 9, 0, 0, 5],
            [0, 0, 0, 0, 8, 0, 0, 7, 9]
        ];

        const sudoku = new Sudoku(gridWithConflict);
        expect(sudoku.checkConflict()).toBe(false);

        // Introduce a conflict
        sudoku.grid[0][2] = 5;
        expect(sudoku.checkConflict()).toBe(true);
    });

    test('Game exploration mode start and end', () => {
        const sudoku = new Sudoku();
        const game = new Game({ sudoku });

        game.startExploration();
        expect(game.isExploring).toBe(true);

        game.endExploration();
        expect(game.isExploring).toBe(false);
    });

    test('Game failed exploration memory', () => {
        const sudoku = new Sudoku();
        const game = new Game({ sudoku });

        game.startExploration();
        game.recordFailedExploration();
        expect(game.isFailedExploration()).toBe(true);

        game.endExploration();
        expect(game.isFailedExploration()).toBe(true);
    });
});
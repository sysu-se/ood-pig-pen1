/* DEBUG_MARKER_12345 */
/**
 * gameStore.js - Store Adapter（领域对象与 Svelte 的桥接层）
 * 职责：
 * 1. 持有 Game 领域对象
 * 2. 对外暴露可被 Svelte 消费的响应式状态
 * 3. 对外暴露 UI 可调用的方法（guess, undo, redo, hint, explore 等）
 */

import { writable, derived } from 'svelte/store'
import { createSudoku, createGame } from '@sudoku/domain'
import { generateSudoku, solveSudoku } from '@sudoku/sudoku'
import { decodeSencode } from '@sudoku/sencode'
import { SUDOKU_SIZE } from '@sudoku/constants'
import { difficulty } from '@sudoku/stores/difficulty'

/**
 * 创建游戏 Store
 * @returns {Object} gameStore 对象
 */
function createGameStore() {
    // ===== 内部状态（领域对象）=====
    let game = null

    // ===== Svelte Stores（响应式状态）=====

    // grid: 当前数独网格（9x9 二维数组）
    const grid = writable(
        Array.from({ length: 9 }, () => Array(9).fill(0))
    )

    // initialGrid: 初始题目网格
    const initialGrid = writable(
        Array.from({ length: 9 }, () => Array(9).fill(0))
    )

    // invalidCells: 冲突格子数组
    const invalidCells = writable([])

    // won: 是否胜利
    const won = writable(false)

    // canUndo: 是否可撤销
    const canUndo = writable(false)

    // canRedo: 是否可重做
    const canRedo = writable(false)

    // isExploring: 是否处于探索模式
    const isExploring = writable(false)

    // exploringFailed: 当前探索状态是否已知失败
    const exploringFailed = writable(false)

    // exploringConflict: 当前棋盘是否有冲突（实时检测）
    const exploringConflict = writable(false)

    // exploringEmptyCandidate: 当前棋盘是否有死路（实时检测）
    const exploringEmptyCandidate = writable(false)

    // ===== 派生 Stores（从多个 stores 派生）=====
    
    const state = derived(
        [grid, initialGrid, invalidCells, won, canUndo, canRedo, isExploring, exploringFailed, exploringConflict, exploringEmptyCandidate],
        ([$grid, $initialGrid, $invalidCells, $won, $canUndo, $canRedo, $isExploring, $exploringFailed, $exploringConflict, $exploringEmptyCandidate]) => ({
            grid: $grid,
            initialGrid: $initialGrid,
            invalidCells: $invalidCells,
            won: $won,
            canUndo: $canUndo,
            canRedo: $canRedo,
            isExploring: $isExploring,
            exploringFailed: $exploringFailed,
            exploringConflict: $exploringConflict,
            exploringEmptyCandidate: $exploringEmptyCandidate
        })
    )

    // ===== 内部方法：同步领域对象状态到 Stores =====
    function syncToStores() {
        if (!game) return

        grid.set(game.getSudoku().getGrid())
        initialGrid.set(game.getInitialGrid())
        invalidCells.set(game.getInvalidCells())
        won.set(game.isWon())
        canUndo.set(game.canUndo())
        canRedo.set(game.canRedo())
        isExploring.set(game.isInExploreMode())
        exploringFailed.set(game.isCurrentStateKnownFailed())

        // 实时同步探索模式的冲突/死路状态
        if (game.isInExploreMode()) {
            exploringConflict.set(game.getSudoku().hasAnyConflict())
            exploringEmptyCandidate.set(game.getSudoku().hasEmptyCandidate())
        } else {
            exploringConflict.set(false)
            exploringEmptyCandidate.set(false)
        }
    }

    // ===== 公开方法（UI 可调用）=====

    /**
     * 开始新游戏
     * @param {string} difficultyLevel - 难度
     */
	function startNew(difficultyLevel) {
		console.log('[gameStore] startNew called with:', difficultyLevel);
		const generatedGrid = generateSudoku(difficultyLevel)
		const sudoku = createSudoku(generatedGrid)
		game = createGame({ sudoku })
		console.log('[gameStore] game after creation:', game);
		console.log('[gameStore] setting difficulty to:', difficultyLevel);
		difficulty.set(difficultyLevel)
		console.log('[gameStore] difficulty set called');
		syncToStores()
	}

    /**
     * 开始自定义游戏
     * @param {string} sencode - Sencode 编码字符串
     */
    function startCustom(sencode) {
        const decodedGrid = decodeSencode(sencode)
        const sudoku = createSudoku(decodedGrid)
        game = createGame({ sudoku })
        difficulty.setCustom()
        syncToStores()
    }

    /**
     * 填数字
     * @param {Object} move - { row, col, value }
     * @returns {boolean}
     */
    function guess(move) {
        console.log('>>> gameStore.guess ENTERED', move);
        if (!game) {
            console.log('gameStore.guess: game is null');
            return false;
        }
        console.log('gameStore.guess: game exists, calling game.guess');
        const success = game.guess(move.row, move.col, move.value);
        console.log('gameStore.guess: game.guess returned', success);
        if (success) {
            syncToStores()
        }
        return success
    }

    /**
     * 撤销
     */
    function undo() {
        if (!game) return
        const success = game.undo()
        if (success) {
            syncToStores()
        }
        return success
    }

    /**
     * 重做
     */
    function redo() {
        if (!game) return
        const success = game.redo()
        if (success) {
            syncToStores()
        }
        return success
    }

    /**
	 * 候选提示：获取指定位置的候选数
	 * @param {Object} pos - { x, y }
	 * @returns {number[]}
	 */
	function getCandidates(pos) {
		console.log('gameStore.getCandidates ENTER', pos, 'game=', game);
		if (!game) {
			console.log('getCandidates: game is null');
			return []
		}
		const result = game.getCandidates(pos.y, pos.x);
		console.log('gameStore.getCandidates RESULT', result);
		return result;
	}

    /**
     * 下一步提示：获取所有推定数
     * @returns {Array<{row, col, value}>}
     */
    function getNextHint() {
        if (!game) return []
        return game.getNextHint()
    }

    /**
     * 获取所有候选数
     * @returns {Array<{row, col, candidates}>}
     */
    function getAllCandidates() {
        if (!game) return []
        return game.getAllCandidates()
    }

    /**
     * 应用提示：在指定位置填入推定数
     * @param {Object} pos - 可选，{ x, y } 位置，如果不提供则自动选择
     * @returns {boolean}
     */
    function applyHint(pos) {
        if (!game) return false

        let success = false

        if (pos) {
            // 指定位置应用提示
            const currentGrid = game.getSudoku().getGrid()
            if (currentGrid[pos.y][pos.x] !== 0) return false

            // 尝试获取推定数
            const hints = game.getNextHint()
            const hint = hints.find(h => h.row === pos.y && h.col === pos.x)

            if (hint) {
                success = game.guess({
                    row: hint.row,
                    col: hint.col,
                    value: hint.value
                })
            } else {
                // 如果没有推定数，使用求解器填入答案
                // 先检查当前局面是否有冲突
                const invalidCells = game.getInvalidCells();
                if (invalidCells.length > 0) {
                    console.warn('Cannot solve puzzle: current state has conflicts');
                    return false;
                }
                
                try {
                    const solvedGrid = solveSudoku(currentGrid)
                    if (solvedGrid && solvedGrid[pos.y][pos.x] !== 0) {
                        success = game.guess({
                            row: pos.y,
                            col: pos.x,
                            value: solvedGrid[pos.y][pos.x]
                        })
                    }
                } catch (e) {
                    console.error('Cannot solve puzzle:', e.message);
                    return false;
                }
            }
        } else {
            // 没有指定位置，尝试在任意空格填入推定数
            const hints = game.getNextHint()
            if (hints.length > 0) {
                const hint = hints[0]
                success = game.guess({
                    row: hint.row,
                    col: hint.col,
                    value: hint.value
                })
            } else {
                // 没有推定数，尝试在任意空格填入求解器的答案
                // 先检查当前局面是否有冲突
                const invalidCells = game.getInvalidCells();
                if (invalidCells.length > 0) {
                    console.warn('Cannot solve puzzle: current state has conflicts');
                    return false;
                }
                
                const allCandidates = game.getAllCandidates()
                if (allCandidates.length > 0) {
                    const cell = allCandidates[0]
                    const currentGrid = game.getSudoku().getGrid()
                    try {
                        const solvedGrid = solveSudoku(currentGrid)
                        if (solvedGrid && solvedGrid[cell.row][cell.col] !== 0) {
                            success = game.guess({
                                row: cell.row,
                                col: cell.col,
                                value: solvedGrid[cell.row][cell.col]
                            })
                        }
                    } catch (e) {
                        console.error('Cannot solve puzzle:', e.message);
                        return false;
                    }
                }
            }
        }

        if (success) {
            syncToStores()
        }
        return success
    }

    /**
     * 获取提示原因
     * @param {Object} pos - { x, y }
     * @returns {string}
     */
    function getHintReason(pos) {
        if (!game) return ''
        return game.getHintReason(pos.y, pos.x)
    }

    /**
     * 判断指定格子是否是题目预设的
     * @param {number} row
     * @param {number} col
     * @returns {boolean}
     */
    function isInitialCell(row, col) {
        if (!game) return false
        return game.isInitialCell(row, col)
    }

    /**
     * 清空指定格子的候选数
     * @param {number} x - 列号
     * @param {number} y - 行号
     */
    function clearCellCandidates(x, y) {
        // 这个方法目前是空实现
        // 候选数由 candidates store 管理
        // 如果需要集成到 Game，可以在这里实现
    }

    // ===== 探索模式方法 =====

    /**
     * 进入探索模式
     * @returns {boolean}
     */
    function enterExplore() {
        if (!game) return false
        const success = game.enterExplore()
        if (success) {
            syncToStores()
        }
        return success
    }

    /**
     * 放弃探索
     * @returns {boolean}
     */
    function exitExplore() {
        if (!game) return false
        const success = game.exitExplore()
        if (success) {
            syncToStores()
        }
        return success
    }

    /**
     * 提交探索
     * @returns {boolean}
     */
    function submitExplore() {
        if (!game) return { success: false, reason: 'no_game' }
        const result = game.submitExplore()
        syncToStores()
        return result
    }

    /**
     * 检查是否处于探索模式
     * @returns {boolean}
     */
    function checkExploring() {
        if (!game) return false
        return game.isInExploreMode()
    }

    /**
     * 获取探索模式的冲突状态（供 UI 实时检测）
     * @returns {{ conflict: boolean, emptyCandidate: boolean, knownFailed: boolean }}
     */
    function getExploreConflictStatus() {
        if (!game) return { conflict: false, emptyCandidate: false, knownFailed: false }
        return game.getExploreConflictStatus()
    }

    // ===== 返回 Store 对象 =====

    return {
        // 订阅接口
        subscribe: state.subscribe,

        // 响应式状态
        grid,
        initialGrid,
        invalidCells,
        won,
        canUndo,
        canRedo,
        isExploring,
        exploringFailed,
        exploringConflict,
        exploringEmptyCandidate,

        // 派生状态
        state,

        // 操作方法
        startNew,
        startCustom,
        guess,
        undo,
        redo,

        // 提示方法
        getCandidates,
        getNextHint,
        getAllCandidates,
        applyHint,
        getHintReason,

        // 探索方法
        enterExplore,
        exitExplore,
        submitExplore,
        checkExploring,
        getExploreConflictStatus,

        // 辅助方法
        isInitialCell,
        clearCellCandidates,

        // 获取内部 Game 对象（用于测试）
        getGame: () => game
    }
}

// ===== 导出单例 =====
export const gameStore = createGameStore()

// ===== 导出工厂函数 =====
export { createGameStore }

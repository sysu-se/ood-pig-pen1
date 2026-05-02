/**
 * Game 类 - 游戏会话领域对象
 * 职责：管理游戏会话的整体流程，包括 Undo/Redo 历史记录、提示功能、探索模式
 * 依赖：Sudoku 类
 */
import Sudoku from './Sudoku.js'

class Game {
    /**
     * 构造函数 - 创建一个新的游戏会话
     * @param {Object} options - 配置选项
     * @param {Sudoku} options.sudoku - 一个 Sudoku 对象，作为初始局面
     */
    constructor(options = {}) {
        const sudoku = options.sudoku || new Sudoku();
        
        // 保存初始局面的副本（用于标记哪些格子是题目预设的）
        this.initialSudoku = sudoku.clone()

        // 当前局面（使用 clone 防止外部绕过 Game 修改）
        this.sudoku = sudoku.clone()

        // history 数组：保存历史快照（用于 Undo）
        this.history = []

        // redoHistory 数组：保存被撤销的快照（用于 Redo）
        this.redoHistory = []

        // ===== 探索模式状态 =====
        // 是否处于探索模式
        this.isExploring = false

        // 探索开始前的主 history 快照
        this.exploreHistorySnapshot = null

        // 探索开始前的主 redoHistory 快照
        this.exploreRedoSnapshot = null

        // 探索局面的冲突记录（用于"记忆"功能）
        this.failedExplorations = new Set()

        // 探索开始前的当前局面快照
        this.exploreStartSnapshot = null
    }

    /**
     * 获取当前数独局面
     * @returns {Sudoku} 返回当前 sudoku 的副本
     */
    getSudoku() {
        return this.sudoku.clone()
    }

    /**
     * 获取初始题目（标记不可修改的格子）
     * @returns {number[][]} 返回初始题目的 grid
     */
    getInitialGrid() {
        return this.initialSudoku.getGrid()
    }

    /**
     * 判断指定格子是否是题目预设的（不可修改）
     * @param {number} row - 行号
     * @param {number} col - 列号
     * @returns {boolean} 是预设格子返回 true，否则返回 false
     */
    isInitialCell(row, col) {
        return this.initialSudoku.getGrid()[row][col] !== 0
    }

    /**
     * 获取当前局面的冲突格子
     * @returns {string[]} 返回冲突格子坐标数组，格式为 ["col,row", ...]
     */
    getInvalidCells() {
        return this.sudoku.validate()
    }

    /**
     * 检查当前局面是否已完成
     * @returns {boolean} 完成返回 true，否则返回 false
     */
    isWon() {
        return this.sudoku.isComplete()
    }

    /**
     * 猜测一个数字
     * @param {number|Object} row - 行号或包含 row, col, value 的对象
     * @param {number} col - 列号（可选）
     * @param {number} value - 猜测的数字（可选）
     * @returns {boolean} 是否成功
     */
    guess(row, col, value) {
        // 支持两种调用方式：guess(row, col, value) 或 guess({ row, col, value })
        let rowNum, colNum, valueNum;
        if (typeof row === 'object' && row !== null) {
            rowNum = row.row;
            colNum = row.col;
            valueNum = row.value;
        } else {
            rowNum = row;
            colNum = col;
            valueNum = value;
        }

        // 检查是否是初始题目格子
        if (this.isInitialCell(rowNum, colNum)) {
            console.error(`Cannot modify initial cell at (${rowNum}, ${colNum})`);
            return false;
        }

        // 检查新值是否和当前值相同
        const currentValue = this.sudoku.getGrid()[rowNum][colNum];
        if (currentValue === valueNum) {
            return false; // 没有变化，不需要记录历史
        }

        // 先执行操作，获取操作结果
        const success = this.sudoku.guess({ row: rowNum, col: colNum, value: valueNum });
        
        // 只有操作真正成功时才记录历史
        if (!success) return false;

        // 根据是否在探索模式，选择正确的历史记录
        if (this.isExploring) {
            // 探索模式下记录到探索历史
            this._recordExploreMove(this.sudoku.clone());
        } else {
            // 正常模式下记录到主历史
            this.history.push(this.sudoku.clone());
            this.redoHistory = []; // 清空 redo 历史
        }

        return success;
    }

    /**
     * 撤销最近一次操作
     * @returns {boolean} 撤销成功返回 true，无法撤销返回 false
     */
    undo() {
        // 如果在探索模式中
        if (this.isExploring) {
            return this._undoExplore()
        }

        // 正常撤销
        if (!this.canUndo()) return false

        this.redoHistory.push(this.sudoku.clone())
        this.sudoku = this.history.pop()
        return true
    }

    /**
     * 重做被撤销的操作
     * @returns {boolean} 重做成功返回 true，无法重做返回 false
     */
    redo() {
        // 如果在探索模式中
        if (this.isExploring) {
            return this._redoExplore()
        }

        // 正常重做
        if (!this.canRedo()) return false

        this.history.push(this.sudoku.clone())
        this.sudoku = this.redoHistory.pop()
        return true
    }

    /**
     * 判断是否可以撤销
     * @returns {boolean} 可以撤销返回 true，否则返回 false
     */
    canUndo() {
        if (this.isExploring) {
            // 探索模式下，检查探索历史
            return this.exploreMoveHistory.length > 0
        }
        return this.history.length > 0
    }

    /**
     * 判断是否可以重做
     * @returns {boolean} 可以重做返回 true，否则返回 false
     */
    canRedo() {
        if (this.isExploring) {
            // 探索模式下，检查探索重做历史
            return this.exploreRedoHistory.length > 0
        }
        return this.redoHistory.length > 0
    }

    // ===== 提示功能 =====

    /**
     * 获取指定位置的候选数
     * @param {number} row - 行号
     * @param {number} col - 列号
     * @returns {number[]} 候选数数组
     */
    getCandidates(row, col) {
        return this.sudoku.getCandidates(row, col)
    }

    /**
     * 获取下一步可以填写的推定数（唯一候选值）
     * @returns {Array<{row: number, col: number, value: number}>} 推定数数组
     */
    getNextHint() {
        return this.sudoku.getDeducibleMoves()
    }

    /**
     * 获取所有空格及其候选数
     * @returns {Array<{row: number, col: number, candidates: number[]}>}
     */
    getAllCandidates() {
        return this.sudoku.getAllCandidates()
    }

    /**
     * 获取提示原因说明
     * @param {number} row - 行号
     * @param {number} col - 列号
     * @returns {string} 提示原因
     */
    getHintReason(row, col) {
        const candidates = this.sudoku.getCandidates(row, col)
        if (candidates.length === 0) {
            return '该格子已填满'
        }
        if (candidates.length === 1) {
            return `这是唯一候选数位置，该位置只能填 ${candidates[0]}`
        }
        return `候选数为 ${candidates.join(', ')}`
    }

    /**
     * 应用提示：在当前选中的位置填入推定数
     * @param {number} row - 行号
     * @param {number} col - 列号
     * @returns {boolean} 是否成功
     */
    applyHint(row, col) {
        // 检查该格子是否已经有数字
        if (this.sudoku.getGrid()[row][col] !== 0) {
            return false
        }

        // 获取推定数（唯一候选值）
        const hints = this.sudoku.getDeducibleMoves()
        const hint = hints.find(h => h.row === row && h.col === col)

        if (hint) {
            // 如果找到了推定数，直接使用
            return this._applyHintMove(hint)
        }

        // 如果没有推定数，使用求解器获取答案
        return this._applyHintWithSolver(row, col)
    }

    /**
     * 内部方法：应用提示移动
     * @private
     */
    _applyHintMove(hint) {
        // 保存当前状态
        this.history.push(this.sudoku.clone())
        this.redoHistory = []

        // 应用提示
        this.sudoku.guess(hint)
        return true
    }

    /**
     * 内部方法：使用求解器获取提示
     * @private
     */
    _applyHintWithSolver(row, col) {
        // 获取所有空格及其候选数
        const allCandidates = this.sudoku.getAllCandidates()

        // 找一个候选数最少的位置
        if (allCandidates.length === 0) return false

        // 按候选数排序，找到第一个有候选数的
        allCandidates.sort((a, b) => a.candidates.length - b.candidates.length)

        for (const cell of allCandidates) {
            if (cell.candidates.length > 0) {
                // 取第一个候选数填入
                const hint = {
                    row: cell.row,
                    col: cell.col,
                    value: cell.candidates[0]
                }
                return this._applyHintMove(hint)
            }
        }

        return false
    }

    /**
     * 设置候选数状态
     * @param {Object} candidates - 候选数状态
     */
    setCandidates(candidates) {
        this.history.push({
            sudoku: this.sudoku.clone(),
            candidates: this.sudoku.getCandidates()
        });
        this.redoHistory = [];
        this.sudoku.setCandidates(candidates);
    }

    /**
     * 清空候选数状态
     */
    clearCandidates() {
        this.history.push({
            sudoku: this.sudoku.clone(),
            candidates: this.sudoku.getCandidates()
        });
        this.redoHistory = [];
        this.sudoku.clearCandidates();
    }

    // ===== 探索模式 =====

    /**
     * 进入探索模式
     * @returns {boolean} 成功返回 true
     */
    enterExplore() {
        if (this.isExploring) return false

        // 保存当前状态快照
        this.exploreStartSnapshot = this.sudoku.clone()
        this.exploreHistorySnapshot = [...this.history]
        this.exploreRedoSnapshot = [...this.redoHistory]

        // 初始化探索模式的历史记录
        this.exploreMoveHistory = []
        this.exploreRedoHistory = []

        // 进入探索模式
        this.isExploring = true

        return true
    }

    /**
     * 离开探索模式（放弃）
     * @returns {boolean} 成功返回 true
     */
    exitExplore() {
        if (!this.isExploring) return false

        // 恢复到探索开始前的状态
        this.sudoku = this.exploreStartSnapshot
        this.history = this.exploreHistorySnapshot
        this.redoHistory = this.exploreRedoSnapshot

        // 清理探索状态
        this.isExploring = false
        this.exploreStartSnapshot = null
        this.exploreHistorySnapshot = null
        this.exploreRedoSnapshot = null
        this.exploreMoveHistory = null
        this.exploreRedoHistory = null

        return true
    }

    /**
     * 提交探索结果
     * @returns {{success: boolean, reason?: string}} 成功返回 {success: true}，失败返回 {success: false, reason}
     */
    submitExplore() {
        if (!this.isExploring) return { success: false, reason: 'not_exploring' }

        // 检查探索结果是否有冲突
        if (this.sudoku.hasAnyConflict()) {
            // 记录失败的探索状态
            const stateKey = this._getStateKey()
            this.failedExplorations.add(stateKey)

            return { success: false, reason: 'conflict' }
        }

        // 检查是否完成
        if (!this.sudoku.isComplete()) {
            // 未完成，不能提交（用户需要继续填写或放弃探索）
            return { success: false, reason: 'incomplete' }
        }

        // 将探索历史合并到主历史
        // 探索开始前的主历史 + 探索过程中的所有操作 = 新的主历史
        // 注意：exploreStartSnapshot 已经在 exploreMoveHistory 中作为第一条记录
        // 我们需要用探索开始前的历史 + 探索移动历史

        // 清空主历史，用探索开始前的历史加上探索历史
        this.history = [...this.exploreHistorySnapshot]

        // 将探索开始前的状态作为历史的第一条（用于 Undo 回到探索前）
        // 但实际上用户选择"提交"意味着用户认可了探索结果
        // 所以探索前的状态不需要再作为历史记录了

        // 清空探索状态
        this.isExploring = false
        this.exploreStartSnapshot = null
        this.exploreHistorySnapshot = null
        this.exploreRedoSnapshot = null
        this.exploreMoveHistory = null
        this.exploreRedoHistory = null

        return { success: true }
    }

    /**
     * 检查当前探索状态是否已知失败
     * @returns {boolean} 已知失败返回 true
     */
    isCurrentStateKnownFailed() {
        if (!this.isExploring) return false

        const stateKey = this._getStateKey()
        return this.failedExplorations.has(stateKey)
    }

    /**
     * 检查是否处于探索模式
     * @returns {boolean} 是探索模式返回 true
     */
    isInExploreMode() {
        return this.isExploring
    }

    /**
     * 记录探索移动
     * @private
     */
    _recordExploreMove(snapshot) {
        if (!this.exploreMoveHistory) {
            this.exploreMoveHistory = []
        }
        this.exploreMoveHistory.push(snapshot)
        // 新操作后清除探索重做历史
        this.exploreRedoHistory = []
    }

    /**
     * 探索模式下的撤销
     * @private
     */
    _undoExplore() {
        if (!this.canUndo()) return false

        // 将当前状态存入探索重做历史
        this.exploreRedoHistory.push(this.sudoku.clone())

        // 从探索历史中恢复
        this.sudoku = this.exploreMoveHistory.pop()
        return true
    }

    /**
     * 探索模式下的重做
     * @private
     */
    _redoExplore() {
        if (!this.canRedo()) return false

        // 将当前状态存入探索历史
        this.exploreMoveHistory.push(this.sudoku.clone())

        // 从探索重做历史中恢复
        this.sudoku = this.exploreRedoHistory.pop()
        return true
    }

    /**
     * 获取当前状态的唯一标识（用于失败状态记录）
     * @private
     */
    _getStateKey() {
        return this.sudoku.getGrid().map(row => row.join('')).join('|')
    }

    // ===== 序列化 =====

    /**
     * 将当前游戏状态序列化为 JSON 格式
     * @returns {Object} 返回包含当前 sudoku 数据的对象
     */
    toJSON() {
        return {
            sudoku: this.sudoku.toJSON(),
            initialSudoku: this.initialSudoku.toJSON()
        }
    }

    /**
     * 静态方法：从 JSON 数据反序列化为 Game 对象
     * @param {Object} json - 包含 sudoku 和 initialSudoku 字段的对象
     * @returns {Game} 返回新创建的 Game 对象
     */
    static fromJSON(json) {
        if (!json.sudoku || !json.sudoku.grid) {
            throw new Error('Invalid game JSON: missing sudoku grid')
        }

        const game = new Game(Sudoku.fromJSON(json.sudoku))

        if (json.initialSudoku && json.initialSudoku.grid) {
            game.initialSudoku = Sudoku.fromJSON(json.initialSudoku)
        }

        return game
    }
}

export default Game

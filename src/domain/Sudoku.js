/**
 * Sudoku 类 - 数独局面领域对象
 * 职责：管理 9×9 数独网格的数据与操作，包括候选数计算和求解
 * 不关心：游戏历史、Undo/Redo、探索模式
 */
class Sudoku {
    /**
     * 构造函数 - 创建一个新的数独局面
     * @param {number[][]} input - 9×9 的二维数组，0 表示空格
     */
    constructor(input) {
        if (!input) {
            this.grid = Array.from({ length: 9 }, () => Array(9).fill(0))
        } else {
            // 校验输入格式
            this._validateInput(input)
            // 深拷贝输入的 grid 数据
            this.grid = JSON.parse(JSON.stringify(input))
        }
    }

    /**
     * 私有方法：校验输入数据是否符合数独网格的不变量
     * @param {any} input - 待校验的输入数据
     * @throws {Error} 如果输入不合法则抛出错误
     */
    _validateInput(input) {
        if (!Array.isArray(input) || input.length !== 9) {
            throw new Error('Sudoku grid must be a 9x9 array')
        }

        for (let i = 0; i < 9; i++) {
            const row = input[i]
            if (!Array.isArray(row) || row.length !== 9) {
                throw new Error(`Row ${i} must be an array with 9 cells`)
            }

            for (let j = 0; j < 9; j++) {
                const cell = row[j]
                if (!Number.isInteger(cell) || cell < 0 || cell > 9) {
                    throw new Error(`Cell [${i}][${j}] must be an integer between 0 and 9, got: ${cell}`)
                }
            }
        }
    }

    /**
     * 获取当前数独局面（防御性拷贝）
     * @returns {number[][]} 返回 grid 的深拷贝
     */
    getGrid() {
        return JSON.parse(JSON.stringify(this.grid))
    }

    /**
     * 在指定位置填入一个数字
     * @param {Object} move - 包含 row（行号）、col（列号）、value（数字）的对象
     * @returns {boolean} 如果成功填入数字返回 true，如果输入非法则返回 false
     */
    guess(move) {
        const { row, col, value } = move

        // 校验位置是否合法
        if (!this.isValidPosition(row, col)) return false

        // 校验值的合法性
        if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 9) return false

        // 如果新值和当前值一样，视为没有改变
        if (this.grid[row][col] === value) return false

        // 将数字填入 grid 的指定位置
        this.grid[row][col] = value
        return true
    }

    /**
     * 判断指定位置是否合法（行列是否都在 0-8 范围内）
     * @param {number} row - 行号
     * @param {number} col - 列号
     * @returns {boolean} 位置合法返回 true，否则返回 false
     */
    isValidPosition(row, col) {
        return row >= 0 && row < 9 && col >= 0 && col < 9
    }

    /**
     * 获取指定位置的候选数集合（排除行、列、宫中已出现的数字）
     * @param {number} row - 行号
     * @param {number} col - 列号
     * @returns {number[]} 候选数数组，如 [1,2,3]
     */
    getCandidates(row, col) {
        console.log('Sudoku.getCandidates ENTER', {row, col, cellValue: this.grid[row][col]});
        // 如果该位置已经有数字，返回空数组
        if (this.grid[row][col] !== 0) {
            console.log('Sudoku.getCandidates: cell already filled, returning []');
            return []
        }

        // 1-9 的候选数
        const candidates = [1, 2, 3, 4, 5, 6, 7, 8, 9]

        // 排除行中已出现的数字
        for (let c = 0; c < 9; c++) {
            const val = this.grid[row][c]
            if (val !== 0) {
                const idx = candidates.indexOf(val)
                if (idx !== -1) candidates.splice(idx, 1)
            }
        }

        // 排除列中已出现的数字
        for (let r = 0; r < 9; r++) {
            const val = this.grid[r][col]
            if (val !== 0) {
                const idx = candidates.indexOf(val)
                if (idx !== -1) candidates.splice(idx, 1)
            }
        }

        // 排除宫中已出现的数字
        const boxStartRow = Math.floor(row / 3) * 3
        const boxStartCol = Math.floor(col / 3) * 3
        for (let r = boxStartRow; r < boxStartRow + 3; r++) {
            for (let c = boxStartCol; c < boxStartCol + 3; c++) {
                const val = this.grid[r][c]
                if (val !== 0) {
                    const idx = candidates.indexOf(val)
                    if (idx !== -1) candidates.splice(idx, 1)
                }
            }
        }

        console.log('Sudoku.getCandidates RESULT', {row, col, candidates});
        return candidates
    }

    /**
     * 获取所有空格单元格的候选数
     * @returns {Array<{row: number, col: number, candidates: number[]}>} 所有空格及其候选数
     */
    getAllCandidates() {
        const result = []
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (this.grid[row][col] === 0) {
                    const candidates = this.getCandidates(row, col)
                    result.push({ row, col, candidates })
                }
            }
        }
        return result
    }

    /**
     * 获取下一步可以填写的推定数（唯一候选值）
     * @returns {Array<{row: number, col: number, value: number}>} 推定数数组
     */
    getDeducibleMoves() {
        const moves = []
        const allCandidates = this.getAllCandidates()
        
        console.log('[getDeducibleMoves] allCandidates:', allCandidates);

        for (const { row, col, candidates } of allCandidates) {
            if (candidates.length === 1) {
                moves.push({
                    row,
                    col,
                    value: candidates[0]
                })
            }
        }

        console.log('[getDeducibleMoves] deducible moves:', moves);
        return moves
    }

    /**
     * 校验当前局面是否符合数独规则
     * @returns {string[]} 返回冲突格子的坐标数组，格式为 ["col,row", ...]
     */
    validate() {
        const invalidCells = []

        const addInvalid = (c, r) => {
            const key = `${c},${r}`
            if (!invalidCells.includes(key)) {
                invalidCells.push(key)
            }
        }

        for (let y = 0; y < 9; y++) {
            for (let x = 0; x < 9; x++) {
                const value = this.grid[y][x]
                if (value === 0) continue

                // 检查行
                for (let i = 0; i < 9; i++) {
                    if (i !== x && this.grid[y][i] === value) {
                        addInvalid(x, y)
                        addInvalid(i, y)
                    }
                }

                // 检查列
                for (let i = 0; i < 9; i++) {
                    if (i !== y && this.grid[i][x] === value) {
                        addInvalid(x, y)
                        addInvalid(x, i)
                    }
                }

                // 检查宫
                const startY = Math.floor(y / 3) * 3
                const endY = startY + 3
                const startX = Math.floor(x / 3) * 3
                const endX = startX + 3
                for (let row = startY; row < endY; row++) {
                    for (let col = startX; col < endX; col++) {
                        if (row !== y && col !== x && this.grid[row][col] === value) {
                            addInvalid(x, y)
                            addInvalid(col, row)
                        }
                    }
                }
            }
        }

        return invalidCells
    }

    /**
     * 检查指定格子是否与已填数字冲突
     * @param {number} row - 行号
     * @param {number} col - 列号
     * @returns {boolean} 冲突返回 true，否则返回 false
     */
    hasConflict(row, col) {
        const value = this.grid[row][col]
        if (value === 0) return false

        // 检查行
        for (let c = 0; c < 9; c++) {
            if (c !== col && this.grid[row][c] === value) return true
        }

        // 检查列
        for (let r = 0; r < 9; r++) {
            if (r !== row && this.grid[r][col] === value) return true
        }

        // 检查宫
        const boxStartRow = Math.floor(row / 3) * 3
        const boxStartCol = Math.floor(col / 3) * 3
        for (let r = boxStartRow; r < boxStartRow + 3; r++) {
            for (let c = boxStartCol; c < boxStartCol + 3; c++) {
                if ((r !== row || c !== col) && this.grid[r][c] === value) return true
            }
        }

        return false
    }

    /**
     * 检查局面是否已完成（全部填满且无冲突）
     * @returns {boolean} 完成返回 true，否则返回 false
     */
    isComplete() {
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (this.grid[row][col] === 0) return false
            }
        }
        return this.validate().length === 0
    }

    /**
     * 检查是否有冲突（用于探索模式失败检测）
     * @returns {boolean} 有冲突返回 true，否则返回 false
     */
    hasAnyConflict() {
        return this.validate().length > 0
    }

    /**
     * 检查是否有空格的候选数为空（死路检测）
     * 遍历所有空格，若任一空格没有任何候选数，则返回 true
     * @returns {boolean}
     */
    hasEmptyCandidate() {
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (this.grid[row][col] === 0) {
                    const candidates = this.getCandidates(row, col)
                    if (candidates.length === 0) {
                        return true
                    }
                }
            }
        }
        return false
    }

    /**
     * 克隆当前数独局面
     * @returns {Sudoku} 返回一个新的 Sudoku 对象
     */
    clone() {
        return new Sudoku(this.grid)
    }

    /**
     * 将当前局面序列化为 JSON 格式
     * @returns {Object} 返回包含 grid 数据的普通对象（深拷贝）
     */
    toJSON() {
        return { grid: this.getGrid() }
    }

    /**
     * 将当前局面转换为人类可读的文本字符串
     * @returns {string} 返回类似 "5 3 0 0 7 0 0 0 0\n..." 的字符串
     */
    toString() {
        return this.grid.map(row => row.join(' ')).join('\n')
    }

    /**
     * 静态方法：从 JSON 数据反序列化为 Sudoku 对象
     * @param {Object} json - 包含 grid 字段的对象
     * @returns {Sudoku} 返回新创建的 Sudoku 对象
     */
    static fromJSON(json) {
        return new Sudoku(json.grid)
    }

    /**
     * 获取候选数状态（防御性拷贝）
     * @returns {Object} 候选数状态的深拷贝
     */
    getCandidatesMap() {
        return JSON.parse(JSON.stringify(this.candidates || {}));
    }

    /**
     * 设置候选数状态
     * @param {Object} candidates - 候选数状态
     */
    setCandidates(candidates) {
        this.candidates = JSON.parse(JSON.stringify(candidates));
    }

    /**
     * 清空候选数状态
     */
    clearCandidates() {
        this.candidates = {};
    }
}

export default Sudoku

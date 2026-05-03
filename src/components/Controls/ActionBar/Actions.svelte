<script>
	import { hints } from '@sudoku/stores/hints';
	import { notes } from '@sudoku/stores/notes';
	import { gamePaused } from '@sudoku/stores/gamePaused';
	import { gameStore } from '@sudoku/stores/gameStore.js';
	import { cursor } from '@sudoku/stores/cursor';

	let feedbackMessage = '';
	let feedbackTimer = null;
	let hintHighlightCells = []; // 高亮显示的格子

	$: hintsAvailable = $hints > 0;
	$: isExploring = $gameStore.isExploring;
	$: hasSelection = $cursor.x !== null && $cursor.y !== null;

	/**
	 * 候选提示 - 显示当前选中格子的候选数
	 * 通过 domain 层的 Game.getCandidates() 获取候选数
	 */
	function handleCandidatesHint() {
		if (!hasSelection) {
			showFeedback('请先选择一个空格');
			return;
		}

		// cursor: x=列, y=行
		const row = $cursor.y;
		const col = $cursor.x;

		const game = gameStore.getGame();
		if (!game) {
			showFeedback('游戏未初始化');
			return;
		}

		// 通过 domain 层获取候选数
		const candidates = game.getCandidates(row, col);

		if (candidates.length === 0) {
			showFeedback('无候选数');
			return;
		}

		showFeedback(`候选数: ${candidates.join(', ')}`);
	}

	/**
	 * 下一步提示 - 找出一个可以唯一确定的空格和数字
	 * 根据作业要求：分析全盘后，找出已经可以唯一确定的那个空格和数字（推定数）
	 */
	function handleNextHint() {
		const game = gameStore.getGame();
		if (!game) {
			showFeedback('游戏未初始化');
			return;
		}

		const nextHints = game.getNextHint();

		if (!Array.isArray(nextHints) || nextHints.length === 0) {
			showFeedback('当前没有可确定的下一步');
			hintHighlightCells = [];
			return;
		}

		// 只取第一个推定数
		const nextHint = nextHints[0];
		hintHighlightCells = [{ row: nextHint.row, col: nextHint.col }];
		showFeedback(`下一步: 位置(${nextHint.row + 1}, ${nextHint.col + 1}) 填入 ${nextHint.value}`);
	}

	/**
	 * 直接填入答案（消耗提示次数）
	 */
	function handleAutoFillHint() {
		if (!hasSelection) {
			showFeedback('请先选择一个空格');
			return;
		}

		if (!hintsAvailable) {
			showFeedback('提示次数已用完');
			return;
		}

		// 获取 game 对象
		const game = gameStore.getGame();
		if (!game) {
			showFeedback('游戏未初始化');
			return;
		}

		// 获取当前格子的推定数
		const nextHints = game.getNextHint();
		if (!Array.isArray(nextHints)) {
			showFeedback('无法获取提示');
			return;
		}

		const selectedHint = nextHints.find(h => h.row === $cursor.y && h.col === $cursor.x);

		if (selectedHint) {
			// 当前位置是推定数，直接填入
			gameStore.guess({ row: selectedHint.row, col: selectedHint.col, value: selectedHint.value });
			hints.useHint();
			hintHighlightCells = [];
			showFeedback(`已填入 ${selectedHint.value}`);
		} else {
			// 尝试应用提示（可能填入求解器的答案）
			const success = gameStore.applyHint({ x: $cursor.x, y: $cursor.y });
			if (success) {
				hints.useHint();
				hintHighlightCells = [];
			} else {
				showFeedback('无法提供提示：当前局面无解');
			}
		}
	}

	function handleUndo() {
		gameStore.undo();
		hintHighlightCells = [];
	}

	function handleRedo() {
		gameStore.redo();
		hintHighlightCells = [];
	}

	function handleExplore() {
		hintHighlightCells = [];
		if (isExploring) {
			const result = gameStore.submitExplore();
			if (!result.success) {
				let message = '';
				switch (result.reason) {
					case 'incomplete':
						message = '数独尚未完成，请继续填写或点击X放弃探索';
						break;
					case 'conflict':
						message = '⚠ 探索失败：棋盘存在冲突（行/列/宫有重复数字），无法提交';
						break;
					case 'empty_candidate':
						message = '⚠ 探索失败：某个格子没有候选数了（死路），无法提交';
						break;
					case 'no_game':
						message = '游戏未初始化';
						break;
					default:
						message = '无法提交探索结果';
				}
				showFeedback(message);
			} else {
				showFeedback('探索结果已提交！');
			}
		} else {
			gameStore.enterExplore();
			// 进入探索模式后检查是否已是已知失败路径
			const status = gameStore.getExploreConflictStatus();
			if (status.knownFailed) {
				showFeedback('探索模式：此路径之前已验证会冲突，建议点击X后选择其他候选数重新探索');
			} else {
				showFeedback('探索模式：可自由尝试，完成后点击√提交，或点击X放弃');
			}
		}
	}

	function handleExitExplore() {
		if (isExploring) {
			gameStore.exitExplore();
			hintHighlightCells = [];
			showFeedback('已退出探索模式');
		}
	}

	function showFeedback(message) {
		if (feedbackTimer) clearTimeout(feedbackTimer);
		feedbackMessage = message;
		feedbackTimer = setTimeout(() => {
			feedbackMessage = '';
		}, 4000);
	}

	// 清除高亮当用户点击其他位置
	$: if ($cursor.x !== null || $cursor.y !== null) {
		// 用户移动了光标，检查是否不在高亮格子里
		const isHighlighted = hintHighlightCells.some(c => c.row === $cursor.y && c.col === $cursor.x);
		if (!isHighlighted) {
			hintHighlightCells = [];
		}
	}
</script>

<div class="action-buttons space-x-2">
	{#if feedbackMessage}
		<div class="feedback-toast" class:feedback-normal={!isExploring && !feedbackMessage.includes('候选') && !feedbackMessage.includes('推定') && !feedbackMessage.includes('已填入')} class:feedback-hint={feedbackMessage.includes('候选') || feedbackMessage.includes('推定') || feedbackMessage.includes('已填入')} class:feedback-explore={isExploring}>
			{feedbackMessage}
		</div>
	{/if}

	<button class="btn btn-round" disabled={$gamePaused || !isExploring} on:click={handleExitExplore} title="Exit Explore" class:hidden={!isExploring}>
		<svg class="icon-outline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
		</svg>
	</button>

	<button class="btn btn-round" disabled={$gamePaused || isExploring} on:click={handleUndo} title="Undo" class:hidden={isExploring}>
		<svg class="icon-outline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
		</svg>
	</button>

	<button class="btn btn-round" disabled={$gamePaused || isExploring} on:click={handleRedo} title="Redo" class:hidden={isExploring}>
		<svg class="icon-outline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
		</svg>
	</button>

	<!-- 候选提示按钮 -->
	<button class="btn btn-round btn-hint" disabled={$gamePaused || isExploring} on:click={handleCandidatesHint} title="候选提示 - 显示当前格子的候选数" class:hidden={isExploring}>
		<svg class="icon-outline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
		</svg>
		<span class="btn-label">候选</span>
	</button>

	<!-- 下一步提示按钮 -->
	<button class="btn btn-round btn-hint" disabled={$gamePaused || isExploring} on:click={handleNextHint} title="下一步提示 - 显示推定数位置" class:hidden={isExploring}>
		<svg class="icon-outline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
		</svg>
		<span class="btn-label">下一步</span>
	</button>

	<!-- 填入答案按钮 -->
	<button class="btn btn-round btn-badge btn-fill" disabled={$gamePaused || !hintsAvailable || isExploring} on:click={handleAutoFillHint} title="填入答案 - 消耗1次提示" class:hidden={isExploring}>
		<svg class="icon-outline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
		</svg>
		{#if $hints !== Infinity}
			<span class="badge" class:badge-primary={hintsAvailable}>{$hints}</span>
		{/if}
	</button>

	<button class="btn btn-round btn-badge" disabled={$gamePaused || isExploring} on:click={notes.toggle} title="Notes ({$notes ? 'ON' : 'OFF'})" class:hidden={isExploring}>
		<svg class="icon-outline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
		</svg>

		<span class="badge tracking-tighter" class:badge-primary={$notes}>{$notes ? 'ON' : 'OFF'}</span>
	</button>

	<!-- Explore Mode Button -->
	<button class="btn btn-round btn-badge" disabled={$gamePaused} on:click={handleExplore} title={isExploring ? 'Commit Exploration' : 'Explore Mode'} class:btn-explore={isExploring}>
		<svg class="icon-outline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			{#if isExploring}
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
			{:else}
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
			{/if}
		</svg>

		<span class="badge tracking-tighter" class:badge-primary={isExploring}>{isExploring ? 'GO' : 'EXP'}</span>
	</button>

</div>


<style>
	.action-buttons {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-evenly;
		align-self: flex-end;
	}

	.btn-badge {
		position: relative;
	}

	.badge {
		min-height: 20px;
		min-width:  20px;
		padding: 0.25rem;
		border-radius: 9999px;
		line-height: 1;
		text-align: center;
		font-size: 0.75rem;
		color: white;
		background-color: #4b5563;
		display: inline-block;
		position: absolute;
		top: 0;
		left: 0;
	}

	.badge-primary {
		background-color: #2979fa;
	}

	.btn-explore {
		background-color: #16a34a;
		color: white;
	}

	.btn-explore:hover {
		background-color: #15803d;
	}

	.feedback-toast {
		position: fixed;
		bottom: 120px;
		left: 50%;
		transform: translateX(-50%);
		padding: 0.75rem 1.5rem;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		font-weight: 500;
		z-index: 100;
		animation: fadeIn 0.3s ease;
		text-align: center;
		max-width: 90%;
	}

	.feedback-normal {
		background-color: #3b82f6;
		color: white;
	}

	.feedback-explore {
		background-color: #16a34a;
		color: white;
	}

	.feedback-hint {
		background-color: #8b5cf6;
		color: white;
	}

	.btn-hint {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 0.5rem;
		min-width: 48px;
		gap: 2px;
	}

	.btn-hint .icon-outline {
		width: 20px;
		height: 20px;
	}

	.btn-hint .btn-label {
		font-size: 0.6rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.btn-fill {
		background-color: #10b981;
		color: white;
	}

	.btn-fill:hover:not(:disabled) {
		background-color: #059669;
	}

	.btn-fill:disabled {
		background-color: #9ca3af;
		opacity: 0.6;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateX(-50%) translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateX(-50%) translateY(0);
		}
	}
</style>

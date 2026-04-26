<script>
	import { hints } from '@sudoku/stores/hints';
	import { notes } from '@sudoku/stores/notes';
	import { gamePaused } from '@sudoku/stores/gamePaused';
	import { gameStore } from '@sudoku/stores/gameStore.js';
	import { cursor } from '@sudoku/stores/cursor';

	$: hintsAvailable = $hints > 0;
	$: isExploring = $gameStore.isExploring;

	function handleHint() {
		if (hintsAvailable && $cursor.x !== null && $cursor.y !== null) {
			// 清除候选数
			gameStore.clearCellCandidates($cursor.x, $cursor.y);
			
			// 应用提示
			const success = gameStore.applyHint({ x: $cursor.x, y: $cursor.y });
			if (success) {
				hints.useHint();
			}
		}
	}

	function handleUndo() {
		gameStore.undo();
	}

	function handleRedo() {
		gameStore.redo();
	}

	function handleExplore() {
		if (isExploring) {
			// 提交探索
			gameStore.submitExplore();
		} else {
			// 进入探索模式
			gameStore.enterExplore();
		}
	}

	function handleExitExplore() {
		if (isExploring) {
			gameStore.exitExplore();
		}
	}
</script>

<div class="action-buttons space-x-3">

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

	<button class="btn btn-round btn-badge" disabled={$gamePaused || !hintsAvailable || isExploring} on:click={handleHint} title="Hints ({$hints})" class:hidden={isExploring}>
		<svg class="icon-outline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
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
</style>

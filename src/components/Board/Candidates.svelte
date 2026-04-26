<script>
	import { CANDIDATE_COORDS } from '@sudoku/constants';

	export let candidates = [];
</script>

<div class="candidate-grid">
	{#each CANDIDATE_COORDS as [row, col], index}
		<div class="candidate row-start-{row} col-start-{col}"
		     class:invisible={!candidates.includes(index + 1)}
		     class:visible={candidates.includes(index + 1)}>
			{index + 1}
		</div>
	{/each}
</div>

<style>
	.candidate-grid {
		display: grid;
		height: 100%;
		width: 100%;
		padding: 0.25rem;
	}

	.candidate {
		height: 100%;
		width: 100%;
		grid-row-end: auto;
		grid-column-end: auto;
		line-height: 100%;
	}
</style>
<script>
	import Timer from './Timer.svelte';
	import Actions from './Actions.svelte';
</script>

<div class="action-bar space-y-3 xs:space-y-0">
	<Timer />

	<Actions />
</div>

<style>
	.action-bar {
		display: flex;
		flex-direction: column;
		flex-wrap: wrap;
		justify-content: space-between;
		padding-bottom: 1.25rem;
	}

	@media (min-width: 300px) {
		.action-bar {
			flex-direction: row;
		}
	}
</style>
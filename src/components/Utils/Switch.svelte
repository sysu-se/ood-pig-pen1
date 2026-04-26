<script>
	export let id = '';
	export let text = '';
	export let checked = false;
	export let disabled = false;
</script>

<label for="{id}" class="inline-flex items-center">
	<span class="flex-grow cursor-pointer text-lg">{text}</span>

	<span class="switch">
		<input {id} name="{id}" type="checkbox" class="sr-only" {disabled} bind:checked />
		<span class="track"></span>
		<span class="thumb"></span>
	</span>
</label>

<style>
	.switch {
		display: inline-block;
		position: relative;
		vertical-align: middle;
		cursor: pointer;
		user-select: none;
		background-color: transparent;
	}

	.track {
		display: block;
		width: 3rem;
		height: 1.5rem;
		background-color: #4b5563;
		border-radius: 9999px;
		box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.06);
	}

	.thumb {
		display: block;
		transition: all 0.3s ease-in-out;
		position: absolute;
		top: 0;
		left: 0;
		width: 1.5rem;
		height: 1.5rem;
		background-color: white;
		border: 2px solid #4b5563;
		border-radius: 9999px;
	}

	input[type='checkbox']:checked ~ .thumb {
		transform: translateX(1.5rem);
		border-color: #2979fa;
	}

	input[type='checkbox']:checked ~ .track {
		transition: background-color 0.3s;
		background-color: #2979fa;
	}

	input[type='checkbox']:disabled ~ .track {
		background-color: #9ca3af;
	}

	input[type='checkbox']:disabled ~ .thumb {
		background-color: #f3f4f6;
		border-color: #9ca3af;
	}

	input[type='checkbox']:focus + .track,
	input[type='checkbox']:active + .track {
		outline: none;
		box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.5);
	}
</style>
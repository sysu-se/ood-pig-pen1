<script>
	import { onMount } from 'svelte';
	import { validateSencode } from '@sudoku/sencode';
	import { gameStore } from '@sudoku/stores/gameStore.js';
	import { modal } from '@sudoku/stores/modal';
	import { gamePaused } from '@sudoku/stores/gamePaused';
	import Board from './components/Board/index.svelte';
	import Controls from './components/Controls/index.svelte';
	import Header from './components/Header/index.svelte';
	import Modal from './components/Modal/index.svelte';

	// 监听游戏胜利状态
	gameStore.won.subscribe(won => {
		if (won) {
			gamePaused.set(true);
			modal.show('gameover');
		}
	});

	onMount(() => {
		// 从 URL hash 获取 sencode
		let hash = location.hash;

		if (hash.startsWith('#')) {
			hash = hash.slice(1);
		}

		// 启动游戏
		if (validateSencode(hash)) {
			// 使用自定义 sencode 启动
			gameStore.startCustom(hash);
		} else {
			// 生成新游戏
			gameStore.startNew('easy');
		}

		// 显示欢迎弹窗
		modal.show('welcome', {
			onHide: () => {
				gamePaused.set(false);
			},
			sencode: validateSencode(hash) ? hash : null
		});
	});
</script>

<!-- Timer, Menu, etc. -->
<header>
	<Header />
</header>

<!-- Sudoku Field -->
<section>
	<Board />
</section>

<!-- Keyboard -->
<footer>
	<Controls />
</footer>

<Modal />

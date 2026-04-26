const fs = require('fs');
const reaver = require('reaver');

function throwIfError(err) {
	if (err) throw err;
}

function replaceInBuffer(buf, a, b) {
	if (!Buffer.isBuffer(buf)) buf = Buffer.from(buf);
	const idx = buf.indexOf(a);
	if (idx === -1) return buf;
	if (!Buffer.isBuffer(b)) b = Buffer.from(b);

	const before = buf.slice(0, idx);
	const after = replaceInBuffer(buf.slice(idx + a.length), a, b);
	const len = idx + b.length + after.length;
	return Buffer.concat([before, b, after], len);
}

// 检查 critical.css 是否存在
const criticalCssExists = fs.existsSync('./dist/critical.css');
const bundleCssExists = fs.existsSync('./dist/bundle.css');

if (criticalCssExists) {
	// 如果存在 critical.css，进行内联处理
	const inlineCriticalCss = require('inline-critical');

	fs.readFile('./src/template.html', (err, templateHtml) => {
		throwIfError(err);

		fs.readFile('./dist/critical.css', (err, criticalCss) => {
			throwIfError(err);

			// Inline the CSS into the template HTML
			const inlinedHtml = inlineCriticalCss(templateHtml, criticalCss, {
				basePath: 'dist',
				extract:  true,
				noscript: 'head',
			});

			// Remove redundant css
			fs.unlink('./dist/critical.css', throwIfError);
			if (bundleCssExists) {
				fs.unlink('./dist/bundle.css', throwIfError);
			}

			// Read bundle.js
			fs.readFile('./dist/bundle.js', (err, bundleJs) => {
				throwIfError(err);

				// Calculate file hash and get filename
				const hashedBundleName = reaver.rev('bundle.js', bundleJs);

				// Replace bundle.js filename in HTML
				const outputHtml = replaceInBuffer(inlinedHtml, 'bundle.js', hashedBundleName);

				// Write final HTML
				fs.writeFile('./dist/index.html', outputHtml, throwIfError);

				// Rename bundle.js
				fs.rename('./dist/bundle.js', './dist/' + hashedBundleName, throwIfError);
			});
		});
	});
} else {
	// 如果不存在 critical.css，只处理 bundle.js
	console.log('No critical.css found, skipping CSS inlining...');

	// Read bundle.js
	fs.readFile('./dist/bundle.js', (err, bundleJs) => {
		throwIfError(err);

		// Calculate file hash
		const hashedBundleName = reaver.rev('bundle.js', bundleJs);

		// Read template
		fs.readFile('./src/template.html', (err, templateHtml) => {
			throwIfError(err);

			// Replace bundle.js filename in HTML
			const outputHtml = replaceInBuffer(templateHtml, 'bundle.js', hashedBundleName);

			// Write final HTML
			fs.writeFile('./dist/index.html', outputHtml, throwIfError);

			// Rename bundle.js
			fs.rename('./dist/bundle.js', './dist/' + hashedBundleName, throwIfError);

			// Keep bundle.css - it contains Svelte component styles
			// Don't delete it

			console.log('Build completed successfully!');
		});
	});
}

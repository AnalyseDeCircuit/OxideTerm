/* eslint-disable no-console */

const cp = require('child_process');

function exec(cmd) {
  return cp.execSync(cmd, {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 200,
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

function parseKey(key) {
  // Example key: "adler2 2.0.1 registry+https://github.com/rust-lang/crates.io-index"
  const parts = String(key).split(' ');
  const name = parts[0] || key;
  const version = parts[1] || '';
  const source = parts.slice(2).join(' ');
  return { name, version, source };
}

function isCopyleft(licenseId) {
  return /^(A?GPL|LGPL)(-|$)/i.test(String(licenseId));
}

function isPermissive(licenseId) {
  const l = String(licenseId);
  return (
    l === 'MIT' ||
    l === 'Apache-2.0' ||
    l === 'BSD-2-Clause' ||
    l === 'BSD-3-Clause' ||
    l === 'BSD-1-Clause' ||
    l === 'ISC' ||
    l === '0BSD' ||
    l === 'MIT-0' ||
    l === 'Zlib' ||
    l === 'Unlicense' ||
    l === 'CC0-1.0'
  );
}

// Explicit review/whitelist for crates that *mention* copyleft in a multi-license set.
// Key format: "name@version".
const reviewedMultiLicensed = new Map([
  ['r-efi@5.3.0', 'Multi-licensed; we choose MIT/Apache-2.0 option']
]);

function main() {
  const raw = exec('cargo deny list -f json -l crate');
  const data = JSON.parse(raw);

  const strictCopyleft = [];
  const needsReview = [];

  for (const [key, value] of Object.entries(data)) {
    const meta = parseKey(key);
    const licenses = Array.isArray(value.licenses) ? value.licenses : [];

    const hasCopyleft = licenses.some(isCopyleft);
    if (!hasCopyleft) continue;

    const hasPermissive = licenses.some(isPermissive);
    const id = `${meta.name}@${meta.version}`;

    if (!hasPermissive) {
      strictCopyleft.push({ ...meta, licenses });
      continue;
    }

    if (!reviewedMultiLicensed.has(id)) {
      needsReview.push({ ...meta, licenses });
    }
  }

  if (strictCopyleft.length || needsReview.length) {
    console.error('License policy check failed.');

    if (strictCopyleft.length) {
      console.error('\nCopyleft licenses detected (no permissive option found):');
      for (const c of strictCopyleft.sort((a, b) => a.name.localeCompare(b.name))) {
        console.error(`- ${c.name}@${c.version}: ${c.licenses.join(', ')} (${c.source})`);
      }
    }

    if (needsReview.length) {
      console.error('\nCopyleft mentioned alongside permissive options, but not whitelisted (needs explicit review):');
      for (const c of needsReview.sort((a, b) => a.name.localeCompare(b.name))) {
        console.error(`- ${c.name}@${c.version}: ${c.licenses.join(', ')} (${c.source})`);
      }
      console.error('\nTo accept a reviewed multi-licensed crate, add it to reviewedMultiLicensed in:');
      console.error('src-tauri/scripts/check-license-policy.cjs');
    }

    process.exit(1);
  }

  console.log('License policy check ok (no unreviewed copyleft licenses detected).');
}

main();

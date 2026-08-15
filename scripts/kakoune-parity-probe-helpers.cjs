function parseParityProgress(markdown) {
  const lines = markdown.split(/\r?\n/);
  const supported = [];
  const red = [];
  let section = null;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === "## Verified Supported") {
      section = "supported";
      continue;
    }

    if (trimmed === "## Still Red") {
      section = "red";
      continue;
    }

    if (trimmed.startsWith("## ")) {
      section = null;
      continue;
    }

    if (!trimmed.startsWith("- ")) {
      continue;
    }

    if (section === "supported") {
      supported.push(trimmed.slice(2).trim());
    } else if (section === "red") {
      red.push(trimmed.slice(2).trim());
    }
  }

  return { supported, red };
}

function renderParityProgress(progress) {
  return [
    "# Kakoune Parity Progress",
    "",
    "## Verified Supported",
    ...progress.supported.map(name => `- ${name}`),
    "",
    "## Still Red",
    ...progress.red.map(name => `- ${name}`),
    ""
  ].join("\n");
}

function selectNextProbeFixture(progress) {
  const supported = new Set(progress.supported);

  for (const name of progress.red) {
    if (!supported.has(name)) {
      return name;
    }
  }

  return undefined;
}

function promoteParityFixture(progress, fixtureName) {
  const supported = progress.supported.includes(fixtureName)
    ? [...progress.supported]
    : [...progress.supported, fixtureName];
  const red = progress.red.filter(name => name !== fixtureName);

  return { supported, red };
}

async function findPromotableFixture(progress, probe) {
  for (const name of progress.red) {
    if (progress.supported.includes(name)) {
      continue;
    }

    if (await probe(name)) {
      return name;
    }
  }

  return undefined;
}

module.exports = {
  parseParityProgress,
  renderParityProgress,
  selectNextProbeFixture,
  promoteParityFixture,
  findPromotableFixture
};

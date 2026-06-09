// Merges new config lines into existing config.
// Lines are key=value pairs. New keys override existing ones, other existing keys are preserved.
export function mergeConfigContent(existingContent, newContent) {
    const existingLines = (existingContent || "").split('\n').filter(l => l.trim());
    const newLines = (newContent || "").split('\n').filter(l => l.trim());

    const newKeys = new Set();
    for (const line of newLines) {
        const eq = line.indexOf('=');
        if (eq > 0) newKeys.add(line.substring(0, eq).trim());
    }

    const kept = existingLines.filter(line => {
        const eq = line.indexOf('=');
        if (eq <= 0) return true;
        return !newKeys.has(line.substring(0, eq).trim());
    });

    return [...kept, ...newLines].join('\n');
}

/**
 * Smart Search Logic for UI Checker
 * Separated for testability.
 */

const utilityPrefixes = ['p-', 'm-', 'w-', 'h-', 'text-', 'bg-', 'flex', 'grid', 'border-', 'rounded-', 'md:', 'lg:', 'sm:', 'hover:', 'focus:', 'gap-', 'top-', 'left-', 'right-', 'bottom-'];

function calculateScore(fullSelector, fileContent, isActiveFile = false, options = {}) {
    const isTailwind = options.isTailwind !== false; // Default to pattern matching if not specified

    const parts = fullSelector.split(/(?=[.#])/);
    const classes = parts.filter(p => p.startsWith('.')).map(p => p.substring(1));
    const id = parts.find(p => p.startsWith('#'))?.substring(1);

    // If Tailwind is active, we aggressively filter classes that match utility patterns
    const uniqueClasses = isTailwind 
        ? classes.filter(c => !utilityPrefixes.some(pref => c.startsWith(pref)))
        : classes;
    
    let score = 0;
    let firstMatchLine = -1;

    // 1. ID Match (Highest Priority)
    if (id && fileContent.includes(id)) {
        score += 100;
        const lines = fileContent.split('\n');
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(id)) {
                firstMatchLine = i + 1;
                break;
            }
        }
    }

    // 2. Class Matches
    let matchedClasses = 0;
    classes.forEach(c => {
        if (fileContent.includes(c)) {
            matchedClasses++;
            if (firstMatchLine === -1) {
                const lines = fileContent.split('\n');
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].includes(c)) {
                        firstMatchLine = i + 1;
                        break;
                    }
                }
            }
        }
    });

    if (matchedClasses > 0) {
        // Points for number of matched classes
        score += (matchedClasses * 10);
        
        // Bonus for matching "Unique" (non-utility) classes
        uniqueClasses.forEach(c => {
            if (fileContent.includes(c)) score += 20;
        });
    }

    // 3. Active File Bonus
    if (score > 0 && isActiveFile) {
        score += 50;
    }

    // 4. Source File Bonus (New: Prioritize React/Vue/Svelte components)
    const sourceExtensions = ['.tsx', '.jsx', '.vue', '.svelte'];
    const isSourceFile = sourceExtensions.some(ext => options.fileName?.endsWith(ext));
    if (score > 0 && isSourceFile) {
        score += 30;
    }

    return { score, line: firstMatchLine };
}

module.exports = { calculateScore };

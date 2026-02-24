const text = `{"answers":[{"q":1,"a":["C"]},{"q":2,"a":["D"]},{"q":3,"a":["D"]},{"q":4,"a":["B"]},{"q":5,"a":["C"]},{"q":6,"a":["C"]},{"q":7,"a":["C"]},{"q":8,"a":["B","D"]},{"q":9,"a":["A","D"]},{"q":10,"a":["A","B","C"]}]}`;

function parseChatGPTResponse(text) {
    // 1. Extract using brace balancing
    const candidates = [];
    let depth = 0, start = -1;
    for (let i = 0; i < text.length; i++) {
        if (text[i] === '{') {
            if (depth === 0) start = i;
            depth++;
        } else if (text[i] === '}') {
            if (depth > 0) {
                depth--;
                if (depth === 0 && start !== -1) {
                    candidates.push(text.slice(start, i + 1));
                    start = -1;
                }
            }
        }
    }
    console.log("CANDIDATES:", candidates);
    for (const candidate of candidates.reverse()) {
        try {
            const p = JSON.parse(candidate);
            if (Array.isArray(p.answers) && p.answers.length) return p.answers;
        } catch (e) {
            console.log("Failed candidate:", candidate, e.message);
        }
    }
    return [];
}

console.log("FINAL EXTRACTED:", parseChatGPTResponse(text).length);

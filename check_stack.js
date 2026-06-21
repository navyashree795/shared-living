const fs = require('fs');
const code = fs.readFileSync('src/screens/DashboardScreen.tsx', 'utf8');
const stack = [];
const lines = code.split('\n');

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  for (let j = 0; j < line.length; j++) {
    const char = line[j];
    if (char === '{' || char === '(' || char === '[') {
      stack.push({ char, line: i + 1, col: j + 1 });
    } else if (char === '}' || char === ')' || char === ']') {
      const last = stack[stack.length - 1];
      if (
        (char === '}' && last && last.char === '{') ||
        (char === ')' && last && last.char === '(') ||
        (char === ']' && last && last.char === '[')
      ) {
        stack.pop();
      } else {
        // ignore mismatched in strings, but since we don't have a real parser this might be noisy
      }
    }
  }
}
console.log(stack.slice(-5));

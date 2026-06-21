const fs = require('fs');
const code = fs.readFileSync('src/screens/DashboardScreen.tsx', 'utf8');
let openBraces = 0;
let openParens = 0;
const lines = code.split('\n');

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  for (let j = 0; j < line.length; j++) {
    if (line[j] === '{') openBraces++;
    if (line[j] === '}') openBraces--;
    if (line[j] === '(') openParens++;
    if (line[j] === ')') openParens--;
  }
  if (openBraces < 0) {
    console.log(`Negative braces at line ${i + 1}`);
  }
}
console.log(`Final braces: ${openBraces}, Final parens: ${openParens}`);

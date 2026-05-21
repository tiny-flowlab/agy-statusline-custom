const fs = require('fs');
const path = require('path');

let inputData = '';
process.stdin.setEncoding('utf8');

process.stdin.on('data', chunk => {
  inputData += chunk;
});

process.stdin.on('end', () => {
  fs.writeFileSync(path.join(__dirname, 'stdin.log'), inputData, 'utf8');
  fs.writeFileSync(path.join(__dirname, 'env.log'), JSON.stringify(process.env, null, 2), 'utf8');
  console.log("Status: OK | Input & Env Logged");
});

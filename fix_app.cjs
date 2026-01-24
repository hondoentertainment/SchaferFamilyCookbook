const fs = require('fs');
const path = 'c:\\Users\\kyle\\Downloads\\SchaferFamilyCookbook\\src\\App.tsx';
let content = fs.readFileSync(path, 'utf8');

// Replace all <Header ... /> with <Header ... onLogout={handleLogout} />
// only if onLogout is not present
content = content.replace(/<Header(.*?)\s?\/>/g, (match, p1) => {
    if (p1.includes('onLogout')) return match;
    return `<Header${p1} onLogout={handleLogout} />`;
});

fs.writeFileSync(path, content);
console.log('Successfully updated App.tsx');

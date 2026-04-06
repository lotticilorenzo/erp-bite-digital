const fs = require('fs');
const path = require('path');
const hooksDir = 'c:/Users/lotti/Desktop/erp-bite-digital/frontend/src/hooks';
const files = fs.readdirSync(hooksDir).filter(f => f.endsWith('.ts'));

files.forEach(f => {
  const filePath = path.join(hooksDir, f);
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  if (f === 'useTasks.ts') {
    content = content.replace(/onSuccess:\s*\(\)\s*=>\s*queryClient\.invalidateQueries\(\{\s*queryKey:\s*\["studio-tasks"\]\s*\}\)/g, 
      `onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studio-tasks"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["tasks"], exact: false });
    }`);
    changed = true;
  } else {
    const regex = /queryClient\.invalidateQueries\(\{\s*queryKey:\s*(\[[^\]]+\])\s*\}\)/g;
    if (regex.test(content)) {
        content = content.replace(regex, 'queryClient.invalidateQueries({ queryKey: $1, exact: false })');
        changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log('Updated ' + f);
  }
});

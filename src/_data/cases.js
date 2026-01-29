const fs = require('fs');
const path = require('path');

module.exports = function() {
  // Point to src/cases relative to src/_data/
  const casesDir = path.join(__dirname, '../cases');
  const casesData = {};

  if (!fs.existsSync(casesDir)) {
    return {};
  }

  // Get all subdirectories (which correspond to block IDs)
  const blockDirs = fs.readdirSync(casesDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  blockDirs.forEach(blockId => {
    const blockPath = path.join(casesDir, blockId);
    const files = fs.readdirSync(blockPath)
      .filter(file => file.endsWith('.html') || file.endsWith('.ts'))
      .sort(); // Alphabetic sort ensures 01, 02, 03 order

    casesData[blockId] = files.map(file => {
      const content = fs.readFileSync(path.join(blockPath, file), 'utf8');
      
      // Naive parser to extract metadata from the header comment
      // Looks for the first <!-- ... --> block
      const match = content.match(/^\s*<!--([\s\S]*?)-->/);
      let title = file;
      let description = '';
      
      if (match) {
        const commentContent = match[1];
        const lines = commentContent.split('\n')
          .map(l => l.trim())
          .filter(l => l.length > 0);
        
        // Find the line starting with "WEB CASE"
        const titleIndex = lines.findIndex(l => l.toUpperCase().includes('WEB CASE'));
        
        if (titleIndex !== -1) {
            // Extract Title part: "WEB CASE 1: The Title" -> "The Title"
            const titleLine = lines[titleIndex];
            title = titleLine.replace(/^WEB CASE \d+:\s*/i, '').trim();
            
            // The rest is description
            description = lines.slice(titleIndex + 1).join(' ');
        }
      }

      return {
        id: file,
        title,
        description,
        code: content.trim()
      };
    });
  });

  return casesData;
};

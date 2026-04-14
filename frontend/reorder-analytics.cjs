const fs = require('fs');
const content = fs.readFileSync('src/pages/Analytics.tsx', 'utf8');

const normContent = content.replace(/\r\n/g, '\n');

const s1 = normContent.split('      {/* Andamento Fatturato */}');
const topPart = s1[0];

const s2 = s1[1].split('      {/* Previsioni Business (Forecast) */}');
const trendStoriciTitleBlock = '      {/* Andamento Fatturato */}' + s2[0];

const s3 = s2[1].split('      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-12">');
const forecastBlock = '      {/* Previsioni Business (Forecast) */}' + s3[0];

const s4 = s3[1].split('      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">\n        {/* Table Redditività Clienti */}');
const chartsBlock = '      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-12">' + s4[0];

const s5 = s4[1].split('      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">\n        {/* Top Clients */}');
const tablesBlock = '      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">\n        {/* Table Redditività Clienti */}' + s5[0];
const top5Block = '      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">\n        {/* Top Clients */}' + s5[1];

// New Order:
// 1. topPart (includes Cash Flow)
// 2. trendStoriciTitleBlock
// 3. chartsBlock (Andamento/Margine)
// 4. tablesBlock (Redditivita)
// 5. top5Block (Top Clienti / Efficienza) - wait, top5Block ends the file?
// Actually top5Block contains the end of the file. So we need to insert forecastBlock BEFORE the end of the file.

const top5AndEnd = top5Block.split('    </div>\n  );\n}');
const realTop5Block = top5AndEnd[0];

const newContent = topPart + 
  trendStoriciTitleBlock + 
  chartsBlock + 
  tablesBlock + 
  realTop5Block + 
  forecastBlock + 
  '    </div>\n  );\n}';

fs.writeFileSync('src/pages/Analytics.tsx', newContent.replace(/\n/g, '\r\n'));
console.log('Done reordering Analytics!');

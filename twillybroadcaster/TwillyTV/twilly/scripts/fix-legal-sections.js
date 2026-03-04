const fs = require('fs');
const path = require('path');

// Function to add section tags to a legal page
function addSectionTags(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Find all h2 tags and wrap them in sections
  const h2Regex = /<h2>(\d+)\.\s*(.*?)<\/h2>/g;
  let match;
  let sections = [];
  
  while ((match = h2Regex.exec(content)) !== null) {
    const number = match[1];
    const title = match[2];
    const sectionId = title.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-');
    
    sections.push({
      number,
      title,
      sectionId,
      fullMatch: match[0],
      index: match.index
    });
  }
  
  // Sort sections by their position in the file
  sections.sort((a, b) => a.index - b.index);
  
  // Replace each h2 with a section
  let lastIndex = 0;
  let newContent = '';
  
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const beforeH2 = content.substring(lastIndex, section.index);
    
    // Find the end of this section (next h2 or end of content)
    let sectionEnd;
    if (i < sections.length - 1) {
      sectionEnd = sections[i + 1].index;
    } else {
      sectionEnd = content.length;
    }
    
    const sectionContent = content.substring(section.index, sectionEnd);
    
    // Replace the h2 with a section
    const newSection = `<section id="${section.sectionId}">\n${sectionContent}\n</section>`;
    
    newContent += beforeH2 + newSection;
    lastIndex = sectionEnd;
  }
  
  // Add any remaining content after the last section
  if (lastIndex < content.length) {
    newContent += content.substring(lastIndex);
  }
  
  fs.writeFileSync(filePath, newContent);
  console.log(`✅ Fixed sections in ${path.basename(filePath)}`);
}

// Legal pages to fix
const legalPages = [
  'pages/legal/privacy-policy.vue',
  'pages/legal/community-guidelines.vue',
  'pages/legal/copyright-policy.vue',
  'pages/legal/creator-terms.vue',
  'pages/legal/refund-policy.vue'
];

console.log('🔧 Adding section tags to legal pages...');

legalPages.forEach(pagePath => {
  if (fs.existsSync(pagePath)) {
    addSectionTags(pagePath);
  } else {
    console.log(`❌ File not found: ${pagePath}`);
  }
});

console.log('✅ All legal pages updated!'); 
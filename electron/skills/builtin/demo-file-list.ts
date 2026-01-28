// electron/skills/builtin/demo-file-list.ts
// Demonstration of listing files in the specified directory

import { skill as fileOperationsSkill } from './file-operations.skill';

async function demonstrateFileOperations() {
  console.log('🔍 Demonstrating File Operations Skill');
  console.log('=====================================\n');
  
  const targetDirectory = 'd:\\03.local\\ngversion\\ng22\\electron\\skills\\builtin';
  
  try {
    // Demo 1: List all files and directories with stats
    console.log('📁 Listing all items in the builtin skills directory:');
    console.log(`Directory: ${targetDirectory}\n`);
    
    const result = await fileOperationsSkill.execute({
      directory: targetDirectory,
      operation: 'list',
      includeStats: true,
      includeHidden: false
    });
    
    if (result.error) {
      console.error('❌ Error:', result.error);
      return;
    }
    
    console.log(`📊 Summary:`);
    console.log(`   Total Files: ${result.summary.totalFiles}`);
    console.log(`   Total Directories: ${result.summary.totalDirectories}`);
    console.log(`   Total Size: ${result.summary.totalSizeFormatted}`);
    console.log(`   File Types:`, result.summary.fileTypes);
    console.log('');
    
    console.log('📋 Items:');
    result.items.forEach((item: any, index: number) => {
      const icon = item.type === 'directory' ? '📁' : '📄';
      const size = item.stats?.sizeFormatted ? ` (${item.stats.sizeFormatted})` : '';
      const modified = item.stats?.modified ? ` - Modified: ${new Date(item.stats.modified).toLocaleDateString()}` : '';
      
      console.log(`   ${index + 1}. ${icon} ${item.name}${size}${modified}`);
    });
    
    // Demo 2: List only TypeScript skill files
    console.log('\n🎯 Filtering for TypeScript skill files:');
    
    const skillFiles = await fileOperationsSkill.execute({
      directory: targetDirectory,
      operation: 'listFiles',
      extensions: ['.ts'],
      includeStats: true
    });
    
    if (!skillFiles.error) {
      const actualSkillFiles = skillFiles.items.filter((item: any) => 
        item.name.endsWith('.skill.ts')
      );
      
      console.log(`\n📝 Found ${actualSkillFiles.length} skill files:`);
      actualSkillFiles.forEach((item: any, index: number) => {
        console.log(`   ${index + 1}. ${item.name} (${item.stats?.sizeFormatted || 'unknown size'})`);
      });
    }
    
    console.log('\n✅ File operations demonstration completed successfully!');
    
  } catch (error) {
    console.error('❌ Demonstration failed:', error);
  }
}

// Export for use in other modules
export { demonstrateFileOperations };

// Run demonstration if this file is executed directly
if (require.main === module) {
  demonstrateFileOperations();
}
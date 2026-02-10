import { MarkdownSkillLoader } from './loader';
import * as path from 'path';

async function testMarkdownLoader() {
  console.log('Testing Markdown Skill Loader...');
  
  // 1. Test loading a single file
  const helloSkillPath = path.join(__dirname, '../custom/hello-markdown.md');
  console.log(`\nLoading skill from: ${helloSkillPath}`);
  
  const skill = MarkdownSkillLoader.loadSkill(helloSkillPath);
  
  if (skill) {
    console.log('✅ Skill loaded successfully:');
    console.log(`- Name: ${skill.name}`);
    console.log(`- Description: ${skill.description}`);
    console.log(`- Parameters:`, skill.parameters);
    
    // 2. Test execution
    console.log('\nExecuting skill...');
    try {
      const result = await skill.execute({ name: 'NgNest User' });
      console.log('✅ Execution Result:', result);
    } catch (error) {
      console.error('❌ Execution failed:', error);
    }
  } else {
    console.error('❌ Failed to load skill');
  }

  // 3. Test loading from directory
  const customDir = path.join(__dirname, '../custom');
  console.log(`\nLoading skills from directory: ${customDir}`);
  const skills = MarkdownSkillLoader.loadSkillsFromDir(customDir);
  console.log(`Found ${skills.length} skills in directory.`);
  skills.forEach(s => console.log(`- ${s.name}`));
}

if (require.main === module) {
  testMarkdownLoader();
}

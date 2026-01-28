// electron/skills/builtin/test-loader.ts
// Simple test script to verify skill loading works correctly

import { loadBuiltinSkills, getBuiltinSkillNames } from './index';

async function testSkillLoader() {
  console.log('Testing skill loader...');
  
  try {
    // Test loading skill names
    const skillNames = await getBuiltinSkillNames();
    console.log('Available skill names:', skillNames);
    
    // Test loading full skills
    const skills = await loadBuiltinSkills();
    console.log(`Loaded ${skills.length} skills:`);
    
    for (const skill of skills) {
      console.log(`- ${skill.name}: ${skill.description}`);
      
      // Test basic skill execution (only for skills that don't require parameters)
      if (skill.name === 'get_time') {
        try {
          const result = await skill.execute({});
          console.log(`  Test result:`, result);
        } catch (error) {
          console.error(`  Test failed:`, error);
        }
      }
    }
    
    console.log('Skill loader test completed successfully!');
  } catch (error) {
    console.error('Skill loader test failed:', error);
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testSkillLoader();
}

export { testSkillLoader };
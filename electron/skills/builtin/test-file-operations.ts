// electron/skills/builtin/test-file-operations.ts
// Test script for the file operations skill

import { skill } from './file-operations.skill';

async function testFileOperations() {
  console.log('Testing file operations skill...');
  
  // Use current directory for testing instead of hardcoded path
  const testDirectory = __dirname;
  console.log(`Test directory: ${testDirectory}`);
  
  try {
    // Test 1: Basic directory listing
    console.log('\n=== Test 1: Basic directory listing ===');
    const result1 = await skill.execute({
      directory: testDirectory,
      operation: 'list',
      includeStats: true
    });
    
    if (result1.error) {
      console.error('Error:', result1.error);
    } else {
      console.log(`Found ${result1.items.length} items in ${result1.directory}`);
      console.log('Summary:', result1.summary);
      
      // Show first few items
      result1.items.slice(0, 5).forEach((item: any) => {
        console.log(`- ${item.name} (${item.type})`);
      });
    }
    
    // Test 2: List only TypeScript files
    console.log('\n=== Test 2: List only TypeScript files ===');
    const result2 = await skill.execute({
      directory: testDirectory,
      operation: 'listFiles',
      extensions: ['.ts'],
      includeStats: true
    });
    
    if (result2.error) {
      console.error('Error:', result2.error);
    } else {
      console.log(`Found ${result2.items.length} TypeScript files`);
      result2.items.forEach((item: any) => {
        console.log(`- ${item.name} (${item.stats?.sizeFormatted || 'unknown size'})`);
      });
    }
    
    // Test 3: List directories only
    console.log('\n=== Test 3: List directories only ===');
    const result3 = await skill.execute({
      directory: testDirectory,
      operation: 'listDirectories'
    });
    
    if (result3.error) {
      console.error('Error:', result3.error);
    } else {
      console.log(`Found ${result3.items.length} directories`);
      result3.items.forEach((item: any) => {
        console.log(`- ${item.name}/`);
      });
    }

    // Test 4: Security Check (Access denied)
    console.log('\n=== Test 4: Security Check (Access denied) ===');
    const parentDir = '..'; // Try to access parent directory
    const result4 = await skill.execute({
      directory: parentDir,
      operation: 'list'
    }, {
      workspace: testDirectory // Set workspace context to restrict access
    });

    if (result4.error) {
      console.log('✅ Security check passed: Access denied as expected.');
      console.log('Error message:', result4.error);
    } else {
      console.error('❌ Security check FAILED: Should have denied access to parent directory!');
    }
    
    console.log('\n✅ File operations test completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testFileOperations();
}

export { testFileOperations };

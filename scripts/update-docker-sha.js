#!/usr/bin/env node

/**
 * Auto-update docker-compose.yml with current commit SHA
 * Run this script after making changes to ensure deployment uses the correct image
 */

const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DOCKER_COMPOSE_PATH = path.join(ROOT, 'docker-compose.yml');

try {
  // Get current commit SHA
  const sha = execSync('git log -1 --format="%H"', { encoding: 'utf8' }).trim();
  console.log(`Current commit SHA: ${sha}`);

  // Read docker-compose.yml
  let content = fs.readFileSync(DOCKER_COMPOSE_PATH, 'utf8');
  
  // Update image tag
  const imageRegex = /(image:\s*ghcr\.io\/altvk88\/n8n-ver-web:)[a-f0-9]{40}/;
  const newContent = content.replace(imageRegex, `$1${sha}`);
  
  if (content === newContent) {
    console.log('✓ docker-compose.yml already has the correct SHA');
    process.exit(0);
  }
  
  // Write updated content
  fs.writeFileSync(DOCKER_COMPOSE_PATH, newContent, 'utf8');
  console.log('✓ Updated docker-compose.yml with new SHA');
  
  // Stage the file
  execSync('git add docker-compose.yml', { cwd: ROOT });
  console.log('✓ Staged docker-compose.yml');
  
  // Create commit
  execSync(`git commit -m "Update image tag to ${sha.slice(0, 7)}"`, { cwd: ROOT });
  console.log('✓ Created commit');
  
  // Push to remote
  execSync('git push', { cwd: ROOT });
  console.log('✓ Pushed to remote');
  
  console.log('\n🎉 Docker SHA updated successfully!');
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}

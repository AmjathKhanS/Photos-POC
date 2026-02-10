#!/usr/bin/env node
/**
 * Manually trigger indexing to extract GPS data
 */

async function triggerIndexing() {
  try {
    console.log('🚀 Triggering indexing...\n');

    const response = await fetch('http://localhost:3002/api/indexing/resume', {
      method: 'POST'
    });

    const data = await response.json();
    console.log('Response:', data);

    // Check status
    console.log('\nChecking indexing status...');
    const statusResponse = await fetch('http://localhost:3002/api/indexing/status');
    const status = await statusResponse.json();

    console.log('\nIndexing Status:');
    console.log('  Running:', status.isRunning);
    console.log('  Progress:', status.progress || 0, '%');
    console.log('  Processed:', status.processed || 0);
    console.log('  Total:', status.total || 0);

    if (status.isRunning) {
      console.log('\n✅ Indexing is now running!');
      console.log('   Watch the server logs for GPS extraction messages:');
      console.log('   📍 GPS extracted: ...');
    } else {
      console.log('\n⚠️  Indexing did not start. Check server logs for errors.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

triggerIndexing();

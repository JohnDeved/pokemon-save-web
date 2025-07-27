#!/usr/bin/env node

/**
 * Docker mGBA Environment Test
 * 
 * Tests the Docker mGBA environment to ensure it works the same as native environment
 */

const http = require('http');
const { spawn } = require('child_process');

class DockerEnvironmentTest {
    constructor() {
        this.httpPort = 7102;
        this.testResults = [];
    }

    async makeHTTPRequest(method, path, data = null, headers = {}) {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'localhost',
                port: this.httpPort,
                path: path,
                method: method,
                headers: headers
            };

            const req = http.request(options, (res) => {
                let responseData = '';
                res.on('data', chunk => responseData += chunk);
                res.on('end', () => {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        data: responseData
                    });
                });
            });

            req.on('error', reject);
            
            if (data) {
                req.write(data);
            }
            req.end();
        });
    }

    async testHTTPEndpoints() {
        console.log('🧪 Testing Docker mGBA HTTP endpoints...');

        try {
            // Test GET /
            const welcomeResponse = await this.makeHTTPRequest('GET', '/');
            console.log(`✅ GET / - Status: ${welcomeResponse.statusCode}`);
            console.log(`   Response: ${welcomeResponse.data}`);
            this.testResults.push({
                test: 'GET /',
                status: welcomeResponse.statusCode,
                passed: welcomeResponse.statusCode === 200 && welcomeResponse.data.includes('Welcome')
            });

            // Test GET /json with CORS
            const jsonResponse = await this.makeHTTPRequest('GET', '/json');
            console.log(`✅ GET /json - Status: ${jsonResponse.statusCode}`);
            console.log(`   CORS Headers: ${jsonResponse.headers['access-control-allow-origin']}`);
            console.log(`   Response: ${jsonResponse.data}`);
            this.testResults.push({
                test: 'GET /json',
                status: jsonResponse.statusCode,
                passed: jsonResponse.statusCode === 200 && jsonResponse.data.includes('JSON')
            });

            // Test POST /echo
            const echoResponse = await this.makeHTTPRequest('POST', '/echo', 'Hello from Docker mGBA test!', {
                'Content-Type': 'text/plain'
            });
            console.log(`✅ POST /echo - Status: ${echoResponse.statusCode}`);
            console.log(`   Response: ${echoResponse.data}`);
            this.testResults.push({
                test: 'POST /echo',
                status: echoResponse.statusCode,
                passed: echoResponse.statusCode === 200 && echoResponse.data.includes('Hello from Docker')
            });

            // Test 404 handling
            const notFoundResponse = await this.makeHTTPRequest('GET', '/nonexistent');
            console.log(`✅ GET /nonexistent - Status: ${notFoundResponse.statusCode}`);
            this.testResults.push({
                test: 'GET /nonexistent (404)',
                status: notFoundResponse.statusCode,
                passed: notFoundResponse.statusCode === 404
            });

        } catch (error) {
            console.error('❌ HTTP test failed:', error.message);
            this.testResults.push({
                test: 'HTTP connectivity',
                status: 0,
                passed: false,
                error: error.message
            });
        }
    }

    async checkDockerEnvironment() {
        console.log('🔍 Checking Docker environment status...');
        
        try {
            const { spawn } = require('child_process');
            return new Promise((resolve, reject) => {
                const docker = spawn('docker', ['ps', '--filter', 'name=mgba-test-environment', '--format', 'table {{.Names}}\t{{.Status}}']);
                
                let output = '';
                docker.stdout.on('data', (data) => {
                    output += data.toString();
                });
                
                docker.on('close', (code) => {
                    if (code === 0) {
                        console.log('📋 Docker containers:');
                        console.log(output);
                        resolve(output.includes('mgba-test-environment'));
                    } else {
                        reject(new Error('Docker command failed'));
                    }
                });
            });
        } catch (error) {
            console.error('❌ Docker check failed:', error.message);
            return false;
        }
    }

    printSummary() {
        console.log('\n📊 Test Results Summary:');
        console.log('========================');
        
        const passed = this.testResults.filter(r => r.passed).length;
        const total = this.testResults.length;
        
        this.testResults.forEach(result => {
            const status = result.passed ? '✅' : '❌';
            console.log(`${status} ${result.test} - Status: ${result.status}`);
            if (result.error) {
                console.log(`    Error: ${result.error}`);
            }
        });
        
        console.log(`\n🎯 Overall: ${passed}/${total} tests passed`);
        
        if (passed === total) {
            console.log('🎉 All tests passed! Docker mGBA environment is working correctly.');
            return true;
        } else {
            console.log('⚠️ Some tests failed. Check the environment setup.');
            return false;
        }
    }

    async run() {
        try {
            console.log('🐳 Docker mGBA Environment Test');
            console.log('=================================\n');
            
            const dockerRunning = await this.checkDockerEnvironment();
            if (!dockerRunning) {
                console.log('⚠️ mGBA container not found. Starting environment...');
                console.log('   Run: npm run mgba:start');
                process.exit(1);
            }
            
            // Wait a moment for HTTP server to be ready
            console.log('⏳ Waiting for HTTP server to be ready...');
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            await this.testHTTPEndpoints();
            
            const allPassed = this.printSummary();
            process.exit(allPassed ? 0 : 1);
            
        } catch (error) {
            console.error('❌ Test failed:', error.message);
            process.exit(1);
        }
    }
}

// Run if called directly
if (require.main === module) {
    const test = new DockerEnvironmentTest();
    test.run().catch(console.error);
}

module.exports = DockerEnvironmentTest;
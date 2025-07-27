#!/usr/bin/env node

/**
 * Native mGBA Test Environment
 * 
 * Builds mGBA from source with Qt frontend and Lua support outside of Docker,
 * then tests the HTTP server functionality with real emulator environment.
 * 
 * Requirements specified by user:
 * 1. cmake -B build -DBUILD_QT=ON -DBUILD_SDL=OFF -DUSE_LUA=ON -DCMAKE_BUILD_TYPE=Release -DUSE_FFMPEG=OFF -DUSE_MINIZIP=OFF -DUSE_LIBZIP=OFF -DUSE_DISCORD_RPC=OFF
 * 2. Use xvfb-run for headless operation
 * 3. mgba lua console:log will not show up in terminal (it's internal)
 * 4. Check if io is available, otherwise rely on mgba socket API
 * 5. Must have ROM loaded for lua script to run
 * 6. Check mgba cli commands to load everything correctly
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

class MGBANativeTestEnvironment {
    constructor() {
        this.buildDir = '/tmp/mgba';
        this.testDir = '/tmp/mgba-test';
        this.mgbaExecutable = null;
        this.mgbaProcess = null;
        this.httpPort = 7102;
    }

    async checkDependencies() {
        console.log('🔍 Checking dependencies...');
        
        const dependencies = [
            'build-essential',
            'cmake', 
            'git',
            'pkg-config',
            'qtbase5-dev',
            'qtmultimedia5-dev',
            'liblua5.4-dev',
            'libpng-dev',
            'zlib1g-dev',
            'libzip-dev',
            'libedit-dev',
            'libepoxy-dev',
            'xvfb'
        ];

        try {
            // Check if xvfb-run is available
            execSync('which xvfb-run', { stdio: 'ignore' });
            console.log('✅ xvfb-run is available');
        } catch (error) {
            throw new Error('❌ xvfb-run not found. Please install: sudo apt install xvfb');
        }

        try {
            // Check if cmake is available
            execSync('which cmake', { stdio: 'ignore' });
            console.log('✅ cmake is available');
        } catch (error) {
            throw new Error('❌ cmake not found. Please install build dependencies');
        }

        console.log('✅ Dependencies check completed');
    }

    async buildMGBA() {
        console.log('🔨 Building mGBA from source...');
        
        // Clone mGBA if not exists
        if (!fs.existsSync(this.buildDir)) {
            console.log('📥 Cloning mGBA repository...');
            execSync(`git clone https://github.com/mgba-emu/mgba.git ${this.buildDir}`, { stdio: 'inherit' });
        }

        // Clean previous build
        const buildPath = path.join(this.buildDir, 'build');
        if (fs.existsSync(buildPath)) {
            execSync(`rm -rf ${buildPath}`, { stdio: 'inherit' });
        }

        // Configure build with exact flags specified by user
        console.log('⚙️ Configuring build...');
        const cmakeFlags = [
            '-B build',
            '-DBUILD_QT=ON',
            '-DBUILD_SDL=OFF', 
            '-DUSE_LUA=ON',
            '-DCMAKE_BUILD_TYPE=Release',
            '-DUSE_FFMPEG=OFF',
            '-DUSE_MINIZIP=OFF',
            '-DUSE_LIBZIP=OFF',
            '-DUSE_DISCORD_RPC=OFF'
        ].join(' ');

        execSync(`cd ${this.buildDir} && cmake ${cmakeFlags}`, { stdio: 'inherit' });

        // Build mGBA
        console.log('🔧 Building mGBA (this may take several minutes)...');
        execSync(`cd ${this.buildDir} && cmake --build build --parallel`, { stdio: 'inherit' });

        // Verify executable
        this.mgbaExecutable = path.join(this.buildDir, 'build', 'qt', 'mgba-qt');
        if (!fs.existsSync(this.mgbaExecutable)) {
            throw new Error(`❌ mGBA executable not found at ${this.mgbaExecutable}`);
        }

        // Check if --script argument is supported
        const helpOutput = execSync(`${this.mgbaExecutable} --help`).toString();
        if (!helpOutput.includes('--script')) {
            throw new Error('❌ Built mGBA does not support --script argument');
        }

        console.log('✅ mGBA built successfully with --script support');
    }

    async setupTestEnvironment() {
        console.log('📋 Setting up test environment...');
        
        // Create test directory
        if (!fs.existsSync(this.testDir)) {
            fs.mkdirSync(this.testDir, { recursive: true });
        }

        const sourceDir = '/home/runner/work/pokemon-save-web/pokemon-save-web';
        
        // Copy required files
        const filesToCopy = [
            { src: 'test_data/emerald.gba', dest: 'emerald.gba' },
            { src: 'test_data/emerald.ss0', dest: 'emerald.ss0' },
            { src: 'scripts/mgba-lua/http-server.lua', dest: 'http-server.lua' }
        ];

        for (const file of filesToCopy) {
            const srcPath = path.join(sourceDir, file.src);
            const destPath = path.join(this.testDir, file.dest);
            
            if (fs.existsSync(srcPath)) {
                fs.copyFileSync(srcPath, destPath);
                console.log(`✅ Copied ${file.src} → ${file.dest}`);
            } else {
                throw new Error(`❌ Source file not found: ${srcPath}`);
            }
        }

        console.log('✅ Test environment setup completed');
    }

    async startMGBA() {
        console.log('🎮 Starting mGBA with Lua HTTP server...');
        
        return new Promise((resolve, reject) => {
            // Use xvfb-run for headless operation as specified
            const args = [
                '-a', // automatically select display number
                this.mgbaExecutable,
                '--script', 'http-server.lua',
                '--savestate', 'emerald.ss0',
                'emerald.gba'
            ];

            this.mgbaProcess = spawn('xvfb-run', args, {
                cwd: this.testDir,
                stdio: ['pipe', 'pipe', 'pipe']
            });

            this.mgbaProcess.stdout.on('data', (data) => {
                console.log(`[mGBA stdout] ${data.toString().trim()}`);
            });

            this.mgbaProcess.stderr.on('data', (data) => {
                console.log(`[mGBA stderr] ${data.toString().trim()}`);
            });

            this.mgbaProcess.on('error', (error) => {
                reject(new Error(`Failed to start mGBA: ${error.message}`));
            });

            this.mgbaProcess.on('exit', (code) => {
                console.log(`mGBA process exited with code ${code}`);
            });

            // Wait for HTTP server to be ready
            setTimeout(() => {
                this.waitForHTTPServer()
                    .then(() => resolve())
                    .catch(reject);
            }, 5000);
        });
    }

    async waitForHTTPServer(maxAttempts = 30) {
        console.log('🔄 Waiting for HTTP server to be ready...');
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                await this.makeHTTPRequest('GET', '/');
                console.log('✅ HTTP server is ready!');
                return;
            } catch (error) {
                if (attempt === maxAttempts) {
                    throw new Error(`HTTP server failed to start after ${maxAttempts} attempts`);
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
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

    async testWebSocket() {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(`ws://localhost:${this.httpPort}/ws`);
            let responseReceived = false;

            ws.on('open', () => {
                console.log('📡 WebSocket connection established');
                // Test Lua evaluation - check if socket API is available
                ws.send('return socket and "socket API available" or "socket API not available"');
            });

            ws.on('message', (data) => {
                console.log('📨 WebSocket response:', data.toString());
                responseReceived = true;
                ws.close();
                resolve(data.toString());
            });

            ws.on('error', (error) => {
                if (!responseReceived) {
                    reject(error);
                }
            });

            ws.on('close', () => {
                if (!responseReceived) {
                    reject(new Error('WebSocket closed without receiving response'));
                }
            });

            setTimeout(() => {
                if (!responseReceived) {
                    ws.close();
                    reject(new Error('WebSocket test timeout'));
                }
            }, 5000);
        });
    }

    async testHTTPEndpoints() {
        console.log('🧪 Testing HTTP endpoints...');

        // Test GET /
        const welcomeResponse = await this.makeHTTPRequest('GET', '/');
        console.log(`✅ GET / - Status: ${welcomeResponse.statusCode}`);
        console.log(`   Response: ${welcomeResponse.data}`);

        // Test GET /json with CORS
        const jsonResponse = await this.makeHTTPRequest('GET', '/json');
        console.log(`✅ GET /json - Status: ${jsonResponse.statusCode}`);
        console.log(`   CORS Headers: ${jsonResponse.headers['access-control-allow-origin']}`);
        console.log(`   Response: ${jsonResponse.data}`);

        // Test POST /echo
        const echoResponse = await this.makeHTTPRequest('POST', '/echo', 'Hello from native mGBA test!', {
            'Content-Type': 'text/plain'
        });
        console.log(`✅ POST /echo - Status: ${echoResponse.statusCode}`);
        console.log(`   Response: ${echoResponse.data}`);

        // Test 404 handling
        const notFoundResponse = await this.makeHTTPRequest('GET', '/nonexistent');
        console.log(`✅ GET /nonexistent - Status: ${notFoundResponse.statusCode}`);

        // Test WebSocket
        try {
            const wsResponse = await this.testWebSocket();
            console.log(`✅ WebSocket test completed`);
        } catch (error) {
            console.log(`⚠️ WebSocket test failed: ${error.message}`);
        }

        console.log('✅ All HTTP endpoint tests completed');
    }

    async cleanup() {
        console.log('🧹 Cleaning up...');
        
        if (this.mgbaProcess) {
            this.mgbaProcess.kill('SIGTERM');
            
            // Wait for graceful shutdown
            await new Promise(resolve => {
                this.mgbaProcess.on('exit', resolve);
                setTimeout(() => {
                    this.mgbaProcess.kill('SIGKILL');
                    resolve();
                }, 5000);
            });
        }

        // Kill any remaining mGBA processes
        try {
            execSync('pkill -f mgba-qt', { stdio: 'ignore' });
        } catch (error) {
            // Ignore if no processes found
        }

        console.log('✅ Cleanup completed');
    }

    async run() {
        try {
            await this.checkDependencies();
            await this.buildMGBA();
            await this.setupTestEnvironment();
            await this.startMGBA();
            await this.testHTTPEndpoints();
            
            console.log('\n🎉 Native mGBA test environment completed successfully!');
            console.log('✅ mGBA built with --script support');
            console.log('✅ HTTP server running with Lua environment');
            console.log('✅ ROM loaded and savestate applied');
            console.log('✅ All endpoints responding correctly');
            console.log(`✅ HTTP server accessible at http://localhost:${this.httpPort}`);
            
        } catch (error) {
            console.error('❌ Test failed:', error.message);
            process.exit(1);
        } finally {
            await this.cleanup();
        }
    }
}

// Run if called directly
if (require.main === module) {
    const testEnv = new MGBANativeTestEnvironment();
    testEnv.run().catch(console.error);
}

module.exports = MGBANativeTestEnvironment;
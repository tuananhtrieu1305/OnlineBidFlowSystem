import { spawn } from 'node:child_process';
import path from 'node:path';

if (process.env.REGISTRATION_TEST_DATABASE !== 'true') throw new Error('Provision an isolated MySQL database and set REGISTRATION_TEST_DATABASE=true.');
const java = process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java') : 'java';
const child = spawn(java, ['-jar', path.resolve('../backend/target/auction-backend-0.1.0.jar'), '--server.port=18080'], { stdio: 'inherit' });
child.once('exit', code => process.exit(code ?? 1));
child.once('error', error => { console.error(error); process.exit(1); });
process.once('SIGINT', () => child.kill());
process.once('SIGTERM', () => child.kill());

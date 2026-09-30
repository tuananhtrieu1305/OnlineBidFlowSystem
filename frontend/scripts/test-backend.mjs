import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const jar = path.resolve('../backend/target/auction-backend-0.1.0.jar');
if (!existsSync(jar)) throw new Error('Build backend first: cd backend && mvn verify');
const java = process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java') : 'java';
// Test only: connection probes do not use the database. Normal startup still requires MySQL.
const child = spawn(java, ['-jar', jar, '--server.port=8080',
  '--spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration'], { stdio: 'inherit' });
child.once('exit', (code) => process.exit(code ?? 1));
child.once('error', (error) => { console.error(error); process.exit(1); });
process.once('SIGINT', () => child.kill());
process.once('SIGTERM', () => child.kill());

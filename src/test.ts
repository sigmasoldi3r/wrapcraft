/**
 * Test file.
 */
import { Server } from './index';


async function main() {
    let server = await Server.spawn(process.env.SERVER_JAR).ready;
    const res = await server.command('op sigmasoldier');
    console.log(`After issuing op: "${res}"`);
    server.each(/<sigmasoldier> (.+)/, ([, w]) => {
        console.log('------------------------------');
    });
    const info = await server.getBlockData(-221, 64, 58);
    console.log('Block info = ', info);
}
main();

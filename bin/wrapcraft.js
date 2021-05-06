#!/usr/bin/env node
/**
 * Executable CLI command, uses wrapcraft library and attempts to load the CWD's plugin
 * folder to load plugins.
 */
const { Server } = require('../lib/index');
const fs = require('fs');

// Parse args.
const args = process.argv;
if (args.length <= 2) {
    console.log(`Provide at least the jar file.
USAGE
    wrapcraft <jarfile>
    
    EXAMPLE:
        wrapcraft forge-1.16.5-36.1.0.jar`);
    process.exit(1);
}
const jarfile = args[2];

let dirs;
try {
    dirs = fs.readdirSync('plugins');
} catch {
    dirs = [];
}

/**
 * Entry point.
 */
async function main() {
    const plugins = [];
    console.log(`Preloading wrapcraft plugins...`);
    if (dirs.length === 0) {
        console.warn(`WARNING! You haven't provided any wrapcraft plugins!
You'll be running just a plain minecraft server.`);
    }
    for (const dir of dirs) {
        const name = dir.replace(/\.js/, '');
        try {
            console.log(`Loading ${name}...`);
            const load = require(`${process.cwd()}/plugins/${name}`);
            load.name = name;
            plugins.push(load);
        } catch (err) {
            console.error(`Could not load plugin ${name}:`, err);
        }
    }
    let server = await Server.spawn(jarfile);
    for (const plugin of plugins) {
        if (typeof plugin.preinit === 'function') {
            console.log(`Preinitializing ${plugin.name}...`);
            plugin.preinit(server);
        }
    }
    server = await server.ready;
    // Delay plugin load till the server is ready.
    console.log(`Server ready initializing plugins...`);
    for (const plugin of plugins) {
        try {
            plugin(server);
            // If cleanup function exists, call it when exiting.
            if (plugin.cleanup) {
                server.events.once('stop', () => plugin.cleanup(server));
            }
        } catch (err) {
            console.error(`Error while initializing ${plugin.name}:`, err);
            server.tell('@a', { text: `[plugins]: Error loading ${dir}: ${err}`, color: 'red' });
        }
    }
  }
  main();

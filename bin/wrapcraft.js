#!/usr/bin/env node
/**
 * Executable CLI command, uses wrapcraft library and attempts to load the CWD's plugin
 * folder to load plugins.
 */
const { Server } = require('../lib/index');
const fs = require('fs');
const chalk = require('chalk');

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
  console.log(
    chalk`{orange {bold Warning}, no plugins folder. This instance of wrapcraft will run dry.}`
  );
}

/**
 * Warns the user if the plugins directory list is empty.
 */
function warnIfEmpty() {
  if (dirs.length === 0) {
    console.warn(`{yellow WARNING! You haven't provided any wrapcraft plugins!
You'll be running just a plain minecraft server.}`);
  }
}

/**
 * Get the full path of the plugin.
 * @param {string} of
 * @returns {string}
 */
function getFullPath(of) {
  return `${process.cwd()}/plugins/${of}`;
}

/**
 * Try load the plugin.
 * @param {string} name
 * @returns
 */
function loadPlugin(name) {
  return require(getFullPath(name));
}

/**
 * Sanitizes the name of the plugin, removing extension if found, in case of files.
 * @param {string} pluginName
 * @returns {string}
 */
function getName(pluginName) {
  const full = getFullPath(pluginName);
  try {
    const data = fs.statSync(full);
    if (data.isFile()) {
      return pluginName.replace(/\.js/, '');
    }
    return pluginName;
  } catch (err) {
    const error = new Error(`Failed to resolve plugin ${pluginName}`);
    error.cause = err;
    throw error;
  }
}

/**
 * Preload stage.
 * @param {[]} plugins
 */
function preload(plugins) {
  for (const dir of dirs) {
    const name = getName(dir);
    try {
      console.log(`Loading ${name}...`);
      const plugin = loadPlugin(name);
      if (typeof plugin !== 'function') {
        console.warn(chalk.yellow`Loading malformed plugin {bold ${name}}!`);
        plugin = () => {
          console.log(
            chalk.red`{bold ERROR!} The plugin "${name}" is malformed! It should export a function object!`
          );
        };
      }
      plugin.name = name;
      plugins.push(plugin);
    } catch (err) {
      console.error(chalk.red`Could not load plugin ${name}:`, err);
    }
  }
}

const preInitErrors = [];

/**
 * Preinitializes the plugins in case of having the preinit event.
 * @param {[]} plugins
 */
function preinit(plugins) {
  for (const plugin of plugins) {
    if (typeof plugin.preinit === 'function') {
      console.log(`Preinitializing ${plugin.name}...`);
      try {
        plugin.preinit(server);
      } catch (error) {
        console.error(`${plugin.name} preinit failed:`, error);
        preInitErrors.push({ plugin, error });
      }
    }
  }
}

/**
 * Initializes the plugin list.
 * @param {[]} plugins
 * @param {*} server The server object.
 */
function init(plugins, server) {
  for (const plugin of plugins) {
    try {
      plugin(server);
      // If cleanup function exists, call it when exiting.
      if (plugin.cleanup) {
        server.events.once('stop', () => plugin.cleanup(server));
      }
    } catch (err) {
      console.error(`Error while initializing ${plugin.name}:`, err);
      server.tell('@a', {
        text: `[plugins]: Error loading ${plugin.name}: ${err}`,
        color: 'red',
      });
    }
  }
  // Report any errors
  for (const { plugin, error } of preInitErrors.splice(
    0,
    preInitErrors.length
  )) {
    server.tell('@a', {
      text: `[plugins]: ${plugin.name} had troubles during the pre-init stage: ${error}`,
      color: 'red',
    });
  }
}

/**
 * Entry point. This function is a façade method to chain the whole initialization procedure.
 */
async function main() {
  const plugins = [];
  console.log(chalk.green`Preloading plugins...`);
  preload(plugins);
  warnIfEmpty();
  let server = await Server.spawn(jarfile);
  console.log(chalk.green`Pre-initializing plugins...`);
  preinit(plugins);
  server = await server.ready;
  // Delay plugin load till the server is ready.
  console.log(chalk.greenBright`Server ready! initializing plugins...`);
  init(plugins, server);
}
main();

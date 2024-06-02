require("module-alias/register");
const { Client, GatewayIntentBits, Events, Partials, ActivityType, PermissionFlagsBits } = require("discord.js");
const { prefix, ownerID } = require ("@root/utils/config.json");

const MinecraftNotifier = require("./utils/MineCraftListener.js");

const Logger = require("./utils/log");
const fs = require("fs");

const dotenv = require("dotenv");
const Discord = require("discord.js");

dotenv.config();

const client = new Client({
    intents: Object.keys(GatewayIntentBits), // all intents
    partials: Object.keys(Partials),
    allowedMentions: { repliedUser: false },
});

global.debug = 0;
global.prefix = 
global.wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Add array.equals()
Array.prototype.equals = function(otherArray) {
    return this.length === otherArray.length && this.every((value, index) => value === otherArray[index]);
};

// Add array.shuffle()
Array.prototype.shuffle = function() {
    for (let i = this.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this[i], this[j]] = [this[j], this[i]];
    }
    return this;
};

// Logger system and databases
global.logger = new Logger({ root: __dirname, client });
console.logger = console.log;
console.log = (log) => global.logger.console(log);

// Collections creation
client.commands = new Discord.Collection();
client.slashcommands = new Discord.Collection();
client.contextCommands = new Discord.Collection();
client.consoleCommands = new Discord.Collection();

// File finder/loader
function loadFiles(folder, callback) {
    const commandFiles = fs.readdirSync(folder);
    while (commandFiles.length > 0) {
        const file = commandFiles.shift();
        if (file.endsWith(".js")) {
            const loaded = require(`${folder}${file}`);
            loaded.filePath = folder + file;
            callback(loaded, file);
        } else {
            if (!fs.lstatSync(folder + file).isDirectory()) continue;
            const newFiles = fs.readdirSync(folder + file);
            newFiles.forEach(f => commandFiles.push(file + "/" + f));
        }
    }
}

// Slash command handler
const discoveredCommands = [];
loadFiles("./commands/slash/", (slashcommand, fileName) => {
    if ("name" in slashcommand && "execute" in slashcommand && "description" in slashcommand) {
        client.slashcommands.set(slashcommand.name, slashcommand);
        discoveredCommands.push(slashcommand);
    } else {
        global.logger.error(`[WARNING] The (/) command ${fileName} is missing a required "name", "execute", or "type" property.`);
    }
});

// Text command handler
loadFiles("./commands/text/", function(command) {
    client.commands.set(command.name, command);

    if (command.aliases && Array.isArray(command.aliases)) {
        command.aliases.forEach(alias => {
            client.commands.set(alias, command);
        });
    }
});

// Context menu command handler
// loadFiles("./commands/context/", (contextcommand, fileName) => {
//     if ("name" in contextcommand && "execute" in contextcommand && "type" in contextcommand) {
//         client.contextCommands.set(contextcommand.name, contextcommand);
//         discoveredCommands.push(contextcommand);
//     } else {
//         global.logger.error(`[WARNING] The (ctx) command ${fileName} is missing a required "name", "execute", or "type" property.`);
//     }
// });

// Event handler
// loadFiles("./events/client/", function(event) {
//     if (event.once) {
//         client.once(event.name, async (...args) => {
//             if (event.log) global.logger.event(`Event: [${event.name}] fired.`);
//             await event.execute(client, global.logger, ...args);
//         });
//     } else {
//         client.on(event.name, async (...args) => {
//             if (event.log) global.logger.event(`Event: [${event.name}] fired.`);
//             await event.execute(client, global.logger, ...args);
//         });
//     }
// });

loadFiles("./events/process/", function(event) {
    process.on(event.name, async (...args) => {
        if (event.log) global.logger.event(`Event: [${event.name}] fired.`);
        await event.execute(client, global.logger, ...args);
    });
});

const MCServerListener = MinecraftNotifier.getInstance([
    { ip: "serviceski.sfcnet.me" },
    { ip: "srv4.kpotatto.net", port: 10002 },
]);

MCServerListener.start();

loadFiles("./events/minecraftNotifier/", function(event) {
    MCServerListener.on(event.name, async (...args) => {
        if (event.log) global.logger.event(`Event: [${event.name}] fired.`);
        await event.execute(client, global.logger, ...args);
    });
});

// process.stdin.setEncoding("utf8");
// loadFiles("./events/console/", function(event) {
//     client.consoleCommands.set(event.name, event);
// });
// 
// process.stdin.on("data", async (input) => {
//     const args = input.split(/ +/);
//     const commandName = args.shift().toLowerCase().trim();
//     const command = client.consoleCommands.get(commandName);
//     if (!command) return;
// 
//     process.stdout.write("\u001b[1A\u001b[2K");
//     await console.logger(`
//     Executing [${commandName}]
//     by        [CONSOLE]
//     ---------------------------`
//         .replace(/^\s+/gm, ""));
// 
//     await command.execute(client, global.logger, args);
// });
        
        
// Bot setup on startup
client.once(Events.ClientReady, async () => {
            
    global.logger.info(`Bot starting on [${process.env.SERVER}]...`);
            
    console.log("Setting up commands...");
    await client.application.commands.set(discoveredCommands);
    console.log(`${client.slashcommands.size} (/) commands`);
    console.log(`${client.contextCommands.size} (ctx) commands`);
    console.log(`${client.commands.size} (text) commands (including aliases)`);
    console.log("commands setup done.");

    client.user.setActivity("Ready to help.", { type: ActivityType.Custom });
    console.log("Activity status setup done.");

    console.log("Discord.js version: " + require("discord.js").version);

    console.log("Waiting for websocket to successfully connect.");
    const interval = setInterval(() => {
        if (client.ws.ping !== -1) {
            global.logger.info("Bot started successfully.");
            clearInterval(interval);
        }
    }, 500);
});

// Debug event
client.on(Events.Debug, debug => {
    if (global.debug) console.log(debug);
});

// Slash command executing
client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isChatInputCommand()) {

        const slash = interaction.client.slashcommands.get(interaction.commandName);

        if (!slash) return global.logger.error(`No command matching ${interaction.commandName} was found.`);

        try {
        // execute the slash command
            await slash.execute(global.logger, interaction, client);

            // Logging the command
            global.logger.info(`Executing [/${interaction.commandName}]
            by    [${interaction.user.tag} (${interaction.user.id})]
            in    [${interaction.channel.name} (${interaction.channel.id})]
            from  [${interaction.guild.name} (${interaction.guild.id})]`
                .replace(/^\s+/gm, ""));

        } catch (error) {
            if (!interaction.deferred) {
                await interaction.reply({
                    embeds: [{
                        title: "An error occured while executing the command",
                        color: 0xff0000,
                        timestamp: new Date(),
                    }],
                    ephemeral: true,
                });
            } else {
                await interaction.editReply({
                    embeds: [{
                        title: "An error occured while executing the command",
                        color: 0xff0000,
                        timestamp: new Date(),
                    }],
                    ephemeral: true,
                });
            }

            global.logger.error(`Error executing slash command [${interaction.commandName}]`);
            global.logger.error(error.stack);
        }
    } else if (interaction.isContextMenuCommand()) {
        
        const context = client.contextCommands.get(interaction.commandName);

        if (!context) return console.error(`No command matching ${interaction.commandName} was found.`);

        try {
            await context.execute(global.logger, interaction, client);

            global.logger.info(`
            Executing [${interaction.commandName} (${context.type === 2 ? "User" : "Message"})]
            by   [${interaction.user.tag} (${interaction.user.id})]
            in   [${interaction.channel.name} (${interaction.channel.id})]
            from [${interaction.guild.name} (${interaction.guild.id})]`
                .replace(/^\s+/gm, ""));

        } catch (error) {
            interaction.reply({
                embeds: [{
                    title: "An error occured while executing the command",
                    color: 0xff0000,
                    timestamp: new Date(),
                }],
                ephemeral: true,
            });
            
            global.logger.error(`Error executing context menu command [${interaction.commandName}]`);
            global.logger.error(error);
        }
    }
});

// Text command executing
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    if (message.author.id != ownerID) return;
    if (!message.guild) return message.reply("Commands cannot be executed inside DMs.");

    // Text command executing
    if (message.content.startsWith(prefix) || message.content.startsWith(`<@${client.user.id}>`)) {
        let args, commandName;
        if (!message.content.startsWith(`<@${client.user.id}> `)) {
            args = message.content.slice(prefix.length).split(/ +/);
            commandName = args.shift().toLowerCase();
        } else {
            args = message.content.slice().split(/ +/);
            args.shift();
            commandName = args.shift().toLowerCase();
        }

        // Command auto-correction
        const command = client.commands.get(commandName);
        if (!command) return;

        // Logging every executed commands
        global.logger.info(`
        Executing [${message.content}]
        by    [${message.member.user.tag} (${message.author.id})]
        in    [${message.channel.name} (${message.channel.id})]
        from  [${message.guild.name} (${message.guild.id})]`
            .replace(/^\s+/gm, ""));
        
        // Execute the command
        try {
            await message.channel.sendTyping();
            await command.execute(global.logger, client, message, args);
        } catch (error) {
            global.logger.error(error.stack);
        }
    }
});
// Logins with the token
client.login(process.env.TOKEN);
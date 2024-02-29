const { version: discordjsVersion } = require("discord.js");
const { version, dependencies, name } = require("@root/package.json");

module.exports = {
    name: "packages",
    description: "Lists the packages and versions",
    category: "utils",
    async execute(logger, client, message, args) {
        const WDVersion = version;
    
        const embed = {
            title: "Installed Packages",
            color: 0xffffff,
            description: "The following packages are installed:",
            fields: [
                { name: name.toUpperCase(), value: WDVersion, inline: false },
                { name: "discord.js", value: "^" + discordjsVersion, inline: true },
            ],
        };

        const fields = [];
        for (const [packageName, packageVersion] of Object.entries(dependencies)) 
            if (packageName != "discord.js") fields.push({ name: packageName, value: packageVersion, inline: true });
        
        
        embed.fields.push(...fields);
        embed.timestamp = new Date();
        embed.footer = { text: `[Server: ${process.env.SERVER}]` };

        message.reply({ embeds: [embed], allowedMentions: { RepliedUser: false } });
    },
};
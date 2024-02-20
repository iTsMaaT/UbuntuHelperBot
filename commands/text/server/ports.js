const { exec } = require("child_process");

module.exports = {
    name: "ports",
    description: "Shows used ports by services",
    category: "server",
    async execute(logger, client, message, args) {
        exec("ss -tulnp | grep 'LISTEN' | grep -v ':::'", (error, stdout, stderr) => {
            if (error) {
                console.error(`Error executing command: ${error}`);
                return;
            }
            if (stderr) {
                console.error(`Error executing command: ${stderr}`);
                return;
            }
            // Send the output to Discord
            message.channel.send(`\`\`\`${stdout}\`\`\``);
            console.log(stdout);
        });
    },
};

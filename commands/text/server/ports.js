const { exec } = require("child_process");

module.exports = {
    name: "ports",
    description: "Shows used ports by services",
    category: "server",
    async execute(logger, client, message, args) {
        exec("sudo netstat -tulnp | grep 'LISTEN' | grep -v ':::'", (error, stdout, stderr) => {
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

        function portsToOBJ(stdout) {
            const JSONPorts = {};
            const lines = stdout.trim().split("\n");
            for (const line of lines) {
                const parts = line.trim().split(/\s+/);
                if (parts[6] == "-") continue;
                const ipAndPort = parts[3].split(":");
                JSONPorts[parts[6] + (parts[7] || "")] = {
                    ip: ipAndPort[0],
                    port: ipAndPort[1],
                    protocol: parts[0],
                };
            }
            return JSONPorts;
        }
    },
};

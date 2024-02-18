module.exports = {
    name: "dashboard",
    description: "Gives the dashboard's link",
    category: "server",
    aliases: ["dash"],
    async execute(logger, client, message, args) {
        message.reply("http://192.168.2.254:7575/board");
    },
};
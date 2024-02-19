const { spawn } = require("child_process");
const { addToQueue } = require("../../../utils/QueueSystem.js");

module.exports = {
    name: "downloads",
    description: "Downloads a youtube video / playlist for Jellyfin",
    category: "server",
    aliases: ["dl"],
    async execute(logger, client, message, args) {
        const videoUrl = args[0];
        if (!videoUrl) return message.reply("You must provide a valid URL");

        const outputFolder = "/mnt/jellyfin";
        const downloadCommand = [
            "/home/container/yt-dlp",
            "-f",
            "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best",
            "-o",
            `${outputFolder}/%(title)s.%(ext)s`,
            videoUrl,
        ];

        const downloadOperation = () => new Promise((resolve, reject) => {
            try {
                message.reply("Attempting download...");

                const ytDlpProcess = spawn(downloadCommand[0], downloadCommand.slice(1));

                ytDlpProcess.stdout.on("data", data => {
                    logger.info(`stdout: ${data}`);
                });

                ytDlpProcess.stderr.on("data", data => {
                    logger.error(`stderr: ${data}`);
                    message.channel.send(`Error: ${data}`);
                });

                ytDlpProcess.on("close", code => {
                    if (code !== 0) {
                        logger.error(`yt-dlp process exited with code ${code}`);
                        reject(`yt-dlp process exited with code ${code}`);
                    } else {
                        resolve("Video downloaded successfully!");
                    }
                });
            } catch (err) {
                reject("An error occured executing the command");
                logger.error(err);
            }
        });

        try {
            const result = await addToQueue("download", downloadOperation);
            message.reply(result);
        } catch (err) {
            message.reply(err);
        }
    },
};

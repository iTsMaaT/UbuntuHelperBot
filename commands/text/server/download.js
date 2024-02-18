const fs = require("fs");
const { exec } = require("child_process");
const { addToQueue } = require("../../../utils/QueueSystem.js");

module.exports = {
    name: "downloads",
    description: "Downloads a youtube video / playlist for Jellyfin",
    category: "server",
    aliases: ["dl"],
    async execute(logger, client, message, args) {
        const videoUrl = args[0];
        const outputFolder = "/mnt/Main/Jellyfin/YT-DLP";
        const downloadCommand = `/home/container/yt-dlp -f 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best' -o '${outputFolder}/%(title)s.%(ext)s' ${videoUrl}`;
        const downloadOperation = () => new Promise((resolve, reject) => {
            // Execute yt-dlp command to download the video as MP4 and in 1080p resolution
            exec(downloadCommand, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Error: ${error.message}`);
                    message.reply("An error occured");
                    reject("An error occurred while downloading the video.");
                }
                if (stderr) {
                    console.error(`stderr: ${stderr}`);
                    // message.reply("An error occured");
                    reject("An error occurred while downloading the video.");
                }
                console.log(`stdout: ${stdout}`);
                resolve("Video downloaded successfully!");
            });
        });
    
        // Add the download operation to the queue
        addToQueue("download", downloadOperation)
            .then(result => message.reply(result))
            .catch(error => message.reply(error));
    },
};
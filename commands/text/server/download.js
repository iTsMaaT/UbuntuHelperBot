const { addToQueue } = require("../../../utils/QueueSystem.js");
const youtubedl = require("youtube-dl-exec");

module.exports = {
    name: "downloadvideo",
    description: "Downloads a youtube video / playlist for Jellyfin",
    category: "server",
    aliases: ["dlmp4"],
    async execute(logger, client, message, args) {
        const videoUrl = args[0];
        if (!videoUrl) return message.reply("You must provide a valid URL");

        const outputFolder = "/mnt/jellyfin";
        const downloadOptions = {
            prefer_ffmpeg: true,
            o: `${outputFolder}/%(title)s.%(ext)s`,
        };

        const downloadOperation = async () => {
            try {
                message.reply("Attempting download...");
                const result = await youtubedl(videoUrl, downloadOptions);
                console.log("Download result:", result);
                message.reply("Video downloaded successfully!");
            } catch (err) {
                console.error("Error occurred during download:", err);
                message.reply("An error occurred during the download process.");
                throw err; // Rethrow the error to be caught by the queue system
            }
        };

        try {
            await addToQueue("download", downloadOperation);
        } catch (err) {
            console.error("Error adding download operation to the queue:", err);
            message.reply("An error occurred while adding the download operation to the queue.");
        }
    },
};

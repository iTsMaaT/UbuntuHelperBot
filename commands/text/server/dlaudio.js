const fs = require("fs/promises");
const NodeID3 = require("node-id3");
const YouTube = require("youtube-sr").default;
const youtubeDlExec = require("youtube-dl-exec");
const prettyms = require("pretty-ms");

module.exports = {
    name: "downloadmusic",
    description: "Downloads songs from a YouTube playlist as MP3s with metadata for Jellyfin",
    category: "server",
    aliases: ["dlmp3"],
    async execute(logger, client, message, args) {
        if (!args) return message.reply("You must enter a link");
        const urlArray = await getYoutubePlaylistVideos(args[0]);

        const promptMessage = await message.channel.send("Do you want to download one by one or mass download? (mass/one)");
        const filter = response => !response.author.bot;
        const collected = await message.channel.awaitMessages({ filter, max: 1, time: 60000, errors: ["time"] });

        if (!collected || !collected.first()) 
            return message.reply("You must reply");
            
        const content = collected.first().content.trim();
        await promptMessage.delete();
        await collected.first().delete();

        const linkAmount = urlArray.length;
        const startTime = Date.now();
        let fails = 0;

        switch (content) {
            case "m":
            case "mass":
                fails = await handleMass(message, urlArray);
                break;
            case "o":
            case "one":
                fails = await handleOneByOne(message, urlArray);
                break;
            default: 
                message.reply("Invalid input");
                break;
        }

        const totalTime = prettyms(Date.now() - startTime);

        const embed = {
            color: 0xffffff,
            title: "Download finished",
            fields: [
                { name: "Amount of downloads", value: linkAmount },
                { name: "Success rate", value: `${fails} fails | ${linkAmount - fails} Successes` },
                { name: "Time for operation", value: totalTime },
            ],
            timestamp: new Date(),
        };

        await message.reply({ embeds: [embed] });
    },
};


const outputFolderBusy = "/mnt/jellyfin/Music/Busy";
const outputFolderCompleted = "/mnt/jellyfin/Music/Completed";  

async function getYoutubePlaylistVideos(url) {
    const linkType = getLinkType(url);
    if (!linkType) throw new Error("Link or ID is not of a video or playlist");
    const videoArray = [];

    try {
        switch (linkType) {
            case "video": {
                videoArray.push("https://www.youtube.com/watch?v=" + (await YouTube.getVideo(url)).id);
                break;
            }
            case "playlist": {
                const videoObj = await YouTube.getPlaylist(url, { fetchAll: true });
                const videoArr = videoObj.videos.map(v => v.url);
                videoArray.push(...videoArr);
                break;    
            }
        }
        return videoArray;
    } catch (err) {
        logger.error(err);
        throw new Error("Failed to fetch links");
    }

    function getLinkType(link) {
        if (YouTube.validate(link, "PLAYLIST_ID") || YouTube.validate(link, "PLAYLIST")) return "playlist";
        if (YouTube.validate(link, "VIDEO") || YouTube.validate(link, "VIDEO_ID")) return "video";
        return false;
    }
}

async function handleOneByOne(message, urlArray) {
    const collectMetadata = async () => {
        const metadata = {};
        const prompts = [
            { name: "title", prompt: "Enter the title of the song:" },
            { name: "artist", prompt: "Enter the artist:" },
            { name: "album", prompt: "Enter the album:" },
        ];

        for (const promptObj of prompts) {
            const promptMessage = await message.channel.send(promptObj.prompt);
            const filter = response => !response.author.bot;
            const collected = await message.channel.awaitMessages({ filter, max: 1, time: 60000, errors: ["time"] });

            if (!collected || !collected.first()) 
                throw new Error("You did not provide the required input. Cancelling download.");
            
            
            const content = collected.first().content.trim();
            await promptMessage.delete();
            await collected.first().delete();

            metadata[promptObj.name] = content;     
        }
        const embed = {
            color: 0xffffff,
            title: "Metadata that will be applied",
            fields:[
                { name: "Title", value: metadata.title },
                { name: "Artist", value: metadata.artist },
                { name: "Album", value: metadata.album },
            ],
            timestamp: new Date(),
        };
        message.reply({ embeds: [embed] });

        return metadata;
    };
    let fails = 0;
    for (const videoUrl of urlArray) {
        try {
            const metadata = await collectMetadata();
            await dlVid(message, videoUrl, metadata);
        } catch (err) {
            message.reply(`Failed to download: ${videoUrl}`);
            logger.error(err);
            fails += 1;
        }
    }
    return fails;
}

async function handleMass(message, urlArray) {
    let fails = 0;
    let promptMessage = await message.channel.send("Do you wish to enter a artist that will be applied to all files? (y/n)");
    const filter = response => !response.author.bot;
    let collected = await message.channel.awaitMessages({ filter, max: 1, time: 60000, errors: ["time"] });

    if (!collected || !collected.first()) 
        throw new Error("You did not provide the required input. Cancelling download.");
             
    let content = collected.first().content.trim();
    await promptMessage.delete();
    await collected.first().delete();

    if (content == "y" || content == "yes") {
        promptMessage = await message.channel.send("Enter the artist");
        collected = await message.channel.awaitMessages({ filter, max: 1, time: 60000, errors: ["time"] });

        if (!collected || !collected.first()) 
            throw new Error("You did not provide the required input. Cancelling download.");
    
        content = collected.first().content.trim();
        await promptMessage.delete();
        await collected.first().delete();

        for (const videoUrl of urlArray) {
            try {
                const VidInfo = await YouTube.getVideo(videoUrl);
                const tags = {
                    title: VidInfo.title,
                    artist: content,
                };
                await dlVid(message, videoUrl, tags);
            } catch (err) {
                message.reply(`Failed to download: ${videoUrl}`);
                logger.error(err);
                fails += 1;
            }
        }
    } else if (content == "n" || content == "no") {
        for (const videoUrl of urlArray) {
            try {
                const VidInfo = await YouTube.getVideo(videoUrl);
                const tags = {
                    title: VidInfo.title,
                    artist: VidInfo.channel.name,
                };
                await dlVid(message, videoUrl, tags);
            } catch (err) {
                message.reply(`Failed to download: ${videoUrl}`);
                logger.error(err);
                fails += 1;
            }
        }  
    }
    return fails;
}

async function dlVid(message, url, tags) {
    try {
        let downloadedFilePath;
        if (tags.artist) downloadedFilePath = `${outputFolderBusy}/${tags.title} - ${tags.artist}.mp3`;
        else downloadedFilePath = `${outputFolderBusy}/${(await YouTube.getVideo(url).title)}.mp3`;

        downloadedFilePath = downloadedFilePath.replace("/", "_");

        await youtubeDlExec(url, {
            "sponsorblock-remove": "default",
            extractAudio: true,
            audioFormat: "mp3",
            output: downloadedFilePath,
        });

        const success = await NodeID3.write(tags, downloadedFilePath);
        if (success === true) {
            await new Promise((resolve) => setTimeout(resolve, 7 * 1000));
            // Rename the file after it's completely written and closed
            await fs.rename(downloadedFilePath, `${outputFolderCompleted}/${tags.title} - ${tags.artist}.mp3`);
        } else {
            logger.error("Error embedding metadata:" + success);
        }
    } catch (err) {
        message.reply(`Failed to download: ${url}`);
        logger.error(err);
    }
}

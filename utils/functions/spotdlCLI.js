const { spawn, exec } = require("child_process");

async function spotDLExec(command, options) {
    if (!await checkSpotDLInstalled()) return;

    const SPOTIFY_CLIENT_ID = options?.spotifyClientId;
    const SPOTIFY_SECRET = options?.spotifySecret;
    
    const spotDLChild = spawn(command || "spotdl download all-user-playlists --user-auth", [], {
        stdio: "ignore",
    });

    spotDLChild.on("error", (err) => {
        console.error(err);
    });

    return new Promise((resolve, reject) => {
        spotDLChild.on("close", (code) => {
            console.log(`spotDL exited with code ${code}`);
            if (code === 0) resolve();
            else reject();
        });
    });
}

async function checkSpotDLInstalled() {
    try {
        exec("spotdl --version");
        return true;
    } catch (err) {
        return false;
    }
}

module.exports = spotDLExec;
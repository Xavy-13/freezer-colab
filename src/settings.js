const os = require('os');
const path = require('path');
const fs = require('fs');

class Settings {

    constructor(electron = false) {
        //Defaults
        this.port = 10069;
        this.serverIp = '127.0.0.1';
        this.arl;
        this.streamQuality = 3;
        this.volume = 0.69;
        this.electron = electron;
        this.minimizeToTray = true;
        this.closeOnExit = false;
        this.width = 1280;
        this.height = 720;

        this.downloadsPath = this.getDefaultDownloadPath();
        this.downloadsQuality = 3;
        this.createAlbumFolder = true;
        this.createArtistFolder = true;
        this.downloadFilename = '%0trackNumber%. %artists% - %title%';
        this.downloadDialog = true;
        this.downloadCover = true;
        this.coverResolution = 1400;

        this.logListen = false;
        this.lastFM = null;
        this.enableDiscord = false;
        this.discordJoin = false;

        this.showAutocomplete = true;
        this.downloadThreads = 4;
        this.downloadLyrics = true;
        this.primaryColor = '#2196F3';
        this.language = 'en';

        this.crossfadeDuration = 3000;
        this.playlistFolder = false;

        this.forceWhiteTrayIcon = false;
        this.contentLanguage = 'en';
        this.contentCountry = 'US';
        this.sidebarOpen = false;
        this.nativeTopBar = false;

        //Has to be local path
        this.backgroundImage = null;
        this.lightTheme = false;
    }

    //Based on electorn app.getPath
    static getDir() {
        let home = os.homedir();
        if (os.platform() === 'win32') {
            return path.join(process.env.APPDATA, 'freezer');
        }
        if (os.platform() === 'linux') {
            return path.join(home, '.config', 'freezer');
        }

        //UNTESTED
        if (os.platform() == 'darwin') {
            return path.join(home, 'Library', 'Application Support', 'freezer');
        }
        throw Error('Unsupported platform!');
    }

    //Get settings.json path
    static getPath() {
        return path.join(Settings.getDir(), 'settings.json');  
    }
    //Get path to playback.json
    static getPlaybackInfoPath() {
        return path.join(Settings.getDir(), 'playback.json');
    }
    //Get path to downloads database
    static getDownloadsDB() {
        //Delete old DB if exists
        let oldPath = path.join(Settings.getDir(), 'downloads.db');
        if (fs.existsSync(oldPath))
            fs.unlink(oldPath, () => {});

        return path.join(Settings.getDir(), 'downloads2.db');
    }
    //Get path to temporary / unfinished downlaods
    static getTempDownloads() {
        return path.join(Settings.getDir(), 'downloadsTemp');
    }

    getDefaultDownloadPath() {
        return path.join(os.homedir(), 'FreezerMusic');
    }

    //Blocking load settings
    load() {
        //Preserve electorn option
        let e = this.electron;
        //Create dir if doesn't exist
        try {
            fs.mkdirSync(Settings.getDir(), {recursive: true});
        } catch (_) {}

        //Load settings from file
        try {
            if (fs.existsSync(Settings.getPath())) {
                let data = fs.readFileSync(Settings.getPath(), 'utf-8');
                Object.assign(this, JSON.parse(data));
            }
        } catch (e) {
            console.error(`Error loading settings: ${e}. Using defaults.`);
            this.save();
        }
        this.electron = e;

        //Defaults for backwards compatibility
        if (!this.downloadsPath) this.downloadsPath = this.getDefaultDownloadPath();
    }

    //ASYNC save settings
    async save() {
        //Create dir if doesn't exist
        try {
            await fs.promises.mkdir(Settings.getDir(), {recursive: true});
        } catch (_) {}

        await fs.promises.writeFile(Settings.getPath(), JSON.stringify(this, null, 2), 'utf-8');
    }

}

module.exports = {Settings};
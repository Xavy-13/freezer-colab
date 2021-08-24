const express = require('express');
const cors = require('cors');
const path = require('path');
const packageJson = require('../package.json');
const fs = require('fs');
const compareVersions = require('compare-versions');
const axios = require('axios').default;
const logger = require('./winston');
const {DeezerAPI, DeezerStream} = require('./deezer');
const {Settings} = require('./settings');
const {Track, Album, Artist, Playlist, DeezerProfile, SearchResults, DeezerLibrary, DeezerPage, Lyrics} = require('./definitions');
const {DownloadManager} = require('./downloads');
const {Integrations} = require('./integrations');
const {Importer} = require('./importer');

let settings;
let deezer;
let downloadManager;
let integrations;

let sockets = [];

//Express
const app = express();
app.use(express.json({limit: '50mb'}));
app.use(express.static(path.join(__dirname, '../client', 'dist')));
app.use(cors({origin: 'http://localhost:8080'}));
//Server
const server = require('http').createServer(app);
const { Server } = require('socket.io');
const io = new Server(server, {
    path: '/socket',
    //CORS for webpack debug
    cors: {
        origin: 'http://localhost:8080',
        methods: ["GET", "POST"],
    }
});

//Get playback info
app.get('/playback', async (req, res) => {
    try {
        let data = await fs.promises.readFile(Settings.getPlaybackInfoPath(), 'utf-8');
        return res.json(data);
    // eslint-disable-next-line no-empty
    } catch (e) {}
    
    return res.json({});
});

//Save playback info
app.post('/playback', async (req, res) => {
    if (req.body) {
        let data = JSON.stringify(req.body);
        await fs.promises.writeFile(Settings.getPlaybackInfoPath(), data, 'utf-8');
    }
    res.status(200).send('');
});

//Get settings
app.get('/settings', (req, res) => {
    res.json(settings);
});

//Save settings
app.post('/settings', async (req, res) => {
    if (req.body) {
        Object.assign(settings, req.body);
        downloadManager.settings = settings;
        integrations.updateSettings(settings);
        await settings.save();
    }

    res.status(200).send('');
});

//Post with body {"arl": ARL}
app.post('/authorize', async (req, res) => {
    if (!req.body.arl || req.body.arl.length < 100) return res.status(500).send('Invalid ARL');
    
    //Check if ARL valid
    let electron = deezer.electron;
    deezer = new DeezerAPI(req.body.arl, electron);
    settings.arl = req.body.arl;

    if (await (deezer.authorize())) {
        //Update download manager
        downloadManager.setDeezer(deezer);

        res.status(200).send('OK');
        return;
    }

    res.status(500).send('Authorization error / Invalid ARL.');
});

//Get track by id
app.get('/track/:id', async (req, res) => {
    let data = await deezer.callApi('deezer.pageTrack', {sng_id: req.params.id.toString()});
    res.send(new Track(data.results.DATA));
});

//Get album by id
app.get('/album/:id', async (req, res) => {
    let data = await deezer.callApi('deezer.pageAlbum', {alb_id: req.params.id.toString(), lang: settings.contentLanguage});
    res.send(new Album(data.results.DATA, data.results.SONGS));
});

//Get artist by id
app.get('/artist/:id', async (req, res) => {
    let data = await deezer.callApi('deezer.pageArtist', {art_id: req.params.id.toString(), lang: settings.contentLanguage});
    res.send(new Artist(data.results.DATA, data.results.ALBUMS, data.results.TOP));
});

//Get playlist by id
//start & full query parameters
app.get('/playlist/:id', async (req, res) => {
    //Set anything to `full` query parameter to get entire playlist
    let nb = req.query.full ? 100000 : 50;
    let data = await deezer.callApi('deezer.pagePlaylist', {
        playlist_id: req.params.id.toString(),
        lang: settings.contentLanguage,
        nb: nb,
        start: req.query.start ? parseInt(req.query.start, 10) : 0,
        tags: true
    });
    return res.send(new Playlist(data.results.DATA, data.results.SONGS));
});

//DELETE playlist
app.delete('/playlist/:id', async (req, res) => {
    await deezer.callApi('playlist.delete', {playlist_id: req.params.id.toString()});
    res.sendStatus(200);
});

//POST create playlist
// {
//     desciption,
//     title,
//     type: 0, 1, 2 = public, private, collab
//     track: trackID
// }
app.post('/playlist', async (req, res) => {
    await deezer.callApi('playlist.create', {
        description: req.body.description,
        title: req.body.title,
        status: req.body.type,
        songs: req.body.track ? [[req.body.track, 0]] : []
    });

    res.sendStatus(200);
});

//PUT edit playlist, see above create
app.put('/playlist/:id', async (req, res) => {
    await deezer.callApi('playlist.update', {
        description: req.body.description,
        title: req.body.title,
        status: req.body.type,
        playlist_id: parseInt(req.params.id.toString(), 10)
    });
    res.sendStatus(200);
});

//POST track to playlist
//Body {"track": "trackId"}
app.post('/playlist/:id/tracks', async (req, res) => {
    await deezer.callApi('playlist.addSongs', {
        offset: -1,
        playlist_id: req.params.id,
        songs: [[req.body.track, 0]]
    });

    res.sendStatus(200);
});

//DELETE track from playlist
//Body {"track": "trackId"}
app.delete('/playlist/:id/tracks', async (req, res) => {
    await deezer.callApi('playlist.deleteSongs', {
        playlist_id: req.params.id,
        songs: [[req.body.track, 0]]
    });

    res.sendStatus(200);
});

//Get more albums
//ID = artist id, QP start = offset
app.get('/albums/:id', async (req, res) => {
    let data = await deezer.callApi('album.getDiscography', {
        art_id: parseInt(req.params.id.toString(), 10),
        discography_mode: "all",
        nb: 25,
        nb_songs: 200,
        start: req.query.start ? parseInt(req.query.start, 10) : 0
    });

    let albums = data.results.data.map((a) => new Album(a));
    res.send(albums);
})

//Get tracks from listening history
app.get('/history', async (req, res) => {
    let data = await deezer.callApi('deezer.pageProfile', {
        nb: 200,
        tab: "history",
        user_id: deezer.userId.toString()
    });
    let tracks = data.results.TAB.history.data.map((t) => new Track(t));
    res.send(tracks);
});

//Search, q as query parameter
app.get('/search', async (req, res) => {
    let data = await deezer.callApi('deezer.pageSearch', {query: req.query.q, nb: 100});
    res.send(new SearchResults(data.results));
});

//Get user profile data
app.get('/profile', async (req, res) => {
    let data = await deezer.callApi('deezer.getUserData');
    let profile = new DeezerProfile(data.results);
    res.send(profile);
});

//Get shuffled library
app.get('/shuffle', async (req, res) => {
    let data = await deezer.callApi('tracklist.getShuffledCollection', {
        nb: 50,
        start: 0
    });
    res.send(data.results.data.map((t) => new Track(t)));
});

//Get list of `type` from library
app.get('/library/:type', async (req, res) => {
    let type = req.params.type;
    //Normal
    if (type != 'tracks') {
        let data = await deezer.callApi('deezer.pageProfile', {
            nb: 50,
            tab: (type == 'tracks') ? 'loved' : type,
            user_id: deezer.userId
        });
        return res.send(new DeezerLibrary(data.results.TAB, type)).end();
    }
    //Tracks
    let data = await deezer.callApi('deezer.pagePlaylist', {
        playlist_id: deezer.favoritesPlaylist,
        lang: settings.contentLanguage,
        nb: 50,
        start: 0,
        tags: true
    });
    res.send(new DeezerLibrary(data.results.SONGS, type));
});

//DELETE from library
app.delete('/library/:type', async (req, res) => {
    let type = req.params.type;
    let id = req.query.id;

    if (type == 'track') await deezer.callApi('favorite_song.remove', {SNG_ID: id});
    if (type == 'album') await deezer.callApi('album.deleteFavorite', {ALB_ID: id});
    if (type == 'playlist') await deezer.callApi('playlist.deleteFavorite', {playlist_id: parseInt(id, 10)});
    if (type == 'artist') await deezer.callApi('artist.deleteFavorite', {ART_ID: id});

    res.sendStatus(200);
});

//PUT (add) to library
app.put('/library/:type', async (req, res) => {
    let type = req.params.type;
    let id = req.query.id;

    if (type == 'track') await deezer.callApi('favorite_song.add', {SNG_ID: id});
    if (type == 'album') await deezer.callApi('album.addFavorite', {ALB_ID: id});
    if (type == 'artist') await deezer.callApi('artist.addFavorite', {ART_ID: id});
    if (type == 'playlist') await deezer.callApi('playlist.addFavorite', {parent_playlist_id: parseInt(id)});

    res.sendStatus(200);
});


//Get streaming metadata, quality fallback
app.get('/streaminfo/:info', async (req, res) => {
    let info = req.params.info;
    let quality = req.query.q ? req.query.q : 3;
    let qualityInfo = await deezer.fallback(info, quality);

    if (qualityInfo == null)
        return res.sendStatus(404).end();
        
    //Generate stream URL before sending
    qualityInfo.generateUrl();
    return res.json(qualityInfo);
});

// S T R E A M I N G
app.get('/stream/:info', async (req, res) => {
    //Parse stream info
    let quality = req.query.q ? req.query.q : 3;
    let streamInfo = Track.getUrlInfo(req.params.info);
    streamInfo.quality = quality;

    //MIME type of audio
    let mime = 'audio/mp3';
    if (quality == 9) mime = 'audio/flac';

    //Parse range header
    let range = 'bytes=0-';
    if (req.headers.range) range = req.headers.range;
    let rangeParts = range.replace(/bytes=/, '').split('-');
    let start = parseInt(rangeParts[0], 10);
    let end = -1;
    if (rangeParts.length >= 2) end = rangeParts[1];
    if (end == '' || end == ' ') end = -1;

    //Create Stream
    let stream = new DeezerStream(streamInfo, {});
    await stream.open(start, end);

    //Range header
    if (req.headers.range) {
        end = (end == -1) ? stream.size - 1 : end;
        res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${stream.size}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': stream.size - start,
            'Content-Type': mime
        });
    
    //Normal (non range) request
    } else {
        res.writeHead(200, {
            'Content-Length': stream.size,
            'Content-Type': mime
        });
    }

    //Should force HTML5 to retry
    stream.on('error', () => {
        res.destroy();
    });

    stream.pipe(res);
});

//Get deezer page
app.get('/page', async (req, res) => {
    let target = req.query.target.replace(/"/g, '');

    let st = ['album', 'artist', 'channel', 'flow', 'playlist', 'smarttracklist', 'track', 'user'];
    let data = await deezer.callApi('page.get', {}, {
        'PAGE': target,
        'VERSION': '2.3',
        'SUPPORT': {
            'grid': st,
            'horizontal-grid': st,
            'item-highlight': ['radio'],
            'large-card': ['album', 'playlist', 'show', 'video-link'],
            'ads': [] //None
        },
        'LANG': settings.contentLanguage,
        'OPTIONS': []
    });
    res.send(new DeezerPage(data.results));
});

//Get smart track list or flow tracks
app.get('/smarttracklist/:id', async (req, res) => {
    let id = req.params.id;
    
    //Flow not normal STL
    if (id == 'flow') {
        let data = await deezer.callApi('radio.getUserRadio', {
            user_id: deezer.userId
        });
        let tracks = data.results.data.map((t) => new Track(t));
        return res.send(tracks);
    }

    //Normal STL
    let data = await deezer.callApi('smartTracklist.getSongs', {
        smartTracklist_id: id
    });
    //No more tracks
    if (!data.results.data) {
        logger.warn('No more STL tracks: ' + JSON.stringify(data.error));
        return res.send([]);
    }

    let tracks = data.results.data.map((t) => new Track(t));
    return res.send(tracks);
});

//Artist smart radio
app.get('/smartradio/:id', async (req, res) => {
    let data = await deezer.callApi('smart.getSmartRadio', {art_id: req.params.id});
    res.send(data.results.data.map(t => new Track(t)));
});

//Track Mix
app.get('/trackmix/:id', async (req, res) => {
    let data = await deezer.callApi('song.getContextualTrackMix', {sng_ids: [req.params.id]});
    res.send(data.results.data.map(t => new Track(t)));
});

//Load lyrics, ID = SONG ID
app.get('/lyrics/:id', async (req, res) => {
    let data = await deezer.callApi('song.getLyrics', {
        sng_id: parseInt(req.params.id, 10)
    });
    if (!data.results || data.error.length > 0) return res.status(502).send('Lyrics not found!');

    res.send(new Lyrics(data.results));
});

//Search Suggestions
app.get('/suggestions/:query', async (req, res) => {
    let query = req.params.query;
    try {
        let data = await deezer.callApi('search_getSuggestedQueries', {
            QUERY: query
        });
        let out = data.results.SUGGESTION.map((s) => s.QUERY);
        res.json(out);
    } catch (e) {
        res.json([]);
    }
});

//Post list of tracks to download
app.post('/downloads', async (req, res) => {
    downloadManager.addBatch(req.body);

    res.status(200).send('OK');
});

//PUT to /download to start
app.put('/download', async (req, res) => {
    await downloadManager.start();
    res.status(200).send('OK');
});

//DELETE to /download to stop/pause
app.delete('/download', async (req, res) => {
    await downloadManager.stop();
    res.status(200).send('OK');
})

//Get all downloads
app.get('/downloads', async (req, res) => {
    res.json({
        downloading: downloadManager.downloading,
        queue: downloadManager.queue,
        threads: downloadManager.threads.map(t => t.download)
    });
});

//Delete single download
app.delete('/downloads/:index', async (req, res) => {
    let index = parseInt(req.params.index, 10);
    await downloadManager.delete(index);
    res.status(200).end();
});

//Log listen to deezer & lastfm
app.post('/log', async (req, res) => {
    //LastFM
    integrations.scrobbleLastFM(req.body.title, req.body.album.title, req.body.artists[0].name);

    //Deezer
    if (settings.logListen)
        await deezer.callApi('log.listen', {
            params: {
                timestamp: Math.floor(new Date() / 1000),
                ts_listen: Math.floor(new Date() / 1000),
                type: 1,
                stat: {seek: 0, pause: 0, sync: 0},
                media: {id: req.body.id, type: 'song', format: 'MP3_128'}
            }
        });
    res.status(200).end();
});

//Importer
app.post('/import', async (req, res) => {
    //Importer status
    sockets.forEach(s => s.emit('importerInit', {
        done: false,
        active: true,
        error: false,
        tracks: []
    }));
    let type = req.body.type;

    //Create importer
    let importer = new Importer(deezer);
    //Resolve URI
    let uri = await importer.resolveSpotifyURL(req.body.url);
    if (!uri) {
        sockets.forEach(s => s.emit('importerError'));
        return res.status(200).end();
    }
        
    //Import album
    if (uri.split(':')[1] == 'album') {
        try {
            let albumRaw = await importer.importSpotifyAlbum(uri);
            //Get album from Deezer
            let data = await deezer.callApi('deezer.pageAlbum', {alb_id: albumRaw.id.toString(), lang: settings.contentLanguage});
            let album = new Album(data.results.DATA, data.results.SONGS);
            //Download
            if (type == 'download') {
                //Enqueue
                await downloadManager.addBatch({
                    tracks: album.tracks,
                    quality: settings.downloadsQuality,
                });
                downloadManager.start();
                //Send empty response
                sockets.forEach(s => s.emit('importerAlbum', null));
            } else {
                //Send to UI
                sockets.forEach(s => s.emit('importerAlbum', album));
            }
        } catch (e) {
            logger.error(`Import album error: ${e}`);
            sockets.forEach(s => s.emit('importerError'));
        }
        return res.status(200).end();
    }

    //Import playlist
    if (uri.split(':')[1] == 'playlist') {
        //Error
        importer.on('error', () => {
            sockets.forEach(s => s.emit('importerError'));
        })
        //New track imported
        importer.on('imported', t => {
            sockets.forEach(s => s.emit('importerTrack', t));
        });
        //Finished
        importer.on('done', async (i) => {
            //Create playlist
            let playlistRaw = await deezer.callApi('playlist.create', {
                description: i.description,
                title: i.title,
                status: 1,
                songs: i.tracks.map(t => [parseInt(t.id, 10)])
            });
            //Download
            if (type == 'download') {
                //Fetch playlist
                let data = await deezer.callApi('deezer.pagePlaylist', {
                    playlist_id: playlistRaw.results.toString(),
                    lang: settings.contentLanguage,
                    nb: 10000,
                    start: 0,
                    tags: true
                });
                let playlist = new Playlist(data.results.DATA, data.results.SONGS);
                //Enqueue
                await downloadManager.addBatch({
                    tracks: playlist.tracks,
                    quality: settings.downloadsQuality,
                    playlistName: i.title
                });
                //Delete
                await deezer.callApi('playlist.delete', {playlist_id: parseInt(playlist.id.toString(),10)});
                downloadManager.start();
            }

            //Send to UI
            sockets.forEach(s => {
                s.emit('importerDone');
            });
        })

        importer.importSpotifyPlaylist(uri);
        return res.status(200).end();
    }

    //Not imported
    sockets.forEach(s => s.emit('importerError'));
    res.status(200).end();
});

//Last.FM authorization callback
app.get('/lastfm', async (req, res) => {
    //Got token
    if (req.query.token) {
        let token = req.query.token;
        //Authorize
        let authinfo = await integrations.loginLastFM(token);
        if (authinfo) {
            settings.lastFM = authinfo;
            settings.save();
        }
        //Redirect to homepage
        return res.redirect('/');
    }

    //Get auth url
    res.json({
        url: integrations.lastfm.getAuthenticationUrl({cb: `http://${req.socket.remoteAddress}:${settings.port}/lastfm`})
    }).end();
});

//Get URL from deezer.page.link
app.get('/fullurl', async (req, res) => {
    let url = req.query.url;
    let r = await axios.get(url, {validateStatus: null});
    res.json({url: r.request.res.responseUrl});
});

//About page
app.get('/about', async (req, res) => {
    res.json({
        version: packageJson.version
    });
});

app.get('/updates', async (req, res) => {
    try {
        let response = await axios.get('https://freezer.life/api/versions');
        //New version
        if (compareVersions(response.data.pc.latest, packageJson.version) >= 1) {
            res.send(response.data.pc.versions[0]);
            return;
        }
        res.status(404).end();
        return;
    } catch (e) {
        res.status(500).end();
    }
});

//Background image
app.get('/background', async (req, res) => {
    //Missing
    if (!settings.backgroundImage && !fs.existsSync(settings.backgroundImage)) {
        return res.status(404).end();
    }
    res.sendFile(path.resolve(settings.backgroundImage));
});

//Redirect to index on unknown path
app.all('*', (req, res) => {
    res.redirect('/');
});

// S O C K E T S
io.on('connection', (socket) => {
    sockets.push(socket);
    //Remove on disconnect
    socket.on('disconnect', () => {
        sockets.splice(sockets.indexOf(socket), 1);
    });
    //Send to integrations
    socket.on('stateChange', (data) => {
        integrations.updateState(data);
    });
});

//ecb = Error callback
async function createServer(electron = false, ecb, override = {}) {
    //Prepare globals
    settings = new Settings(electron);
    settings.load();

    deezer = new DeezerAPI(settings.arl, electron);

    //Prepare downloads
    downloadManager = new DownloadManager(settings, () => {
        //Emit queue change to socket
        sockets.forEach((s) => {
            s.emit('downloads', {
                downloading: downloadManager.downloading,
                queue: downloadManager.queue,
                threads: downloadManager.threads.map(t => t.download)
            });
        });
    });
    await downloadManager.load();
    downloadManager.setDeezer(deezer);
    //Emit download progress updates
    setInterval(() => {
        sockets.forEach((s) => {
            if (!downloadManager.downloading && downloadManager.threads.length == 0)
                return; 

            s.emit('currentlyDownloading', downloadManager.threads.map(t => t.download));
        });
    }, 400);

    //Integrations (lastfm, discord)
    integrations = new Integrations(settings);
    //Discord Join = Sync tracks
    integrations.on('discordJoin', async (data) => {
        let trackData = await deezer.callApi('deezer.pageTrack', {sng_id: data.id});
        let track = new Track(trackData.results.DATA);
        let out = {
            track: track,
            position: (Date.now() - data.ts) + data.pos
        }
        //Emit to sockets
        sockets.forEach((s) => {
            s.emit('playOffset', out);
        });
    });

    //Error callback
    server.on('error', (e) => {
        if (ecb)
            ecb(e);
        logger.error(e);
    });

    //Start server
    let serverIp = override.host ? override.host : settings.serverIp;
    let port = override.port ? override.port: settings.port;
    server.listen(port, serverIp);
    console.log(`Running on: http://${serverIp}:${port}`);

    return settings;
}

module.exports = {createServer};
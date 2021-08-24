const LastfmAPI = require('lastfmapi');
const DiscordRPC = require('discord-rpc');
const {EventEmitter} = require('events');
const logger = require('./winston');

class Integrations extends EventEmitter {

    //LastFM, Discord etc
    constructor(settings) {
        super();

        this.settings = settings;
        this.discordReady = false;
        this.discordRPC = null;

        //LastFM
        //plz don't steal creds, it's just lastfm
        this.lastfm = new LastfmAPI({
            api_key: 'b6ab5ae967bcd8b10b23f68f42493829',
            secret: '861b0dff9a8a574bec747f9dab8b82bf'
        });
        this.authorizeLastFM();

        //Discord
        if (settings.enableDiscord)
            this.connectDiscord();

    }

    updateSettings(settings) {
        this.settings = settings;
    }

    //Autorize lastfm with saved credentials
    authorizeLastFM() {
        if (!this.settings.lastFM) return;
        this.lastfm.setSessionCredentials(this.settings.lastFM.name, this.settings.lastFM.key);
    }

    //Login to lastfm by token
    async loginLastFM(token) {
        let response = await new Promise((res) => {
            this.lastfm.authenticate(token, (err, sess) => {
                if (err) res();
                res({
                    name: sess.username,
                    key: sess.key
                });
            });
        });
        this.settings.lastFM = response;
        this.authorizeLastFM();
        return response;
    }

    //LastFM Scrobble
    async scrobbleLastFM(title, album, artist) {
        if (this.settings.lastFM) 
            this.lastfm.track.scrobble({
                artist,
                track: title,
                album,
                timestamp: Math.floor((new Date()).getTime() / 1000)
            });
    }

    //Connect to discord client
    connectDiscord() {
        //Don't steal, k ty
        const CLIENTID = '803292927227854878';

        this.discordReady = false;
        DiscordRPC.register(CLIENTID);
        this.discordRPC = new DiscordRPC.Client({transport: 'ipc'});
        this.discordRPC.on('connected', () => {
            this.discordReady = true;

            //Allow discord "join" button
            if (this.settings.discordJoin) {
                //Always accept join requests
                this.discordRPC.subscribe('ACTIVITY_JOIN_REQUEST', (user) => {
                    this.discordRPC.sendJoinInvite(user.user).catch((e) => {
                        logger.warn('Unable to accept Discord invite: ' + e);
                    });
                });
                //Joined
                this.discordRPC.subscribe('ACTIVITY_JOIN', async (data) => {
                    let params = JSON.parse(data.secret);
                    this.emit('discordJoin', params);
                });

            }
        });
        //Connect to discord
        this.discordRPC.login({clientId: CLIENTID}).catch(() => {
            //Wait 5s to retry
            setTimeout(() => {
                if (!this.discordReady)
                    this.connectDiscord();
            }, 5000);
        });
    }

    //Called when playback state changed
    async updateState(data) {
        if (this.discordReady) {
            if (data.state == 2){
                let richPresence = {
                    state: data.track.artistString,
                    details: data.track.title,   
                    largeImageKey: 'icon',
                    instance: true,
                }
                //Show timestamp only if playing
                if (data.state == 2) {
                    Object.assign(richPresence, {
                        startTimestamp: Date.now() - data.position,
                        endTimestamp: (Date.now() - data.position) + data.duration,
                    });
                }
                //Enabled discord join
                if (this.settings.discordJoin) {
                    Object.assign(richPresence, {
                        partySize: 1,
                        partyMax: 10,
                        matchSecret: 'match_secret_' + data.track.id,
                        joinSecret: JSON.stringify({
                            pos: Math.floor(data.position),
                            ts: Date.now(),
                            id: data.track.id
                        }),
                        partyId: 'party_id_' + data.track.id
                    });
                }
                //Set
                this.discordRPC.setActivity(richPresence);
            } else {
                this.discordRPC.clearActivity();
            }
        }
    }

}

module.exports = {Integrations};
<template>
<div>

    <v-img src='@/../public/banner.png' max-width='400px' class='mx-auto'></v-img>
    <div v-if='data' class='text-center text-h5 font-weight-bold'>
        v{{data.version}}
    </div>
    <br>
    <div v-if='update' class='text-center text-h6 font-weight-bold mb-4' @click='openUrl("https://freezer.life")'>
        {{$t("New update available:")}} {{update.version}}
        <v-btn text color='primary' outlined class='mx-2'>{{$t("Visit website")}}</v-btn>
    </div>

    <h1 class='my-2 px-2'>{{$t("Links:")}}</h1>
    <v-list>
        <v-list-item @click='openUrl("https://freezer.life")'>
            <v-list-item-icon>
                <v-icon>mdi-earth</v-icon>
            </v-list-item-icon>
            <v-list-item-content>
                <v-list-item-title class='font-weight-bold'>{{$t("Website")}}</v-list-item-title>
            </v-list-item-content>
        </v-list-item>
        <v-list-item @click='openUrl("https://t.me/joinchat/Se4zLEBvjS1NCiY9")'>
            <v-list-item-icon>
                <v-icon>mdi-telegram</v-icon>
            </v-list-item-icon>
            <v-list-item-content>
                <v-list-item-title class='font-weight-bold'>{{$t("Telegram Releases")}}</v-list-item-title>
            </v-list-item-content>
        </v-list-item>
        <v-list-item @click='openUrl("https://t.me/freezerpc")'>
            <v-list-item-icon>
                <v-icon>mdi-telegram</v-icon>
            </v-list-item-icon>
            <v-list-item-content>
                <v-list-item-title class='font-weight-bold'>{{$t("Telegram Group")}}</v-list-item-title>
            </v-list-item-content>
        </v-list-item>
        <v-list-item @click='openUrl("https://t.me/freezerandroid")'>
            <v-list-item-icon>
                <v-icon>mdi-telegram</v-icon>
            </v-list-item-icon>
            <v-list-item-content>
                <v-list-item-title class='font-weight-bold'>{{$t("Telegram Android Group")}}</v-list-item-title>
            </v-list-item-content>
        </v-list-item>
        <v-list-item @click='openUrl("https://discord.gg/qwJpa3r4dQ")'>
            <v-list-item-icon>
                <v-icon>mdi-discord</v-icon>
            </v-list-item-icon>
            <v-list-item-content>
                <v-list-item-title class='font-weight-bold'>{{$t("Discord")}}</v-list-item-title>
            </v-list-item-content>
        </v-list-item>
    </v-list>

    <h1 class='my-2 px-2'>{{$t("Credits:")}}</h1>
    <v-list>
        <v-list-item>
            <v-list-item-content>
                <v-list-item-title class='font-weight-bold'>exttex</v-list-item-title>
                <v-list-item-subtitle>Developer</v-list-item-subtitle>
            </v-list-item-content>
        </v-list-item>
        <v-list-item>
            <v-list-item-content>
                <v-list-item-title class='font-weight-bold'>Deemix</v-list-item-title>
                <v-list-item-subtitle>Much better app &lt;3</v-list-item-subtitle>
            </v-list-item-content>
        </v-list-item>
        <v-list-item @click='xandarDialog = true'>
            <v-list-item-content>
                <v-list-item-title class='font-weight-bold'>Xandar</v-list-item-title>
                <v-list-item-subtitle>Community manager, helper, tester</v-list-item-subtitle>
            </v-list-item-content>
        </v-list-item>
        <v-list-item>
            <v-list-item-content>
                <v-list-item-title class='font-weight-bold'>Bas Curtiz</v-list-item-title>
                <v-list-item-subtitle>Tester, design help</v-list-item-subtitle>
            </v-list-item-content>
        </v-list-item>
        <v-list-item @click='fTheme'>
            <v-list-item-content>
                <v-list-item-title class='font-weight-bold'>Francesco</v-list-item-title>
                <v-list-item-subtitle>Tester</v-list-item-subtitle>
            </v-list-item-content>
        </v-list-item>
        <v-list-item @click='tobsDialog = true'>
            <v-list-item-content>
                <v-list-item-title class='font-weight-bold'>Tobs</v-list-item-title>
                <v-list-item-subtitle>Alpha tester</v-list-item-subtitle>
            </v-list-item-content>
        </v-list-item>
    </v-list>

    <div class='text-center text-h5 font-weight-bold my-4'>
        Huge thanks to all the Crowdin translators and all the contributors to this project &lt;3
    </div>

    <v-dialog v-model='xandarDialog' max-width='512'>
        <v-card elevation='2'>
            <v-card-title class="headline">
                ass
            </v-card-title>
            <v-card-text>
                windows user
            </v-card-text>
            <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn color="red darken-1" text @click="xandarDialog = false">
                    {{$t("Agree")}}
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>

    <v-dialog v-model='tobsDialog' max-width='512'>
        <v-card elevation='2'>
            <v-img src='@/../public/shibe.png' width='100%'></v-img>
            <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn color="red darken-1" text @click="tobsDialog = false">
                    {{$t("Agree")}}
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>


</div>
</template>

<script>
export default {
    name: 'About',
    data() {
        return {
            data: null,
            xandarDialog: false,
            tobsDialog: false,
            update: null
        }
    },
    methods: {
        openUrl(url) {
            if (this.$root.settings.electron) {
                const {ipcRenderer} = window.require('electron');
                ipcRenderer.send('openUrl', url);
                return;
            }
            window.open(url, '_blank');
        },
        fTheme() {
            this.$root.settings.primaryColor = '#333333';
            this.$vuetify.theme.themes.dark.primary = this.$root.settings.primaryColor;
            this.$vuetify.theme.themes.light.primary = this.$root.settings.primaryColor;
            this.$root.saveSettings();
        }
    },
    created() {
        this.$axios.get('/about').then((res) => {
            this.data = res.data;
        });
    },
    async mounted() {
        //Check for updates
        try {
            let res = await this.$axios.get('/updates');
            if (res.data) {
                this.update = res.data;
            }
        } catch (_) {
            //No update / failed to check, ignore
        }
    }
}
</script>
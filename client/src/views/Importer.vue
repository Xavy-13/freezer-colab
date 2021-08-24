<template>
<div>

    <h1>{{$t("Importer")}}</h1><br>
    <span class='text-h6'>
        <v-icon right color='warning' class='mr-2'>mdi-alert</v-icon>
        {{$t("Currently only Spotify is supported and limited to 100 tracks.")}}
    </span>
    <br>
    <!-- URL entry and buttons -->
    <div class='d-flex mt-4' v-if='!$root.importer.done && !$root.importer.active && !$root.importer.error'>
        <v-text-field
            v-model=input
            :label='$t("Enter URL")'
            :rules='[valid]'
        ></v-text-field>
        <v-btn class='mx-2 mt-4' color='primary' :disabled='!valid' @click='start("import")'>
            <v-icon left>mdi-playlist-plus</v-icon>
            {{$t("Import into playlist")}}
        </v-btn>
        <v-btn class='mx-2 mt-4' color='green' :disabled='!valid' @click='start("download")'>
            <v-icon left>mdi-download</v-icon>
            {{$t("Download")}}
        </v-btn>
    </div>
    <!-- Loading -->
    <div class='text-center my-2' v-if='$root.importer.active'>
        <v-progress-circular indeterminate color='primary'></v-progress-circular>
    </div>
    <!-- Tracks -->
    <div class='mt-4' v-if='$root.importer.done || $root.importer.active'>
        <h2 class='mb-2'>Tracks:</h2>
        <v-list>
            <v-list-item v-for='(track, i) in $root.importer.tracks' :key='i'>
                <v-list-item-avatar>
                    <v-img :src='track.art'></v-img>
                </v-list-item-avatar>
                <v-list-item-content>
                    <v-list-item-title>{{track.title}}</v-list-item-title>
                    <v-list-item-subtitle>{{track.artist}}</v-list-item-subtitle>
                </v-list-item-content>
                <v-list-item-action>
                    <v-icon v-if='track.ok' color='green'>mdi-check</v-icon>
                    <v-icon v-if='!track.ok' color='red'></v-icon>
                </v-list-item-action>
            </v-list-item>
        </v-list>
    </div>

    <!-- Error -->
    <div v-if='$root.importer.error' class='text-center mt-4'>
        <h2>{{$t("An error occured, URL might be invalid or unsupported.")}}</h2>
    </div>

</div>
</template>

<script>
export default {
    name: 'Importer',
    data() {
        return {
            input: null,
        }
    },
    methods: {
        async start(type) {
            await this.$axios.post('/import', {url: this.input, type});
        }
    },
    computed: {
        valid() {
            let i = this.input || '';
            return (i.includes('open.spotify.com/') || i.includes('link.tospotify.com/')) && !i.includes(' ');
        }
    },
    mounted() {
        
    },
    destroyed() {
        //If done
        if (this.$root.importer.done || this.$root.importer.error) {
            this.$root.importer.done = false;
            this.$root.importer.active = false;
            this.$root.importer.error = false;
            this.$root.importer.tracks = [];
        }
    },
}
</script>
// Load environment variables from the .env file.
require('dotenv').config();

// Import the necessary modules.
const express = require('express');
const SpotifyWebApi = require('spotify-web-api-node');
const cors = require('cors');
const bodyParser = require('body-parser');
// Initialize an Express application.
const app = express();
app.use(cors());
app.use(bodyParser.json());


// Define the port number on which the server will listen.
const port = 3050;

let users = []
// Initialize the Spotify API with credentials from environment variables.
const spotifyApi = new SpotifyWebApi({
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    redirectUri: process.env.REDIRECT_URL
});



app.get('/login', (req, res) => {
    // Define the scopes for authorization; these are the permissions we ask from the user.
    const scopes = ['user-read-private', 'user-read-email', 'user-read-playback-state', 'user-modify-playback-state', 'playlist-modify-public', 'playlist-modify-private', 'user-library-modify'];
    // Redirect the client to Spotify's authorization page with the defined scopes.
    res.redirect(spotifyApi.createAuthorizeURL(scopes));
});


// Route handler for the callback endpoint after the user has logged in.
app.get('/callback', (req, res) => {
    // Extract the error, code, and state from the query parameters.
    const error = req.query.error;
    const code = req.query.code;

    // If there is an error, log it and send a response to the user.
    if (error) {
        console.error('Callback Error:', error);
        res.send(`Callback Error: ${error}`);
        return;
    }

    // Exchange the code for an access token and a refresh token.
    spotifyApi.authorizationCodeGrant(code).then(data => {
        const accessToken = data.body['access_token'];
        const refreshToken = data.body['refresh_token'];
        const expiresIn = data.body['expires_in'];

        // Set the access token and refresh token on the Spotify API object.
        spotifyApi.setAccessToken(accessToken);
        spotifyApi.setRefreshToken(refreshToken);

        // Logging tokens can be a security risk; this should be avoided in production.
        console.log('The access token is ' + accessToken);
        console.log('The refresh token is ' + refreshToken);

        // Send a success message to the user.
        res.send('Login successful! You can now use the /search and /play endpoints.');

        // Refresh the access token periodically before it expires.
        setInterval(async () => {
            const data = await spotifyApi.refreshAccessToken();
            const accessTokenRefreshed = data.body['access_token'];
            spotifyApi.setAccessToken(accessTokenRefreshed);
        }, expiresIn / 2 * 1000); // Refresh halfway before expiration.

    }).catch(error => {
        console.error('Error getting Tokens:', error);
        res.send('Error getting tokens');
    });
});

// Route handler for the search endpoint.
app.get('/search', (req, res) => {
    // Extract the search query parameter.
    const { q } = req.query;

    // Make a call to Spotify's search API with the provided query.
    spotifyApi.searchTracks(q).then(searchData => {
        // Extract the URI of the first track from the search results.
        const trackUri = searchData.body.tracks.items[0].uri;
        // Send the track URI back to the client.
        res.send({ uri: trackUri });
    }).catch(err => {
        console.error('Search Error:', err);
        res.send('Error occurred during search');
    });
});

// Route handler for the play endpoint.
app.get('/play', (req, res) => {
    // Extract the track URI from the query parameters.
    const { uri } = req.query;

    // Send a request to Spotify to start playback of the track with the given URI.
    spotifyApi.play({ uris: [uri] }).then(() => {
        res.send('Playback started');
    }).catch(err => {
        console.error('Play Error:', err);
        res.send('Error occurred during playback');
    });
});


// Route handler getting loggedin userData.
app.get('/me', (req, res) => {
    // Extract the track URI from the query parameters.
    // const { uri } = req.query;

    // Send a request to Spotify to start playback of the track with the given URI.
    // Get the authenticated user
    spotifyApi.getMe()
        .then(function(data) {
            res.json(data)
            console.log('Some information about the authenticated user', data.body);
        }, function(err) {
            console.log('Something went wrong!', err);
        });
});



//GET the current playing tracks
app.get('/tracks', (req, res) => {
    spotifyApi.getMyCurrentPlayingTrack()
      .then(function(data) {
        res.json(data)
        console.log('Now playing: ' + data.body.item.name);
      }, function(err) {
        console.log('Something went wrong!', err);
      });
});


// Get Recommendations Based on Seeds

app.get('/recommendations', (req, res) => {
    const { track } = req.query;
    
    //getRecommendations
    spotifyApi.getRecommendations({
        limit: 2,
        min_energy: 0.4,
        // seed_artists: ['6mfK6Q2tzLMEchAr0e9Uzu', '4DYFVNKZ1uixa6SQTvzQwJ'],
        seed_tracks: [track],
        min_popularity: 50
      })
    .then(function(data) {
      let recommendations = data.body.tracks;
      trackIds = recommendations.map(track => track.id);
      res.json(trackIds)
      spotifyApi.addToMySavedTracks(trackIds)
        .then(function(data) {
        console.log('Added track!');
        }, function(err) {
            console.log('Something went wrong!', err);
        });
    // res.json(recommendations)
            console.log(trackIds);
    // console.log(recommendations)
    }, function(err) {
      console.log("Something went wrong!", err);
    });
    
});

app.post('/create', (req, res) => {
    
    spotifyApi.createPlaylist('My Test playlist', { 'description': 'My description', 'public': true })
    .then(function(data) {
        console.log('Created playlist!');
    }, function(err) {
        console.log('Something went wrong!', err);
    });
});



// Start the Express server.
app.listen(port, () => {
    console.log(`Listening at http://localhost:${port}`);
});

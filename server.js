'use strict'

var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
const passport = require('passport');
const session = require('express-session');
const sharedsession = require('express-socket.io-session');
const SteamStrategy = require('passport-steam').Strategy;

const config = require('./config');
const TradeBot = require('./lib/index')
const FlipManager = require('./lib/flipmanager')

const Trade = new TradeBot({ io })
const Flips = new FlipManager({ io })

passport.serializeUser(function(user, done) {
  done(null, user)
});

passport.deserializeUser(function(obj, done) {
  done(null, obj)
});

passport.use(new SteamStrategy({
    returnURL: config.website + '/auth/steam/return',
    realm: config.website,
    apiKey: config.steamApiKey
  },
  function(identifier, profile, done) {
    // asynchronous verification, for effect...
    process.nextTick(function () {

      // To keep the example simple, the user's Steam profile is returned to
      // represent the logged-in user.  In a typical application, you would want
      // to associate the Steam account with a user record in your database,
      // and return that user instead.
      profile.identifier = identifier;
      return done(null, profile)
    });
  }
));

const sessionMiddleware = session({
    secret: 'csg0tradebot',
    name: config.domain,
    resave: true,
    saveUninitialized: true,
})

app.use(sessionMiddleware)
app.use(passport.initialize())
app.use(passport.session())

app.use(express.static(__dirname + '/public'))

// Auth Routes
app.get('/auth/steam', passport.authenticate('steam'))
app.get('/auth/steam/return', passport.authenticate('steam', { failureRedirect: '/auth/steam' }), (req, res) => {
    // Successful authentication, redirect home.
    res.redirect('/')
})
app.get('/logout', (req, res) => {
    req.logout()
    res.redirect('/')
})

app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html')
});

io.use(sharedsession(sessionMiddleware))
io.on('connection', function(socket){
  let userObject = false
    if (
      typeof socket.handshake.session.passport !== 'undefined' &&
      typeof socket.handshake.session.passport.user !== 'undefined' &&
      typeof socket.handshake.session.passport.user.id !== 'undefined'
    ) {
      userObject = socket.handshake.session.passport.user
    }

  socket.emit('site', config.site)
  socket.emit('user', userObject)

  socket.on('get user inv', (steamID64) => {
    Trade.getInventory(steamID64, '730', '2', (err, data) => {
      socket.emit('user inv', { error: err, items: data })
    })
  })

  socket.on('get pricelist', () => {
    socket.emit('pricelist', Trade.getPriceList())
  })

  socket.on('get rates', () => {
    socket.emit('rates', {
      ignore: Trade.getIgnorePrice()
    })
  })

  socket.on('get coinflips', () => {
    socket.emit('current flips', FlipManager.getCurrentFlips())
  })

  socket.on('chat message', function(msg){
    if(msg.name && msg.pic && msg.message.length > 0) {
      io.emit('chat message', msg);
    }
  });
});

http.listen(config.websitePort, function(){
  console.log('Server listening on *:' + config.websitePort);
});
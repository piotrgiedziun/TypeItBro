/**
 * Module dependencies.
 */

var express = require('express')
  , sio = require('socket.io');

/**
 * App.
 */

var app = express.createServer();

/**
 * App configuration.
 */

app.configure(function () {
  app.use(express.static(__dirname + '/public'));
  app.set('views', __dirname + '/templates');
  app.set('view engine', 'ejs');
});

/**
 * App routes.
 */

app.get('/', function (req, res) {
  res.render('index', { layout: false });
});

/**
 * App listen.
 */

app.listen((process.env.PORT||8080), function () {
  var addr = app.address();
  console.log('   app listening on http://' + addr.address + ':' + addr.port);
});

/**
 * Socket.IO server (single process only)
 */

var io = sio.listen(app, { log: false })
  , game = io.of('/socket');

var gameLogic = function() {
  inst = this;
  this.time = 10;
  this.players = {};
  this.text = '';
  this.is_winer = false;

  this.run = function() {
    // reset text position
    for(player_id in this.players) {
      this.players[player_id].text_pos = 0;
    }
    // get text to display
    this.get_text(function(text) {
      inst.text = text;
      inst.start_cooldown();
    });
  }

  // add player
  this.add = function(socket) {
    console.log('id='+socket.id);
    this.players[socket.id] = socket;
  }

  this.get_text = function(callback) {
    callback("William S. Sadler was an American surgeon, psychiatrist and author who helped publish The Urantia Book, a document that resulted from his relationship with a man whom he believed to be channeling extraterrestrials and celestial beings. Mentored by John Harvey Kellogg, he became a doctor and practiced medicine in Chicago.");
  }

  this.start_cooldown = function() {  
    this.emit('start', this.time);
    setTimeout(function() {
      // emit text to players
      inst.emit('text', inst.text);
    }, this.time*1000);
  }

  this.set_progress = function(who, letter) {
    if(this.players[who].text_pos > this.text.length) return;
    
    var opponent_id = 0;
    for(player_id in this.players) {
      if(player_id != who) {
        opponent_id = player_id;
        break;
      }
    }
    
    if(this.text[this.players[who].text_pos].toLowerCase() == letter.toLowerCase()) {
      console.log('valid character');
      console.log('opponent_id='+opponent_id);
      this.players[who].text_pos++;
      this.players[opponent_id].emit('progress', this.players[who].text_pos);

      if(this.players[who].text_pos == this.text.length) {
        // win!!
        console.log('winer!');
        if(this.is_winer === false) {
          this.is_winer = true;
          this.players[opponent_id].emit('win', null);
        }
      }
    }else{
      console.log('invalid character');
      this.players[opponent_id].emit('error', this.players[who].text_pos);
    }
  }

  this.emit = function(name, object) {
    for(player_id in this.players) {
      this.players[player_id].emit(name, object);
    }
  }
};

game.on('connection', function ( socket ) {
  
  socket.on('connect', function ( name, callback ) {
    if( name == null || name.length < 1) {
      return callback( false );
    }

    console.log('>> connected name='+name);
    
    socket.set('name', name);
    socket.join('waiting');

    console.log('count ='+game.clients('waiting').length );

    if ( game.clients('waiting').length == 2) {
      var gameInstance = new gameLogic();

      game.clients('waiting').forEach(function(client, index) {
        client.leave('waiting');
        client.set('game', gameInstance);
        gameInstance.add(client);
      });

      gameInstance.run();
    }
    
    callback( true )
  });

  socket.on('progress', function(letter) {
    socket.get('game', function(err, game) {
      game.set_progress(socket.id, letter);
    }); 
  });

});